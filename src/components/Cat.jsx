import { useEffect, useRef, useState } from 'react'
import catSprite from '../assets/cat/mmrd-sprite.webp'
import celebrationSprite from '../assets/cat/mmfg-sprite.webp'
import { useCatAnimationTrigger } from './CatAnimationContext.jsx'
import CatParticles from './CatParticles.jsx'
import './Cat.css'

const FRAMES = Array.from({ length: 51 }, (_, index) => {
  const frame = index % 50
  return { offset: index / 50, backgroundPosition: `${frame % 5 * 25}% ${Math.floor(frame / 5) * 100 / 9}%`, easing: 'steps(1, end)' }
})

export default function Cat({ mood = 'idle', className = '', label, completionFor = null, particles = false }) {
  const elementRef = useRef(null)
  const animationRef = useRef(null)
  const [celebrating, setCelebrating] = useState(false)
  const trigger = useCatAnimationTrigger()
  const name = label || (mood === 'happy' ? '一只开心的小猫' : mood === 'sleepy' ? '一只准备睡的小猫' : '一只在等你的小猫')

  useEffect(() => {
    const image = new Image()
    image.src = celebrationSprite
    const element = elementRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let inView = true
    const update = () => {
      const paused = document.hidden || !inView
      element.dataset.paused = String(paused)
      const animation = animationRef.current
      if (!animation) return
      if (paused) animation.pause()
      else animation.play()
    }
    const stop = () => {
      if (!reduced.matches) return
      const animation = animationRef.current
      animationRef.current = null
      animation?.cancel()
      element.dataset.playing = 'false'
      setCelebrating(false)
    }
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    }) : null
    observer?.observe(element)
    document.addEventListener('visibilitychange', update)
    reduced.addEventListener('change', stop)
    update()
    return () => {
      observer?.disconnect()
      const animation = animationRef.current
      animationRef.current = null
      animation?.cancel()
      document.removeEventListener('visibilitychange', update)
      reduced.removeEventListener('change', stop)
    }
  }, [])

  useEffect(() => {
    if (!trigger.sequence || performance.now() - trigger.at > 500 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (completionFor !== null && (trigger.kind !== 'celebrate' || trigger.taskId !== completionFor)) return
    const element = elementRef.current
    const sprite = element.querySelector('.cat__sprite')
    const isCelebration = trigger.kind === 'celebrate'
    const frameTime = isCelebration ? 60 : parseFloat(getComputedStyle(element).getPropertyValue('--cat-frame-time')) || 75
    animationRef.current?.cancel()
    setCelebrating(isCelebration)
    const animation = sprite.animate(FRAMES, { duration: frameTime * 50, iterations: 1 })
    animationRef.current = animation
    element.dataset.playing = 'true'
    if (document.hidden || element.dataset.paused === 'true') animation.pause()
    const finish = () => {
      if (animationRef.current !== animation) return
      animationRef.current = null
      element.dataset.playing = 'false'
      setCelebrating(false)
    }
    animation.finished.then(finish, finish)
  }, [trigger, completionFor])

  return (
    <div ref={elementRef} className={`cat cat--${mood} ${className}`} role="img" aria-label={name} data-playing="false" data-animation={celebrating ? 'celebrate' : 'move'}>
      {particles ? <CatParticles /> : null}
      <span className="cat__body" aria-hidden="true">
        <span className="cat__sprite" style={{ backgroundImage: `url("${celebrating ? celebrationSprite : catSprite}")` }} />
      </span>
    </div>
  )
}
