import { Link } from 'react-router-dom'
import { footerColumns, socialLinks } from '../../data/nav.js'
import { legalNav } from '../../data/legal.js'
import BrandLogo from '../BrandLogo.jsx'
import useBusiness from '../../hooks/useBusiness.js'
import useSiteNav from '../../hooks/useSiteNav.js'

const socialClass =
  'grid h-9 w-9 place-items-center rounded-full border border-line text-[0.75rem] font-bold uppercase text-muted transition-colors duration-200 ease-gs hover:border-brand hover:bg-accent-soft hover:text-brand'

export default function SiteFooter() {
  const business = useBusiness()
  const columns = useSiteNav(footerColumns)
  return (
    <footer className="mt-16 border-t border-line bg-white">
      <div className="mx-auto grid max-w-shell grid-cols-[1.1fr_3fr] gap-10 px-5 py-14 mx-960:grid-cols-1">
        <div className="max-w-xs">
          <Link to="/" className="inline-flex">
            <BrandLogo width={140} height={88} className="h-11 w-auto rounded-sm2" />
          </Link>
          <p className="mt-4 text-[0.9rem] leading-relaxed text-muted">
            Native-based marketing upskilling platform. Test. Learn. Repeat. Become a Growth
            Marketer.
          </p>
          <div className="mt-5 flex gap-2">
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

        <div className="grid grid-cols-5 gap-6 mx-1040:grid-cols-3 mx-640:grid-cols-2">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-[0.9rem]">{col.title}</h4>
              <div className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="text-[0.85rem] text-muted transition-colors duration-200 ease-gs hover:text-brand"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-3 px-5 py-5 text-[0.82rem] text-muted">
          <p>© 2021–2026 Growth Media Pvt. Ltd. All rights reserved.</p>
          {/* Policy pages have to be reachable from every page — payment gateways check. */}
          <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
            {legalNav.map((item) => (
              <Link key={item.to} to={item.to} className="hover:text-brand">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mx-auto max-w-shell px-5 pb-5 text-[0.78rem] text-muted">
          <p>Prices are inclusive. GST not applicable. All course fees are shown in INR.</p>
          <p className="mt-1">
            Support:{' '}
            <a href={`mailto:${business.supportEmail}`} className="hover:text-brand">
              {business.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
