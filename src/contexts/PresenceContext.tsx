import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { touchPresence, goOffline } from '@/lib/api'

type Visibility = 'online' | 'offline'

interface PresenceState {
  /** The user's chosen visibility (persisted locally). */
  visibility: Visibility
  setVisibility: (v: Visibility) => void
}

const PresenceContext = createContext<PresenceState | undefined>(undefined)

const HEARTBEAT_MS = 45_000
const LS_KEY = 'nyarch.presence.visibility'

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [visibility, setVis] = useState<Visibility>(() => {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    return v === 'offline' ? 'offline' : 'online'
  })
  const timer = useRef<ReturnType<typeof setInterval>>()
  const visRef = useRef<Visibility>(visibility)
  visRef.current = visibility

  const setVisibility = useCallback((v: Visibility) => {
    setVis(v)
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, v)
    touchPresence(v)
  }, [])

  useEffect(() => {
    if (!user) {
      clearInterval(timer.current)
      return
    }

    const beat = () => touchPresence(visRef.current)
    beat()
    timer.current = setInterval(beat, HEARTBEAT_MS)

    // when the tab regains focus, beat immediately
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVisible)

    // best-effort: mark offline when leaving (page unload always = offline)
    const onUnload = () => {
      try {
        void goOffline()
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('pagehide', onUnload)

    return () => {
      clearInterval(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('pagehide', onUnload)
    }
  }, [user])

  return (
    <PresenceContext.Provider value={{ visibility, setVisibility }}>
      {children}
    </PresenceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePresence() {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider')
  return ctx
}
