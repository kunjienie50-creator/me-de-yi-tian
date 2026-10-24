// 排期全部由规则完成：AI 不安排日期，用户可拖动微调
import { dayRange, diffDays } from './dates.js'

const DAY_CAPACITY_MIN = 240 // 单日预计投入上限，仅用于冲突预检的提示口径

/**
 * 均匀排期
 * - 有估时：让每个可用日的预计投入尽量接近
 * - 无估时：每个可用日的节点数量差不超过 1
 * 返回 Map<taskId, dateKey>
 */
export function planEven(nodes, startKey, ddlKey) {
  const result = new Map()
  if (!nodes.length) return result
  const days = dayRange(startKey, ddlKey)
  if (!days.length) {
    // DDL 已经早于今天：不静默改日期，先全部留在 DDL 当天由用户决定
    nodes.forEach((node) => result.set(node.id, ddlKey))
    return result
  }

  const hasEst = nodes.every((node) => Number(node.est_min) > 0)

  if (!hasEst) {
    const base = Math.floor(nodes.length / days.length)
    const rem = nodes.length % days.length
    let cursor = 0
    days.forEach((day, dayIndex) => {
      const count = base + (dayIndex < rem ? 1 : 0)
      for (let i = 0; i < count && cursor < nodes.length; i += 1) {
        result.set(nodes[cursor].id, day)
        cursor += 1
      }
    })
    // 兜底：还有剩余节点就压在最后一天
    while (cursor < nodes.length) {
      result.set(nodes[cursor].id, days[days.length - 1])
      cursor += 1
    }
    return result
  }

  const load = new Map(days.map((day) => [day, 0]))
  let fromIndex = 0
  nodes.forEach((node) => {
    const est = Number(node.est_min) || 30
    let best = fromIndex
    for (let i = fromIndex; i < days.length; i += 1) {
      if (load.get(days[i]) < load.get(days[best])) best = i
    }
    result.set(node.id, days[best])
    load.set(days[best], load.get(days[best]) + est)
    fromIndex = best
  })
  return result
}

export function clampDate(dateKey, minKey, maxKey) {
  let next = dateKey
  if (minKey && diffDays(minKey, next) < 0) next = minKey
  if (maxKey && diffDays(next, maxKey) < 0) next = maxKey
  return next
}

/** 每天的节点数与预计投入，用于排期页说明「差不超过 1」 */
export function dailyLoad(nodes) {
  const map = new Map()
  nodes.forEach((node) => {
    if (!node.date) return
    const row = map.get(node.date) || { date: node.date, count: 0, minutes: 0 }
    row.count += 1
    row.minutes += Number(node.est_min) || 0
    map.set(node.date, row)
  })
  return [...map.values()].sort((a, b) => diffDays(b.date, a.date))
}

export function isPastDue(task, today) {
  if (!task || task.done) return false
  return diffDays(task.date, today) > 0
}

/** 规则预检冲突（不阻塞用户，只提示） */
export function detectConflicts(nodes, ddlKey, today) {
  const issues = []
  if (!ddlKey) return issues
  const ddlPast = diffDays(ddlKey, today) > 0
  const remaining = diffDays(today, ddlKey)
  const undone = nodes.filter((node) => !node.done)
  const totalMin = undone.reduce((sum, node) => sum + (Number(node.est_min) || 0), 0)

  if (ddlPast) {
    issues.push({
      level: 'danger',
      text: `截止日 ${ddlKey} 已经过去，还有 ${undone.length} 个节点没完成。要不要延期、取消或自己调整？`,
    })
  } else if (remaining === 0) {
    issues.push({
      level: 'danger',
      text: `今天是截止日，还有 ${undone.length} 个节点（约 ${totalMin} 分钟）没安排。延期 / 取消 / 自己调，决定权在你。`,
    })
  } else if (totalMin > remaining * DAY_CAPACITY_MIN) {
    issues.push({
      level: 'warn',
      text: `剩余 ${undone.length} 个节点约 ${totalMin} 分钟，按每天 ${DAY_CAPACITY_MIN} 分钟算，${remaining + 1} 天内装不下。`,
    })
  }
  return issues
}

/** 拖动时给出「今天」作为最早可放日期 */
export function earliestDate(nodes, fallback) {
  return nodes.reduce((min, node) => (diffDays(fallback, node.date) > 0 ? fallback : min), fallback)
}

/** 同一目标内的节点顺序：seq 优先，缺省时按日期兜底 */
export function sortBySeq(nodes) {
  return [...nodes].sort((a, b) => {
    const sa = Number(a.seq) || 0
    const sb = Number(b.seq) || 0
    if (sa && sb && sa !== sb) return sa - sb
    return diffDays(b.date || '1970-01-01', a.date || '1970-01-01')
  })
}

/**
 * 前驱约束：一个节点不能排在它前一个节点之前，也不能排在后一个节点之后。
 * 返回 { date, error }：error 有值时表示这次摆放不合法，date 保持原样。
 */
export function clampToNeighbors(orderedNodes, index, dateKey, minKey, maxKey) {
  const node = orderedNodes[index]
  const prev = orderedNodes[index - 1]
  const next = orderedNodes[index + 1]
  let next_ = dateKey

  if (minKey && diffDays(minKey, next_) < 0) next_ = minKey
  if (maxKey && diffDays(next_, maxKey) < 0) next_ = maxKey

  if (prev && prev.date && diffDays(prev.date, next_) < 0) {
    return { date: node.date, error: `它前面还有「${prev.title}」，前驱必须排在前面` }
  }
  if (next && next.date && diffDays(next_, next.date) < 0) {
    return { date: node.date, error: `它后面还有「${next.title}」，不能排到它之后` }
  }
  return { date: next_, error: null }
}

/** 检查排期里有没有违反顺序的节点（用于提示，不自动改日期） */
export function orderConflicts(orderedNodes) {
  const issues = []
  orderedNodes.forEach((node, index) => {
    const prev = orderedNodes[index - 1]
    if (!prev || !node.date || !prev.date) return
    if (diffDays(prev.date, node.date) < 0) {
      issues.push({ nodeId: node.id || node.key, text: `「${node.title}」排在了「${prev.title}」前面` })
    }
  })
  return issues
}
