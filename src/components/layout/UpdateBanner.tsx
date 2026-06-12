import { useEffect, useState } from 'react'
import { checkForUpdate, openExternal, type UpdateInfo } from '@/lib/updateCheck'
import { Icon } from '@/components/ui/Icon'

/**
 * Desktop-only banner: tells the user when a newer release exists on GitHub.
 * No-op on the web and when update checks are disabled in config.
 */
export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let alive = true
    checkForUpdate().then((u) => {
      if (!alive) return
      // don't nag again for a version the user already dismissed
      if (u && localStorage.getItem('nyarch.update.dismissed') === u.latest) return
      setInfo(u)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!info || dismissed) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 border-b border-neon-green/40 bg-neon-green/10 px-4 py-2 text-center text-xs text-neon-green">
      <Icon name="download" size={14} className="shrink-0" />
      <span>
        A new version <b>{info.latest}</b> is available (you have {info.current}).
      </span>
      <button
        onClick={() => openExternal(info.url)}
        className="rounded border border-neon-green/40 px-2 py-0.5 font-bold hover:bg-neon-green/20"
      >
        download
      </button>
      <button
        onClick={() => {
          localStorage.setItem('nyarch.update.dismissed', info.latest)
          setDismissed(true)
        }}
        className="text-ink-faint hover:text-neon-red"
        aria-label="dismiss"
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  )
}
