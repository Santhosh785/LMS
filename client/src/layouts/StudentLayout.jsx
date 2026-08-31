import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { studentNav, studentTopNav } from '../data/nav.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useFeatures, visibleNav } from '../context/SiteConfigContext.jsx'
import { Button, cn } from '../components/ui/index.jsx'
import BrandLogo from '../components/BrandLogo.jsx'

export default function StudentLayout() {
  const [sideOpen, setSideOpen] = useState(false)
  const [search, setSearch] = useState('')
  const sideRef = useRef(null)
  const toggleRef = useRef(null)
  const { user, logout } = useAuth()
  const features = useFeatures()
  const location = useLocation()
  const navigate = useNavigate()
  const sideNav = visibleNav(studentNav, features)

  // click-outside closes the drawer, as student.js did
  useEffect(() => {
    if (!sideOpen) return undefined
    const onClick = (e) => {
      if (sideRef.current?.contains(e.target) || toggleRef.current?.contains(e.target)) return
      setSideOpen(false)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [sideOpen])

  useEffect(() => setSideOpen(false), [location.pathname])

  const onSearch = (e) => {
    e.preventDefault()
    navigate(`/student/courses?q=${encodeURIComponent(search)}`)
  }

  return (
    <div className="min-h-screen bg-surface-student">
      <header className="fixed inset-x-0 top-0 z-50 flex h-header-student items-center gap-4 border-b border-line bg-white px-4">
        <button
          ref={toggleRef}
          type="button"
          data-st-menu
          aria-label="Open menu"
          aria-expanded={sideOpen}
          onClick={() => setSideOpen((v) => !v)}
          className="hidden h-9 w-9 place-items-center rounded-md2 text-[1.1rem] text-muted hover:bg-surface-mist mx-960:grid"
        >
          ☰
        </button>

        <Link to="/student" className="flex items-center gap-2">
          <BrandLogo width={120} height={75} className="h-9 w-auto rounded-sm2" />
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.68rem] font-bold text-brand">
            Learn
          </span>
        </Link>

        <form onSubmit={onSearch} className="relative ml-2 max-w-sm flex-1 mx-760:hidden">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            ⌕
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your courses…"
            aria-label="Search courses"
            className="w-full rounded-full border border-line bg-surface-student py-2 pl-9 pr-3 text-[0.88rem] outline-none focus:border-brand"
          />
        </form>

        <nav className="ml-auto flex items-center gap-5 mx-960:hidden" aria-label="Shortcuts">
          {studentTopNav
            .filter((l) => l.label !== 'Creator' || user?.role === 'admin')
            .map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="text-[0.88rem] font-medium text-muted hover:text-brand"
              >
                {l.label}
              </Link>
            ))}
        </nav>

        <div className="flex items-center gap-2 mx-960:ml-auto">
          <button
            type="button"
            aria-label="Notifications"
            className="relative grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-mist"
          >
            🔔
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-danger" />
          </button>
          <Link
            to="/student/profile"
            title={user?.name}
            className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[0.75rem] font-bold text-white"
          >
            {user?.avatarInitials}
          </Link>
        </div>
      </header>

      <div className="flex pt-header-student">
        <aside
          ref={sideRef}
          aria-label="Student navigation"
          className={cn(
            'fixed bottom-0 left-0 top-header-student z-40 w-side overflow-y-auto border-r border-line bg-white p-4',
            'transition-transform duration-300 ease-gs',
            'mx-960:-translate-x-full',
            sideOpen && 'mx-960:translate-x-0 mx-960:shadow-soft',
          )}
        >
          <p className="mb-2 px-3 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted">
            Learn
          </p>
          <nav className="grid gap-0.5">
            {sideNav.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md2 px-3 py-2.5 text-[0.9rem] transition-colors duration-200 ease-gs',
                    isActive
                      ? 'bg-accent-soft font-semibold text-brand'
                      : 'text-muted hover:bg-surface-mist hover:text-brand',
                  )
                }
              >
                <span aria-hidden="true">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.count ? (
                  <span className="rounded-full bg-surface-mist px-1.5 py-0.5 text-[0.68rem] font-bold text-muted">
                    {item.count}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          <div className="mt-5 rounded-lg2 bg-accent-soft p-4">
            <h4 className="text-[0.92rem]">Complete Growth Marketing</h4>
            <p className="mt-1 text-[0.8rem] text-muted">
              12-week flagship — next cohort seats open.
            </p>
            <Button
              to="/programs/complete-growth-marketing"
              variant="accent"
              size="sm"
              className="mt-3"
            >
              View program
            </Button>
          </div>

          <button
            type="button"
            onClick={() => logout().then(() => navigate('/'))}
            className="mt-5 w-full rounded-md2 px-3 py-2.5 text-left text-[0.88rem] text-muted hover:bg-surface-mist hover:text-danger"
          >
            ⏻ Sign out
          </button>
        </aside>

        <main className="ml-side flex-1 p-6 mx-960:ml-0 mx-640:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
