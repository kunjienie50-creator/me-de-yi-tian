import { useMemo } from 'react'
import { addDays, dayRange, fmtMinutes, fmtRelative, fmtWeekday, todayKey } from '../lib/dates.js'
import { colorVars, projectColorOf } from '../lib/colors.js'

/**
 * 首页最显眼处的这一周：横向排开 7 天，每天一列。
 * 每个任务就是一个方块单元格，颜色 = 它所属的长期目标（普通任务是中性灰）。
 * 点某一天可以看那天的安排。
 */
export default function WeekStrip({ state, onPickDay }) {
  const today = todayKey()
  const days = useMemo(() => dayRange(today, addDays(today, 6)), [today])

  const byDay = useMemo(() => {
    const map = new Map()
    days.forEach((day) => map.set(day, []))
    state.tasks.forEach((task) => {
      if (task.status === 'cancelled' || task.status === 'boxed') return
      if (!map.has(task.date)) return
      map.get(task.date).push(task)
    })
    return map
  }, [days, state.tasks])

  function overbooked(tasks) {
    const minutes = tasks.reduce((sum, task) => sum + (task.est_min || 0), 0)
    return tasks.length > 5 || minutes > 240
  }

  return (
    <section className="week-strip" aria-label="这一周的安排">
      <div className="week-strip__head">
        <p className="panel__eyebrow">这一周</p>
        <p className="week-strip__legend">
          <span className="week-strip__legend-dot" aria-hidden="true" />
          方块是一件事，颜色跟所属目标走
        </p>
      </div>

      <ol className="week-strip__days">
        {days.map((day) => {
          const tasks = byDay.get(day) || []
          const isToday = day === today
          const shown = tasks.slice(0, 3)
          const rest = tasks.length - shown.length
          return (
            <li key={day}>
              <button
                type="button"
                className={`week-day ${isToday ? 'is-today' : ''} ${overbooked(tasks) ? 'is-heavy' : ''}`}
                onClick={() => onPickDay?.(day)}
                aria-label={`${fmtRelative(day)}，${tasks.length} 件任务`}
              >
                <span className="week-day__label">{isToday ? '今天' : fmtWeekday(day)}</span>
                <span className="week-day__num">{Number(day.slice(-2))}</span>
                <span className="week-day__cells">
                  {shown.map((task) => (
                    <span
                      key={task.id}
                      className={`week-cell ${task.done ? 'is-done' : ''}`}
                      style={colorVars(projectColorOf(state, task.projectId))}
                      title={`${task.title}${task.est_min ? ` · ${fmtMinutes(task.est_min)}` : ''}`}
                    />
                  ))}
                  {rest > 0 ? <span className="week-cell week-cell--more">+{rest}</span> : null}
                  {!tasks.length ? <span className="week-cell week-cell--empty" aria-hidden="true" /> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function dayTaskList(state, day) {
  return state.tasks
    .filter((task) => task.date === day && task.status !== 'cancelled' && task.status !== 'boxed')
    .sort((a, b) => Number(a.done) - Number(b.done))
}

export function projectFor(state, projectId) {
  return state.projects.find((project) => project.id === projectId) || null
}
