import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { getNotifications, unreadNotificationCount } from '@/lib/api'
import { pushNotify, ensureNotificationPermission } from '@/lib/push'
import type { AppNotification } from '@/types'

interface NotificationState {
  unread: number
  refresh: () => void
}

const NotificationContext = createContext<NotificationState | undefined>(undefined)

const POLL_MS = 45_000

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)
  const lastSeenId = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval>>()

  const refresh = useCallback(async () => {
    if (!user) {
      setUnread(0)
      return
    }
    const count = await unreadNotificationCount()
    setUnread(count)
  }, [user])

  // Detect brand-new notifications (for push) by polling the latest row id.
  const pollNew = useCallback(async () => {
    if (!user) return
    const items = await getNotifications(10)
    if (items.length === 0) return
    const newest = items[0]
    if (lastSeenId.current === null) {
      // first run after login: don't replay history as push
      lastSeenId.current = newest.id
      return
    }
    if (newest.id !== lastSeenId.current) {
      // find all items newer than the last seen and push them
      const idx = items.findIndex((i) => i.id === lastSeenId.current)
      const fresh = idx === -1 ? items : items.slice(0, idx)
      fresh.filter((i) => !i.read).forEach(firePush)
      lastSeenId.current = newest.id
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setUnread(0)
      lastSeenId.current = null
      return
    }
    ensureNotificationPermission()
    refresh()
    pollNew()

    // realtime: a row inserted for me -> bump + push immediately
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refresh()
          pollNew()
        },
      )
      .subscribe()

    // DM push: like a messenger, an incoming message fires a push immediately
    // but does NOT create a notifications-tab entry (the 6h digest does that).
    const dmChannel = supabase
      .channel(`dm-push:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as { sender_id: string; conversation_id: string; body: string | null; is_gif: boolean; image_url: string | null }
          if (msg.sender_id === user.id) return // my own message
          // confirm I'm a participant (RLS already restricts, but be safe)
          const { data } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', msg.conversation_id)
            .maybeSingle()
          if (!data) return
          const preview = msg.body ? msg.body : msg.is_gif ? 'sent a GIF' : msg.image_url ? 'sent a photo' : 'new message'
          pushNotify('nyarch — new message', preview)
        },
      )
      .subscribe()

    timer.current = setInterval(() => {
      refresh()
      pollNew()
    }, POLL_MS)

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(dmChannel)
      clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <NotificationContext.Provider value={{ unread, refresh }}>{children}</NotificationContext.Provider>
  )
}

function firePush(n: AppNotification) {
  const who = n.actor_display_name || (n.actor_username ? '@' + n.actor_username : 'someone')
  const map: Record<string, string> = {
    vote_post: `${who} upvoted your post`,
    vote_comment: `${who} upvoted your comment`,
    comment: `${who} commented on your post`,
    reply: `${who} replied to your comment`,
    friend_request: `${who} sent you a friend request`,
    friend_accept: `${who} accepted your friend request`,
    unread_dm: `${who} sent you a message`,
  }
  pushNotify('nyarch', map[n.kind] ?? 'New activity')
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
