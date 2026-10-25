import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import './motion.css'
import './surface-art.css'
import { useMotionEffects } from './lib/motion.js'
import Home from './views/Home.jsx'
import Goals from './views/Goals.jsx'
import Schedule from './views/Schedule.jsx'
import Timer from './views/Timer.jsx'
import Bedtime from './views/Bedtime.jsx'
import Restart from './views/Restart.jsx'
import Review from './views/Review.jsx'
import Settings from './views/Settings.jsx'
import CursorTrail from './components/CursorTrail.jsx'
import NavCatAnimation from './components/NavCatAnimation.jsx'
import NavPageTransition from './components/NavPageTransition.jsx'
import { CatAnimationProvider } from './components/CatAnimationContext.jsx'
import Box from './views/Box.jsx'
import { fmtStopwatch } from './lib/dates.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { StoreProvider, useStore } from './store.jsx'

const TABS = [
  { view: 'home', label: '今天', icon: '☀' },
  { view: 'goals', label: '目标', icon: '◎' },
  { view: 'timer', label: '计时', icon: '⏱' },
  { view: 'review', label: '回顾', icon: '✦' },
]

const FULL_VIEWS = ['bedtime', 'restart', 'settings', 'box']

function Shell() {
  useMotionEffects()
  const { state, now } = useStore()
  // 支持用地址栏直达某一页（#box / #goals …），方便自己调试和演示时跳转
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.replace('#', '')
    const allowed = ['home', 'goals', 'timer', 'review', 'bedtime', 'restart', 'settings', 'box']
    return { view: allowed.includes(hash) ? hash : 'home', params: {} }
  })
  const scrollRef = useRef(null)
  const tabbarRef = useRef(null)
  const [navAnimation, setNavAnimation] = useState({ view: null, sequence: 0 })

  const [pageTransition, setPageTransition] = useState(null)
  const transitionSequence = useRef(0)

  const navigate = useCallback((view, params = {}) => {
    setRoute((current) => ({
      view,
      params,
      direction: TABS.findIndex((tab) => tab.view === view) < TABS.findIndex((tab) => tab.view === current.view) ? -1 : 1,
    }))
  }, [])

  const finishPageTransition = useCallback((sequence) => {
    setPageTransition((current) => current?.sequence === sequence ? null : current)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [route.view, route.params.projectId])

  // 让地址栏跟着当前页走，刷新后能停在原地；也支持手改 #box 之类直接跳
  useEffect(() => {
    if (route.view === 'schedule') return
    const next = route.view === 'home' ? '#home' : `#${route.view}`
    if (window.location.hash !== next) window.history.replaceState(null, '', next)
  }, [route.view])

  useEffect(() => {
    const allowed = ['home', 'goals', 'timer', 'review', 'bedtime', 'restart', 'settings', 'box']
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (allowed.includes(hash)) setRoute({ view: hash, params: {} })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const activeTab = route.view === 'schedule' ? 'goals' : route.view
  const hideTabs = FULL_VIEWS.includes(route.view)

  useEffect(() => {
    if (hideTabs) setNavAnimation((previous) => previous.view ? { view: null, sequence: 0 } : previous)
  }, [hideTabs])

  let page = null
  if (route.view === 'home') page = <Home navigate={navigate} />
  else if (route.view === 'goals') page = <Goals navigate={navigate} />
  else if (route.view === 'schedule') page = <Schedule projectId={route.params.projectId} navigate={navigate} />
  else if (route.view === 'timer') page = <Timer navigate={navigate} />
  else if (route.view === 'bedtime') page = <Bedtime navigate={navigate} />
  else if (route.view === 'restart') page = <Restart navigate={navigate} />
  else if (route.view === 'review') page = <Review navigate={navigate} />
  else if (route.view === 'settings') page = <Settings navigate={navigate} />
  else if (route.view === 'box') page = <Box navigate={navigate} />

  return (
    <>
    <div className={`app-shell ${route.view === 'bedtime' ? 'is-night' : ''}`}>
      <div className="app-scroll" inert={Boolean(pageTransition)} ref={scrollRef} key={`${route.view}:${route.params.projectId || ''}`} style={{ '--page-direction': route.direction || 1 }}>
        {page}
        <div className={`app-bottom-space ${hideTabs ? '' : 'has-tabs'} ${state.timer ? 'has-timer' : ''}`} aria-hidden="true" />
      </div>

      {state.timer && route.view !== 'timer' ? (
        <button type="button" className="timer-float" inert={Boolean(pageTransition)} onClick={() => navigate('timer')}>
          <span className="timer-float__dot" aria-hidden="true" />
          <span className="timer-float__label">{state.timer.label}</span>
          <span className="timer-float__clock">{fmtStopwatch(now - new Date(state.timer.startedAt).getTime())}</span>
        </button>
      ) : null}

      {hideTabs ? null : (
        <nav ref={tabbarRef} className="tabbar" aria-label="主导航" style={{ '--active-tab': Math.max(0, TABS.findIndex((tab) => tab.view === activeTab)) }}>
          <span className="tabbar__indicator" aria-hidden="true" />
          {TABS.map((tab) => (
            <button
              key={tab.view}
              type="button"
              className={`tab ${activeTab === tab.view ? 'is-active' : ''}`}
              aria-current={activeTab === tab.view ? 'page' : undefined}
              onClick={(event) => {
                setNavAnimation((previous) => ({ view: tab.view, sequence: previous.sequence + 1 }))
                if (tab.view !== route.view) {
                  setPageTransition({ view: tab.view, label: tab.label, sequence: ++transitionSequence.current, returnFocus: event.currentTarget })
                } else {
                  setPageTransition(null)
                }
              }}
            >
              <NavCatAnimation sequence={navAnimation.view === tab.view ? navAnimation.sequence : 0} />
              <span className="tab__icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="tab__label">{tab.label}</span>
              {tab.view === 'timer' && state.timer ? <span className="tab__dot" aria-hidden="true" /> : null}
            </button>
          ))}
        </nav>
      )}
    </div>
    <NavPageTransition navigationRef={tabbarRef} request={pageTransition} onCovered={navigate} onFinish={finishPageTransition} />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <CatAnimationProvider>
          <Shell />
        </CatAnimationProvider>
        <CursorTrail />
      </StoreProvider>
    </ErrorBoundary>
  )
}
