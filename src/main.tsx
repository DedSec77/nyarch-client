import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PresenceProvider } from './contexts/PresenceContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import App from './App'
import './index.css'
import { hydrateFromTauriStore } from './lib/persist'

// Register the service worker for PWA install + offline. This is independent of
// Web Push (which also uses /sw.js but only when a VAPID key is configured), so
// the app stays installable even without push set up. Skipped inside the Tauri
// desktop shell, which is already a native app.
function registerPwa() {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  if (isTauri) return
  if (!('serviceWorker' in navigator)) return

  // NEVER register the SW in dev. A caching service worker hijacks requests and
  // serves a stale app shell, which silently breaks Vite HMR ("my changes don't
  // show up"). PWA install only matters for the deployed production build.
  if (!import.meta.env.PROD) {
    // Also actively unregister any SW + drop its caches left over from a prior
    // dev session, so the browser stops serving stale bundles immediately.
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((r) => r.unregister())
    }).catch(() => {})
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
    }
    return
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
      console.warn('[nyarch] service worker registration failed', e)
    })
  })
}

function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <PresenceProvider>
                <NotificationProvider>
                  <App />
                </NotificationProvider>
              </PresenceProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

// On the desktop, restore any persisted data from the on-disk store into
// localStorage BEFORE mounting, so Supabase can read a saved session even if
// the WebView cleared localStorage between launches. Instant no-op on the web.
hydrateFromTauriStore().finally(() => {
  mount()
  registerPwa()
})
