import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blogPosts, programs, terms, workshops } from '../src/db/schema/index.js'
import { createCourse } from '../src/db/repos/courses.js'
import { env } from '../src/config/env.js'
import { contentChanged, purgeTargetsFor } from '../src/services/contentEvents.js'
import { getSitemap, invalidateSitemap } from '../src/services/sitemap.js'
import { regenerateSitemap, SITEMAP_CRON } from '../src/jobs/sitemap.js'
import { createCloudflarePurge, PURGE_BATCH_SIZE } from '../src/jobs/cloudflare.js'
import { insertRow } from './helpers/content.js'
import { agent, paidCourse, signUpAdmin } from './helpers/factories.js'

/**
 * Content-change events (task 11): every admin write that changes a public page
 * queues `regenerate-sitemap` and `purge-cloudflare-cache`.
 *
 * The queue is never started under test, so `enqueue` runs each handler inline
 * — in the background, through dispatch. `enqueue` is wrapped by a spy so a test
 * can see what was queued with which payload, await the handlers, or make the
 * enqueue fail. CF_ZONE_ID / CF_API_TOKEN are blank (tests/setup.js), so the
 * real purge handler is a no-op; its network behaviour is tested through
 * `createCloudflarePurge` with a fake `fetch`.
 */
const { enqueueSpy, scheduleSpy, real } = vi.hoisted(() => ({
  enqueueSpy: vi.fn(),
  scheduleSpy: vi.fn(),
  real: {},
}))

vi.mock('../src/services/queue.js', async (importOriginal) => {
  const actual = await importOriginal()
  real.enqueue = actual.enqueue
  scheduleSpy.mockImplementation((...args) => actual.schedule(...args))
  return { ...actual, enqueue: enqueueSpy, schedule: scheduleSpy }
})

/** Back to wrapping the real enqueue, with the call log cleared. */
const restoreEnqueue = () => {
  enqueueSpy.mockReset()
  enqueueSpy.mockImplementation((...args) => real.enqueue(...args))
}

const settle = () => Promise.allSettled(enqueueSpy.mock.results.map((r) => r.value))
const enqueuesOf = (name) => enqueueSpy.mock.calls.filter(([n]) => n === name)

/** The purge payloads queued so far, URL lists sorted for comparison. */
const purges = () =>
  enqueuesOf('purge-cloudflare-cache').map(([, data]) =>
    data.urls ? { urls: [...data.urls].sort() } : data,
  )

const urlsFor = {
  course: (slug) => ['/', '/courses', `/courses/${slug}`, '/sitemap.xml'],
  program: (slug) => ['/', `/programs/${slug}`, '/sitemap.xml'],
  workshop: (slug) => ['/', '/workshops', `/workshops/${slug}`, '/sitemap.xml'],
  post: (slug) => ['/', '/blog', `/blog/${slug}`, '/sitemap.xml'],
}
const sorted = (list) => [...new Set(list)].sort()

/** Exactly one of each job, the purge carrying `expected`. */
function expectEvent(expected) {
  expect(enqueuesOf('regenerate-sitemap')).toHaveLength(1)
  expect(enqueuesOf('regenerate-sitemap')[0][1]).toEqual({})
  expect(purges()).toEqual([expected.urls ? { urls: sorted(expected.urls) } : expected])
}

const expectNoEvent = () => {
  expect(enqueuesOf('regenerate-sitemap')).toHaveLength(0)
  expect(enqueuesOf('purge-cloudflare-cache')).toHaveLength(0)
}

async function adminAgent() {
  const { cookie } = await signUpAdmin()
  return (method, url) => agent()[method](url).set('Cookie', cookie)
}

let as
beforeEach(async () => {
  restoreEnqueue()
  as = await adminAgent()
  // Only what the request under test queues.
  enqueueSpy.mockClear()
})

/* -------------------------------- the service ------------------------------- */

describe('contentChanged', () => {
  it('maps each kind to the URL set it purges', () => {
    expect(purgeTargetsFor('course', 'seo')).toEqual({
      urls: ['/', '/courses', '/courses/seo', '/sitemap.xml'],
    })
    expect(purgeTargetsFor('program', 'flagship')).toEqual({
      urls: ['/', '/programs/flagship', '/sitemap.xml'],
    })
    expect(purgeTargetsFor('workshop', 'ai-day')).toEqual({
      urls: ['/', '/workshops', '/workshops/ai-day', '/sitemap.xml'],
    })
    expect(purgeTargetsFor('post', 'loops')).toEqual({
      urls: ['/', '/blog', '/blog/loops', '/sitemap.xml'],
    })
    expect(purgeTargetsFor('settings')).toEqual({ everything: true })
    expect(purgeTargetsFor('taxonomy')).toEqual({ everything: true })
  })

  it('merges several slugs into one URL set', () => {
    expect(purgeTargetsFor('course', ['new-name', 'old-name'])).toEqual({
      urls: ['/', '/courses', '/courses/new-name', '/courses/old-name', '/sitemap.xml'],
    })
  })

  it('throws on an unknown kind, and on a slugged kind with no slug', () => {
    expect(() => contentChanged({ kind: 'page', slug: 'x' })).toThrow(/unknown kind/)
    expect(() => contentChanged({})).toThrow(/unknown kind/)
    expect(() => contentChanged({ kind: 'course' })).toThrow(/slug is required/)
    expect(() => contentChanged({ kind: 'post', slug: '  ' })).toThrow(/slug is required/)
    expectNoEvent()
  })

  it('queues both jobs, and never rejects when an enqueue fails', async () => {
    enqueueSpy.mockRejectedValueOnce(new Error('pgboss unreachable'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(contentChanged({ kind: 'course', slug: 'seo' })).resolves.toBeUndefined()
      await settle()
      expectEvent({ urls: urlsFor.course('seo') })
      expect(error).toHaveBeenCalledWith(expect.stringContaining('failed'), 'pgboss unreachable')
    } finally {
      error.mockRestore()
    }
  })
})

/* ---------------------------------- courses --------------------------------- */

describe('course hooks', () => {
  it('publishing and unpublishing a course queue both jobs', async () => {
    const course = await paidCourse({ status: 'Draft' })

    await as('post', `/api/admin/courses/${course.id}/publish`).send({}).expect(200)
    expectEvent({ urls: urlsFor.course('seo-mastery') })

    enqueueSpy.mockClear()
    await as('post', `/api/admin/courses/${course.id}/publish`)
      .send({ status: 'Draft' })
      .expect(200)
    expectEvent({ urls: urlsFor.course('seo-mastery') })
  })

  it('a settings tab save fires, under the old slug too when it renames', async () => {
    const course = await paidCourse()

    await as('put', `/api/admin/courses/${course.id}/settings`).send({ summary: 'New' }).expect(200)
    expectEvent({ urls: urlsFor.course('seo-mastery') })

    enqueueSpy.mockClear()
    await as('put', `/api/admin/courses/${course.id}/settings`)
      .send({ slug: 'seo-mastery-2026' })
      .expect(200)
    expectEvent({
      urls: [...urlsFor.course('seo-mastery-2026'), ...urlsFor.course('seo-mastery')],
    })
  })

  it('a pricing tab save fires', async () => {
    const course = await paidCourse()
    await as('put', `/api/admin/courses/${course.id}/pricing`).send({ amount: 999 }).expect(200)
    expectEvent({ urls: urlsFor.course('seo-mastery') })
  })

  it('CRUD create, update and delete fire with the row’s slug', async () => {
    const created = await as('post', '/api/admin/courses')
      .send({ title: 'Ads 101', slug: 'ads-101', amount: 0, status: 'Published' })
      .expect(201)
    expectEvent({ urls: urlsFor.course('ads-101') })

    enqueueSpy.mockClear()
    await as('put', `/api/admin/courses/${created.body._id}`)
      .send({ slug: 'ads-basics' })
      .expect(200)
    expectEvent({ urls: [...urlsFor.course('ads-basics'), ...urlsFor.course('ads-101')] })

    enqueueSpy.mockClear()
    await as('delete', `/api/admin/courses/${created.body._id}`).expect(200)
    expectEvent({ urls: urlsFor.course('ads-basics') })
  })

  it('a failing enqueue never fails the admin request', async () => {
    const course = await paidCourse({ status: 'Draft' })
    enqueueSpy.mockRejectedValue(new Error('pgboss unreachable'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await as('post', `/api/admin/courses/${course.id}/publish`).send({}).expect(200)
      expect(res.body.status).toBe('Published')
    } finally {
      error.mockRestore()
      restoreEnqueue()
    }
  })

  it('a failing inline purge or slow sitemap build does not hold up the response', async () => {
    const course = await paidCourse({ status: 'Draft' })
    let release
    const gate = new Promise((r) => (release = r))
    // Inline, the handlers would run inside enqueue: make both hang, then fail.
    enqueueSpy.mockImplementation(async () => {
      await gate
      throw new Error('Cloudflare purge failed (HTTP 500)')
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await as('post', `/api/admin/courses/${course.id}/publish`).send({}).expect(200)
      release()
      await settle()
      expect(enqueuesOf('purge-cloudflare-cache')).toHaveLength(1)
    } finally {
      error.mockRestore()
      restoreEnqueue()
    }
  })
})

/* ---------------------------- programs and workshops ------------------------ */

describe('program hooks', () => {
  it('CRUD create, update and delete fire', async () => {
    const created = await as('post', '/api/admin/programs')
      .send({ title: 'Flagship', slug: 'flagship' })
      .expect(201)
    expectEvent({ urls: urlsFor.program('flagship') })

    enqueueSpy.mockClear()
    await as('put', `/api/admin/programs/${created.body._id}`)
      .send({ title: 'Flagship 2026' })
      .expect(200)
    expectEvent({ urls: urlsFor.program('flagship') })

    enqueueSpy.mockClear()
    await as('delete', `/api/admin/programs/${created.body._id}`).expect(200)
    expectEvent({ urls: urlsFor.program('flagship') })
  })

  it('tab saves fire, under both slugs on a rename', async () => {
    const program = await insertRow(programs, { title: 'Flagship', slug: 'flagship' })

    await as('put', `/api/admin/programs/${program._id}/pricing`)
      .send({ pricing: { amount: 49999 } })
      .expect(200)
    expectEvent({ urls: urlsFor.program('flagship') })

    enqueueSpy.mockClear()
    await as('put', `/api/admin/programs/${program._id}/information`)
      .send({ slug: 'growth-flagship' })
      .expect(200)
    expectEvent({ urls: [...urlsFor.program('growth-flagship'), ...urlsFor.program('flagship')] })
  })
})

describe('workshop hooks', () => {
  it('CRUD create, update and delete fire', async () => {
    const created = await as('post', '/api/admin/workshops')
      .send({ title: 'AI Day', slug: 'ai-day' })
      .expect(201)
    expectEvent({ urls: urlsFor.workshop('ai-day') })

    enqueueSpy.mockClear()
    await as('put', `/api/admin/workshops/${created.body._id}`)
      .send({ title: 'AI Day, Chennai' })
      .expect(200)
    expectEvent({ urls: urlsFor.workshop('ai-day') })

    enqueueSpy.mockClear()
    await as('delete', `/api/admin/workshops/${created.body._id}`).expect(200)
    expectEvent({ urls: urlsFor.workshop('ai-day') })
  })
})

describe('the CRUD router without onChange', () => {
  it('behaves as before and queues nothing', async () => {
    const created = await as('post', '/api/admin/customers')
      .send({ name: 'Anjali R', email: 'anjali@example.in' })
      .expect(201)
    await as('put', `/api/admin/customers/${created.body._id}`).send({ name: 'Anjali' }).expect(200)
    await as('delete', `/api/admin/customers/${created.body._id}`).expect(200)
    expectNoEvent()
  })

  it('an empty update writes nothing and announces nothing', async () => {
    const workshop = await insertRow(workshops, { title: 'AI Day', slug: 'ai-day' })
    await as('put', `/api/admin/workshops/${workshop._id}`).send({}).expect(200)
    expectNoEvent()
  })
})

/* ------------------------------------ blog ---------------------------------- */

describe('blog hooks', () => {
  const published = (over = {}) =>
    insertRow(blogPosts, {
      title: 'Growth Loops',
      slug: 'growth-loops',
      status: 'Published',
      visibility: 'Public',
      publishedAt: new Date(Date.now() - 60_000),
      ...over,
    })

  it('creating a published post fires; creating a draft does not', async () => {
    await as('post', '/api/admin/blog').send({ title: 'Draft one' }).expect(201)
    expectNoEvent()

    await as('post', '/api/admin/blog')
      .send({ title: 'Live one', slug: 'live-one', status: 'Published' })
      .expect(201)
    expectEvent({ urls: urlsFor.post('live-one') })
  })

  it('publishing a draft (an update) fires', async () => {
    const draft = await published({ status: 'Draft' })
    await as('put', `/api/admin/blog/${draft._id}`).send({ title: 'Still a draft' }).expect(200)
    expectNoEvent()

    await as('put', `/api/admin/blog/${draft._id}`)
      .send({ status: 'Published', publishedAt: new Date(Date.now() - 1000) })
      .expect(200)
    expectEvent({ urls: urlsFor.post('growth-loops') })
  })

  it('updating a published post fires, under both slugs on a rename', async () => {
    const post = await published()
    await as('put', `/api/admin/blog/${post._id}`).send({ slug: 'loops' }).expect(200)
    expectEvent({ urls: [...urlsFor.post('loops'), ...urlsFor.post('growth-loops')] })
  })

  it('trashing and deleting a published post fire', async () => {
    const post = await published()
    await as('post', `/api/admin/blog/${post._id}/trash`).expect(200)
    expectEvent({ urls: urlsFor.post('growth-loops') })

    const other = await published({ slug: 'other-post', title: 'Other' })
    enqueueSpy.mockClear()
    await as('delete', `/api/admin/blog/${other._id}`).expect(200)
    expectEvent({ urls: urlsFor.post('other-post') })

    // Already off the site: deleting it from the trash changes nothing public.
    enqueueSpy.mockClear()
    await as('delete', `/api/admin/blog/${post._id}`).expect(200)
    expectNoEvent()
  })

  it('a bulk action queues one event for every affected public post', async () => {
    const a = await published({ slug: 'post-a', title: 'A' })
    const b = await published({ slug: 'post-b', title: 'B' })
    const draft = await published({ slug: 'post-c', title: 'C', status: 'Draft' })
    await as('post', '/api/admin/blog/bulk')
      .send({ action: 'trash', ids: [a._id, b._id, draft._id] })
      .expect(200)
    expectEvent({ urls: [...urlsFor.post('post-a'), ...urlsFor.post('post-b')] })
  })
})

/* ---------------------------- settings and taxonomy ------------------------- */

describe('settings and taxonomy hooks', () => {
  it('a settings tab save purges everything', async () => {
    await as('put', '/api/admin/settings/branding').send({ brandName: 'GS' }).expect(200)
    expectEvent({ everything: true })
  })

  it('every taxonomy write purges everything', async () => {
    const created = await as('post', '/api/admin/taxonomy')
      .send({ taxonomy: 'tag', name: 'SEO' })
      .expect(201)
    expectEvent({ everything: true })

    const id = created.body._id
    const other = await insertRow(terms, { taxonomy: 'tag', name: 'Ads', slug: 'ads' })
    const writes = [
      () => as('put', `/api/admin/taxonomy/${id}`).send({ name: 'Search' }),
      () =>
        as('post', '/api/admin/taxonomy/reorder').send({
          items: [
            { id, order: 2 },
            { id: other._id, order: 1 },
          ],
        }),
      () => as('post', '/api/admin/taxonomy/merge').send({ sourceId: other._id, targetId: id }),
      () => as('delete', `/api/admin/taxonomy/${id}`),
    ]
    for (const write of writes) {
      enqueueSpy.mockClear()
      await write().expect(200)
      expectEvent({ everything: true })
    }
  })
})

/* ---------------------------- regenerate-sitemap ---------------------------- */

describe('regenerate-sitemap', () => {
  it('invalidates first, then warms', async () => {
    const calls = []
    const result = await regenerateSitemap(
      {},
      {
        invalidate: async () => calls.push('invalidate'),
        warm: async () => {
          calls.push('warm')
          return '<xml/>'
        },
      },
    )
    expect(calls).toEqual(['invalidate', 'warm'])
    expect(result).toEqual({ bytes: 6 })
  })

  it('drops a stale memo and leaves a warm one holding the new content', async () => {
    invalidateSitemap()
    const stale = await getSitemap()
    expect(stale).not.toContain('/courses/fresh-course')

    // Written behind the memo's back, so only the job can make it appear.
    await createCourse({
      title: 'Fresh',
      slug: 'fresh-course',
      status: 'Published',
      visibility: 'Public',
    })
    expect(await getSitemap()).toBe(stale)

    const { bytes } = await regenerateSitemap({})
    const warmed = getSitemap()
    const xml = await warmed
    expect(xml).toContain(`${env.siteUrl}/courses/fresh-course`)
    expect(bytes).toBe(xml.length)
    // Warm: the next request is served the memo, not a new build.
    expect(getSitemap()).toBe(warmed)
    invalidateSitemap()
  })

  it('broadcasts the sitemap scope', async () => {
    const invalidation = await import('../src/services/invalidation.js')
    const { pool } = await import('../src/db/index.js')
    const query = vi.spyOn(pool, 'query')
    try {
      await regenerateSitemap({}, { warm: async () => '' })
      const notify = query.mock.calls.find(([sql]) => String(sql).includes('pg_notify'))
      expect(notify[1][0]).toBe(invalidation.CHANNEL)
      expect(JSON.parse(notify[1][1]).scope).toBe('sitemap')
    } finally {
      query.mockRestore()
    }
  })

  it('is scheduled every six hours (a no-op until the queue is started)', async () => {
    const { scheduleRecurringJobs } = await import('../src/jobs/index.js')
    await scheduleRecurringJobs()
    expect(scheduleSpy).toHaveBeenCalledWith('regenerate-sitemap', SITEMAP_CRON)
    expect(SITEMAP_CRON).toBe('0 */6 * * *')
  })

  it('a content change runs it through the queue', async () => {
    invalidateSitemap()
    const stale = await getSitemap()
    const course = await createCourse({ title: 'Later', slug: 'later', status: 'Draft' })
    await as('post', `/api/admin/courses/${course.id}/publish`).send({}).expect(200)
    await settle()
    expect(await getSitemap()).not.toBe(stale)
    expect(await getSitemap()).toContain('/courses/later')
    invalidateSitemap()
  })
})

/* -------------------------- purge-cloudflare-cache -------------------------- */

describe('purge-cloudflare-cache', () => {
  const SITE = 'https://growthscholar.test'
  const ok = () => ({ ok: true, status: 200, json: async () => ({ success: true }) })
  const quiet = () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })
  const configured = (fetch, logger = quiet()) =>
    createCloudflarePurge({ zoneId: 'zone123', apiToken: 'token456', siteUrl: SITE, fetch, logger })

  it('is a no-op without CF_ZONE_ID or CF_API_TOKEN, and says so once', async () => {
    for (const config of [
      { zoneId: '', apiToken: 'token' },
      { zoneId: 'zone', apiToken: '' },
      { zoneId: '', apiToken: '' },
    ]) {
      const fetch = vi.fn()
      const logger = quiet()
      const purge = createCloudflarePurge({ ...config, siteUrl: SITE, fetch, logger })
      for (let i = 0; i < 3; i += 1) {
        await expect(purge({ urls: ['/'] })).resolves.toEqual({ skipped: 'unconfigured' })
        await expect(purge({ everything: true })).resolves.toEqual({ skipped: 'unconfigured' })
      }
      expect(fetch).not.toHaveBeenCalled()
      const lines = [
        ...logger.log.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ]
      expect(lines).toHaveLength(1)
      expect(lines[0][0]).toMatch(/CF_ZONE_ID/)
    }
  })

  it('the registered job is a silent no-op under test', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    try {
      await expect(real.enqueue('purge-cloudflare-cache', { everything: true })).resolves.toEqual({
        skipped: 'unconfigured',
      })
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
    }
  })

  it('posts absolute URLs to the zone purge endpoint with the bearer token', async () => {
    const fetch = vi.fn(async () => ok())
    await configured(fetch)({ urls: ['/', '/courses/seo', '/sitemap.xml'] })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.cloudflare.com/client/v4/zones/zone123/purge_cache')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer token456')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({
      files: [`${SITE}/`, `${SITE}/courses/seo`, `${SITE}/sitemap.xml`],
    })
  })

  it(`splits more than ${PURGE_BATCH_SIZE} URLs into batches, each URL exactly once`, async () => {
    const fetch = vi.fn(async () => ok())
    const paths = Array.from({ length: 73 }, (_, i) => `/blog/post-${i}`)
    // A duplicate in the payload is still purged once.
    await expect(configured(fetch)({ urls: [...paths, paths[0]] })).resolves.toEqual({
      purged: 73,
    })
    const batches = fetch.mock.calls.map(([, init]) => JSON.parse(init.body).files)
    expect(batches).toHaveLength(3)
    for (const batch of batches) expect(batch.length).toBeLessThanOrEqual(PURGE_BATCH_SIZE)
    const sent = batches.flat()
    expect(sent).toHaveLength(73)
    expect(new Set(sent)).toEqual(new Set(paths.map((p) => `${SITE}${p}`)))
  })

  it('throws on a non-2xx response so the queue retries', async () => {
    const fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        errors: [{ code: 10000, message: 'Authentication error' }],
      }),
    }))
    await expect(configured(fetch)({ urls: ['/'] })).rejects.toThrow(
      /HTTP 403.*Authentication error/,
    )
  })

  it('a failed batch fails the job and stops the rest', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValue(ok())
    const paths = Array.from({ length: 90 }, (_, i) => `/p/${i}`)
    await expect(configured(fetch)({ urls: paths })).rejects.toThrow(/HTTP 429/)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('everything sends purge_everything in one request', async () => {
    const fetch = vi.fn(async () => ok())
    await expect(configured(fetch)({ everything: true })).resolves.toEqual({
      purged: 'everything',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ purge_everything: true })
  })

  it('an empty URL list makes no request', async () => {
    const fetch = vi.fn(async () => ok())
    await expect(configured(fetch)({ urls: [] })).resolves.toEqual({ purged: 0 })
    expect(fetch).not.toHaveBeenCalled()
  })
})
