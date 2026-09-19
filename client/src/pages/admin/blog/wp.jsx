import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Shared WordPress admin primitives.
 *
 * Everything here mirrors a real wp-admin part — dashicons, notices, the
 * list-table chrome, the media-frame modal — so the screens below read like
 * WordPress markup rather than like generic components wearing grey paint.
 */

/* --------------------------------- icons ---------------------------------- */

/** 24×24 paths, in the style of Gutenberg's icon set. */
const ICONS = {
  wordpress:
    'M12 2a10 10 0 100 20 10 10 0 000-20zm0 1.4a8.6 8.6 0 110 17.2 8.6 8.6 0 010-17.2zM6.6 8.4l2.3 7.2h.8l1.8-5.3 1.8 5.3h.8l2.3-7.2h-1.4l-1.4 4.7-1.6-4.7h-.9l-1.6 4.7L8 8.4z',
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  post: 'M18.6 2.6l2.8 2.8-2 2-1-1-3.4 3.4.7 2.8-2 2-3.4-3.4-6 6-1.4-1.4 6-6L5.5 9.4l2-2 2.8.7 3.4-3.4-1-1 2-2z',
  media:
    'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm.5 16a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5V5A.5.5 0 015 4.5h14a.5.5 0 01.5.5v14zM8 9.5a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM6 18h12l-3.6-5.4-2.7 3.6-1.9-2.2L6 18z',
  page: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm3.9 18H6.1V4h6.6v5.3h5.2V20z',
  comments:
    'M20 3H4a2 2 0 00-2 2v10a2 2 0 002 2h2.6v4l4.4-4H20a2 2 0 002-2V5a2 2 0 00-2-2zm.5 12a.5.5 0 01-.5.5h-9.6L8 18v-2.5H4a.5.5 0 01-.5-.5V5A.5.5 0 014 4.5h16a.5.5 0 01.5.5v10z',
  appearance:
    'M20.7 3.3a2.4 2.4 0 00-3.4 0l-7.8 7.8 3.4 3.4 7.8-7.8a2.4 2.4 0 000-3.4zM7 14.5c-1.7 0-3 1.3-3 3 0 1.2-1 2-2 2 .9 1.3 2.5 2 4 2 2.2 0 4-1.8 4-4 0-1.7-1.3-3-3-3z',
  users:
    'M12 12a4 4 0 100-8 4 4 0 000 8zm0 1.6c-3.6 0-7.5 1.8-7.5 4.4V20h15v-2c0-2.6-3.9-4.4-7.5-4.4z',
  settings:
    'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm0 5.5a2 2 0 110-4 2 2 0 010 4zm8.6-2l1.7-1.4-1.7-3-2.1.7a7.4 7.4 0 00-1.7-1l-.4-2.2h-3.4l-.5 2.2c-.6.2-1.2.6-1.7 1l-2.1-.7-1.7 3L7.4 12c0 .3-.1.6-.1.9l-1.7 1.4 1.7 3 2.1-.7c.5.4 1 .8 1.7 1l.5 2.2h3.4l.4-2.2c.6-.2 1.2-.6 1.7-1l2.1.7 1.7-3-1.7-1.4c.1-.3.1-.6.1-.9s0-.6-.1-.9z',
  tools:
    'M18.7 5.3a4.5 4.5 0 01-5.8 5.8l-6 6a1.6 1.6 0 01-2.3-2.3l6-6a4.5 4.5 0 015.8-5.8L14 5.7l.6 2.6 2.6.6 1.5-3.6z',
  plus: 'M18 11.2h-5.2V6h-1.6v5.2H6v1.6h5.2V18h1.6v-5.2H18z',
  close: 'M13 11.9l5.6-5.8-1-1L12 10.8 6.4 5.1l-1 1 5.6 5.8-5.6 5.8 1 1 5.6-5.7 5.6 5.7 1-1z',
  check: 'M9.7 16.6L5 12l-1.4 1.4 6.1 6.1L20.4 8.8 19 7.4z',
  undo: 'M18.3 11.7c-.6-.6-1.4-.9-2.3-.9H6.7l2.9-3.3-1.1-1-4.5 5 4.5 4.5 1-1-3-3H16c.5 0 .9.2 1.3.5.8.8.8 2.4 0 3.2-.4.3-.8.5-1.3.5h-3v1.5h3c.9 0 1.7-.3 2.3-.9.6-.6 1-1.4 1-2.3s-.4-1.7-1-2.3z',
  redo: 'M5.7 11.7c.6-.6 1.4-.9 2.3-.9h9.3l-2.9-3.3 1.1-1 4.5 5-4.5 4.5-1-1 3-3H8c-.5 0-.9.2-1.3.5-.8.8-.8 2.4 0 3.2.4.3.8.5 1.3.5h3v1.5H8c-.9 0-1.7-.3-2.3-.9-.6-.6-1-1.4-1-2.3s.4-1.7 1-2.3z',
  listView: 'M4 5.5h16V7H4V5.5zM8 11.2h12v1.5H8v-1.5zm12 5.8H8v1.5h12V17zM4 11.2h2.5v1.5H4v-1.5zM6.5 17H4v1.5h2.5V17z',
  sidebar:
    'M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2zm.5 14a.5.5 0 01-.5.5h-4V5.5h4a.5.5 0 01.5.5v12z',
  search:
    'M13 5.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM6 11a7 7 0 1112.5 4.3l4.1 4.2-1.1 1-4.1-4.2A7 7 0 016 11z',
  edit: 'M20.1 5.6l-1.7-1.7a1.2 1.2 0 00-1.7 0l-1.2 1.2 3.4 3.4 1.2-1.2c.5-.5.5-1.2 0-1.7zM4 16.6V20h3.4l9.4-9.4-3.4-3.4L4 16.6z',
  trash:
    'M15 4V2.8H9V4H4.5v1.5h15V4H15zM6 7v12.2A1.8 1.8 0 007.8 21h8.4a1.8 1.8 0 001.8-1.8V7H6zm4 10.5H8.5v-7H10v7zm5.5 0H14v-7h1.5v7z',
  visibility:
    'M12 5C6.8 5 2.7 10.4 2.2 11.1L1.6 12l.6.9C2.7 13.6 6.8 19 12 19s9.3-5.4 9.8-6.1l.6-.9-.6-.9C20.3 10.4 17.2 5 12 5zm0 12c-3.5 0-6.7-3.5-7.7-5 1-1.5 4.2-5 7.7-5s6.7 3.5 7.7 5c-1 1.5-4.2 5-7.7 5zm0-8.2a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z',
  external:
    'M18.5 6.9l-7 7-1-1 7-7h-4.1V4.4H20v6.2h-1.5V6.9zM18 18.5H6v-12h5.2V5H4.5v15h15v-6.7H18v5.2z',
  chevronDown: 'M17.5 11.6L12 16l-5.5-4.4.9-1.2L12 14l4.5-3.6 1 1.2z',
  chevronUp: 'M6.5 12.4L12 8l5.5 4.4-.9 1.2L12 10l-4.5 3.6-1-1.2z',
  chevronLeft: 'M14.6 7l-1.2-.9L8 12l5.4 5.9 1.2-.9-4.6-5z',
  chevronRight: 'M10.6 6.1L9.4 7l4.6 5-4.6 5 1.2.9L16 12z',
  arrowUp: 'M12 4.5l6.5 6.5-1.1 1.1-4.6-4.6V20h-1.6V7.5l-4.6 4.6L5.5 11z',
  arrowDown: 'M12 19.5L5.5 13l1.1-1.1 4.6 4.6V4h1.6v12.5l4.6-4.6 1.1 1.1z',
  arrowLeft: 'M4.5 12L11 5.5l1.1 1.1-4.6 4.6H20v1.6H7.5l4.6 4.6-1.1 1.1z',
  calendar:
    'M18 4h-1.5V2.5H15V4H9V2.5H7.5V4H6a2 2 0 00-2 2v13a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2zm.5 15a.5.5 0 01-.5.5H6a.5.5 0 01-.5-.5V9.5h13V19z',
  category: 'M5 4h5l2 2.5h7a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  tag: 'M11.4 3H4v7.4l9.3 9.3 7.4-7.4L11.4 3zM7.2 8.7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  star: 'M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9z',
  paragraph: 'M14 5v14h-1.6V6.6H10V19H8.4v-6.2a3.9 3.9 0 010-7.8H19V7h-3.4v12H14z',
  heading: 'M6 5h1.8v5.6h8.4V5H18v14h-1.8v-6.6H7.8V19H6z',
  list: 'M5 6.5h2v2H5v-2zm4 .2h11v1.5H9V6.7zm-4 4.3h2v2H5v-2zm4 .2h11v1.5H9v-1.5zm-4 4.3h2v2H5v-2zm4 .2h11v1.5H9v-1.5z',
  listNumbered:
    'M4.2 6h1.2v3.2h.9V5.2H4.2V6zm5 .7h11v1.5h-11V6.7zm0 4.5h11v1.5h-11v-1.5zm0 4.5h11v1.5h-11v-1.5zM4 11.2h2.4v.7l-1.5 1.7h1.6v.8H3.9v-.7l1.5-1.8H4zm.1 4.4h2.3v3.1H4.1v-.7h1.4v-.5H4.4v-.7h1.1v-.5H4.1z',
  quote: 'M6 5h5v6.3c0 3.5-1.7 6.1-5 7.7v-2.2c1.7-1.1 2.6-2.6 2.6-4.5H6V5zm7 0h5v6.3c0 3.5-1.7 6.1-5 7.7v-2.2c1.7-1.1 2.6-2.6 2.6-4.5H13V5z',
  image:
    'M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm.5 14a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5v-2.7l3.6-3.2 3.2 3.1 4.2-3.5 4 3.3V18zM8.5 8a1.6 1.6 0 100 3.2A1.6 1.6 0 008.5 8z',
  code: 'M8.4 6.1L3 12l5.4 5.9 1.2-1.1L5.1 12l4.5-4.8-1.2-1.1zm7.2 0l-1.2 1.1 4.5 4.8-4.5 4.8 1.2 1.1L21 12l-5.4-5.9z',
  separator: 'M4 11.2h16v1.6H4z',
  button:
    'M19 6.5H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm.5 9a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5v-7A.5.5 0 015 8h14a.5.5 0 01.5.5v7zM8 11.2h8v1.6H8z',
  embed:
    'M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm.5 14a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5V6A.5.5 0 014 5.5h16a.5.5 0 01.5.5v12zM10 8.5v7l6-3.5-6-3.5z',
  table:
    'M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm.5 5.5h-6V6h5.5a.5.5 0 01.5.5v3zM13 6v3.5H3.5v-3A.5.5 0 014 6h9zM3.5 11h9.5v3.5H3.5V11zm0 7v-2h9.5v2.5H4a.5.5 0 01-.5-.5zm17 0a.5.5 0 01-.5.5h-5.5V16h6v2zm0-3.5h-6V11h6v3.5z',
  callout:
    'M12 3.5A8.5 8.5 0 1020.5 12 8.5 8.5 0 0012 3.5zm.8 13h-1.6v-1.6h1.6v1.6zm0-3.1h-1.6V7.5h1.6v5.9z',
  info: 'M12 3.5A8.5 8.5 0 1020.5 12 8.5 8.5 0 0012 3.5zm.8 13h-1.6v-6h1.6v6zm0-7.6h-1.6V7.3h1.6v1.6z',
  warning: 'M12 3.5L2.5 20h19L12 3.5zm.8 13.9h-1.6v-1.6h1.6v1.6zm0-3.1h-1.6v-4.6h1.6v4.6z',
  grid: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
  rows: 'M4 5.5h16V9H4V5.5zM4 10.5h16V14H4v-3.5zM4 15.5h16V19H4v-3.5z',
  upload: 'M12 4l5 5-1.1 1.1-3.1-3.1V16h-1.6V7l-3.1 3.1L7 9l5-5zM4.5 18.5h15V20h-15z',
  more: 'M13 6a1 1 0 11-2 0 1 1 0 012 0zm0 6a1 1 0 11-2 0 1 1 0 012 0zm-1 7a1 1 0 100-2 1 1 0 000 2z',
  menu: 'M4 6h16v1.6H4V6zm0 5.2h16v1.6H4v-1.6zM20 16.4H4V18h16v-1.6z',
  alignLeft: 'M4 5.5h16V7H4V5.5zM4 10.5h10V12H4v-1.5zM4 15.5h16V17H4v-1.5z',
  alignCenter: 'M4 5.5h16V7H4V5.5zM7 10.5h10V12H7v-1.5zM4 15.5h16V17H4v-1.5z',
  alignRight: 'M4 5.5h16V7H4V5.5zM10 10.5h10V12H10v-1.5zM4 15.5h16V17H4v-1.5z',
  fullscreen: 'M4 4h6v1.6H5.6V10H4V4zm10 0h6v6h-1.6V5.6H14V4zM4 14h1.6v4.4H10V20H4v-6zm14.4 0H20v6h-6v-1.6h4.4V14z',
  copy: 'M16 3H6a2 2 0 00-2 2v12h1.6V5A.4.4 0 016 4.6h10V3zm3 3.5H9.5a2 2 0 00-2 2V19a2 2 0 002 2H19a2 2 0 002-2V8.5a2 2 0 00-2-2zm.4 12.5a.4.4 0 01-.4.4H9.5a.4.4 0 01-.4-.4V8.5a.4.4 0 01.4-.4H19a.4.4 0 01.4.4V19z',
  reply: 'M9 5.5L3 11l6 5.5v-3.4h4.5c3 0 5.5 2.4 5.5 5.4h1.5c0-3.8-3.1-6.9-7-6.9H9V5.5z',
  spam: 'M12 3.5L3.5 8.2v7.6L12 20.5l8.5-4.7V8.2L12 3.5zm.8 12.9h-1.6v-1.6h1.6v1.6zm0-3.2h-1.6V7.6h1.6v5.6z',
  clock:
    'M12 3.5A8.5 8.5 0 1020.5 12 8.5 8.5 0 0012 3.5zm0 15.5a7 7 0 117-7 7 7 0 01-7 7zm.8-11.3h-1.6v4.9l3.7 2.2.8-1.3-2.9-1.7V7.7z',
}

export function Icon({ name, size = 24, className, ...rest }) {
  const path = ICONS[name]
  if (!path) return null
  return (
    <svg
      className={['wp-icon', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={path} />
    </svg>
  )
}

/* --------------------------------- format --------------------------------- */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: '2-digit' }) : '—'

export const fmtDateTime = (value) =>
  value
    ? `${new Date(value).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: '2-digit' })} at ${new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : '—'

/** The value a datetime-local input wants, in the browser's own timezone. */
export const toLocalInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export const monthLabel = (key) => `${MONTHS[Number(String(key).slice(4)) - 1] || ''} ${String(key).slice(0, 4)}`

export function timeAgo(value) {
  if (!value) return ''
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const units = [
    [60, 'min'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
  ]
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const [size, label] = units[i]
    if (seconds >= size) {
      const n = Math.floor(seconds / size)
      return `${n} ${label}${n === 1 ? '' : 's'} ago`
    }
  }
  return 'just now'
}

export const fileSize = (bytes = 0) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/* -------------------------------- notices --------------------------------- */

let noticeId = 0

/** WordPress's admin notices: dismissible, stacked under the page heading. */
export function useNotices() {
  const [notices, setNotices] = useState([])
  const dismiss = useCallback((id) => setNotices((rows) => rows.filter((row) => row.id !== id)), [])
  const notify = useCallback((message, type = 'success') => {
    const id = (noticeId += 1)
    setNotices((rows) => [...rows, { id, message, type }])
    if (type === 'success') setTimeout(() => dismiss(id), 6000)
    return id
  }, [dismiss])

  const node = notices.length ? (
    <div>
      {notices.map((notice) => (
        <Notice key={notice.id} type={notice.type} onDismiss={() => dismiss(notice.id)}>
          {notice.message}
        </Notice>
      ))}
    </div>
  ) : null

  return { notices, notify, dismiss, node }
}

export function Notice({ type = 'info', children, onDismiss }) {
  return (
    <div className={`wp-notice wp-notice-${type}`}>
      <p>{children}</p>
      {onDismiss && (
        <button type="button" className="wp-notice-dismiss" onClick={onDismiss} aria-label="Dismiss this notice">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className="wp-spinner" />
      {label && <span style={{ color: '#646970' }}>{label}</span>}
    </span>
  )
}

/* ------------------------------ list tables ------------------------------- */

/** The "All | Published | Draft" status rail above a list table. */
export function Views({ views, current, onChange }) {
  return (
    <ul className="wp-subsubsub">
      {views.map((view) => (
        <li key={view.value}>
          <button
            type="button"
            className={current === view.value ? 'is-current' : ''}
            onClick={() => onChange(view.value)}
            aria-current={current === view.value ? 'page' : undefined}
          >
            {view.label} <span className="count">({view.count ?? 0})</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function RowActions({ actions }) {
  const visible = actions.filter(Boolean)
  return (
    <div className="wp-row-actions">
      {visible.map((action, index) => (
        <span key={action.label} className={action.destructive ? 'trash' : undefined}>
          {index > 0 && <span className="sep">|</span>}
          {action.href ? (
            <a href={action.href} target={action.external ? '_blank' : undefined} rel="noreferrer">
              {action.label}
            </a>
          ) : (
            <button type="button" onClick={action.onClick}>
              {action.label}
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

export function Pagination({ page, pages, total, perPage, onPage, noun = 'item' }) {
  if (!total) return null
  const go = (next) => onPage(Math.min(Math.max(next, 1), pages))

  return (
    <div className="wp-tablenav-pages">
      <span className="wp-displaying-num">
        {total} {noun}
        {total === 1 ? '' : 's'}
      </span>
      {pages > 1 && (
        <span className="wp-pagination-links">
          <button type="button" onClick={() => go(1)} disabled={page === 1} aria-label="First page">
            «
          </button>
          <button type="button" onClick={() => go(page - 1)} disabled={page === 1} aria-label="Previous page">
            ‹
          </button>
          <span className="wp-paging-input">
            {/* Keyed on `page` so a page change resets the field, rather than
                mirroring the prop into state and re-rendering twice. */}
            <input
              key={page}
              type="text"
              defaultValue={page}
              aria-label="Current page"
              onBlur={(event) => go(Number(event.target.value) || 1)}
              onKeyDown={(event) => event.key === 'Enter' && go(Number(event.currentTarget.value) || 1)}
            />
            <span>of {pages}</span>
          </span>
          <button type="button" onClick={() => go(page + 1)} disabled={page === pages} aria-label="Next page">
            ›
          </button>
          <button type="button" onClick={() => go(pages)} disabled={page === pages} aria-label="Last page">
            »
          </button>
        </span>
      )}
      {perPage ? <span className="wp-screen-reader-text">{perPage} per page</span> : null}
    </div>
  )
}

/** The sortable column header WordPress renders as a link plus an arrow. */
export function SortableTh({ column, label, orderby, order, onSort, className, style }) {
  const active = orderby === column
  return (
    <th
      scope="col"
      className={`${active ? 'sorted' : 'sortable'} ${className || ''}`}
      style={style}
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" onClick={() => onSort(column, active && order === 'asc' ? 'desc' : 'asc')}>
        <span>{label}</span>
        <span className={`sorting-indicator ${active ? order : 'desc'}`} />
      </button>
    </th>
  )
}

/* ---------------------------- screen meta tabs ---------------------------- */

export function ScreenMeta({ options, help }) {
  const [open, setOpen] = useState('')
  return (
    <>
      <div className="wp-screen-meta-links">
        {options && (
          <button
            type="button"
            className="wp-screen-meta-toggle"
            aria-expanded={open === 'options'}
            onClick={() => setOpen(open === 'options' ? '' : 'options')}
          >
            Screen Options <Icon name={open === 'options' ? 'chevronUp' : 'chevronDown'} size={16} />
          </button>
        )}
        {help && (
          <button
            type="button"
            className="wp-screen-meta-toggle"
            aria-expanded={open === 'help'}
            onClick={() => setOpen(open === 'help' ? '' : 'help')}
          >
            Help <Icon name={open === 'help' ? 'chevronUp' : 'chevronDown'} size={16} />
          </button>
        )}
      </div>
      {open === 'options' && <div className="wp-screen-meta">{options}</div>}
      {open === 'help' && <div className="wp-screen-meta">{help}</div>}
    </>
  )
}

/* -------------------------------- metabox --------------------------------- */

export function Postbox({ title, actions, children, defaultOpen = true, className }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`wp-postbox ${open ? '' : 'is-closed'} ${className || ''}`}>
      <div className="wp-postbox-header" onClick={() => setOpen(!open)} role="presentation">
        <h2 className="wp-postbox-title">{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()} role="presentation">
          {actions}
          <button
            type="button"
            className="wp-postbox-toggle"
            aria-expanded={open}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={20} />
          </button>
        </div>
      </div>
      <div className="wp-postbox-body">{children}</div>
    </div>
  )
}

/* --------------------------------- modal ---------------------------------- */

export function WpModal({ open, title, onClose, children, footer, small }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="wp-modal-backdrop wp-admin"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <div className={`wp-modal ${small ? 'wp-modal-small' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="wp-modal-header">
          <h1>{title}</h1>
          <button type="button" className="wp-modal-close" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="wp-modal-body">{children}</div>
        {footer && <div className="wp-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

/** WordPress confirms destructive actions with a plain dialog, not a toast. */
export function ConfirmDialog({ open, title, message, confirmLabel = 'OK', onConfirm, onClose, destructive }) {
  return (
    <WpModal
      open={open}
      title={title}
      onClose={onClose}
      small
      footer={
        <>
          <button type="button" className="wp-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="wp-button wp-button-primary"
            style={destructive ? { background: '#b32d2e', borderColor: '#b32d2e' } : undefined}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 14, margin: 0 }}>{message}</p>
    </WpModal>
  )
}

/* -------------------------------- dropdown -------------------------------- */

/** Closes on an outside click or Escape — used by every menu in these screens. */
export function useDismissable(onDismiss) {
  const ref = useRef(null)
  useEffect(() => {
    const onDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss()
    }
    const onKey = (event) => event.key === 'Escape' && onDismiss()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onDismiss])
  return ref
}

/** Persists a Screen Options preference the way WordPress stores user meta. */
export function useScreenOption(key, fallback) {
  const storageKey = `wp-screen:${key}`
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      return saved === null ? fallback : JSON.parse(saved)
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      /* a private-mode browser simply forgets the preference */
    }
  }, [storageKey, value])
  return [value, setValue]
}
