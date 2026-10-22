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
 * Only GETs whose id segment is a 24-hex ObjectId are touched; everything else
 * passes straight through. Worth keeping for a few months after cutover.
 */
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

export async function legacyRedirect(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  for (const { pattern, table, base } of RULES) {
    const match = pattern.exec(req.path)
    if (!match) continue
    try {
      const [row] = await db
        .select({ id: table.id })
        .from(table)
        .where(eq(table.legacyId, match[1]))
      if (!row) return next()
      const query = req.originalUrl.includes('?')
        ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
        : ''
      return res.redirect(301, `${base}${row.id}${match[2] || ''}${query}`)
    } catch (err) {
      return next(err)
    }
  }
  next()
}
