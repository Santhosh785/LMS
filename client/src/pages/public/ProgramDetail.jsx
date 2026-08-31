import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useProgramCopy from '../../hooks/useProgramCopy.js'
import { useBranding } from '../../context/SiteConfigContext.jsx'

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

function Faq({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-lg2 border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-brand-deep"
      >
        {q}
        <span className={cn('transition-transform duration-200 ease-gs', open && 'rotate-180')}>
          ▾
        </span>
      </button>
      {open && (
        <p className="border-t border-line px-5 py-4 text-[0.92rem] leading-relaxed text-muted">
          {a}
        </p>
      )}
    </div>
  )
}

export default function ProgramDetail() {
  const { slug } = useParams()
  const {
    data: program,
    isPending,
    error,
  } = useQuery({
    queryKey: ['program', slug],
    queryFn: async () => (await api.get(`/programs/${slug}`)).data,
  })

  useDocumentTitle(program ? `${program.title} | Growth Scholar` : 'Program | Growth Scholar')

  // Section headings and button labels are editable per program; anything the
  // operator left blank falls back to the wording the page shipped with.
  // Resolved before the early returns below, so the hook order never varies.
  const { copy, cta, phaseLabels } = useProgramCopy(program)
  const { brandName } = useBranding()

  if (isPending) return <Loading />
  if (error) {
    return (
      <div className="px-5 py-20 text-center">
        <h1 className="text-[1.5rem]">Program not found</h1>
        <p className="mt-2 text-muted">{apiError(error)}</p>
        <Button to="/" variant="outline" className="mt-5">
          Back home
        </Button>
      </div>
    )
  }

  const outcomeColumns = phaseLabels.map((title) => ({
    title,
    items: program.outcomes?.filter((o) => o.phase === title) || [],
  }))

  return (
    <>
      <section className="bg-gradient-to-b from-white to-surface px-5 py-14">
        <div className="mx-auto grid max-w-shell grid-cols-[1.15fr_1fr] items-center gap-10 mx-960:grid-cols-1">
          <div>
            <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
              {program.eyebrow}
            </p>
            <h1 className="text-[clamp(2rem,3.6vw,2.9rem)]">{program.title}</h1>
            <p className="mt-4 max-w-xl text-[1.05rem] text-muted">{program.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {program.meta?.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-[0.8rem] font-medium text-muted"
                >
                  {m}
                </span>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button to={cta('heroApply').to} size="lg">
                {cta('heroApply').label}
              </Button>
              <Button href={cta('heroCurriculum').to} variant="outline" size="lg">
                {cta('heroCurriculum').label}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl2 shadow-soft">
            <img
              src={program.heroImage}
              alt={program.title}
              width={1400}
              height={900}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* -------------------------------- outcomes ------------------------------- */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-shell">
          <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
            {copy('outcomes').eyebrow}
          </p>
          <h2 className="text-[clamp(1.5rem,2.6vw,2rem)]">{copy('outcomes').heading}</h2>
          <p className="mt-2 text-muted">{copy('outcomes').subhead}</p>

          <div className="mt-8 grid grid-cols-2 gap-8 mx-960:grid-cols-1">
            {outcomeColumns.map((col) => (
              <div key={col.title}>
                <h3 className="mb-4 text-[1.1rem]">{col.title}</h3>
                <div className="grid gap-3">
                  {col.items.map((o, i) => (
                    <article
                      key={o.title}
                      className="flex gap-4 rounded-lg2 border border-line bg-white p-5"
                    >
                      <span className="text-[1.1rem] font-black text-accent-mid">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <h4 className="text-[0.98rem]">{o.title}</h4>
                        <p className="mt-1 text-[0.88rem] text-muted">{o.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-4 gap-4 rounded-xl2 bg-white p-6 shadow-softer mx-640:grid-cols-2">
            {program.stats?.map((s) => (
              <div key={s.label} className="text-center">
                <strong className="block text-[1.6rem] text-brand-deep">{s.value}</strong>
                <span className="text-[0.8rem] text-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- comparison ------------------------------ */}
      {program.comparison?.ours && (
        <section className="bg-surface-mist px-5 py-16">
          <div className="mx-auto max-w-shell">
            <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
              {copy('comparison').eyebrow}
            </p>
            <h2 className="text-[clamp(1.5rem,2.6vw,2rem)]">{copy('comparison').heading}</h2>
            <p className="mt-2 text-muted">{copy('comparison').subhead}</p>
            <div className="mt-8 grid grid-cols-2 gap-6 mx-960:grid-cols-1">
              {[program.comparison.theirs, program.comparison.ours].map((col, i) => (
                <div
                  key={col.title}
                  className={cn(
                    'rounded-lg2 border p-6',
                    i === 1 ? 'border-brand bg-white' : 'border-line bg-white/60',
                  )}
                >
                  <h3 className="mb-4 text-[1.05rem]">{col.title}</h3>
                  <ul className="grid gap-2.5 text-[0.92rem] text-muted">
                    {col.points?.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className={i === 1 ? 'text-accent-mid' : 'text-muted'}>
                          {i === 1 ? '✓' : '✕'}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------- curriculum ------------------------------ */}
      <section id="curriculum" className="scroll-mt-24 px-5 py-16">
        <div className="mx-auto max-w-shell">
          <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
            {copy('curriculum').eyebrow}
          </p>
          <h2 className="text-[clamp(1.5rem,2.6vw,2rem)]">{copy('curriculum').heading}</h2>
          <p className="mt-2 text-muted">{copy('curriculum').subhead}</p>

          <div className="mt-8 grid gap-4">
            {program.curriculum?.map((c) => (
              <article
                key={c.week}
                className="grid grid-cols-[160px_1fr] gap-6 rounded-lg2 border border-line bg-white p-6 mx-760:grid-cols-1"
              >
                <div>
                  <p className="text-[0.85rem] font-bold text-accent-mid">{c.week}</p>
                  <h3 className="mt-1 text-[1.05rem]">{c.title}</h3>
                </div>
                <div>
                  <ul className="grid gap-1.5 text-[0.92rem] text-muted">
                    {c.points?.map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                  </ul>
                  {c.output && (
                    <p className="mt-3 rounded-md2 bg-accent-soft px-3 py-2 text-[0.85rem] text-brand">
                      <strong>Output:</strong> {c.output}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- audience ------------------------------- */}
      <section className="bg-surface-mist px-5 py-16">
        <div className="mx-auto max-w-shell">
          <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
            {copy('audience').eyebrow}
          </p>
          <h2 className="text-[clamp(1.5rem,2.6vw,2rem)]">{copy('audience').heading}</h2>
          <div className="mt-8 grid grid-cols-3 gap-5 mx-960:grid-cols-1">
            {program.audience?.map((a) => (
              <article key={a.step} className="rounded-lg2 bg-white p-6 shadow-softer">
                <span className="text-[1.2rem] font-black text-accent-mid">{a.step}</span>
                <h3 className="mt-2 text-[1.05rem]">{a.title}</h3>
                <p className="mt-2 text-[0.9rem] text-muted">{a.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- admission + pricing --------------------------- */}
      <section className="px-5 py-16">
        <div className="mx-auto grid max-w-shell grid-cols-[1.2fr_1fr] items-start gap-10 mx-960:grid-cols-1">
          <div>
            <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
              {copy('admission').eyebrow}
            </p>
            <h2 className="text-[clamp(1.4rem,2.4vw,1.9rem)]">{copy('admission').heading}</h2>
            <ol className="mt-6 grid gap-3">
              {program.admission?.map((s, i) => (
                <li
                  key={s.title}
                  className="flex gap-4 rounded-lg2 border border-line bg-white p-5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.85rem] font-bold text-brand">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[0.98rem]">{s.title}</h3>
                    <p className="mt-1 text-[0.88rem] text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="rounded-xl2 border border-line bg-white p-7 shadow-soft">
            <p className="text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
              {copy('pricing').eyebrow}
            </p>
            <p className="mt-2 text-[2.1rem] font-black text-brand-deep">
              {inr(program.pricing?.amount || 0)}
            </p>
            <p className="mt-2 text-[0.85rem] text-muted">{program.pricing?.note}</p>
            <ul className="mt-5 grid gap-2 text-[0.9rem] text-muted">
              {program.pricing?.benefits?.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-accent-mid">✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <Button to={cta('pricingApply').to} block className="mt-6">
              {cta('pricingApply').label}
            </Button>
            <Button to={cta('pricingTalk').to} variant="outline" block className="mt-2">
              {cta('pricingTalk').label}
            </Button>
          </aside>
        </div>
      </section>

      {/* ----------------------------- testimonials ------------------------------ */}
      <section className="bg-surface-mist px-5 py-16">
        <div className="mx-auto max-w-shell">
          <h2 className="mb-8 text-[clamp(1.4rem,2.4vw,1.9rem)]">{copy('testimonials').heading}</h2>
          <div className="grid grid-cols-3 gap-6 mx-960:grid-cols-1">
            {program.testimonials?.map((t) => (
              <blockquote key={t.author} className="rounded-lg2 bg-white p-6 shadow-softer">
                <p className="text-[0.95rem] leading-relaxed">“{t.quote}”</p>
                <footer className="mt-4 text-[0.82rem] font-semibold text-muted">
                  {t.author} · {t.location}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------- faq ----------------------------------- */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
            FAQ
          </p>
          <h2 className="mb-6 text-[clamp(1.4rem,2.4vw,1.9rem)]">{copy('faqs').heading}</h2>
          <div className="grid gap-2">
            {program.faqs?.map((f) => (
              <Faq key={f.q} {...f} />
            ))}
          </div>
        </div>
      </section>

      <section className="brand-wash-deep px-5 py-16 text-center text-white">
        <div className="mx-auto max-w-shell">
          <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent">
            {copy('cta').eyebrow || brandName}
          </p>
          <h2 className="text-white text-[clamp(1.5rem,2.6vw,2rem)]">{copy('cta').heading}</h2>
          {copy('cta').subhead && (
            <p className="mx-auto mt-3 max-w-xl text-white/85">{copy('cta').subhead}</p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button to={cta('finalApply').to} variant="light" size="lg">
              {cta('finalApply').label}
            </Button>
            {/* The cross-sell only renders when an operator has set one, rather
                than hardcoding a link to one particular course. */}
            {cta('finalSecondary').label && cta('finalSecondary').to && (
              <Link
                to={cta('finalSecondary').to}
                className="self-center text-[0.9rem] font-semibold text-accent underline-offset-4 hover:underline"
              >
                {cta('finalSecondary').label}
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
