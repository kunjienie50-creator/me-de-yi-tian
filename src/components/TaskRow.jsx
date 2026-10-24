import { fmtMinutes, fmtRelative, todayKey } from '../lib/dates.js'
import { Badge } from './ui.jsx'
import Cat from './Cat.jsx'

export default function TaskRow({
  task,
  project,
  onToggle,
  onTimer,
  onToggleLock,
  onOpenTask,
  showDate = false,
  highlight = false,
}) {
  const today = todayKey()
  const meta = []
  if (project) meta.push(project.title)
  if (task.category && !project) meta.push(task.category)
  if (showDate) meta.push(fmtRelative(task.date, today))
  if (task.est_min) meta.push(`约 ${fmtMinutes(task.est_min)}`)
  if (task.locked) meta.push('已锁定')

  return (
    <li className={`task-row ${task.done ? 'is-done' : ''} ${highlight ? 'is-highlight' : ''}`}>
      <button
        type="button"
        className={`task-row__check ${task.done ? 'is-on' : ''}`}
        aria-pressed={task.done}
        aria-label={task.done ? `取消完成：${task.title}` : `标记完成：${task.title}`}
        onClick={() => onToggle?.(task)}
      >
        {task.done ? '✓' : ''}
      </button>

      <button type="button" className="task-row__main" onClick={() => onOpenTask?.(task)}>
        <span className="task-row__title">{task.title}</span>
        {meta.length ? <span className="task-row__meta">{meta.join(' · ')}</span> : null}
        {task.status === 'undone' ? (
          <span className="task-row__flag">
            <Badge tone="muted">已确认未完成</Badge>
          </span>
        ) : null}
        {task.status === 'unknown' ? (
          <span className="task-row__flag">
            <Badge tone="muted">状态未知</Badge>
          </span>
        ) : null}
      </button>

      <span className="task-row__celebration" aria-hidden="true">
        <Cat mood="happy" className="cat--task-reaction" completionFor={task.id} />
      </span>
      <div className="task-row__actions">
        {onToggleLock && task.kind === 'node' ? (
          <button
            type="button"
            className={`mini-btn ${task.locked ? 'is-on' : ''}`}
            onClick={() => onToggleLock(task)}
            aria-label={task.locked ? '取消锁定' : '锁定，草案不得移动'}
            title={task.locked ? '已锁定：AI 草案不会移动它' : '锁定：AI 草案不会移动它'}
          >
            {task.locked ? '🔒' : '🔓'}
          </button>
        ) : null}
        {!task.done && onTimer ? (
          <button type="button" className="mini-btn" onClick={() => onTimer(task)} aria-label={`开始计时：${task.title}`}>
            ▶
          </button>
        ) : null}
      </div>
    </li>
  )
}
