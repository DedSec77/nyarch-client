import { useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { CategoryBar } from '@/components/layout/CategoryBar'
import { PostCard } from '@/components/forum/PostCard'
import { Icon } from '@/components/ui/Icon'
import { FullSpinner } from '@/components/ui/Spinner'
import { usePosts, type SortMode } from '@/hooks/usePosts'

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'hot', label: 'hot' },
  { key: 'new', label: 'new' },
  { key: 'top', label: 'top' },
]

export function HomePage() {
  const [params] = useSearchParams()
  const category = params.get('c')
  const query = params.get('q')?.toLowerCase() ?? ''
  const [sort, setSort] = useState<SortMode>('hot')
  const { posts, loading, error, applyVote } = usePosts(category, sort)

  const filtered = useMemo(() => {
    if (!query) return posts
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.body.toLowerCase().includes(query) ||
        p.author?.username.toLowerCase().includes(query),
    )
  }, [posts, query])

  return (
    <div className="flex gap-4">
      <Sidebar />

      <div className="min-w-0 flex-1">
        <CategoryBar />
        <div className="panel mb-3 flex items-center gap-1 overflow-x-auto p-1.5">
          <span className="px-2 text-sm text-ink-faint">
            <span className="text-neon-green">$</span> sort --by
          </span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                sort === s.key
                  ? 'bg-term-800 text-neon-green'
                  : 'text-ink-dim hover:bg-term-800 hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
          {category && (
            <span className="ml-auto px-2 text-sm text-ink-dim">
              filter: <span className="text-neon-cyan">#{category}</span>
            </span>
          )}
        </div>

        {query && (
          <div className="mb-3 text-sm text-ink-dim">
            grep "<span className="text-neon-green">{query}</span>" → {filtered.length} result(s)
          </div>
        )}

        {loading ? (
          <FullSpinner label="fetching posts" />
        ) : error ? (
          <div className="panel flex items-center justify-center gap-1.5 p-6 text-center text-sm text-neon-red">
            <Icon name="close" size={14} /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="text-ink-dim">
              <span className="text-neon-green">$</span> ls posts/ → empty
            </p>
            <p className="mt-2 text-sm text-ink-faint">Nothing here yet. Create the first post!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <PostCard key={p.id} post={p} onVote={applyVote} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
