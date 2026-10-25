// 本地存储：任务数据只在当前浏览器保存，不上传任何内容
const KEY = 'me-de-yi-tian.state.v1'
// 版本对不上、或者数据读坏了时，先把原文留一份再覆盖，别让用户的记录悄悄消失
const BACKUP_KEY = 'me-de-yi-tian.state.backup.v1'
// 重置时一起清掉的零散 key（漏停提示的「先不管」、计时页的快捷记录）
const SIDE_KEYS = ['me-de-yi-tian.leak-dismissed.v1', 'me-de-yi-tian.timer-bookmark']

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
    SIDE_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    console.warn('[storage] 清理失败', error)
  }
}

/**
 * 把当前存着的数据原样搬到备份 key 上（只在要覆盖它之前调用）。
 * 返回 true 表示确实备份到了东西。
 */
export function backupState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    localStorage.setItem(BACKUP_KEY, raw)
    return true
  } catch (error) {
    console.warn('[storage] 备份失败', error)
    return false
  }
}

/** 读取备份（设置页/排错时可用来人工找回） */
export function loadBackup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
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
