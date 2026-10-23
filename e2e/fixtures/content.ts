import { test as base, type APIRequestContext } from '@playwright/test'
import { targetUrl } from './target'

/**
 * Slug discovery. Specs never hardcode a slug: production content changes, and a
 * suite pinned to "seo-mastery" would fail the day that course is renamed.
 *
 * Each slug comes from the public API (the first item of the same listing a
 * visitor sees), unless an environment variable names one:
 *
 *   E2E_COURSE_SLUG    E2E_WORKSHOP_SLUG    E2E_BLOG_SLUG
 *
 * Discovery is read-only GETs on public endpoints.
 */

export type Course = {
  slug: string
  title: string
  /** 'paid' or 'free', as the API reports it. */
  price: string
  amount: number
}
export type Discovered = {
  course: Course
  workshopSlug: string
  blogSlug: string
}

class MissingContentError extends Error {
  constructor(kind: 'course' | 'workshop' | 'blog post', detail: string, envName: string) {
    super(
      `No ${kind} found for the smoke suite: ${detail}. ` +
        `Publish at least one ${kind} (local mode seeds the test project for you) ` +
        `or set ${envName}=<slug> to name one explicitly.`,
    )
    this.name = 'MissingContentError'
  }
}

async function getJson(api: APIRequestContext, path: string): Promise<unknown> {
  const res = await api.get(path)
  if (!res.ok()) throw new Error(`GET ${path} answered ${res.status()} during slug discovery`)
  return res.json()
}

const firstSlug = (body: unknown): string | undefined => {
  const items = (body as { items?: { slug?: unknown }[] } | null)?.items
  const slug = items?.[0]?.slug
  return typeof slug === 'string' && slug ? slug : undefined
}

async function discoverCourse(api: APIRequestContext): Promise<Course> {
  let slug = process.env.E2E_COURSE_SLUG?.trim()
  if (!slug) {
    // price=paid: the enrol spec needs a course whose Enrol button goes to
    // checkout. (The API's default listing is paid-only as well; asking for it
    // explicitly keeps that true if the default ever changes.)
    slug = firstSlug(await getJson(api, '/api/courses?price=paid'))
    if (!slug) {
      throw new MissingContentError(
        'course',
        'GET /api/courses?price=paid returned no items',
        'E2E_COURSE_SLUG',
      )
    }
  }
  const body = (await getJson(api, `/api/courses/${encodeURIComponent(slug)}`)) as Partial<Course>
  return {
    slug,
    title: String(body.title ?? slug),
    price: String(body.price ?? ''),
    amount: Number(body.amount ?? 0),
  }
}

async function discoverSlug(
  api: APIRequestContext,
  kind: 'workshop' | 'blog post',
  listing: string,
  envName: string,
): Promise<string> {
  const override = process.env[envName]?.trim()
  if (override) return override
  const slug = firstSlug(await getJson(api, listing))
  if (!slug) throw new MissingContentError(kind, `GET ${listing} returned no items`, envName)
  return slug
}

export const test = base.extend<object, { discovered: Discovered }>({
  discovered: [
    async ({ playwright }, use) => {
      const api = await playwright.request.newContext({ baseURL: targetUrl() })
      try {
        const course = await discoverCourse(api)
        const workshopSlug = await discoverSlug(
          api,
          'workshop',
          '/api/workshops',
          'E2E_WORKSHOP_SLUG',
        )
        const blogSlug = await discoverSlug(api, 'blog post', '/api/blog', 'E2E_BLOG_SLUG')
        await use({ course, workshopSlug, blogSlug })
      } finally {
        await api.dispose()
      }
    },
    { scope: 'worker' },
  ],
})

export { expect } from '@playwright/test'
