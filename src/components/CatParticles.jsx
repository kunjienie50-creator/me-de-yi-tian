import { useEffect, useRef } from 'react'
import { todayTasks, useStore } from '../store.jsx'

const MAX_PARTICLES = 90
const COLOR = '47, 47, 47'

export default function CatParticles() {
  const { state, today } = useStore()
  const done = todayTasks(state, today).filter((task) => task.done).length
  const canvasRef = useRef(null)
  const settingsRef = useRef(done)
  settingsRef.current = done

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const forcedColors = window.matchMedia('(forced-colors: active)')
    const particles = []
    let inView = !('IntersectionObserver' in window)
    let frame = 0
    let lastTime = 0
    let emission = 0
    let width = 1
    let height = 1
    const enabled = () => inView && !document.hidden && !reduced.matches && !forcedColors.matches

    function stop() {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      emission = 0
      particles.length = 0
      context.clearRect(0, 0, width, height)
      canvas.dataset.running = 'false'
      canvas.dataset.particles = '0'
    }

    function draw(time) {
      frame = 0
      if (!enabled()) { stop(); return }
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0
      lastTime = time
      const lit = settingsRef.current
      const strength = Math.min(Math.max(lit, 0), 12) / 12
      const rate = 3 + strength * 42
      emission += delta * rate
      while (emission >= 1) {
        emission -= 1
        if (particles.length >= MAX_PARTICLES) continue
        particles.push({
          x: width * (0.19 + Math.random() * 0.62),
          y: height * (0.79 + Math.random() * 0.09),
          age: 0,
          life: 1.6 + Math.random() * 1.2,
          speed: 34 + Math.random() * 30 + strength * 15,
          drift: (Math.random() - 0.5) * 16,
          phase: Math.random() * Math.PI * 2,
          size: (0.8 + Math.random() * 1.5) * (1 + strength * 0.7),
          spark: Math.random() < 0.2,
        })
      }
      context.clearRect(0, 0, width, height)
      for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index]
        particle.age += delta
        if (particle.age >= particle.life) { particles.splice(index, 1); continue }
        particle.y -= particle.speed * delta
        particle.x += particle.drift * delta
        const age = particle.age / particle.life
        const alpha = Math.sin(age * Math.PI) * (0.28 + strength * 0.42)
        const x = particle.x + Math.sin(particle.phase + particle.age * 2) * 5
        context.fillStyle = `rgba(${COLOR}, ${alpha})`
        if (particle.spark) {
          const size = particle.size * 1.4
          context.beginPath()
          context.moveTo(x, particle.y - size)
          context.lineTo(x + size * 0.6, particle.y)
          context.lineTo(x, particle.y + size)
          context.lineTo(x - size * 0.6, particle.y)
          context.closePath()
          context.fill()
        } else {
          context.beginPath()
          context.arc(x, particle.y, particle.size, 0, Math.PI * 2)
          context.fill()
        }
      }
      canvas.dataset.running = 'true'
      canvas.dataset.particles = String(particles.length)
      canvas.dataset.emissionRate = String(rate)
      canvas.dataset.color = COLOR
      frame = requestAnimationFrame(draw)
    }

    function update() {
      if (!enabled()) { stop(); return }
      if (!frame) frame = requestAnimationFrame(draw)
    }

    function resize() {
      stop()
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      update()
    }

    const intersection = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    }) : null
    const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null
    intersection?.observe(canvas)
    observer?.observe(canvas)
    document.addEventListener('visibilitychange', update)
    reduced.addEventListener('change', update)
    forcedColors.addEventListener('change', update)
    window.addEventListener('resize', resize)
    resize()
    return () => {
      stop()
      intersection?.disconnect()
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
      reduced.removeEventListener('change', update)
      forcedColors.removeEventListener('change', update)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="cat-particles" aria-hidden="true" data-running="false" data-particles="0" />
}
