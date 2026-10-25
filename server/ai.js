// 本地 AI 代理：把前端的三处模型调用转给 DeepSeek。
// 只在 `npm run dev` 时生效（Vite 中间件），密钥只从本机 .env 读，永远不下发到浏览器。
// 生产构建（GitHub Pages）没有这个代理，前端会自动降级成「离线规则」模式。

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

import {
  DECOMPOSE_SYSTEM,
  NOTE_SYSTEM,
  RESTART_SYSTEM,
  buildDecomposeUser,
  buildNoteUser,
  buildRestartUser,
  dayKey,
  pickJson,
} from '../src/lib/prompts.js'

export function aiConfig() {
  const key = (process.env.DEEPSEEK_API_KEY || '').trim()
  return {
    model: MODEL,
    baseUrl: BASE_URL,
    hasKey: Boolean(key),
    mock: process.env.DEEPSEEK_MOCK === '1',
  }
}

async function callDeepSeek(system, user, { maxTokens = 1200, temperature = 0.3 } = {}) {
  const key = (process.env.DEEPSEEK_API_KEY || '').trim()
  if (!key) {
    const error = new Error('没有配置 DEEPSEEK_API_KEY')
    error.code = 'NO_KEY'
    throw error
  }
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  })
  if (!res.ok) {
    const text = await res.text()
    const error = new Error(`DeepSeek ${res.status}: ${text.slice(0, 200)}`)
    error.code = res.status === 401 ? 'BAD_KEY' : 'UPSTREAM'
    throw error
  }
  const json = await res.json()
  const content = json?.choices?.[0]?.message?.content
  const parsed = pickJson(content)
  if (!parsed) {
    const error = new Error('模型返回的不是合法 JSON')
    error.code = 'BAD_JSON'
    throw error
  }
  return { data: parsed, usage: json?.usage || null }
}

// ---- 三个动作：拆解 / 重排 / 备注 ----

export async function runDecompose({ input, granularity }) {
  if (aiConfig().mock) {
    const seedNodes = [
      ['定下这次要做到什么', '准备', 20, 'high'],
      ['把要用的材料找齐', '准备', 30, 'high'],
      ['列出具体步骤', '计划', 20, 'mid'],
      ['动手做第一版', '执行', 60, 'mid'],
      ['检查并收尾', '检查', 30, 'low'],
    ]
    return {
      draft: {
        title: String(input || '一件想做的事').slice(0, 20),
        category: '准备',
        est_total_min: seedNodes.reduce((sum, n) => sum + n[2], 0),
        nodes: seedNodes.map(([label, category, est_min, priority], index) => ({
          seq: index + 1,
          label,
          category,
          est_min,
          priority,
        })),
      },
      usage: null,
    }
  }
  const user = buildDecomposeUser({ input, granularity })
  const { data, usage } = await callDeepSeek(DECOMPOSE_SYSTEM, user, { temperature: 0.4 })
  return { draft: data, usage }
}

export async function runRestart({ snapshot, answers }) {
  const today = dayKey(0)
  const tomorrow = dayKey(1)
  if (aiConfig().mock) {
    const ids = (snapshot && snapshot.restart_nodes) || []
    const open = new Map(((snapshot && snapshot.open_tasks) || []).map((t) => [t.task_id, t]))
    const draft = {
      summary: `把 ${ids.length} 件往后挪到今天或明天，锁定的保持不动`,
      proposals: ids.map((id) => ({
        node_id: id,
        action: 'schedule',
        date: today,
        before: '原定 昨天，未完成',
        after: '今天补上',
        reason: 'mock：默认往后挪一天',
      })),
      keep_today: ids.filter((id) => open.get(id)?.locked).map((id) => ({ node_id: id, reason: '你锁定了它' })),
      suggest_cancel: [],
      ask_user: [],
      conflicts: [],
    }
    // 锁定的节点同时出现在 proposals 里会被校验丢弃，这里直接剔掉
    draft.proposals = draft.proposals.filter((row) => open.get(row.node_id)?.locked !== true)
    return { draft, usage: null, today, tomorrow }
  }
  const user = buildRestartUser({ snapshot, answers, today, tomorrow })
  const { data, usage } = await callDeepSeek(RESTART_SYSTEM, user, { temperature: 0.2, maxTokens: 1600 })
  return { draft: data, usage, today, tomorrow }
}

export async function runNote({ title, category }) {
  if (aiConfig().mock) {
    return { note: '先花 3 分钟把要用的东西摆到手边', usage: null }
  }
  const user = buildNoteUser({ title, category })
  const { data, usage } = await callDeepSeek(NOTE_SYSTEM, user, { temperature: 0.6, maxTokens: 200 })
  return { note: typeof data.note === 'string' ? data.note : '', usage }
}

// ---- HTTP 中间件：/api/ai/health | /api/ai/decompose | /api/ai/restart | /api/ai/note ----

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 200_000) {
        reject(new Error('请求体太大'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

export function aiMiddleware() {
  return async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/ai/')) return next()
    const action = req.url.replace('/api/ai/', '').split('?')[0]

    if (action === 'health') {
      const config = aiConfig()
      sendJson(res, 200, { ok: config.hasKey || config.mock, ...config })
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' })
      return
    }

    try {
      const body = await readBody(req)
      if (action === 'decompose') {
        const { draft, usage } = await runDecompose(body)
        sendJson(res, 200, { ok: true, source: 'model', draft, usage })
        return
      }
      if (action === 'restart') {
        const { draft, usage } = await runRestart(body)
        sendJson(res, 200, { ok: true, source: 'model', draft, usage })
        return
      }
      if (action === 'note') {
        const { note, usage } = await runNote(body)
        sendJson(res, 200, { ok: true, source: 'model', note, usage })
        return
      }
      sendJson(res, 404, { ok: false, error: `未知动作 ${action}` })
    } catch (error) {
      // 任何失败都只返回结构化错误，前端会自动回退到离线规则
      sendJson(res, 200, {
        ok: false,
        source: 'error',
        code: error.code || 'ERROR',
        error: String(error.message || error).slice(0, 300),
      })
    }
  }
}
