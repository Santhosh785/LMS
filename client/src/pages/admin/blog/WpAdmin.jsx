import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client.js'
import { useAuth } from '../../../context/AuthContext.jsx'
import { Icon, useDismissable, useScreenOption } from './wp.jsx'
import '../../../styles/wp-admin.css'

/**
 * The wp-admin shell: admin bar, collapsible admin menu, footer.
 *
 * Only /admin/blog gets this chrome. AdminLayout steps aside for the route
 * (see layouts/AdminLayout.jsx) so the blog is a self-contained workspace with
 * its own navigation, and every menu entry here points at something real —
 * either a screen in this workspace or the product admin screen that already
 * owns that job. Nothing is decorative.
 */

const MENU = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/admin/blog/dashboard' },
  {
    key: 'posts',
    label: 'Posts',
    icon: 'post',
    to: '/admin/blog',
    children: [
      { label: 'All Posts', to: '/admin/blog', end: true },
      { label: 'Add New Post', to: '/admin/blog/new' },
      { label: 'Categories', to: '/admin/blog/categories' },
      { label: 'Tags', to: '/admin/blog/tags' },
    ],
  },
  {
    key: 'media',
    label: 'Media',
    icon: 'media',
    to: '/admin/blog/media',
    children: [
      { label: 'Library', to: '/admin/blog/media', end: true },
      { label: 'Add New Media File', to: '/admin/blog/media/new' },
    ],
  },
  { key: 'comments', label: 'Comments', icon: 'comments', to: '/admin/blog/comments', badge: 'comments' },
  {
    key: 'tools',
    label: 'Tools',
    icon: 'tools',
    to: '/admin/blog/tools',
    children: [
      { label: 'Import', to: '/admin/blog/tools?tab=import' },
      { label: 'Export', to: '/admin/blog/tools?tab=export' },
    ],
  },
  { separator: true, key: 'sep' },
  { key: 'users', label: 'Users', icon: 'users', to: '/admin/users', outside: true },
  { key: 'settings', label: 'Settings', icon: 'settings', to: '/admin/settings', outside: true },
  { key: 'exit', label: 'Main Admin', icon: 'appearance', to: '/admin', outside: true },
]

/** The block editor is a fullscreen surface — it replaces the shell entirely. */
const isEditorRoute = (pathname) => /^\/admin\/blog\/(new|post\/)/.test(pathname)

function AdminBarMenu({ id, openId, setOpenId, label, children, count, align = 'left' }) {
  const ref = useDismissable(() => openId === id && setOpenId(''))
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        className="wp-adminbar-item"
        aria-expanded={openId === id}
        aria-haspopup="true"
        onClick={() => setOpenId(openId === id ? '' : id)}
      >
        {label}
        {count > 0 && <span className="wp-adminbar-count">{count}</span>}
      </button>
      {openId === id && (
        <div className="wp-adminbar-menu" style={align === 'right' ? { right: 0 } : { left: 0 }}>
          {children(() => setOpenId(''))}
        </div>
      )}
    </div>
  )
}

export default function WpAdmin() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [folded, setFolded] = useScreenOption('menu-folded', false)
  const [openBar, setOpenBar] = useState('')
  const [openMenu, setOpenMenu] = useState('')

  // The comment bubble is the one number wp-admin keeps live in its chrome.
  const pending = useQuery({
    queryKey: ['admin', 'blog', 'pending-comments'],
    queryFn: async () => (await api.get('/admin/blog/comments', { params: { status: 'Pending', perPage: 1 } })).data,
    refetchInterval: 60000,
    staleTime: 30000,
  })
  const pendingCount = pending.data?.counts?.Pending || 0

  if (isEditorRoute(location.pathname)) return <Outlet />

  const initials = (user?.name || 'Admin')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="wp-admin">
      <div className="wp-adminbar">
        <AdminBarMenu id="logo" openId={openBar} setOpenId={setOpenBar} label={<Icon name="wordpress" size={20} />}>
          {(close) => (
            <>
              <Link to="/admin/blog/dashboard" onClick={close}>
                Blog workspace
              </Link>
              <Link to="/admin/blog/tools?tab=export" onClick={close}>
                Export content
              </Link>
              <Link to="/admin" onClick={close}>
                Growth Scholar admin
              </Link>
            </>
          )}
        </AdminBarMenu>

        <AdminBarMenu
          id="site"
          openId={openBar}
          setOpenId={setOpenBar}
          label={
            <>
              <Icon name="dashboard" size={16} />
              Growth Scholar
            </>
          }
        >
          {(close) => (
            <>
              <Link to="/admin/blog/dashboard" onClick={close}>
                Dashboard
              </Link>
              <a href="/blog" target="_blank" rel="noreferrer" onClick={close}>
                Visit Blog
              </a>
              <Link to="/admin/blog/comments" onClick={close}>
                Manage Comments
              </Link>
            </>
          )}
        </AdminBarMenu>

        <Link to="/admin/blog/comments" className="wp-adminbar-item" title={`${pendingCount} comments awaiting moderation`}>
          <Icon name="comments" size={16} />
          <span className={pendingCount ? 'wp-adminbar-count' : ''}>{pendingCount || 0}</span>
        </Link>

        <AdminBarMenu id="new" openId={openBar} setOpenId={setOpenBar} label="+ New">
          {(close) => (
            <>
              <Link to="/admin/blog/new" onClick={close}>
                Post
              </Link>
              <Link to="/admin/blog/media/new" onClick={close}>
                Media
              </Link>
              <Link to="/admin/blog/categories" onClick={close}>
                Category
              </Link>
              <Link to="/admin/blog/tags" onClick={close}>
                Tag
              </Link>
            </>
          )}
        </AdminBarMenu>

        <span className="wp-adminbar-sep" />

        <AdminBarMenu
          id="account"
          openId={openBar}
          setOpenId={setOpenBar}
          align="right"
          label={
            <>
              Howdy, {user?.name || 'Admin'}
              <span className="wp-adminbar-avatar">{initials}</span>
            </>
          }
        >
          {(close) => (
            <>
              <Link to="/admin/users" onClick={close}>
                Edit Profile
              </Link>
              <Link to="/admin" onClick={close}>
                Growth Scholar admin
              </Link>
              <button
                type="button"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 12px', color: '#c3c4c7' }}
                onClick={() => {
                  close()
                  logout()
                  navigate('/login')
                }}
              >
                Log Out
              </button>
            </>
          )}
        </AdminBarMenu>
      </div>

      <div className="wp-body">
        <nav className={`wp-adminmenu ${folded ? 'is-folded' : ''}`} aria-label="Blog admin menu">
          {MENU.map((item) => {
            if (item.separator) return <div key={item.key} className="wp-menu-separator" />
            const current =
              item.to === '/admin/blog'
                ? location.pathname === '/admin/blog' ||
                  ['/admin/blog/categories', '/admin/blog/tags'].includes(location.pathname)
                : !item.outside && location.pathname.startsWith(item.to)
            return (
              <div
                key={item.key}
                className={`wp-menu-item ${current ? 'is-current' : ''} ${openMenu === item.key ? 'is-open' : ''}`}
                onMouseEnter={() => item.children && setOpenMenu(item.key)}
                onMouseLeave={() => item.children && setOpenMenu('')}
              >
                <Link className="wp-menu-link" to={item.to} title={item.label}>
                  <Icon name={item.icon} size={20} />
                  <span className="wp-menu-label">{item.label}</span>
                  {item.badge === 'comments' && pendingCount > 0 && (
                    <span className="wp-adminbar-count">{pendingCount}</span>
                  )}
                  {item.outside && !folded && <Icon name="external" size={14} style={{ opacity: 0.5 }} />}
                </Link>
                {item.children && (current || openMenu === item.key) && (
                  <div className="wp-submenu">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) => (isActive ? 'is-current' : '')}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <button type="button" className="wp-collapse" onClick={() => setFolded(!folded)} aria-expanded={!folded}>
            <Icon name={folded ? 'chevronRight' : 'chevronLeft'} size={20} />
            <span className="wp-menu-label">Collapse menu</span>
          </button>
        </nav>

        <div className="wp-content">
          <Outlet />
          <div className="wp-footer" style={{ margin: '40px 0 0' }}>
            <span>
              Thank you for creating with{' '}
              <a href="/blog" target="_blank" rel="noreferrer">
                Growth Scholar Blog
              </a>
              .
            </span>
            <span>Editorial workspace</span>
          </div>
        </div>
      </div>
    </div>
  )
}
