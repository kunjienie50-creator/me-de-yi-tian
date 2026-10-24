// 本地 AI 代理：把前端的三处模型调用转给 DeepSeek。
// 只在 `npm run dev` 时生效（Vite 中间件），密钥只从本机 .env 读，永远不下发到浏览器。
// 生产构建（GitHub Pages）没有这个代理，前端会自动降级成「离线规则」模式。

const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

const PRIORITY_HINT = 'priority 只能是 high / mid / low 之一：开头要做（定目标、列清单、梳理、准备、收集）用 high，收尾（检查、复盘、导出、定稿）用 low，其余 mid。'

// ---- Prompt A：把一句话拆成清单 ----
const DECOMPOSE_SYSTEM = `你是「me的一天」里负责拆任务的中文助理。用户会给你一句话目标，你要把它拆成 3-8 个可以直接动手的节点。

硬性要求：
1. 只输出 JSON，不要解释、不要 Markdown 代码块。
2. 绝对不要输出日期、星期、时间点 —— 排期由别的规则模块负责，你只管拆。
3. 每个 label 不超过 20 个汉字，必须是一个具体动作，不要「提升能力」这种空话。
4. est_min 是这条大概要几分钟，取 5 的倍数，范围 10-240。
5. seq 从 1 开始连续编号，就是执行顺序；${PRIORITY_HINT}
6. category 用 2-4 个字概括这条属于哪类（如 准备、执行、检查）。

输出格式：
{"title":"目标名（不超过 20 字）","category":"2-4 字","est_total_min":总分钟数,"nodes":[{"seq":1,"label":"...","category":"...","est_min":30,"priority":"high"}]}`

// ---- Prompt B：昨天没做完，给一份重排草案 ----
const RESTART_SYSTEM = `你是「me的一天」里负责次日重排的中文助理。用户会给你一份只读快照（open_tasks 是未完成的事、restart_nodes 是「停在今天之前」的 node_id 列表、answers 是用户对三个问题的回答，null 表示没回答）以及今天/明天的日期。

硬性禁止（违反即作废）：
1. 不许改任何截止日（ddl）—— 输出里不要出现 ddl 字段。
2. 不许删除任务；只能放进 suggest_cancel 里**建议**，要用户逐条确认。
3. 不许移动 locked 为 true 的节点；这类一律放进 keep_today。
4. restart_nodes 里每个 node_id 必须恰好出现在 proposals / keep_today / suggest_cancel / ask_user / conflicts 中的一类里，不许漏、不许重复。
5. 不许评价用户、不许推断「你失败了」；没回答就当未知。

字段规则：
- proposals 里 action 只能是 schedule 或 adjust_est：
  schedule 必须带 date，且只能是给定的 today 或 tomorrow；
  adjust_est 必须带 new_est_min（10-240 的整数，且只能比原来大，最多 ×1.5）。
- keep_today 里的项没有 date，表示保持原样。
- before / after 是给用户看的中文短句，after 不要写具体日期以外的承诺。
- summary 一句话说明这份草案怎么排的（不超过 40 字）。

输出 JSON（不要多余键，不要 Markdown）：
{"summary":"...",
 "proposals":[{"node_id":"x","action":"schedule","date":"YYYY-MM-DD","before":"原定 昨天，未完成","after":"今天补上","reason":"..."}],
 "keep_today":[{"node_id":"x","reason":"你锁定了它"}],
 "suggest_cancel":[{"node_id":"x","reason":"..."}],
 "ask_user":[{"node_id":"x","question":"..."}],
 "conflicts":[{"node_id":"x","before":"原定 昨天","after":"原样不动","reason":"截止日就是今天，排不下"}]}`

function dayKey(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ---- 备注补全：给一句话任务补一句具体提示 ----
const NOTE_SYSTEM = `你是「me的一天」里帮忙补备注的中文助理。用户给你一件事的标题（可能还有分类），补一句能让这件事更容易开始的备注。

要求：
1. 只输出 JSON：{"note":"..."}，不要解释。
2. 备注不超过 40 个汉字，写成一件具体可执行的小动作或一句提醒，不要喊口号。
3. 不写日期和用户名，不评价用户。`

function pickJson(text) {
  if (!text) return null
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

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
  const tone =
    granularity === 'coarse'
      ? '这次请拆得粗一点：4-5 个节点，每步跨度大一些。'
      : granularity === 'fine'
        ? '这次请拆得细一点：6-8 个节点，每步都是十几分钟能动手的小动作。'
        : '按常规粒度拆：5-6 个节点。'
  const user = `目标：${input}\n${tone}`
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
  const user = [
    `今天：${today}`,
    `明天：${tomorrow}`,
    '',
    '快照（只读）：',
    JSON.stringify(snapshot, null, 2),
    '',
    '用户对三个问题的回答（null 表示没回答，按未知处理）：',
    JSON.stringify(answers),
  ].join(String.fromCharCode(10))
  const { data, usage } = await callDeepSeek(RESTART_SYSTEM, user, { temperature: 0.2, maxTokens: 1600 })
  return { draft: data, usage, today, tomorrow }
}

export async function runNote({ title, category }) {
  if (aiConfig().mock) {
    return { note: '先花 3 分钟把要用的东西摆到手边', usage: null }
  }
  const user = `标题：${title}\n分类：${category || '未分类'}`
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
