import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const INITIAL_TRIGGER = { sequence: 0, at: -Infinity, kind: 'move', taskId: null }
const CatAnimationContext = createContext({ trigger: INITIAL_TRIGGER, celebrate: () => {} })

export function CatAnimationProvider({ children }) {
  const [trigger, setTrigger] = useState(INITIAL_TRIGGER)
  const celebrate = useCallback((taskId) => {
    const at = performance.now()
    setTrigger((previous) => ({ sequence: previous.sequence + 1, at, kind: 'celebrate', taskId }))
  }, [])
  useEffect(() => {
    const onClick = (event) => {
      if (event.button !== 0) return
      const at = performance.now()
      setTrigger((previous) => ({ sequence: previous.sequence + 1, at, kind: 'move', taskId: null }))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  const value = useMemo(() => ({ trigger, celebrate }), [trigger, celebrate])
  return <CatAnimationContext.Provider value={value}>{children}</CatAnimationContext.Provider>
}

export function useCatAnimationTrigger() { return useContext(CatAnimationContext).trigger }
export function useCelebrateTask() { return useContext(CatAnimationContext).celebrate }