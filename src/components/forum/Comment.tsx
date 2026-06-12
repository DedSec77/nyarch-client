import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Comment as CommentType } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'
import { AdminBadge } from '@/components/ui/AdminBadge'
import { VoteControl } from '@/components/ui/VoteControl'
import { timeAgo } from '@/lib/utils'
import { castVote } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface CommentProps {
  comment: CommentType
  depth: number
  onReply: (
    parentId: string,
    body: string,
    imageFile?: File | null,
  ) => Promise<{ error: string | null } | void>
  onVoteLocal: (commentId: string, v: -1 | 1) => void
  onEdit?: (commentId: string, body: string) => Promise<{ error: string | null }>
  onDelete?: (commentId: string) => Promise<void>
}

const DEPTH_COLORS = ['#00ff9c', '#22d3ee', '#ff2fb9', '#ffb000', '#ff3b5c']

export function Comment({ comment, depth, onReply, onVoteLocal, onEdit, onDelete }: CommentProps) {
  const { user, profile } = useAuth()
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.body)
  const fileRef = useRef<HTMLInputElement>(null)

  const accent = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  const isOwner = user?.id === comment.author_id
  const canDelete = isOwner || profile?.is_admin

  async function saveEdit() {
    if (!onEdit) return
    setBusy(true)
    const res = await onEdit(comment.id, editText)
    setBusy(false)
    if (!res.error) setEditing(false)
  }

  function vote(v: -1 | 1) {
    if (!user) return
    onVoteLocal(comment.id, v)
    castVote('comment', comment.id, v)
  }

  const [err, setErr] = useState<string | null>(null)

  async function send() {
    if (!text.trim() && !image) return
    setBusy(true)
    setErr(null)
    const res = await onReply(comment.id, text, image?.file ?? null)
    setBusy(false)
    if (res && res.error) {
      setErr(res.error)
      return
    }
    setText('')
    setImage(null)
    setReplying(false)
  }

  return (
    <div className="mt-3">
      <div
        className="mono-border border-l-2 pl-3"
        style={{ borderColor: depth === 0 ? 'transparent' : accent + '55' }}
      >
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          <button onClick={() => setCollapsed((c) => !c)} className="hover:text-ink">
            [{collapsed ? '+' : '−'}]
          </button>
          <Link to={`/u/${comment.author?.username}`} className="flex items-center gap-1.5 hover:text-ink">
            <Avatar src={comment.author?.avatar_url} name={comment.author?.display_name ?? '?'} size={18} />
            <span className="text-ink-dim">@{comment.author?.username}</span>
          </Link>
          {comment.author?.is_admin && <AdminBadge size="sm" />}
          <span>· {timeAgo(comment.created_at)} ago</span>
          {comment.edited_at && <span className="italic">· edited</span>}
          <span>·</span>
          <span className={comment.score && comment.score > 0 ? 'text-neon-green' : ''}>
            {comment.score ?? 0} pts
          </span>
        </div>

        {!collapsed && (
          <>
            {editing ? (
              <div className="mt-1.5">
                <textarea
                  autoFocus
                  rows={2}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="input resize-y text-sm"
                />
                <div className="mt-1 flex gap-2">
                  <button onClick={saveEdit} disabled={busy} className="btn btn-primary py-1 text-xs">
                    {busy ? '…' : 'save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setEditText(comment.body)
                    }}
                    className="btn btn-ghost py-1 text-xs"
                  >
                    cancel
                  </button>
                </div>
              </div>
            ) : (
              comment.body && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{comment.body}</p>
              )
            )}
            {comment.image_url && (
              <img
                src={comment.image_url}
                alt=""
                className="mt-1.5 max-h-72 rounded-md border border-term-700/60 object-contain"
                loading="lazy"
              />
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-ink-faint">
              <VoteControl
                score={comment.score ?? 0}
                myVote={comment.my_vote ?? 0}
                onVote={vote}
                horizontal
                disabled={!user}
              />
              {user && (
                <button onClick={() => setReplying((r) => !r)} className="flex items-center gap-1 hover:text-neon-cyan">
                  <Icon name="reply" size={13} /> reply
                </button>
              )}
              {isOwner && onEdit && !editing && (
                <button
                  onClick={() => {
                    setEditText(comment.body)
                    setEditing(true)
                  }}
                  className="flex items-center gap-1 hover:text-neon-cyan"
                >
                  <Icon name="edit" size={13} /> edit
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  onClick={async () => {
                    if (confirm('Delete this comment?')) await onDelete(comment.id)
                  }}
                  className="flex items-center gap-1 hover:text-neon-red"
                >
                  <Icon name="trash" size={13} /> del
                </button>
              )}
            </div>

            {replying && (
              <div className="mt-2">
                <textarea
                  autoFocus
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="input resize-y text-sm"
                  placeholder="reply…"
                />
                {image && (
                  <div className="relative mt-1.5 inline-block">
                    <img src={image.preview} alt="" className="max-h-32 rounded-md border border-term-700/60" />
                    <button
                      onClick={() => setImage(null)}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-neon-red/50 bg-term-900 text-neon-red"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </div>
                )}
                <div className="mt-1 flex gap-2">
                  <button onClick={send} disabled={busy} className="btn btn-primary py-1 text-xs">
                    {busy ? '…' : 'send'}
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn btn-ghost py-1 text-xs"
                    title="attach photo"
                  >
                    <Icon name="image" size={13} />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setImage({ file: f, preview: URL.createObjectURL(f) })
                    }}
                  />
                  <button onClick={() => setReplying(false)} className="btn btn-ghost py-1 text-xs">
                    cancel
                  </button>
                </div>
                {err && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-neon-red">
                    <Icon name="close" size={12} className="mt-0.5 shrink-0" /> {err}
                  </p>
                )}
              </div>
            )}

            {comment.replies?.map((r) => (
              <Comment
                key={r.id}
                comment={r}
                depth={depth + 1}
                onReply={onReply}
                onVoteLocal={onVoteLocal}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
