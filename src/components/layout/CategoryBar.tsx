import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Icon, categoryIcon } from '@/components/ui/Icon'
import type { Category } from '@/types'

/**
 * Horizontally-scrollable category chips for phones / tablets.
 * Hidden on large screens where the full Sidebar is visible.
 */
export function CategoryBar() {
  const [cats, setCats] = useState<Category[]>([])
  const loc = useLocation()
  const active = new URLSearchParams(loc.search).get('c')

  useEffect(() => {
    supabase.rpc('get_categories').then(({ data }) => {
      if (data) setCats(data as Category[])
    })
  }, [])

  if (cats.length === 0) return null

  return (
    <div className="panel mb-3 lg:hidden">
      <div className="flex gap-1.5 overflow-x-auto p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          to="/"
          className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
            !active
              ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
              : 'border-term-700 bg-term-850 text-ink-dim'
          }`}
        >
          <span className="text-neon-green">*</span> all
        </Link>
        {cats.map((c) => (
          <Link
            key={c.id}
            to={`/?c=${c.slug}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              active === c.slug
                ? 'border-neon-green/40 bg-term-800 text-ink'
                : 'border-term-700 bg-term-850 text-ink-dim'
            }`}
          >
            <Icon name={categoryIcon(c.slug)} size={13} className="mono-accent" style={{ color: c.color }} />
            <span className="whitespace-nowrap">{c.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
