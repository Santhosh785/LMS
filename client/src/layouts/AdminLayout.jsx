import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { adminNav } from '../data/nav.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useFeatures, visibleNav } from '../context/SiteConfigContext.jsx'
import { cn } from '../components/ui/index.jsx'
import BrandLogo from '../components/BrandLogo.jsx'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const features = useFeatures()
  const navigate = useNavigate()
  const location = useLocation()
  const sections = visibleNav(adminNav, features)

  // The blog is intentionally a self-contained WordPress-style workspace.
  // It owns its toolbar, sidebar and editor chrome; the rest of the product
  // keeps the Growth Scholar admin shell below unchanged.
  if (location.pathname.startsWith('/admin/blog')) return <Outlet />

  return (
    <div className="min-h-screen bg-surface-admin">
      <header className="sticky top-0 z-50 flex h-header-admin items-center gap-6 border-b border-line-admin bg-white px-4">
        <Link to="/admin" className="flex items-center gap-2">
          <BrandLogo width={110} height={70} className="h-7 w-auto rounded-sm2" />
          <span className="text-[0.8rem] font-bold uppercase tracking-[0.12em] text-muted">
            Admin
          </span>
        </Link>

        <nav
          className="flex h-full items-stretch gap-1 overflow-x-auto no-scrollbar mx-720:hidden"
          aria-label="Admin sections"
        >
          {sections.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[0.85rem] font-medium transition-colors duration-200 ease-gs',
                  isActive
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted-admin hover:text-brand',
                )
              }
            >
              {item.label}
              {item.dot && (
                <span className="h-1.5 w-1.5 rounded-full bg-danger-admin" aria-hidden="true" />
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {[
            { icon: '▦', label: 'Reports' },
            { icon: '◎', label: 'Preview' },
            { icon: '🔔', label: 'Notifications' },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              aria-label={b.label}
              title={b.label}
              className="grid h-9 w-9 place-items-center rounded-md2 text-muted-admin hover:bg-surface-admin hover:text-brand"
            >
              {b.icon}
            </button>
          ))}
          <button
            type="button"
            onClick={() => logout().then(() => navigate('/'))}
            title={`${user?.name} — sign out`}
            className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-brand text-[0.72rem] font-bold text-white"
          >
            {user?.avatarInitials}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-admin px-5 py-6 mx-640:px-4">
        <Outlet />
      </div>
    </div>
  )
}
