import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Post } from '@/types'

export type SortMode = 'hot' | 'new' | 'top'

export interface RawPostRow {
  id: string
  author_id: string
  category_id: string
  title: string
  body: string
  image_url: string | null
  created_at: string
  edited_at?: string | null
  author_username: string
  author_display_name: string
  author_avatar_url: string | null
  author_is_admin?: boolean
  category_slug: string
  category_name: string
  category_icon: string
  category_color: string
  score: number
  comment_count: number
  my_vote: number
}

export function mapPost(r: RawPostRow): Post {
  return {
    id: r.id,
    author_id: r.author_id,
    category_id: r.category_id,
    title: r.title,
    body: r.body,
    image_url: r.image_url,
    created_at: r.created_at,
    edited_at: r.edited_at ?? null,
    score: Number(r.score),
    comment_count: Number(r.comment_count),
    my_vote: (r.my_vote as -1 | 0 | 1) ?? 0,
    author: {
      id: r.author_id,
      username: r.author_username,
      display_name: r.author_display_name,
      avatar_url: r.author_avatar_url,
      is_admin: r.author_is_admin ?? false,
      banner_url: null,
      bio: null,
      created_at: '',
    },
    category: {
      id: r.category_id,
      slug: r.category_slug,
      name: r.category_name,
      description: null,
      icon: r.category_icon,
      color: r.category_color,
    },
  }
}

export function usePosts(category: string | null, sort: SortMode) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.rpc('get_posts', {
      p_category: category,
      p_sort: sort,
      p_limit: 40,
      p_offset: 0,
    })
    if (error) setError(error.message)
    else setPosts(((data as RawPostRow[]) ?? []).map(mapPost))
    setLoading(false)
  }, [category, sort])

  useEffect(() => {
    load()
  }, [load])

  // Optimistic local vote update
  const applyVote = (postId: string, v: -1 | 1) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        const was = p.my_vote ?? 0
        const next = was === v ? 0 : v
        const delta = next - was
        return { ...p, my_vote: next as -1 | 0 | 1, score: (p.score ?? 0) + delta }
      }),
    )
  }

  return { posts, loading, error, reload: load, applyVote }
}
