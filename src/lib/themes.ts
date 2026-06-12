// ── Theme system for nyarch ──────────────────────────────────
// A theme is a set of CSS custom properties applied to :root.
// Tailwind colors (see tailwind.config.js) read these variables,
// so swapping a theme restyles the whole app instantly.

export interface ThemeColors {
  // background ramp (darkest -> lightest)
  term950: string
  term900: string
  term850: string
  term800: string
  term750: string
  term700: string
  // accents
  neonGreen: string
  neonCyan: string
  neonMagenta: string
  neonAmber: string
  neonRed: string
  // text
  ink: string
  inkDim: string
  inkFaint: string
}

export interface Theme {
  id: string
  name: string
  author: string
  official: boolean // shown in the "workshop" (by the creators)
  mono?: boolean // grayscale theme: neutralize hardcoded accent colors (category colors, etc.)
  colors: ThemeColors
}

// CSS variable names used by tailwind.config.js
export const CSS_VAR: Record<keyof ThemeColors, string> = {
  term950: '--term-950',
  term900: '--term-900',
  term850: '--term-850',
  term800: '--term-800',
  term750: '--term-750',
  term700: '--term-700',
  neonGreen: '--neon-green',
  neonCyan: '--neon-cyan',
  neonMagenta: '--neon-magenta',
  neonAmber: '--neon-amber',
  neonRed: '--neon-red',
  ink: '--ink',
  inkDim: '--ink-dim',
  inkFaint: '--ink-faint',
}

// ── Official themes (the "workshop", by the creators) ────────

export const THEME_DEFAULT: Theme = {
  id: 'nyarch-default',
  name: 'nyarch (default)',
  author: 'nyarch',
  official: true,
  colors: {
    term950: '#0b0b0d',
    term900: '#151517',
    term850: '#1b1b1d',
    term800: '#212124',
    term750: '#262629',
    term700: '#2b2b2e',
    neonGreen: '#00ff9c',
    neonCyan: '#22d3ee',
    neonMagenta: '#ff2fb9',
    neonAmber: '#ffb000',
    neonRed: '#ff3b5c',
    ink: '#e6e6e9',
    inkDim: '#9a9aa3',
    inkFaint: '#5c5c66',
  },
}

export const THEME_MONOCHROME: Theme = {
  id: 'nyarch-monochrome',
  name: 'monochrome',
  author: 'nyarch',
  official: true,
  mono: true,
  // Exact requested palette: #0b0b0d, #151517, #1b1b1d, #212124, #262629, #2b2b2e
  colors: {
    term950: '#0b0b0d',
    term900: '#151517',
    term850: '#1b1b1d',
    term800: '#212124',
    term750: '#262629',
    term700: '#2b2b2e',
    // all accents are shades of white/grey — true monochrome
    neonGreen: '#e8e8ea',
    neonCyan: '#c2c2c6',
    neonMagenta: '#a6a6ac',
    neonAmber: '#d4d4d8',
    neonRed: '#8a8a90',
    ink: '#ededee',
    inkDim: '#9a9aa0',
    inkFaint: '#5a5a60',
  },
}

export const THEME_AMBER_CRT: Theme = {
  id: 'nyarch-amber-crt',
  name: 'amber CRT',
  author: 'nyarch',
  official: true,
  colors: {
    term950: '#0d0a04',
    term900: '#15110a',
    term850: '#1c160c',
    term800: '#241c10',
    term750: '#2c2214',
    term700: '#352a18',
    neonGreen: '#ffb000',
    neonCyan: '#ffcf4d',
    neonMagenta: '#ff8c1a',
    neonAmber: '#ffd56b',
    neonRed: '#ff5e3a',
    ink: '#ffdf9e',
    inkDim: '#c79a4f',
    inkFaint: '#7a5e2e',
  },
}

export const THEME_SYNTHWAVE: Theme = {
  id: 'nyarch-synthwave',
  name: 'synthwave',
  author: 'nyarch',
  official: true,
  colors: {
    term950: '#0d0717',
    term900: '#160d24',
    term850: '#1d1130',
    term800: '#26173f',
    term750: '#2f1d4d',
    term700: '#3a245e',
    neonGreen: '#36f9c6',
    neonCyan: '#3ad0ff',
    neonMagenta: '#ff3fa4',
    neonAmber: '#ffcc55',
    neonRed: '#ff5577',
    ink: '#f5e8ff',
    inkDim: '#b79ad6',
    inkFaint: '#6e5790',
  },
}

export const OFFICIAL_THEMES: Theme[] = [
  THEME_DEFAULT,
  THEME_MONOCHROME,
  THEME_AMBER_CRT,
  THEME_SYNTHWAVE,
]

// ── Apply / persist ──────────────────────────────────────────

/** "#rrggbb" | "#rgb" -> "r g b" channel triple for rgb(var(--x) / <alpha>) */
function hexToRgbTriple(hex: string): string {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return '0 0 0'
  return `${r} ${g} ${b}`
}

/** Heuristic: a theme is "mono" if flagged, or if all neon accents are near-grey. */
export function isMonoTheme(theme: Theme): boolean {
  if (theme.mono) return true
  const accents = [
    theme.colors.neonGreen,
    theme.colors.neonCyan,
    theme.colors.neonMagenta,
    theme.colors.neonAmber,
    theme.colors.neonRed,
  ]
  return accents.every((hex) => {
    const t = hexToRgbTriple(hex).split(' ').map(Number)
    const [r, g, b] = t
    return Math.max(r, g, b) - Math.min(r, g, b) <= 16 // low saturation
  })
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  ;(Object.keys(theme.colors) as (keyof ThemeColors)[]).forEach((k) => {
    root.style.setProperty(CSS_VAR[k], hexToRgbTriple(theme.colors[k]))
  })
  // Mark grayscale themes so CSS can neutralize hardcoded accent colors
  // (category colors from the DB, comment depth borders, avatar accents, seams).
  if (isMonoTheme(theme)) root.setAttribute('data-mono', '')
  else root.removeAttribute('data-mono')
}

const LS_INSTALLED = 'nyarch.themes.installed' // custom themes added by the user
const LS_ACTIVE = 'nyarch.themes.active' // active theme id

export function loadInstalledThemes(): Theme[] {
  try {
    const raw = localStorage.getItem(LS_INSTALLED)
    if (!raw) return []
    const arr = JSON.parse(raw) as Theme[]
    return Array.isArray(arr) ? arr.filter(isValidTheme) : []
  } catch {
    return []
  }
}

export function saveInstalledThemes(themes: Theme[]) {
  localStorage.setItem(LS_INSTALLED, JSON.stringify(themes))
}

export function getActiveThemeId(): string {
  return localStorage.getItem(LS_ACTIVE) || THEME_DEFAULT.id
}

export function setActiveThemeId(id: string) {
  localStorage.setItem(LS_ACTIVE, id)
}

export function allThemes(): Theme[] {
  const installed = loadInstalledThemes()
  // official first, then user-installed (dedup by id, installed overrides)
  const map = new Map<string, Theme>()
  OFFICIAL_THEMES.forEach((t) => map.set(t.id, t))
  installed.forEach((t) => map.set(t.id, t))
  return [...map.values()]
}

export function findTheme(id: string): Theme {
  return allThemes().find((t) => t.id === id) ?? THEME_DEFAULT
}

// ── Validation / import-export ───────────────────────────────

const COLOR_KEYS = Object.keys(THEME_DEFAULT.colors) as (keyof ThemeColors)[]
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function isValidTheme(t: unknown): t is Theme {
  if (!t || typeof t !== 'object') return false
  const o = t as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string') return false
  const c = o.colors as Record<string, unknown> | undefined
  if (!c) return false
  return COLOR_KEYS.every((k) => typeof c[k] === 'string' && HEX.test(c[k] as string))
}

/** Parse a JSON theme string; returns the theme or an error message. */
export function parseTheme(json: string): { theme: Theme | null; error: string | null } {
  try {
    const obj = JSON.parse(json)
    if (!isValidTheme(obj)) {
      return { theme: null, error: 'Invalid theme format (need id, name and 14 hex colors)' }
    }
    return {
      theme: {
        id: obj.id,
        name: obj.name,
        author: obj.author || 'custom',
        official: false, // imported themes are never official
        colors: obj.colors,
      },
      error: null,
    }
  } catch {
    return { theme: null, error: 'Invalid JSON' }
  }
}

export function themeToJson(theme: Theme): string {
  return JSON.stringify({ ...theme, official: undefined }, null, 2)
}

/** Blank custom theme seeded from the default — for the in-app editor. */
export function newCustomTheme(): Theme {
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: 'my theme',
    author: 'me',
    official: false,
    colors: { ...THEME_DEFAULT.colors },
  }
}
