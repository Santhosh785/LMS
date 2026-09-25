import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { sortLabels } from '../../data/nav.js'
import { cn, EmptyState, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import useFilterGroups from '../../hooks/useFilterGroups.js'

/**
 * /courses — the 2026 redesign's explore page (.explore-page).
 *
 * The filtering is unchanged: same URL contract, same server-side query, same
 * "Paid is pre-selected when the URL carries no facet" quirk, same 9-per-page
 * View-more step. Only the markup moved, onto the drop's classes so the
 * vendored styles/redesign/explore.css applies unchanged.
 */

const PAGE_SIZE = 9

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** Reads a comma-list param into an array. */
const readList = (params, key) =>
  (params.get(key) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/**
 * The drop paints card artwork with `.media-bg.seo`, while the database stores
 * the older `media-seo` on each course. Both are applied: the stripped tone
 * picks up the redesign gradient, and the original class stays as the fallback
 * for a tone the redesign does not define.
 */
const thumbTone = (thumbClass) => (thumbClass || '').replace(/^(media|art)-/, '')

export function ExploreCard({ course }) {
  const label = course.mediaLabel || course.title
  return (
    <Link className="explore-card" to={`/courses/${course.slug}`}>
      <div className="media">
        {course.image ? (
          <div
            className="media-bg"
            style={{
              backgroundImage: `url(${course.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            role="img"
            aria-label={course.imageAlt || label}
          />
        ) : (
          <div className={cn('media-bg', course.thumbClass, thumbTone(course.thumbClass))}>
            <span className="media-label">{label}</span>
          </div>
        )}
        <div className="badge-row">
          {course.languages?.length > 0 && (
            <span className="badge">
              <span className="ico" aria-hidden="true">
                🌐
              </span>{' '}
              {course.languages.join(' + ')}
            </span>
          )}
          {/*
            A rating is a claim about the business made to a prospective buyer.
            The demo figures were zeroed, and a zero rating renders as nothing at
            all rather than as "★ 0" — no stars is honest, zero stars is a worse
            lie than the invented number was.
          */}
          {course.rating > 0 && (
            <span className="badge rating">
              <span className="ico" aria-hidden="true">
                ★
              </span>{' '}
              {course.rating}
            </span>
          )}
        </div>
      </div>
      <div className="body">
        <h3>{course.title}</h3>
        <div className="card-foot">
          <p className="meta-row">
            {course.hours > 0 && (
              <span>
                <span className="ico" aria-hidden="true">
                  ⏱
                </span>{' '}
                {course.hours} Hrs
              </span>
            )}
            {course.enrolledCount > 0 && (
              <span>
                <span className="ico" aria-hidden="true">
                  👤
                </span>{' '}
                {course.enrolledLabel || `${course.enrolledCount} Enrolled`}
              </span>
            )}
          </p>
          <div className="price-row">
            <span className={cn('price', !course.amount && 'free')}>
              {course.amount ? inr(course.amount) : 'Free'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function Courses() {
  useDocumentTitle('Explore Courses | Growth Scholar')
  useBodyClass('gs-redesign explore-page--convert')
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
    <div className="explore-page">
      <section className="explore-hero">
        <div className="explore-hero-inner">
          <div>
            <p className="explore-hero-tag">Full course library</p>
            <h1>Every self-paced marketing course in one place</h1>
            <p className="explore-hero-lede">
              Filter by topic, level, and price — or jump to{' '}
              <Link to="/courses/category">Marketing</Link> for curated starters, live workshops,
              and Flagship.
            </p>
            <div className="explore-hero-cta">
              <Link className="explore-btn-primary" to="/courses/category">
                Browse marketing
              </Link>
              <Link className="explore-btn-secondary" to="/courses?price=free">
                Free courses only
              </Link>
            </div>
          </div>
          {/*
            The drop's third stat was "4.8★ avg rating" — an invented figure with
            no reviews behind it, the same claim that was removed from the
            homepage. The two that remain are read from the catalogue.
          */}
          <ul className="explore-hero-stats">
            <li>
              <strong>{total > 0 ? `${total}` : '—'}</strong> courses
            </li>
            <li>
              <strong>Free</strong> starters
            </li>
          </ul>
        </div>
      </section>

      <div className="explore-top">
        <p className="breadcrumb">
          <Link to="/">Home</Link> → <Link to="/courses/category">Marketing</Link> → Explore
        </p>
        <div className="explore-tools">
          <button
            className="filter-toggle"
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="filter-panel"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Filters
          </button>

          <form className="explore-search" role="search" onSubmit={(e) => e.preventDefault()}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => commit(selected, search)}
              placeholder="Search"
              aria-label="Search courses"
            />
            <span aria-hidden="true">⌕</span>
          </form>

          <div className="sort-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              className="sort-btn"
              type="button"
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
              onClick={() => setSortOpen((v) => !v)}
            >
              Sort by · {sortLabels[sort]} <span aria-hidden="true">▾</span>
            </button>
            <div
              className={cn('sort-menu', sortOpen && 'is-open')}
              role="listbox"
              hidden={!sortOpen}
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={sort === value}
                  className={cn(sort === value && 'is-active')}
                  onClick={() => {
                    commit(selected, search, value)
                    setSortOpen(false)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="explore-layout">
        <aside
          className={cn('filter-panel', filtersOpen && 'is-open')}
          id="filter-panel"
          aria-label="Filters"
        >
          <div className="head">
            <h2>Filter by</h2>
            <button className="reset" type="button" onClick={reset}>
              Reset all
            </button>
          </div>
          {/*
            A taxonomy-backed group with nothing published in it renders as an
            empty accordion, so it is dropped rather than shown — that is also
            the pre-load state before /api/config resolves.
          */}
          {filterGroups
            .filter((group) => group.options.length > 0)
            .map((group) => (
              // only Price started open in the original panel
              <details className="filter-group" key={group.key} open={group.key === 'price'}>
                <summary>{group.label}</summary>
                <div className="filter-options">
                  {group.options.map((opt) => (
                    <label key={opt.value}>
                      <input
                        type="checkbox"
                        checked={(selected[group.key] || []).includes(opt.value)}
                        onChange={() => toggleFilter(group, opt.value)}
                      />{' '}
                      {opt.label}
                    </label>
                  ))}
                </div>
              </details>
            ))}
        </aside>

        <section className="explore-main">
          <div className="chips">
            {chips.map((chip) => (
              <span className="chip" key={`${chip.key}-${chip.value || ''}`}>
                {chip.label}
                <button type="button" aria-label="Remove" onClick={() => removeChip(chip)}>
                  ×
                </button>
              </span>
            ))}
          </div>

          <p className="result-count">
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
                <button className="btn btn-outline" type="button" onClick={reset}>
                  Reset filters
                </button>
              }
            />
          ) : (
            <div className="course-grid">
              {items.map((course) => (
                <ExploreCard key={course._id} course={course} />
              ))}
            </div>
          )}

          {total > visibleLimit && (
            <div className="view-more">
              <button
                className="btn btn-outline btn-lg"
                type="button"
                onClick={() => setVisibleLimit((v) => v + PAGE_SIZE)}
              >
                View more courses
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="gs-convert-band" aria-labelledby="explore-convert-heading">
        <div className="gs-convert-inner">
          <div className="gs-convert-copy">
            <p className="eyebrow">Next step</p>
            <h2 id="explore-convert-heading">
              Self-paced gets you started. Flagship makes you ship.
            </h2>
            <p>
              Pick free foundation tracks here — apply for Complete Growth Marketing when you want
              LIVE implementation with mentors.
            </p>
          </div>
          <div className="gs-convert-actions">
            <Link className="gs-btn-solid" to="/programs/complete-growth-marketing">
              Apply for Flagship
            </Link>
            <Link className="gs-btn-outline" to="/workshops">
              Join a live workshop
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
