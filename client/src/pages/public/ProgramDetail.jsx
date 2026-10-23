import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { cn, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import useProgramCopy from '../../hooks/useProgramCopy.js'

/**
 * /programs/:slug — the 2026 redesign of the flagship page.
 *
 * Markup mirrors programs/complete-growth-marketing.html class for class so the
 * vendored styles/redesign/program.css applies unchanged. Every section is
 * driven by the Program document and renders only when that document has the
 * data for it, so the other programs in the collection — which carry none of
 * the new fields — degrade to the sections they do have rather than breaking.
 */

const inr = (n) => Number(n).toLocaleString('en-IN')

/** A CTA whose destination is an on-page anchor stays an <a>. */
function Cta({ to, className, children }) {
  if (!to) return null
  return to.startsWith('#') ? (
    <a className={className} href={to}>
      {children}
    </a>
  ) : (
    <Link className={className} to={to}>
      {children}
    </Link>
  )
}

/** <details>/<summary>, as the drop's .faq-block expects; the first is open. */
function Faq({ q, a, defaultOpen }) {
  return (
    <details open={defaultOpen}>
      <summary>{q}</summary>
      <p>{a}</p>
    </details>
  )
}

/**
 * The drop's sticky apply bar (js/program.js): it appears past 480px, but hides
 * again while the pricing panel is on screen so the page never shows two apply
 * buttons at once. aria-hidden while off-screen, so the duplicated CTA is not
 * announced twice.
 */
function StickyBar({ program, cta }) {
  const [shown, setShown] = useState(false)
  const apply = cta('stickyApply')

  useEffect(() => {
    const onScroll = () => {
      const panel = document.getElementById('apply')
      let overlappingPricing = false
      if (panel) {
        const rect = panel.getBoundingClientRect()
        overlappingPricing = rect.top < window.innerHeight * 0.85 && rect.bottom > 0
      }
      setShown(window.scrollY > 480 && !overlappingPricing)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!program.pricing?.amount) return null

  return (
    <div className={cn('prog-sticky', shown && 'is-visible')} aria-hidden={!shown}>
      <div className="prog-sticky-inner">
        <div className="prog-sticky-copy">
          <strong>
            {program.title} · ₹{inr(program.pricing.amount)}
          </strong>
          {program.batchNote && <span>{program.batchNote}</span>}
        </div>
        <Cta to={apply.to} className="prog-btn-primary">
          {apply.label}
        </Cta>
      </div>
    </div>
  )
}

export default function ProgramDetail() {
  const { slug } = useParams()
  const pageRef = useRef(null)
  const {
    data: program,
    isPending,
    error,
  } = useQuery({
    queryKey: ['program', slug],
    queryFn: async () => (await api.get(`/programs/${slug}`)).data,
  })

  useDocumentTitle(program ? `${program.title} | Growth Scholar` : 'Program | Growth Scholar')
  useBodyClass('gs-redesign prog-page')

  // Section headings and button labels are editable per program; anything the
  // operator left blank falls back to the wording the page shipped with.
  // Resolved before the early returns below, so the hook order never varies.
  const { copy, cta } = useProgramCopy(program)

  if (isPending) return <Loading />
  if (error) {
    return (
      <div className="px-5 py-20 text-center">
        <h1 className="text-[1.5rem]">Program not found</h1>
        <p className="mt-2 text-muted">{apiError(error)}</p>
        <Link to="/" className="mt-4 inline-block font-semibold text-brand hover:underline">
          ← Back home
        </Link>
      </div>
    )
  }

  const heroCopy = copy('hero')
  const pricing = program.pricing || {}
  const structure = program.structure || {}
  const columnCount = structure.columns?.length || 0

  return (
    <div className="prog-page" ref={pageRef}>
      {/* -------------------------------- hero -------------------------------- */}
      <section className="prog-hero prog-hero--mesa">
        <div className="prog-hero-mesa-inner">
          {program.batchNote && (
            <p className="prog-scarcity prog-scarcity--center">
              <span className="prog-scarcity-dot" aria-hidden="true" /> {program.batchNote}
            </p>
          )}
          {program.eyebrow && <p className="prog-hero-kicker">{program.eyebrow}</p>}
          <h1>{heroCopy.heading || program.title}</h1>
          {heroCopy.subhead && <p className="prog-hero-tagline">{heroCopy.subhead}</p>}
          {program.meta?.length > 0 && (
            <div className="prog-meta prog-meta--center">
              {program.meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          )}
          <div className="prog-hero-cta prog-hero-cta--center">
            <Cta to={cta('heroApply').to} className="prog-btn-primary">
              {cta('heroApply').label}
            </Cta>
            <Cta to={cta('heroPricing').to} className="prog-btn-secondary">
              {cta('heroPricing').label}
            </Cta>
          </div>
        </div>
      </section>

      {program.trustBar?.length > 0 && (
        <div className="prog-trust-bar" aria-label="Program highlights">
          <div className="prog-trust-bar-inner">
            {program.trustBar.map((t) => (
              <span key={t.label}>
                <strong>{t.value}</strong> {t.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------- why -------------------------------- */}
      {program.why?.paragraphs?.length > 0 && (
        <section className="prog-why" aria-labelledby="prog-why-heading">
          <div className="prog-why-inner">
            <div className="prog-why-copy">
              <h2 id="prog-why-heading">{copy('why').heading}</h2>
              {program.why.paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
              {program.why.brochureUrl && (
                <a
                  className="prog-brochure-btn"
                  href={program.why.brochureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {program.why.brochureLabel || 'Download brochure'}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 3v12m0 0l4-4m-4 4L8 11" />
                    <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                </a>
              )}
            </div>
            {program.why.image && (
              <div className="prog-why-media">
                <img
                  src={program.why.image}
                  alt={program.why.imageAlt || ''}
                  width="900"
                  height="600"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* --------------------------------- who -------------------------------- */}
      {program.audience?.length > 0 && (
        <section className="prog-who" aria-labelledby="prog-who-heading">
          <div className="prog-who-wrap">
            <h2 id="prog-who-heading">{copy('audience').heading}</h2>
            <div className="prog-who-grid">
              {program.audience.map((a) => (
                <article className="prog-who-card" key={a.title}>
                  {a.image && (
                    <div className="prog-who-img">
                      <img
                        src={a.image}
                        alt={a.imageAlt || ''}
                        width="600"
                        height="400"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="prog-who-body">
                    <h3>
                      <span className="num">{a.step}</span> {a.title}
                    </h3>
                    <p>{a.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ structure ----------------------------- */}
      {structure.rows?.length > 0 && (
        <section className="prog-section" id="structure">
          <div className="wrap">
            <p className="eyebrow">{copy('structure').eyebrow}</p>
            <h2>{copy('structure').heading}</h2>
            <p className="lede">{copy('structure').subhead}</p>
            <div className="prog-structure-table-wrap">
              <table className="prog-structure-table">
                <thead>
                  <tr>
                    {structure.columns.map((c) => (
                      <th scope="col" key={c}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {structure.rows.map((row) => (
                    <tr key={row.stage} className={cn(row.isTotal && 'prog-structure-total')}>
                      <td>
                        <strong>{row.stage}</strong>
                      </td>
                      {/* One value against every track column is drawn as a
                          single spanning cell — that is the shared Common Core. */}
                      {row.values.length === 1 && columnCount > 2 ? (
                        <td colSpan={columnCount - 1}>{row.values[0]}</td>
                      ) : (
                        row.values.map((v) => <td key={v}>{v}</td>)
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {program.stats?.length > 0 && (
              <div className="stat-row">
                {program.stats.map((s) => (
                  <div key={s.label}>
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ------------------------------- playbook ----------------------------- */}
      {(program.comparison?.theirs?.points?.length > 0 ||
        program.comparison?.ours?.points?.length > 0) && (
        <section
          className="prog-section"
          style={{ background: 'var(--bg-white)', borderBlock: '1px solid var(--line)' }}
        >
          <div className="wrap">
            <p className="eyebrow">{copy('comparison').eyebrow}</p>
            <h2>{copy('comparison').heading}</h2>
            <p className="lede">{copy('comparison').subhead}</p>
            <div className="diff">
              <div className="diff-col bad">
                <h3>{program.comparison.theirs?.title}</h3>
                <ul>
                  {(program.comparison.theirs?.points || []).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              <div className="diff-col good">
                <h3>{program.comparison.ours?.title}</h3>
                <ul>
                  {(program.comparison.ours?.points || []).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ Common Core --------------------------- */}
      {program.curriculum?.length > 0 && (
        <section className="prog-section" id="curriculum">
          <div className="wrap">
            <p className="eyebrow">{copy('curriculum').eyebrow}</p>
            <h2>{copy('curriculum').heading}</h2>
            {copy('curriculum').subhead && (
              <p className="lede prog-quote">{copy('curriculum').subhead}</p>
            )}
            <div className="weeks">
              {program.curriculum.map((w) => (
                <article className="week" key={`${w.week}-${w.title}`}>
                  <p className="label">{w.week}</p>
                  <h3>{w.title}</h3>
                  <ul>
                    {(w.points || []).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  {w.output && (
                    <p className="output">
                      <strong>Output:</strong> {w.output}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------- tracks ------------------------------ */}
      {program.tracks?.length > 0 && (
        <section
          className="prog-section prog-tracks-section"
          style={{ background: 'var(--bg-white)', borderBlock: '1px solid var(--line)' }}
        >
          <div className="wrap">
            <p className="eyebrow">{copy('tracks').eyebrow}</p>
            <h2>{copy('tracks').heading}</h2>
            <p className="lede">{copy('tracks').subhead}</p>
            <div className="prog-track-grid">
              {program.tracks.map((t) => (
                <article
                  className={cn('prog-track', t.variant && `prog-track--${t.variant}`)}
                  key={t.title}
                >
                  <p className="prog-track-tag">{t.tag}</p>
                  <h3>{t.title}</h3>
                  <p className="prog-track-goal">{t.goal}</p>
                  <ul className="prog-track-modules">
                    {(t.modules || []).map((m) => (
                      <li key={m.code}>
                        <strong>{m.code}</strong> {m.body}
                      </li>
                    ))}
                  </ul>
                  {t.milestone && <p className="prog-track-milestone">{t.milestone}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* -------------------------------- tools ------------------------------- */}
      {program.toolGroups?.length > 0 && (
        <section className="prog-section" id="tools">
          <div className="wrap">
            <p className="eyebrow">{copy('tools').eyebrow}</p>
            <h2>{copy('tools').heading}</h2>
            <p className="lede">{copy('tools').subhead}</p>
            <div className="prog-tools-grid">
              {program.toolGroups.map((g) => (
                <div className="prog-tools-col" key={g.title}>
                  <h3>{g.title}</h3>
                  <ul>
                    {(g.items || []).map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ admission ----------------------------- */}
      {program.admission?.length > 0 && (
        <section className="prog-section">
          <div className="wrap">
            <p className="eyebrow">{copy('admission').eyebrow}</p>
            <h2>{copy('admission').heading}</h2>
            <ol className="steps" style={{ margin: '1.5rem 0 0', padding: 0 }}>
              {program.admission.map((s) => (
                <li key={s.title}>
                  <strong>{s.title}</strong> {s.body}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ------------------------------- pricing ------------------------------ */}
      {pricing.amount > 0 && (
        <section className="prog-pricing" id="apply">
          <div className="prog-pricing-panel">
            <div className="prog-pricing-left">
              <p className="prog-pricing-amount">
                {pricing.currency && <span className="cur">{pricing.currency}</span>}{' '}
                {inr(pricing.amount)}
                {pricing.taxNote && <span className="tax">{pricing.taxNote}</span>}
              </p>
              {pricing.scholarship && <p className="prog-pricing-scholar">{pricing.scholarship}</p>}
              {pricing.duration && <p className="prog-pricing-duration">{pricing.duration}</p>}
              {pricing.status && <p className="prog-pricing-status">{pricing.status}</p>}
              {pricing.slots && <p className="prog-pricing-slots">{pricing.slots}</p>}
              <div className="prog-pricing-cta">
                <Cta to={cta('pricingApply').to} className="prog-btn-primary">
                  {cta('pricingApply').label}
                </Cta>
                <Cta to={cta('pricingFitCall').to} className="prog-btn-secondary prog-btn-on-gold">
                  {cta('pricingFitCall').label}
                </Cta>
              </div>
              {pricing.note && <p className="prog-pricing-note">{pricing.note}</p>}
            </div>
            <div className="prog-pricing-divider" aria-hidden="true" />
            <div className="prog-pricing-right">
              <h2>{copy('pricing').heading}</h2>
              <ul className="prog-funding-list">
                {(pricing.funding?.length ? pricing.funding : []).map((f) => (
                  <li key={f.title}>
                    <strong>{f.title}</strong>
                    <span>{f.body}</span>
                  </li>
                ))}
                {/* A program that predates the redesign has no `funding` list —
                    fall back to the plain benefits it does carry. */}
                {!pricing.funding?.length &&
                  (pricing.benefits || []).map((b) => (
                    <li key={b}>
                      <strong>{b}</strong>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------- FAQ -------------------------------- */}
      {program.faqs?.length > 0 && (
        <section className="prog-section">
          <div className="wrap">
            <p className="eyebrow">{copy('faqs').eyebrow}</p>
            <h2>{copy('faqs').heading}</h2>
            <div className="faq-block" style={{ marginTop: '1.25rem' }}>
              {program.faqs.map((f, i) => (
                <Faq key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ final CTA ----------------------------- */}
      <section className="prog-cta">
        <p className="eyebrow">{copy('cta').eyebrow}</p>
        <h2>{copy('cta').heading}</h2>
        {copy('cta').subhead && <p className="lede">{copy('cta').subhead}</p>}
        <div className="actions">
          <Cta to={cta('finalApply').to} className="prog-btn-primary">
            {cta('finalApply').label}
          </Cta>
          <Cta to={cta('finalSecondary').to} className="prog-btn-secondary">
            {cta('finalSecondary').label}
          </Cta>
        </div>
      </section>

      <StickyBar program={program} cta={cta} />
    </div>
  )
}
