import { accentFor, initials } from '@/lib/utils'

interface AvatarProps {
  src?: string | null
  name: string
  size?: number
  className?: string
  ring?: boolean
}

export function Avatar({ src, name, size = 36, className = '', ring = false }: AvatarProps) {
  const accent = accentFor(name)
  const style = { width: size, height: size, fontSize: size * 0.4 }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-md object-cover ${ring ? 'ring-1 ring-term-700' : ''} ${className}`}
      />
    )
  }

  return (
    <div
      style={{ ...style, borderColor: accent, color: accent }}
      className={`flex shrink-0 select-none items-center justify-center rounded-md border bg-term-850 font-bold ${className}`}
    >
      {initials(name)}
    </div>
  )
}
