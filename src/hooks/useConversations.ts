import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Conversation, Message, Profile } from '@/types'

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select(
        '*, a:profiles!conversations_user_a_fkey(*), b:profiles!conversations_user_b_fkey(*)',
      )
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false })

    const rows = (data as (Conversation & { a: Profile; b: Profile })[]) ?? []
    // fetch last message for each
    const withMeta = await Promise.all(
      rows.map(async (c) => {
        const other = c.user_a === userId ? c.b : c.a
        const { data: last } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return { ...c, other, last_message: (last as Message) ?? undefined }
      }),
    )
    // sort by last message time
    withMeta.sort((x, y) => {
      const tx = x.last_message?.created_at ?? x.created_at
      const ty = y.last_message?.created_at ?? y.created_at
      return ty.localeCompare(tx)
    })
    setConversations(withMeta)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  return { conversations, loading, reload: load }
}
