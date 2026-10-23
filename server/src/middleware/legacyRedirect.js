import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { blogPosts, courses } from '../db/schema/index.js'

/**
 * 301s bookmarked Mongo-era URLs to their Postgres ids.
 *
 * Public pages address content by slug and were unaffected by the migration;
 * the URLs that embedded an ObjectId are the admin editors — a course editor tab
 * or a blog post open in the editor, bookmarked or linked from an email. The ETL
 * keeps every old ObjectId in `legacy_id`, so the id can be translated instead
 * of the page 404ing. Any trailing path (the editor tab) and the query string
 * are preserved.
 *
 * The old static site's .html URLs (LEGACY_HTML_REDIRECTS) are 301ed to their
 * new routes with the query string preserved, so crawlers and bookmarks follow
 * them. They match on the exact path and are checked before the ObjectId rules.
 *
 * Only GET/HEAD requests are touched, and only for those exact .html paths or an
 * id segment that is a 24-hex ObjectId; everything else passes straight through.
 * Worth keeping for a few months after cutover.
 */
export const LEGACY_HTML_REDIRECTS = new Map([
  ['/index.html', '/'],
  ['/courses/index.html', '/courses'],
  ['/courses/marketing.html', '/courses/category'],
  ['/courses/seo.html', '/courses/seo-mastery'],
  ['/programs/complete-growth-marketing.html', '/programs/complete-growth-marketing'],
  ['/workshops/index.html', '/workshops'],
  ['/workshops/seo-mastery.html', '/workshops/seo-mastery-live-tamil'],
  ['/blog/index.html', '/blog'],
  ['/blog/seo-vs-sem.html', '/blog/seo-vs-sem'],
  ['/community/index.html', '/community'],
  ['/community/channel.html', '/community/announcements'],
  ['/community/workshops.html', '/community/workshops'],
  ['/student/index.html', '/student'],
  ['/student/courses.html', '/student/courses'],
  ['/student/course.html', '/student/courses/seo-mastery'],
  ['/student/live.html', '/student/live'],
  ['/student/practice.html', '/student/practice'],
  ['/student/certificates.html', '/student/certificates'],
  ['/student/achievements.html', '/student/achievements'],
  ['/student/profile.html', '/student/profile'],
  ['/admin/index.html', '/admin'],
  ['/admin/courses.html', '/admin/courses'],
  ['/admin/customers.html', '/admin/customers'],
  ['/admin/transactions.html', '/admin/transactions'],
  ['/admin/email.html', '/admin/email/broadcasts'],
  ['/admin/email-lists.html', '/admin/email/lists'],
  ['/admin/email-contacts.html', '/admin/email/contacts'],
  ['/admin/email-broadcast-create.html', '/admin/email/broadcasts/create'],
  ['/admin/funnels.html', '/admin/funnels'],
  ['/admin/funnel-create.html', '/admin/funnels/create'],
  ['/admin/funnel-leads.html', '/admin/funnels/leads'],
  ['/admin/community.html', '/admin/community'],
  ['/admin/settings.html', '/admin/settings'],
  ['/admin/live.html', '/admin/live/calendar'],
  ['/admin/live-bookings.html', '/admin/live/bookings'],
  ['/admin/live-booking-create.html', '/admin/live/bookings/create'],
  ['/admin/live-create.html', '/admin/live/create'],
  ['/admin/live-class.html', '/admin/live/class'],
  ['/admin/live-stream.html', '/admin/live/stream'],
  ['/admin/gamification-points.html', '/admin/gamification/points'],
  ['/admin/gamification-badges.html', '/admin/gamification/badges'],
  ['/admin/gamification-leaderboard.html', '/admin/gamification/leaderboard'],
  ['/admin/gamification-settings.html', '/admin/gamification/settings'],
])
const OBJECT_ID = '([a-f0-9]{24})'
const RULES = [
  {
    pattern: new RegExp(`^/admin/courses/${OBJECT_ID}(/.*)?$`),
    table: courses,
    base: '/admin/courses/',
  },
  {
    pattern: new RegExp(`^/admin/blog/post/${OBJECT_ID}(/.*)?$`),
    table: blogPosts,
    base: '/admin/blog/post/',
  },
]

/** The original query string including the leading '?', or ''. */
const queryOf = (req) =>
  req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''

export async function legacyRedirect(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  const htmlTarget = LEGACY_HTML_REDIRECTS.get(req.path)
  if (htmlTarget) return res.redirect(301, htmlTarget + queryOf(req))
  for (const { pattern, table, base } of RULES) {
    const match = pattern.exec(req.path)
    if (!match) continue
    try {
      const [row] = await db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.legacyId, match[1]))
      if (!row) return next()
      return res.redirect(301, `${base}${row.id}${match[2] || ''}${queryOf(req)}`)
    } catch (err) {
      return next(err)
    }
  }
  next()
}
