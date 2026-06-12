import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
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
  const { unread, dmUnread } = useNotifications()
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

  // close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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

  // Render through a portal into <body>. The Navbar <header> uses backdrop-blur,
  // which creates a containing block that breaks `position: fixed` for any child
  // — the drawer would otherwise anchor to the 56px-tall header instead of the
  // viewport, sticking it to the top-left. The portal escapes that header.
  return createPortal(
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />

      {/* drawer — solid panel that truly slides in from the left.
          Regions are absolutely positioned (header top, footer bottom, scroll
          area fills the gap) so the middle can NEVER collapse to zero height,
          which flex-1 + min-h-0 can do on some mobile WebKit/Chrome engines. */}
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] border-r border-term-700/70 bg-term-950 shadow-2xl will-change-transform animate-slide-in-left">
        <div className="absolute inset-x-0 top-0 z-10 flex h-[52px] items-center justify-between border-b border-term-700/70 bg-term-900 px-3">
          <span className="font-mono text-sm text-ink-dim">
            <span className="text-neon-green">$</span> ~/menu
          </span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-ink-faint hover:bg-term-800 hover:text-neon-red"
            aria-label="close menu"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-[116px] top-[52px] overflow-y-auto overscroll-contain">
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
              { to: '/', icon: 'terminal', label: 'home', badge: 0 },
              { to: '/notifications', icon: 'mail', label: 'notifications', badge: unread },
              { to: '/messages', icon: 'comment', label: 'messages', badge: dmUnread },
              { to: '/friends', icon: 'users', label: 'friends', badge: 0 },
              { to: '/themes', icon: 'palette', label: 'themes', badge: 0 },
              { to: '/settings', icon: 'gear', label: 'settings', badge: 0 },
              ...(profile?.is_admin
                ? [{ to: '/admin', icon: 'shield', label: 'admin', badge: 0 } as const]
                : []),
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={onClose}
                className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-ink-dim hover:bg-term-800 hover:text-ink"
              >
                <Icon name={l.icon as never} size={16} />
                <span className="flex-1">{l.label}</span>
                {l.badge > 0 && (
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-neon-red px-1 text-[10px] font-bold text-term-950">
                    {l.badge > 99 ? '99+' : l.badge}
                  </span>
                )}
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
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-term-700/70 bg-term-950 p-3">
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
    </div>,
    document.body,
  )
}
