import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { sortLabels } from '../../data/nav.js'
import { useTerms } from '../../context/SiteConfigContext.jsx'
import { cn, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import useFilterGroups from '../../hooks/useFilterGroups.js'

/**
 * /courses/category — the 2026 redesign's Marketing category page (.cat-page).
 *
 * The drop adds a subcategory rail, a three-path chooser, a tabbed starter
 * carousel, a topic-chip block and a filtered list view with its own sidebar.
 * Topics come from the taxonomy rather than the drop's nine hardcoded links, so
 * a renamed topic cannot leave a dead facet here.
 */

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const thumbTone = (thumbClass) => (thumbClass || '').replace(/^(media|art)-/, '')

const readList = (params, key) =>
  (params.get(key) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/** The tabs over the starter carousel; each is a different ordering. */
const STARTER_TABS = [
  {
    key: 'popular',
    label: 'Most popular',
    sort: (a, b) => (b.popularity || 0) - (a.popularity || 0),
  },
  { key: 'new', label: 'New', sort: (a, b) => (b.newestRank || 0) - (a.newestRank || 0) },
  {
    key: 'beginner',
    label: 'Beginner',
    // Free starters first, then cheapest — the closest thing the catalogue has
    // to a difficulty signal.
    sort: (a, b) => (a.amount || 0) - (b.amount || 0),
  },
]

function Thumb({ course, className = 'thumb' }) {
  const label = course.mediaLabel || course.title
  if (course.image) {
    return (
      <div
        className={className}
        style={{
          backgroundImage: `url(${course.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        role="img"
        aria-label={course.imageAlt || label}
      />
    )
  }
  return (
    <div className={cn(className, course.thumbClass, thumbTone(course.thumbClass))}>
      <span className="thumb-label">{label}</span>
    </div>
  )
}

/** A card in the starter carousel. */
function CatCard({ course }) {
  return (
    <Link className="cat-card" to={`/courses/${course.slug}`}>
      <Thumb course={course} />
      <div className="info">
        <h3>{course.title}</h3>
        <p className="instructor">
          Growth Scholar{course.languages?.length ? ` · ${course.languages.join(' + ')}` : ''}
        </p>
        {/* Ratings render only when there are real ones — see Courses.jsx. */}
        {course.rating > 0 && <p className="rating-row">★ {course.rating}</p>}
        <p className="price">{course.amount ? inr(course.amount) : 'Free'}</p>
      </div>
    </Link>
  )
}

/** A row in the "All Marketing courses" list. */
function CatRow({ course }) {
  const meta = [
    'Growth Scholar',
    course.hours ? `${course.hours} total hours` : null,
    course.kind,
    course.languages?.join(' + '),
  ].filter(Boolean)

  return (
    <Link className="cat-row" to={`/courses/${course.slug}`}>
      <Thumb course={course} />
      <div className="body">
        <h3>{course.title}</h3>
        {course.summary && <p className="desc">{course.summary}</p>}
        <p className="meta">
          {meta.map((m, i) => (
            <span key={m} className={cn(i > 0 && 'dot')}>
              {m}
            </span>
          ))}
        </p>
        {course.rating > 0 && <p className="rating-row">★ {course.rating}</p>}
      </div>
      <div className="side">
        <p className="price">{course.amount ? inr(course.amount) : 'Free'}</p>
      </div>
    </Link>
  )
}

function Carousel({ children }) {
  const ref = useRef(null)
  const scrollBy = (dir) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' })
  }
  return (
    <div className="cat-carousel-wrap">
      <button
        className="cat-carousel-btn prev"
        type="button"
        aria-label="Previous"
        onClick={() => scrollBy(-1)}
      >
        ‹
      </button>
      <button
        className="cat-carousel-btn next"
        type="button"
        aria-label="Next"
        onClick={() => scrollBy(1)}
      >
        ›
      </button>
      <div className="cat-carousel" ref={ref}>
        {children}
      </div>
    </div>
  )
}

export default function CourseCategory() {
  useDocumentTitle('Digital Marketing Courses | Growth Scholar')
  useBodyClass('gs-redesign cat-page--convert')
  const [searchParams, setSearchParams] = useSearchParams()
  const [starterTab, setStarterTab] = useState('popular')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const topic = searchParams.get('topic') || ''
  const sort = searchParams.get('sort') || 'popularity'
  const topics = useTerms('topic', 'filters')
  // The same facet definitions the explore page uses, minus topic — the
  // subcategory rail above already owns that one.
  const filterGroups = useFilterGroups().filter((g) => g.key !== 'topic')

  const selected = useMemo(
    () => Object.fromEntries(filterGroups.map((g) => [g.key, readList(searchParams, g.key)])),
    [searchParams, filterGroups],
  )

  const queryParams = {
    ...(topic ? { topic } : { price: 'paid,free' }),
    ...Object.fromEntries(
      Object.entries(selected)
        .filter(([, v]) => v.length)
        .map(([k, v]) => [k, v.join(',')]),
    ),
    sort,
    limit: 50,
  }

  const { data, isPending } = useQuery({
    queryKey: ['courses', 'category', queryParams],
    queryFn: async () => (await api.get('/courses', { params: queryParams })).data,
    placeholderData: keepPreviousData,
  })

  const items = data?.items || []
  const total = data?.total ?? items.length

  /** A topic link that preserves the current sort — real hrefs, not buttons. */
  const topicHref = (name) => {
    const params = new URLSearchParams()
    if (name) params.set('topic', name)
    if (sort && sort !== 'popularity') params.set('sort', sort)
    const qs = params.toString()
    return `/courses/category${qs ? `?${qs}` : ''}`
  }

  const setParam = (key, value) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  const toggleFilter = (group, value) => {
    const current = selected[group.key] || []
    const next = group.single
      ? current.includes(value)
        ? []
        : [value]
      : current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    setParam(group.key, next.join(','))
  }

  const resetFilters = () => {
    const params = new URLSearchParams()
    if (topic) params.set('topic', topic)
    params.set('sort', sort)
    setSearchParams(params, { replace: true })
  }

  const starters = [...items].sort(
    STARTER_TABS.find((t) => t.key === starterTab)?.sort || (() => 0),
  )

  return (
    <div className="cat-page">
      <nav className="cat-subnav" aria-label="Digital Marketing subcategories">
        <div className="cat-subnav-inner">
          <Link className={cn(!topic && 'is-active')} to={topicHref('')}>
            Digital Marketing
          </Link>
          {topics.map((t) => (
            <Link
              key={t.slug}
              className={cn(topic === t.name && 'is-active')}
              to={topicHref(t.name)}
            >
              {t.name}
            </Link>
          ))}
        </div>
      </nav>

      <section className="cat-hero" aria-labelledby="cat-hero-title">
        <div className="cat-hero-inner">
          <div className="cat-hero-copy">
            <h1 id="cat-hero-title">
              Digital marketing courses built to ship campaigns — not hoard certificates
            </h1>
            <p className="cat-hero-lede">
              Self-paced tracks built around real drills and shipped projects, in the language you
              think in.
            </p>
            <div className="cat-hero-cta">
              <a className="cat-btn-primary" href="#all-courses">
                Browse courses
              </a>
            </div>
            {/*
              The drop's first figure was "4.8★ avg course rating" — invented,
              with no reviews behind it, so it is dropped rather than guessed at.
              The topic count is read from the published taxonomy.
            */}
            <ul className="cat-hero-trust">
              <li>
                <strong>{topics.length}+</strong> digital marketing topics
              </li>
              <li>
                <strong>1,000+</strong> learners
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="cat-trust-bar" aria-label="Why Growth Scholar courses">
        <div className="cat-trust-bar-inner">
          <span>Operator-led curriculum</span>
          <span>Templates &amp; worksheets included</span>
          <span>Certificate on completion</span>
        </div>
      </div>

      <div className="cat-wrap">
        <p className="cat-breadcrumb">
          <Link to="/">Home</Link> → <Link to="/courses">Courses</Link> → Digital Marketing
        </p>

        <section className="cat-section" aria-labelledby="starter-heading">
          <div className="cat-section-head">
            <div>
              <h2 id="starter-heading">Courses to get you started</h2>
              <p>Explore courses from operators shipping real campaigns.</p>
            </div>
          </div>

          <div className="cat-tabs" role="tablist" aria-label="Starter filters">
            {STARTER_TABS.map((t) => (
              <button
                key={t.key}
                className={cn('cat-tab', starterTab === t.key && 'is-active')}
                type="button"
                role="tab"
                aria-selected={starterTab === t.key}
                onClick={() => setStarterTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isPending && !items.length ? (
            <Loading />
          ) : (
            <Carousel>
              {starters.slice(0, 12).map((c) => (
                <CatCard key={c._id} course={c} />
              ))}
            </Carousel>
          )}
        </section>

        <section className="cat-section" aria-labelledby="topics-heading">
          <div className="cat-section-head">
            <div>
              <h2 id="topics-heading">Popular topics</h2>
            </div>
          </div>
          <div className="topic-chips">
            {topics.map((t) => (
              <Link
                key={t.slug}
                className={cn('topic-chip', topic === t.name && 'is-active')}
                to={topicHref(t.name)}
              >
                {t.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="cat-section" id="all-courses" aria-labelledby="all-heading">
          <div className="cat-all">
            <aside
              className={cn('cat-filters', filtersOpen && 'is-open')}
              id="cat-filters"
              aria-label="Filters"
            >
              <div className="head">
                <h3>Filter by</h3>
                <button className="reset" type="button" onClick={resetFilters}>
                  Reset
                </button>
              </div>
              {filterGroups
                .filter((g) => g.options.length > 0)
                .map((group) => (
                  <details className="cat-filter-group" key={group.key} open>
                    <summary>{group.label}</summary>
                    <div className="cat-filter-options">
                      {group.options.map((opt) => (
                        <label key={opt.value}>
                          <input
                            type={group.single ? 'radio' : 'checkbox'}
                            name={group.single ? group.key : undefined}
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

            <div className="cat-all-main">
              <div className="toolbar">
                <div>
                  <h2 id="all-heading">All {topic || 'Digital Marketing'} courses</h2>
                  <p className="cat-result-meta">
                    {total === 0 ? 'No courses found' : `Showing ${items.length} of ${total}`}
                  </p>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.65rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    className="cat-filter-toggle"
                    type="button"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen((v) => !v)}
                  >
                    Filters
                  </button>
                  <label className="cat-sort">
                    Sort by
                    <select
                      aria-label="Sort courses"
                      value={sort}
                      onChange={(e) => setParam('sort', e.target.value)}
                    >
                      {Object.entries(sortLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="cat-list">
                {items.map((c) => (
                  <CatRow key={c._id} course={c} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
