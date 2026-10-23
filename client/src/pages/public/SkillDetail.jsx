import { useState } from 'react'
import { isRouteErrorResponse, Link, useLoaderData, useRouteError } from 'react-router'
import { Button } from '../../components/ui/index.jsx'
import RouteErrorView from '../../components/RouteErrorView'

/**
 * /resources/claude-skills/:slug — a single skill, server-rendered from the
 * route loader. An unknown slug is a 404 the error boundary below renders.
 */

const COPY_RESET_MS = 2200

/** The route's error boundary: a 404 keeps the page's own copy and its link back to the index. */
export function ErrorBoundary() {
  const error = useRouteError()
  if (!isRouteErrorResponse(error) || error.status !== 404) {
    return <RouteErrorView scope="route" />
  }
  return (
    <div className="px-5 py-20 text-center">
      <h1 className="text-[1.5rem]">Skill not found</h1>
      <p className="mt-2 text-muted">{error.data?.message || 'Skill not found'}</p>
      <Button to="/resources/claude-skills" variant="outline" className="mt-5">
        All skills
      </Button>
    </div>
  )
}

export default function SkillDetail() {
  const { skill } = useLoaderData()
  const [copied, setCopied] = useState(false)

  /** Same instruction text the drop copied to the clipboard. */
  const onCopy = async () => {
    const text = `Install the "${skill.title}" skill from Growth Scholar Claude Skills in your Claude project settings.`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_RESET_MS)
    } catch {
      // Clipboard access can be denied; the button simply does not confirm.
      window.prompt('Copy this into Claude:', text)
    }
  }

  return (
    <div className="skill-page">
      <div className="skill-wrap">
        <p className="res-crumb">
          <Link to="/">Home</Link> <span>›</span>{' '}
          <Link to="/resources/claude-skills">Claude Skills</Link> <span>›</span> {skill.title}
        </p>

        <header className="skill-head">
          <h1>{skill.title}</h1>
          {skill.tagline && <p className="skill-tagline">{skill.tagline}</p>}
        </header>

        {skill.about && (
          <section className="skill-section skill-about" aria-labelledby="about-h">
            <h2 id="about-h">About</h2>
            <p>{skill.about}</p>
          </section>
        )}

        {skill.features?.length > 0 && (
          <section className="skill-section" aria-labelledby="does-h">
            <h2 id="does-h">What it does</h2>
            <div className="skill-features">
              {skill.features.map((f) => (
                <article className="skill-feat" key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="skill-section" aria-labelledby="details-h">
          <h2 id="details-h">Details</h2>
          <dl className="skill-meta">
            {skill.badge && (
              <div className="skill-meta-row">
                <dt>Category</dt>
                <dd>{skill.badge}</dd>
              </div>
            )}
            <div className="skill-meta-row">
              <dt>Works with</dt>
              <dd>{skill.worksWith}</dd>
            </div>
            <div className="skill-meta-row">
              <dt>Status</dt>
              <dd>
                <span className="skill-status">{skill.readiness}</span>
              </dd>
            </div>
          </dl>
        </section>

        <div className="skill-actions">
          <button type="button" className="btn-skill-primary" onClick={onCopy}>
            {copied ? 'Copied — paste in Claude' : 'Add skill to Claude'}
          </button>
          <Link className="btn-skill-ghost" to="/resources/claude-skills">
            ← All skills
          </Link>
        </div>
      </div>
    </div>
  )
}
