import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Friendship, Profile } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { FullSpinner } from '@/components/ui/Spinner'
import { getOrCreateConversation } from '@/lib/api'

interface FriendItem extends Friendship {
  other: Profile
}

export function FriendsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [incoming, setIncoming] = useState<FriendItem[]>([])
  const [outgoing, setOutgoing] = useState<FriendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Profile[]>([])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('friendships')
      .select(
        '*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)',
      )
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    const rows = (data as (Friendship & { requester: Profile; addressee: Profile })[]) ?? []
    const fr: FriendItem[] = []
    const inc: FriendItem[] = []
    const out: FriendItem[] = []
    rows.forEach((r) => {
      const other = r.requester_id === user.id ? r.addressee : r.requester
      const item = { ...r, other } as FriendItem
      if (r.status === 'accepted') fr.push(item)
      else if (r.addressee_id === user.id) inc.push(item)
      else out.push(item)
    })
    setFriends(fr)
    setIncoming(inc)
    setOutgoing(out)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const q = search.trim().replace(/^@/, '').toLowerCase()
    if (!q) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq('id', user!.id)
        .limit(8)
      setResults((data as Profile[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [search, user])

  async function accept(id: string) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
    load()
  }
  async function remove(id: string) {
    await supabase.from('friendships').delete().eq('id', id)
    load()
  }
  async function dm(otherId: string) {
    const convId = await getOrCreateConversation(otherId)
    if (convId) navigate(`/messages/${convId}`)
  }

  if (loading) return <FullSpinner label="friends" />

  const Row = ({ p, children }: { p: Profile; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-md border border-term-700/60 bg-term-850/40 p-2">
      <Link to={`/u/${p.username}`}>
        <Avatar src={p.avatar_url} name={p.display_name} size={40} />
      </Link>
      <Link to={`/u/${p.username}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{p.display_name}</p>
        <p className="truncate text-xs text-neon-green">@{p.username}</p>
      </Link>
      <div className="flex shrink-0 gap-1.5">{children}</div>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>~/friends/find</span>
        </div>
        <div className="p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            placeholder="grep users by @username or name…"
          />
          {results.length > 0 && (
            <div className="mt-2 space-y-2">
              {results.map((p) => (
                <Row key={p.id} p={p}>
                  <button onClick={() => dm(p.id)} className="btn btn-ghost py-1 text-xs">
                    <Icon name="mail" size={13} />
                  </button>
                  <Link to={`/u/${p.username}`} className="btn btn-primary py-1 text-xs">
                    view
                  </Link>
                </Row>
              ))}
            </div>
          )}
        </div>
      </div>

      {incoming.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="tui-dots" />
            <span className="text-neon-amber">~/friends/requests [{incoming.length}]</span>
          </div>
          <div className="space-y-2 p-3">
            {incoming.map((f) => (
              <Row key={f.id} p={f.other}>
                <button onClick={() => accept(f.id)} className="btn btn-primary py-1 text-xs">
                  <Icon name="check" size={13} /> accept
                </button>
                <button onClick={() => remove(f.id)} className="btn btn-danger py-1 text-xs">
                  <Icon name="close" size={13} />
                </button>
              </Row>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>~/friends [{friends.length}]</span>
        </div>
        <div className="space-y-2 p-3">
          {friends.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">No friends yet. Find someone above.</p>
          ) : (
            friends.map((f) => (
              <Row key={f.id} p={f.other}>
                <button onClick={() => dm(f.other.id)} className="btn btn-ghost py-1 text-xs">
                  <Icon name="mail" size={13} /> msg
                </button>
                <button onClick={() => remove(f.id)} className="btn btn-danger py-1 text-xs">
                  remove
                </button>
              </Row>
            ))
          )}
        </div>
      </div>

      {outgoing.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="tui-dots" />
            <span className="text-ink-faint">~/friends/sent [{outgoing.length}]</span>
          </div>
          <div className="space-y-2 p-3">
            {outgoing.map((f) => (
              <Row key={f.id} p={f.other}>
                <span className="flex items-center gap-1 px-2 text-xs text-ink-faint">
                  <Icon name="clock" size={12} /> pending
                </span>
                <button onClick={() => remove(f.id)} className="btn btn-ghost py-1 text-xs">
                  cancel
                </button>
              </Row>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
