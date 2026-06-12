import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useConversations } from '@/hooks/useConversations'
import type { Conversation, Profile } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { FullSpinner } from '@/components/ui/Spinner'
import { ChatThread } from '@/components/messages/ChatThread'
import { timeAgo, classNames } from '@/lib/utils'

export function MessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { conversations, loading } = useConversations(user?.id)
  const [active, setActive] = useState<Conversation | null>(null)

  useEffect(() => {
    if (!conversationId) {
      setActive(null)
      return
    }
    const found = conversations.find((c) => c.id === conversationId)
    if (found) {
      setActive(found)
      return
    }
    // direct-load if opened from a profile and not yet in list
    ;(async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*, a:profiles!conversations_user_a_fkey(*), b:profiles!conversations_user_b_fkey(*)')
        .eq('id', conversationId)
        .maybeSingle()
      if (data) {
        const row = data as Conversation & { a: Profile; b: Profile }
        setActive({ ...row, other: row.user_a === user?.id ? row.b : row.a })
      }
    })()
  }, [conversationId, conversations, user])

  if (loading && conversations.length === 0) return <FullSpinner label="inbox" />

  return (
    <div className="panel mx-auto flex h-[calc(100vh-7rem)] max-w-5xl overflow-hidden">
      {/* conversation list */}
      <div
        className={classNames(
          'w-full shrink-0 flex-col border-r border-term-700/60 sm:flex sm:w-64',
          active ? 'hidden sm:flex' : 'flex',
        )}
      >
        <div className="panel-header shrink-0">
          <span className="tui-dots" />
          <span>~/dm/inbox</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {conversations.length === 0 ? (
            <p className="p-4 text-center text-xs text-ink-faint">
              No conversations yet. Message someone from your{' '}
              <Link to="/friends" className="link">friends</Link>.
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/messages/${c.id}`)}
                className={classNames(
                  'flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors',
                  active?.id === c.id ? 'bg-term-800' : 'hover:bg-term-850',
                )}
              >
                <Avatar src={c.other?.avatar_url} name={c.other?.display_name ?? '?'} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm text-ink">{c.other?.display_name}</span>
                    {c.last_message && (
                      <span className="shrink-0 text-[10px] text-ink-faint">
                        {timeAgo(c.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink-faint">
                    {c.last_message
                      ? c.last_message.is_gif
                        ? 'GIF'
                        : c.last_message.image_url && !c.last_message.body
                          ? 'photo'
                          : c.last_message.body
                      : '@' + c.other?.username}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* thread */}
      <div className={classNames('min-w-0 flex-1', active ? 'flex flex-col' : 'hidden sm:flex')}>
        {active ? (
          <>
            <button
              onClick={() => navigate('/messages')}
              className="border-b border-term-700/60 px-3 py-1.5 text-left text-xs text-ink-dim hover:text-neon-green sm:hidden"
            >
              ← back to inbox
            </button>
            <div className="min-h-0 flex-1">
              <ChatThread key={active.id} conversation={active} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-ink-faint">
            <div>
              <p className="text-neon-green">$ select a conversation</p>
              <p className="mt-1">← pick a conversation on the left</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
