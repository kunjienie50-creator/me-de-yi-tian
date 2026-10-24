import { useEffect, useRef } from 'react'
import './TaskBurst.css'

export default function TaskBurst({ sequence = 0 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const row = canvas.closest('.settle-row')
    const context = canvas.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const forcedColors = window.matchMedia('(forced-colors: active)')
    if (!sequence || !context || reduced.matches || forcedColors.matches || document.hidden) return

    const rect = canvas.getBoundingClientRect()
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return
    const width = rect.width
    const height = rect.height
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    const style = getComputedStyle(row)
    const palette = [style.getPropertyValue('--peach').trim() || '#ff9bc9', '#f6bdd9', '#fff7fc', '#b895a7']
    const fragments = Array.from({ length: 56 }, (_, index) => {
      const angle = index / 56 * Math.PI * 2 + (Math.random() - 0.5) * 0.35
      const reach = 24 + Math.random() * 28
      return {
        x: width / 2 + Math.cos(angle) * (width / 2 - 47) * (0.55 + Math.random() * 0.45),
        y: height / 2 + Math.sin(angle) * (height / 2 - 46) * (0.45 + Math.random() * 0.55),
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * reach,
        size: 2 + Math.random() * 5,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 6,
        color: palette[index % palette.length],
        shape: index % 3,
      }
    })
    const content = row.querySelector('.settle-row__content')
    const pulse = content?.animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.018)', opacity: 0.5, offset: 0.18 },
      { transform: 'scale(0.995)', opacity: 0.88, offset: 0.65 },
      { transform: 'scale(1)', opacity: 1 },
    ], { duration: 560, easing: 'ease-out' })
    let frame = 0
    const startedAt = performance.now()
    row.dataset.bursting = 'true'
    canvas.dataset.playing = 'true'

    function stop() {
      cancelAnimationFrame(frame)
      pulse?.cancel()
      context.clearRect(0, 0, width, height)
      row.dataset.bursting = 'false'
      canvas.dataset.playing = 'false'
    }

    function draw(time) {
      const progress = Math.min(1, (time - startedAt) / 720)
      context.clearRect(0, 0, width, height)
      if (progress >= 1) { stop(); return }
      const travel = 1 - Math.pow(1 - progress, 3)
      context.globalAlpha = Math.min(1, progress * 10) * Math.pow(1 - progress, 1.3)
      for (const piece of fragments) {
        const size = piece.size * (1 - progress * 0.35)
        context.save()
        context.translate(piece.x + piece.dx * travel, piece.y + piece.dy * travel + progress * progress * 20)
        context.rotate(piece.angle + piece.spin * progress)
        context.fillStyle = piece.color
        if (piece.shape === 0) {
          context.fillRect(-size / 2, -size / 2, size, size * 1.5)
        } else if (piece.shape === 1) {
          context.beginPath()
          context.arc(0, 0, size / 2, 0, Math.PI * 2)
          context.fill()
        } else {
          context.beginPath()
          context.moveTo(0, -size)
          context.lineTo(size * 0.65, 0)
          context.lineTo(0, size)
          context.lineTo(-size * 0.65, 0)
          context.closePath()
          context.fill()
        }
        context.restore()
      }
      frame = requestAnimationFrame(draw)
    }
    function onPreferenceChange() { if (reduced.matches || forcedColors.matches) stop() }
    function onVisibilityChange() { if (document.hidden) stop() }
    frame = requestAnimationFrame(draw)
    reduced.addEventListener('change', onPreferenceChange)
    forcedColors.addEventListener('change', onPreferenceChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('resize', stop)
    return () => {
      stop()
      reduced.removeEventListener('change', onPreferenceChange)
      forcedColors.removeEventListener('change', onPreferenceChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('resize', stop)
    }
  }, [sequence])

  return <canvas ref={canvasRef} className="task-burst" aria-hidden="true" data-playing="false" />
}
