import { formatDistanceToNowStrict } from 'date-fns'
import { supabase } from './supabase'

export function timeAgo(date: string | Date): string {
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: false })
      .replace(' seconds', 's')
      .replace(' second', 's')
      .replace(' minutes', 'm')
      .replace(' minute', 'm')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd')
      .replace(' months', 'mo')
      .replace(' month', 'mo')
      .replace(' years', 'y')
      .replace(' year', 'y')
  } catch {
    return ''
  }
}

export function formatScore(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k'
  return String(n)
}

export function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}

/** Deterministic neon accent based on a string (for avatars without image). */
export function accentFor(seed: string): string {
  const palette = ['#00ff9c', '#22d3ee', '#ff2fb9', '#ffb000', '#ff3b5c']
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '??'
}

/**
 * Extracts a few dominant colors from an image/gif (current frame).
 * Uses a canvas; requires CORS access (Supabase storage provides it).
 * Returns an array of hex colors sorted by frequency, or null on error.
 */
export function extractPalette(url: string, count = 4): Promise<string[] | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = 48
        const h = Math.max(1, Math.round((img.height / img.width) * w)) || 48
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)
        // bin colors into a 32-step grid, ignoring transparent/near-black/near-white
        const bins = new Map<string, { r: number; g: number; b: number; n: number }>()
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a < 125) continue
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2]
          const max = Math.max(r, g, b),
            min = Math.min(r, g, b)
          if (max < 28 || min > 232) continue // drop black/white
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`
          const e = bins.get(key)
          if (e) {
            e.r += r
            e.g += g
            e.b += b
            e.n++
          } else bins.set(key, { r, g, b, n: 1 })
        }
        const sorted = [...bins.values()].sort((a, b) => b.n - a.n).slice(0, count)
        if (!sorted.length) return resolve(null)
        const toHex = (v: number) => Math.round(v).toString(16).padStart(2, '0')
        const hexes = sorted.map(
          (e) => `#${toHex(e.r / e.n)}${toHex(e.g / e.n)}${toHex(e.b / e.n)}`,
        )
        resolve(hexes)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Upload a file to a bucket under <uid>/<random>.<ext>; returns public URL. */
export async function uploadImage(
  bucket: string,
  userId: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return { url: null, error: error.message }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
