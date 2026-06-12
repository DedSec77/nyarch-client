import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Icon, categoryIcon } from '@/components/ui/Icon'
import type { Category } from '@/types'

export function Sidebar() {
  const [cats, setCats] = useState<Category[]>([])
  const loc = useLocation()
  const active = new URLSearchParams(loc.search).get('c')

  useEffect(() => {
    supabase.rpc('get_categories').then(({ data }) => {
      if (data) setCats(data as Category[])
    })
  }, [])

  return (
    <aside className="hidden w-60 shrink-0 lg:block">
      <div className="panel sticky top-[4.5rem]">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>~/categories</span>
        </div>
        <nav className="p-1.5">
          <Link
            to="/"
            className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-colors ${
              !active ? 'bg-term-800 text-neon-green' : 'text-ink-dim hover:bg-term-800 hover:text-ink'
            }`}
          >
            <span className="text-neon-green">*</span> all
          </Link>
          {cats.map((c) => (
            <Link
              key={c.id}
              to={`/?c=${c.slug}`}
              className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-colors ${
                active === c.slug
                  ? 'bg-term-800 text-ink'
                  : 'text-ink-dim hover:bg-term-800 hover:text-ink'
              }`}
            >
              <Icon name={categoryIcon(c.slug)} size={14} className="mono-accent" style={{ color: c.color }} />
              <span className="flex-1 truncate">{c.name}</span>
              {typeof c.post_count === 'number' && (
                <span className="text-xs text-ink-faint">{c.post_count}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      <div className="panel mt-3 p-3 text-xs leading-relaxed text-ink-faint">
        <p className="text-ink-dim">// nyarch v1.0</p>
        <p className="mt-1">a terminal forum about IT: code, linux, electronics and more.</p>
        <p className="mt-2 text-neon-green/70">$ stay curious_</p>
      </div>
    </aside>
  )
}
