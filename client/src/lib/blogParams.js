/**
 * The /blog URL's search params, read the same way by the loader and the page.
 */

export const BLOG_PAGE_SIZE = 12

/** The catch-all tab of the category rail; it is the absence of `?category=`. */
export const ALL_POSTS = 'Latest Articles'

/** `?category=` → the category name, or '' for "Latest Articles". */
export const blogCategory = (value) => {
  const name = (value || '').trim()
  return name === ALL_POSTS || name === 'latest' ? '' : name
}

/** `?page=` → a page number ≥ 1; anything malformed is page 1. */
export const blogPage = (value) => {
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}
