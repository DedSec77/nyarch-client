import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, BUCKET_MESSAGES } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useMessages } from '@/hooks/useMessages'
import type { Conversation, Message } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { FullSpinner } from '@/components/ui/Spinner'
import { GifPicker } from '@/components/ui/GifPicker'
import { uploadImage, timeAgo, classNames } from '@/lib/utils'
import type { GiphyGif } from '@/lib/giphy'

export function ChatThread({ conversation }: { conversation: Conversation }) {
  const { user } = useAuth()
  const { messages, loading, appendLocal } = useMessages(conversation.id)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function insertMessage(payload: {
    body: string | null
    image_url: string | null
    is_gif: boolean
  }) {
    if (!user) return
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        ...payload,
      })
      .select('*')
      .single()
    if (!error && data) appendLocal(data as Message)
  }

  async function sendText() {
    const trimmed = text.trim()
    if (!trimmed && !pendingImage) return
    setSending(true)

    if (pendingImage) {
      const { url } = await uploadImage(BUCKET_MESSAGES, user!.id, pendingImage.file)
      if (url) await insertMessage({ body: trimmed || null, image_url: url, is_gif: false })
      setPendingImage(null)
    } else if (trimmed) {
      await insertMessage({ body: trimmed, image_url: null, is_gif: false })
    }
    setText('')
    setSending(false)
  }

  async function sendGif(gif: GiphyGif) {
    setShowGif(false)
    await insertMessage({ body: null, image_url: gif.url, is_gif: true })
  }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) setPendingImage({ file: f, preview: URL.createObjectURL(f) })
  }

  const other = conversation.other

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="panel-header shrink-0">
        <Link to={`/u/${other?.username}`} className="flex items-center gap-2 hover:text-ink">
          <Avatar src={other?.avatar_url} name={other?.display_name ?? '?'} size={26} />
          <div className="leading-tight">
            <span className="block text-sm text-ink">{other?.display_name}</span>
            <span className="block text-xs text-neon-green">@{other?.username}</span>
          </div>
        </Link>
        <span className="ml-auto flex items-center gap-1 text-xs text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-neon-green" /> e2e dm
        </span>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-term-950/40 p-3">
        {loading ? (
          <FullSpinner label="messages" />
        ) : messages.length === 0 ? (
          <p className="flex items-center justify-center gap-1.5 py-10 text-center text-sm text-ink-faint">
            <span className="text-neon-green">$</span> echo "say hi"
            <Icon name="wave" size={15} />
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id
            return (
              <div key={m.id} className={classNames('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={classNames(
                    'max-w-[78%] rounded-lg border px-3 py-2',
                    mine
                      ? 'border-neon-green/30 bg-neon-green/10'
                      : 'border-term-700/60 bg-term-850',
                  )}
                >
                  {m.image_url && (
                    <img
                      src={m.image_url}
                      alt=""
                      className="mb-1 max-h-64 rounded-md object-contain"
                      loading="lazy"
                    />
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words text-sm text-ink">{m.body}</p>}
                  <p className="mt-0.5 text-right text-[10px] text-ink-faint">{timeAgo(m.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="relative shrink-0 border-t border-term-700/60 bg-term-900 p-2">
        {pendingImage && (
          <div className="relative mb-2 inline-block">
            <img src={pendingImage.preview} alt="" className="max-h-28 rounded-md border border-term-700" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-neon-red/50 bg-term-900 text-neon-red"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="btn btn-ghost px-2 py-2"
            title="attach photo"
          >
            <Icon name="image" size={16} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />

          <div className="relative">
            <button
              onClick={() => setShowGif((s) => !s)}
              className="btn btn-ghost px-2 py-2 text-neon-magenta"
              title="gif"
            >
              GIF
            </button>
            {showGif && <GifPicker onPick={sendGif} onClose={() => setShowGif(false)} />}
          </div>

          <textarea
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendText()
              }
            }}
            className="input max-h-32 flex-1 resize-none py-2"
            placeholder="type a message… (Enter to send)"
          />
          <button onClick={sendText} disabled={sending} className="btn btn-primary px-3 py-2" title="send">
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
