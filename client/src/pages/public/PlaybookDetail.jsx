import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'

/**
 * /resources/playbooks/:slug — a single mentor playbook.
 *
 * The sidebar contents is generated from the stored sections rather than
 * duplicated, so a section added in admin appears in both places at once.
 */

export default function PlaybookDetail() {
  const { slug } = useParams()
  const {
    data: playbook,
    isPending,
    error,
  } = useQuery({
    queryKey: ['playbook', slug],
    queryFn: async () => (await api.get(`/resources/playbooks/${slug}`)).data,
  })

  useDocumentTitle(playbook ? `${playbook.title} | Growth Scholar` : 'Playbook | Growth Scholar')
  useBodyClass('gs-redesign')

  if (isPending) return <Loading />
  if (error) {
    return (
      <div className="px-5 py-20 text-center">
        <h1 className="text-[1.5rem]">Playbook not found</h1>
        <p className="mt-2 text-muted">{apiError(error)}</p>
        <Button to="/resources/playbooks" variant="outline" className="mt-5">
          All playbooks
        </Button>
      </div>
    )
  }

  const sections = playbook.sections || []

  return (
    <div className="res-page">
      <div className="pb-detail-wrap">
        <p className="res-crumb">
          <Link to="/">Home</Link> <span>›</span> <Link to="/resources/playbooks">Playbooks</Link>{' '}
          <span>›</span> {playbook.cardTitle || playbook.title}
        </p>

        <header className={cn('pb-detail-hero', playbook.heroClass)}>
          {playbook.tag && <p className="pb-detail-tag">{playbook.tag}</p>}
          <h1>{playbook.title}</h1>
          {playbook.deck && <p className="pb-detail-deck">{playbook.deck}</p>}
        </header>

        <div className="pb-detail-layout">
          <article className="pb-detail-main">
            {playbook.achievement?.body && (
              <div className="pb-detail-achievement">
                <h3>{playbook.achievement.heading || 'Proudest achievement'}</h3>
                <p>{playbook.achievement.body}</p>
              </div>
            )}

            {sections.map((s) => (
              <section className="pb-detail-section" id={s.id} key={s.id}>
                <h2>{s.heading}</h2>
                {(s.body || []).map((para) => (
                  <p key={para.slice(0, 40)}>{para}</p>
                ))}
                {s.items?.length > 0 && (
                  <ul>
                    {s.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section className="pb-detail-cta">
              <h2>{playbook.cta?.heading || 'Ready to run this for real?'}</h2>
              <p>
                {playbook.cta?.body ||
                  'Practice this playbook in workshops — or ship it live in Flagship with mentors who review your work every week.'}
              </p>
              <div className="pb-detail-cta-actions">
                <Link className="btn-lm-primary" to="/programs/apply">
                  Apply for Flagship
                </Link>
                <Link className="btn-lm-ghost" to="/resources/playbooks">
                  ← All playbooks
                </Link>
              </div>
            </section>
          </article>

          <aside className="pb-detail-aside" aria-label="Playbook sidebar">
            {sections.length > 0 && (
              <nav className="pb-detail-toc" aria-labelledby="toc-h">
                <h2 id="toc-h">Table of contents</h2>
                <ol>
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`}>{s.heading}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {playbook.tools && (
              <div className="pb-detail-tools">
                <h3>Tools used</h3>
                <p>{playbook.tools}</p>
              </div>
            )}
            {/* Resolved server-side, so an unpublished skill leaves no dead link. */}
            {playbook.relatedSkill?.slug && (
              <div className="pb-detail-promo">
                <h3>Related skill</h3>
                <Link to={`/resources/claude-skills/${playbook.relatedSkill.slug}`}>
                  {playbook.relatedSkill.title || playbook.relatedSkill.label} →
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
