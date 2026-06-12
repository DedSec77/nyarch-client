import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'

export function Navbar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')

  function search(e: React.FormEvent) {
    e.preventDefault()
    const t = q.trim()
    if (t.startsWith('@')) navigate(`/u/${t.slice(1)}`)
    else if (t) navigate(`/?q=${encodeURIComponent(t)}`)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-term-700/70 bg-term-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-4">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        <form onSubmit={search} className="ml-2 hidden flex-1 sm:block">
          <div className="relative max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neon-green">
              $
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="grep posts or @users…"
              className="input pl-7"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-2">
          {profile ? (
            <>
              <Link to="/messages" className="btn btn-ghost px-2.5" title="messages">
                <Icon name="mail" size={15} className="text-neon-cyan" />
                <span className="hidden md:inline">msg</span>
              </Link>
              <Link to="/submit" className="btn btn-primary px-2.5">
                <Icon name="plus" size={15} />
                <span className="hidden md:inline">post</span>
              </Link>
              <div className="relative">
                <button
                  onClick={() => setMenu((m) => !m)}
                  className="flex items-center gap-2 rounded-md border border-term-700 bg-term-850 px-1.5 py-1 transition-colors hover:border-term-700 hover:bg-term-750"
                >
                  <Avatar src={profile.avatar_url} name={profile.display_name} size={26} />
                  <span className="hidden text-sm text-ink-dim md:inline">@{profile.username}</span>
                  <Icon name="chevron-down" size={14} className="text-ink-faint" />
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                    <div className="panel absolute right-0 z-50 mt-2 w-48 animate-fade-in p-1">
                      <Link
                        to={`/u/${profile.username}`}
                        onClick={() => setMenu(false)}
                        className="block rounded px-3 py-2 text-sm text-ink-dim hover:bg-term-800 hover:text-ink"
                      >
                        ~/profile
                      </Link>
                      <Link
                        to="/friends"
                        onClick={() => setMenu(false)}
                        className="block rounded px-3 py-2 text-sm text-ink-dim hover:bg-term-800 hover:text-ink"
                      >
                        ~/friends
                      </Link>
                      <Link
                        to="/themes"
                        onClick={() => setMenu(false)}
                        className="block rounded px-3 py-2 text-sm text-ink-dim hover:bg-term-800 hover:text-ink"
                      >
                        ~/themes
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setMenu(false)}
                        className="block rounded px-3 py-2 text-sm text-ink-dim hover:bg-term-800 hover:text-ink"
                      >
                        ~/settings
                      </Link>
                      <button
                        onClick={() => {
                          setMenu(false)
                          signOut()
                        }}
                        className="block w-full rounded px-3 py-2 text-left text-sm text-neon-red hover:bg-neon-red/10"
                      >
                        exit()
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              ./login
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
