import { UPDATE_CHECK_ENABLED, UPDATE_REPO, APP_VERSION } from './config'

export interface UpdateInfo {
  current: string
  latest: string
  url: string
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** "v1.2.3" | "1.2.3" -> [1,2,3] */
function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
}

/** returns true if a > b */
function gt(a: string, b: string): boolean {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

/**
 * Check GitHub for a newer desktop release. Returns null when:
 * - disabled in config, or
 * - not running inside the desktop client, or
 * - already up to date / on error.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!UPDATE_CHECK_ENABLED) return null
  if (!isTauri()) return null

  try {
    const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = json.tag_name
    if (!latest) return null
    if (gt(latest, APP_VERSION)) {
      return {
        current: APP_VERSION,
        latest,
        url: json.html_url ?? `https://github.com/${UPDATE_REPO}/releases/latest`,
      }
    }
    return null
  } catch {
    return null
  }
}

/** Open a URL in the user's default browser (Tauri opener plugin, else window.open). */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      // computed specifier so tsc/vite don't statically resolve the optional dep
      const spec = '@tauri-apps/plugin-opener'
      const mod: any = await import(/* @vite-ignore */ spec)
      if (typeof mod.openUrl === 'function') {
        await mod.openUrl(url)
        return
      }
      if (typeof mod.open === 'function') {
        await mod.open(url)
        return
      }
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener')
}
