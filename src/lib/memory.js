/**
 * 用户记忆：把「你实际用了多久」沉淀成可复用的判断。
 *
 * 原则（和产品底线一致）：
 * - 只做建议，不自动改截止日、不删任务、不动锁定节点；
 * - 样本不足时明说「样本太少」，不做看上去很聪明的猜测；
 * - 只记真实发生过的计时（timer），睡前的主观校正不进样本，避免自我放大。
 */

import { toKey } from './dates.js'
import { FALLBACK_TAG, guessTagId } from './tags.js'

// 时长档：样本按「离哪一档最近」归档，避免每条刚好差几分钟就要单独建桶
export const BUCKETS = [15, 30, 60, 90, 120]

const MAX_SAMPLES = 300
const RECENT = 5 // 只取最近 5 条算中位数，人的节奏会变

export function bucketOf(minutes) {
  const value = Number(minutes) || 0
  return BUCKETS.reduce((best, item) => (Math.abs(item - value) < Math.abs(best - value) ? item : best), BUCKETS[0])
}

function median(list) {
  if (!list.length) return null
  const sorted = [...list].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

export function samples(state) {
  return (state && state.memory && state.memory.samples) || []
}

/** 计时结束时追加一条样本；est 缺失就不记，否则没法算偏差 */
export function makeSample(task, minutes, at = new Date().toISOString()) {
  if (!task || !Number(minutes) || !Number(task.est_min)) return null
  return {
    id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    taskId: task.id,
    title: task.title,
    tag: task.tag || guessTagId(task.title) || FALLBACK_TAG,
    est: Number(task.est_min),
    actual: Math.round(Number(minutes)),
    bucket: bucketOf(task.est_min),
    source: 'timer',
    at,
  }
}

export function appendSample(state, sample) {
  if (!sample) return state
  const list = [...samples(state), sample].slice(-MAX_SAMPLES)
  return { ...state, memory: { ...(state.memory || {}), samples: list } }
}

/**
 * 某条任务的「你通常要多久」。
 * 先看 tag × 时长档（最像），不够 3 条再看 tag 整体，再不够就老实说没有。
 */
export function estimateFor(task, state) {
  if (!task || !Number(task.est_min)) {
    return { minutes: null, typical: null, samples: 0, ratio: 1, confidence: 'none', level: 'none' }
  }
  const all = samples(state).filter((item) => item.source === 'timer')
  const tag = task.tag || guessTagId(task.title) || FALLBACK_TAG
  const bucket = bucketOf(task.est_min)

  const sameBucket = all.filter((item) => item.tag === tag && item.bucket === bucket)
  const sameTag = all.filter((item) => item.tag === tag)

  let pool = sameBucket
  let level = 'bucket'
  if (pool.length < 3) {
    pool = sameTag
    level = 'tag'
  }
  if (pool.length < 3) {
    return { minutes: Number(task.est_min), typical: null, samples: pool.length, ratio: 1, confidence: 'none', level: 'none' }
  }

  const recent = pool.slice(-RECENT)
  const typical = median(recent.map((item) => item.actual))
  const rounded = recent.map((item) => Math.round((item.actual / item.est) * 100) / 100)
  // 夹在 ±50% 之间：避免一条离谱记录把后面的估算全带偏
  const ratio = Math.min(1.5, Math.max(0.5, median(rounded) || 1))
  // 「你通常要多久」直接用历史中位数；没有历史时才回退成 est × 比例
  const minutes = Math.max(5, Math.min(480, Math.round(typical || Number(task.est_min) * ratio)))

  return {
    minutes,
    typical,
    samples: recent.length,
    ratio,
    level,
    confidence: recent.length >= 5 ? 'high' : 'low',
  }
}

/** 「今天大概有多少时间」→ 分钟数。回答是模糊的，所以给一个区间中值，并说明这是估算 */
export function capacityFromAnswer(answer) {
  const map = {
    more: { minutes: 180, label: '今天时间比较宽裕，大约 3 小时' },
    same: { minutes: 90, label: '今天和平时差不多，大约 1.5 小时' },
    less: { minutes: 45, label: '今天时间不多，大约 45 分钟' },
  }
  return map[answer] || null
}

/** 从计时记录里看出「你通常在几点进入状态」 */
export function rhythmOf(state) {
  const started = (state && state.sessions ? state.sessions : [])
    .map((item) => new Date(item.startedAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getHours())

  if (started.length < 3) return null

  const histogram = new Array(24).fill(0)
  started.forEach((hour) => {
    histogram[hour] += 1
  })

  // 用一个 3 小时滑窗找最集中的时间段
  let bestStart = 9
  let bestSum = -1
  for (let hour = 0; hour < 24; hour += 1) {
    let sum = 0
    for (let offset = 0; offset < 3; offset += 1) sum += histogram[(hour + offset) % 24]
    if (sum > bestSum) {
      bestSum = sum
      bestStart = hour
    }
  }
  // 3 条以上才开始讲「你的节奏」，否则只是巧合
  if (bestSum < 3) return null
  const pad = (n) => String(n).padStart(2, '0')
  return {
    label: `${pad(bestStart)}:00–${pad((bestStart + 3) % 24)}:00`,
    hours: [bestStart, (bestStart + 3) % 24],
    samples: started.length,
  }
}

/** 按分类汇总，给设置页用 */
export function tagSummary(state) {
  const all = samples(state).filter((item) => item.source === 'timer')
  const byTag = new Map()
  all.forEach((item) => {
    const list = byTag.get(item.tag) || []
    list.push(item)
    byTag.set(item.tag, list)
  })
  return [...byTag.entries()]
    .map(([tag, list]) => {
      const recent = list.slice(-RECENT)
      return {
        tag,
        count: list.length,
        typical: median(recent.map((item) => item.actual)),
        estimated: median(recent.map((item) => item.est)),
        lastAt: recent[recent.length - 1] ? toKey(new Date(recent[recent.length - 1].at)) : null,
      }
    })
    .sort((a, b) => b.count - a.count)
}

export function forgetMemory(state, tag) {
  const all = samples(state)
  const next = tag ? all.filter((item) => item.tag !== tag) : []
  return { ...state, memory: { ...(state.memory || {}), samples: next } }
}
