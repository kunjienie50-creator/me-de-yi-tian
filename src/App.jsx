import { useEffect, useRef, useState } from 'react'
import './App.css'
import Home from './views/Home.jsx'
import Goals from './views/Goals.jsx'
import Schedule from './views/Schedule.jsx'
import Timer from './views/Timer.jsx'
import Bedtime from './views/Bedtime.jsx'
import Restart from './views/Restart.jsx'
import Review from './views/Review.jsx'
import Settings from './views/Settings.jsx'
import { fmtStopwatch } from './lib/dates.js'
import { StoreProvider, useStore } from './store.jsx'

const TABS = [
  { view: 'home', label: '今天', icon: '☀' },
  { view: 'goals', label: '目标', icon: '◎' },
  { view: 'timer', label: '计时', icon: '⏱' },
  { view: 'review', label: '回顾', icon: '✦' },
]

const FULL_VIEWS = ['bedtime', 'restart', 'settings']

function Shell() {
  const { state } = useStore()
  const [route, setRoute] = useState({ view: 'home', params: {} })
  const scrollRef = useRef(null)

  function navigate(view, params = {}) {
    setRoute({ view, params })
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [route.view, route.params.projectId])

  const activeTab = route.view === 'schedule' ? 'goals' : route.view
  const hideTabs = FULL_VIEWS.includes(route.view)

  let page = null
  if (route.view === 'home') page = <Home navigate={navigate} />
  else if (route.view === 'goals') page = <Goals navigate={navigate} />
  else if (route.view === 'schedule') page = <Schedule projectId={route.params.projectId} navigate={navigate} />
  else if (route.view === 'timer') page = <Timer navigate={navigate} />
  else if (route.view === 'bedtime') page = <Bedtime navigate={navigate} />
  else if (route.view === 'restart') page = <Restart navigate={navigate} />
  else if (route.view === 'review') page = <Review navigate={navigate} />
  else if (route.view === 'settings') page = <Settings navigate={navigate} />

  return (
    <div className={`app-shell ${route.view === 'bedtime' ? 'is-night' : ''}`}>
      <div className="app-scroll" ref={scrollRef} key={route.view}>
        {page}
        <div className={`app-bottom-space ${hideTabs ? '' : 'has-tabs'}`} aria-hidden="true" />
      </div>

      {state.timer && route.view !== 'timer' ? (
        <button type="button" className="timer-float" onClick={() => navigate('timer')}>
          <span className="timer-float__dot" aria-hidden="true" />
          <span className="timer-float__label">{state.timer.label}</span>
          <span className="timer-float__clock">{fmtStopwatch(Date.now() - new Date(state.timer.startedAt).getTime())}</span>
        </button>
      ) : null}

      {hideTabs ? null : (
        <nav className="tabbar" aria-label="主导航">
          {TABS.map((tab) => (
            <button
              key={tab.view}
              type="button"
              className={`tab ${activeTab === tab.view ? 'is-active' : ''}`}
              aria-current={activeTab === tab.view ? 'page' : undefined}
              onClick={() => navigate(tab.view)}
            >
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
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
