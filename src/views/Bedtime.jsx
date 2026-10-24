import { useEffect, useMemo, useRef, useState } from 'react'
import Cat from '../components/Cat.jsx'
import TaskBurst from '../components/TaskBurst.jsx'
import BedtimeTaskCover, { TASK_DISSOLVE_MS } from '../components/BedtimeTaskCover.jsx'
import { Badge, DemoTag, Empty, Field, Pips } from '../components/ui.jsx'
import { fmtMinutes, fmtRelative } from '../lib/dates.js'
import { todayTasks, useStore } from '../store.jsx'

const RESULT_LABEL = {
  done: '点亮了',
  undone: '没做完',
  unknown: '不想说',
}

const EST_OPTIONS = [
  { value: 'more', label: '比预估更费时' },
  { value: 'same', label: '差不多' },
  { value: 'less', label: '比预估快' },
]

export default function Bedtime({ navigate }) {
  const { state, dispatch, notify, today } = useStore()
  const liveList = useMemo(() => todayTasks(state, today), [state.tasks, today])

  const [results, setResults] = useState({})
  const [estAdjust, setEstAdjust] = useState({})
  const [closing, setClosing] = useState(null)
  const [note, setNote] = useState('')
  const [bursts, setBursts] = useState({})
  const [frozenTasks, setFrozenTasks] = useState(null)
  const [dissolvingIds, setDissolvingIds] = useState([])
  const closingTimer = useRef(null)
  const list = frozenTasks || liveList
  const ending = frozenTasks !== null

  useEffect(() => () => window.clearTimeout(closingTimer.current), [])

  const answered = list.filter((task) => results[task.id]).length
  const doneCount = list.filter((task) => (results[task.id] || (task.done ? 'done' : null)) === 'done').length

  function burstRows(taskIds) {
    setBursts((previous) => {
      const next = { ...previous }
      taskIds.forEach((id) => { next[id] = (next[id] || 0) + 1 })
      return next
    })
  }

  function setResult(taskId, value) {
    const next = results[taskId] === value ? null : value
    setResults((previous) => ({ ...previous, [taskId]: next }))
    if (next === 'done') burstRows([taskId])
    else setBursts((previous) => ({ ...previous, [taskId]: 0 }))
  }

  function finishWithDissolve(kind, taskIds) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const forcedColors = window.matchMedia('(forced-colors: active)').matches
    if (!taskIds.length || reduced || forcedColors) { setClosing(kind); return }
    setFrozenTasks(list)
    setDissolvingIds(taskIds)
    closingTimer.current = window.setTimeout(() => setClosing(kind), TASK_DISSOLVE_MS + 60)
  }

  // 做不完、又不想直接删：收进事件箱，任务本体留着，只是离开日程
  function boxIt(task) {
    dispatch({ type: 'task_to_box', taskId: task.id })
    setResults((prev) => {
      const next = { ...prev }
      delete next[task.id]
      return next
    })
    notify(`「${task.title}」收进事件箱了，想好了再取出来`, 'ok')
  }

  function save() {
    if (ending) return
    const items = list.map((task) => {
      const result = results[task.id] || (task.done ? 'done' : 'unknown')
      return { taskId: task.id, result, estAdjust: estAdjust[task.id] || null }
    })

    // 估时校正：只在用户主动回答、且这条本来就有估时时才改
    items.forEach((item) => {
      const task = list.find((row) => row.id === item.taskId)
      if (!task || !item.estAdjust || !Number(task.est_min)) return
      const factor = item.estAdjust === 'more' ? 1.4 : item.estAdjust === 'less' ? 0.7 : 1
      if (factor === 1) return
      const next = Math.max(5, Math.min(480, Math.round(task.est_min * factor)))
      dispatch({ type: 'update_task', id: task.id, patch: { est_min: next } })
    })

    dispatch({
      type: 'settle',
      record: {
        date: today,
        items,
        note: note.trim(),
        skipped: false,
        createdAt: new Date().toISOString(),
      },
    })
    finishWithDissolve('saved', list.filter((task) => ['undone', 'unknown'].includes(results[task.id])).map((task) => task.id))
    notify('今天的结算保存好了', 'ok')
  }

  function skip() {
    if (ending) return
    dispatch({
      type: 'settle',
      record: {
        date: today,
        items: list.map((task) => ({ taskId: task.id, result: 'unknown' })),
        note: '',
        skipped: true,
        createdAt: new Date().toISOString(),
      },
    })
    setClosing('skipped')
  }

  if (closing) {
    return (
      <main className="screen screen--night closing">
        <div className="closing__card">
          <Cat mood="sleepy" className="cat--sleepy" />
          <h1 className="closing__title">{closing === 'skipped' ? '跳过也没关系' : '今天到这里'}</h1>
          <p className="closing__text">
            {closing === 'skipped'
              ? '没有记录不代表没努力。任务都还在，明天醒来再决定怎么走。'
              : `点亮了 ${doneCount} 件事。剩下的不会被删掉，也不会被悄悄挪走，明天由你决定。`}
          </p>
          <div className="closing__actions">
            <button type="button" className="btn btn--ghost" onClick={() => navigate('home')}>
              回到今天
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate('review')}>
              看一眼回顾
            </button>
          </div>
        </div>
        <p className="footnote footnote--night">
          <DemoTag children="本地原型" /> 结算只记录你回答的内容，不推断、不评价。
        </p>
      </main>
    )
  }

  return (
    <main className="screen screen--night" aria-busy={ending}>
      <header className="topbar">
        <div>
          <p className="topbar__date">{fmtRelative(today)} · 睡前</p>
          <h1 className="topbar__title">今天过得怎么样</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => navigate('home')} aria-label="关闭" disabled={ending}>
          ✕
        </button>
      </header>

      <div className="night-intro">
        <Cat mood="sleepy" className="cat--bedtime" />
        <p className="night-intro__text">
          一条一条点就好，每条都只需要一下。不想说就不点，我当作「还不知道」，不当作失败。
        </p>
      </div>

      {state.timer ? (
        <div className="notice notice--warn">
          <p>计时还在走。要先把它结束吗？否则这段时间会对不上。</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('timer')}>
            去结束计时
          </button>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel__head">
          <div>
            <p className="panel__eyebrow">今天的安排</p>
            <h2 className="panel__title">
              已回答 {answered} / {list.length || 0}
            </h2>
          </div>
          <Pips done={doneCount} total={list.length || 0} />
        </div>

        {list.length ? (
          <ul className="settle-list">
            {list.map((task) => {
              const value = results[task.id] || (task.done ? 'done' : null)
              const project = task.projectId ? state.projects.find((row) => row.id === task.projectId) : null
              return (
                <li key={task.id} className="settle-row" data-result={value || 'unanswered'}>
                  <TaskBurst sequence={bursts[task.id] || 0} />
                  <BedtimeTaskCover covered={value === 'undone' || value === 'unknown'} dissolving={dissolvingIds.includes(task.id)}>
                  <div className="settle-row__content" inert={ending}>
                    <div className="settle-row__head">
                      <p className="settle-row__title">{task.title}</p>
                      <span className="settle-row__meta">
                        {project ? project.title : task.category}
                        {task.est_min ? ` · 预估 ${fmtMinutes(task.est_min)}` : ''}
                      </span>
                    </div>
                    <div className="choice-row">
                      {Object.entries(RESULT_LABEL).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={`choice ${value === key ? 'is-active' : ''}`}
                          aria-pressed={value === key}
                          onClick={() => setResult(task.id, key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {value === 'undone' ? (
                      <button type="button" className="link-btn link-btn--night" onClick={() => boxIt(task)}>
                        这件事先收进事件箱，之后再说 →
                      </button>
                    ) : null}
                    {value && value !== 'unknown' && task.est_min ? (
                      <div className="est-row">
                        <span className="est-row__label">下次估时？</span>
                        {EST_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`chip chip--sm ${estAdjust[task.id] === option.value ? 'is-active' : ''}`}
                            onClick={() =>
                              setEstAdjust((prev) => ({ ...prev, [task.id]: prev[task.id] === option.value ? null : option.value }))
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  </BedtimeTaskCover>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty title="今天没有安排" hint="空的一天也可以直接睡。" />
        )}
      </section>

      <Field label="今天想留一句话吗（可选）" htmlFor="bedtime-note" hint="只给你自己看，不会进入 AI 快照。">
        <textarea
          id="bedtime-note"
          disabled={ending}
          className="input input--area"
          rows={2}
          value={note}
          maxLength={80}
          onChange={(event) => setNote(event.target.value)}
          placeholder="比如：今天有点累，但开头的思路对了"
        />
      </Field>

      <div className="stack">
        <button type="button" className="btn btn--primary btn--block" onClick={save} disabled={ending}>
          保存并结束今天
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={skip} disabled={ending}>
          今天不结算，直接睡
        </button>
      </div>

      <p className="footnote footnote--night">
        <DemoTag children="可跳过" /> 没回答的条目会记为「状态未知」，不会当成没做完。
        <Badge tone="muted">不删任务</Badge>
      </p>
    </main>
  )
}
