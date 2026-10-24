import { useEffect, useRef, useState } from 'react'
import catCover from '../assets/cat/h-cover.webp'
import './BedtimeTaskCover.css'

export const TASK_DISSOLVE_MS = 1200

// Sample the displayed cat and UI into fragments. Their release starts at the
// right edge, so the particle front follows the same direction as the DOM mask.
function sampleFragments(visual, width, height, paddingX, paddingY) {
  const snapshot = document.createElement('canvas')
  snapshot.width = Math.ceil(width + paddingX * 2)
  snapshot.height = Math.ceil(height + paddingY * 2)
  const context = snapshot.getContext('2d')
  if (!context) return []
  context.translate(paddingX, paddingY)
  const base = visual.getBoundingClientRect()
  visual.querySelectorAll('.settle-row__title, .settle-row__meta, .choice, .link-btn, .est-row__label, .chip').forEach((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const x = rect.left - base.left
    const y = rect.top - base.top
    if (element.matches('button')) {
      context.fillStyle = style.backgroundColor
      context.beginPath()
      context.roundRect(x, y, rect.width, rect.height, 9)
      context.fill()
    }
    context.fillStyle = style.color
    context.font = style.font
    context.textBaseline = 'middle'
    context.textAlign = element.matches('button') ? 'center' : 'left'
    context.fillText(element.textContent.trim(), x + (element.matches('button') ? rect.width / 2 : 0), y + rect.height / 2, rect.width)
  })
  const image = visual.querySelector('.settle-cat__image')
  if (image?.complete && image.naturalWidth) {
    // The complete image uses its natural aspect ratio and may extend beyond
    // the task row. Sample the displayed bounds without stretching it.
    const bounds = image.getBoundingClientRect()
    context.drawImage(image, bounds.left - base.left, bounds.top - base.top, bounds.width, bounds.height)
  }
  const pixels = context.getImageData(0, 0, snapshot.width, snapshot.height).data
  const step = Math.max(4, Math.ceil(Math.sqrt(snapshot.width * snapshot.height / 1400)))
  const fragments = []
  for (let y = 1; y < snapshot.height; y += step) {
    for (let x = 1; x < snapshot.width; x += step) {
      const offset = (y * snapshot.width + x) * 4
      if (pixels[offset + 3] < 24) continue
      fragments.push({
        x: x - paddingX, y: y - paddingY,
        delay: (1 - x / snapshot.width) * 0.46,
        dx: 85 + Math.random() * 145,
        dy: (Math.random() - 0.5) * 54,
        size: step * (0.55 + Math.random() * 0.65),
        spin: (Math.random() - 0.5) * 3,
        color: `rgba(${pixels[offset]}, ${pixels[offset + 1]}, ${pixels[offset + 2]}, ${pixels[offset + 3] / 255})`,
      })
    }
  }
  return fragments
}

export default function BedtimeTaskCover({ covered, dissolving, children }) {
  const visualRef = useRef(null)
  const canvasRef = useRef(null)
  const [revealed, setRevealed] = useState(false)
  const gestureRef = useRef(null)
  const touchRef = useRef({ active: false, swiped: false, at: 0 })

  useEffect(() => {
    const image = new Image()
    image.src = catCover
  }, [])

  useEffect(() => {
    setRevealed(false)
    gestureRef.current = null
    if (visualRef.current) {
      visualRef.current.dataset.dragging = 'false'
      visualRef.current.style.setProperty('--cat-retreat', '0%')
    }
  }, [covered])

  useEffect(() => {
    if (!covered || !revealed || dissolving) return
    const restore = (event) => {
      const visual = visualRef.current
      if (!visual || visual.contains(event.target)) return
      setRevealed(false)
      visual.style.setProperty('--cat-retreat', '0%')
      // A tap on blank space does not necessarily blur the last control.
      if (visual.contains(document.activeElement)) document.activeElement.blur()
    }
    document.addEventListener('click', restore)
    return () => document.removeEventListener('click', restore)
  }, [covered, revealed, dissolving])

  useEffect(() => {
    if (!dissolving) return
    const visual = visualRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const forced = window.matchMedia('(forced-colors: active)')
    if (!context || reduced.matches || forced.matches || document.hidden) return
    const rect = visual.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight) return
    const width = rect.width
    const height = rect.height
    const padding = 180
    const verticalPadding = 100
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.ceil((width + padding * 2) * ratio)
    canvas.height = Math.ceil((height + verticalPadding * 2) * ratio)
    Object.assign(canvas.style, {
      left: `-${padding}px`,
      top: `${visual.offsetTop - verticalPadding}px`,
      width: `${width + padding * 2}px`,
      height: `${height + verticalPadding * 2}px`,
    })
    context.setTransform(ratio, 0, 0, ratio, padding * ratio, verticalPadding * ratio)
    const fragments = sampleFragments(visual, width, height, padding, verticalPadding)
    let frame = 0
    const start = performance.now()
    canvas.dataset.playing = 'true'

    function stop() {
      cancelAnimationFrame(frame)
      context.clearRect(-padding, -verticalPadding, width + padding * 2, height + verticalPadding * 2)
      canvas.dataset.playing = 'false'
    }
    function draw(time) {
      const progress = Math.min(1, (time - start) / TASK_DISSOLVE_MS)
      context.clearRect(-padding, -verticalPadding, width + padding * 2, height + verticalPadding * 2)
      if (progress >= 1) { stop(); return }
      for (const piece of fragments) {
        const local = Math.max(0, Math.min(1, (progress - piece.delay) / (1 - piece.delay)))
        if (local <= 0) continue
        context.save()
        context.globalAlpha = Math.min(1, local * 16) * Math.pow(1 - local, 1.35)
        context.translate(piece.x - piece.dx * Math.pow(local, 0.85), piece.y + piece.dy * local)
        context.rotate(piece.spin * local)
        context.fillStyle = piece.color
        const size = piece.size * (1 - local * 0.65)
        context.fillRect(-size / 2, -size / 2, size, size)
        context.restore()
      }
      frame = requestAnimationFrame(draw)
    }
    const onVisibility = () => { if (document.hidden) stop() }
    const onPreference = () => { if (reduced.matches || forced.matches) stop() }
    frame = requestAnimationFrame(draw)
    document.addEventListener('visibilitychange', onVisibility)
    reduced.addEventListener('change', onPreference)
    forced.addEventListener('change', onPreference)
    window.addEventListener('resize', stop)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      reduced.removeEventListener('change', onPreference)
      forced.removeEventListener('change', onPreference)
      window.removeEventListener('resize', stop)
    }
  }, [dissolving])

  function retreat(event) {
    if (!covered || dissolving || revealed || event.pointerType === 'touch') return
    const rect = event.currentTarget.getBoundingClientRect()
    const across = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    event.currentTarget.style.setProperty('--cat-retreat', `-${18 + Math.pow(1 - across, 1.1) * 94}%`)
  }

  function beginSwipe(event) {
    touchRef.current = { active: event.pointerType === 'touch', swiped: false, at: 0 }
    if (event.pointerType !== 'touch' || !event.isPrimary || !covered || revealed || dissolving) return
    gestureRef.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, direction: null,
      width: visualRef.current.getBoundingClientRect().width,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveSwipe(event) {
    const gesture = gestureRef.current
    if (!gesture || gesture.id !== event.pointerId || dissolving) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    if (!gesture.direction && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      gesture.direction = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical'
    }
    if (gesture.direction !== 'horizontal') return
    event.preventDefault()
    gesture.dx = dx
    visualRef.current.dataset.dragging = 'true'
    visualRef.current.style.setProperty('--cat-retreat', `${Math.min(0, dx)}px`)
  }

  function endSwipe(event, cancelled = false) {
    const gesture = gestureRef.current
    if (!gesture || gesture.id !== event.pointerId) return
    gestureRef.current = null
    const swiped = gesture.direction === 'horizontal'
    touchRef.current = { active: true, swiped, at: performance.now() }
    visualRef.current.dataset.dragging = 'false'
    visualRef.current.style.setProperty('--cat-retreat', '0%')
    if (!cancelled && swiped && gesture.dx < -Math.max(40, gesture.width * 0.18)) setRevealed(true)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <>
      <div
        ref={visualRef}
        className="settle-row__visual"
        data-dragging="false"
        data-covered={covered}
        data-revealed={revealed}
        data-dissolving={dissolving}
        style={{ '--task-dissolve-duration': `${TASK_DISSOLVE_MS}ms` }}
        onPointerEnter={retreat}
        onPointerDownCapture={beginSwipe}
        onPointerMove={(event) => { moveSwipe(event); retreat(event) }}
        onPointerUp={(event) => endSwipe(event)}
        onPointerCancel={(event) => endSwipe(event, true)}
        onLostPointerCapture={(event) => endSwipe(event, true)}
        onClickCapture={(event) => {
          if (event.detail !== 0 && touchRef.current.swiped && performance.now() - touchRef.current.at < 700) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onPointerLeave={() => {
          if (!dissolving && !gestureRef.current) visualRef.current?.style.setProperty('--cat-retreat', '0%')
        }}
      >
        {children}
        {covered ? (
          <span className="settle-cat__entry">
            <button
              type="button"
              className="settle-cat"
              aria-label="移开猫咪，查看任务选项"
              disabled={dissolving}
              onClick={(event) => {
                if (event.detail !== 0 && (event.nativeEvent.pointerType === 'touch' || touchRef.current.active)) {
                  event.preventDefault()
                  // Swiping must not also activate a button or close another open row.
                  if (touchRef.current.swiped && performance.now() - touchRef.current.at < 700) event.stopPropagation()
                  return
                }
                setRevealed(true)
                visualRef.current?.querySelector('.choice')?.focus({ preventScroll: true })
              }}
            >
              <img className="settle-cat__image" src={catCover} alt="" draggable="false" />
            </button>
          </span>
        ) : null}
      </div>
      <canvas ref={canvasRef} className="settle-dissolve" aria-hidden="true" data-playing="false" />
    </>
  )
}
