import { useEffect, useRef, useState } from 'react'
import { searchGifs, trendingGifs, type GiphyGif } from '@/lib/giphy'
import { Spinner } from './Spinner'

interface GifPickerProps {
  onPick: (gif: GiphyGif) => void
  onClose: () => void
}

/**
 * Discord-style GIF picker backed by Giphy.
 * - Phones: full-width bottom sheet (so it never overflows a narrow viewport).
 * - sm+ : compact popover anchored above the GIF button.
 */
export function GifPicker({ onPick, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [loading, setLoading] = useState(true)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setLoading(true)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      const data = query.trim() ? await searchGifs(query) : await trendingGifs()
      setGifs(data)
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounce.current)
  }, [query])

  return (
    <>
      {/* mobile backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 sm:hidden" onClick={onClose} />

      <div
        className="panel z-50 flex flex-col shadow-glow
                   fixed inset-x-2 bottom-2 h-[60vh] animate-fade-in
                   sm:absolute sm:bottom-full sm:right-0 sm:inset-x-auto sm:mb-2 sm:h-80 sm:w-80"
      >
        <div className="panel-header">
          <span className="text-neon-magenta">GIF</span>
          <span className="text-ink-faint">powered by giphy</span>
          <button onClick={onClose} className="ml-auto text-ink-faint hover:text-neon-red">
            [x]
          </button>
        </div>
        <div className="p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search gifs…"
            className="input py-1.5 text-xs"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner label="gifs" />
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-ink-faint">
              no gifs found
            </div>
          ) : (
            <div className="columns-2 gap-1.5 sm:columns-2 [&>*]:mb-1.5">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onPick(g)}
                  className="block w-full overflow-hidden rounded border border-transparent transition-all hover:border-neon-magenta/60"
                >
                  <img src={g.preview} alt={g.title} loading="lazy" className="w-full" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
