// 前端统一入口：调用本地 AI 代理（/api/ai/*）。
// 代理只在 `npm run dev` / `npm run preview` 时存在；线上静态版没有它，
// 所有调用都会失败并自动回退到 `src/lib/decompose.js`、`src/lib/restart.js` 里的离线规则。
// 这一层永远不碰密钥：密钥只在本机 .env，由 server/ai.js 使用。

const ENDPOINT = '/api/ai'

let cached = null // { at, available, model, mock, reason }
const STATUS_TTL = 30_000

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

// 是否有可用的模型：探一次 /health，缓存 30 秒
export async function aiStatus({ force = false } = {}) {
  const now = Date.now()
  if (!force && cached && now - cached.at < STATUS_TTL) return cached
  const res = await request('/health', { timeout: 3000 })
  cached = {
    at: now,
    available: Boolean(res && res.ok),
    model: res?.model || '',
    mock: Boolean(res?.mock),
    reason: res?.ok ? '' : res?.error || '本地没有 AI 代理（线上版就是这样）',
  }
  return cached
}

// 拆解：一句话 → 清单草案（返回 { ok, draft, source, error }）
export async function aiDecompose(input, granularity = 'default') {
  const res = await request('/decompose', { method: 'POST', body: { input, granularity } })
  if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
  return { ok: true, source: 'model', draft: res.draft, usage: res.usage }
}

// 重排：快照 + 三个回答 → 草案（由调用方再过 validateRestartDraft）
export async function aiRestart(snapshot, answers) {
  const res = await request('/restart', { method: 'POST', body: { snapshot, answers }, timeout: 60_000 })
  if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
  return { ok: true, source: 'model', draft: res.draft, usage: res.usage }
}

// 备注补全：标题 → 一句具体提示
export async function aiNote(title, category) {
  const res = await request('/note', { method: 'POST', body: { title, category }, timeout: 20_000 })
  if (!res.ok) return { ok: false, source: 'error', code: res.code, error: res.error }
  return { ok: true, source: 'model', note: res.note || '' }
}
