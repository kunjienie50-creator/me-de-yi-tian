import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import checkArt from '../assets/task-check/check.webp'
import crossArt from '../assets/task-check/cross.webp'
import './TaskCheck.css'

let artPreloaded = false

const PARTICLES = Array.from({ length: 18 }, (_, index) => {
  const angle = index * Math.PI * 2 / 18 - Math.PI / 2
  const distance = 28 + (index * 17 % 34)
  return {
    '--spark-x': `${Math.cos(angle) * distance}px`,
    '--spark-y': `${Math.sin(angle) * distance - 9}px`,
    '--spark-turn': `${-100 - index * 29}deg`,
    '--spark-size': `${2.5 + index % 4}px`,
    '--spark-delay': `${index % 3 * 18}ms`,
  }
})

function Glyph({ done }) {
  return (
    <span className="task-check__glyph" style={{ '--check-art': `url("${done ? checkArt : crossArt}")` }}>
      <img className="task-check__paint" src={done ? checkArt : crossArt} alt="" width="192" height="192" draggable="false" />
    </span>
  )
}

export default function TaskCheck({ done, title, onToggle }) {
  const buttonRef = useRef(null)
  const timerRef = useRef(0)
  const sequenceRef = useRef(0)
  const frameRef = useRef(0)
  const pointRef = useRef(null)
  const [burst, setBurst] = useState(null)

  function resetTilt() {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
    pointRef.current = null
    buttonRef.current?.style.removeProperty('--check-tilt-x')
    buttonRef.current?.style.removeProperty('--check-tilt-y')
  }

  function onPointerMove(event) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    pointRef.current = { x: event.clientX, y: event.clientY }
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      const button = buttonRef.current
      const point = pointRef.current
      if (!button || !point) return
      const rect = button.getBoundingClientRect()
      button.style.setProperty('--check-tilt-x', `${-(point.y - rect.top - rect.height / 2) / rect.height * 20}deg`)
      button.style.setProperty('--check-tilt-y', `${(point.x - rect.left - rect.width / 2) / rect.width * 24}deg`)
    })
  }

  useEffect(() => {
    if (!artPreloaded) {
      artPreloaded = true
      for (const src of [checkArt, crossArt]) { const image = new Image(); image.src = src; image.decode?.().catch(() => {}) }
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    function stop() {
      clearTimeout(timerRef.current)
      setBurst(null)
      resetTilt()
    }
    const onVisibility = () => { if (document.hidden) stop() }
    reduced.addEventListener('change', stop)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timerRef.current)
      cancelAnimationFrame(frameRef.current)
      reduced.removeEventListener('change', stop)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!burst) return
    // The fixed echo stays at the click point even when completed tasks sort downwards.
    const onScroll = () => { clearTimeout(timerRef.current); setBurst(null) }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [burst?.sequence])

  function activate() {
    clearTimeout(timerRef.current)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !window.matchMedia('(forced-colors: active)').matches) {
      const rect = buttonRef.current.getBoundingClientRect()
      setBurst({ sequence: ++sequenceRef.current, left: rect.left, top: rect.top, done: !done })
      timerRef.current = window.setTimeout(() => setBurst(null), 720)
    }
    onToggle?.()
  }

  return (
    <>
      <button ref={buttonRef} type="button" className={`task-row__check task-check ${done ? 'is-on' : ''}`}
        aria-pressed={done} aria-label={done ? `取消完成：${title}` : `标记完成：${title}`}
        title={done ? '已点亮，点击取消' : '点击点亮这件事'} onClick={activate}
        onPointerMove={onPointerMove} onPointerLeave={resetTilt} onPointerCancel={resetTilt}>
        <span className="task-check__tilt" aria-hidden="true">
          <span key={burst?.sequence || 'idle'} className="task-check__spin" data-spinning={Boolean(burst)}>
            <Glyph done={done} />
          </span>
        </span>
        <span className="task-check__fallback" aria-hidden="true">{done ? '✓' : '×'}</span>
      </button>
      {burst && createPortal(
        <span key={burst.sequence} className="task-check-fx" style={{ left: burst.left, top: burst.top }} aria-hidden="true">
          <span className="task-check-fx__echo"><Glyph done={burst.done} /></span>
          {PARTICLES.map((style, index) => <i key={index} className={`task-check-fx__spark task-check-fx__spark--${index % 3}`} style={style} />)}
        </span>, document.body,
      )}
    </>
  )
}
