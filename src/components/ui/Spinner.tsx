import { useEffect, useState } from 'react'

const FRAMES = ['|', '/', '-', '\\']

/** ASCII terminal spinner. */
export function Spinner({ label = 'loading', className = '' }: { label?: string; className?: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % FRAMES.length), 90)
    return () => clearInterval(t)
  }, [])
  return (
    <div className={`flex items-center gap-2 font-mono text-sm text-ink-dim ${className}`}>
      <span className="text-neon-green">{FRAMES[i]}</span>
      <span>{label}…</span>
    </div>
  )
}

export function FullSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  )
}
