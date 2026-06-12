import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { mapPost, type RawPostRow } from '@/hooks/usePosts'
import type { Post, Profile, Friendship } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { AdminBadge } from '@/components/ui/AdminBadge'
import { OnlineDot, PresenceAvatar } from '@/components/ui/OnlineDot'
import { FullSpinner } from '@/components/ui/Spinner'
import { PostCard } from '@/components/forum/PostCard'
import { getOrCreateConversation } from '@/lib/api'
import { useUserPresence } from '@/hooks/usePresence'
import { timeAgo, extractPalette, accentFor } from '@/lib/utils'

type FriendUI = 'none' | 'pending_out' | 'pending_in' | 'friends' | 'self'

export function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [friendState, setFriendState] = useState<FriendUI>('none')
  const [friendRow, setFriendRow] = useState<Friendship | null>(null)
  const [friendCount, setFriendCount] = useState(0)
  const [palette, setPalette] = useState<string[] | null>(null)
  const online = useUserPresence(profile?.id)

  const loadFriendState = useCallback(
    async (profileId: string) => {
      const { count } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
        .eq('status', 'accepted')
      setFriendCount(count ?? 0)

      if (!user || user.id === profileId) {
        setFriendState(user?.id === profileId ? 'self' : 'none')
        return
      }
      const { data } = await supabase
        .from('friendships')
        .select('*')
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${user.id})`,
        )
        .maybeSingle()
      const row = data as Friendship | null
      setFriendRow(row)
      if (!row) setFriendState('none')
      else if (row.status === 'accepted') setFriendState('friends')
      else if (row.requester_id === user.id) setFriendState('pending_out')
      else setFriendState('pending_in')
    },
    [user],
  )

  useEffect(() => {
    if (!username) return
    setLoading(true)
    ;(async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle()
      const p = prof as Profile | null
      setProfile(p)
      setPalette(null)
      if (p?.banner_url) {
        extractPalette(p.banner_url, 4).then((cols) => {
          if (cols && cols.length) setPalette(cols)
        })
      }
      if (p) {
        const { data } = await supabase.rpc('get_user_posts', { p_username: username })
        setPosts(((data as RawPostRow[]) ?? []).map(mapPost))
        await loadFriendState(p.id)
      }
      setLoading(false)
    })()
  }, [username, loadFriendState])

  async function addFriend() {
    if (!user || !profile) return
    await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: profile.id,
      status: 'pending',
    })
    setFriendState('pending_out')
  }

  async function acceptFriend() {
    if (!friendRow) return
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendRow.id)
    setFriendState('friends')
    setFriendCount((c) => c + 1)
  }

  async function removeFriend() {
    if (!friendRow) return
    await supabase.from('friendships').delete().eq('id', friendRow.id)
    setFriendState('none')
    setFriendRow(null)
  }

  async function message() {
    if (!profile) return
    const convId = await getOrCreateConversation(profile.id)
    if (convId) navigate(`/messages/${convId}`)
  }

  function applyVote(postId: string, v: -1 | 1) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        const was = p.my_vote ?? 0
        const next = was === v ? 0 : v
        return { ...p, my_vote: next as -1 | 0 | 1, score: (p.score ?? 0) + (next - was) }
      }),
    )
  }

  if (loading) return <FullSpinner label="loading profile" />
  if (!profile)
    return (
      <div className="panel mx-auto max-w-md p-8 text-center text-ink-dim">
        <span className="text-neon-green">$</span> whoami → user not found
      </div>
    )

  // Colors for the animated seam: taken from the banner, else an accent from the handle.
  const seamColors =
    palette && palette.length >= 2
      ? palette
      : palette && palette.length === 1
        ? [palette[0], accentFor(profile.username)]
        : [accentFor(profile.username), accentFor(profile.display_name || profile.username)]
  // looped gradient (repeat the first color at the end for seamless animation)
  const seamGradient = `linear-gradient(90deg, ${[...seamColors, seamColors[0]].join(', ')})`

  return (
    <div className="mx-auto max-w-3xl">
      <div className="panel overflow-hidden">
        {/* banner */}
        <div
          className="relative h-36 grid-bg bg-term-850 sm:h-44"
          style={
            profile.banner_url
              ? { backgroundImage: `url(${profile.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {/* smooth banner fade into the panel background */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-term-900 via-term-900/55 to-transparent" />
          {/* animated seam bar: colors taken from the banner/gif, gently shifting */}
          <div
            className="seam-bar pointer-events-none absolute inset-x-0 bottom-0 h-0.5 animate-seam-shift"
            style={{ backgroundImage: seamGradient, backgroundSize: '200% 100%' }}
          />
        </div>

        <div className="relative z-10 px-4 pb-4">
          <div className="-mt-8 flex items-end gap-3">
            <div className="rounded-lg border-2 border-term-900 bg-term-900">
              <PresenceAvatar online={online} dotSize={14}>
                <Avatar src={profile.avatar_url} name={profile.display_name} size={80} />
              </PresenceAvatar>
            </div>
            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-ink">{profile.display_name}</h1>
                {profile.is_admin && <AdminBadge />}
              </div>
              <p className="flex items-center gap-2 text-sm text-neon-green">
                @{profile.username}
                <OnlineDot online={online} withLabel size={7} className="text-xs font-normal" />
              </p>
            </div>
          </div>

          {profile.bio && <p className="mt-3 whitespace-pre-wrap text-sm text-ink-dim">{profile.bio}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-faint">
            <span className="flex items-center gap-1">
              <Icon name="calendar" size={13} /> joined {timeAgo(profile.created_at)} ago
            </span>
            <span className="flex items-center gap-1">
              <Icon name="users" size={13} /> {friendCount} friends
            </span>
            <span className="flex items-center gap-1">
              <Icon name="note" size={13} /> {posts.length} posts
            </span>
          </div>

          {/* actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {friendState === 'self' && (
              <Link to="/settings" className="btn btn-ghost">
                <Icon name="edit" size={14} /> edit profile
              </Link>
            )}
            {friendState === 'none' && user && (
              <button onClick={addFriend} className="btn btn-primary">
                <Icon name="plus" size={14} /> add friend
              </button>
            )}
            {friendState === 'pending_out' && (
              <button onClick={removeFriend} className="btn btn-ghost">
                <Icon name="clock" size={14} /> request sent (cancel)
              </button>
            )}
            {friendState === 'pending_in' && (
              <>
                <button onClick={acceptFriend} className="btn btn-primary">
                  <Icon name="check" size={14} /> accept
                </button>
                <button onClick={removeFriend} className="btn btn-danger">
                  <Icon name="close" size={14} /> decline
                </button>
              </>
            )}
            {friendState === 'friends' && (
              <button onClick={removeFriend} className="btn btn-ghost">
                <Icon name="check" size={14} /> friends (remove)
              </button>
            )}
            {user && friendState !== 'self' && (
              <button onClick={message} className="btn btn-ghost">
                <Icon name="mail" size={14} /> message
              </button>
            )}
            {!user && (
              <Link to="/login" className="btn btn-ghost">
                log in to interact
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="panel mt-3">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>~/u/{profile.username}/posts</span>
        </div>
        <div className="space-y-3 p-3">
          {posts.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">No posts yet.</p>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} onVote={applyVote} />)
          )}
        </div>
      </div>
    </div>
  )
}
