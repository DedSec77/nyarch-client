import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PresenceProvider } from './contexts/PresenceContext'
import { NotificationProvider } from './contexts/NotificationContext'
import App from './App'
import './index.css'
import { hydrateFromTauriStore } from './lib/persist'

function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
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
    </React.StrictMode>,
  )
}

// On the desktop, restore any persisted data from the on-disk store into
// localStorage BEFORE mounting, so Supabase can read a saved session even if
// the WebView cleared localStorage between launches. Instant no-op on the web.
hydrateFromTauriStore().finally(mount)
