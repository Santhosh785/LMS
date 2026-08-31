import { useEffect } from 'react'
import { cn } from './Button.jsx'

/**
 * Replaces the original [data-modal-open]/[data-modal-close] pattern:
 * backdrop click and Escape both dismiss, as they did before.
 */
export default function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(10,18,17,0.45)] p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      {/*
        Capped and scrolled: a tall form (the taxonomy editor, a program's page
        copy) otherwise runs past the bottom of the viewport and takes the Save
        button with it, with no way to reach it.
      */}
      <div
        className={cn(
          'flex max-h-[calc(100vh-2rem)] w-full flex-col rounded-lg2 bg-white shadow-soft',
          width,
        )}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-[1.05rem]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-mist hover:text-brand"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
