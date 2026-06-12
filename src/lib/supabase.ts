import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Surfaced in the UI via <ConfigBanner/>; we still create a stub so imports don't crash.
  console.warn(
    '[nyarch] Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      // Keep the user signed in across reloads / app restarts. Supabase stores
      // the session in localStorage by default, which persists in the browser
      // and in the Tauri WebView, so users don't have to log in every time.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'nyarch.auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  },
)

// Storage bucket names
export const BUCKET_AVATARS = 'avatars'
export const BUCKET_BANNERS = 'banners'
export const BUCKET_POSTS = 'post-images'
export const BUCKET_MESSAGES = 'message-images'
export const BUCKET_COMMENTS = 'comment-images'
