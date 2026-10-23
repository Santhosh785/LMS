import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn, Loading, Modal, TextField, useToast } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import useRevealOnScroll from '../../hooks/useRevealOnScroll.js'

/**
 * /workshops — the 2026 redesign's listing (.ws-page).
 *
 * Registration is unchanged: a signed-in learner registers in one click, a
 * guest fills the name/email/phone modal, and POST /api/workshops/:id/register
 * stays idempotent. Only the markup moved onto the drop's classes.
 */

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** Language/city section order, matching the original headings. */
const SECTION_ORDER = {
  online: ['Tamil', 'English', 'Hindi'],
  offline: ['Chennai', 'Bangalore'],
}

const sectionTitle = (mode, key) =>
  mode === 'online' ? `${key} workshops${key === 'English' ? ' (India)' : ''}` : `${key} workshops`

/** The drop paints banners with `.ws-banner.seo`; the database stores `ws-seo`. */
const bannerTone = (bannerClass) => (bannerClass || '').replace(/^ws-/, '')

function WorkshopCard({ workshop, onRegister, registered }) {
  return (
    <article className="ws-card">
      <div
        className={cn('ws-banner', workshop.bannerClass, bannerTone(workshop.bannerClass))}
        style={
          workshop.image
            ? {
                backgroundImage: `linear-gradient(rgba(6,40,37,0.55), rgba(6,40,37,0.55)), url(${workshop.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <p className="brand-mini">
          Growth Scholar{workshop.mode === 'offline' ? ' · Offline' : ''}
        </p>
        <p className="banner-title">{workshop.bannerTitle || workshop.title}</p>
        <span className="banner-cta">Register Now</span>
        {workshop.hostInitials && (
          <div className="face" aria-hidden="true">
            {workshop.hostInitials}
          </div>
        )}
      </div>
      <div className="ws-card-body">
        <h3>
          <Link to={`/workshops/${workshop.slug}`}>{workshop.title}</Link>
        </h3>
        <div className="ws-meta">
          <span>
            <span className="ico" aria-hidden="true">
              {workshop.mode === 'offline' ? '📍' : '👤'}
            </span>{' '}
            {workshop.venue || workshop.level}
          </span>
          {workshop.language && (
            <span>
              <span className="ico" aria-hidden="true">
                🌐
              </span>{' '}
              {workshop.language}
            </span>
          )}
          <span className="ws-price">
            {workshop.priceNew ? (
              <>
                {workshop.priceOld > 0 && <span className="old">{inr(workshop.priceOld)}</span>}{' '}
                {inr(workshop.priceNew)}
              </>
            ) : (
              <span className="free">Free</span>
            )}
          </span>
        </div>
        <div className="ws-register">
          <button
            className="btn-reg"
            type="button"
            onClick={() => onRegister(workshop)}
            disabled={registered}
          >
            {registered ? 'Registered ✓' : 'Register'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function Workshops() {
  useDocumentTitle('Workshops | Growth Scholar')
  useBodyClass('gs-redesign')
  const [mode, setMode] = useState('online')
  const [target, setTarget] = useState(null)
  const pageRef = useRef(null)
  const [registeredIds, setRegisteredIds] = useState([])
  const { user } = useAuth()
  const toast = useToast()

  const { data, isPending } = useQuery({
    queryKey: ['workshops', mode],
    queryFn: async () => (await api.get('/workshops', { params: { mode } })).data,
  })

  const register = useMutation({
    mutationFn: async ({ id, payload }) =>
      (await api.post(`/workshops/${id}/register`, payload)).data,
    onSuccess: (_res, vars) => {
      setRegisteredIds((ids) => [...ids, vars.id])
      setTarget(null)
      toast.show('Registered ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const onRegister = (workshop) => {
    // signed-in learners register in one click; guests give name/email/phone
    if (user)
      return register.mutate({
        id: workshop._id,
        payload: { name: user.name, email: user.email, phone: user.phone || '0000000000' },
      })
    return setTarget(workshop)
  }

  const items = data?.items || []
  /**
   * .ws-card ships at opacity 0 and is painted by `.is-visible`, which the
   * drop's workshops.js added on scroll. Without this the grid renders as
   * blank space under each heading. Re-runs when the cards change.
   */
  useRevealOnScroll(pageRef, {
    selectors: ['.ws-card'],
    revealClass: '',
    visibleClass: 'is-visible',
    deps: [items.length, mode],
  })

  const groups = SECTION_ORDER[mode]
    .map((key) => ({
      key,
      items: items.filter((w) => (mode === 'online' ? w.language === key : w.venue === key)),
    }))
    .filter((g) => g.items.length)

  const switchMode = (next) => {
    setMode(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="ws-page" ref={pageRef}>
      {toast.node}
      <div className="ws-inner">
        <p className="ws-crumb">
          <Link to="/">Home</Link> <span>›</span> Workshops
        </p>

        <header className="ws-hero">
          <p className="ws-hero-eyebrow">
            <span className="pulse" aria-hidden="true" /> Live sessions · Online &amp; offline
          </p>
          <h1 className="ws-page-title">Live workshops</h1>
          <p className="ws-hero-deck">
            Short, high-energy live builds with mentors. Leave with templates you can run this week.
          </p>
          <div className="ws-hero-chips" aria-label="Launch language">
            <span>த Tamil</span>
            <span className="ws-chip-muted">Launching now</span>
          </div>
        </header>

        <div className="ws-mode" role="tablist" aria-label="Workshop format">
          <div className="ws-mode-track" data-active={mode}>
            <span className="ws-mode-glider" aria-hidden="true" />
            {[
              { id: 'online', icon: '🖥', label: 'Online workshops' },
              { id: 'offline', icon: '🏢', label: 'Offline workshops' },
            ].map((t) => (
              <button
                key={t.id}
                className={cn('ws-mode-btn', mode === t.id && 'is-active')}
                type="button"
                role="tab"
                aria-selected={mode === t.id}
                onClick={() => switchMode(t.id)}
              >
                <span className="ico" aria-hidden="true">
                  {t.icon}
                </span>{' '}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          {isPending ? (
            <Loading />
          ) : (
            groups.map((group) => (
              <section
                className="ws-section"
                key={group.key}
                aria-labelledby={group.key.toLowerCase()}
              >
                <div className="ws-section-head">
                  <h2 id={group.key.toLowerCase()}>
                    <span className="spark" aria-hidden="true">
                      ✨
                    </span>{' '}
                    {sectionTitle(mode, group.key)}{' '}
                    <span className="spark" aria-hidden="true">
                      ✨
                    </span>
                  </h2>
                </div>
                <div className="ws-grid">
                  {group.items.map((w) => (
                    <WorkshopCard
                      key={w._id}
                      workshop={w}
                      onRegister={onRegister}
                      registered={registeredIds.includes(w._id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          <p className="ws-footnote">
            More cities soon. Prefer live {mode === 'online' ? 'in person' : 'online'}?{' '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'online' ? 'offline' : 'online')}
              style={{
                background: 'none',
                border: 0,
                color: 'var(--accent)',
                font: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Switch to {mode === 'online' ? 'Offline' : 'Online'} workshops
            </button>
            .
          </p>
        </div>
      </div>

      <section className="gs-convert-band" aria-labelledby="ws-convert-heading">
        <div className="gs-convert-inner">
          <div className="gs-convert-copy">
            <p className="eyebrow">Ready for implementation?</p>
            <h2 id="ws-convert-heading">
              Workshops practice one skill. Flagship connects the full stack.
            </h2>
            <p>
              10 seats per batch · LIVE builds · offline masterclass · apply when you’re ready to
              implement for real.
            </p>
          </div>
          <div className="gs-convert-actions">
            <Link className="gs-btn-solid" to="/programs/apply">
              Apply for Flagship
            </Link>
            <Link className="gs-btn-outline" to="/courses/category">
              Browse self-paced courses
            </Link>
          </div>
        </div>
      </section>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Register — ${target?.title || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button form="workshop-register" type="submit" disabled={register.isPending}>
              {register.isPending ? 'Registering…' : 'Confirm'}
            </Button>
          </>
        }
      >
        <form
          id="workshop-register"
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const payload = Object.fromEntries(new FormData(e.currentTarget))
            register.mutate({ id: target._id, payload })
          }}
        >
          <TextField name="name" label="Name" required />
          <TextField name="email" type="email" label="Email" required />
          <TextField name="phone" type="tel" label="Phone" required />
        </form>
      </Modal>
    </div>
  )
}
