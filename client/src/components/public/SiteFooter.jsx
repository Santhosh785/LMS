import { Link } from 'react-router'
import { footerColumns, socialLinks } from '../../data/nav.js'
import { legalNav } from '../../data/legal.js'
import BrandLogo from '../BrandLogo.jsx'
import useBusiness from '../../hooks/useBusiness.js'
import useSiteNav from '../../hooks/useSiteNav.js'

/**
 * The 2026 redesign's .upgrad-footer — the light bordered footer is replaced by
 * a dark #0b1f1e slab: brand block and social row on the left, four-column
 * link grid on the right, then a rule and the legal bar.
 */

const socialClass =
  'grid h-9 w-9 place-items-center rounded-lg bg-white/[0.08] text-[0.75rem] font-bold uppercase text-white transition-colors duration-200 ease-gs hover:bg-brand'

export default function SiteFooter() {
  const business = useBusiness()
  const columns = useSiteNav(footerColumns)

  return (
    <footer className="bg-[#0b1f1e] text-[#d1d5db]">
      <div className="mx-auto grid max-w-footer grid-cols-[1fr_3fr] gap-10 px-[clamp(1rem,3vw,2rem)] pb-8 pt-12 mx-1040:grid-cols-1">
        <div>
          <Link to="/" className="inline-flex">
            <BrandLogo width={140} height={88} className="h-11 w-auto rounded-lg" />
          </Link>
          <p className="mb-[1.1rem] mt-[0.85rem] max-w-[22rem] text-[0.95rem] leading-[1.55] text-[#9ca3af]">
            Native-language growth marketing — self-paced foundation &amp; gap courses, LIVE
            Flagship (10 per batch), and workshops.
          </p>
          <div className="flex gap-2">
            {socialLinks.map((s) =>
              // Profiles without a real URL render as a badge rather than a dead "#" link.
              s.href ? (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={s.aria}
                  className={socialClass}
                >
                  {s.label}
                </a>
              ) : (
                <span key={s.label} aria-label={s.aria} title={s.aria} className={socialClass}>
                  {s.label}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-x-6 gap-y-8 mx-640:grid-cols-2">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-[0.85rem] text-[0.82rem] uppercase tracking-[0.06em] text-white">
                {col.title}
              </h4>
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="mb-2 block text-[0.9rem] text-[#9ca3af] transition-colors duration-200 ease-gs hover:text-accent"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* The rule sits inside the padding so it lines up with the content above. */}
      <div className="mx-auto max-w-footer px-[clamp(1rem,3vw,2rem)] pb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/[0.08] pt-[1.15rem]">
          <p className="text-[0.85rem] text-[#6b7280]">
            © 2021–2026 Growth Media Pvt. Ltd. All rights reserved.
          </p>
          {/* Policy pages have to be reachable from every page — payment gateways check. */}
          <nav aria-label="Policies" className="flex flex-wrap gap-x-4 gap-y-2">
            {legalNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-[0.85rem] text-[#9ca3af] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-4 text-[0.78rem] text-[#6b7280]">
          <p>Prices are inclusive. GST not applicable. All course fees are shown in INR.</p>
          <p className="mt-1">
            Support:{' '}
            <a href={`mailto:${business.supportEmail}`} className="hover:text-accent">
              {business.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
