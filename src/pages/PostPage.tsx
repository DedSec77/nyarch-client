import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase, BUCKET_COMMENTS } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { mapPost, type RawPostRow } from '@/hooks/usePosts'
import type { Post, Comment as CommentType } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Icon, categoryIcon } from '@/components/ui/Icon'
import { VoteControl } from '@/components/ui/VoteControl'
import { FullSpinner } from '@/components/ui/Spinner'
import { Comment } from '@/components/forum/Comment'
import { timeAgo, uploadImage } from '@/lib/utils'
import { castVote } from '@/lib/api'

interface RawComment {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  body: string | null
  image_url: string | null
  created_at: string
  author_username: string
  author_display_name: string
  author_avatar_url: string | null
  score: number
  my_vote: number
}

function buildTree(rows: RawComment[]): CommentType[] {
  const map = new Map<string, CommentType>()
  const roots: CommentType[] = []
  rows.forEach((r) => {
    map.set(r.id, {
      id: r.id,
      post_id: r.post_id,
      author_id: r.author_id,
      parent_id: r.parent_id,
      body: r.body ?? '',
      image_url: r.image_url,
      created_at: r.created_at,
      score: Number(r.score),
      my_vote: (r.my_vote as -1 | 0 | 1) ?? 0,
      replies: [],
      author: {
        id: r.author_id,
        username: r.author_username,
        display_name: r.author_display_name,
        avatar_url: r.author_avatar_url,
        banner_url: null,
        bio: null,
        created_at: '',
      },
    })
  })
  rows.forEach((r) => {
    const node = map.get(r.id)!
    if (r.parent_id && map.has(r.parent_id)) map.get(r.parent_id)!.replies!.push(node)
    else roots.push(node)
  })
  return roots
}

export function PostPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<CommentType[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [commentImage, setCommentImage] = useState<{ file: File; preview: string } | null>(null)
  const [commentError, setCommentError] = useState<string | null>(null)
  const commentFileRef = useRef<HTMLInputElement>(null)

  const loadComments = useCallback(async () => {
    if (!id) return
    const { data } = await supabase.rpc('get_comments', { p_post: id })
    setComments(buildTree((data as RawComment[]) ?? []))
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    supabase.rpc('get_post', { p_id: id }).then(async ({ data }) => {
      const row = (data as RawPostRow[])?.[0]
      setPost(row ? mapPost(row) : null)
      await loadComments()
      setLoading(false)
    })
  }, [id, loadComments])

  function votePost(v: -1 | 1) {
    if (!user || !post) return
    const was = post.my_vote ?? 0
    const next = was === v ? 0 : v
    setPost({ ...post, my_vote: next as -1 | 0 | 1, score: (post.score ?? 0) + (next - was) })
    castVote('post', post.id, v)
  }

  function voteCommentLocal(commentId: string, v: -1 | 1) {
    setComments((prev) => {
      const walk = (list: CommentType[]): CommentType[] =>
        list.map((c) => {
          if (c.id === commentId) {
            const was = c.my_vote ?? 0
            const next = was === v ? 0 : v
            return { ...c, my_vote: next as -1 | 0 | 1, score: (c.score ?? 0) + (next - was) }
          }
          return { ...c, replies: c.replies ? walk(c.replies) : [] }
        })
      return walk(prev)
    })
  }

  async function addComment(parentId: string | null, body: string, imageFile?: File | null) {
    if (!user || !id) return { error: 'not signed in' }
    setCommentError(null)
    let imageUrl: string | null = null
    if (imageFile) {
      const { url, error: upErr } = await uploadImage(BUCKET_COMMENTS, user.id, imageFile)
      if (upErr || !url) {
        const msg = `image upload failed: ${upErr ?? 'unknown error'}`
        setCommentError(msg)
        return { error: msg }
      }
      imageUrl = url
    }
    if (!body.trim() && !imageUrl) return { error: 'empty comment' }
    const { error } = await supabase.from('comments').insert({
      post_id: id,
      author_id: user.id,
      parent_id: parentId,
      body: body.trim() || null,
      image_url: imageUrl,
    })
    if (error) {
      console.error('comment insert failed:', error)
      setCommentError(error.message)
      return { error: error.message }
    }
    await loadComments()
    return { error: null }
  }

  async function submitTopLevel(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() && !commentImage) return
    setBusy(true)
    const res = await addComment(null, newComment, commentImage?.file ?? null)
    if (!res?.error) {
      setNewComment('')
      setCommentImage(null)
    }
    setBusy(false)
  }

  if (loading) return <FullSpinner label="loading thread" />
  if (!post)
    return (
      <div className="panel mx-auto max-w-2xl p-8 text-center text-ink-dim">
        Post not found. <Link to="/" className="link">← home</Link>
      </div>
    )

  const isAuthor = user?.id === post.author_id

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="mb-3 inline-block text-sm text-ink-dim hover:text-neon-green">
        ← cd ..
      </Link>

      <article className="panel flex overflow-hidden">
        <div className="flex flex-col items-center border-r border-term-700/60 bg-term-850/40 px-2 py-4">
          <VoteControl score={post.score ?? 0} myVote={post.my_vote ?? 0} onVote={votePost} disabled={!user} />
        </div>
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
            <Link to={`/?c=${post.category?.slug}`} className="chip" style={{ color: post.category?.color }}>
              <Icon name={categoryIcon(post.category?.slug)} size={12} /> {post.category?.name}
            </Link>
            <span>·</span>
            <Link to={`/u/${post.author?.username}`} className="flex items-center gap-1.5 hover:text-ink">
              <Avatar src={post.author?.avatar_url} name={post.author?.display_name ?? '?'} size={18} />
              @{post.author?.username}
            </Link>
            <span>· {timeAgo(post.created_at)} ago</span>
            {isAuthor && (
              <button
                onClick={async () => {
                  if (!confirm('Delete this post?')) return
                  await supabase.from('posts').delete().eq('id', post.id)
                  navigate('/')
                }}
                className="ml-auto text-neon-red/70 hover:text-neon-red"
              >
                rm -f
              </button>
            )}
          </div>

          <h1 className="text-xl font-bold text-ink">{post.title}</h1>
          {post.body && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-dim">{post.body}</p>}
          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              className="mt-3 max-h-[32rem] rounded-md border border-term-700/60 object-contain"
            />
          )}
        </div>
      </article>

      <div className="panel mt-3">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>~/comments [{post.comment_count ?? comments.length}]</span>
        </div>
        <div className="p-4">
          {user ? (
            <form onSubmit={submitTopLevel} className="mb-4">
              <textarea
                rows={3}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="input resize-y"
                placeholder="echo your thoughts…"
              />
              {commentImage && (
                <div className="relative mt-2 inline-block">
                  <img
                    src={commentImage.preview}
                    alt=""
                    className="max-h-40 rounded-md border border-term-700/60"
                  />
                  <button
                    type="button"
                    onClick={() => setCommentImage(null)}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-neon-red/50 bg-term-900 text-neon-red"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn btn-primary">
                  {busy ? 'posting…' : '> comment'}
                </button>
                <button
                  type="button"
                  onClick={() => commentFileRef.current?.click()}
                  className="btn btn-ghost"
                  title="attach photo"
                >
                  <Icon name="image" size={15} /> photo
                </button>
                <input
                  ref={commentFileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setCommentImage({ file: f, preview: URL.createObjectURL(f) })
                  }}
                />
              </div>
              {commentError && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-neon-red">
                  <Icon name="close" size={13} className="mt-0.5 shrink-0" /> {commentError}
                </p>
              )}
            </form>
          ) : (
            <p className="mb-4 text-sm text-ink-dim">
              <Link to="/login" className="link">Log in</Link> to comment.
            </p>
          )}

          {comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">
              <span className="text-neon-green">$</span> No comments yet. Be the first.
            </p>
          ) : (
            comments.map((c) => (
              <Comment key={c.id} comment={c} depth={0} onReply={addComment} onVoteLocal={voteCommentLocal} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
