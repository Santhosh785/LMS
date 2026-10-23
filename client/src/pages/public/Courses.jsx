import { useEffect, useRef, useState } from 'react'
import { Link, useLoaderData, useLocation, useNavigation, useSearchParams } from 'react-router'
import { sortLabels } from '../../data/nav.js'
import { cn, EmptyState } from '../../components/ui/index.jsx'
import useFilterGroups from '../../hooks/useFilterGroups.js'
import { exploreSearch, exploreState, MAX_LIMIT, PAGE_SIZE } from '../../lib/courseListing.js'

/**
 * /courses — the 2026 redesign's explore page (.explore-page).
 *
 * Server-rendered from the route loader (routes/public/courses.ts): the first
 * HTML already carries the cards, the result count, the chips and the sidebar.
 * The URL is the state. Every filter, sort, search or chip change replaces the
 * search params, the loader runs again and the new slice arrives while the old
 * one stays on screen; "View more" bumps `limit`, so a shared URL renders the
 * same number of cards cold. Same URL contract, same "Paid is pre-selected
 * when the URL carries no facet" quirk (lib/courseListing.js), same 9-card
 * step as before.
 */

/** Fixed locale, so the server and the browser format a price identically. */
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** Replace, never push, and keep the reader where they are on the page. */
const NAV = { replace: true, preventScrollReset: true }

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
  const { items, total, facets, state } = useLoaderData()
  const [, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigation = useNavigation()
  // Client-only UI state: both start closed, on the server and in the browser.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const sortWrap = useRef(null)
  // Seeded from the loader's `q`, never from browser state.
  const [search, setSearch] = useState(state.q)

  /*
   * While a filter change is in flight the URL has not committed yet, so the
   * checkboxes and chips follow the pending URL (through the same function the
   * loader uses) and the cards stay the previous ones until the new slice
   * lands. Idle — including the hydration render — this is the loader's state.
   */
  const pending =
    navigation.location && navigation.location.pathname === location.pathname
      ? exploreState(new URLSearchParams(navigation.location.search))
      : null
  const view = pending || state
  const { selected, sort, q } = view
  const loading = Boolean(pending)

  // Topic and language values from the facets lookup, the rest from the
  // published taxonomy and the fixed groups — see the hook.
  const filterGroups = useFilterGroups(facets)

  /** Writes a selection to the URL; it drops limit/skip, so the count resets to 9. */
  const commit = (next, nextSearch = search, nextSort = sort) =>
    setSearchParams(exploreSearch(next, nextSearch, nextSort), NAV)

  // The search box writes `q` 250 ms after the last keystroke. The ref always
  // holds this render's selection, so the timer commits the latest one without
  // restarting whenever a filter changes.
  const commitSearch = useRef(null)
  useEffect(() => {
    commitSearch.current = (text) => commit(selected, text)
  })
  useEffect(() => {
    if (search.trim() === q) return undefined
    const t = setTimeout(() => commitSearch.current?.(search), 250)
    return () => clearTimeout(t)
  }, [search, q])

  useEffect(() => {
    // React's root listener now sits on the document itself (the whole
    // document is hydrated), so stopPropagation inside the menu cannot keep a
    // click from reaching this one; a click inside the menu is ignored instead.
    const onDocClick = (e) => {
      if (!sortWrap.current?.contains(e.target)) setSortOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

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

  /** Back to the no-facet default: Paid, popularity, no search. */
  const reset = () => {
    setSearch('')
    setSearchParams(new URLSearchParams(), NAV)
  }

  /** Nine more cards: a bigger `limit`, so the URL stays shareable. */
  const viewMore = () =>
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('limit', String(Math.min(state.limit + PAGE_SIZE, MAX_LIMIT)))
      return params
    }, NAV)
  // Absent once every match is on screen — or at the listing's 100-card cap,
  // where a bigger `limit` would not add a card.
  const canViewMore = total > state.skip + items.length && state.limit < MAX_LIMIT

  /* -------------------------------- chips -------------------------------- */
  const chips = [{ key: 'sort', label: `Sort by - ${sortLabels[sort] || 'Popularity'}` }]
  for (const group of filterGroups) {
    for (const value of selected[group.key] || []) {
      const opt = group.options.find((o) => o.value === value)
      chips.push({ key: group.key, value, label: opt?.label || value })
    }
  }
  if (q) chips.push({ key: 'q', label: `“${q}”` })

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
            <h1>Every self-paced digital marketing course in one place</h1>
            <p className="explore-hero-lede">
              Filter by topic, level, and price — or browse{' '}
              <Link to="/courses/category">Digital Marketing</Link> by topic.
            </p>
            <div className="explore-hero-cta">
              <Link className="explore-btn-primary" to="/courses/category">
                Browse digital marketing
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
          </ul>
        </div>
      </section>

      <div className="explore-top">
        <p className="breadcrumb">
          <Link to="/">Home</Link> → <Link to="/courses/category">Digital Marketing</Link> → Explore
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
              onBlur={() => search.trim() !== q && commit(selected, search)}
              placeholder="Search"
              aria-label="Search courses"
            />
            <span aria-hidden="true">⌕</span>
          </form>

          <div className="sort-wrap" ref={sortWrap}>
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
            A group with no values renders as an empty accordion, so it is
            dropped rather than shown.
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
            {total === 0 ? 'No courses found' : `Showing ${items.length} of ${total} courses`}
          </p>

          {items.length === 0 ? (
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
            <div className="course-grid" aria-busy={loading || undefined}>
              {items.map((course) => (
                <ExploreCard key={course._id} course={course} />
              ))}
            </div>
          )}

          {canViewMore && (
            <div className="view-more">
              <button className="btn btn-outline btn-lg" type="button" onClick={viewMore}>
                View more courses
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
