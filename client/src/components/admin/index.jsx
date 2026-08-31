import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { cn, EmptyState, Loading } from '../ui/index.jsx'

/* ------------------------------- Page header ------------------------------ */
export function PageHead({ title, sub, breadcrumb, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb && (
          <nav className="mb-1.5 text-[0.78rem] text-muted-admin" aria-label="Breadcrumb">
            {breadcrumb.map((b, i) => (
              <span key={b.label}>
                {i > 0 && <span className="px-1.5">/</span>}
                {b.to ? (
                  <Link to={b.to} className="hover:text-brand">
                    {b.label}
                  </Link>
                ) : (
                  <span>{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[1.45rem]">{title}</h1>
        {sub && <p className="mt-0.5 text-[0.88rem] text-muted-admin">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/* -------------------------------- Sub navs -------------------------------- */
/** The .course-tabs bar shared by the course and funnel pages. */
export function SubNavTabs({ tabs }) {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line-admin no-scrollbar">
      {tabs.map((t) => (
        <NavLink
          key={t.label}
          to={t.to}
          className={({ isActive }) =>
            cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-[0.86rem] font-semibold transition-colors duration-200 ease-gs',
              isActive
                ? 'border-brand text-brand'
                : 'border-transparent text-muted-admin hover:text-brand',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** The .with-side + .side-nav layout used by live, email, funnels, gamification. */
export function SideNavLayout({ items, title }) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-6 mx-960:grid-cols-1">
      <aside>
        {title && (
          <p className="mb-2 px-3 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted-admin">
            {title}
          </p>
        )}
        <nav className="grid gap-0.5">
          {items.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  'rounded-md2 px-3 py-2.5 text-[0.87rem] transition-colors duration-200 ease-gs',
                  isActive
                    ? 'bg-accent-soft font-semibold text-brand'
                    : 'text-muted-admin hover:bg-white hover:text-brand',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}

/* -------------------------------- Stat card ------------------------------- */
export function StatCard({ label, value, sub, delta }) {
  const up = delta?.startsWith('+')
  return (
    <div className="rounded-lg2 border border-line-admin bg-white p-5 shadow-admin">
      <p className="text-[0.8rem] text-muted-admin">{label}</p>
      <strong className="mt-1.5 block text-[1.5rem] leading-none text-brand-deep">{value}</strong>
      <div className="mt-2 flex items-center gap-2">
        {sub && <span className="text-[0.78rem] text-muted-admin">{sub}</span>}
        {delta && (
          <span className={cn('text-[0.75rem] font-bold', up ? 'text-ok' : 'text-danger-admin')}>
            {up ? '▲' : '▼'} {delta.replace(/^[+-]/, '')}
          </span>
        )}
      </div>
    </div>
  )
}

export function KpiRow({ children, cols = 4 }) {
  return (
    <div
      className={cn(
        'mb-6 grid gap-4 mx-1100:grid-cols-2 mx-720:grid-cols-1',
        cols === 6 ? 'grid-cols-6' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4',
      )}
    >
      {children}
    </div>
  )
}

/* ------------------------------- Type card -------------------------------- */
/** The .type-card single-select used by pricing, funnel-create and live themes. */
export function TypeCard({ selected, onSelect, title, body, icon }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-lg2 border p-4 text-left transition-colors duration-200 ease-gs',
        selected ? 'border-brand bg-accent-soft' : 'border-line-admin bg-white hover:border-brand',
      )}
    >
      {icon && (
        <span className="text-[1.2rem]" aria-hidden="true">
          {icon}
        </span>
      )}
      <h4 className="mt-1 text-[0.95rem]">{title}</h4>
      {body && <p className="mt-1 text-[0.8rem] text-muted-admin">{body}</p>}
    </button>
  )
}

/* -------------------------------- DataTable ------------------------------- */
/**
 * One table implementation for every admin list: client-side search over the
 * declared columns, click-to-sort headers, and simple pagination.
 */
export function DataTable({
  columns,
  rows = [],
  loading,
  searchable = true,
  searchPlaceholder = 'Search…',
  pageSize = 10,
  empty,
  toolbar,
  rowKey = (r) => r._id,
  onRowClick,
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 1 })
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows
    if (q) {
      out = rows.filter((row) =>
        columns.some((c) => {
          const v = c.value ? c.value(row) : row[c.key]
          return v != null && String(v).toLowerCase().includes(q)
        }),
      )
    }
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key)
      out = [...out].sort((a, b) => {
        const av = col?.value ? col.value(a) : a[sort.key]
        const bv = col?.value ? col.value(b) : b[sort.key]
        if (av == null) return 1
        if (bv == null) return -1
        return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir
      })
    }
    return out
  }, [rows, query, sort, columns])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize)

  return (
    <div className="rounded-lg2 border border-line-admin bg-white shadow-admin">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line-admin px-4 py-3">
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(0)
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-64 rounded-md2 border border-line-admin px-3 py-2 text-[0.85rem] outline-none focus:border-brand mx-640:w-full"
            />
          )}
          {toolbar && <div className="ml-auto flex flex-wrap gap-2">{toolbar}</div>}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <div className="p-4">
          {empty || (
            <EmptyState
              icon="🗂"
              title="Nothing to show"
              body="Try a different search or add a record."
            />
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[0.87rem]">
            <thead>
              <tr className="border-b border-line-admin bg-surface-admin/60 text-left">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="px-4 py-3 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-muted-admin"
                  >
                    {c.sortable === false ? (
                      c.label
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))
                        }
                        className="inline-flex items-center gap-1 hover:text-brand"
                      >
                        {c.label}
                        {sort.key === c.key && (
                          <span aria-hidden="true">{sort.dir === 1 ? '▲' : '▼'}</span>
                        )}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-line-admin last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-surface-admin/60',
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 align-middle">
                      {c.render ? c.render(row) : ((c.value ? c.value(row) : row[c.key]) ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-line-admin px-4 py-3 text-[0.82rem] text-muted-admin">
          <span>
            {current * pageSize + 1}–{Math.min((current + 1) * pageSize, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="rounded-md2 border border-line-admin px-3 py-1.5 disabled:opacity-40 hover:enabled:border-brand hover:enabled:text-brand"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="rounded-md2 border border-line-admin px-3 py-1.5 disabled:opacity-40 hover:enabled:border-brand hover:enabled:text-brand"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------- ChartMock ------------------------------- */
/**
 * The dashboard chart in the original was hand-written inline SVG, not a chart
 * library — keeping it that way preserves the look exactly.
 */
export function ChartSvg({ series = [], height = 180 }) {
  if (!series.length) {
    return (
      <p className="py-10 text-center text-[0.85rem] text-muted-admin">No revenue recorded yet.</p>
    )
  }

  const width = 640
  const max = Math.max(...series.map((s) => s.value), 1)
  const step = series.length > 1 ? width / (series.length - 1) : width
  const points = series.map((s, i) => [i * step, height - (s.value / max) * (height - 20) - 10])
  const line = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Revenue over time"
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3ecf8e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3ecf8e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={width}
            y1={height * f}
            y2={height * f}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#chart-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#135855"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <circle
            key={series[i].label}
            cx={x}
            cy={y}
            r="3.5"
            fill="#fff"
            stroke="#135855"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[0.7rem] text-muted-admin">
        {series.map((s) => (
          <span key={s.label}>{s.label}</span>
        ))}
      </div>
    </div>
  )
}
