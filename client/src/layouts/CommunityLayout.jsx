import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client.js'
import { communityNav } from '../data/nav.js'
import { useAuth } from '../context/AuthContext.jsx'
import { cn } from '../components/ui/index.jsx'
import BrandLogo from '../components/BrandLogo.jsx'

export default function CommunityLayout() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState({})

  const { data } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => (await api.get('/channels')).data,
  })

  const groups = data?.groups || []

  const focusComposer = () => {
    navigate('/community')
    setTimeout(() => {
      const el = document.querySelector('[data-composer]')
      el?.focus()
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  return (
    <div className="min-h-screen bg-surface-community">
      <header className="fixed inset-x-0 top-0 z-50 flex h-header-community items-center gap-6 border-b border-line bg-white px-4">
        <Link to="/" aria-label="Growth Scholar home">
          <BrandLogo width={120} height={75} className="h-8 w-auto rounded-sm2" />
        </Link>

        <nav className="flex gap-5 mx-760:hidden" aria-label="Primary">
          {communityNav
            .filter((l) => l.label !== 'Creator' || isAdmin)
            .map((l) => (
              <NavLink
                key={l.label}
                to={l.to}
                end={l.to === '/community'}
                className={({ isActive }) =>
                  cn(
                    'text-[0.88rem] font-medium',
                    isActive ? 'text-brand' : 'text-muted hover:text-brand',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            title="Notifications"
            aria-label="Notifications"
            className="relative grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-mist"
          >
            🔔
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
              3
            </span>
          </button>
          <Link
            to="/student/profile"
            title={user?.name || 'You'}
            className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[0.72rem] font-bold text-white"
          >
            {user?.avatarInitials || 'AR'}
          </Link>
        </div>
      </header>

      <div className="flex pt-header-community">
        <aside
          aria-label="Community navigation"
          className="sticky top-header-community h-[calc(100vh-58px)] w-sidebar shrink-0 overflow-y-auto border-r border-line bg-white p-4 mx-960:hidden"
        >
          <button
            type="button"
            onClick={focusComposer}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-[0.88rem] font-semibold text-white hover:bg-brand-deep"
          >
            <span>+</span> Create
          </button>

          <nav className="grid gap-0.5">
            <a
              href="#"
              className="flex items-center gap-2.5 rounded-md2 px-3 py-2 text-[0.88rem] text-muted hover:bg-surface-mist hover:text-brand"
            >
              <span aria-hidden="true">✦</span> From Growth Scholar Team
            </a>
            <NavLink
              to="/community"
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md2 px-3 py-2 text-[0.88rem]',
                  isActive
                    ? 'bg-accent-soft font-semibold text-brand'
                    : 'text-muted hover:bg-surface-mist hover:text-brand',
                )
              }
            >
              <span aria-hidden="true">☰</span> Feed
            </NavLink>
            <a
              href="#"
              className="flex items-center gap-2.5 rounded-md2 px-3 py-2 text-[0.88rem] text-muted hover:bg-surface-mist hover:text-brand"
            >
              <span aria-hidden="true">✉</span> Messages
              <span className="ml-auto rounded-full bg-surface-mist px-1.5 py-0.5 text-[0.66rem] font-bold">
                8
              </span>
            </a>
          </nav>

          {groups.map((group) => (
            <div key={group.name} className="mt-4">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group.name]: !c[group.name] }))}
                aria-expanded={!collapsed[group.name]}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted"
              >
                <span
                  className={cn(
                    'transition-transform duration-200 ease-gs',
                    collapsed[group.name] && '-rotate-90',
                  )}
                >
                  ▼
                </span>
                {group.name}
              </button>
              {!collapsed[group.name] && (
                <div className="grid gap-0.5">
                  {group.channels.map((c) => (
                    <NavLink
                      key={c._id}
                      to={`/community/${c.slug}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-1.5 rounded-md2 px-3 py-1.5 text-[0.85rem]',
                          isActive
                            ? 'bg-accent-soft font-semibold text-brand'
                            : 'text-muted hover:bg-surface-mist hover:text-brand',
                        )
                      }
                    >
                      <span className="text-muted" aria-hidden="true">
                        #
                      </span>
                      {c.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1 p-6 mx-640:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
