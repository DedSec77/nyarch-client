import { Icon } from './Icon'

interface AdminBadgeProps {
  size?: 'sm' | 'md'
  className?: string
}

/** A small "ADMIN" tag shown next to a user's name. */
export function AdminBadge({ size = 'md', className = '' }: AdminBadgeProps) {
  const sm = size === 'sm'
  return (
    <span
      title="Administrator"
      className={`inline-flex items-center gap-1 rounded border border-neon-amber/50 bg-neon-amber/10 font-bold uppercase tracking-wider text-neon-amber ${
        sm ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'
      } ${className}`}
    >
      <Icon name="shield" size={sm ? 9 : 11} /> admin
    </span>
  )
}
