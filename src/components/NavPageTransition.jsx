import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import sprite from '../assets/cat/mmjjwy-sprite.webp'
import './NavPageTransition.css'

// The original is 5 × 9 portrait frames. Retain frames 7–41, including
// the final clear frame, and omit the blank lead-in and trailing hold.
const FRAME_COUNT = 35
const DURATION = FRAME_COUNT * 34
const FRAMES = Array.from({ length: FRAME_COUNT + 1 }, (_, index) => {
  const frame = Math.min(index, FRAME_COUNT - 1)
  return {
    offset: index / FRAME_COUNT,
    backgroundPosition: `${frame % 5 * 25}% ${Math.floor(frame / 5) * 100 / 6}%`,
    easing: 'steps(1, end)',
  }
})

let imageReady
function preloadSprite() {
  if (!imageReady) {
    const image = new Image()
    image.src = sprite
    imageReady = image.decode().catch(() => {
      imageReady = null
      throw new Error('Navigation sprite could not be loaded')
    })
  }
  return imageReady
}

export default function NavPageTransition({ navigationRef, request, onCovered, onFinish }) {
  const overlayRef = useRef(null)
  const spriteRef = useRef(null)
  const buttonRef = useRef(null)
  const skipRef = useRef(null)

  useLayoutEffect(() => {
    if (!request) return
    const navigation = navigationRef.current
    const measure = () => {
      if (!overlayRef.current) return
      const top = navigation?.getBoundingClientRect().top ?? window.innerHeight
      overlayRef.current.style.setProperty('--nav-transition-bottom', `${Math.max(0, window.innerHeight - top)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (navigation) observer.observe(navigation)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [navigationRef, request])

  useEffect(() => { preloadSprite().catch(() => {}) }, [])

  useEffect(() => {
    if (!request) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const previousFocus = request.returnFocus || document.activeElement
    let animation
    let coveredTimer
    let timeout
    let disposed = false
    let finished = false
    let committed = false

    const commit = () => {
      if (committed || disposed) return
      committed = true
      onCovered(request.view)
    }
    const finish = () => {
      if (finished || disposed) return
      finished = true
      commit()
      clearTimeout(coveredTimer)
      clearTimeout(timeout)
      animation?.cancel()
      onFinish(request.sequence)
    }
    skipRef.current = finish
    const onPreferenceChange = () => { if (reduced.matches) finish() }
    const onVisibilityChange = () => { if (document.hidden) finish() }
    reduced.addEventListener('change', onPreferenceChange)
    document.addEventListener('visibilitychange', onVisibilityChange)

    if (reduced.matches || document.hidden) {
      finish()
    } else {
      buttonRef.current?.focus({ preventScroll: true })
      // A missing resource must never block navigation.
      timeout = window.setTimeout(finish, DURATION + 1000)
      preloadSprite().then(() => {
        if (disposed || finished) return
        animation = spriteRef.current.animate(FRAMES, { duration: DURATION, iterations: 1, fill: 'both' })
        coveredTimer = window.setTimeout(commit, 17 * 34)
        animation.finished.then(finish, () => {})
      }, finish)
    }

    return () => {
      disposed = true
      skipRef.current = null
      clearTimeout(coveredTimer)
      clearTimeout(timeout)
      animation?.cancel()
      reduced.removeEventListener('change', onPreferenceChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.closest('[inert]')) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [request, onCovered, onFinish])

  if (!request) return null
  return createPortal(
    <div ref={overlayRef} className="nav-transition" role="region" aria-label={`正在前往${request.label}`}>
      <button
        ref={buttonRef}
        type="button"
        className="nav-transition__skip"
        aria-label={`跳过转场动画，前往${request.label}`}
        onClick={(event) => { event.stopPropagation(); skipRef.current?.() }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.preventDefault(); skipRef.current?.() }
        }}
      >
        <span className="nav-transition__frame" aria-hidden="true">
          <span ref={spriteRef} className="nav-transition__sprite" style={{ backgroundImage: `url("${sprite}")` }} />
        </span>
        <span className="nav-transition__hint" aria-hidden="true">点击任意位置跳过</span>
      </button>
    </div>,
    document.body,
  )
}
