import { useEffect, useRef } from 'react'
import sprite from '../assets/cat/mq-sprite.webp'
import './NavCatAnimation.css'

const FRAME_COUNT = 13
const FRAMES = Array.from({ length: FRAME_COUNT + 1 }, (_, index) => {
  const frame = Math.min(index, FRAME_COUNT - 1)
  return {
    offset: index / FRAME_COUNT,
    backgroundPosition: `${frame % 5 * 25}% ${Math.floor(frame / 5) * 50}%`,
    easing: 'steps(1, end)',
  }
})

export default function NavCatAnimation({ sequence }) {
  const elementRef = useRef(null)

  useEffect(() => {
    const element = elementRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animation
    let disposed = false
    const stop = () => {
      element.dataset.playing = 'false'
      animation?.cancel()
    }
    if (!sequence || reduced.matches || document.hidden) {
      stop()
      return
    }
    const spriteElement = element.querySelector('.nav-cat__sprite')
    animation = spriteElement.animate(FRAMES, { duration: FRAME_COUNT * 70, iterations: 1 })
    element.dataset.playing = 'true'
    animation.finished.then(() => { if (!disposed) stop() }, () => {})
    const onPreferenceChange = () => { if (reduced.matches) stop() }
    const onVisibilityChange = () => { if (document.hidden) stop() }
    reduced.addEventListener('change', onPreferenceChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      disposed = true
      stop()
      reduced.removeEventListener('change', onPreferenceChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [sequence])

  return (
    <span ref={elementRef} className="nav-cat" aria-hidden="true" data-playing="false">
      <span className="nav-cat__sprite" style={{ backgroundImage: `url("${sprite}")` }} />
    </span>
  )
}
