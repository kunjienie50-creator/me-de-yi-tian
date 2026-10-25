import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import checkArt from '../assets/task-check/check.webp'
import crossArt from '../assets/task-check/cross.webp'
import './TaskCheck.css'

let artPreloaded = false

/**
 * 挤出层深度：0 = 最贴近画布涂层，4 = 最深。
 * 数值直接进 CSS 的 --depth，由 calc 派生出每层的 translate3d 与颜色/透明度。
 */
const DEPTH_STEPS = [0, 1, 2, 3, 4]

/** 18 颗粒子：一圈均匀铺开再用 index 打散距离，避免看起来像机械放射线。 */
const PARTICLES = Array.from({ length: 18 }, (_, index) => {
  const angle = index * Math.PI * 2 / 18 - Math.PI / 2
  const distance = 30 + (index * 19 % 36)
  const rise = -10 - (index % 4) * 3
  return {
    '--spark-x': `${(Math.cos(angle) * distance).toFixed(2)}px`,
    '--spark-y': `${(Math.sin(angle) * distance + rise).toFixed(2)}px`,
    '--spark-turn': `${-120 - index * 27}deg`,
    '--spark-size': `${2.5 + index % 4}px`,
    '--spark-delay': `${index % 3 * 16}ms`,
  }
})

function Glyph({ done }) {
  const art = done ? checkArt : crossArt
  return (
    <span
      className="task-check__glyph"
      data-art={done ? 'check' : 'cross'}
      style={{ '--check-art': `url("${art}")` }}
    >
      {/* 5 层阶梯挤出：用 mask 复制同一张素材的剪影，逐层 translate3d + 变深 + 变透明 */}
      {DEPTH_STEPS.map((depth) => (
        <i key={depth} className="task-check__layer" data-depth={depth} style={{ '--depth': depth }} />
      ))}
      <img className="task-check__paint" src={art} alt="" width="256" height="256" draggable="false" />
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
      button.style.setProperty('--check-tilt-x', `${(-(point.y - rect.top - rect.height / 2) / rect.height * 20).toFixed(2)}deg`)
      button.style.setProperty('--check-tilt-y', `${((point.x - rect.left - rect.width / 2) / rect.width * 24).toFixed(2)}deg`)
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
      // from = 点击前的素材：回响层带着「旧的那个」逆时针甩出去，按钮内的新素材同时旋转落定，
      // 两者在 blur 峰值处交接，才读得出「叉 → 勾」是在虚化里变换完成的。
      setBurst({ sequence: ++sequenceRef.current, left: rect.left, top: rect.top, from: done })
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
          <span className="task-check-fx__aura" />
          <span className="task-check-fx__echo"><Glyph done={burst.from} /></span>
          {PARTICLES.map((style, index) => <i key={index} className={`task-check-fx__spark task-check-fx__spark--${index % 3}`} style={style} />)}
        </span>, document.body,
      )}
    </>
  )
}
