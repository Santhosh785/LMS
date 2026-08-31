import { Link, useLocation } from 'react-router-dom'
import { legalNav } from '../../data/legal.js'
import useBusiness from '../../hooks/useBusiness.js'
import { cn } from '../ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/**
 * Shared shell for the policy pages (privacy, terms, refund, delivery,
 * contact). One narrow reading column, the same card treatment as the rest of
 * the public site, and a cross-link rail so a reviewer — or Razorpay — can
 * reach every policy from any one of them.
 */

/**
 * A visible, deliberately ugly marker for content the business owner still has
 * to supply. Rendering it loudly is the point: a blank beats an invented term.
 */
export function Tbc({ children }) {
  return (
    <mark className="mx-0.5 inline-block break-words rounded-sm2 border border-dashed border-warn bg-[#fef3c7] px-1.5 py-0.5 text-[0.82em] font-bold uppercase tracking-tighter2 text-[#92400e]">
      [[ To be confirmed: {children} ]]
    </mark>
  )
}

/** Prints `value` once the owner has filled it in, otherwise the marker. */
export function Field({ value, label }) {
  return value ? <>{value}</> : <Tbc>{label}</Tbc>
}

/** A numbered policy clause: heading plus a stack of paragraphs. */
export function Section({ id, title, children }) {
  return (
    <section id={id} className="mt-8 scroll-mt-[90px] first:mt-0">
      <h2 className="text-[1.1rem]">{title}</h2>
      <div className="mt-2.5 space-y-3 text-[0.92rem] leading-relaxed text-muted">{children}</div>
    </section>
  )
}

/** Bulleted list styled for the policy column. */
export function Bullets({ children, className }) {
  return <ul className={cn('ml-5 list-disc space-y-2', className)}>{children}</ul>
}

/** Pulls a key fact (a window, an SLA) out of the body copy so it can't be missed. */
export function Callout({ title, children }) {
  return (
    <div className="rounded-lg2 border border-line-strong bg-accent-soft p-4 text-[0.9rem] leading-relaxed text-brand-deep">
      {title && <p className="mb-1 font-bold">{title}</p>}
      {children}
    </div>
  )
}

/** mailto: link — the policy pages never render a dead "#" href. */
export function Mail({ address, className }) {
  return (
    <a href={`mailto:${address}`} className={cn('font-semibold text-brand underline', className)}>
      {address}
    </a>
  )
}

function PolicyRail() {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Policies" className="mt-6 flex flex-wrap gap-2">
      {legalNav.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            'rounded-full border px-3 py-1.5 text-[0.8rem] font-medium transition-colors duration-200 ease-gs',
            pathname === item.to
              ? 'border-brand bg-accent-soft text-brand'
              : 'border-line text-muted hover:border-brand hover:text-brand',
          )}
          aria-current={pathname === item.to ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export default function LegalPage({ title, intro, updated, children }) {
  // Not a default parameter: the brand name and support details come from admin
  // settings now, which a hook has to resolve inside the component.
  const business = useBusiness()
  const lastUpdated = updated || business.policyLastUpdated
  useDocumentTitle(`${title} | ${business.brandName}`)

  return (
    <div className="px-5 py-10 mx-560:px-4 mx-560:py-7">
      <div className="mx-auto w-full max-w-3xl">
        <nav className="mb-4 text-[0.8rem] text-muted" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-brand">
            Home
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-brand-deep">{title}</span>
        </nav>

        <header className="rounded-xl2 border border-line bg-white p-6 shadow-softer mx-560:p-5">
          <h1 className="text-[clamp(1.5rem,3vw,2.1rem)]">{title}</h1>
          {intro && <p className="mt-3 text-[0.95rem] leading-relaxed text-muted">{intro}</p>}
          <p className="mt-4 text-[0.78rem] text-muted">
            Last updated: {lastUpdated} · Applies to {business.brandName} (
            <Field value={business.legalName} label="registered legal entity name" />)
          </p>
        </header>

        <article className="mt-6 rounded-xl2 border border-line bg-white p-6 shadow-softer mx-560:p-5">
          {children}
        </article>

        <PolicyRail />
      </div>
    </div>
  )
}
