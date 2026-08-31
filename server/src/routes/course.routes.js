import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import Course from '../models/Course.js'
import { stripVideoRefs } from '../services/bunny.js'

const router = Router()

const list = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const SORTS = {
  popularity: { popularity: -1 },
  newest: { newestRank: -1 },
  rating: { rating: -1 },
  'price-asc': { amount: 1 },
  'price-desc': { amount: -1 },
}

/**
 * Mirrors the original js/explore.js filtering exactly, including its quirk
 * that "paid" is pre-selected when the URL carries no facet at all.
 */
export function buildCourseQuery(params) {
  const { price, type, topic, lang, rating, duration, q, category, tag } = params
  /**
   * Draft and Hidden courses never reach the public catalogue. Task 13 moves any
   * course whose lessons have no video attached to Draft — a catalogue where
   * some courses cannot be watched after payment is worse than a smaller one,
   * and until this filter existed the status field was decorative.
   */
  const filter = { status: 'Published', visibility: 'Public' }
  // `category` and `tag` count as facets too, or arriving at /courses?tag=x
  // would silently add the legacy "paid only" default on top of the tag.
  const hasFacet = Boolean(price || type || topic || lang || category || tag)

  const prices = list(price)
  if (prices.length) filter.price = { $in: prices }
  else if (!hasFacet) filter.price = 'paid'

  const types = list(type)
  if (types.length) filter.type = { $in: types }

  const topics = list(topic)
  if (topics.length) filter.topic = { $in: topics }

  const langs = list(lang)
  if (langs.length) filter.languages = { $in: langs }

  const categories = list(category)
  if (categories.length) filter.categories = { $in: categories }

  const tags = list(tag)
  if (tags.length) filter.tags = { $in: tags }

  const ratings = list(rating)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  if (ratings.length) filter.rating = { $gte: Math.max(...ratings) }

  const durations = list(duration)
  if (durations.length) {
    const ranges = durations
      .map((d) => {
        if (d === 'short') return { hours: { $lte: 5 } }
        if (d === 'mid') return { hours: { $gt: 5, $lte: 12 } }
        if (d === 'long') return { hours: { $gt: 12 } }
        return null
      })
      .filter(Boolean)
    if (ranges.length) filter.$or = ranges
  }

  if (q && q.trim()) {
    // the old client searched title + topic + languages as one string
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const search = [{ title: rx }, { topic: rx }, { languages: rx }]
    filter.$and = [...(filter.$and || []), { $or: search }]
  }

  return filter
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = buildCourseQuery(req.query)
    const sort = SORTS[req.query.sort] || SORTS.popularity
    const limit = Math.min(Number(req.query.limit) || 9, 100)
    const skip = Number(req.query.skip) || 0

    const projection =
      '-sections -overview -journey -faqs -whoShouldEnroll -pricingPlans -dripSchedule -automationRules'

    const [items, total] = await Promise.all([
      Course.find(filter).select(projection).sort(sort).skip(skip).limit(limit).lean(),
      Course.countDocuments(filter),
    ])

    res.json({ items, total })
  }),
)

/** Distinct facet values so the filter sidebar can render from real data. */
router.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    const visible = { status: 'Published', visibility: 'Public' }
    const [topics, languages] = await Promise.all([
      Course.distinct('topic', visible),
      Course.distinct('languages', visible),
    ])
    res.json({ topics: topics.filter(Boolean).sort(), languages: languages.filter(Boolean).sort() })
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    // Same visibility rule as the catalogue — otherwise a Draft course stays
    // fully reachable, and buyable, to anyone holding its slug. Students already
    // enrolled in a drafted course keep access through /api/enrollments, which
    // is a different route with a different check.
    const course = await Course.findOne({
      slug: req.params.slug,
      status: 'Published',
      visibility: 'Public',
    }).lean()
    if (!course) throw new HttpError(404, 'Course not found')
    // Public route: the curriculum is a selling point, the video ids are not.
    res.json(stripVideoRefs(course))
  }),
)

export default router
