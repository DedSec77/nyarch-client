import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Navbar } from './components/layout/Navbar'
import { ConfigBanner } from './components/layout/ConfigBanner'
import { UpdateBanner } from './components/layout/UpdateBanner'
import { FullSpinner } from './components/ui/Spinner'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PostPage } from './pages/PostPage'
import { SubmitPage } from './pages/SubmitPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { ThemeStorePage } from './pages/ThemeStorePage'
import { FriendsPage } from './pages/FriendsPage'
import { MessagesPage } from './pages/MessagesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { AdminPage } from './pages/AdminPage'
import type { ReactNode } from 'react'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <FullSpinner label="auth" />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />
  return <>{children}</>
}

/** Admin-only route guard. */
function AdminOnly({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <FullSpinner label="auth" />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!profile?.is_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <div className="scanlines min-h-screen">
      <ConfigBanner />
      <UpdateBanner />
      <Navbar />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        <Routes>
          {/* The only public route — everything else requires an account. */}
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <Protected>
                <HomePage />
              </Protected>
            }
          />
          <Route
            path="/post/:id"
            element={
              <Protected>
                <PostPage />
              </Protected>
            }
          />
          <Route
            path="/u/:username"
            element={
              <Protected>
                <ProfilePage />
              </Protected>
            }
          />
          <Route
            path="/submit"
            element={
              <Protected>
                <SubmitPage />
              </Protected>
            }
          />
          <Route
            path="/submit/:id"
            element={
              <Protected>
                <SubmitPage />
              </Protected>
            }
          />
          <Route
            path="/settings"
            element={
              <Protected>
                <SettingsPage />
              </Protected>
            }
          />
          <Route
            path="/themes"
            element={
              <Protected>
                <ThemeStorePage />
              </Protected>
            }
          />
          <Route
            path="/notifications"
            element={
              <Protected>
                <NotificationsPage />
              </Protected>
            }
          />
          <Route
            path="/friends"
            element={
              <Protected>
                <FriendsPage />
              </Protected>
            }
          />
          <Route
            path="/messages"
            element={
              <Protected>
                <MessagesPage />
              </Protected>
            }
          />
          <Route
            path="/messages/:conversationId"
            element={
              <Protected>
                <MessagesPage />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminOnly>
                <AdminPage />
              </AdminOnly>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

function NotFound() {
  return (
    <div className="panel mx-auto mt-10 max-w-md p-8 text-center">
      <p className="text-5xl font-bold text-neon-red">404</p>
      <p className="mt-3 font-mono text-ink-dim">
        <span className="text-neon-green">$</span> cat /page → No such file or directory
      </p>
    </div>
  )
}
