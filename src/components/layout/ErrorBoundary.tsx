import { Component, type ErrorInfo, type ReactNode } from 'react'
import { removeItem } from '@/lib/persist'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time crashes so a thrown error shows a recoverable terminal
 * screen instead of a blank white page. The "reset session" button clears the
 * persisted auth/session keys (the usual culprit after a logout→login race) and
 * reloads, which gets the user unstuck without devtools.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the real cause in the console for debugging.
    console.error('[nyarch] render crash:', error, info)
  }

  private reload = () => {
    this.setState({ error: null })
    window.location.assign('/')
  }

  private resetSession = () => {
    // Clear anything that could carry a corrupt/partial auth state.
    try {
      for (const key of [
        'nyarch.auth',
        'nyarch.presence.visibility',
        'nyarch.push.enabled',
        'nyarch.update.dismissed',
      ]) {
        removeItem(key)
      }
      // Belt and suspenders: drop any leftover supabase keys too.
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('nyarch.') || k.startsWith('sb-'))
        .forEach((k) => window.localStorage.removeItem(k))
    } catch {
      /* ignore */
    }
    window.location.assign('/login')
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="scanlines flex min-h-screen items-center justify-center px-4">
        <div className="panel w-full max-w-lg p-6 font-mono">
          <div className="panel-header -mx-6 -mt-6 mb-4 rounded-t-lg px-6">
            <span className="tui-dots" />
            <span>~/error</span>
          </div>
          <p className="text-lg font-bold text-neon-red">$ segfault (core dumped)</p>
          <p className="mt-2 text-sm text-ink-dim">
            Что-то сломалось при отрисовке страницы. Чаще всего помогает
            перезагрузка; если нет — сбрось сессию и войди заново.
          </p>
          {this.state.error?.message && (
            <pre className="mt-3 max-h-32 overflow-auto rounded border border-term-700 bg-term-950/60 p-2 text-xs text-ink-faint">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={this.reload} className="btn btn-primary">
              ./reload
            </button>
            <button onClick={this.resetSession} className="btn btn-danger">
              reset session()
            </button>
          </div>
        </div>
      </div>
    )
  }
}
