import { classNames } from '@/lib/utils'

interface OnlineDotProps {
  online: boolean
  /** Render with a label like "online" / "offline". */
  withLabel?: boolean
  size?: number
  className?: string
}

/** Discord-style presence indicator. Green = online, grey = offline. */
export function OnlineDot({ online, withLabel = false, size = 8, className = '' }: OnlineDotProps) {
  const dot = (
    <span
      className={classNames(
        'inline-block shrink-0 rounded-full',
        online ? 'bg-neon-green' : 'bg-ink-faint',
      )}
      style={{ width: size, height: size, boxShadow: online ? '0 0 6px rgb(var(--neon-green))' : undefined }}
    />
  )
  if (!withLabel) return <span className={className}>{dot}</span>
  return (
    <span className={classNames('inline-flex items-center gap-1.5', className)}>
      {dot}
      <span className={online ? 'text-neon-green' : 'text-ink-faint'}>{online ? 'online' : 'offline'}</span>
    </span>
  )
}

/** An avatar wrapper that overlays a presence dot at the bottom-right. */
export function PresenceAvatar({
  online,
  children,
  dotSize = 11,
}: {
  online: boolean
  children: React.ReactNode
  dotSize?: number
}) {
  return (
    <span className="relative inline-block">
      {children}
      <span
        className={classNames(
          'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-term-900',
          online ? 'bg-neon-green' : 'bg-ink-faint',
        )}
        style={{ width: dotSize, height: dotSize }}
      />
    </span>
  )
}
