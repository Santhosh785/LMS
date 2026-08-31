import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn, Loading, Modal, TextField, useToast } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

/** Language/city section order, matching the original headings. */
const SECTION_ORDER = {
  online: ['Tamil', 'English', 'Hindi'],
  offline: ['Chennai', 'Bangalore'],
}

const sectionTitle = (mode, key) =>
  mode === 'online' ? `${key} workshops${key === 'English' ? ' (India)' : ''}` : `${key} workshops`

function WorkshopCard({ workshop, onRegister, registered }) {
  return (
    <article className="overflow-hidden rounded-lg2 border border-line bg-white shadow-softer transition-transform duration-200 ease-gs hover:-translate-y-1">
      <div
        className={cn(
          'art-sheen relative grid h-36 place-items-center px-4 text-center',
          workshop.bannerClass,
        )}
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
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-white/80">
            Growth Scholar{workshop.mode === 'offline' ? ' · Offline' : ''}
          </p>
          <p className="mt-1 text-[1.15rem] font-black leading-tight text-white">
            {workshop.bannerTitle}
          </p>
        </div>
        <span className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[0.7rem] font-bold text-brand-deep">
          {workshop.hostInitials}
        </span>
      </div>
      <div className="p-4">
        <h3 className="text-[1rem]">
          <Link to={`/workshops/${workshop.slug}`} className="hover:text-brand">
            {workshop.title}
          </Link>
        </h3>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-muted">
          <span>
            {workshop.mode === 'offline' ? '📍' : '👤'} {workshop.venue || workshop.level}
          </span>
          <span>🌐 {workshop.language}</span>
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            {workshop.priceNew ? (
              <>
                {workshop.priceOld ? (
                  <span className="text-[0.85rem] text-muted line-through">
                    {inr(workshop.priceOld)}
                  </span>
                ) : null}
                <span className="text-[1.05rem] font-bold text-brand-deep">
                  {inr(workshop.priceNew)}
                </span>
              </>
            ) : (
              <span className="text-[1.05rem] font-bold text-brand-deep">Free</span>
            )}
          </div>
          <Button
            size="sm"
            variant={registered ? 'outline' : 'primary'}
            onClick={() => onRegister(workshop)}
            disabled={registered}
          >
            {registered ? 'Registered ✓' : 'Register'}
          </Button>
        </div>
      </div>
    </article>
  )
}

export default function Workshops() {
  useDocumentTitle('Workshops | Growth Scholar')
  const [mode, setMode] = useState('online')
  const [target, setTarget] = useState(null)
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
  const groups = SECTION_ORDER[mode]
    .map((key) => ({
      key,
      items: items.filter((w) => (mode === 'online' ? w.language === key : w.venue === key)),
    }))
    .filter((g) => g.items.length)

  return (
    <div className="px-5 py-10">
      {toast.node}
      <div className="mx-auto max-w-shell">
        <nav className="mb-4 text-[0.8rem] text-muted" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-brand">
            Home
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-brand-deep">Workshops</span>
        </nav>

        <h1 className="text-[clamp(1.7rem,3vw,2.3rem)]">Live workshops</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Short, hands-on sessions in Tamil, English and Hindi — online and in person.
        </p>

        <div
          className="my-7 inline-flex rounded-full border border-line bg-white p-1"
          role="tablist"
          aria-label="Workshop mode"
        >
          {[
            { id: 'online', label: '🖥 Online workshops' },
            { id: 'offline', label: '🏢 Offline workshops' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => {
                setMode(t.id)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className={cn(
                'rounded-full px-5 py-2.5 text-[0.88rem] font-semibold transition-colors duration-200 ease-gs',
                mode === t.id ? 'bg-brand text-white' : 'text-muted hover:text-brand',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isPending ? (
          <Loading />
        ) : (
          groups.map((group) => (
            <section key={group.key} className="mb-12">
              <h2 id={group.key.toLowerCase()} className="mb-5 text-[1.25rem]">
                <span aria-hidden="true">✨</span> {sectionTitle(mode, group.key)}{' '}
                <span aria-hidden="true">✨</span>
              </h2>
              <div className="grid grid-cols-3 gap-5 mx-1040:grid-cols-2 mx-640:grid-cols-1">
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

        <p className="text-[0.9rem] text-muted">
          More cities soon. Prefer live online?{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'online' ? 'offline' : 'online')}
            className="font-semibold text-brand hover:underline"
          >
            Switch to {mode === 'online' ? 'Offline' : 'Online'} workshops
          </button>
          .
        </p>
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
