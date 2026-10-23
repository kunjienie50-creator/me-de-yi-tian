import { useRef, useState } from 'react'
import './App.css'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatDay(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`
}

function formatClock(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** 手绘风小猫：纯 SVG + CSS 动画，不依赖任何图片资源 */
function Cat({ happy }) {
  return (
    <svg
      className={happy ? 'cat cat--happy' : 'cat'}
      viewBox="0 0 200 210"
      role="img"
      aria-label={happy ? '一只开心的小猫' : '一只在等你的小猫'}
    >
      {/* 尾巴 */}
      <path
        className="cat__tail"
        d="M148 186c22-4 34-20 30-38-3-14-16-20-25-13"
        fill="none"
        stroke="#f2b072"
        strokeWidth="11"
        strokeLinecap="round"
      />
      {/* 身体 */}
      <ellipse cx="100" cy="172" rx="52" ry="34" fill="#ffc98b" />
      <ellipse cx="100" cy="182" rx="30" ry="20" fill="#fff6ec" />
      {/* 前爪 */}
      <ellipse cx="76" cy="196" rx="15" ry="10" fill="#fff6ec" stroke="#f2b072" strokeWidth="2" />
      <ellipse cx="124" cy="196" rx="15" ry="10" fill="#fff6ec" stroke="#f2b072" strokeWidth="2" />

      {/* 耳朵 */}
      <path d="M50 58 42 16 86 44Z" fill="#ffc98b" stroke="#f2b072" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M150 58 158 16 114 44Z" fill="#ffc98b" stroke="#f2b072" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M57 50 53 28 76 43Z" fill="#ff9da6" />
      <path d="M143 50 147 28 124 43Z" fill="#ff9da6" />

      {/* 头 */}
      <ellipse cx="100" cy="92" rx="59" ry="49" fill="#ffc98b" stroke="#f2b072" strokeWidth="2.5" />
      {/* 额头小条纹 */}
      <path d="M92 52v9M100 49v11M108 52v9" stroke="#f2b072" strokeWidth="3" strokeLinecap="round" />

      {/* 腮红 */}
      <ellipse cx="62" cy="106" rx="11" ry="7" fill="#ff9da6" opacity="0.5" />
      <ellipse cx="138" cy="106" rx="11" ry="7" fill="#ff9da6" opacity="0.5" />

      {/* 平时的眼睛 */}
      <g className="cat__eye-open">
        <ellipse cx="80" cy="90" rx="7.5" ry="9.5" fill="#4a362b" />
        <ellipse cx="120" cy="90" rx="7.5" ry="9.5" fill="#4a362b" />
        <circle cx="82.6" cy="86" r="2.6" fill="#ffffff" />
        <circle cx="122.6" cy="86" r="2.6" fill="#ffffff" />
      </g>

      {/* 开心时的眼睛 */}
      <g className="cat__eye-happy">
        <path d="M70 92q10-13 20 0" fill="none" stroke="#4a362b" strokeWidth="4" strokeLinecap="round" />
        <path d="M110 92q10-13 20 0" fill="none" stroke="#4a362b" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* 鼻子 & 嘴 */}
      <path d="M100 103l-5 5h10z" fill="#ff8f9b" stroke="#ff8f9b" strokeLinejoin="round" />
      <path
        d="M100 110v4M100 114c-2.5 4-7 4-9 1M100 114c2.5 4 7 4 9 1"
        fill="none"
        stroke="#4a362b"
        strokeWidth="2.6"
        strokeLinecap="round"
      />

      {/* 胡须 */}
      <g stroke="#e0a675" strokeWidth="2.2" strokeLinecap="round">
        <path d="M50 96 22 89M50 105 20 105M50 114 24 122" />
        <path d="M150 96 178 89M150 105 180 105M150 114 176 122" />
      </g>
    </svg>
  )
}

export default function App() {
  const [draft, setDraft] = useState('')
  const [goal, setGoal] = useState(null)
  const inputRef = useRef(null)

  const today = new Date()

  function handleSubmit(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setGoal({ text, at: new Date() })
    setDraft('')
  }

  function handleReset() {
    setGoal(null)
    setDraft('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <main className="app">
      <header className="topbar">
        <p className="topbar__date">{formatDay(today)}</p>
        <h1 className="topbar__title">me的一天</h1>
      </header>

      <section className="stage">
        <p className="bubble" key={goal ? 'set' : 'empty'}>
          {goal ? '记住啦，我帮你看着它～' : '今天想做什么呀？'}
        </p>
        <Cat happy={Boolean(goal)} />
      </section>

      {goal ? (
        <section className="goal-area">
          <div className="goal-card">
            <p className="goal-card__label">
              <span className="goal-card__dot" aria-hidden="true" />
              今天的目标
            </p>
            <p className="goal-card__text">{goal.text}</p>
            <p className="goal-card__meta">定于 {formatClock(goal.at)}</p>
          </div>
          <button type="button" className="link-btn" onClick={handleReset}>
            换一个目标
          </button>
        </section>
      ) : (
        <form className="goal-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="goal-input">
            写下今天想完成的一个目标
          </label>
          <input
            id="goal-input"
            ref={inputRef}
            className="goal-form__input"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="比如：把报告写完"
            enterKeyHint="done"
            autoComplete="off"
            maxLength={60}
          />
          <button type="submit" className="goal-form__btn" disabled={!draft.trim()}>
            就是它
          </button>
        </form>
      )}

      <p className="hint">第一步原型 · 目标只存在当前页面</p>
    </main>
  )
}
