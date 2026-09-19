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
export const primaryNav = [
  {
    label: 'LIVE Classes',
    menu: [
      { label: 'Yoda Class', to: '/programs/complete-growth-marketing', live: true },
      { label: 'Complete Growth Marketing', to: '/programs/complete-growth-marketing' },
    ],
  },
  { label: 'Workshops', to: '/workshops', menuKey: 'showWorkshops' },
  {
    label: 'Courses',
    menuKey: 'showCourses',
    // The nine topic links that used to be hardcoded here now come from the
    // course topics an operator has flagged "show in menu".
    termsFrom: 'topic',
    menu: [{ label: 'Marketing', to: '/courses/category' }],
  },
  {
    label: 'Practice',
    menuKey: 'showPractice',
    menu: [
      { label: 'Practice Hub', to: '/community' },
      { label: 'Campaign Challenges', to: '/community/challenge-submission' },
      { label: 'Interview Prep', to: '/community' },
    ],
  },
  {
    label: 'Resources',
    menu: [
      { label: 'Our Story', to: '/#story' },
      { label: 'Blog', to: '/blog', menuKey: 'showBlog' },
      { label: 'FAQs', to: '#' },
      { label: 'Free Resources', to: '#' },
    ],
  },
]

export const mobileNav = [
  { label: 'Workshops', to: '/workshops', menuKey: 'showWorkshops' },
  { label: 'LIVE Classes', to: '/programs/complete-growth-marketing' },
  { label: 'Courses', to: '/courses/category', menuKey: 'showCourses' },
  { label: 'Practice', to: '/community', menuKey: 'showPractice' },
  { label: 'Resources', to: '/blog', menuKey: 'showBlog' },
]

export const footerColumns = [
  {
    title: 'LIVE Programs',
    links: [
      { label: 'Workshops', to: '/workshops' },
      { label: 'Complete Growth Marketing', to: '/programs/complete-growth-marketing' },
      { label: 'Yoda Class', to: '/programs/complete-growth-marketing' },
    ],
  },
  {
    title: 'Courses',
    menuKey: 'showCourses',
    // Generated from the topics flagged "show in menu" — these were nine
    // hardcoded links that a renamed topic would have left pointing at a facet
    // no course carries any more.
    termsFrom: 'topic',
    links: [{ label: 'Marketing', to: '/courses/category' }],
  },
  {
    title: 'Practice & Community',
    links: [
      { label: 'Practice Hub', to: '/community' },
      { label: 'Campaign Challenges', to: '/community/challenge-submission' },
      { label: 'VIP Community', to: '/community' },
      { label: 'WhatsApp Channel', to: '/community' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Our Story', to: '/#story' },
      { label: 'Blog', to: '/blog' },
      { label: 'Free Resources', to: '#' },
      { label: 'Success Stories', to: '#' },
      { label: 'FAQs', to: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', to: '/#story' },
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
