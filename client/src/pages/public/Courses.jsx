import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { sortLabels } from '../../data/nav.js'
import { Button, cn, EmptyState, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useFilterGroups from '../../hooks/useFilterGroups.js'
import CoverArt from '../../components/CoverArt.jsx'

const PAGE_SIZE = 9

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** Reads a comma-list param into an array. */
const readList = (params, key) =>
  (params.get(key) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export function ExploreCard({ course }) {
  return (
    <Link
      to={`/courses/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg2 border border-line bg-white shadow-softer transition-all duration-[250ms] ease-gs hover:-translate-y-1 hover:shadow-card"
    >
      <div className="relative">
        <CoverArt
          image={course.image}
          imageAlt={course.imageAlt}
          gradientClass={course.thumbClass}
          label={course.mediaLabel || course.title}
          className="h-40 px-4"
          sizes="(max-width: 640px) 100vw, (max-width: 1040px) 50vw, 33vw"
        />
        {/* .badge-row sits at the bottom of the media, as in the original */}
        <div className="absolute inset-x-[0.65rem] bottom-[0.65rem] z-[2] flex justify-between gap-2">
          <span className="rounded-full bg-white/92 px-2.5 py-1 text-[0.7rem] font-semibold text-brand-deep">
            🌐 {course.languages?.join(' + ').replace('English', 'EN')}
          </span>
          {/*
            A rating is a claim about the business made to a prospective buyer.
            Task 13 zeroes the figures invented for the demo, and a zero rating
            renders as nothing at all rather than as "★ 0" — no stars is honest,
            zero stars is a worse lie than the invented number was.
          */}
          {course.rating > 0 && (
            <span className="rounded-full bg-white/92 px-2.5 py-1 text-[0.7rem] font-semibold text-brand-deep">
              ★ {course.rating}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <h3 className="text-[1.02rem]">{course.title}</h3>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-muted">
            <span>⏱ {course.hours} Hrs</span>
            {course.enrolledCount > 0 && (
              <span>👤 {course.enrolledLabel || `${course.enrolledCount} Enrolled`}</span>
            )}
          </p>
          {/* the catalog card showed a single price; the strike lives on the detail page */}
          <span className="text-[1.05rem] font-bold text-brand-deep">
            {course.amount ? inr(course.amount) : 'Free'}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function Courses() {
  useDocumentTitle('Explore Courses | Growth Scholar')
  const [searchParams, setSearchParams] = useSearchParams()
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [search, setSearch] = useState(searchParams.get('q') || '')

  const sort = searchParams.get('sort') || 'popularity'
  // Assembled from the published taxonomy plus the fixed facets — see the hook.
  const filterGroups = useFilterGroups()

  /**
   * The original defaulted "Paid" to checked when the URL carried no facet at
   * all; the server applies the same rule, so the sidebar has to reflect it.
   */
  const hasFacet = ['price', 'type', 'topic', 'lang', 'category', 'tag'].some((k) =>
    searchParams.get(k),
  )
  const selected = useMemo(() => {
    const map = Object.fromEntries(filterGroups.map((g) => [g.key, readList(searchParams, g.key)]))
    if (!hasFacet && !map.price?.length) map.price = ['paid']
    return map
  }, [searchParams, hasFacet, filterGroups])

  // debounce the search box so typing doesn't fire a request per keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Extracted to a variable because a call expression in a dependency array
  // cannot be checked statically — the linter has to take it on trust, which is
  // how a dependency quietly stops being tracked after a refactor.
  const searchParamsKey = searchParams.toString()
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE)
  }, [searchParamsKey, debouncedSearch])

  useEffect(() => {
    const onDocClick = () => setSortOpen(false)
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const queryParams = {
    ...Object.fromEntries(
      Object.entries(selected)
        .filter(([, v]) => v.length)
        .map(([k, v]) => [k, v.join(',')]),
    ),
    sort,
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    limit: visibleLimit,
  }

  const { data, isPending } = useQuery({
    queryKey: ['courses', queryParams],
    queryFn: async () => (await api.get('/courses', { params: queryParams })).data,
    placeholderData: keepPreviousData,
  })

  const items = data?.items || []
  const total = data?.total ?? 0

  /** Writes the current selection back to the URL, same contract as before. */
  const commit = (next, nextSearch = search, nextSort = sort) => {
    const params = new URLSearchParams()
    for (const group of filterGroups) {
      const values = next[group.key] || []
      if (values.length) params.set(group.key, values.join(','))
    }
    params.set('sort', nextSort || 'popularity')
    if (nextSearch.trim()) params.set('q', nextSearch.trim())
    setSearchParams(params, { replace: true })
  }

  const toggleFilter = (group, value) => {
    const current = selected[group.key] || []
    const next = { ...selected }
    if (group.single) {
      next[group.key] = current.includes(value) ? [] : [value]
    } else {
      next[group.key] = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    }
    commit(next)
  }

  const reset = () => {
    setSearch('')
    commit({ price: ['paid'] }, '', 'popularity')
  }

  /* -------------------------------- chips -------------------------------- */
  const chips = [{ key: 'sort', label: `Sort by - ${sortLabels[sort] || 'Popularity'}` }]
  for (const group of filterGroups) {
    for (const value of selected[group.key] || []) {
      const opt = group.options.find((o) => o.value === value)
      chips.push({ key: group.key, value, label: opt?.label || value })
    }
  }
  if (debouncedSearch.trim()) chips.push({ key: 'q', label: `“${debouncedSearch.trim()}”` })

  const removeChip = (chip) => {
    if (chip.key === 'sort') return commit(selected, search, 'popularity')
    if (chip.key === 'q') {
      setSearch('')
      return commit(selected, '')
    }
    const next = { ...selected, [chip.key]: selected[chip.key].filter((v) => v !== chip.value) }
    return commit(next)
  }

  return (
    <div className="px-5 py-10">
      <div className="mx-auto max-w-shell">
        <nav className="mb-4 text-[0.9rem] text-muted" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-brand">
            Home
          </Link>
          <span className="px-1.5">→</span>
          <Link to="/courses/category" className="hover:text-brand">
            Marketing
          </Link>
          <span className="px-1.5">→</span>
          <span>Explore</span>
        </nav>

        {/* .explore-top: breadcrumb on the left, tools pushed right */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
            className="hidden items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[0.85rem] font-semibold text-brand mx-960:inline-flex"
          >
            ⚙ Filters
          </button>

          <form
            role="search"
            onSubmit={(e) => e.preventDefault()}
            className="ml-auto flex h-[42px] w-[min(320px,42vw)] min-w-[240px] items-center rounded-full border border-line bg-white px-4 mx-480:ml-0 mx-480:w-full"
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => commit(selected, search)}
              placeholder="Search"
              aria-label="Search courses"
              // text-base below 768: iOS zooms the viewport on any focused
              // input under 16px. See the note on `inputClass`.
              className="flex-1 border-0 bg-transparent text-[0.92rem] outline-none mx-768:text-base"
            />
            <span className="pl-2 text-muted" aria-hidden="true">
              ⌕
            </span>
          </form>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-[0.85rem] font-semibold text-brand"
            >
              Sort by · {sortLabels[sort]} ▾
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-56 rounded-lg2 border border-line bg-white p-2 shadow-soft">
                {Object.entries(sortLabels).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      commit(selected, search, value)
                      setSortOpen(false)
                    }}
                    className={cn(
                      'block w-full rounded-md2 px-3 py-2 text-left text-[0.85rem]',
                      sort === value
                        ? 'bg-accent-soft font-semibold text-brand'
                        : 'text-muted hover:bg-surface-mist',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[248px_1fr] gap-8 mx-960:grid-cols-1">
          {/* .filter-panel — one grey sticky panel with collapsible groups */}
          <aside
            aria-label="Filters"
            className={cn(
              'sticky top-[calc(76px+1rem)] self-start rounded-lg2 bg-[#f3f4f6] px-4 pb-[1.15rem] pt-4 mx-960:static mx-960:hidden',
              filtersOpen && 'mx-960:block',
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[1.05rem]">Filter by</h2>
              <button
                type="button"
                onClick={reset}
                className="text-[0.85rem] font-semibold text-brand"
              >
                Reset all
              </button>
            </div>
            {/*
              A taxonomy-backed group with nothing published in it renders as
              an empty accordion, so it is dropped rather than shown — that is
              also the pre-load state before /api/config resolves.
            */}
            {filterGroups
              .filter((group) => group.options.length > 0)
              .map((group) => (
                <details
                  key={group.key}
                  // only Price started open in the original panel
                  open={group.key === 'price'}
                  className="group border-t border-line-admin"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between py-[0.85rem] text-[0.95rem] font-semibold text-ink">
                    {group.label}
                    <span className="text-[1.1rem] font-normal text-muted" aria-hidden="true">
                      <span className="group-open:hidden">+</span>
                      <span className="hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <div className="flex flex-col gap-2 pb-3">
                    {/*
                    py-2.5 and a larger box below 960 give each row a ~44px tap
                    target. A 16px checkbox is comfortable with a mouse and
                    genuinely hard to hit with a thumb, and this panel is the
                    first thing a phone visitor touches in the catalogue.
                  */}
                    {group.options.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 py-1 text-[0.88rem] text-muted mx-960:py-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={(selected[group.key] || []).includes(opt.value)}
                          onChange={() => toggleFilter(group, opt.value)}
                          className="h-4 w-4 shrink-0 accent-brand mx-960:h-5 mx-960:w-5"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </details>
              ))}
          </aside>

          <section>
            <div className="mb-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={`${chip.key}-${chip.value || ''}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[0.78rem] text-muted"
                >
                  {chip.label}
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeChip(chip)}
                    className="text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <p className="mb-4 text-[0.85rem] text-muted">
              {total === 0
                ? 'No courses found'
                : `Showing ${Math.min(visibleLimit, total)} of ${total} courses`}
            </p>

            {isPending && !items.length ? (
              <Loading />
            ) : items.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No courses match those filters"
                body="Try removing a filter or searching for a different topic."
                action={
                  <Button onClick={reset} variant="outline">
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-3 gap-5 mx-1040:grid-cols-2 mx-640:grid-cols-1">
                {items.map((course) => (
                  <ExploreCard key={course._id} course={course} />
                ))}
              </div>
            )}

            {total > visibleLimit && (
              <div className="mt-8 text-center">
                <Button variant="outline" onClick={() => setVisibleLimit((v) => v + PAGE_SIZE)}>
                  View more
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
