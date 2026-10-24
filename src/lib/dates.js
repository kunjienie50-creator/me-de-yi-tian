// 日期与时间工具：全部使用本地时区的 YYYY-MM-DD 字符串作为日期键
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function toKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey() {
  return toKey(new Date())
}

export function addDays(key, n) {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** b - a，单位天 */
export function diffDays(a, b) {
  const ms = fromKey(b).getTime() - fromKey(a).getTime()
  return Math.round(ms / 86400000)
}

export function dayRange(startKey, endKey) {
  const out = []
  let cur = startKey
  let guard = 0
  while (diffDays(cur, endKey) >= 0 && guard < 400) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard += 1
  }
  return out
}

export function fmtMD(key) {
  const d = fromKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function fmtWeekday(key) {
  return WEEK[fromKey(key).getDay()]
}

export function fmtDateFull(key) {
  return `${fmtMD(key)} ${fmtWeekday(key)}`
}

/** 今天 / 明天 / 昨天 / 10月27日 周一 */
export function fmtRelative(key, base = todayKey()) {
  const delta = diffDays(base, key)
  if (delta === 0) return '今天'
  if (delta === 1) return '明天'
  if (delta === -1) return '昨天'
  if (delta === 2) return '后天'
  return fmtDateFull(key)
}

export function fmtClock(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 毫秒 → 01:23:45 */
export function fmtStopwatch(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

/** 分钟 → 1 小时 20 分 */
export function fmtMinutes(min) {
  if (!Number.isFinite(min) || min <= 0) return '0 分钟'
  if (min < 60) return `${Math.round(min)} 分钟`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export function minutesBetween(startIso, endIso) {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000))
}

/** 把 datetime-local 的值转成本地 iso */
export function localInputToIso(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** iso → datetime-local 输入框的值 */
export function isoToLocalInput(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
