import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { clearState, loadState, saveState } from './lib/storage.js'
import { SCHEMA_VERSION, createSeedState } from './lib/seed.js'
import { diffDays, todayKey } from './lib/dates.js'
import { applyTheme } from './lib/theme.js'

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

const defaults = () => ({
  settings: { sleepTime: '23:30', onboarded: false },
  projects: [],
  tasks: [],
  timer: null,
  sessions: [],
  memorials: [],
  settlements: [],
  restart: { answers: { reason: null, time: null, goal: null }, draft: null, adopted: [], appliedAt: null, dismissedAt: null },
  undo: [],
})

function initState() {
  const saved = loadState()
  if (!saved) return createSeedState()
  if (saved.version !== SCHEMA_VERSION) return createSeedState()
  const settings = { ...defaults().settings, ...saved.settings }
  delete settings.appearance
  return { ...defaults(), ...saved, settings, restart: { ...defaults().restart, ...saved.restart } }
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
      return {
        ...state,
        timer: null,
        sessions: [...state.sessions, session],
        tasks,
        memorials: action.memorial ? [...state.memorials, action.memorial] : state.memorials,
      }
    }

    case 'discard_timer':
      return { ...state, timer: null }

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

  useLayoutEffect(() => {
    applyTheme()
  }, [])

  useEffect(() => {
    const result = saveState(state)
    if (!result.ok) setToast({ type: 'error', message: result.reason })
  }, [state])

  // 计时/跨天都需要界面自己走时
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    timerRef.current = id
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  const value = useMemo(
    () => ({
      state,
      dispatch,
      notify: (message, type = 'info') => setToast({ message, type }),
      resetAll: () => {
        clearState()
        dispatch({ type: 'reset' })
      },
    }),
    [state],
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
    .filter((task) => task.date === today)
    .sort((a, b) => Number(a.done) - Number(b.done))
}

export function projectNodes(state, projectId) {
  return state.tasks
    .filter((task) => task.projectId === projectId)
    .sort((a, b) => diffDays(b.date, a.date))
}

export function projectProgress(state, projectId) {
  const nodes = projectNodes(state, projectId)
  return { done: nodes.filter((node) => node.done).length, total: nodes.length }
}

export function pastDueTasks(state, today = todayKey()) {
  return state.tasks.filter((task) => !task.done && task.status !== 'skipped' && diffDays(task.date, today) > 0)
}

export function upcomingNodes(state, today = todayKey(), limit = 3) {
  return state.tasks
    .filter((task) => !task.done && diffDays(today, task.date) > 0)
    .sort((a, b) => diffDays(b.date, a.date))
    .slice(0, limit)
}

export function nextUndoneByProject(state, projectId, today = todayKey()) {
  return projectNodes(state, projectId).filter((node) => !node.done && diffDays(today, node.date) >= 0)
}

export function ddlsSoon(state, today = todayKey(), days = 2) {
  return state.projects.filter((project) => {
    const left = diffDays(today, project.ddl)
    return left >= 0 && left <= days
  })
}
