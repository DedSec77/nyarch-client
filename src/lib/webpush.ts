// Web Push (browser) — subscribe the Service Worker to push so notifications
// arrive even when the nyarch tab/site is closed.
//
// Requires a VAPID public key, exposed at build time as VITE_VAPID_PUBLIC_KEY.
// The matching private key lives only in the Supabase Edge Function secrets.
//
// All functions degrade gracefully: if push isn't supported, the key is
// missing, or permission is denied, they no-op and we fall back to the
// in-app/native notifications handled by push.ts.

import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Web Push only works in a real browser context with a Service Worker. */
export function webPushSupported(): boolean {
  return (
    !isTauri() &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  // Use a freshly allocated ArrayBuffer so the view is ArrayBuffer-backed
  // (not SharedArrayBuffer), satisfying the PushManager.subscribe types.
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function bufToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let registration: ServiceWorkerRegistration | null = null

/** Register (once) the Service Worker that receives push events. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!webPushSupported()) return null
  if (registration) return registration
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    return registration
  } catch (e) {
    console.warn('[webpush] SW registration failed', e)
    return null
  }
}

/**
 * Subscribe this browser to Web Push and persist the subscription server-side.
 * Safe to call repeatedly (idempotent). Returns true on success.
 */
export async function subscribeWebPush(): Promise<boolean> {
  if (!webPushSupported()) return false
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission()
    if (p !== 'granted') return false
  }

  const reg = await registerServiceWorker()
  if (!reg) return false

  try {
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    const endpoint = sub.endpoint
    const p256dh = json.keys?.p256dh ?? bufToBase64Url(sub.getKey('p256dh'))
    const auth = json.keys?.auth ?? bufToBase64Url(sub.getKey('auth'))
    if (!endpoint || !p256dh || !auth) return false

    const { error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    if (error) {
      console.warn('[webpush] save subscription failed', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[webpush] subscribe failed', e)
    return false
  }
}

/** Remove this browser's push subscription (called when the user turns push off). */
export async function unsubscribeWebPush(): Promise<void> {
  if (!webPushSupported()) return
  try {
    const reg = await registerServiceWorker()
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const endpoint = sub.endpoint
    await sub.unsubscribe().catch(() => {})
    try {
      await supabase.rpc('delete_push_subscription', { p_endpoint: endpoint })
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}
