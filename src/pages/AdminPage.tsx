import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { setAdmin } from '@/lib/api'
import type { Profile } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { AdminBadge } from '@/components/ui/AdminBadge'
import { Icon } from '@/components/ui/Icon'

export function AdminPage() {
  const { user, profile } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [stats, setStats] = useState<{ users: number; posts: number; comments: number } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function loadStats() {
    const [u, p, c] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('comments').select('*', { count: 'exact', head: true }),
    ])
    setStats({ users: u.count ?? 0, posts: p.count ?? 0, comments: c.count ?? 0 })
  }

  async function loadAdmins() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_admin', true)
      .order('username')
    setResults((data as Profile[]) ?? [])
  }

  useEffect(() => {
    loadStats()
    loadAdmins()
  }, [])

  async function search(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim().replace(/^@/, '').toLowerCase()
    if (!term) {
      loadAdmins()
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .limit(25)
    setResults((data as Profile[]) ?? [])
  }

  async function toggle(p: Profile) {
    setBusy(p.id)
    setMsg(null)
    const { error } = await setAdmin(p.id, !p.is_admin)
    setBusy(null)
    if (error) {
      setMsg(error)
      return
    }
    setResults((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_admin: !x.is_admin } : x)))
    setMsg(`${p.username} is now ${!p.is_admin ? 'an admin' : 'a regular user'}`)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span className="flex items-center gap-1.5">
            <Icon name="shield" size={13} /> ~/admin
          </span>
          <span className="ml-auto text-xs text-neon-amber">root@{profile?.username}</span>
        </div>

        <div className="space-y-4 p-4">
          {/* stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              ['users', stats?.users],
              ['posts', stats?.posts],
              ['comments', stats?.comments],
            ].map(([label, v]) => (
              <div key={label} className="rounded-md border border-term-700 bg-term-850 p-3 text-center">
                <p className="text-lg font-bold text-neon-green tabular-nums">{v ?? '—'}</p>
                <p className="text-xs text-ink-faint">{label}</p>
              </div>
            ))}
          </div>

          {/* user search / role management */}
          <div>
            <form onSubmit={search} className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="search users by @username or name…"
                className="input"
              />
              <button type="submit" className="btn btn-ghost shrink-0">
                <Icon name="search" size={14} /> find
              </button>
            </form>
            {msg && <p className="mt-2 text-xs text-neon-green">{msg}</p>}

            <p className="mb-1 mt-3 text-xs text-ink-faint">
              {q.trim() ? 'search results' : 'current admins'}
            </p>
            <ul className="space-y-1">
              {results.length === 0 && (
                <li className="py-4 text-center text-xs text-ink-faint">no users</li>
              )}
              {results.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-md border border-term-700/60 bg-term-850 p-2"
                >
                  <Avatar src={p.avatar_url} name={p.display_name} size={32} />
                  <Link to={`/u/${p.username}`} className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate text-sm text-ink">
                      {p.display_name}
                      {p.is_admin && <AdminBadge size="sm" />}
                    </span>
                    <span className="block truncate text-xs text-neon-green">@{p.username}</span>
                  </Link>
                  {p.id !== user?.id ? (
                    <button
                      onClick={() => toggle(p)}
                      disabled={busy === p.id}
                      className={`btn shrink-0 py-1 text-xs ${p.is_admin ? 'btn-danger' : 'btn-primary'}`}
                    >
                      {busy === p.id ? '…' : p.is_admin ? 'revoke admin' : 'make admin'}
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-ink-faint">you</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-ink-faint">
            // Admins can delete any post or comment directly from the thread. Granting admin is
            enforced server-side (RLS + SECURITY DEFINER), so this panel only works for real admins.
          </p>
        </div>
      </div>
    </div>
  )
}
