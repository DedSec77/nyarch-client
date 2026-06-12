import { supabase } from './supabase'
import type { AppNotification } from '@/types'

export async function castVote(target: 'post' | 'comment', id: string, value: -1 | 1) {
  return supabase.rpc('cast_vote', { target_type: target, target_id: id, v: value })
}

export async function getOrCreateConversation(otherId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', { other_id: otherId })
  if (error) {
    console.error('conversation error', error)
    return null
  }
  return data as string
}

// ── Presence ───────────────────────────────────────────────
/** Heartbeat: mark the current user seen with a chosen visibility. */
export async function touchPresence(desired: 'online' | 'offline' = 'online') {
  try {
    await supabase.rpc('touch_presence', { desired })
  } catch {
    /* RPC may not exist until the migration runs; ignore */
  }
}

export async function goOffline() {
  try {
    await supabase.rpc('go_offline')
  } catch {
    /* ignore */
  }
}

export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('is_user_online', { p_id: userId })
    return Boolean(data)
  } catch {
    return false
  }
}

// ── Admin ──────────────────────────────────────────────────
export async function setAdmin(targetId: string, value: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_admin', { target: targetId, value })
  return { error: error?.message ?? null }
}

// ── Notifications ──────────────────────────────────────────
export async function getNotifications(limit = 50): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase.rpc('get_notifications', { p_limit: limit })
    if (error) return []
    return (data as AppNotification[]) ?? []
  } catch {
    return []
  }
}

export async function unreadNotificationCount(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('unread_notification_count')
    if (error) return 0
    return Number(data) || 0
  } catch {
    return 0
  }
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  try {
    await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null })
  } catch {
    /* ignore */
  }
}

// ── DM unread counters ──────────────────────────────────────

/** Total unread DM messages for the current user (navbar badge). */
export async function dmUnreadTotal(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('dm_unread_total')
    if (error) return 0
    return Number(data) || 0
  } catch {
    return 0
  }
}

/** Map of conversationId -> unread count (per-conversation badges). */
export async function dmUnreadByConversation(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase.rpc('dm_unread_by_conversation')
    if (error || !data) return {}
    const out: Record<string, number> = {}
    for (const row of data as { conversation_id: string; unread: number }[]) {
      out[row.conversation_id] = Number(row.unread) || 0
    }
    return out
  } catch {
    return {}
  }
}

/** Mark a conversation as read for the current user. */
export async function markConversationRead(conversationId: string): Promise<void> {
  try {
    await supabase.rpc('mark_conversation_read', { p_conv: conversationId })
  } catch {
    /* ignore */
  }
}
