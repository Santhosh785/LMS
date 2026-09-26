import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { cn, EmptyState, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'

/**
 * /resources/playbooks — the mentor playbook index (.res-page), new in the
 * 2026 redesign. Cards come from the Playbook collection.
 */

export default function Playbooks() {
  useDocumentTitle('Growth playbooks | Growth Scholar')
  useBodyClass('gs-redesign')
  const [email, setEmail] = useState('')
  const [notifyError, setNotifyError] = useState('')

  const { data, isPending } = useQuery({
    queryKey: ['playbooks'],
    queryFn: async () => (await api.get('/resources/playbooks')).data,
  })

  const notify = useMutation({
    mutationFn: async (payload) => (await api.post('/resources/notify', payload)).data,
    onSuccess: () => setEmail(''),
    onError: (err) => setNotifyError(apiError(err)),
  })

  const items = data?.items || []

  return (
    <div className="res-page">
      <div className="res-wrap">
        <p className="res-crumb">
          <Link to="/">Home</Link> <span>›</span> Playbooks
        </p>

        <header className="pb-hero">
          <p className="eyebrow">Updated strategies</p>
          <h1>Steal the growth playbooks of top-performing marketers.</h1>
          <p>
            Real workflows from mentors and Flagship cohorts — built for freelancers, founders, and
            operators who’ve outgrown intro courses.
          </p>
          <div className="pb-hero-actions">
            <a className="btn-lm-primary" href="#playbooks-grid">
              Explore playbooks
            </a>
          </div>
        </header>

        <div className="pb-section-head">
          <h2>Operators share what actually moved the needle this quarter.</h2>
          <p>
            Each playbook is a step-by-step breakdown — not theory slides. New playbooks drop
            monthly.
          </p>
        </div>

        {isPending ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState
            icon="📘"
            title="No playbooks published yet"
            body="They appear here as mentors and cohorts publish them."
          />
        ) : (
          <div className="pb-grid" id="playbooks-grid">
            {items.map((p) => (
              <article className="pb-card" key={p.slug}>
                <div className={cn('pb-card-visual', p.visualClass)}>
                  {p.tag && <span className="tag">{p.tag}</span>}
                  <h3>{p.cardTitle || p.title}</h3>
                </div>
                <div className="pb-card-body">
                  {p.authorName && (
                    <div className="pb-person">
                      <div className="pb-avatar">{p.initials}</div>
                      <div>
                        <span>{p.authorName}</span>
                        <small>{p.authorRole}</small>
                      </div>
                    </div>
                  )}
                  <p>{p.summary}</p>
                  <Link to={`/resources/playbooks/${p.slug}`}>Open playbook →</Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <section className="pb-notify" aria-labelledby="notify-heading">
          <h2 id="notify-heading">Stay ahead with the newest playbooks</h2>
          <p>We publish a new playbook each month. Get notified when they go live.</p>
          {notify.isSuccess ? (
            <p className="pb-notify-done">You’re on the list — new playbooks land in your inbox.</p>
          ) : (
            <form
              className="pb-notify-form"
              onSubmit={(e) => {
                e.preventDefault()
                setNotifyError('')
                notify.mutate({ email })
              }}
            >
              <input
                type="email"
                name="email"
                placeholder="Your email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" disabled={notify.isPending}>
                {notify.isPending ? 'Adding…' : 'Get notified'}
              </button>
            </form>
          )}
          {notifyError && <p className="pa-error">{notifyError}</p>}
        </section>

        <section className="pb-contribute">
          <h2>Got a workflow that’s crushing it for your clients or business?</h2>
          <p>
            We feature operators from workshops and Flagship cohorts. Share your playbook with the
            community.
          </p>
          <a href="mailto:hello@growthscholar.in?subject=Playbook%20submission">
            Apply to share your playbook →
          </a>
        </section>
      </div>
    </div>
  )
}
