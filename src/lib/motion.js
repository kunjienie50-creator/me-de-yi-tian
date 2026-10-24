import { useEffect } from 'react'

const SCOPE = '.app-shell, .sheet-layer, .fullscreen'
const REVEAL = '.screen > .panel, .screen > .banner, .screen > .stage, .screen > .quick-grid, .screen > .week-strip, .screen > .home-actions, .screen > .box-card, .screen > .notice-card, .screen > .leak-bar, .box-item, .project-card, .schedule__day, .sheet__body > .field, .fullscreen__body > .field'
const MAGNET = '.tab, .quick, .home-action, .box-card, .notice-card, .btn--primary, .icon-btn'
const TILT = '.goal-card, .project-card, .timer-card, .export-card'
const FEEDBACK = 'button, [role="button"], a[href], summary, input:is([type="button"], [type="submit"], [type="reset"], [type="checkbox"], [type="radio"]), .toggle, .radio, .proposal__check, .photo-picker'

// Event delegation also covers sheets rendered into document.body through portals.
export function useMotionEffects() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const seen = new WeakSet()
    const pending = new Set()
    const feedback = new Map()
    let magnet = null
    let tilt = null
    let pointer = null
    let frame = 0
    let pressed = null
    let lastPress = null

    function reveal(element) {
      element.dataset.motionReveal = 'visible'
      pending.delete(element)
      observer?.unobserve(element)
    }

    const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target)
      })
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' }) : null

    function scan(root) {
      if (!(root instanceof Element)) return
      const elements = [...(root.matches(REVEAL) ? [root] : []), ...root.querySelectorAll(REVEAL)]
      elements.forEach((element) => {
        if (seen.has(element) || !element.closest(SCOPE)) return
        seen.add(element)
        if (reduced.matches || !observer) return
        const siblings = [...element.parentElement.children]
        element.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(element), 4) * 45}ms`)
        element.dataset.motionReveal = 'pending'
        pending.add(element)
        observer.observe(element)
      })
    }

    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(scan))
      // React can remove entire pages while some sections are still off screen.
      pending.forEach((element) => { if (!element.isConnected) { observer?.unobserve(element); pending.delete(element) } })
    })
    scan(document.body)
    mutations.observe(document.body, { childList: true, subtree: true })

    function resetMagnet() {
      magnet?.style.removeProperty('--magnet-x')
      magnet?.style.removeProperty('--magnet-y')
      magnet = null
    }

    function resetTilt() {
      tilt?.style.removeProperty('--tilt-x')
      tilt?.style.removeProperty('--tilt-y')
      tilt = null
    }

    function updatePointer() {
      frame = 0
      if (!pointer) return
      const { target, x, y } = pointer
      const nextMagnet = target.closest(MAGNET)
      const nextTilt = target.closest(TILT)
      if (magnet !== nextMagnet) resetMagnet()
      if (tilt !== nextTilt) resetTilt()
      magnet = nextMagnet
      tilt = nextTilt
      if (magnet) {
        const rect = magnet.getBoundingClientRect()
        magnet.style.setProperty('--magnet-x', `${Math.max(-4, Math.min(4, (x - rect.left - rect.width / 2) * 0.1))}px`)
        magnet.style.setProperty('--magnet-y', `${Math.max(-4, Math.min(4, (y - rect.top - rect.height / 2) * 0.12))}px`)
      }
      if (tilt) {
        const rect = tilt.getBoundingClientRect()
        tilt.style.setProperty('--tilt-x', `${Math.max(-2.5, Math.min(2.5, (0.5 - (y - rect.top) / rect.height) * 5))}deg`)
        tilt.style.setProperty('--tilt-y', `${Math.max(-2.5, Math.min(2.5, ((x - rect.left) / rect.width - 0.5) * 5))}deg`)
      }
    }

    function onPointerMove(event) {
      if (reduced.matches || !finePointer.matches || event.pointerType !== 'mouse' || pressed) return
      if (!(event.target instanceof Element) || !event.target.closest(SCOPE)) { resetMagnet(); resetTilt(); return }
      pointer = { target: event.target, x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(updatePointer)
    }

    function onPointerOut(event) {
      if (!(event.relatedTarget instanceof Element) || !event.relatedTarget.closest(SCOPE)) {
        pointer = null
        cancelAnimationFrame(frame)
        frame = 0
        resetMagnet()
        resetTilt()
      } else {
        if (magnet && !magnet.contains(event.relatedTarget)) resetMagnet()
        if (tilt && !tilt.contains(event.relatedTarget)) resetTilt()
      }
    }

    function feedbackTarget(target) {
      if (!(target instanceof Element)) return null
      let element = target.closest(FEEDBACK)
      if (element?.matches('input[type="checkbox"], input[type="radio"]')) element = element.closest('label') || element
      const control = element instanceof HTMLLabelElement ? element.control : element
      if (!element?.closest(SCOPE) || element.matches('.sheet-layer__backdrop') || !element.animate) return null
      if (control?.matches(':disabled') || element.closest('[inert], [aria-disabled="true"], [data-closing="true"]')) return null
      return element
    }

    function animateFeedback(element, keyframes, options, hold = false) {
      feedback.get(element)?.cancel()
      const animation = element.animate(keyframes, options)
      feedback.set(element, animation)
      animation.finished.then(() => {
        if (!hold) {
          animation.cancel()
          if (feedback.get(element) === animation) feedback.delete(element)
        }
      }, () => { if (feedback.get(element) === animation) feedback.delete(element) })
    }

    function cancelPress() {
      if (!pressed) return
      window.clearTimeout(pressed.releaseTimer)
      feedback.get(pressed.element)?.cancel()
      feedback.delete(pressed.element)
      pressed.element.removeAttribute('data-ui-press')
      pressed = null
    }

    function startPress(element, position, input) {
      cancelPress()
      feedback.get(element)?.cancel()
      const rect = element.getBoundingClientRect()
      const x = position ? Math.max(-1, Math.min(1, (position.x - rect.left) / Math.max(rect.width, 1) * 2 - 1)) : 0
      const y = position ? Math.max(-1, Math.min(1, (position.y - rect.top) / Math.max(rect.height, 1) * 2 - 1)) : 0
      const base = getComputedStyle(element).transform
      const tilt = `${base === 'none' ? '' : base} perspective(600px) rotateX(${4 - y * 3}deg) rotateY(${Math.abs(x) < 0.1 ? -3 : x * 6}deg)`
      const transform = (shift, angle) => `${tilt} translateX(${shift}px) rotateZ(${angle}deg)`
      pressed = { element, base, ...input, startedAt: performance.now(), released: false }
      lastPress = { element, at: pressed.startedAt }
      element.dataset.uiPress = 'true'
      // The first shake happens on pointerdown; a held button stays gently tilted.
      animateFeedback(element, [
        { transform: base, scale: 1, offset: 0 },
        { transform: transform(-2.5, -1.4), scale: 0.96, offset: 0.16 },
        { transform: transform(2.5, 1.4), scale: 0.955, offset: 0.32 },
        { transform: transform(-1.7, -0.9), scale: 0.955, offset: 0.5 },
        { transform: transform(1, 0.5), scale: 0.96, offset: 0.7 },
        { transform: tilt, scale: 0.965, offset: 1 },
      ], { duration: 240, easing: 'ease-out', fill: 'forwards' }, true)
    }

    function releasePress() {
      if (!pressed || pressed.released) return
      const current = pressed
      current.released = true
      // Very quick clicks still show a short shake before the spring return.
      current.releaseTimer = window.setTimeout(() => {
        if (pressed !== current) return
        pressed = null
        current.element.removeAttribute('data-ui-press')
        if (!current.element.isConnected) {
          feedback.get(current.element)?.cancel()
          feedback.delete(current.element)
          return
        }
        const style = getComputedStyle(current.element)
        animateFeedback(current.element, [
          { transform: style.transform, scale: style.scale },
          { transform: current.base, scale: 1.025, offset: 0.65 },
          { transform: current.base, scale: 1 },
        ], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
      }, Math.max(0, 150 - (performance.now() - current.startedAt)))
    }

    function onPointerDown(event) {
      if (reduced.matches || !event.isPrimary || event.button !== 0) return
      const element = feedbackTarget(event.target)
      if (element) startPress(element, { x: event.clientX, y: event.clientY }, { pointerId: event.pointerId })
    }

    function onPointerUp(event) {
      if (pressed?.pointerId === event.pointerId) releasePress()
    }

    function onKeyDown(event) {
      if (reduced.matches || event.repeat || !['Enter', ' '].includes(event.key)) return
      const element = feedbackTarget(event.target)
      if (element && !(event.key === ' ' && element.matches('a[href]'))) startPress(element, null, { key: event.key })
    }

    function onKeyUp(event) {
      if (pressed?.key === event.key) releasePress()
    }

    function onClick(event) {
      if (reduced.matches || event.detail !== 0) return
      const element = feedbackTarget(event.target)
      // Assistive activation can send click alone; pointer/keyboard activation already reacted.
      if (!element || (lastPress?.element === element && performance.now() - lastPress.at < 700)) return
      startPress(element, null, {})
      releasePress()
    }

    function onFocus(event) {
      let element = event.target
      while (element instanceof Element) {
        if (pending.has(element)) reveal(element)
        element = element.parentElement
      }
    }

    function clearPointer() {
      cancelPress()
      pointer = null
      cancelAnimationFrame(frame)
      frame = 0
      resetMagnet()
      resetTilt()
    }

    function onPreferenceChange() {
      if (!reduced.matches && finePointer.matches) return
      clearPointer()
      if (reduced.matches) {
        pending.forEach(reveal)
        feedback.forEach((animation) => animation.cancel())
      }
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerout', onPointerOut, { passive: true })
    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
    document.addEventListener('pointerup', onPointerUp, { capture: true, passive: true })
    document.addEventListener('pointercancel', clearPointer)
    window.addEventListener('blur', clearPointer)
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    document.addEventListener('focusin', onFocus)
    reduced.addEventListener('change', onPreferenceChange)
    finePointer.addEventListener('change', onPreferenceChange)
    return () => {
      mutations.disconnect()
      observer?.disconnect()
      pending.forEach((element) => { element.dataset.motionReveal = 'visible' })
      feedback.forEach((animation) => animation.cancel())
      cancelPress()
      cancelAnimationFrame(frame)
      resetMagnet()
      resetTilt()
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', clearPointer)
      window.removeEventListener('blur', clearPointer)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
      document.removeEventListener('focusin', onFocus)
      reduced.removeEventListener('change', onPreferenceChange)
      finePointer.removeEventListener('change', onPreferenceChange)
    }
  }, [])
}
