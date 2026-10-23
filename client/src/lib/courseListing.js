import { sortLabels } from '../data/nav.js'

/**
 * The catalogue pages' URL contract, read in one place.
 *
 * `/courses` and `/courses/category` are server-rendered from their loaders,
 * and the loader and the hydrated component must agree on what is selected or
 * React finds different checkboxes, chips and counts in the two renders. Both
 * derive that state from the functions here and nowhere else; the only other
 * copy of the "Paid by default" rule is the SQL in server/src/db/repos/courses.js
 * (`buildCourseQuery`), which these mirror.
 *
 * Plain functions of a URLSearchParams — no window, no storage, no user — so
 * they give the same answer on the server and in the browser.
 */

/** "View more" step and the default page size of /courses. */
export const PAGE_SIZE = 9

/** The server's cap on `limit` (listPublic). */
export const MAX_LIMIT = 100

/** /courses/category lists up to this many courses. */
export const CATEGORY_PAGE_SIZE = 50

/**
 * Params that count as a facet. Their absence is what pre-selects "Paid";
 * `rating`, `duration`, `sort` and `q` alone do not count.
 */
export const FACET_KEYS = ['price', 'type', 'topic', 'lang', 'category', 'tag']

/** Every filter group's param, in sidebar order. */
export const FILTER_KEYS = [
  'topic',
  'category',
  'tag',
  'lang',
  'rating',
  'price',
  'duration',
  'type',
]

export const DEFAULT_SORT = 'popularity'

/** A comma-list param as an array of trimmed, non-empty values. */
export const readList = (params, key) =>
  (params.get(key) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/** The sort key, falling back to popularity for a missing or unknown one. */
export const resolveSort = (params) => {
  const value = params.get('sort')
  return value && Object.prototype.hasOwnProperty.call(sortLabels, value) ? value : DEFAULT_SORT
}

/** Same test as the server's `hasFacet`: any facet param with a value. */
export const hasFacet = (params) => FACET_KEYS.some((key) => Boolean(params.get(key)))

/** A positive integer param, or `fallback`. */
function intParam(params, key, fallback, { min, max }) {
  const n = Math.floor(Number(params.get(key)))
  if (!Number.isFinite(n) || n < min) return fallback
  return Math.min(n, max)
}

/**
 * The selected value of every filter group — with "Paid" pre-selected when the
 * URL carries no facet, exactly as the listing query applies it.
 */
export function selectedFilters(params, keys = FILTER_KEYS) {
  const map = Object.fromEntries(keys.map((key) => [key, readList(params, key)]))
  if (keys.includes('price') && !hasFacet(params) && !map.price.length) map.price = ['paid']
  return map
}

/** Non-empty selections as the comma-joined params the listing takes. */
export const selectionParams = (selected) =>
  Object.fromEntries(
    Object.entries(selected)
      .filter(([, values]) => values.length)
      .map(([key, values]) => [key, values.join(',')]),
  )

/**
 * /courses: what is selected, the sort, the search text and the slice. The
 * loader returns this and the page renders from it.
 */
export function exploreState(params) {
  return {
    selected: selectedFilters(params),
    sort: resolveSort(params),
    q: (params.get('q') || '').trim(),
    limit: intParam(params, 'limit', PAGE_SIZE, { min: 1, max: MAX_LIMIT }),
    skip: intParam(params, 'skip', 0, { min: 0, max: Number.MAX_SAFE_INTEGER }),
  }
}

/** The `listPublic` params for an exploreState — the same values GET /api/courses gets. */
export function exploreListingParams(state) {
  return {
    ...selectionParams(state.selected),
    sort: state.sort,
    ...(state.q ? { q: state.q } : {}),
    limit: state.limit,
    offset: state.skip,
  }
}

/**
 * Whether a /courses URL is a filtered or paged variant (noindex): any filter,
 * a search, a non-default sort, or an explicit slice.
 */
export function isFilteredExplore(params) {
  return (
    FILTER_KEYS.some((key) => Boolean(params.get(key))) ||
    Boolean((params.get('q') || '').trim()) ||
    (params.has('sort') && params.get('sort') !== DEFAULT_SORT) ||
    params.has('limit') ||
    params.has('skip')
  )
}

/**
 * The search string for a /courses selection. Filters, sort and `q` only:
 * every change to them drops `limit`/`skip`, so the visible count resets to a
 * first page.
 */
export function exploreSearch(selected, q, sort) {
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const values = selected[key] || []
    if (values.length) params.set(key, values.join(','))
  }
  params.set('sort', sort || DEFAULT_SORT)
  if (q && q.trim()) params.set('q', q.trim())
  return params
}

/** The category page's groups: everything but topic, which the rail owns. */
export const CATEGORY_FILTER_KEYS = FILTER_KEYS.filter((key) => key !== 'topic')

/**
 * /courses/category: the topic, the other groups' selections (no Paid default
 * here — without a topic the page lists paid and free alike) and the sort.
 */
export function categoryState(params) {
  return {
    topic: (params.get('topic') || '').trim(),
    selected: Object.fromEntries(CATEGORY_FILTER_KEYS.map((key) => [key, readList(params, key)])),
    sort: resolveSort(params),
  }
}

/** The `listPublic` params for a categoryState. */
export function categoryListingParams(state) {
  return {
    ...(state.topic ? { topic: state.topic } : { price: 'paid,free' }),
    ...selectionParams(state.selected),
    sort: state.sort,
    limit: CATEGORY_PAGE_SIZE,
  }
}
