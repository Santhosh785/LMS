import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { primaryNav, mobileNav } from '../../data/nav.js'
import useSiteNav from '../../hooks/useSiteNav.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { cn } from '../ui/index.jsx'
import BrandLogo from '../BrandLogo.jsx'

/**
 * The 2026 redesign's .guvi-header / .guvi-nav--lemlist.
 *
 * Differences from the header it replaces: a solid white bar rather than a
 * translucent wash, `auto 1fr auto` columns, heavier 600-weight links, and
 * dropdowns that carry section labels and rules alongside links. The scroll
 * listener survives because .is-scrolled still only adds the shadow.
 */

const navLinkClass =
  'inline-flex min-h-[44px] items-center gap-[0.35rem] px-[0.85rem] text-[0.92rem] font-semibold ' +
  'tracking-[-0.01em] text-ink transition-colors duration-[250ms] ease-gs hover:text-brand'

/** .is-current — brand underline drawn inside the box so it never shifts layout. */
const currentClass = 'text-brand-deep shadow-[inset_0_-2px_0_#135855]'

const menuLinkClass =
  'block px-4 py-[0.65rem] text-[0.92rem] font-medium text-[#374151] hover:bg-accent-soft hover:text-brand'

/**
 * Dividers are authored last in the tree so taxonomy topics land beneath them.
 * When every topic is hidden the rule would be the final child and draw a line
 * under nothing, so trailing separators are dropped after resolution.
 */
function trimTrailingDividers(children) {
  const out = [...children]
  while (out.length && out[out.length - 1].kind === 'divider') out.pop()
  return out
}

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const location = useLocation()
  const { user, isAdmin } = useAuth()
  const nav = useSiteNav(primaryNav)
  const mobileLinks = useSiteNav(mobileNav)

  // .is-scrolled toggled past 12px, exactly as js/main.js did
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // any outside click closes the open dropdown
  useEffect(() => {
    const onDocClick = () => setOpenMenu(null)
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  // Escape closes whichever surface is open, matching js/main.js
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setOpenMenu(null)
      setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setOpenMenu(null)
  }, [location.pathname])

  const isCurrent = useMemo(() => {
    const path = location.pathname
    return (to) => {
      if (!to || to.startsWith('/#') || to === '/') return false
      const [base] = to.split('?')
      return path === base || path.startsWith(`${base}/`)
    }
  }, [location.pathname])

  /** One ghost slot, resolved against the session; the primary CTA never moves. */
  const ghost = isAdmin
    ? { label: 'Creator', to: '/admin' }
    : user
      ? { label: 'My Learning', to: '/student' }
      : { label: 'Log in', to: '/login' }

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 grid h-header grid-cols-[auto_1fr_auto] items-center gap-4',
        'border-b border-line bg-white px-[clamp(1.25rem,4vw,2.5rem)]',
        'transition-shadow duration-[350ms] ease-gs mx-960:grid-cols-[1fr_auto]',
        scrolled && 'shadow-softer',
      )}
    >
      <Link
        to="/"
        className="inline-flex items-center justify-self-start"
        aria-label="Growth Scholar home"
      >
        <BrandLogo width={160} height={100} className="h-12 w-auto rounded-[10px]" />
      </Link>

      <nav
        className="flex items-center justify-center gap-[0.05rem] mx-960:hidden"
        aria-label="Primary"
      >
        {nav.map((item, _i, all) => {
          if (!item.menu) {
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(navLinkClass, isCurrent(item.to) && currentClass)}
              >
                {item.label}
              </Link>
            )
          }

          const children = trimTrailingDividers(item.menu)
          const open = openMenu === item.label
          // A page that has its own top-level link (Workshops) highlights only
          // that link, not also a dropdown that happens to list it.
          const branchCurrent =
            !all.some((other) => !other.menu && isCurrent(other.to)) &&
            children.some((c) => isCurrent(c.to))

          return (
            <div key={item.label} className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenMenu(open ? null : item.label)}
                className={cn(
                  navLinkClass,
                  'cursor-pointer border-none bg-transparent',
                  (open || branchCurrent) && 'text-brand',
                  branchCurrent && currentClass,
                )}
              >
                {item.label}
                <span className="text-[0.7rem] opacity-70" aria-hidden="true">
                  ▾
                </span>
              </button>

              <div
                role="menu"
                hidden={!open}
                className={cn(
                  'absolute left-0 top-[calc(100%-2px)] z-[60] min-w-[220px] rounded-xl border border-line',
                  'bg-white py-[0.65rem] shadow-soft',
                )}
              >
                {children.map((link, i) => {
                  if (link.kind === 'divider') {
                    return (
                      <div
                        key={`rule-${i}`}
                        role="separator"
                        className="my-[0.45rem] h-px bg-[#eef0f3]"
                      />
                    )
                  }
                  if (link.kind === 'label') {
                    return (
                      <p
                        key={`label-${link.label}`}
                        className="m-0 px-4 pb-[0.5rem] pt-[0.35rem] text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-[#9ca3af]"
                      >
                        {link.label}
                      </p>
                    )
                  }
                  return (
                    <Link
                      key={link.label}
                      to={link.to}
                      className={cn(
                        menuLinkClass,
                        link.feature && 'font-bold text-brand-deep',
                        isCurrent(link.to) && 'bg-accent-soft font-bold text-brand-deep',
                      )}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-end gap-[0.35rem] justify-self-end mx-960:hidden">
        <Link
          to={ghost.to}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-[0.85rem] py-2 text-[0.9rem] font-semibold leading-[1.2] text-[#374151] transition-colors duration-[250ms] ease-gs hover:text-brand"
        >
          {ghost.label}
        </Link>
        <Link
          to="/programs/complete-growth-marketing"
          className="inline-flex min-h-[42px] items-center justify-center gap-[0.45rem] whitespace-nowrap rounded-full bg-brand px-[1.15rem] text-[0.88rem] font-bold leading-[1.2] text-white shadow-[0_8px_22px_rgba(19,88,85,0.22)] transition-all duration-[250ms] ease-gs hover:-translate-y-px hover:bg-brand-deep"
        >
          Apply for Flagship
          <span
            className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[0.85rem] leading-none"
            aria-hidden="true"
          >
            →
          </span>
        </Link>
      </div>

      <button
        type="button"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={(e) => {
          e.stopPropagation()
          setMobileOpen((v) => !v)
        }}
        className="hidden h-[42px] w-[42px] flex-col items-center justify-center gap-[6px] justify-self-end rounded-[10px] border border-line bg-white mx-960:flex"
      >
        <span
          className={cn(
            'block h-[1.5px] w-4 bg-brand transition-transform duration-200',
            mobileOpen && 'translate-y-[3.75px] rotate-45',
          )}
        />
        <span
          className={cn(
            'block h-[1.5px] w-4 bg-brand transition-transform duration-200',
            mobileOpen && '-translate-y-[3.75px] -rotate-45',
          )}
        />
      </button>

      <nav
        aria-label="Mobile"
        className={cn(
          // Stays hidden above 960px even if the state is somehow left open
          // across a resize — the toggle that sets it is itself desktop-hidden.
          'absolute inset-x-0 top-header z-40 hidden flex-col border-b border-line bg-white px-5 pb-4 pt-2',
          mobileOpen && 'mx-960:flex',
        )}
      >
        {mobileLinks.map((link) => (
          <Link
            key={link.label}
            to={link.to}
            className="border-b border-[#eef0ef] py-[0.85rem] text-[0.95rem] font-medium text-muted hover:text-brand"
          >
            {link.label}
          </Link>
        ))}
        <Link
          to={ghost.to}
          className="border-b border-[#eef0ef] py-[0.85rem] text-[0.95rem] font-medium text-muted hover:text-brand"
        >
          {ghost.label}
        </Link>
        <Link
          to="/programs/complete-growth-marketing"
          className="py-[0.85rem] text-[0.95rem] font-bold text-brand"
        >
          Apply for Flagship
        </Link>
      </nav>
    </header>
  )
}
