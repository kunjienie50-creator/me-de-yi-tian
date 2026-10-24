import { useMemo, useState } from 'react'
import Cat from '../components/Cat.jsx'
import TaskRow from '../components/TaskRow.jsx'
import WeekStrip, { dayTaskList, projectFor } from '../components/WeekStrip.jsx'
import { Badge, DemoTag, Empty, Field, Pips, SectionTitle, Sheet, Toggle } from '../components/ui.jsx'
import { colorVars, projectColorOf } from '../lib/colors.js'
import { fmtMinutes, fmtRelative, fmtWeekday, toKey, todayKey } from '../lib/dates.js'
import { pastDueTasks, projectProgress, todayTasks, uid, useStore } from '../store.jsx'

// 点猫时它换着说的话：只是陪伴，不参与任何评分
const POKE_LINES = [
  '在呢，慢慢来。',
  '做不完也没关系，明天还有明天。',
  '先挑最小的一件开始？',
  '要不要先喝口水。',
  '我就在这儿，不催你。',
]

export default function Home({ navigate }) {
  const { state, dispatch, notify } = useStore()
  const [addOpen, setAddOpen] = useState(false)
  const [peekDay, setPeekDay] = useState(null)
  const [pokeCount, setPokeCount] = useState(0)
  const [line, setLine] = useState(null)
  const today = todayKey()

  const list = todayTasks(state, today)
  const undone = list.filter((task) => !task.done)
  const past = pastDueTasks(state, today)
  const activeProjects = state.projects.filter((project) => project.status !== 'archived')
  const skin = state.settings.catSkin || 'orange'
  // 用户已经点过「今天先不管这些」的话，同一天就不再反复提示
  const dismissedToday =
    state.restart.dismissedAt && toKey(new Date(state.restart.dismissedAt)) === today
  const showRestartNotice = past.length > 0 && !state.restart.appliedAt && !dismissedToday

  const bubble = useMemo(() => {
    if (line) return line
    if (state.timer) return '计时中，我帮你盯着～'
    if (showRestartNotice) return `昨天还有 ${past.length} 件没做完，先看看怎么安排？`
    if (list.length && undone.length === 0) return '今天的都点亮啦，早点休息～'
    if (undone.length) return `今天还有 ${undone.length} 件事，慢慢来。`
    return '今天想做什么呀？'
  }, [line, state.timer, showRestartNotice, past.length, list.length, undone.length])

  const mood = state.timer ? 'happy' : list.length && undone.length === 0 ? 'happy' : 'idle'

  function pokeCat() {
    setPokeCount((n) => n + 1)
    setLine(POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)])
    window.setTimeout(() => setLine(null), 2600)
  }

  function toggleTask(task) {
    dispatch({ type: 'complete_task', id: task.id, done: !task.done })
    if (!task.done) notify(`点亮了「${task.title}」`, 'ok')
  }

  function startTimer(task) {
    dispatch({
      type: 'start_timer',
      timer: {
        id: uid('timer'),
        taskId: task.id,
        label: task.title,
        startedAt: new Date().toISOString(),
        status: 'running',
      },
    })
    notify(`开始计时：${task.title}`, 'ok')
    navigate('timer')
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <p className="topbar__date">
            {fmtRelative(today)} · {fmtWeekday(today)}
          </p>
          <h1 className="topbar__title">me的一天</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => navigate('settings')} aria-label="设置">
          ⚙
        </button>
      </header>

      <section className="stage stage--compact">
        <p className="bubble" key={bubble}>
          {bubble}
        </p>
        <button type="button" className="cat-button" onClick={pokeCat} aria-label="摸摸小猫">
          <Cat mood={mood} skin={skin} className="cat--home" poke={pokeCount} />
        </button>
      </section>

      <WeekStrip state={state} onPickDay={setPeekDay} />

      <div className="home-actions">
        <button type="button" className="home-action home-action--timer" onClick={() => navigate('timer')}>
          <span className="home-action__icon" aria-hidden="true">
            ⏱
          </span>
          <span className="home-action__label">{state.timer ? '正在计时' : '开始计时'}</span>
          <span className="home-action__hint">{state.timer ? '点开看时间' : '自由活动，或挂到一件任务'}</span>
        </button>
        <button type="button" className="home-action home-action--night" onClick={() => navigate('bedtime')}>
          <span className="home-action__icon" aria-hidden="true">
            🌙
          </span>
          <span className="home-action__label">睡前结算</span>
          <span className="home-action__hint">一条一条点，也可以跳过</span>
        </button>
      </div>

      {showRestartNotice ? (
        <button type="button" className="notice-card" onClick={() => navigate('restart')}>
          <span className="notice-card__title">昨天还有 {past.length} 件没做完</span>
          <span className="notice-card__text">我不会自己往后挪，也不会改截止日。先回答两三个问题，给一份草案你挑。</span>
          <span className="notice-card__cta">看看怎么安排 →</span>
        </button>
      ) : null}

      <section className="panel">
        <div className="panel__head">
          <div>
            <p className="panel__eyebrow">今天要做的</p>
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
                project={projectFor(state, task.projectId)}
                color={projectColorOf(state, task.projectId)}
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

      <section className="panel panel--soft">
        <SectionTitle
          action={
            <button type="button" className="link-btn" onClick={() => navigate('goals')}>
              全部目标
            </button>
          }
        >
          长期目标
        </SectionTitle>
        {activeProjects.length ? (
          <ul className="goal-strip">
            {activeProjects.map((project) => {
              const progress = projectProgress(state, project.id)
              const color = projectColorOf(state, project.id)
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    className="goal-card"
                    style={colorVars(color)}
                    onClick={() => navigate('schedule', { projectId: project.id })}
                  >
                    <p className="goal-card__title">
                      <span className="goal-card__dot" aria-hidden="true" />
                      {project.title}
                    </p>
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
          <Empty
            title="还没有长期目标"
            hint="把「想做成的事」拆成能打卡的节点。"
            action={
              <button type="button" className="btn btn--primary" onClick={() => navigate('goals')}>
                新建目标
              </button>
            }
          />
        )}
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

      <DayPeekSheet state={state} day={peekDay} onClose={() => setPeekDay(null)} navigate={navigate} />
    </main>
  )
}

/** 点日历里某一天：看一眼那天的安排（只读，改动去排期或今日清单） */
function DayPeekSheet({ state, day, onClose, navigate }) {
  const tasks = day ? dayTaskList(state, day) : []
  const minutes = tasks.reduce((sum, task) => sum + (task.est_min || 0), 0)

  return (
    <Sheet
      open={Boolean(day)}
      title={day ? `${fmtRelative(day)}的安排` : ''}
      subtitle={day ? `${tasks.length} 件 · 预计 ${fmtMinutes(minutes)}` : ''}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
          知道了
        </button>
      }
    >
      {tasks.length ? (
        <ul className="peek-list">
          {tasks.map((task) => {
            const project = projectFor(state, task.projectId)
            return (
              <li key={task.id} className={task.done ? 'is-done' : ''}>
                <span className="peek-list__dot" style={colorVars(projectColorOf(state, task.projectId))} aria-hidden="true" />
                <span className="peek-list__body">
                  <span className="peek-list__title">{task.title}</span>
                  <span className="peek-list__meta">
                    {project ? project.title : task.category || '日常'}
                    {task.est_min ? ` · ${fmtMinutes(task.est_min)}` : ''}
                    {task.locked ? ' · 已锁定' : ''}
                  </span>
                </span>
                {task.done ? <span className="peek-list__flag">已点亮</span> : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty title="这天还空着" hint="空着也挺好，不一定要塞满。" />
      )}
      {day && tasks.some((task) => task.projectId) ? (
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            const first = tasks.find((task) => task.projectId)
            navigate('schedule', { projectId: first.projectId })
          }}
        >
          去排期页调整
        </button>
      ) : null}
    </Sheet>
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
