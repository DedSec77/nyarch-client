// Giphy integration. Uses the public beta key from env, falls back to the
// well-known public demo key so the GIF picker still works out of the box.
const GIPHY_KEY =
  (import.meta.env.VITE_GIPHY_API_KEY as string | undefined) || 'dc6zaTOxFJmzC' // public demo key

export interface GiphyGif {
  id: string
  title: string
  url: string // fixed-height usable url
  preview: string // small still/preview
}

interface GiphyRaw {
  id: string
  title: string
  images: {
    fixed_height: { url: string }
    fixed_height_small_still?: { url: string }
    fixed_width_small?: { url: string }
  }
}

function map(items: GiphyRaw[]): GiphyGif[] {
  return items.map((g) => ({
    id: g.id,
    title: g.title,
    url: g.images.fixed_height.url,
    preview: g.images.fixed_width_small?.url || g.images.fixed_height_small_still?.url || g.images.fixed_height.url,
  }))
}

export async function trendingGifs(limit = 24): Promise<GiphyGif[]> {
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=${limit}&rating=pg-13`,
  )
  if (!res.ok) return []
  const json = await res.json()
  return map(json.data ?? [])
}

export async function searchGifs(query: string, limit = 24): Promise<GiphyGif[]> {
  if (!query.trim()) return trendingGifs(limit)
  const res = await fetch(
    `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(
      query,
    )}&limit=${limit}&rating=pg-13&lang=ru`,
  )
  if (!res.ok) return []
  const json = await res.json()
  return map(json.data ?? [])
}
