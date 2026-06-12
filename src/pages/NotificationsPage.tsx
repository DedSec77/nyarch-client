import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AppNotification, NotificationKind } from '@/types'
import { getNotifications, markNotificationsRead } from '@/lib/api'
import { useNotifications } from '@/contexts/NotificationContext'
import { Avatar } from '@/components/ui/Avatar'
import { Icon, type IconName } from '@/components/ui/Icon'
import { FullSpinner } from '@/components/ui/Spinner'
import { timeAgo } from '@/lib/utils'

function describe(n: AppNotification): { icon: IconName; text: string; color: string } {
  const who = n.actor_display_name || (n.actor_username ? '@' + n.actor_username : 'someone')
  switch (n.kind as NotificationKind) {
    case 'vote_post':
      return { icon: 'arrow-up', color: 'text-neon-green', text: `${who} upvoted your post` }
    case 'vote_comment':
      return { icon: 'arrow-up', color: 'text-neon-green', text: `${who} upvoted your comment` }
    case 'comment':
      return { icon: 'comment', color: 'text-neon-cyan', text: `${who} commented on your post` }
    case 'reply':
      return { icon: 'reply', color: 'text-neon-cyan', text: `${who} replied to your comment` }
    case 'friend_request':
      return { icon: 'users', color: 'text-neon-amber', text: `${who} sent you a friend request` }
    case 'friend_accept':
      return { icon: 'check', color: 'text-neon-green', text: `${who} accepted your friend request` }
    case 'unread_dm':
      return { icon: 'mail', color: 'text-neon-magenta', text: `${who} sent you message(s) you haven't read` }
    default:
      return { icon: 'note', color: 'text-ink-dim', text: 'notification' }
  }
}

function linkFor(n: AppNotification): string {
  if (n.kind === 'unread_dm' && n.conversation_id) return `/messages/${n.conversation_id}`
  if (n.kind === 'friend_request' || n.kind === 'friend_accept') {
    return n.actor_username ? `/u/${n.actor_username}` : '/friends'
  }
  if (n.post_id) return `/post/${n.post_id}`
  return '#'
}

export function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { refresh } = useNotifications()

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const data = await getNotifications(80)
      setItems(data)
      setLoading(false)
      // mark all read on open
      await markNotificationsRead()
      refresh()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function clearAll() {
    await markNotificationsRead()
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    refresh()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span className="flex items-center gap-1.5">
            <Icon name="mail" size={13} /> ~/notifications
          </span>
          {items.length > 0 && (
            <button onClick={clearAll} className="ml-auto text-xs text-ink-faint hover:text-neon-green">
              mark all read
            </button>
          )}
        </div>

        <div className="p-2">
          {loading ? (
            <FullSpinner label="notifications" />
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-faint">
              <span className="text-neon-green">$</span> inbox zero — nothing here yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((n) => {
                const d = describe(n)
                const href = linkFor(n)
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => href !== '#' && navigate(href)}
                      className={`flex w-full items-center gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-term-800 ${
                        n.read ? '' : 'bg-term-850/60'
                      }`}
                    >
                      <span className="relative shrink-0">
                        <Avatar src={n.actor_avatar_url} name={n.actor_display_name ?? '?'} size={34} />
                        <span
                          className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-term-900 bg-term-850 ${d.color}`}
                        >
                          <Icon name={d.icon} size={10} />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{d.text}</span>
                        {n.post_title && (
                          <span className="block truncate text-xs text-ink-faint">“{n.post_title}”</span>
                        )}
                      </span>
                      <span className="shrink-0 text-[10px] text-ink-faint">{timeAgo(n.created_at)}</span>
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-neon-green" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-ink-faint">
        Manage delivery in <Link to="/settings" className="link">settings</Link>.
      </p>
    </div>
  )
}
