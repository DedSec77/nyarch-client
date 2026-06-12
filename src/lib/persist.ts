// Durable key/value persistence for nyarch.
//
// Why not just localStorage? In some environments (Tauri's WebKitGTK WebView,
// privacy modes, aggressive cache clearing) localStorage can be wiped between
// runs. This layer writes to MULTIPLE backends and reads back from whichever
// still has the value:
//
//   * localStorage         — fast, primary on the web.
//   * a long-lived cookie  — survives localStorage wipes on the web.
//   * a Tauri store file   — survives WebView data clears on the desktop.
//
// The result: the auth session and user settings survive reloads, tab closes
// and app restarts everywhere.
//
// All keys are namespaced "nyarch.*". Values are plain strings (JSON is the
// caller's concern).

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year, in seconds

function canUseDOM(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ── cookies ────────────────────────────────────────────────
function readCookie(name: string): string | null {
  if (!canUseDOM()) return null
  const prefix = encodeURIComponent(name) + '='
  const parts = document.cookie ? document.cookie.split('; ') : []
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length))
      } catch {
        return part.slice(prefix.length)
      }
    }
  }
  return null
}

function writeCookie(name: string, value: string) {
  if (!canUseDOM()) return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}` +
    `; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

function deleteCookie(name: string) {
  if (!canUseDOM()) return
  document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax`
}

// Cookies have a ~4KB-per-cookie limit. Auth tokens can exceed that, so only
// mirror reasonably small values into cookies; large ones stay in localStorage.
const COOKIE_SIZE_LIMIT = 3500

// Keys that must NEVER be mirrored to cookies. The Supabase auth token is the
// big one: it can sit right at the cookie size limit, where the browser
// silently truncates it. A truncated token is invalid JSON, so Supabase treats
// the session as absent and logs the user out — the classic "I can log in once
// then never again" bug. The token lives safely in localStorage (web) and the
// Tauri store file (desktop); cookies are only a fallback for SMALL settings.
function isCookieExcluded(key: string): boolean {
  return key === 'nyarch.auth' || key.startsWith('sb-')
}

// ── Tauri store (desktop only) ─────────────────────────────
// Lazily loaded so the web build never bundles Tauri code. We keep a single
// store file "nyarch.json" in the app data dir. Reads are async, so on startup
// we hydrate everything into localStorage (see hydrateFromTauriStore) and serve
// synchronous getItem() from localStorage thereafter.
const TAURI_STORE_SPEC = '@tauri-apps/plugin-store'
const STORE_FILE = 'nyarch.json'
let tauriStorePromise: Promise<any | null> | null = null

async function getTauriStore(): Promise<any | null> {
  if (!isTauri()) return null
  if (!tauriStorePromise) {
    tauriStorePromise = (async () => {
      try {
        const mod: any = await import(/* @vite-ignore */ TAURI_STORE_SPEC)
        // plugin-store v2: load(path) returns a Store instance
        if (typeof mod.load === 'function') return await mod.load(STORE_FILE)
        if (mod.Store && typeof mod.Store.load === 'function') return await mod.Store.load(STORE_FILE)
        return null
      } catch {
        return null
      }
    })()
  }
  return tauriStorePromise
}

function tauriStoreSet(key: string, value: string) {
  if (!isTauri()) return
  getTauriStore()
    .then(async (store) => {
      if (!store) return
      await store.set(key, value)
      await store.save?.()
    })
    .catch(() => {})
}

function tauriStoreDelete(key: string) {
  if (!isTauri()) return
  getTauriStore()
    .then(async (store) => {
      if (!store) return
      await store.delete?.(key)
      await store.save?.()
    })
    .catch(() => {})
}

/**
 * Copy everything from the on-disk Tauri store into localStorage so the
 * synchronous getItem() below (and Supabase's synchronous auth storage) can see
 * persisted values after a WebView data clear. Call ONCE before the app reads
 * its session. No-op on the web.
 */
export async function hydrateFromTauriStore(): Promise<void> {
  if (!isTauri()) return
  try {
    const store = await getTauriStore()
    if (!store) return
    const entries: [string, unknown][] = await store.entries()
    for (const [key, value] of entries) {
      if (typeof value !== 'string') continue
      // Only fill gaps — never clobber a fresher localStorage value.
      try {
        if (window.localStorage.getItem(key) === null) {
          window.localStorage.setItem(key, value)
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

// ── public API ─────────────────────────────────────────────
export function getItem(key: string): string | null {
  // Prefer localStorage (fast, larger). The cookie fallback is only for small
  // settings; the auth token is localStorage/Tauri-store only, so reading a
  // stale/truncated cookie can never resurrect a broken session.
  try {
    if (canUseDOM()) {
      const ls = window.localStorage.getItem(key)
      if (ls !== null) return ls
    }
  } catch {
    /* localStorage blocked — fall through to cookie */
  }
  if (isCookieExcluded(key)) return null
  return readCookie(key)
}

export function setItem(key: string, value: string): void {
  try {
    if (canUseDOM()) window.localStorage.setItem(key, value)
  } catch {
    /* ignore quota / privacy errors */
  }
  // Mirror to a cookie so the value survives a localStorage wipe (web) — but
  // never the auth token (see isCookieExcluded above).
  if (!isCookieExcluded(key) && value.length <= COOKIE_SIZE_LIMIT) {
    writeCookie(key, value)
  } else {
    // Too large / excluded; make sure we don't keep a stale small copy.
    deleteCookie(key)
  }
  // Mirror to the Tauri store file so it survives WebView clears (desktop).
  tauriStoreSet(key, value)
}

export function removeItem(key: string): void {
  try {
    if (canUseDOM()) window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  deleteCookie(key)
  tauriStoreDelete(key)
}

/**
 * A Web Storage-shaped object backed by the multi-backend persistence layer.
 * Used as Supabase's auth `storage` so the login session persists everywhere.
 */
export const persistentStorage = {
  getItem,
  setItem,
  removeItem,
}
