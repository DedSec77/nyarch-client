import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { Logo } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { AdminBadge } from '@/components/ui/AdminBadge'
import { MobileMenu } from './MobileMenu'

export function Navbar() {
  const { profile, signOut } = useAuth()
  const { unread, dmUnread } = useNotifications()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [q, setQ] = useState('')

  function search(e: React.FormEvent) {
    e.preventDefault()
    const t = q.trim()
    if (t.startsWith('@')) navigate(`/u/${t.slice(1)}`)
    else if (t) navigate(`/?q=${encodeURIComponent(t)}`)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-term-700/70 bg-term-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        {/* desktop search */}
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

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {profile ? (
            <>
              {/* notifications bell */}
              <Link
                to="/notifications"
                className="btn btn-ghost relative px-2.5"
                title="notifications"
              >
                <Icon name="mail" size={15} className="text-neon-amber" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-neon-red px-1 text-[10px] font-bold text-term-950">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>

              <Link to="/messages" className="btn btn-ghost relative px-2.5" title="messages">
                <Icon name="comment" size={15} className="text-neon-cyan" />
                <span className="hidden md:inline">msg</span>
                {dmUnread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-neon-red px-1 text-[10px] font-bold text-term-950">
                    {dmUnread > 99 ? '99+' : dmUnread}
                  </span>
                )}
              </Link>
              <Link to="/submit" className="btn btn-primary hidden px-2.5 lg:inline-flex" title="new post">
                <Icon name="plus" size={15} />
                <span className="hidden md:inline">post</span>
              </Link>

              {/* mobile / tablet: tapping the avatar opens the full burger drawer
                  (search, profile, nav, categories, new post, exit) */}
              <button
                onClick={() => setDrawer(true)}
                className="relative flex items-center gap-1.5 rounded-md border border-term-700 bg-term-850 px-1.5 py-1 transition-colors hover:bg-term-750 lg:hidden"
                aria-label="open menu"
              >
                <Avatar src={profile.avatar_url} name={profile.display_name} size={26} />
                <Icon name="hash" size={14} className="text-ink-faint" />
                {unread + dmUnread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-neon-red px-1 text-[10px] font-bold text-term-950">
                    {unread + dmUnread > 99 ? '99+' : unread + dmUnread}
                  </span>
                )}
              </button>

              {/* avatar dropdown (desktop only — mobile/tablet use the burger drawer) */}
              <div className="relative hidden lg:block">
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
                    <div className="absolute right-0 z-50 mt-2 w-52 animate-fade-in rounded-lg border border-term-700 bg-term-900 p-1 shadow-glow">
                      <div className="flex items-center gap-2 border-b border-term-700/60 px-3 py-2">
                        <span className="truncate text-sm text-ink">{profile.display_name}</span>
                        {profile.is_admin && <AdminBadge size="sm" />}
                      </div>
                      <Link to={`/u/${profile.username}`} onClick={() => setMenu(false)} className="menu-item">
                        ~/profile
                      </Link>
                      <Link to="/notifications" onClick={() => setMenu(false)} className="menu-item">
                        ~/notifications {unread > 0 && <span className="text-neon-red">({unread})</span>}
                      </Link>
                      <Link to="/friends" onClick={() => setMenu(false)} className="menu-item">
                        ~/friends
                      </Link>
                      <Link to="/themes" onClick={() => setMenu(false)} className="menu-item">
                        ~/themes
                      </Link>
                      <Link to="/settings" onClick={() => setMenu(false)} className="menu-item">
                        ~/settings
                      </Link>
                      {profile.is_admin && (
                        <Link to="/admin" onClick={() => setMenu(false)} className="menu-item text-neon-amber">
                          ~/admin
                        </Link>
                      )}
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

      <MobileMenu open={drawer} onClose={() => setDrawer(false)} />
    </header>
  )
}
