import { Link } from 'react-router-dom'
import type { Post } from '@/types'
import { Avatar } from '@/components/ui/Avatar'
import { Icon, categoryIcon } from '@/components/ui/Icon'
import { AdminBadge } from '@/components/ui/AdminBadge'
import { VoteControl } from '@/components/ui/VoteControl'
import { timeAgo } from '@/lib/utils'
import { castVote } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface PostCardProps {
  post: Post
  onVote: (postId: string, v: -1 | 1) => void
}

export function PostCard({ post, onVote }: PostCardProps) {
  const { user } = useAuth()

  function vote(v: -1 | 1) {
    if (!user) return
    onVote(post.id, v)
    castVote('post', post.id, v)
  }

  return (
    <article className="panel card-hover flex overflow-hidden">
      <div className="flex flex-col items-center gap-1 border-r border-term-700/60 bg-term-850/40 px-2 py-3">
        <VoteControl
          score={post.score ?? 0}
          myVote={post.my_vote ?? 0}
          onVote={vote}
          disabled={!user}
        />
      </div>

      <div className="min-w-0 flex-1 p-3">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <Link
            to={`/?c=${post.category?.slug}`}
            className="chip mono-accent hover:border-term-700"
            style={{ color: post.category?.color }}
          >
            <Icon name={categoryIcon(post.category?.slug)} size={12} />
            {post.category?.name}
          </Link>
          <span>·</span>
          <Link to={`/u/${post.author?.username}`} className="flex items-center gap-1.5 hover:text-ink">
            <Avatar src={post.author?.avatar_url} name={post.author?.display_name ?? '?'} size={18} />
            <span>@{post.author?.username}</span>
          </Link>
          {post.author?.is_admin && <AdminBadge size="sm" />}
          <span>·</span>
          <span>{timeAgo(post.created_at)} ago</span>
          {post.edited_at && <span className="italic">· edited</span>}
        </div>

        <Link to={`/post/${post.id}`} className="group">
          <h2 className="text-base font-semibold text-ink transition-colors group-hover:text-neon-green">
            {post.title}
          </h2>
          {post.body && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-ink-dim">{post.body}</p>
          )}
        </Link>

        {post.image_url && (
          <Link to={`/post/${post.id}`}>
            <img
              src={post.image_url}
              alt=""
              className="mt-2 max-h-80 rounded-md border border-term-700/60 object-contain"
            />
          </Link>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-ink-faint">
          <Link to={`/post/${post.id}`} className="flex items-center gap-1.5 hover:text-neon-cyan">
            <Icon name="comment" size={14} /> {post.comment_count ?? 0} comments
          </Link>
        </div>
      </div>
    </article>
  )
}
