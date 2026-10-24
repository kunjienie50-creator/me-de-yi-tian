// 本地存储：任务数据只在当前浏览器保存，不上传任何内容
const KEY = 'me-de-yi-tian.state.v1'

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (error) {
    console.warn('[storage] 读取失败，使用初始数据', error)
    return null
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    return { ok: true }
  } catch (error) {
    const quota = error && (error.name === 'QuotaExceededError' || error.code === 22)
    return {
      ok: false,
      reason: quota ? '浏览器本地存储空间不足，本次改动没有保存' : '本地保存失败，本次改动没有保存',
    }
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY)
  } catch (error) {
    console.warn('[storage] 清理失败', error)
  }
}

/** 粗略统计本地数据体积，用于设置页交代数据边界 */
export function storageBytes(state) {
  try {
    if (state) return new Blob([JSON.stringify(state)]).size
    const raw = localStorage.getItem(KEY) || ''
    return new Blob([raw]).size
  } catch {
    return 0
  }
}

export function fmtBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
