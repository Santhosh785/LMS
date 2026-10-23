/**
 * Navigation trees lifted from the original markup so every layout renders
 * from data rather than repeating the same JSX on 54 pages.
 *
 * `menuKey` names the admin settings toggle that governs an entry, and
 * `termsFrom` marks a submenu whose links are generated from the taxonomy
 * rather than listed here. Both are resolved by hooks/useSiteNav.js — this file
 * stays a plain data module with no imports.
 */

/* --------------------------------- public -------------------------------- */
/**
 * Playbooks and Claude Skills shipped with the Resources section, so their
 * links are live. The gate is kept because it is the switch that hides them
 * again if the section is ever pulled: set it to `false` and every reference —
 * header, footer, and the homepage teasers — disappears together rather than
 * leaving one of them pointing at a dead route.
 */
export const RESOURCES_PAGES_READY = true

const whenResourcesReady = (entries) =>
  RESOURCES_PAGES_READY ? entries : entries.filter((e) => !e.to?.startsWith('/resources/'))

/**
 * The 2026 redesign restructured the header from five entries to four:
 * Courses · Workshops · Flagship Program · Resources ▾.
 *
 * Dropdown children may be a link, a `kind: 'label'` section heading, or a
 * `kind: 'divider'` rule — the three things the redesign's .nav-menu--lemlist
 * markup contains. `feature: true` renders the bolder .nav-menu-feature link.
 * The divider is listed last so the topics appended by `termsFrom` fall below
 * it, matching the static markup; SiteHeader drops a divider left trailing when
 * every topic is hidden.
 */
export const primaryNav = [
  // A plain link, not a dropdown: the course library already carries the topic
  // filters the dropdown used to list.
  { label: 'Courses', to: '/courses', menuKey: 'showCourses' },
  { label: 'Workshops', to: '/workshops', menuKey: 'showWorkshops' },
  { label: 'Flagship Program', to: '/programs/complete-growth-marketing' },
  {
    label: 'Resources',
    menu: whenResourcesReady([
      { label: 'Workshops', to: '/workshops', menuKey: 'showWorkshops' },
      { label: 'Playbooks', to: '/resources/playbooks' },
      { label: 'Blog', to: '/blog', menuKey: 'showBlog' },
      { label: 'Claude Skills', to: '/resources/claude-skills' },
    ]),
  },
]

export const mobileNav = [
  { label: 'Courses', to: '/courses', menuKey: 'showCourses' },
  { label: 'Workshops', to: '/workshops', menuKey: 'showWorkshops' },
  { label: 'Flagship Program', to: '/programs/complete-growth-marketing' },
  { label: 'Resources', to: '/blog', menuKey: 'showBlog' },
]

export const footerColumns = [
  {
    title: 'LIVE Programs',
    links: [
      { label: 'Workshops', to: '/workshops', menuKey: 'showWorkshops' },
      { label: 'Complete Growth Marketing', to: '/programs/complete-growth-marketing' },
    ],
  },
  {
    title: 'Courses',
    menuKey: 'showCourses',
    termsFrom: 'topic',
    links: [{ label: 'Marketing', to: '/courses/category' }],
  },
  {
    title: 'Resources',
    links: whenResourcesReady([
      { label: 'Blog', to: '/blog', menuKey: 'showBlog' },
      { label: 'Playbooks', to: '/resources/playbooks' },
      { label: 'Claude Skills', to: '/resources/claude-skills' },
      // The redesign leaves these two as "#". A dead anchor reads as a broken
      // site to a visitor and to a payment-gateway reviewer, so they point at
      // the pages that actually hold the content the labels promise.
      { label: 'Free Resources', to: '/courses?price=free' },
      { label: 'Success Stories', to: '/#community' },
      { label: 'Workshops', to: '/workshops', menuKey: 'showWorkshops' },
    ]),
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', to: '/about' },
      { label: 'Contact Us', to: '/contact' },
      { label: 'Refund Policy', to: '/refund' },
      { label: 'Delivery Policy', to: '/delivery' },
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Use', to: '/terms' },
    ],
  },
]

/**
 * `href: null` until the owner supplies the real profile URLs — the footer then
 * renders a plain badge instead of a link. Never point these at "#": a dead
 * anchor looks like a broken site to a visitor and to a payment-gateway review.
 */
export const socialLinks = [
  { label: 'in', aria: 'LinkedIn', href: null },
  { label: 'ig', aria: 'Instagram', href: null },
  { label: 'fb', aria: 'Facebook', href: null },
  { label: 'yt', aria: 'YouTube', href: null },
]

/* -------------------------------- student -------------------------------- */
export const studentNav = [
  { icon: '🏠', label: 'Home', to: '/student', end: true },
  { icon: '📚', label: 'My Learning', to: '/student/courses', count: 6 },
  { icon: '🔴', label: 'Live & Workshops', to: '/student/live', count: 2 },
  { icon: '🎯', label: 'Practice', to: '/student/practice', count: 4 },
  { icon: '🎓', label: 'Certificates', to: '/student/certificates' },
  // Seeds, streak, badges and rank — every tile on the page is gamification,
  // so the whole entry travels with the flag. See SiteConfigContext.
  { icon: '🌱', label: 'Achievements', to: '/student/achievements', feature: 'gamification' },
  { icon: '👤', label: 'Profile', to: '/student/profile' },
  { icon: '💬', label: 'Community', to: '/community', count: 3 },
  { icon: '🔍', label: 'Explore catalog', to: '/courses/category' },
]

export const studentTopNav = [
  { label: 'Explore', to: '/courses/category' },
  { label: 'Community', to: '/community' },
  { label: 'Creator', to: '/admin' },
]

/* ------------------------------- community ------------------------------- */
export const communityNav = [
  { label: 'My Learning', to: '/student' },
  { label: 'Community', to: '/community' },
  { label: 'Workshops', to: '/community/workshops' },
  { label: 'Courses', to: '/courses' },
  { label: 'Creator', to: '/admin' },
  { label: 'Level Up', to: '#' },
]

/* --------------------------------- admin --------------------------------- */
/**
 * `feature: '…'` marks an entry as belonging to a flagged module: it renders
 * only while GET /api/config reports that flag on. Filter with visibleNav()
 * from context/SiteConfigContext.jsx — never read these arrays raw in a layout.
 */
export const adminNav = [
  { label: 'Dashboard', to: '/admin', end: true },
  { label: 'Courses', to: '/admin/courses' },
  { label: 'Programs', to: '/admin/programs' },
  { label: 'Workshops', to: '/admin/workshops' },
  { label: 'Blog', to: '/admin/blog' },
  { label: 'Marketing Funnels', to: '/admin/funnels', feature: 'funnels' },
  { label: 'Email', to: '/admin/email/broadcasts', feature: 'email' },
  { label: 'Communities', to: '/admin/community' },
  { label: 'Gamification', to: '/admin/gamification/points', feature: 'gamification' },
  { label: 'Resources', to: '/admin/resources' },
  { label: 'Applications', to: '/admin/applications' },
  { label: 'Fit calls', to: '/admin/fit-calls' },
  { label: 'Leads', to: '/admin/leads' },
  { label: 'Customers', to: '/admin/customers' },
  { label: 'Users', to: '/admin/users' },
  { label: 'Sales', to: '/admin/transactions' },
  { label: 'Taxonomy', to: '/admin/taxonomy' },
  { label: 'Site', to: '/admin/settings' },
  { label: 'Integrations', to: '/admin/integrations' },
  { label: 'Live', to: '/admin/live/calendar', dot: true },
]

export const courseTabs = (id) => [
  { label: 'Information', to: `/admin/courses/${id}/information` },
  { label: 'Curriculum', to: `/admin/courses/${id}/curriculum` },
  { label: 'Pages', to: `/admin/courses/${id}/pages` },
  { label: 'Pricing', to: `/admin/courses/${id}/pricing` },
  { label: 'Drip', to: `/admin/courses/${id}/drip` },
  { label: 'Automation', to: `/admin/courses/${id}/automation` },
  { label: 'Students', to: `/admin/courses/${id}/students` },
]

export const funnelTabs = (id) => [
  { label: 'Overview', to: `/admin/funnels/${id}/overview` },
  { label: 'Funnel Details', to: `/admin/funnels/${id}/details` },
  { label: 'Funnel Steps', to: `/admin/funnels/${id}/steps` },
  { label: 'Leads', to: `/admin/funnels/${id}/leads` },
  { label: 'Automation', to: `/admin/funnels/${id}/automation` },
]

export const liveSideNav = [
  { label: 'Calendar', to: '/admin/live/calendar' },
  { label: '1-1 Bookings', to: '/admin/live/bookings' },
  { label: 'Live Class', to: '/admin/live/class' },
  { label: 'Live Stream', to: '/admin/live/stream' },
]

export const emailSideNav = [
  { label: 'All Broadcasts', to: '/admin/email/broadcasts' },
  { label: 'Email Lists', to: '/admin/email/lists' },
  { label: 'All Contacts', to: '/admin/email/contacts' },
]

export const funnelsSideNav = [
  { label: 'All Funnels', to: '/admin/funnels' },
  { label: 'Leads', to: '/admin/funnels/leads' },
]

export const gamificationSideNav = [
  { label: 'Points', to: '/admin/gamification/points' },
  { label: 'Badges', to: '/admin/gamification/badges' },
  { label: 'Leaderboard', to: '/admin/gamification/leaderboard' },
  { label: 'Settings', to: '/admin/gamification/settings' },
]

/* --------------------------- catalog filter data -------------------------- */
/**
 * The facets that are not taxonomy terms.
 *
 * Topic, category, tag and language used to be hardcoded here too; they now
 * come from the Term registry via GET /api/config, so an operator can rename,
 * reorder or hide one without a deploy. See hooks/useFilterGroups.js, which
 * assembles these with the taxonomy-backed groups into the sidebar.
 *
 * What is left is a schema enum (price, course type) or a computed range
 * (rating, duration) rather than a term. Making those configurable is TAX-6.
 */
export const staticFilterGroups = [
  {
    key: 'rating',
    label: 'Rating',
    single: true,
    options: [
      { value: '4.5', label: '4.5 & up' },
      { value: '4.0', label: '4.0 & up' },
      { value: '3.5', label: '3.5 & up' },
    ],
  },
  {
    key: 'price',
    label: 'Price',
    options: [
      { value: 'paid', label: 'Paid' },
      { value: 'free', label: 'Free' },
    ],
  },
  {
    key: 'duration',
    label: 'Duration',
    options: [
      { value: 'short', label: '0–5 Hrs' },
      { value: 'mid', label: '5–12 Hrs' },
      { value: 'long', label: '12+ Hrs' },
    ],
  },
  {
    key: 'type',
    label: 'Course Type',
    options: [
      { value: 'self', label: 'Self-Paced' },
      { value: 'combo', label: 'Combo' },
      { value: 'starter', label: 'Free Starter' },
    ],
  },
]

export const sortLabels = {
  popularity: 'Popularity',
  newest: 'Newest',
  rating: 'Highest rated',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
}
