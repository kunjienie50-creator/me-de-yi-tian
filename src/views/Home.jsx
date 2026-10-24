import { useMemo, useState } from 'react'
import Cat from '../components/Cat.jsx'
import TaskRow from '../components/TaskRow.jsx'
import { Badge, DemoTag, Empty, Field, Pips, SectionTitle, Sheet, Toggle } from '../components/ui.jsx'
import { fmtMinutes, fmtRelative, todayKey } from '../lib/dates.js'
import {
  pastDueTasks,
  projectProgress,
  todayTasks,
  uid,
  upcomingNodes,
  useStore,
} from '../store.jsx'

export default function Home({ navigate }) {
  const { state, dispatch, notify } = useStore()
  const [addOpen, setAddOpen] = useState(false)
  const today = todayKey()

  const list = todayTasks(state, today)
  const undone = list.filter((task) => !task.done)
  const past = pastDueTasks(state, today)
  const upcoming = upcomingNodes(state, today, 3)
  const activeProjects = state.projects.filter((project) => project.status !== 'archived')

  const bubble = useMemo(() => {
    if (state.timer) return '计时中，我帮你盯着～'
    if (past.length && !state.restart.appliedAt) return `昨天有 ${past.length} 个节点没做完，要一起看看吗？`
    if (list.length && undone.length === 0) return '今天的都点亮啦，早点休息～'
    if (undone.length) return `今天还有 ${undone.length} 件事，慢慢来。`
    return '今天想做什么呀？'
  }, [state.timer, state.restart.appliedAt, past.length, list.length, undone.length])

  const mood = state.timer ? 'happy' : list.length && undone.length === 0 ? 'happy' : 'idle'

  function toggleTask(task) {
    dispatch({ type: 'complete_task', id: task.id, done: !task.done })
    if (!task.done) notify(`点亮了「${task.title}」`, 'ok')
  }

  function startTimer(task) {
    dispatch({
      type: 'start_timer',
      timer: { id: uid('timer'), taskId: task.id, label: task.title, startedAt: new Date().toISOString(), status: 'running' },
    })
    notify(`开始计时：${task.title}`, 'ok')
    navigate('timer')
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <p className="topbar__date">{fmtRelative(today)} · {fmtWeekdayCN(today)}</p>
          <h1 className="topbar__title">me的一天</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => navigate('settings')} aria-label="设置">
          ⚙
        </button>
      </header>

      <section className="stage stage--compact">
        <p className="bubble" key={bubble}>{bubble}</p>
        <Cat mood={mood} className="cat--home" />
      </section>

      {past.length && !state.restart.appliedAt ? (
        <button type="button" className="banner banner--restart" onClick={() => navigate('restart')}>
          <span className="banner__title">次日温和重启</span>
          <span className="banner__text">{past.length} 个节点停在昨天 · 先回答几个小问题，再决定怎么排</span>
          <span className="banner__cta">去处理 →</span>
        </button>
      ) : null}

      <section className="panel">
        <div className="panel__head">
          <div>
            <p className="panel__eyebrow">今天</p>
            <h2 className="panel__title">
              点亮 {list.filter((t) => t.done).length} / {list.length || 0} 件事
            </h2>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAddOpen(true)}>
            + 加一条
          </button>
        </div>

        {list.length ? (
          <ul className="task-list">
            {list.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                project={task.projectId ? state.projects.find((p) => p.id === task.projectId) : null}
                onToggle={toggleTask}
                onTimer={startTimer}
                onOpenTask={(row) =>
                  row.projectId ? navigate('schedule', { projectId: row.projectId }) : navigate('goals')
                }
              />
            ))}
          </ul>
        ) : (
          <Empty
            title="今天还没有安排"
            hint="记一件小事，或把长期目标拆成节点。"
            action={
              <button type="button" className="btn btn--primary" onClick={() => setAddOpen(true)}>
                记一件事
              </button>
            }
          />
        )}
      </section>

      {upcoming.length ? (
        <section className="panel panel--soft">
          <SectionTitle action={<button type="button" className="link-btn" onClick={() => navigate('goals')}>管理目标</button>}>
            接下来
          </SectionTitle>
          <ul className="mini-list">
            {upcoming.map((task) => (
              <li key={task.id}>
                <span className="mini-list__date">{fmtRelative(task.date)}</span>
                <span className="mini-list__title">{task.title}</span>
                {task.est_min ? <span className="mini-list__est">{fmtMinutes(task.est_min)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel panel--soft">
        <SectionTitle action={<button type="button" className="link-btn" onClick={() => navigate('goals')}>全部目标</button>}>
          长期目标
        </SectionTitle>
        {activeProjects.length ? (
          <ul className="goal-strip">
            {activeProjects.map((project) => {
              const progress = projectProgress(state, project.id)
              return (
                <li key={project.id}>
                  <button type="button" className="goal-card" onClick={() => navigate('schedule', { projectId: project.id })}>
                    <p className="goal-card__title">{project.title}</p>
                    <Pips done={progress.done} total={progress.total} />
                    <p className="goal-card__meta">
                      截止 {fmtRelative(project.ddl)} · {project.category}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty title="还没有长期目标" hint="把「想做成的事」拆成能打卡的节点。"
            action={<button type="button" className="btn btn--primary" onClick={() => navigate('goals')}>新建目标</button>} />
        )}
      </section>

      <section className="quick-grid">
        <button type="button" className="quick" onClick={() => navigate('timer')}>
          <span className="quick__icon">⏱</span>
          <span className="quick__label">{state.timer ? '正在计时' : '开始计时'}</span>
        </button>
        <button type="button" className="quick" onClick={() => navigate('bedtime')}>
          <span className="quick__icon">🌙</span>
          <span className="quick__label">睡前结算</span>
        </button>
        <button type="button" className="quick" onClick={() => navigate('review')}>
          <span className="quick__icon">✦</span>
          <span className="quick__label">一天回顾</span>
        </button>
        <button type="button" className="quick" onClick={() => navigate('restart')}>
          <span className="quick__icon">↺</span>
          <span className="quick__label">温和重启</span>
        </button>
      </section>

      <p className="footnote">
        <DemoTag children="本地原型" /> 数据只存在这台设备的浏览器里，不上传、不同步。
      </p>

      <AddTaskSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(task) => {
          dispatch({ type: 'add_task', task })
          setAddOpen(false)
          notify('记下了', 'ok')
        }}
      />
    </main>
  )
}

function AddTaskSheet({ open, onClose, onSave }) {
  const today = todayKey()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [est, setEst] = useState('')
  const [note, setNote] = useState('')
  const [noteForAI, setNoteForAI] = useState(false)

  function reset() {
    setTitle('')
    setDate(today)
    setEst('')
    setNote('')
    setNoteForAI(false)
  }

  function submit() {
    const text = title.trim()
    if (!text) return
    onSave({
      id: uid('t'),
      kind: 'normal',
      projectId: null,
      title: text,
      category: '日常',
      date,
      est_min: est ? Math.max(5, Math.round(Number(est))) : null,
      done: false,
      status: 'todo',
      locked: false,
      note: note.trim(),
      noteForAI,
    })
    reset()
  }

  return (
    <Sheet
      open={open}
      title="记一件事"
      subtitle="只有标题是必填的。"
      onClose={() => {
        reset()
        onClose()
      }}
      footer={
        <button type="button" className="btn btn--primary btn--block" onClick={submit} disabled={!title.trim()}>
          加入今天
        </button>
      }
    >
      <Field label="要做什么" htmlFor="add-title">
        <input
          id="add-title"
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="比如：给设计师回消息"
          maxLength={40}
          autoComplete="off"
        />
      </Field>
      <div className="row-2">
        <Field label="哪天" htmlFor="add-date">
          <input id="add-date" className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="预计多久（可选）" htmlFor="add-est">
          <input
            id="add-est"
            className="input"
            type="number"
            inputMode="numeric"
            min="5"
            max="480"
            value={est}
            onChange={(event) => setEst(event.target.value)}
            placeholder="分钟"
          />
        </Field>
      </div>
      <Field label="备注（可选）" htmlFor="add-note" hint="备注默认不进入 AI 上下文，除非你在这里勾选允许。">
        <textarea
          id="add-note"
          className="input input--area"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={80}
          placeholder="给自己的一句提醒"
        />
      </Field>
      <Toggle
        checked={noteForAI}
        onChange={setNoteForAI}
        label="允许把备注用于后续 AI 分析"
        hint="不勾选时，备注只给你自己看。"
      />
      <p className="hint hint--left">
        <Badge tone="soft">同层任务</Badge> 普通任务和长期目标的子任务在同一个日程里，不重复创建。
      </p>
    </Sheet>
  )
}

function fmtWeekdayCN(key) {
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const [y, m, d] = key.split('-').map(Number)
  return WEEK[new Date(y, m - 1, d).getDay()]
}
