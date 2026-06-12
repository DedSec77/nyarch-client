import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const { posts, loading, loadingMore, hasMore, error, applyVote, loadMore } = usePosts(
    category,
    sort,
  )

  // Infinite scroll: watch a sentinel near the end of the list and pull the
  // next page when it scrolls into view. Disabled while a search filter is
  // active (search runs over already-loaded posts).
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (query) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      // Start fetching a bit before the sentinel is fully visible.
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [query, loadMore, posts.length])

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

            {/* infinite-scroll sentinel + state, only when not searching */}
            {!query && (
              <div ref={sentinelRef} className="py-4 text-center text-sm text-ink-faint">
                {loadingMore ? (
                  <span>
                    <span className="text-neon-green">$</span> loading more…
                  </span>
                ) : hasMore ? (
                  <button
                    onClick={() => loadMore()}
                    className="text-ink-dim hover:text-neon-green"
                  >
                    load more posts
                  </button>
                ) : (
                  <span className="text-ink-faint">— end of feed —</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
