import { useEffect, useRef } from 'react'
import './CursorTrail.css'

const NATIVE_FIELD = 'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable]:not([contenteditable="false"]), :disabled'
const MAX_PARTICLES = 80

export default function CursorTrail() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!context) return
    const finePointer = window.matchMedia('(any-hover: hover) and (any-pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const forcedColors = window.matchMedia('(forced-colors: active)')
    const particles = []
    let tracking = false
    let frame = 0
    let lastFrame = 0
    let width = 0
    let height = 0
    let x = 0
    let y = 0
    let trailDistance = 0
    const enabled = () => finePointer.matches && !reduced.matches && !forcedColors.matches

    function hide() {
      tracking = false
      particles.length = 0
      trailDistance = 0
      cancelAnimationFrame(frame)
      frame = 0
      lastFrame = 0
      context.clearRect(0, 0, width, height)
      canvas.dataset.visible = 'false'
      canvas.dataset.particles = '0'
    }

    function resize() {
      hide()
      width = window.innerWidth
      height = window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = enabled() ? Math.round(width * dpr) : 1
      canvas.height = enabled() ? Math.round(height * dpr) : 1
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function emit(fromX, fromY, dx, dy) {
      const distance = Math.hypot(dx, dy)
      if (distance > 160) { trailDistance = 0; return }
      trailDistance += distance
      const count = Math.min(8, Math.floor(trailDistance / 4))
      trailDistance %= 4
      if (!count) return
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--trail-ink').trim() || '#4b4b4b'
      const gray = parseInt(ink.slice(1, 3), 16) || 75
      const now = performance.now()
      for (let index = 0; index < count; index += 1) {
        const fraction = (index + 1) / count
        particles.push({
          x: fromX + dx * fraction - dx / distance * 4,
          y: fromY + dy * fraction - dy / distance * 4,
          vx: -dx / distance * (7 + Math.random() * 9) + (Math.random() - 0.5) * 20,
          vy: -dy / distance * (7 + Math.random() * 9) + Math.random() * 16,
          radius: 0.7 + Math.random() * 1.5,
          brightness: Math.min(255, Math.round(gray * (0.8 + Math.random() * 0.3))),
          born: now,
          lifetime: 280 + Math.random() * 300,
        })
      }
      if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES)
    }

    function draw(now) {
      frame = 0
      const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 1 / 60
      lastFrame = now
      context.clearRect(0, 0, width, height)
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]
        const progress = (now - particle.born) / particle.lifetime
        if (progress >= 1) { particles.splice(index, 1); continue }
        particle.x += particle.vx * delta
        particle.y += particle.vy * delta
        const alpha = (1 - progress) ** 1.6 * 0.65
        const gray = particle.brightness
        context.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`
        context.shadowColor = `rgba(${gray}, ${gray}, ${gray}, ${alpha * 0.5})`
        context.shadowBlur = 4
        context.beginPath()
        context.arc(particle.x, particle.y, particle.radius * (1 - progress * 0.6), 0, Math.PI * 2)
        context.fill()
      }
      context.shadowBlur = 0
      canvas.dataset.visible = String(particles.length > 0)
      canvas.dataset.particles = String(particles.length)
      if (particles.length) frame = requestAnimationFrame(draw)
      else lastFrame = 0
    }

    function onMove(event) {
      if (event.pointerType !== 'mouse' || !enabled() || !(event.target instanceof Element) || event.target.closest(NATIVE_FIELD)) { hide(); return }
      if (tracking) emit(x, y, event.clientX - x, event.clientY - y)
      x = event.clientX
      y = event.clientY
      tracking = true
      if (particles.length && !frame) frame = requestAnimationFrame(draw)
    }
    function onDown(event) { if (event.pointerType !== 'mouse') hide() }
    function onOut(event) { if (!event.relatedTarget) hide() }
    function onVisibility() { if (document.hidden) hide() }
    function onKey(event) { if (event.key === 'Tab') hide() }

    resize()
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerdown', onDown, { passive: true })
    document.addEventListener('pointerout', onOut, { passive: true })
    document.addEventListener('pointercancel', hide)
    document.addEventListener('scroll', hide, { passive: true, capture: true })
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', hide)
    window.addEventListener('resize', resize)
    finePointer.addEventListener('change', resize)
    reduced.addEventListener('change', resize)
    forcedColors.addEventListener('change', resize)
    return () => {
      hide()
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointercancel', hide)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', hide)
      window.removeEventListener('resize', resize)
      finePointer.removeEventListener('change', resize)
      reduced.removeEventListener('change', resize)
      forcedColors.removeEventListener('change', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="cursor-trail" aria-hidden="true" data-visible="false" data-particles="0" />
}