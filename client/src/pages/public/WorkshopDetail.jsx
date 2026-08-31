import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, Loading, TextField, useToast } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const MARQUEE = [
  'SEO',
  'Meta Ads',
  'Google Ads',
  'Funnels',
  'Copywriting',
  'Analytics',
  'Affiliate',
]

export default function WorkshopDetail() {
  const { slug } = useParams()
  const [done, setDone] = useState(false)
  const toast = useToast()

  const {
    data: workshop,
    isPending,
    error,
  } = useQuery({
    queryKey: ['workshop', slug],
    queryFn: async () => (await api.get(`/workshops/${slug}`)).data,
  })

  useDocumentTitle(workshop ? `${workshop.title} | Growth Scholar` : 'Workshop | Growth Scholar')

  const register = useMutation({
    mutationFn: async (payload) =>
      (await api.post(`/workshops/${workshop._id}/register`, payload)).data,
    onSuccess: () => {
      setDone(true)
      toast.show('Registered ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  if (isPending) return <Loading />
  if (error) {
    return (
      <div className="px-5 py-20 text-center">
        <h1 className="text-[1.5rem]">Workshop not found</h1>
        <Button to="/workshops" variant="outline" className="mt-5">
          All workshops
        </Button>
      </div>
    )
  }

  const landing = workshop.landing || {}

  return (
    <div className="bg-wl-cream">
      {toast.node}

      {/* The hero carries text, so an image sits behind a scrim rather than
          replacing the block — white copy has to stay readable over a photo. */}
      <section
        className={cn('art-sheen relative px-5 py-16 text-white', workshop.bannerClass)}
        style={
          workshop.image
            ? {
                backgroundImage: `linear-gradient(rgba(6,40,37,0.62), rgba(6,40,37,0.62)), url(${workshop.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="mx-auto grid max-w-shell grid-cols-[1.2fr_1fr] items-center gap-10 mx-960:grid-cols-1">
          <div className="relative z-10">
            <nav className="mb-3 text-[0.8rem] text-white/75" aria-label="Breadcrumb">
              <Link to="/workshops" className="hover:text-white">
                Workshops
              </Link>
              <span className="px-1.5">/</span>
              <span>{workshop.language}</span>
            </nav>
            <h1 className="text-white text-[clamp(1.9rem,3.5vw,2.8rem)]">
              {landing.headline || workshop.title}
            </h1>
            <p className="mt-4 max-w-xl text-[1.05rem] text-white/90">
              {landing.subhead || `A live ${workshop.durationLabel} session with ${workshop.host}.`}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                workshop.level,
                workshop.language,
                workshop.durationLabel,
                workshop.mode === 'offline' ? workshop.venue : 'Online',
              ]
                .filter(Boolean)
                .map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-white/15 px-3 py-1.5 text-[0.8rem] font-medium"
                  >
                    {m}
                  </span>
                ))}
            </div>
          </div>

          <aside className="relative z-10 rounded-xl2 bg-white p-6 text-ink shadow-soft">
            <div className="flex items-baseline gap-2">
              <span className="text-[1.8rem] font-black text-brand-deep">
                {workshop.priceNew ? inr(workshop.priceNew) : 'Free'}
              </span>
              {workshop.priceOld ? (
                <span className="text-muted line-through">{inr(workshop.priceOld)}</span>
              ) : null}
            </div>
            <p className="mt-1 text-[0.85rem] text-muted">
              {new Date(workshop.startsAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>

            {done ? (
              <div className="mt-5 rounded-lg2 bg-accent-soft px-4 py-5 text-center">
                <p className="font-semibold text-brand">You’re registered ✓</p>
                <p className="mt-1 text-[0.85rem] text-muted">
                  Joining details are on the way to your inbox.
                </p>
              </div>
            ) : (
              <form
                className="mt-5 grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  register.mutate(Object.fromEntries(new FormData(e.currentTarget)))
                }}
              >
                <TextField name="name" label="Name" required />
                <TextField name="email" type="email" label="Email" required />
                <TextField name="phone" type="tel" label="Phone" required />
                <Button type="submit" block disabled={register.isPending}>
                  {register.isPending
                    ? 'Reserving…'
                    : workshop.priceNew
                      ? 'Reserve my seat'
                      : 'Join free'}
                </Button>
              </form>
            )}
          </aside>
        </div>
      </section>

      {/* the scrolling skill marquee from the original workshop landing page */}
      <div className="overflow-hidden border-y border-line bg-white py-3">
        <div className="flex w-max animate-wl-marquee gap-10 hover:[animation-play-state:paused]">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span
              key={`${m}-${i}`}
              className="text-[0.85rem] font-bold uppercase tracking-[0.2em] text-muted"
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-shell px-5 py-14">
        {landing.bullets?.length > 0 && (
          <section className="animate-wl-fade">
            <h2 className="mb-4 text-[1.4rem]">What you’ll walk away with</h2>
            <ul className="grid gap-2.5 text-[0.95rem] text-muted">
              {landing.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-wl-green">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </section>
        )}

        {landing.agenda?.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-[1.4rem]">Agenda</h2>
            <div className="grid gap-3">
              {landing.agenda.map((a) => (
                <article
                  key={a.time}
                  className="grid grid-cols-[80px_1fr] gap-4 rounded-lg2 border border-line bg-white p-5 mx-560:grid-cols-1"
                >
                  <span className="font-bold text-wl-deep">{a.time}</span>
                  <div>
                    <h3 className="text-[1rem]">{a.title}</h3>
                    <p className="mt-1 text-[0.88rem] text-muted">{a.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {landing.quotes?.length > 0 && (
          <section className="mt-12">
            {landing.quotes.map((q) => (
              <blockquote key={q.author} className="rounded-lg2 bg-white p-6 shadow-softer">
                <p className="text-[1.05rem] leading-relaxed">“{q.quote}”</p>
                <footer className="mt-3 text-[0.85rem] font-semibold text-muted">{q.author}</footer>
              </blockquote>
            ))}
          </section>
        )}

        {landing.faqs?.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-[1.4rem]">Questions</h2>
            <div className="grid gap-2">
              {landing.faqs.map((f) => (
                <details key={f.q} className="rounded-lg2 border border-line bg-white px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-brand-deep">
                    {f.q}
                  </summary>
                  <p className="mt-3 text-[0.92rem] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
