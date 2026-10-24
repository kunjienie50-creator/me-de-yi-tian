import { fmtMinutes, fmtRelative, todayKey } from '../lib/dates.js'
import { colorVars, NEUTRAL_COLOR } from '../lib/colors.js'
import { tagMeta } from '../lib/tags.js'
import { useStore } from '../store.jsx'
import { Badge } from './ui.jsx'
import Cat from './Cat.jsx'

/**
 * 一条任务。color 用来区分它属于哪个长期目标：
 * 左边一条细色条 + 项目名前的小圆点，混在一起时也能一眼看出归属。
 */
export default function TaskRow({
  task,
  project,
  color,
  onToggle,
  onTimer,
  onToggleLock,
  onOpenTask,
  showDate = false,
  highlight = false,
}) {
  const { state } = useStore()
  const today = todayKey()
  const tag = tagMeta(state, task.tag, task.category)
  const meta = []
  if (showDate) meta.push(fmtRelative(task.date, today))
  if (task.est_min) meta.push(`约 ${fmtMinutes(task.est_min)}`)
  if (task.locked) meta.push('已锁定')

  return (
    <li
      className={`task-row ${task.done ? 'is-done' : ''} ${highlight ? 'is-highlight' : ''} ${project ? 'has-project' : ''}`}
      style={colorVars(color || NEUTRAL_COLOR)}
    >
      <span className="task-row__stripe" aria-hidden="true" />

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
        <span className="task-row__meta">
          {project ? (
            <>
              <span className="task-row__dot" aria-hidden="true" />
              <span className="task-row__project">{project.title}</span>
            </>
          ) : (
            <span className="task-row__tag">
              {tag ? `${tag.emoji} ${tag.label}` : '未分类'}
            </span>
          )}
          {meta.length ? <span className="task-row__sep"> · </span> : null}
          {meta.join(' · ')}
        </span>
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
