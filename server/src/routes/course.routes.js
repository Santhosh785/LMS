import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import {
  and,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { db, withMongoId } from '../db/index.js'
import { courses } from '../db/schema/index.js'
import { findCourse } from '../db/repos/courses.js'
import { stripVideoRefs } from '../services/bunny.js'

const router = Router()

const list = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const SORTS = {
  popularity: [desc(courses.popularity)],
  newest: [desc(courses.newestRank)],
  rating: [desc(courses.rating)],
  'price-asc': [asc(courses.amount)],
  'price-desc': [desc(courses.amount)],
}

const visible = and(eq(courses.status, 'Published'), eq(courses.visibility, 'Public'))

/**
 * Mirrors the original js/explore.js filtering exactly, including its quirk
 * that "paid" is pre-selected when the URL carries no facet at all. Returns a
 * SQL condition.
 */
export function buildCourseQuery(params) {
  const { price, type, topic, lang, rating, duration, q, category, tag } = params
  /**
   * Draft and Hidden courses never reach the public catalogue. Task 13 moves any
   * course whose lessons have no video attached to Draft — a catalogue where
   * some courses cannot be watched after payment is worse than a smaller one,
   * and until this filter existed the status field was decorative.
   */
  const clauses = [visible]
  // `category` and `tag` count as facets too, or arriving at /courses?tag=x
  // would silently add the legacy "paid only" default on top of the tag.
  const hasFacet = Boolean(price || type || topic || lang || category || tag)

  const prices = list(price)
  if (prices.length) clauses.push(inArray(courses.price, prices))
  else if (!hasFacet) clauses.push(eq(courses.price, 'paid'))

  const types = list(type)
  if (types.length) clauses.push(inArray(courses.type, types))

  const topics = list(topic)
  if (topics.length) clauses.push(inArray(courses.topic, topics))

  // Array columns match when they share any value — Mongo's `{ $in }` on an array.
  const langs = list(lang)
  if (langs.length) clauses.push(arrayOverlaps(courses.languages, langs))

  const categories = list(category)
  if (categories.length) clauses.push(arrayOverlaps(courses.categories, categories))

  const tags = list(tag)
  if (tags.length) clauses.push(arrayOverlaps(courses.tags, tags))

  const ratings = list(rating)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  if (ratings.length) clauses.push(gte(courses.rating, Math.max(...ratings)))

  const durations = list(duration)
  if (durations.length) {
    const ranges = durations
      .map((d) => {
        if (d === 'short') return lte(courses.hours, 5)
        if (d === 'mid') return and(gt(courses.hours, 5), lte(courses.hours, 12))
        if (d === 'long') return gt(courses.hours, 12)
        return null
      })
      .filter(Boolean)
    if (ranges.length) clauses.push(or(...ranges))
  }

  if (q && q.trim()) {
    // the old client searched title + topic + languages as one string
    const pattern = `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    clauses.push(
      or(
        ilike(courses.title, pattern),
        ilike(courses.topic, pattern),
        sql`array_to_string(${courses.languages}, ' ') ilike ${pattern}`,
      ),
    )
  }

  return and(...clauses)
}

/** Catalogue cards: everything except the heavy page-only copy and rules. */
const {
  overview: _o,
  journey: _j,
  faqs: _f,
  whoShouldEnroll: _w,
  dripSchedule: _d,
  automationRules: _a,
  ...cardColumns
} = getTableColumns(courses)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = buildCourseQuery(req.query)
    const sort = SORTS[req.query.sort] || SORTS.popularity
    const limit = Math.min(Number(req.query.limit) || 9, 100)
    const skip = Number(req.query.skip) || 0

    const [items, [{ total }]] = await Promise.all([
      db
        .select(cardColumns)
        .from(courses)
        .where(where)
        .orderBy(...sort, asc(courses.id))
        .limit(limit)
        .offset(skip),
      db.select({ total: count() }).from(courses).where(where),
    ])

    res.json({ items: withMongoId(items), total })
  }),
)

/** Distinct facet values so the filter sidebar can render from real data. */
router.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    const [topicRows, languageRows] = await Promise.all([
      db.selectDistinct({ v: courses.topic }).from(courses).where(visible),
      db
        .selectDistinct({ v: sql`unnest(${courses.languages})` })
        .from(courses)
        .where(visible),
    ])
    const values = (rows) =>
      rows
        .map((r) => r.v)
        .filter(Boolean)
        .sort()
    res.json({ topics: values(topicRows), languages: values(languageRows) })
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    // Same visibility rule as the catalogue — otherwise a Draft course stays
    // fully reachable, and buyable, to anyone holding its slug. Students already
    // enrolled in a drafted course keep access through /api/enrollments, which
    // is a different route with a different check.
    const course = await findCourse(
      and(eq(courses.slug, String(req.params.slug).toLowerCase()), visible),
    )
    if (!course) throw new HttpError(404, 'Course not found')
    // Public route: the curriculum is a selling point, the video ids are not.
    res.json(stripVideoRefs(course))
  }),
)

export default router
