// 漏停检测：计时开着但人已经走了
// 规则：开了 5 小时以上，或者「跨天」了（开始那天和今天不是同一天）就提示补录。
// 只提示、不自动结束、不猜结束时间——真实结束时间由用户自己填。
import { toKey } from './dates.js'

export const LEAK_HOURS = 5
const DISMISS_KEY = 'me-de-yi-tian.leak-dismissed.v1'

/** 返回 null 表示这次计时不需要提示 */
export function timerLeak(timer, now, today) {
  if (!timer) return null
  const startedAt = new Date(timer.startedAt)
  if (Number.isNaN(startedAt.getTime())) return null
  const elapsed = now - startedAt.getTime()
  const crossedDay = toKey(startedAt) !== today
  const tooLong = elapsed >= LEAK_HOURS * 3600 * 1000
  if (!crossedDay && !tooLong) return null
  return {
    timerId: timer.id,
    startedAt: timer.startedAt,
    elapsed,
    crossedDay,
    hours: Math.floor(elapsed / 3600000),
    reason: crossedDay ? '这条计时跨天了' : `这条计时已经开了 ${Math.floor(elapsed / 3600000)} 小时`,
  }
}

/** 用户点过「先不管」后，同一个计时不再反复弹 */
export function isLeakDismissed(timerId) {
  if (!timerId) return false
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    return Boolean(data && data.timerId === timerId)
  } catch {
    return false
  }
}

export function dismissLeak(timerId) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ timerId, at: new Date().toISOString() }))
  } catch {
    /* 存不进去也不影响使用 */
  }
}

export function clearLeakDismiss() {
  try {
    localStorage.removeItem(DISMISS_KEY)
  } catch {
    /* ignore */
  }
}
