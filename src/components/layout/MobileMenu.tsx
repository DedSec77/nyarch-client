import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Icon, categoryIcon } from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { AdminBadge } from '@/components/ui/AdminBadge'
import type { Category } from '@/types'

/**
 * Slide-in drawer for phones / small screens. Holds search, the category list
 * and the main navigation — the desktop Navbar packs these inline, but they
 * don't fit on narrow viewports, so a burger menu collects them here.
 */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const [cats, setCats] = useState<Category[]>([])
  const [q, setQ] = useState('')
  const active = new URLSearchParams(loc.search).get('c')

  useEffect(() => {
    if (cats.length === 0) {
      supabase.rpc('get_categories').then(({ data }) => {
        if (data) setCats(data as Category[])
      })
    }
  }, [cats.length])

  // lock body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  function go(path: string) {
    navigate(path)
    onClose()
  }

  function search(e: React.FormEvent) {
    e.preventDefault()
    const t = q.trim()
    if (t.startsWith('@')) go(`/u/${t.slice(1)}`)
    else if (t) go(`/?q=${encodeURIComponent(t)}`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* drawer */}
      <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-term-700/70 bg-term-950 shadow-glow animate-fade-in">
        <div className="flex items-center justify-between border-b border-term-700/70 px-3 py-3">
          <span className="font-mono text-sm text-ink-dim">~/menu</span>
          <button onClick={onClose} className="text-ink-faint hover:text-neon-red" aria-label="close menu">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* search */}
          <form onSubmit={search} className="p-3">
            <div className="relative">
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

          {/* profile shortcut */}
          {profile && (
            <Link
              to={`/u/${profile.username}`}
              onClick={onClose}
              className="mx-3 mb-1 flex items-center gap-2.5 rounded-md border border-term-700/60 bg-term-850 p-2.5"
            >
              <Avatar src={profile.avatar_url} name={profile.display_name} size={36} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm text-ink">{profile.display_name}</span>
                  {profile.is_admin && <AdminBadge size="sm" />}
                </div>
                <span className="block truncate text-xs text-neon-green">@{profile.username}</span>
              </div>
            </Link>
          )}

          {/* nav links */}
          <nav className="px-3 py-1">
            {[
              { to: '/', icon: 'terminal', label: 'home' },
              { to: '/notifications', icon: 'mail', label: 'notifications' },
              { to: '/messages', icon: 'comment', label: 'messages' },
              { to: '/friends', icon: 'users', label: 'friends' },
              { to: '/themes', icon: 'palette', label: 'themes' },
              { to: '/settings', icon: 'gear', label: 'settings' },
              ...(profile?.is_admin ? [{ to: '/admin', icon: 'shield', label: 'admin' } as const] : []),
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-ink-dim hover:bg-term-800 hover:text-ink"
              >
                <Icon name={l.icon as never} size={16} /> {l.label}
              </Link>
            ))}
          </nav>

          {/* categories */}
          <div className="border-t border-term-700/60 px-3 py-2">
            <p className="px-2.5 py-1.5 text-xs text-ink-faint">~/categories</p>
            <Link
              to="/"
              onClick={onClose}
              className={`flex items-center gap-2 rounded px-2.5 py-2 text-sm ${
                !active ? 'bg-term-800 text-neon-green' : 'text-ink-dim hover:bg-term-800 hover:text-ink'
              }`}
            >
              <span className="text-neon-green">*</span> all
            </Link>
            {cats.map((c) => (
              <Link
                key={c.id}
                to={`/?c=${c.slug}`}
                onClick={onClose}
                className={`flex items-center gap-2 rounded px-2.5 py-2 text-sm ${
                  active === c.slug ? 'bg-term-800 text-ink' : 'text-ink-dim hover:bg-term-800 hover:text-ink'
                }`}
              >
                <Icon name={categoryIcon(c.slug)} size={15} className="mono-accent" style={{ color: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                {typeof c.post_count === 'number' && (
                  <span className="text-xs text-ink-faint">{c.post_count}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* footer actions */}
        <div className="border-t border-term-700/70 p-3">
          <button
            onClick={() => go('/submit')}
            className="btn btn-primary mb-2 w-full"
          >
            <Icon name="plus" size={15} /> new post
          </button>
          <button
            onClick={() => {
              onClose()
              signOut()
            }}
            className="btn btn-danger w-full"
          >
            exit()
          </button>
        </div>
      </div>
    </div>
  )
}
