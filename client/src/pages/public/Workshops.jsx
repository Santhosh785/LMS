import { useEffect, useRef, useState } from 'react'
import { Link, useLoaderData, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn, Modal, TextField, useToast } from '../../components/ui/index.jsx'
import { DEFAULT_WORKSHOP_MODE, groupWorkshops, workshopMode } from '../../lib/workshopGroups.js'

/**
 * /workshops — the 2026 redesign's listing (.ws-page), server-rendered.
 *
 * The cards come from the route loader (routes/public/workshops.ts), and the
 * online/offline toggle is the `?mode=` search param, so the server HTML and a
 * shared link show the same format. Registration is unchanged and client-only:
 * a signed-in learner registers in one click, a guest fills the
 * name/email/phone modal, and POST /api/workshops/:id/register stays
 * idempotent.
 */

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

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
            {workshop.priceNew ? inr(workshop.priceNew) : <span className="free">Free</span>}
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

/**
 * The cards' entrance animation, as an enhancement only. The server HTML (and
 * a browser without JavaScript) shows every card; after hydration, the cards
 * still below the fold are given `.ws-reveal` (hidden, see overrides.css) and
 * animate in with `.is-visible` as they scroll into view. Cards already on
 * screen are left alone, so nothing that was painted ever disappears.
 */
function useCardReveal(rootRef, deps) {
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof window.IntersectionObserver !== 'function') return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined

    // Still hidden from an earlier pass (the observer was reset), or not yet
    // scrolled to.
    const below = [...root.querySelectorAll('.ws-card:not(.is-visible)')].filter(
      (el) =>
        el.classList.contains('ws-reveal') || el.getBoundingClientRect().top > window.innerHeight,
    )
    if (!below.length) return undefined
    below.forEach((el) => el.classList.add('ws-reveal'))

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          io.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    below.forEach((el) => io.observe(el))
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` are the caller's re-run triggers
  }, [rootRef, ...deps])
}

export default function Workshops() {
  const { mode, items } = useLoaderData()
  // The tab follows the URL at once; the list follows when the loader returns.
  const [searchParams, setSearchParams] = useSearchParams()
  const activeMode = workshopMode(searchParams.get('mode'))
  const [target, setTarget] = useState(null)
  const pageRef = useRef(null)
  const [registeredIds, setRegisteredIds] = useState([])
  const { user } = useAuth()
  const toast = useToast()

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

  useCardReveal(pageRef, [items, mode])

  const groups = groupWorkshops(mode, items)

  /** The default mode is the bare URL; other params, if any, are kept. */
  const switchMode = (next) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === DEFAULT_WORKSHOP_MODE) params.delete('mode')
        else params.set('mode', next)
        return params
      },
      { preventScrollReset: true },
    )
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
        </header>

        <div className="ws-mode" role="tablist" aria-label="Workshop format">
          <div className="ws-mode-track" data-active={activeMode}>
            <span className="ws-mode-glider" aria-hidden="true" />
            {[
              { id: 'online', icon: '🖥', label: 'Online workshops' },
              { id: 'offline', icon: '🏢', label: 'Offline workshops' },
            ].map((t) => (
              <button
                key={t.id}
                className={cn('ws-mode-btn', activeMode === t.id && 'is-active')}
                type="button"
                role="tab"
                aria-selected={activeMode === t.id}
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
          {groups.map((group) => (
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
          ))}

          <p className="ws-footnote">
            More cities soon. Prefer live {activeMode === 'online' ? 'in person' : 'online'}?{' '}
            <button
              type="button"
              onClick={() => switchMode(activeMode === 'online' ? 'offline' : 'online')}
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
              Switch to {activeMode === 'online' ? 'Offline' : 'Online'} workshops
            </button>
            .
          </p>
        </div>
      </div>

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
