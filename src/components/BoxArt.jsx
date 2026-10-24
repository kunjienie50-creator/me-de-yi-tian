import { useEffect, useRef } from 'react'
import boxArt from '../assets/box/xz.webp'
import './BoxArt.css'

const PARTICLES = [
  { x: -3, y: 26, size: 7, duration: 6.4, delay: -1.2, drift: -6, lift: 24, turn: 12 },
  { x: 4, y: 63, size: 5, duration: 5.7, delay: -3.3, drift: -9, lift: 20, turn: -18 },
  { x: 16, y: 12, size: 6, duration: 6.8, delay: -5.1, drift: -4, lift: 22, turn: 32 },
  { x: 27, y: 94, size: 4, duration: 5.8, delay: -2.4, drift: 3, lift: 16, turn: 8 },
  { x: 82, y: 10, size: 5, duration: 6.1, delay: -0.4, drift: 5, lift: 20, turn: -28 },
  { x: 100, y: 34, size: 8, duration: 7.2, delay: -4.4, drift: 5, lift: 26, turn: 22 },
  { x: 95, y: 69, size: 5, duration: 5.6, delay: -1.9, drift: 8, lift: 22, turn: -12 },
  { x: 80, y: 91, size: 7, duration: 6.6, delay: -5.3, drift: 4, lift: 18, turn: 36 },
  { x: 49, y: 5, size: 4, duration: 5.9, delay: -3.6, drift: -2, lift: 18, turn: -32 },
]

export default function BoxArt({ size = 'compact' }) {
  const elementRef = useRef(null)
  const pointerRef = useRef(null)
  const frameRef = useRef(0)

  function reset() {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
    pointerRef.current = null
    const element = elementRef.current
    element?.style.removeProperty('--box-tilt-x')
    element?.style.removeProperty('--box-tilt-y')
    element?.style.removeProperty('--box-shift-x')
    element?.removeAttribute('data-pressed')
  }

  function onPointerMove(event) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    pointerRef.current = { x: event.clientX, y: event.clientY }
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      const element = elementRef.current
      const point = pointerRef.current
      if (!element || !point) return
      const rect = element.getBoundingClientRect()
      const x = Math.max(-1, Math.min(1, (point.x - rect.left) / rect.width * 2 - 1))
      const y = Math.max(-1, Math.min(1, (point.y - rect.top) / rect.height * 2 - 1))
      element.style.setProperty('--box-tilt-x', `${-y * 5}deg`)
      element.style.setProperty('--box-tilt-y', `${x * 7}deg`)
      element.style.setProperty('--box-shift-x', `${x * 3}px`)
    })
  }

  useEffect(() => {
    const element = elementRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let inView = true
    const update = () => {
      element.dataset.paused = String(document.hidden || !inView || reduced.matches)
      if (reduced.matches || document.hidden) reset()
    }
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    }) : null
    observer?.observe(element)
    document.addEventListener('visibilitychange', update)
    reduced.addEventListener('change', update)
    update()
    return () => {
      reset()
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
      reduced.removeEventListener('change', update)
    }
  }, [])

  return (
    <span ref={elementRef} className={`box-art box-art--${size}`} aria-hidden="true"
      onPointerMove={onPointerMove} onPointerLeave={reset} onPointerCancel={reset}
      onPointerDown={() => { elementRef.current.dataset.pressed = 'true' }}
      onPointerUp={() => elementRef.current.removeAttribute('data-pressed')}
    >
      <span className="box-art__halo" />
      <span className="box-art__shadow" />
      <span className="box-art__float">
        <span className="box-art__tilt"><img src={boxArt} alt="" draggable="false" width="535" height="720" /></span>
      </span>
      {PARTICLES.map((particle, index) => (
        <span key={index} className={`box-art__mote ${index % 3 === 1 ? 'box-art__mote--outline' : index % 3 === 2 ? 'box-art__mote--pink' : ''}`}
          style={{
            left: `${particle.x}%`, top: `${particle.y}%`,
            '--particle-size': `${particle.size}px`,
            '--particle-drift': `${particle.drift}px`,
            '--particle-lift': `${particle.lift}px`,
            '--particle-turn': `${particle.turn}deg`,
            animationDuration: `${particle.duration}s`, animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </span>
  )
}
