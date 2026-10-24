import { useEffect, useRef } from 'react'
import noteArt from '../assets/note/bq.webp'
import './TaskNote.css'

const PARTICLES = Array.from({ length: 24 }, (_, index) => ({
  x: 6 + index * 37 % 88,
  size: 1.8 + index % 4 * 0.65,
  duration: 760 + index * 83 % 420,
  delay: -(index * 137 % 1200),
  drift: (index % 7 - 3) * 3,
  rise: 94 + index * 13 % 48,
}))

export default function TaskNote({ title }) {
  const elementRef = useRef(null)
  const phase = [...title].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4000

  useEffect(() => {
    const element = elementRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const forcedColors = window.matchMedia('(forced-colors: active)')
    let inView = true
    const update = () => {
      element.dataset.paused = String(!inView || document.hidden || reduced.matches || forcedColors.matches)
    }
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    }) : null
    observer?.observe(element)
    document.addEventListener('visibilitychange', update)
    reduced.addEventListener('change', update)
    forcedColors.addEventListener('change', update)
    update()
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', update)
      reduced.removeEventListener('change', update)
      forcedColors.removeEventListener('change', update)
    }
  }, [])

  return (
    <span ref={elementRef} className="task-note" style={{ '--note-phase': `-${phase}ms` }}>
      <span className="task-note__paper">
        <img className="task-note__art" src={noteArt} alt="" draggable="false" aria-hidden="true" />
        <span className="task-note__particles" aria-hidden="true">
        {PARTICLES.map((particle, index) => (
          <span key={index} className={`task-note__particle task-note__particle--${index % 3}`}
            style={{
              left: `${particle.x}%`,
              '--particle-size': `${particle.size}px`,
              '--particle-duration': `${particle.duration}ms`,
              '--particle-delay': `${particle.delay}ms`,
              '--particle-drift': `${particle.drift}px`,
              '--particle-rise': `${particle.rise}px`,
            }}
          />
        ))}
        </span>
        <span className="task-row__title">{title}</span>
      </span>
    </span>
  )
}
