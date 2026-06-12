/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GIPHY_API_KEY?: string
  // Web Push: VAPID public key (matching private key lives in the Edge Function).
  readonly VITE_VAPID_PUBLIC_KEY?: string
  // Public site URL (used by the desktop client for email confirmation links).
  readonly VITE_SITE_URL?: string
  // Desktop update check (injected from package.json by vite.config).
  readonly VITE_APP_VERSION?: string
  readonly VITE_DISABLE_UPDATE_CHECK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
