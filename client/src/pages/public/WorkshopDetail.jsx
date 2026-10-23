import { useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn, Modal, TextField, useToast } from '../../components/ui/index.jsx'

/**
 * /workshops/:slug — the 2026 redesign's landing page (.wl-page).
 *
 * Every band below the hero renders only when the workshop's `landing`
 * subdocument carries its content, so the thirteen workshops that predate the
 * redesign still render a correct, shorter page rather than empty headings.
 *
 * Server-rendered: the workshop comes from the route loader
 * (routes/public/workshop-detail.ts), so the first HTML already holds it; the
 * title and body class come from that route's `meta` and `handle`.
 *
 * Registration stays a client mutation: POST /api/workshops/:id/register,
 * idempotent, with a signed-in learner's details prefilled. Nothing rendered
 * depends on the signed-in state, so the first client render matches the
 * (possibly shared-cached, guest) server HTML.
 */

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/**
 * "12 Nov" — locale and zone pinned, never the runtime's defaults, so the
 * server and every browser render the same text and hydration cannot differ.
 */
const pillDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })

/** The drop's .wl-claim button; repeated in the hero and the final band. */
function Claim({ pulse, label, onClick, disabled, pending }) {
  return (
    <button
      className={cn('wl-claim', pulse && 'wl-claim--pulse')}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {pending ? 'Reserving…' : label}
    </button>
  )
}

/** The loader's 404 (an unknown slug): today's message and a way back. */
function WorkshopNotFound() {
  return (
    <div className="px-5 py-20 text-center">
      <h1 className="text-[1.5rem]">Workshop not found</h1>
      <p className="mt-2 text-muted">Workshop not found</p>
      <Button to="/workshops" variant="outline" className="mt-5">
        All workshops
      </Button>
    </div>
  )
}

export default function WorkshopDetail() {
  const { workshop } = useLoaderData()
  // Keyed on the workshop so a client navigation to another workshop starts
  // from its own loader data rather than this one's registration state.
  return workshop ? <WorkshopLanding key={workshop.id} workshop={workshop} /> : <WorkshopNotFound />
}

function WorkshopLanding({ workshop: loaded }) {
  const { user } = useAuth()
  const toast = useToast()
  const [done, setDone] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  // Starts from the loader's count (so the server and first client render
  // agree) and follows the register response's count afterwards.
  const [registeredCount, setRegisteredCount] = useState(loaded.registeredCount)
  const workshop = { ...loaded, registeredCount }

  const register = useMutation({
    mutationFn: async (payload) =>
      (await api.post(`/workshops/${workshop.id}/register`, payload)).data,
    onSuccess: (res) => {
      if (typeof res?.registeredCount === 'number') setRegisteredCount(res.registeredCount)
      setDone(true)
      setFormOpen(false)
      toast.show('Registered ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const landing = workshop.landing || {}
  const isFree = !workshop.priceNew
  const claimLabel = done
    ? 'You’re registered ✓'
    : isFree
      ? 'Claim your free spot'
      : 'Reserve my seat'

  /** A signed-in learner skips the form entirely. */
  const onClaim = () => {
    if (done) return undefined
    if (user)
      return register.mutate({
        name: user.name,
        email: user.email,
        phone: user.phone || '0000000000',
      })
    return setFormOpen(true)
  }

  const claimProps = {
    label: claimLabel,
    onClick: onClaim,
    disabled: done || register.isPending,
    pending: register.isPending,
  }

  return (
    <div className="wl-page">
      {toast.node}

      <section className="wl-hero">
        <div className="wl-shell">
          <div className="wl-hero-panel">
            <div className="wl-hero-copy">
              {landing.ribbon && <p className="wl-hero-ribbon">{landing.ribbon}</p>}
              <h1>{landing.headline || workshop.title}</h1>
              <p className="lede">
                {landing.subhead ||
                  `A live ${workshop.durationLabel || ''} session with ${workshop.host || 'our mentors'}.`}
              </p>

              {landing.trust?.length > 0 && (
                <div className="wl-hero-trust">
                  {landing.trust.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              )}

              <div className="wl-pills">
                {(landing.pills?.length
                  ? landing.pills
                  : [
                      workshop.durationLabel && { icon: '⏱', label: workshop.durationLabel },
                      workshop.startsAt && {
                        icon: '📅',
                        label: pillDate(workshop.startsAt),
                      },
                      workshop.language && { icon: '🌐', label: workshop.language },
                      workshop.mode === 'offline' && workshop.venue
                        ? { icon: '📍', label: workshop.venue }
                        : { icon: '🖥', label: 'Online' },
                    ].filter(Boolean)
                ).map((p) => (
                  <span className={cn('wl-pill', p.accent && 'wl-pill--accent')} key={p.label}>
                    <span className="ico" aria-hidden="true">
                      {p.icon}
                    </span>{' '}
                    {p.label}
                  </span>
                ))}
              </div>

              <div className="wl-hero-price">
                <span className="now">{isFree ? 'FREE' : inr(workshop.priceNew)}</span>
                <span className="note">
                  {landing.priceNote || 'Register before the cohort fills'}
                </span>
              </div>

              <Claim pulse {...claimProps} />
              <p className="wl-hero-micro">
                {isFree ? 'No card required · ' : ''}Recording for attendees
              </p>
            </div>

            <div className="wl-hero-media">
              <div className="wl-video">
                {workshop.image ? (
                  <img
                    src={workshop.image}
                    alt={workshop.imageAlt || workshop.title}
                    width="900"
                    height="1200"
                  />
                ) : (
                  <div className={cn('art-sheen h-full w-full', workshop.bannerClass)} />
                )}
                {landing.mediaCaption && <p className="wl-video-cap">{landing.mediaCaption}</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {landing.highlight?.heading && (
        <section className="wl-highlight">
          <div className="wl-shell">
            <h2>{landing.highlight.heading}</h2>
            <div
              className="wl-dark-art"
              role="img"
              aria-label={landing.highlight.body || 'Marketers collaborating on a growth campaign'}
            />
          </div>
        </section>
      )}

      {landing.steps?.length > 0 && (
        <section className="wl-section">
          <div className="wl-shell">
            <div className="wl-section-head">
              <h2>A workshop worth your time</h2>
              <p>No strings attached — just pure learning</p>
            </div>
            <div className="wl-steps">
              {landing.steps.map((s, i) => (
                <article className="wl-step" key={s.title}>
                  <p className="step-label">Step {i + 1}</p>
                  <h3>{s.title}</h3>
                  {s.body && <p>{s.body}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {landing.benefits?.length > 0 && (
        <section className="wl-section">
          <div className="wl-shell">
            <div className="wl-section-head">
              <h2>What you’ll walk away with</h2>
            </div>
            <div className="wl-benefits">
              {landing.benefits.map((b) => (
                <article className="wl-benefit" key={b.title}>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The pre-redesign `bullets` list still has a home, below the benefits. */}
      {landing.bullets?.length > 0 && (
        <section className="wl-section">
          <div className="wl-shell">
            <div className="wl-section-head">
              <h2>What’s covered</h2>
            </div>
            <div className="wl-skills">
              {landing.bullets.map((b) => (
                <span className="wl-skill" key={b}>
                  <span className="dot" /> {b}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {landing.tools?.length > 0 && (
        <section className="wl-section">
          <div className="wl-shell">
            <div className="wl-section-head">
              <h2>Tools you will learn</h2>
            </div>
            <div className="wl-skills">
              {landing.tools.map((t) => (
                <span className="wl-skill" key={t}>
                  <span className="dot" /> {t}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {landing.agenda?.length > 0 && (
        <section className="wl-section">
          <div className="wl-shell">
            <div className="wl-section-head">
              <h2>Run of the session</h2>
            </div>
            <div className="wl-steps">
              {landing.agenda.map((a) => (
                <article className="wl-step" key={a.title}>
                  <p className="step-label">{a.time}</p>
                  <h3>{a.title}</h3>
                  {a.body && <p>{a.body}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {(landing.mentor?.name || workshop.host) && (
        <section className="wl-section">
          <div className="wl-shell">
            <div className="wl-mentor">
              {landing.mentor?.image && (
                <div className="wl-mentor-photo">
                  <img
                    src={landing.mentor.image}
                    alt={landing.mentor.name}
                    width="900"
                    height="1125"
                  />
                </div>
              )}
              <div className="wl-mentor-body">
                <h2>Meet your mentor</h2>
                <p className="role">
                  {landing.mentor?.name || workshop.host}
                  {landing.mentor?.role ? ` · ${landing.mentor.role}` : ''}
                </p>
                {landing.mentor?.bio && <p>{landing.mentor.bio}</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {landing.whoFor?.length > 0 && (
        <section className="wl-section">
          <div className="wl-shell">
            <div className="wl-section-head">
              <h2>Who is this workshop for?</h2>
            </div>
            <div className="wl-audience">
              {landing.whoFor.map((w) => (
                <div className="wl-aud" key={w}>
                  {w}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="wl-final-cta">
        <div className="wl-shell">
          <h2>
            {landing.finalCta?.heading ||
              'Still deciding? The workshop pays for itself in one client brief.'}
          </h2>
          <p>
            {landing.finalCta?.body ||
              'Three hours, zero fluff — walk away knowing what to do next week.'}
          </p>
          <Claim {...claimProps} />
        </div>
      </section>

      {landing.faqs?.length > 0 && (
        <section className="wl-section" id="faq">
          <div className="wl-shell">
            <div className="wl-section-head">
              <p className="eyebrow">More questions?</p>
              <h2>Frequently Asked Questions</h2>
            </div>
            <div className="faq-block">
              {landing.faqs.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={`Register — ${workshop.title}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button form="wl-register" type="submit" disabled={register.isPending}>
              {register.isPending ? 'Reserving…' : 'Confirm'}
            </Button>
          </>
        }
      >
        <form
          id="wl-register"
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            register.mutate(Object.fromEntries(new FormData(e.currentTarget)))
          }}
        >
          <TextField name="name" label="Name" required />
          <TextField name="email" type="email" label="Email" required />
          <TextField name="phone" type="tel" label="Phone" required />
        </form>
      </Modal>

      <p className="wl-shell" style={{ padding: '0 0 3rem' }}>
        <Link to="/workshops" className="text-brand hover:underline">
          ← All workshops
        </Link>
      </p>
    </div>
  )
}
