import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/ui/Logo'
import { Icon } from '@/components/ui/Icon'

export function LoginPage() {
  const { signIn, signUp, user } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const fn = mode === 'login' ? signIn : signUp
    const { error } = await fn(email.trim(), password)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    if (mode === 'signup') {
      setInfo('Account created. If email confirmation is on, check your inbox; otherwise log in.')
      setMode('login')
      return
    }
    const from = (loc.state as { from?: string })?.from || '/'
    navigate(from, { replace: true })
  }

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center px-2 py-8">
      <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center gap-3">
        <Logo size={48} withText={false} />
        <h1 className="font-mono text-2xl font-extrabold">
          ny<span className="text-neon-green">arch</span>
        </h1>
        <p className="text-sm text-ink-dim">a terminal IT forum</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>~/auth — {mode === 'login' ? 'sign in' : 'sign up'}</span>
        </div>
        <form onSubmit={submit} className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="hacker@nyarch.dev"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-neon-red">
              <Icon name="close" size={14} /> {error}
            </p>
          )}
          {info && (
            <p className="flex items-start gap-1.5 text-sm text-neon-green">
              <Icon name="check" size={14} className="mt-0.5 shrink-0" /> {info}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? 'processing…' : mode === 'login' ? './login' : './register'}
          </button>
        </form>
        <div className="border-t border-term-700/60 px-4 py-3 text-center text-sm text-ink-dim">
          {mode === 'login' ? 'no account?' : 'already have an account?'}{' '}
          <button
            onClick={() => {
              setMode((m) => (m === 'login' ? 'signup' : 'login'))
              setError(null)
              setInfo(null)
            }}
            className="link"
          >
            {mode === 'login' ? 'register →' : '← login'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
