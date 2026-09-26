import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { cn, EmptyState, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import useRevealOnScroll from '../../hooks/useRevealOnScroll.js'

/**
 * /resources/claude-skills — the skills index (.res-page), new in the 2026
 * redesign. The filter row is built from the categories that actually have
 * published skills, so a tab can never match nothing.
 */

export default function ClaudeSkills() {
  useDocumentTitle('Claude Skills | Growth Scholar')
  useBodyClass('gs-redesign')
  const [filter, setFilter] = useState('all')
  const pageRef = useRef(null)

  const { data, isPending } = useQuery({
    queryKey: ['claude-skills'],
    queryFn: async () => (await api.get('/resources/skills')).data,
  })

  const items = data?.items || []
  const categories = data?.categories || []
  const shown = filter === 'all' ? items : items.filter((s) => s.category === filter)

  /**
   * .cs-card ships at opacity 0 and is painted by `.is-visible`, which the
   * drop's resources.js added on scroll. Re-runs when the filter changes, or
   * newly shown cards stay invisible.
   */
  useRevealOnScroll(pageRef, {
    selectors: ['.cs-card'],
    revealClass: '',
    visibleClass: 'is-visible',
    deps: [shown.length, filter],
  })

  return (
    <div className="res-page" ref={pageRef}>
      <div className="res-wrap">
        <p className="res-crumb">
          <Link to="/">Home</Link> <span>›</span> Claude Skills
        </p>

        <header className="cs-hero-copy">
          <p className="eyebrow">Work faster with AI</p>
          <h1>Claude Skills for growth marketers</h1>
          <p>
            Reusable skills for SEO, ads, copy, funnels, and analytics — the same ones mentors run
            during Flagship reviews.
          </p>
          <div className="cs-hero-actions">
            <a className="btn-lm-primary" href="#skills-grid">
              Browse skills
            </a>
          </div>
        </header>

        <div className="cs-filters" role="tablist" aria-label="Filter skills">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={cn(filter === 'all' && 'is-active')}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.value}
              type="button"
              role="tab"
              aria-selected={filter === c.value}
              className={cn(filter === c.value && 'is-active')}
              onClick={() => setFilter(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {isPending ? (
          <Loading />
        ) : shown.length === 0 ? (
          <EmptyState icon="✦" title="No skills here yet" body="Try another category." />
        ) : (
          <div className="cs-grid" id="skills-grid">
            {shown.map((s) => (
              <article className="cs-card" key={s.slug}>
                <div className="cs-card-top">
                  <span className="cs-icon" aria-hidden="true">
                    {s.icon}
                  </span>
                  <span className="cs-badge">{s.badge}</span>
                </div>
                <h3>{s.cardTitle || s.title}</h3>
                <p>{s.summary}</p>
                <Link
                  to={`/resources/claude-skills/${s.slug}`}
                  aria-label={`Open ${s.cardTitle || s.title} skill`}
                >
                  See more →
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
