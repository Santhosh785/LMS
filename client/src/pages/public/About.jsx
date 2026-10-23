import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import useRevealOnScroll from '../../hooks/useRevealOnScroll.js'
import {
  approach,
  growthValues,
  heroStory,
  loopSteps,
  quotes,
  stats,
  timeline,
  values,
  whyList,
} from '../../data/aboutCopy.js'

/**
 * /about — new in the 2026 redesign; the static site it replaced had no About
 * page at all, which is why nothing here maps onto an existing route.
 *
 * Markup mirrors about.html class for class so the vendored
 * styles/redesign/about.css applies unchanged.
 */

const REVEAL_SELECTORS = [
  '.about-hero-badge',
  '.about-h1-line',
  '.about-hero .sub',
  '.about-hero .lede',
  '.about-section-head',
  '.about-timeline--rail',
  '.about-timeline-item',
  '.about-why-visual',
  '.about-why-list li',
  '.about-value-card',
  '.about-growth-letter',
  '.about-loop-wrap',
  '.about-approach-step',
  '.about-quote',
  '.about-tagline',
]

const LOOP_INTERVAL_MS = 2200
const COUNT_DURATION_MS = 1400

/**
 * The "1000+" figure counts up once, the first time the stat row is scrolled
 * into view. Rendered as the finished value so it is correct with JS disabled,
 * under reduced-motion, and for a screen reader that reads it before the
 * animation starts.
 */
function useCountUp(ref, target, suffix, enabled) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled || !target) return undefined

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) return undefined

    let frame
    const run = () => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / COUNT_DURATION_MS)
        const eased = 1 - (1 - t) ** 3
        el.textContent = `${Math.round(target * eased)}${suffix}`
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run()
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el.closest('.about-stats') || el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [ref, target, suffix, enabled])
}

function StatRow({ ariaHidden, countRef }) {
  return (
    <div className="about-stats-row" aria-hidden={ariaHidden || undefined}>
      {stats.map((s) => (
        <div className="about-stat" key={s.label}>
          <strong ref={!ariaHidden && s.count ? countRef : undefined}>{s.value}</strong>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function About() {
  useDocumentTitle('About Growth Scholar')
  useBodyClass('gs-redesign')
  const pageRef = useRef(null)
  const countRef = useRef(null)
  const [loopIndex, setLoopIndex] = useState(0)

  useRevealOnScroll(pageRef, {
    selectors: REVEAL_SELECTORS,
    revealClass: 'about-reveal',
    visibleClass: 'is-in',
    indexVar: '--ab-i',
  })

  const counted = stats.find((s) => s.count)
  useCountUp(countRef, counted?.count, counted?.suffix || '', true)

  // The approach loop highlights one step at a time, cycling forever.
  useEffect(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined
    const id = setInterval(() => setLoopIndex((i) => (i + 1) % loopSteps.length), LOOP_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    // A <div>, not <main>: PublicLayout already renders the page's <main>.
    <div className="about-page" ref={pageRef}>
      <div className="about-hero-shell">
        <div className="about-hero-bg" aria-hidden="true">
          <span className="about-orb about-orb--1" />
          <span className="about-orb about-orb--2" />
          <span className="about-hero-grid" />
        </div>
        <div className="about-wrap">
          <p className="about-crumb">
            <Link to="/">Home</Link> <span aria-hidden="true">›</span> About
          </p>

          <header className="about-hero">
            <p className="about-hero-badge">
              <span className="about-hero-badge-dot" aria-hidden="true" /> Our story · Since 2015
            </p>
            <h1>
              <span className="about-h1-line">About Growth Scholar</span>
            </h1>
            <p className="sub">Everything you need to know about who we are and why we exist.</p>
            <div className="lede">
              {heroStory.map((para) => (
                <p key={para.slice(0, 40)}>{para}</p>
              ))}
            </div>
          </header>
        </div>
      </div>

      {/* The row is duplicated in the drop: one marquee copy for motion, one real. */}
      <div className="about-stats" aria-label="Growth Scholar at a glance">
        <div className="about-stats-track">
          <StatRow ariaHidden />
          <StatRow countRef={countRef} />
        </div>
      </div>

      <section className="about-section about-section--mist" aria-labelledby="story-heading">
        <div className="about-wrap">
          <div className="about-section-head">
            <h2 id="story-heading">Our story</h2>
            <p>
              From sharing skills in 2015 to a brand with a name in 2025 — and a launch only when
              the vision matched the work.
            </p>
          </div>
          <div className="about-timeline about-timeline--rail">
            {timeline.map((t) => (
              <article className="about-timeline-item" key={t.year}>
                <p className="about-timeline-year">{t.year}</p>
                <div>
                  <h3>{t.title}</h3>
                  <p>{t.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="why-heading">
        <div className="about-wrap about-why-grid">
          <div className="about-why-visual">
            <div className="about-why-visual-shine" aria-hidden="true" />
            <p className="tag">Why Growth Scholar?</p>
            <p>
              Information isn’t the problem anymore. <em>Implementation is.</em>
            </p>
          </div>
          <div>
            <div className="about-section-head" style={{ textAlign: 'left', margin: '0 0 1.5rem' }}>
              <h2 id="why-heading">Learning marketing ≠ doing marketing</h2>
              <p style={{ textAlign: 'left' }}>
                When it’s time to run a real account, the questions change — which campaign first,
                which keywords matter, why traffic doesn’t convert, how ads and follow-ups connect.
              </p>
            </div>
            <ul className="about-why-list">
              {whyList.map((w) => (
                <li key={w.title}>
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="about-section about-section--mist" aria-labelledby="values-heading">
        <div className="about-wrap">
          <div className="about-section-head">
            <h2 id="values-heading">Our core values</h2>
            <p>
              In work or play, private or public — these guide how we learn, teach, and build Growth
              Scholar.
            </p>
          </div>
          <div className="about-values-grid">
            {values.map((v) => (
              <article className="about-value-card" key={v.num}>
                <span className="num">{v.num}</span>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="growth-heading">
        <div className="about-wrap">
          <div className="about-section-head">
            <h2 id="growth-heading">Our GROWTH values</h2>
            <p>We don’t just teach these — we expect ourselves and our learners to live them.</p>
          </div>
          <div className="about-growth-grid">
            {growthValues.map((g) => (
              <article className="about-growth-letter" key={g.letter}>
                <p className="letter" aria-hidden="true">
                  {g.letter}
                </p>
                <h3>{g.title}</h3>
                <p>{g.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section about-section--mist" aria-labelledby="approach-heading">
        <div className="about-wrap">
          <div className="about-section-head">
            <h2 id="approach-heading">Our approach</h2>
            <p>
              We don’t teach digital marketing to help you finish a course. We teach it so you can
              use it.
            </p>
          </div>
          <div className="about-loop-wrap">
            <div className="about-loop" role="img" aria-label={loopSteps.join(', ')}>
              {loopSteps.map((step, i) => (
                <Fragment key={step}>
                  {i > 0 && (
                    <span className="about-loop-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                  <span className={`about-loop-step${i === loopIndex ? ' is-active' : ''}`}>
                    {step}
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
          <div className="about-approach-grid">
            {approach.map((a) => (
              <article className="about-approach-step" key={a.step}>
                <p className="step">{a.step}</p>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section" aria-labelledby="voices-heading">
        <div className="about-wrap">
          <div className="about-section-head">
            <h2 id="voices-heading">Learners on Growth Scholar</h2>
            <p>Implementation-first learning — in their words.</p>
          </div>
          <div className="about-quotes">
            {quotes.map((q) => (
              <figure className="about-quote" key={q.author}>
                <blockquote>{q.quote}</blockquote>
                <footer>
                  {q.author} <span>{q.place}</span>
                </footer>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <div className="about-wrap">
        <div className="about-tagline">
          <p>
            Learn what matters. Apply what you learn. Grow what you build.
            <span>Don’t just learn digital marketing. Learn to apply it.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
