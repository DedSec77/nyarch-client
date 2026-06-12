// Cross-platform desktop/web push notifications.
//
// - On the web: the standard Notification API.
// - In the Tauri desktop client: the @tauri-apps/plugin-notification API if it
//   is bundled. We import it lazily and feature-detect so the web build never
//   pulls in Tauri code (and never crashes if the plugin is absent).

import { getItem, setItem } from './persist'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// The desktop client lists @tauri-apps/plugin-notification as a dependency; the
// web app does not. Using a runtime-computed specifier with @vite-ignore keeps
// Vite from trying to resolve/bundle it in the web build.
const TAURI_NOTIFY = '@tauri-apps/plugin-notification'
async function loadTauriNotify(): Promise<any | null> {
  try {
    return await import(/* @vite-ignore */ TAURI_NOTIFY)
  } catch {
    return null
  }
}

let permissionRequested = false

/** Ask for notification permission once (web + Tauri). Safe to call repeatedly. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionRequested) return true
  permissionRequested = true

  if (isTauri()) {
    const mod = await loadTauriNotify()
    if (mod) {
      try {
        let granted = await mod.isPermissionGranted()
        if (!granted) {
          const perm = await mod.requestPermission()
          granted = perm === 'granted'
        }
        return granted
      } catch {
        // plugin present but failed — fall through to web API
      }
    }
  }

  if (typeof Notification !== 'undefined') {
    try {
      if (Notification.permission === 'default') {
        const p = await Notification.requestPermission()
        return p === 'granted'
      }
      return Notification.permission === 'granted'
    } catch {
      return false
    }
  }
  return false
}

/** Fire a notification. No-op (logs) if permission is missing/unsupported. */
export async function pushNotify(title: string, body: string): Promise<void> {
  // Respect a user opt-out stored locally.
  if (getItem('nyarch.push.enabled') === 'false') {
    return
  }

  if (isTauri()) {
    const mod = await loadTauriNotify()
    if (mod) {
      try {
        const granted = await mod.isPermissionGranted()
        if (granted) {
          mod.sendNotification({ title, body })
          return
        }
      } catch {
        /* fall through to web */
      }
    }
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      // Don't spam while the tab is focused on the web.
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isTauri()) {
        return
      }
      new Notification(title, { body, icon: '/favicon.svg' })
    } catch {
      /* ignore */
    }
  }
}

export function pushEnabled(): boolean {
  return getItem('nyarch.push.enabled') !== 'false'
}

export function setPushEnabled(on: boolean) {
  setItem('nyarch.push.enabled', on ? 'true' : 'false')
  // Toggle background Web Push (browser) alongside the local opt-out. Imported
  // lazily so the desktop build never pulls in browser-only push code.
  if (on) {
    ensureNotificationPermission()
    import('./webpush')
      .then((m) => m.subscribeWebPush())
      .catch(() => {})
  } else {
    import('./webpush')
      .then((m) => m.unsubscribeWebPush())
      .catch(() => {})
  }
}
