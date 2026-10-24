import { useEffect, useRef } from 'react'
import titleArt from '../assets/brand/zt.webp'
import './BrandTitle.css'

export default function BrandTitle() {
  const elementRef = useRef(null)
  const pointerRef = useRef(null)
  const frameRef = useRef(0)

  function reset() {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
    pointerRef.current = null
    const element = elementRef.current
    for (const property of ['--brand-tilt-x', '--brand-tilt-y', '--brand-light-x']) element?.style.removeProperty(property)
    element?.removeAttribute('data-pressed')
  }

  function onPointerMove(event) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    pointerRef.current = { x: event.clientX, y: event.clientY }
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      const element = elementRef.current
      const pointer = pointerRef.current
      if (!element || !pointer) return
      const rect = element.getBoundingClientRect()
      const x = Math.max(-1, Math.min(1, (pointer.x - rect.left) / rect.width * 2 - 1))
      const y = Math.max(-1, Math.min(1, (pointer.y - rect.top) / rect.height * 2 - 1))
      element.style.setProperty('--brand-tilt-x', `${-y * 8}deg`)
      element.style.setProperty('--brand-tilt-y', `${x * 12}deg`)
      element.style.setProperty('--brand-light-x', `${50 + x * 30}%`)
    })
  }

  useEffect(() => {
    const element = elementRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let inView = true
    const update = () => {
      element.dataset.paused = String(document.hidden || !inView || reduced.matches)
      if (document.hidden || reduced.matches) reset()
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
    <span ref={elementRef} className="brand-3d" onPointerMove={onPointerMove} onPointerLeave={reset} onPointerCancel={reset}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return
        event.currentTarget.dataset.pressed = 'true'
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerUp={(event) => {
        event.currentTarget.removeAttribute('data-pressed')
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }}
    >
      <span className="brand-3d__float">
        <span className="brand-3d__stage">
          <img className="brand-3d__layer brand-3d__layer--back" src={titleArt} alt="" aria-hidden="true" draggable="false" />
          <img className="brand-3d__layer brand-3d__layer--middle" src={titleArt} alt="" aria-hidden="true" draggable="false" />
          <img className="home-brand__art brand-3d__front" src={titleArt} alt="me的一天" width="720" height="339" draggable="false" />
          <span className="brand-3d__shine" style={{ maskImage: `url("${titleArt}")` }} aria-hidden="true" />
        </span>
      </span>
    </span>
  )
}
