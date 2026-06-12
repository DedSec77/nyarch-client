import { useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  type Theme,
  type ThemeColors,
  parseTheme,
  themeToJson,
  newCustomTheme,
} from '@/lib/themes'
import { Icon } from '@/components/ui/Icon'

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'term950', label: 'bg 950' },
  { key: 'term900', label: 'bg 900' },
  { key: 'term850', label: 'bg 850' },
  { key: 'term800', label: 'bg 800' },
  { key: 'term750', label: 'bg 750' },
  { key: 'term700', label: 'bg 700' },
  { key: 'neonGreen', label: 'green' },
  { key: 'neonCyan', label: 'cyan' },
  { key: 'neonMagenta', label: 'magenta' },
  { key: 'neonAmber', label: 'amber' },
  { key: 'neonRed', label: 'red' },
  { key: 'ink', label: 'ink' },
  { key: 'inkDim', label: 'ink dim' },
  { key: 'inkFaint', label: 'ink faint' },
]

function ThemeSwatch({ theme }: { theme: Theme }) {
  const c = theme.colors
  return (
    <div className="flex h-16 overflow-hidden rounded-md border border-term-700/60" style={{ background: c.term950 }}>
      <div className="flex flex-1 flex-col justify-end gap-1 p-2">
        <div className="h-2 w-12 rounded" style={{ background: c.term800 }} />
        <div className="flex gap-1">
          <span className="h-3 w-3 rounded-full" style={{ background: c.neonGreen }} />
          <span className="h-3 w-3 rounded-full" style={{ background: c.neonCyan }} />
          <span className="h-3 w-3 rounded-full" style={{ background: c.neonMagenta }} />
          <span className="h-3 w-3 rounded-full" style={{ background: c.neonAmber }} />
          <span className="h-3 w-3 rounded-full" style={{ background: c.neonRed }} />
        </div>
      </div>
      <div className="flex w-1/3 flex-col justify-center px-2" style={{ background: c.term900 }}>
        <span className="text-xs font-bold" style={{ color: c.ink }}>
          Aa
        </span>
        <span className="text-[10px]" style={{ color: c.inkDim }}>
          @user
        </span>
      </div>
    </div>
  )
}

function ThemeCard({
  theme,
  isActive,
  onApply,
  onRemove,
  onExport,
}: {
  theme: Theme
  isActive: boolean
  onApply: () => void
  onRemove?: () => void
  onExport: () => void
}) {
  return (
    <div className={`panel p-3 ${isActive ? 'ring-1 ring-neon-green/50' : ''}`}>
      <ThemeSwatch theme={theme} />
      <div className="mt-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{theme.name}</p>
          <p className="flex items-center gap-1 text-xs text-ink-faint">
            by {theme.author}
            {theme.official && (
              <span className="inline-flex items-center gap-0.5 text-neon-amber">
                <Icon name="star" size={11} /> official
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {isActive ? (
          <span className="btn btn-ghost pointer-events-none py-1 text-xs text-neon-green">
            <Icon name="check" size={13} /> active
          </span>
        ) : (
          <button onClick={onApply} className="btn btn-primary py-1 text-xs">
            apply
          </button>
        )}
        <button onClick={onExport} className="btn btn-ghost py-1 text-xs" title="export JSON">
          <Icon name="download" size={13} />
        </button>
        {onRemove && (
          <button onClick={onRemove} className="btn btn-danger py-1 text-xs" title="remove">
            <Icon name="trash" size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export function ThemeStorePage() {
  const { themes, active, installed, setActive, installTheme, removeTheme } = useTheme()
  const [tab, setTab] = useState<'workshop' | 'mine' | 'editor'>('workshop')
  const [importErr, setImportErr] = useState<string | null>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // editor state
  const [draft, setDraft] = useState<Theme>(() => newCustomTheme())

  const official = themes.filter((t) => t.official)

  function exportTheme(theme: Theme) {
    const blob = new Blob([themeToJson(theme)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${theme.id}.nyarch-theme.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(file: File) {
    setImportErr(null)
    setImportMsg(null)
    const reader = new FileReader()
    reader.onload = () => {
      const { theme, error } = parseTheme(String(reader.result))
      if (error || !theme) {
        setImportErr(error ?? 'import error')
        return
      }
      const res = installTheme(theme)
      if (!res.ok) {
        setImportErr(res.error ?? 'could not install')
        return
      }
      setImportMsg(`Theme “${theme.name}” added to your themes`)
      setTab('mine')
    }
    reader.readAsText(file)
  }

  function saveDraft() {
    setImportErr(null)
    setImportMsg(null)
    const res = installTheme(draft)
    if (!res.ok) {
      setImportErr(res.error ?? 'could not save')
      return
    }
    setImportMsg(`Theme “${draft.name}” saved`)
    setActive(draft.id)
    setTab('mine')
    setDraft(newCustomTheme())
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span className="flex items-center gap-1.5">
            <Icon name="palette" size={13} /> ~/themes/store
          </span>
        </div>

        {/* tabs */}
        <div className="flex items-center gap-1 border-b border-term-700/60 p-2">
          {([
            ['workshop', 'workshop'],
            ['mine', `my themes (${installed.length})`],
            ['editor', 'create'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                tab === key ? 'bg-term-800 text-neon-green' : 'text-ink-dim hover:bg-term-800 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
          {tab === 'mine' && (
            <button
              onClick={() => fileInput.current?.click()}
              className="btn btn-ghost ml-auto py-1 text-xs"
            >
              <Icon name="upload" size={13} /> upload .json
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        <div className="p-4">
          {importErr && <p className="mb-3 text-sm text-neon-red"><Icon name="close" size={13} className="inline" /> {importErr}</p>}
          {importMsg && <p className="mb-3 text-sm text-neon-green"><Icon name="check" size={13} className="inline" /> {importMsg}</p>}

          {tab === 'workshop' && (
            <>
              <p className="mb-3 text-sm text-ink-dim">
                Official themes by the nyarch creators. Hit “apply” to use one.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {official.map((t) => (
                  <ThemeCard
                    key={t.id}
                    theme={t}
                    isActive={active.id === t.id}
                    onApply={() => setActive(t.id)}
                    onExport={() => exportTheme(t)}
                  />
                ))}
              </div>
            </>
          )}

          {tab === 'mine' && (
            <>
              {installed.length === 0 ? (
                <div className="panel p-8 text-center text-sm text-ink-faint">
                  <p>No custom themes yet.</p>
                  <p className="mt-1">Upload a .json or build one in the “create” tab.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {installed.map((t) => (
                    <ThemeCard
                      key={t.id}
                      theme={t}
                      isActive={active.id === t.id}
                      onApply={() => setActive(t.id)}
                      onRemove={() => removeTheme(t.id)}
                      onExport={() => exportTheme(t)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'editor' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-ink-dim">$ theme name</label>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="input"
                    maxLength={40}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-dim">$ author</label>
                  <input
                    value={draft.author}
                    onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                    className="input"
                    maxLength={40}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {COLOR_FIELDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={draft.colors[key]}
                        onChange={(e) =>
                          setDraft({ ...draft, colors: { ...draft.colors, [key]: e.target.value } })
                        }
                        className="h-8 w-9 shrink-0 cursor-pointer rounded border border-term-700 bg-term-850"
                      />
                      <span className="truncate text-xs text-ink-dim">{label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={saveDraft} className="btn btn-primary py-1.5 text-sm">
                    <Icon name="check" size={14} /> save & apply
                  </button>
                  <button onClick={() => setDraft(newCustomTheme())} className="btn btn-ghost py-1.5 text-sm">
                    reset
                  </button>
                </div>
              </div>

              {/* live preview */}
              <div>
                <p className="mb-2 text-xs text-ink-dim">preview</p>
                <div className="panel p-3">
                  <ThemeSwatch theme={draft} />
                </div>
                <div
                  className="mt-3 rounded-lg border p-3"
                  style={{ background: draft.colors.term900, borderColor: draft.colors.term700 }}
                >
                  <p className="text-sm font-bold" style={{ color: draft.colors.ink }}>
                    {draft.name || 'my theme'}
                  </p>
                  <p className="text-xs" style={{ color: draft.colors.inkDim }}>
                    text preview and{' '}
                    <span style={{ color: draft.colors.neonGreen }}>accents</span>{' '}
                    <span style={{ color: draft.colors.neonCyan }}>in</span>{' '}
                    <span style={{ color: draft.colors.neonMagenta }}>the theme</span>
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <span
                      className="rounded px-2 py-0.5 text-xs"
                      style={{ background: draft.colors.term800, color: draft.colors.neonGreen }}
                    >
                      btn
                    </span>
                    <span
                      className="rounded px-2 py-0.5 text-xs"
                      style={{ background: draft.colors.term800, color: draft.colors.inkDim }}
                    >
                      ghost
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
