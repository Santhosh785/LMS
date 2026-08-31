import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { primaryNav, mobileNav } from '../../data/nav.js'
import useSiteNav from '../../hooks/useSiteNav.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn } from '../ui/index.jsx'
import BrandLogo from '../BrandLogo.jsx'

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const headerRef = useRef(null)
  const location = useLocation()
  const { user, isAdmin } = useAuth()
  // Resolved against the admin menu toggles and the published topics.
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

  useEffect(() => {
    setMobileOpen(false)
    setOpenMenu(null)
  }, [location.pathname])

  return (
    <>
      <header
        ref={headerRef}
        className={cn(
          'fixed inset-x-0 top-0 z-50 grid h-header grid-cols-[1fr_auto_1fr] items-center gap-4',
          'px-[clamp(1.25rem,4vw,2.5rem)] backdrop-blur-[14px]',
          'border-b transition-all duration-[350ms] ease-gs',
          scrolled ? 'border-line bg-white/95 shadow-softer' : 'border-transparent bg-surface/90',
        )}
      >
        <Link
          to="/"
          className="inline-flex items-center justify-self-start"
          aria-label="Growth Scholar home"
        >
          <BrandLogo width={160} height={100} className="h-12 w-auto rounded-sm2" />
        </Link>

        <nav className="flex justify-center gap-7 mx-960:hidden" aria-label="Primary">
          {nav.map((item) =>
            item.menu ? (
              <div key={item.label} className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  aria-expanded={openMenu === item.label}
                  onClick={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                  className="flex items-center gap-1 text-[0.95rem] font-medium text-muted transition-colors duration-[250ms] ease-gs hover:text-brand"
                >
                  {item.label}
                  <span className="text-[0.6rem]" aria-hidden="true">
                    ▾
                  </span>
                </button>
                <div
                  role="menu"
                  className={cn(
                    'absolute left-1/2 top-[calc(100%+0.75rem)] w-56 -translate-x-1/2 rounded-lg2 border border-line',
                    'bg-white p-2 shadow-soft transition-all duration-200 ease-gs',
                    openMenu === item.label
                      ? 'visible translate-y-0 opacity-100'
                      : 'invisible -translate-y-1 opacity-0',
                  )}
                >
                  {item.menu.map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="flex items-center gap-2 rounded-md2 px-3 py-2 text-[0.88rem] text-muted hover:bg-accent-soft hover:text-brand"
                    >
                      {link.label}
                      {link.live && (
                        <span className="rounded-full bg-danger px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                          LIVE
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                className="text-[0.95rem] font-medium text-muted transition-colors duration-[250ms] ease-gs hover:text-brand"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center justify-end gap-2 justify-self-end mx-960:hidden">
          {isAdmin && (
            <Button to="/admin" variant="ghost">
              Creator
            </Button>
          )}
          {user ? (
            <Button to="/student" variant="primary">
              My Learning
            </Button>
          ) : (
            <>
              <Button to="/login" variant="ghost">
                Login
              </Button>
              <Button to="/signup" variant="primary">
                Sign up
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={(e) => {
            e.stopPropagation()
            setMobileOpen((v) => !v)
          }}
          className="hidden flex-col items-center justify-center gap-[5px] justify-self-end mx-960:flex"
        >
          <span
            className={cn(
              'block h-0.5 w-6 bg-brand-deep transition-transform duration-200',
              mobileOpen && 'translate-y-[3.5px] rotate-45',
            )}
          />
          <span
            className={cn(
              'block h-0.5 w-6 bg-brand-deep transition-transform duration-200',
              mobileOpen && '-translate-y-[3.5px] -rotate-45',
            )}
          />
        </button>
      </header>

      <nav
        aria-label="Mobile"
        className={cn(
          'fixed inset-x-0 top-header z-40 flex-col gap-1 border-b border-line bg-white p-4 shadow-soft mx-960:flex',
          mobileOpen ? 'flex' : 'hidden',
        )}
      >
        {mobileLinks.map((link) => (
          <Link
            key={link.label}
            to={link.to}
            className="rounded-md2 px-3 py-2.5 text-[0.95rem] font-medium text-muted hover:bg-accent-soft hover:text-brand"
          >
            {link.label}
          </Link>
        ))}
        {user ? (
          <Link
            to="/student"
            className="rounded-md2 px-3 py-2.5 text-[0.95rem] font-semibold text-brand"
          >
            My Learning
          </Link>
        ) : (
          <>
            <Link
              to="/login"
              className="rounded-md2 px-3 py-2.5 text-[0.95rem] font-medium text-muted"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="rounded-md2 px-3 py-2.5 text-[0.95rem] font-semibold text-brand"
            >
              Sign up
            </Link>
          </>
        )}
      </nav>
    </>
  )
}
