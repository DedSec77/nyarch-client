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
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

// Storage bucket names
export const BUCKET_AVATARS = 'avatars'
export const BUCKET_BANNERS = 'banners'
export const BUCKET_POSTS = 'post-images'
export const BUCKET_MESSAGES = 'message-images'
export const BUCKET_COMMENTS = 'comment-images'
