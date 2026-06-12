import { isSupabaseConfigured } from '@/lib/supabase'
import { Icon } from '@/components/ui/Icon'

/** Shown when env vars are missing so the deploy isn't silently broken. */
export function ConfigBanner() {
  if (isSupabaseConfigured) return null
  return (
    <div className="flex items-center justify-center gap-1.5 border-b border-neon-amber/40 bg-neon-amber/10 px-4 py-2 text-center text-xs text-neon-amber">
      <Icon name="warning" size={14} className="shrink-0" /> Supabase is not configured. Set{' '}
      <code className="rounded bg-term-850 px-1">VITE_SUPABASE_URL</code> and{' '}
      <code className="rounded bg-term-850 px-1">VITE_SUPABASE_ANON_KEY</code> in your Netlify
      environment variables (see README).
    </div>
  )
}
