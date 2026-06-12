import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import {
  type Theme,
  applyTheme,
  findTheme,
  allThemes,
  loadInstalledThemes,
  saveInstalledThemes,
  getActiveThemeId,
  setActiveThemeId,
  THEME_DEFAULT,
} from '@/lib/themes'

interface ThemeState {
  active: Theme
  themes: Theme[] // official + installed
  installed: Theme[] // user-added only
  setActive: (id: string) => void
  installTheme: (theme: Theme) => { ok: boolean; error?: string }
  removeTheme: (id: string) => void
}

const ThemeContext = createContext<ThemeState | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string>(() => getActiveThemeId())
  const [installed, setInstalled] = useState<Theme[]>(() => loadInstalledThemes())

  // recompute combined list whenever installed changes
  const themes = allThemesMemo(installed)
  const active = findThemeIn(themes, activeId)

  // apply on mount + whenever active theme changes
  useEffect(() => {
    applyTheme(active)
  }, [active])

  const setActive = useCallback((id: string) => {
    setActiveThemeId(id)
    setActiveId(id)
  }, [])

  const installTheme = useCallback(
    (theme: Theme) => {
      // never let an import masquerade as official / collide with official ids
      if (allThemes().some((t) => t.official && t.id === theme.id)) {
        return { ok: false, error: 'ID collides with an official theme — rename the id' }
      }
      const next = [...installed.filter((t) => t.id !== theme.id), { ...theme, official: false }]
      setInstalled(next)
      saveInstalledThemes(next)
      return { ok: true }
    },
    [installed],
  )

  const removeTheme = useCallback(
    (id: string) => {
      const next = installed.filter((t) => t.id !== id)
      setInstalled(next)
      saveInstalledThemes(next)
      if (activeId === id) setActive(THEME_DEFAULT.id)
    },
    [installed, activeId, setActive],
  )

  return (
    <ThemeContext.Provider value={{ active, themes, installed, setActive, installTheme, removeTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

function allThemesMemo(installed: Theme[]): Theme[] {
  const map = new Map<string, Theme>()
  // reuse helper output but keep installed reactive
  allThemes().forEach((t) => map.set(t.id, t))
  installed.forEach((t) => map.set(t.id, t))
  return [...map.values()]
}

function findThemeIn(themes: Theme[], id: string): Theme {
  return themes.find((t) => t.id === id) ?? findTheme(id)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
