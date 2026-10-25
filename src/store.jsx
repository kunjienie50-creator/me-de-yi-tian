import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { clearState, loadState, saveState } from './lib/storage.js'
import { SCHEMA_VERSION, createSeedState } from './lib/seed.js'
import { diffDays, toKey, todayKey } from './lib/dates.js'
import { guessTagId } from './lib/tags.js'
import { appendSample, forgetMemory, makeSample } from './lib/memory.js'
import { applyTheme } from './lib/theme.js'

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

const defaults = () => ({
  settings: { sleepTime: '23:30', onboarded: false, catSkin: 'custom' },
  projects: [],
  tasks: [],
  timer: null,
  sessions: [],
  memorials: [],
  settlements: [],
  restart: { answers: { reason: null, time: null, goal: null }, draft: null, adopted: [], appliedAt: null, dismissedAt: null },
  box: [], // 事件箱：还没定下来、暂时做不完的事都先放这儿
  customTags: [], // 用户自己加的分类
  memory: { samples: [] }, // 用户记忆：每条 = 一次真实计时（est 与 actual）
  undo: [],
})

function initState() {
  const saved = loadState()
  if (!saved) return createSeedState()
  if (saved.version !== SCHEMA_VERSION) return createSeedState()
  const merged = { ...defaults(), ...saved, settings: { ...defaults().settings, ...saved.settings }, restart: { ...defaults().restart, ...saved.restart } }
  delete merged.settings.appearance
  merged.settings.catSkin = 'custom'
  // 老数据没有分类 id，用标题补一个默认分类，别让界面空着
  merged.tasks = (merged.tasks || []).map((task) => ({ tag: guessTagId(task.title), ...task }))
  merged.projects = (merged.projects || []).map((project) => ({ tag: guessTagId(project.title), ...project }))
  merged.box = merged.box || []
  merged.customTags = merged.customTags || []
  merged.memory = merged.memory && Array.isArray(merged.memory.samples) ? merged.memory : { samples: [] }
  // 老数据没有序号：按项目内日期先后补一个，保证「前驱在前」有依据
  const byProject = new Map()
  merged.tasks.forEach((task) => {
    if (!task.projectId) return
    if (!byProject.has(task.projectId)) byProject.set(task.projectId, [])
    byProject.get(task.projectId).push(task)
  })
  byProject.forEach((list) => {
    list
      .sort((a, b) => diffDays(b.date || '1970-01-01', a.date || '1970-01-01'))
      .forEach((task, index) => {
        if (!task.seq) task.seq = index + 1
        if (!task.priority) task.priority = 'mid'
      })
  })
  merged.tasks = merged.tasks.map((task) => ({ priority: 'mid', ...task }))
  return merged
}

function pushUndo(state, label, changes) {
  const prev = changes.map((change) => {
    const task = state.tasks.find((item) => item.id === change.id)
    return { id: change.id, date: task ? task.date : null, est_min: task ? task.est_min : null }
  })
  const entry = { id: uid('undo'), label, at: new Date().toISOString(), prev }
  return [entry, ...(state.undo || [])].slice(0, 12)
}

function applyChanges(tasks, changes) {
  return tasks.map((task) => {
    const change = changes.find((item) => item.id === task.id)
    if (!change) return task
    const patch = {}
    if (change.date) patch.date = change.date
    if (change.est_min !== undefined) patch.est_min = change.est_min
    return { ...task, ...patch }
  })
}

function reducer(state, action) {
  switch (action.type) {
    case 'add_task':
      return { ...state, tasks: [...state.tasks, action.task] }

    case 'update_task':
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.id ? { ...task, ...action.patch } : task)),
      }

    case 'delete_task':
      return { ...state, tasks: state.tasks.filter((task) => task.id !== action.id) }

    case 'add_project':
      return {
        ...state,
        projects: [...state.projects, action.project],
        tasks: [...state.tasks, ...action.tasks],
      }

    case 'set_changes': {
      const undo = pushUndo(state, action.label || '调整排期', action.changes)
      return { ...state, tasks: applyChanges(state.tasks, action.changes), undo }
    }

    case 'restore_undo': {
      const [last, ...rest] = state.undo || []
      if (!last) return state
      const tasks = state.tasks.map((task) => {
        const prev = last.prev.find((item) => item.id === task.id)
        if (!prev) return task
        return { ...task, date: prev.date || task.date, est_min: prev.est_min === null ? task.est_min : prev.est_min }
      })
      return { ...state, tasks, undo: rest }
    }

    case 'toggle_lock':
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.id ? { ...task, locked: !task.locked } : task)),
      }

    case 'complete_task':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.id
            ? { ...task, done: action.done !== false, status: action.done === false ? 'todo' : 'done', completedAt: action.done === false ? null : new Date().toISOString() }
            : task,
        ),
      }

    case 'start_timer':
      return { ...state, timer: { ...action.timer } }

    case 'stop_timer': {
      const session = action.session
      const tasks = session.litTaskId
        ? state.tasks.map((task) =>
            task.id === session.litTaskId
              ? { ...task, done: true, status: 'done', completedAt: session.endedAt }
              : task,
          )
        : state.tasks
      // 真实用时是唯一可信的记忆来源：只在这条计时挂了任务、且任务有估时时记一条
      const sourceTask = session.taskId ? state.tasks.find((task) => task.id === session.taskId) : null
      const withMemory = appendSample(state, makeSample(sourceTask, session.minutes, session.endedAt))
      return {
        ...withMemory,
        timer: null,
        sessions: [...state.sessions, session],
        tasks,
        memorials: action.memorial ? [...state.memorials, action.memorial] : state.memorials,
      }
    }

    case 'forget_memory':
      return forgetMemory(state, action.tag || null)

    case 'discard_timer':
      return { ...state, timer: null }

    case 'add_box':
      return { ...state, box: [action.item, ...(state.box || [])] }

    case 'remove_box':
      return { ...state, box: (state.box || []).filter((item) => item.id !== action.id) }

    /** 从箱子里取出来，变成正式计划：出箱子 + 加一条任务 */
    case 'box_to_task':
      return {
        ...state,
        box: (state.box || []).filter((item) => item.id !== action.itemId),
        tasks: [...state.tasks, action.task],
      }

    /** 任务收进箱子：不是删除，任务本体留着，只是离开日程 */
    case 'task_to_box': {
      const task = state.tasks.find((row) => row.id === action.taskId)
      if (!task) return state
      const item = {
        id: uid('bx'),
        title: task.title,
        note: action.note || '',
        source: 'gaveup',
        fromTaskId: task.id,
        fromProjectId: task.projectId || null,
        tag: task.tag,
        createdAt: new Date().toISOString(),
      }
      return {
        ...state,
        box: [item, ...(state.box || [])],
        tasks: state.tasks.map((row) => (row.id === task.id ? { ...row, status: 'boxed', done: false } : row)),
      }
    }

    case 'add_tag':
      return { ...state, customTags: [...(state.customTags || []), action.tag] }

    case 'add_memorial':
      return { ...state, memorials: [...state.memorials, action.memorial] }

    case 'update_settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'settle':
      return {
        ...state,
        settlements: [...state.settlements.filter((item) => item.date !== action.record.date), action.record],
        tasks: state.tasks.map((task) => {
          const row = action.record.items.find((item) => item.taskId === task.id)
          if (!row) return task
          if (row.result === 'done') {
            return { ...task, done: true, status: 'done', completedAt: task.completedAt || new Date().toISOString() }
          }
          if (row.result === 'undone') return { ...task, done: false, status: 'undone' }
          return { ...task, done: false, status: 'unknown' }
        }),
      }

    case 'set_restart':
      return { ...state, restart: { ...state.restart, ...action.patch } }

    case 'apply_restart': {
      const undo = pushUndo(state, '次日重启草案', action.changes)
      return {
        ...state,
        tasks: applyChanges(state.tasks, action.changes),
        restart: {
          ...state.restart,
          adopted: [...new Set([...(state.restart.adopted || []), ...action.adoptedIds])],
          appliedAt: new Date().toISOString(),
        },
        undo,
      }
    }

    case 'dismiss_restart':
      return { ...state, restart: { ...state.restart, dismissedAt: new Date().toISOString() } }

    case 'reset':
      return createSeedState()

    default:
      return state
  }
}

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState)
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  const [, forceTick] = useState(0)
  // 共享时钟：放进 context，任何用到它的组件都会每秒重渲染（计时页/浮条靠这个走字）
  const [now, setNow] = useState(() => Date.now())

  useLayoutEffect(() => { applyTheme() }, [])

  useEffect(() => {
    const result = saveState(state)
    if (!result.ok) setToast({ type: 'error', message: result.reason })
  }, [state])

  // 计时/跨天都需要界面自己走时
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      forceTick((n) => n + 1)
    }, 1000)
    timerRef.current = id
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  // 用共享时钟算「今天」：跨过零点不用刷新，页面自己就换到新的一天
  const today = toKey(new Date(now))

  const value = useMemo(
    () => ({
      state,
      dispatch,
      now,
      today,
      notify: (message, type = 'info') => setToast({ message, type }),
      resetAll: () => {
        clearState()
        dispatch({ type: 'reset' })
      },
    }),
    [state, now, today],
  )

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toast ? (
        <div className={`toast toast--${toast.type}`} role="status">
          {toast.message}
        </div>
      ) : null}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用')
  return ctx
}

/* ---------- 选择器 ---------- */

export function todayTasks(state, today = todayKey()) {
  return state.tasks
    .filter((task) => task.date === today && task.status !== 'cancelled' && task.status !== 'boxed')
    .sort((a, b) => Number(a.done) - Number(b.done))
}

export function projectNodes(state, projectId) {
  return state.tasks
    .filter((task) => task.projectId === projectId && task.status !== 'cancelled' && task.status !== 'boxed')
    .sort((a, b) => {
      // 先按序号（前驱在前），序号相同再按日期
      const sa = Number(a.seq) || 0
      const sb = Number(b.seq) || 0
      if (sa && sb && sa !== sb) return sa - sb
      return diffDays(b.date, a.date)
    })
}

export function projectProgress(state, projectId) {
  const nodes = projectNodes(state, projectId)
  return { done: nodes.filter((node) => node.done).length, total: nodes.length }
}

export function pastDueTasks(state, today = todayKey()) {
  return state.tasks.filter(
    (task) =>
      !task.done && task.status !== 'skipped' && task.status !== 'cancelled' && task.status !== 'boxed' && diffDays(task.date, today) > 0,
  )
}

export function upcomingNodes(state, today = todayKey(), limit = 3) {
  return state.tasks
    .filter((task) => !task.done && task.status !== 'cancelled' && task.status !== 'boxed' && diffDays(today, task.date) > 0)
    .sort((a, b) => diffDays(b.date, a.date))
    .slice(0, limit)
}

export function nextUndoneByProject(state, projectId, today = todayKey()) {
  return projectNodes(state, projectId).filter((node) => !node.done && diffDays(today, node.date) >= 0)
}

export function boxItems(state) {
  return [...(state.box || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export function ddlsSoon(state, today = todayKey(), days = 2) {
  return state.projects.filter((project) => {
    const left = diffDays(today, project.ddl)
    return left >= 0 && left <= days
  })
}
