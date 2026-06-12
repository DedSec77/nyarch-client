import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { persistentStorage } from '@/lib/persist'
import type { Profile } from '@/types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile((data as Profile) ?? null)
    } catch {
      // network / RLS hiccup shouldn't blank the app
      setProfile(null)
    }
  }

  useEffect(() => {
    let active = true
    // Read the persisted session. If getSession throws (rare: a transient error
    // in the storage layer) we must NOT sign the user out — a network blip or a
    // momentary read error would otherwise destroy a perfectly valid session
    // ("I can log in once, then never again"). We just continue and let
    // onAuthStateChange deliver the session a moment later.
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        setSession(data.session)
        if (data.session?.user) await loadProfile(data.session.user.id)
      } catch (err) {
        console.error('[nyarch] getSession failed (keeping any session):', err)
      } finally {
        if (active) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return
      setSession(newSession)
      if (newSession?.user) {
        await loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signUp(email: string, password: string) {
    // After clicking the confirmation link, send the user back to the app.
    // On the web this is the current origin (Netlify in prod, localhost in dev);
    // in the Tauri desktop client window.location.origin is a tauri:// URL that
    // email clients can't open, so fall back to the public site URL.
    const isTauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    const webOrigin =
      typeof window !== 'undefined' ? window.location.origin : undefined
    const emailRedirectTo = isTauri
      ? (import.meta.env.VITE_SITE_URL as string | undefined) ?? webOrigin
      : webOrigin

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    })
    return { error: error?.message ?? null }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    // mark offline before the session is torn down
    try {
      await supabase.rpc('go_offline')
    } catch {
      /* RPC may not exist yet; ignore */
    }
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
    // Hard-clear any persisted auth so a logout→login on the same page can't
    // leave a half-written token that crashes the next getSession() (white
    // screen after F5). persistentStorage mirrors to cookie + tauri store too.
    try {
      persistentStorage.removeItem('nyarch.auth')
    } catch {
      /* ignore */
    }
    setSession(null)
    setProfile(null)
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
