import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-term-950/80 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={onClose}
    >
      <div
        className={`panel animate-fade-in w-full ${width} my-8 shadow-glow`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <span className="tui-dots" />
          <span className="font-medium text-ink">{title}</span>
          <button
            onClick={onClose}
            className="ml-auto text-ink-faint transition-colors hover:text-neon-red"
            aria-label="close"
          >
            [x]
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
