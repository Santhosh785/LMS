import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { cn } from '../../components/ui/index.jsx'
import { RESOURCES_PAGES_READY } from '../../data/nav.js'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import useScrollReveal from '../../hooks/useScrollReveal.js'
import {
  audienceLinks,
  finalCta,
  flagship,
  hero,
  journey,
  nativeBand,
  productTabs,
  proof,
  proofHeading,
  resourceTeasers,
  reviews,
  selfPacedHead,
  workshopsHead,
} from '../../data/homeCopy.js'

/**
 * The 2026 redesign homepage (.home-lm).
 *
 * Markup mirrors the static build's index.html class for class — the styling
 * comes from the vendored styles/redesign/home-lemlist.css, so the element tree
 * has to match it. The two card grids are the deliberate exception: the drop
 * hard-coded six courses and six workshops, and those are read from the
 * catalogue here so the front page cannot advertise something unpublished.
 */

const GRID_SIZE = 6

/** `→` inside the pill buttons, as .btn-lm-blue .arr. */
const Arrow = () => (
  <span className="arr" aria-hidden="true">
    →
  </span>
)

function CourseCard({ course }) {
  const meta = [
    course.topic,
    course.price === 'free'
      ? 'Free'
      : course.durationLabel || (course.hours ? `${course.hours} hrs` : null),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link className="lm-course" to={`/courses/${course.slug}`}>
      <div
        className={cn('lm-course-thumb', !course.image && (course.thumbClass || 'media-seo'))}
        style={
          course.image
            ? {
                backgroundImage: `url(${course.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {course.kind || course.topic || ''}
      </div>
      <div className="lm-course-body">
        <p className="provider">Self-paced</p>
        <h3>{course.title}</h3>
        {meta && <p className="meta">{meta}</p>}
        {course.tags?.[0] && <span className="tag-live">{course.tags[0]}</span>}
        {/* Hidden until real ratings exist — see the note in Courses.jsx. */}
        {course.rating > 0 && <p className="rating">★ {course.rating}</p>}
      </div>
    </Link>
  )
}

function WorkshopCard({ workshop }) {
  const thumbLabel = [workshop.language, workshop.mode === 'online' ? 'Live' : 'Offline']
    .filter(Boolean)
    .join(' · ')
  const meta = [
    workshop.mode === 'online' ? 'Online' : workshop.venue || 'In person',
    workshop.durationLabel,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link className="lm-course" to={`/workshops/${workshop.slug}`}>
      <div
        className={cn('lm-course-thumb', !workshop.image && (workshop.bannerClass || 'ws-seo'))}
        style={
          workshop.image
            ? {
                backgroundImage: `url(${workshop.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {thumbLabel}
      </div>
      <div className="lm-course-body">
        <p className="provider">Workshop</p>
        <h3>{workshop.title}</h3>
        {meta && <p className="meta">{meta}</p>}
        <p className="rating">
          {workshop.priceNew > 0 ? `From ₹${workshop.priceNew.toLocaleString('en-IN')}` : 'Free'}
        </p>
      </div>
    </Link>
  )
}

export default function Home() {
  useDocumentTitle('Growth Scholar — Become a Growth Marketer')
  useBodyClass('gs-redesign home-lm')
  const [tab, setTab] = useState(productTabs[0].id)
  const mainRef = useRef(null)

  const { data: courseData } = useQuery({
    queryKey: ['courses', 'home'],
    queryFn: async () =>
      (
        await api.get('/courses', {
          params: { price: 'paid,free', limit: GRID_SIZE, sort: 'popularity' },
        })
      ).data,
  })

  const { data: workshopData } = useQuery({
    queryKey: ['workshops', 'home'],
    queryFn: async () => (await api.get('/workshops')).data,
  })

  // Playbooks and Claude Skills are hidden until their pages exist — see
  // RESOURCES_PAGES_READY in data/nav.js.
  const teasers = RESOURCES_PAGES_READY
    ? resourceTeasers
    : resourceTeasers.filter((r) => !r.to.startsWith('/resources/'))
  const courses = courseData?.items || []
  const workshops = (workshopData?.items || []).slice(0, GRID_SIZE)

  useScrollReveal(mainRef, [courses.length, workshops.length, tab])

  return (
    <div ref={mainRef}>
      {/* ------------------------------- hero ------------------------------- */}
      <section className="lm-hero">
        <div className="lm-hero-grid" aria-hidden="true" />
        <div className="lm-hero-inner">
          <p className="lm-hero-badge">
            <span className="lm-hero-badge-dot" aria-hidden="true" /> {hero.badge}
          </p>
          <h1 className="lm-hero-title">
            <span className="lm-h1-line">{hero.titleLines[0]}</span>
            <span className="lm-h1-line lm-h1-line--accent">{hero.titleLines[1]}</span>
          </h1>
          <p className="lede">{hero.lede}</p>
          <ul className="lm-lang-strip" aria-label="Launch language">
            {hero.languages.map((l) => (
              <li key={l.label}>
                <span className={cn('lm-lang-tag', l.muted && 'lm-lang-tag--muted')}>
                  {l.label}
                </span>
              </li>
            ))}
          </ul>
          <div className="lm-hero-cta">
            <a className="btn-lm-blue" href="#self-paced">
              Browse self-paced courses <Arrow />
            </a>
            <Link className="btn-lm-white" to="/programs/complete-growth-marketing">
              Apply for Flagship LIVE
            </Link>
          </div>
          <p className="lm-hero-note">{hero.note}</p>

          <div className="lm-product">
            <div className="lm-product-tabs" role="tablist">
              {productTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`lm-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`lm-panel-${t.id}`}
                  className={cn(tab === t.id && 'is-active')}
                  onClick={() => setTab(t.id)}
                >
                  {t.tab}
                </button>
              ))}
            </div>

            {productTabs.map((t) => (
              <div
                key={t.id}
                role="tabpanel"
                id={`lm-panel-${t.id}`}
                aria-labelledby={`lm-tab-${t.id}`}
                // The stylesheet selects each panel's photograph by this
                // attribute — without it every tab renders an empty frame.
                data-lm-product-panel={t.id}
                hidden={tab !== t.id}
                className={cn('lm-product-panel', tab === t.id && 'is-active lm-panel-switch')}
              >
                <div className="lm-mock-top">
                  <div className="dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>{t.chrome}</span>
                </div>
                <div className="lm-mock-body">
                  <div>
                    <h3>{t.title}</h3>
                    <p>{t.body}</p>
                    {t.chips && (
                      <div className="chip-row">
                        {t.chips.map((c) => (
                          <span className="chip" key={c}>
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <Link to={t.link.to}>{t.link.label}</Link>
                  </div>
                  <div className="lm-mock-visual" role="img" aria-label={t.visualLabel} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- the gap ------------------------------ */}
      <section className="lm-gap-band" aria-labelledby="gap-heading">
        <div className="lm-gap-inner">
          <h2 id="gap-heading" className="sr-only">
            The gap we solve
          </h2>
          <p>
            <strong>Freelancers, working marketers, and business owners</strong> across India have
            already taken digital marketing courses. The missing piece is{' '}
            <strong>what to do next</strong> — in a language you think in — when platforms,
            algorithms, and buyer behaviour change every few months.
          </p>
          <div className="lm-audience" style={{ marginBottom: 0 }}>
            {audienceLinks.map((a) => (
              <Link key={a.label} to={a.to}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- launch language ------------------------ */}
      <section className="lm-native-band" aria-labelledby="native-heading">
        <div className="lm-wrap lm-native-grid">
          <div className="lm-native-copy">
            <p className="eyebrow">{nativeBand.eyebrow}</p>
            <h2 id="native-heading">{nativeBand.heading}</h2>
            <p>{nativeBand.body}</p>
          </div>
          <div className="lm-lang-cards lm-lang-cards--single">
            <article className="lm-lang-card lm-lang-card--tamil">
              <span className="lm-lang-card-icon" aria-hidden="true">
                {nativeBand.card.icon}
              </span>
              <h3>{nativeBand.card.title}</h3>
              <p>{nativeBand.card.body}</p>
            </article>
          </div>
        </div>
      </section>

      {/* ------------------------------ flagship ---------------------------- */}
      <section className="lm-flagship" id="flagship">
        <div className="lm-flagship-grid">
          <div className="lm-flagship-intro">
            <p className="eyebrow">{flagship.eyebrow}</p>
            <h2>{flagship.heading}</h2>
            <p>{flagship.body}</p>
            <div className="lm-flagship-badges">
              {flagship.badges.map((b) => (
                <span key={b}>{b}</span>
              ))}
            </div>
            <Link className="btn-lm-apply" to="/programs/complete-growth-marketing">
              Apply for next batch <Arrow />
            </Link>
          </div>
          <div className="lm-flagship-cards">
            {flagship.cards.map((c) => (
              <article className="lm-flagship-card" key={c.title}>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ journey ----------------------------- */}
      <section className="lm-section lm-section--gray">
        <div className="lm-wrap">
          <div className="lm-journey-head">
            <h2>{journey.heading}</h2>
            <p>{journey.body}</p>
          </div>
          <div className="lm-journey">
            <div className="lm-journey-track">
              <div className="lm-journey-line" aria-hidden="true" />
              <div className="lm-journey-steps">
                {journey.steps.map((s, i) => (
                  <div className="lm-journey-step" key={s.title}>
                    <div className="lm-journey-marker">
                      <span>{i + 1}</span>
                    </div>
                    <h3>{s.title}</h3>
                    <p className="phase">{s.phase}</p>
                    <p>{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- self-paced grid ------------------------ */}
      {courses.length > 0 && (
        <section className="lm-section lm-section--light lm-section--mesh" id="self-paced">
          <div className="lm-wrap">
            <div className="lm-section-head">
              <p className="eyebrow">{selfPacedHead.eyebrow}</p>
              <h2>{selfPacedHead.heading}</h2>
              <p>{selfPacedHead.body}</p>
            </div>
            <div className="lm-course-grid">
              {courses.map((c) => (
                <CourseCard course={c} key={c.slug} />
              ))}
            </div>
            <div className="lm-section-actions">
              <Link className="btn-outline" to="/courses/category">
                View full course library
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------- workshops grid ------------------------ */}
      {workshops.length > 0 && (
        <section className="lm-section lm-section--gray lm-section--mesh" id="workshops">
          <div className="lm-wrap">
            <div className="lm-section-head">
              <h2>{workshopsHead.heading}</h2>
              <p>{workshopsHead.body}</p>
            </div>
            <div className="lm-course-grid">
              {workshops.map((w) => (
                <WorkshopCard workshop={w} key={w.slug} />
              ))}
            </div>
            <div className="lm-section-actions">
              <Link className="btn-outline" to="/workshops">
                Browse all workshops
              </Link>
              <Link className="btn-solid" to={`/workshops/${workshops[0].slug}`}>
                Register for {workshops[0].title}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------- proof + reviews ----------------------- */}
      <section className="lm-section lm-section--light">
        <div className="lm-wrap">
          <div className="lm-section-head">
            <h2>{proofHeading}</h2>
          </div>
          <div className="lm-proof">
            {proof.map((p) => (
              <div key={p.label}>
                <strong>{p.value}</strong>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
          <div className="lm-reviews" id="community">
            {reviews.map((r) => (
              <article className="lm-review" key={r.author}>
                <h4>{r.title}</h4>
                <p>{r.body}</p>
                <footer>{r.author}</footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ resources --------------------------- */}
      <section className="lm-section lm-section--light" id="playbooks">
        <div className="lm-wrap">
          <div className="lm-section-head">
            <p className="eyebrow">Resources</p>
            <h2>Playbooks, skills &amp; field notes</h2>
          </div>
          <div className="lm-resource-teasers">
            {teasers.map((r) => (
              <Link className="lm-resource-card" to={r.to} id={r.id} key={r.title}>
                <span className="lm-resource-icon" aria-hidden="true">
                  {r.icon}
                </span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
                <span className="lm-resource-link">{r.link}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ final CTA --------------------------- */}
      <section className="lm-final lm-final--visual">
        <h2>{finalCta.heading}</h2>
        <p>{finalCta.body}</p>
        <div className="lm-final-actions">
          <Link className="btn-lm-blue" to="/courses/category">
            Browse self-paced library <Arrow />
          </Link>
          <Link className="btn-lm-white" to="/programs/complete-growth-marketing">
            Apply for Flagship
          </Link>
        </div>
      </section>
    </div>
  )
}
