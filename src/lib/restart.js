// 次日温和重启：只读快照 + 规则草案 + 严格校验
// 对应《提示词_任务拆解与任务重排.md》Prompt B 的契约；演示模式下草案由本地规则生成，
// 但同样必须经过「每个未完成节点显式出现」以及「不得改 DDL / 不得删任务 / 不得移锁定项」的校验。
import { diffDays, fmtMinutes, fmtRelative, todayKey } from './dates.js'

export const REASON_OPTIONS = [
  { value: 'underestimated', label: '估时预估太短' },
  { value: 'interrupted', label: '意外插入别的事' },
  { value: 'too_hard', label: '任务太难 / 拆得太粗' },
  { value: 'phone', label: '刷手机去了' },
  { value: 'skip', label: '不想说' },
]

export const TIME_OPTIONS = [
  { value: 'more', label: '更多一些' },
  { value: 'same', label: '差不多' },
  { value: 'less', label: '更少一些' },
  { value: 'unknown', label: '还不确定' },
]

export const GOAL_OPTIONS = [
  { value: 'keep', label: '还在推进' },
  { value: 'pause', label: '想缓一缓' },
  { value: 'unknown', label: '还没想好' },
]

export function defaultAnswers() {
  return { reason: null, time: null, goal: null }
}

/** 需要处理的对象：今天之前仍未完成的节点 */
export function collectRestartNodes(state) {
  const today = todayKey()
  return state.tasks.filter(
    (task) => !task.done && task.status !== 'skipped' && diffDays(task.date, today) > 0,
  )
}

/** 只读快照：可丢弃、可重建，不写入任何模型输出为事实 */
export function buildSnapshot(state) {
  const today = todayKey()
  const restartNodes = collectRestartNodes(state)
  const openTasks = state.tasks
    .filter((task) => !task.done)
    .map((task) => {
      const project = task.projectId ? state.projects.find((p) => p.id === task.projectId) : null
      return {
        task_id: task.id,
        title: task.title,
        kind: task.kind === 'node' ? '长期任务子任务' : '普通任务',
        parent_id: task.projectId || null,
        ddl: project ? project.ddl : task.date,
        date: task.date,
        est_min: task.est_min || null,
        category: task.category || null,
        locked: Boolean(task.locked),
        status: '未完成或未知',
        note: task.noteForAI ? task.note || null : null,
      }
    })

  return {
    profile: {
      sleep_time: state.settings.sleepTime,
      pref_tags: [...new Set(state.tasks.map((t) => t.category).filter(Boolean))].slice(0, 6),
    },
    history: {
      recent_days: Object.entries(
        state.settlements.reduce((acc, item) => {
          if (!acc[item.date]) acc[item.date] = { done: 0, undone: 0, unknown: 0, reasons: [] }
          item.items.forEach((row) => {
            if (row.result === 'done') acc[item.date].done += 1
            else if (row.result === 'undone') acc[item.date].undone += 1
            else acc[item.date].unknown += 1
          })
          return acc
        }, {}),
      )
        .slice(-3)
        .map(([date, row]) => ({ date, done_nodes: row.done, undone_nodes: row.undone, unknown_count: row.unknown })),
      per_category: [],
    },
    open_tasks: openTasks,
    restart_nodes: restartNodes.map((n) => n.id),
    today_planned: state.tasks
      .filter((task) => task.date === today && task.locked && !task.done)
      .map((task) => ({ node_id: task.id, label: task.title, locked: true })),
    note: '用户自由文本默认不进入快照；只有勾选「允许用于 AI 分析」的备注才会带上。',
  }
}

const REASON_TEXT = {
  underestimated: '你说了估时太短',
  interrupted: '你说了被意外打断',
  too_hard: '你说了任务太难',
  phone: '你说了刷手机去了',
  skip: '按默认节奏',
}

const reasonOf = (answers) => REASON_TEXT[answers.reason] || '按默认节奏'

function dayLabel(dateKey, today) {
  return fmtRelative(dateKey, today)
}

/**
 * 规则草案（演示模式）
 * 返回与 Prompt B 契约一致的结构，供 UI 展示 before/after 差异后由用户逐项或一键采纳。
 */
export function buildRestartDraft(state, answers) {
  const today = todayKey()
  const nodes = collectRestartNodes(state)
  const lessTime = answers.time === 'less'
  const moreTime = answers.time === 'more'
  const pause = answers.goal === 'pause'

  const proposals = []
  const suggestCancel = []
  const askUser = []
  const conflicts = []

  nodes.forEach((node) => {
    const project = node.projectId ? state.projects.find((p) => p.id === node.projectId) : null
    const ddl = project ? project.ddl : node.date
    const ddlPassed = diffDays(ddl, today) > 0
    const ddlToday = diffDays(ddl, today) === 0
    const before = `原定 ${fmtRelative(node.date, today)}，未完成`

    if (node.locked) {
      proposals.push({
        node_id: node.id,
        action: 'keep_today',
        before,
        after: '保持你锁定的安排不动',
        reason: '你锁定了它',
      })
      return
    }

    if (pause && project) {
      suggestCancel.push({
        node_id: node.id,
        before,
        after: '建议取消这个子任务（需你确认）',
        reason: '你选择想缓一缓',
        needs_confirmation: true,
      })
      return
    }

    if (ddlPassed || ddlToday) {
      conflicts.push({
        node_id: node.id,
        before,
        after: '需要你决定：延期 / 取消 / 自己调',
        reason: ddlPassed ? `「${project ? project.title : '这个任务'}」的截止日已过` : '今天就是截止日，排不下',
        needs_decision: true,
      })
      askUser.push({
        node_id: node.id,
        question: ddlPassed ? '这条已过期，要延期到哪一天？' : '今天截止，要延到明天吗？',
        type: 'defer',
      })
      return
    }

    if (answers.reason === 'underestimated' && Number(node.est_min) > 0) {
      const next = Math.min(240, Math.round(node.est_min * 1.4))
      proposals.push({
        node_id: node.id,
        action: 'adjust_est',
        new_est_min: next,
        before: `${dayLabel(node.date, today)}，预估 ${fmtMinutes(node.est_min)}`,
        after: `${dayLabel(today, today)}做，预估 ${fmtMinutes(next)}（只改估时，不改日期）`,
        reason: reasonOf(answers),
      })
      return
    }

    if (moreTime) {
      proposals.push({
        node_id: node.id,
        action: 'schedule',
        date: today,
        before,
        after: `${dayLabel(today, today)}补上`,
        reason: reasonOf(answers),
      })
      return
    }

    const target = lessTime ? addDay(today, 1) : today
    proposals.push({
      node_id: node.id,
      action: 'schedule',
      date: target,
      before,
      after: lessTime ? '挪到明天，今天少排一点' : `${dayLabel(today, today)}补上`,
      reason: reasonOf(answers),
    })
  })

  const summary = buildSummary({ proposals, suggestCancel, askUser, conflicts, today, nodes })

  return {
    summary,
    proposals,
    suggest_cancel: suggestCancel,
    ask_user: askUser,
    conflicts,
    meta: { mode: 'rule-demo', generated_at: new Date().toISOString(), node_count: nodes.length },
  }
}

function addDay(key, days) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function buildSummary({ proposals, suggestCancel, askUser, conflicts, today, nodes }) {
  if (!nodes.length) return '今天没有需要顺延的未完成节点'
  const todayCount = proposals.filter((p) => p.action === 'schedule' && p.date === today).length
  const parts = []
  if (todayCount) parts.push(`${todayCount} 个节点排今天`)
  const others = proposals.length - todayCount
  if (others) parts.push(`${others} 个顺延`)
  if (conflicts.length) parts.push(`${conflicts.length} 个卡在截止日`)
  if (suggestCancel.length) parts.push(`${suggestCancel.length} 个建议取消待确认`)
  if (askUser.length && !conflicts.length) parts.push(`${askUser.length} 个要问你`)
  return parts.join('，') || '按默认节奏重新排一遍'
}

/**
 * 校验草案：越界项一律丢弃并说明，不静默修正
 * 规则：node_id 必须在未完成集合里；action 合法；不得改 DDL；不得删除；锁定节点不得改日期
 */
export function validateRestartDraft(draft, state) {
  const undone = new Set(collectRestartNodes(state).map((node) => node.id))
  const tasksById = new Map(state.tasks.map((task) => [task.id, task]))
  const dropped = []
  const seen = new Set()

  const proposals = []
  for (const row of draft.proposals || []) {
    const task = tasksById.get(row.node_id)
    if (!undone.has(row.node_id) || !task) {
      dropped.push(`丢弃提案 ${row.node_id}：不属于未完成节点`)
      continue
    }
    if (!['schedule', 'adjust_est', 'keep_today'].includes(row.action)) {
      dropped.push(`丢弃提案 ${row.node_id}：action 不合法`)
      continue
    }
    if (task.locked && row.action === 'schedule' && row.date && row.date !== task.date) {
      dropped.push(`丢弃提案 ${row.node_id}：不能移动用户锁定的节点`)
      continue
    }
    if (row.action === 'adjust_est' && !(Number(row.new_est_min) > 0)) {
      dropped.push(`丢弃提案 ${row.node_id}：估时不合法`)
      continue
    }
    seen.add(row.node_id)
    proposals.push(row)
  }

  const suggestCancel = (draft.suggest_cancel || []).filter((row) => {
    if (!undone.has(row.node_id)) {
      dropped.push(`丢弃取消建议 ${row.node_id}：不属于未完成节点`)
      return false
    }
    seen.add(row.node_id)
    return true
  })

  const askUser = (draft.ask_user || []).filter((row) => {
    if (!undone.has(row.node_id)) {
      dropped.push(`丢弃询问 ${row.node_id}：不属于未完成节点`)
      return false
    }
    seen.add(row.node_id)
    return true
  })

  const conflicts = (draft.conflicts || []).filter((row) => {
    if (!undone.has(row.node_id)) {
      dropped.push(`丢弃冲突 ${row.node_id}：不属于未完成节点`)
      return false
    }
    seen.add(row.node_id)
    return true
  })

  const missing = [...undone].filter((id) => !seen.has(id))
  if (missing.length) {
    dropped.push(`发现 ${missing.length} 个未完成节点没有出现在草案里，已标为「待你手动安排」`)
    missing.forEach((id) => {
      const task = tasksById.get(id)
      conflicts.push({
        node_id: id,
        before: `原定 ${task.date}，未完成`,
        after: '未被草案安排，保留原状等你决定',
        reason: '草案漏掉了它，不自动移动',
        needs_decision: true,
      })
    })
  }

  return {
    draft: { ...draft, proposals, suggest_cancel: suggestCancel, ask_user: askUser, conflicts },
    dropped,
  }
}

/** 采纳后要写入的日期与估时变更（DDL 永不在此列） */
export function planAdoption(draft, selectedIds, state) {
  const tasksById = new Map(state.tasks.map((task) => [task.id, task]))
  const changes = []
  draft.proposals.forEach((row) => {
    if (!selectedIds.includes(row.node_id)) return
    const task = tasksById.get(row.node_id)
    if (!task) return
    // 双保险：即使有人把锁定的节点塞进选择列表，也不写日期变更
    if (task.locked && row.action === 'schedule') return
    if (row.action === 'schedule' && row.date && row.date !== task.date) {
      changes.push({ id: row.node_id, date: row.date })
    }
    if (row.action === 'adjust_est' && Number(row.new_est_min) > 0) {
      changes.push({ id: row.node_id, est_min: Number(row.new_est_min) })
    }
  })
  return changes
}
