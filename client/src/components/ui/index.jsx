import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from './Button.jsx'

export { default as Button, buttonClass, cn } from './Button.jsx'
export { default as Modal } from './Modal.jsx'

/* --------------------------------- Toast --------------------------------- */
/** Replaces the showToast helpers in student.js and admin.js (2.2s auto-hide). */
export function useToast() {
  const [message, setMessage] = useState(null)
  const timer = useRef()

  const show = useCallback((msg) => {
    setMessage(msg)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2200)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const node = message ? (
    <div className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-brand-deep px-5 py-3 text-sm font-medium text-white shadow-soft">
      {message}
    </div>
  ) : null

  return { show, node, message }
}

/* ---------------------------------- Pill --------------------------------- */
const pillTones = {
  ok: 'bg-accent-soft text-brand',
  draft: 'bg-surface-mist text-muted',
  live: 'bg-[#fee2e2] text-danger',
  warn: 'bg-[#fef3c7] text-warn',
  neutral: 'bg-surface-mist text-muted',
}

export function Pill({ tone = 'neutral', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold',
        pillTones[tone] || pillTones.neutral,
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Maps the statuses used across the admin tables onto pill tones. */
export function StatusPill({ status }) {
  const tone = [
    'Published',
    'Active',
    'SUCCESS',
    'Subscribed',
    'Live',
    'Purchased',
    'Completed',
    'Issued',
  ].includes(status)
    ? 'ok'
    : ['Draft', 'Not started', 'Unsubscribed', 'Paused', 'In progress'].includes(status)
      ? 'draft'
      : ['REFUNDED', 'FAILED', 'Cancelled'].includes(status)
        ? 'live'
        : ['Trial', 'New', 'Nurture', 'PENDING'].includes(status)
          ? 'warn'
          : 'neutral'
  return <Pill tone={tone}>{status}</Pill>
}

/* --------------------------------- Toggle -------------------------------- */
/** The .toggle switch from admin.js — is-on class plus aria-pressed. */
export function Toggle({ checked, onChange, label, id }) {
  return (
    <button
      type="button"
      id={id}
      aria-pressed={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-gs',
        checked ? 'bg-accent' : 'bg-[#d7dedb]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-tiny transition-all duration-200 ease-gs',
          checked ? 'left-[1.4rem]' : 'left-0.5',
        )}
      />
    </button>
  )
}

/* ------------------------------- Form fields ------------------------------ */
/**
 * A switch with its label beside it.
 *
 * `Toggle` on its own is a bare control: it takes `label` for `aria-label` and
 * renders no text, because most screens lay the wording out themselves. Passing
 * a label to it and expecting to see something produces a row of unexplained
 * switches — which is what the taxonomy editor was doing. Use this wherever the
 * label is not already on the page.
 */
export function ToggleField({ id, label, hint, checked, onChange, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <label htmlFor={id} className="cursor-pointer">
        <span className="text-[0.9rem] font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.8rem] text-muted">{hint}</span>}
      </label>
      <Toggle id={id} label={label} checked={checked} onChange={onChange} />
    </div>
  )
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 block text-[0.82rem] font-semibold text-brand-deep">{label}</span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-[0.75rem] text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-[0.75rem] text-danger">{error}</span>}
    </label>
  )
}

/**
 * `mx-768:text-base` is not cosmetic. iOS Safari auto-zooms the page whenever a
 * focused input's font-size is below 16px, and 0.9rem is 14.4px — so every tap
 * into the checkout form zoomed the viewport, pushing the layout sideways and
 * leaving the buyer scrolled off the field they were typing in. Forcing 16px at
 * phone widths removes the zoom entirely; desktop keeps the original size.
 *
 * `min-h-[44px]` gives every field a thumb-sized target, matching the buttons.
 */
export const inputClass =
  'w-full min-h-[44px] rounded-md2 border border-line bg-white px-3 py-2.5 text-[0.9rem] text-ink ' +
  'mx-768:text-base ' +
  'outline-none transition-colors duration-200 ease-gs focus:border-brand ' +
  'placeholder:text-muted/70'

export function TextField({ label, hint, error, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <input className={cn(inputClass, error && 'border-danger')} {...rest} />
    </Field>
  )
}

export function SelectField({ label, hint, error, options = [], className, children, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <select className={cn(inputClass, 'appearance-none pr-8')} {...rest}>
        {children ||
          options.map((o) =>
            typeof o === 'string' ? (
              <option key={o} value={o}>
                {o}
              </option>
            ) : (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ),
          )}
      </select>
    </Field>
  )
}

export function TextAreaField({ label, hint, error, rows = 4, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <textarea rows={rows} className={cn(inputClass, 'resize-y')} {...rest} />
    </Field>
  )
}

/* ------------------------------- Empty state ------------------------------ */
export function EmptyState({ icon = '🗂', title, body, action }) {
  return (
    <div className="grid place-items-center gap-2 rounded-lg2 border border-dashed border-line bg-white px-6 py-14 text-center">
      <span className="text-3xl" aria-hidden="true">
        {icon}
      </span>
      <h3 className="text-[1.05rem]">{title}</h3>
      {body && <p className="max-w-sm text-[0.9rem] text-muted">{body}</p>}
      {action}
    </div>
  )
}

/* --------------------------------- Panel --------------------------------- */
export function Panel({ title, actions, children, className, bodyClass }) {
  return (
    <section className={cn('rounded-lg2 border border-line bg-white shadow-admin', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          {typeof title === 'string' ? <h2 className="text-[1rem]">{title}</h2> : title}
          {actions}
        </header>
      )}
      <div className={cn('p-5', bodyClass)}>{children}</div>
    </section>
  )
}

/* -------------------------------- Spinner -------------------------------- */
export function Loading({ label = 'Loading…' }) {
  return <p className="px-1 py-10 text-center text-sm text-muted">{label}</p>
}

export function ErrorNote({ error }) {
  if (!error) return null
  return (
    <p className="rounded-md2 border border-danger/30 bg-danger/5 px-3 py-2 text-[0.85rem] text-danger">
      {typeof error === 'string' ? error : error.message}
    </p>
  )
}
