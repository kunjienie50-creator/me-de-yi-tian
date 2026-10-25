// 前端统一入口，两种模式：
//
// - proxy（默认，本地 dev）：调 /api/ai/*，密钥只在 server/ai.js 读 .env，浏览器永远看不到。
// - direct（线上静态站）：浏览器直接请求 DeepSeek，密钥在构建时注入（VITE_DEEPSEEK_KEY）。
//   ⚠️ 静态站是公开的，任何人打开页面都能从 bundle 里把密钥抠出来。只给 demo 用，
//   请用单独申请、设了额度上限的 key，并随时准备轮换。
//
// 两种模式失败时行为一致：返回 { ok:false }，调用方回退到本地规则。

import {
  DECOMPOSE_SYSTEM,
  NOTE_SYSTEM,
  RESTART_SYSTEM,
  buildDecomposeUser,
  buildNoteUser,
  buildRestartUser,
  dayKey,
  pickJson,
} from './prompts.js'

const ENV = import.meta.env || {}

// 构建期注入（见 vite.config.js 的 define）：
// __AI_DIRECT__ 表示这版要直连；__AI_KEY_PARTS__ 是分段 base64 的密钥，运行时拼回来。
// 注意：这不是加密，只是不让完整密钥以明文躺在 bundle 里；静态站上它依然是公开的。
function injectedKey() {
  try {
    if (typeof __AI_KEY_PARTS__ === 'undefined' || !Array.isArray(__AI_KEY_PARTS__)) return ''
    return __AI_KEY_PARTS__.map((part) => atob(part)).join('')
  } catch {
    return ''
  }
}

const DIRECT_FLAG = typeof __AI_DIRECT__ !== 'undefined' && __AI_DIRECT__ === true
const MODE = DIRECT_FLAG || (ENV.VITE_AI_MODE || 'proxy').toLowerCase() === 'direct' ? 'direct' : 'proxy'
const KEY = injectedKey().trim()
const BASE = (ENV.VITE_DEEPSEEK_BASE || 'https://api.deepseek.com').replace(/\/+$/, '')
const MODEL = ENV.VITE_DEEPSEEK_MODEL || 'deepseek-chat'

const ENDPOINT = '/api/ai'

let cached = null // { at, available, model, mock, mode, reason }
const STATUS_TTL = 30_000

// ---------------- proxy 模式（本地 dev） ----------------

async function request(path, { method = 'GET', body, timeout = 50_000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`${ENDPOINT}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, source: 'error', code: `HTTP_${res.status}`, error: `代理返回 ${res.status}` }
    }
    return await res.json()
  } catch (error) {
    const aborted = error && error.name === 'AbortError'
    return {
      ok: false,
      source: 'error',
      code: aborted ? 'TIMEOUT' : 'NETWORK',
      error: aborted ? '请求超时' : '连不上本地代理',
    }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------- direct 模式（线上静态站） ----------------

async function callDirect(system, user, { maxTokens = 1200, temperature = 0.3, timeout = 45_000 } = {}) {
  if (!KEY) {
    return { ok: false, source: 'error', code: 'NO_KEY', error: '这个版本没有内置模型密钥' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
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
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        source: 'error',
        code: res.status === 401 ? 'BAD_KEY' : 'UPSTREAM',
        error: `DeepSeek ${res.status}：${text.slice(0, 160)}`,
      }
    }
    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    const parsed = pickJson(content)
    if (!parsed) {
      return { ok: false, source: 'error', code: 'BAD_JSON', error: '模型返回的不是合法 JSON' }
    }
    return { ok: true, data: parsed, usage: json?.usage || null }
  } catch (error) {
    const aborted = error && error.name === 'AbortError'
    return {
      ok: false,
      source: 'error',
      code: aborted ? 'TIMEOUT' : 'NETWORK',
      error: aborted ? '请求超时' : '连不上 DeepSeek（网络或跨域被拦）',
    }
  } finally {
    clearTimeout(timer)
  }
}

// 用一次「列模型」请求验证密钥是否可用，不消耗 token
async function directHealth() {
  if (!KEY) {
    return { ok: false, source: 'error', code: 'NO_KEY', error: '这个版本没有内置模型密钥' }
  }
  try {
    const res = await fetch(`${BASE}/models`, {
      headers: { authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return {
        ok: false,
        source: 'error',
        code: res.status === 401 ? 'BAD_KEY' : `HTTP_${res.status}`,
        error: res.status === 401 ? '内置的模型密钥无效' : `DeepSeek 返回 ${res.status}`,
      }
    }
    return { ok: true, model: MODEL }
  } catch (error) {
    return { ok: false, source: 'error', code: 'NETWORK', error: '连不上 DeepSeek' }
  }
}

// ---------------- 对外接口（两种模式同一套签名） ----------------

export async function aiStatus({ force = false } = {}) {
  const now = Date.now()
  if (!force && cached && now - cached.at < STATUS_TTL) return cached

  if (MODE === 'direct') {
    const res = await directHealth()
    cached = {
      at: now,
      available: Boolean(res.ok),
      model: res.ok ? MODEL : '',
      mock: false,
      mode: 'direct',
      reason: res.ok ? '' : res.error || '连不上 DeepSeek',
    }
    return cached
  }

  const res = await request('/health', { timeout: 3000 })
  cached = {
    at: now,
    available: Boolean(res && res.ok),
    model: res?.model || '',
    mock: Boolean(res?.mock),
    mode: 'proxy',
    reason: res?.ok ? '' : res?.error || '本地没有 AI 代理（线上版就是这样）',
  }
  return cached
}

// 拆解：一句话 → 清单草案（返回 { ok, draft, source, error }）
export async function aiDecompose(input, granularity = 'default') {
  if (MODE === 'direct') {
    const res = await callDirect(DECOMPOSE_SYSTEM, buildDecomposeUser({ input, granularity }), {
      temperature: 0.4,
    })
    if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
    return { ok: true, source: 'model', draft: res.data, usage: res.usage }
  }
  const res = await request('/decompose', { method: 'POST', body: { input, granularity } })
  if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
  return { ok: true, source: 'model', draft: res.draft, usage: res.usage }
}

// 重排：快照 + 三个回答 → 草案（由调用方再过 validateRestartDraft）
export async function aiRestart(snapshot, answers, extra = {}) {
  if (MODE === 'direct') {
    const today = dayKey(0)
    const tomorrow = dayKey(1)
    const res = await callDirect(
      RESTART_SYSTEM,
      buildRestartUser({ snapshot, answers, today, tomorrow }),
      { temperature: 0.2, maxTokens: 1600, timeout: 60_000 },
    )
    if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
    return { ok: true, source: 'model', draft: res.data, usage: res.usage, today, tomorrow }
  }
  const res = await request('/restart', { method: 'POST', body: { snapshot, answers }, timeout: 60_000 })
  if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
  return { ok: true, source: 'model', draft: res.draft, usage: res.usage }
}

// 备注补全：标题 → 一句具体提示
export async function aiNote(title, category) {
  if (MODE === 'direct') {
    const res = await callDirect(NOTE_SYSTEM, buildNoteUser({ title, category }), {
      temperature: 0.6,
      maxTokens: 200,
      timeout: 20_000,
    })
    if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
    return { ok: true, source: 'model', note: typeof res.data?.note === 'string' ? res.data.note : '' }
  }
  const res = await request('/note', { method: 'POST', body: { title, category }, timeout: 20_000 })
  if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
  return { ok: true, source: 'model', note: res.note || '' }
}

export const AI_MODE = MODE
