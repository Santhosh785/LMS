import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Media, Setting } from '../src/models/index.js'
import { seal } from '../src/utils/secretBox.js'
import { invalidateRuntimeConfig, refreshRuntimeConfig } from '../src/services/runtimeConfig.js'
import { agent, signUpAdmin } from './helpers/factories.js'

/**
 * Media Library storage.
 *
 * Bunny Storage is stubbed at the fetch boundary, so these assert our side of
 * the contract: that the bytes go where the configuration says, that the zone
 * password never leaves the server, that a failed upload is surfaced rather
 * than quietly written to a disk the next deploy replaces, and that switching
 * an install over can bring its existing files along.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAPElEQVR4nO3PMQEAAAjAoNm/9Er4CRHIrfbMAAAA' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgH8LWDoAAaRPQ2sAAAAASUVORK5CYII=',
  'base64',
)

const uploadsDir = fileInServer('uploads/media')
const stagingDir = path.join(os.tmpdir(), 'growth-scholar-uploads')

function fileInServer(relative) {
  return path.join(process.cwd(), relative)
}

/** Points the runtime config at a storage zone, the way the admin screen does. */
async function configureBunny() {
  const doc = await Setting.getSingleton()
  await Setting.updateOne(
    { _id: doc._id },
    {
      $set: {
        'media.bunnyStorageZone': 'gs-media',
        'media.bunnyStorageRegion': 'sg',
        'media.bunnyStorageHost': 'cdn.example.net',
        'media.bunnyStoragePasswordEnc': seal('zone-password'),
      },
    },
  )
  invalidateRuntimeConfig()
  await refreshRuntimeConfig()
}

/** Records every call so a test can assert what left the building. */
function stubStorage({ status = 201 } = {}) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opts = {}) => {
      calls.push({ url: String(url), method: opts.method || 'GET', headers: opts.headers, body: opts.body })
      return {
        ok: status < 400,
        status,
        json: async () => [],
        text: async () => (status < 400 ? '' : 'storage error'),
      }
    }),
  )
  return calls
}

const upload = (cookie, name = 'photo.png', bytes = PNG) =>
  agent().post('/api/admin/media').set('Cookie', cookie).attach('files', bytes, name)

/** A real image of a given size, so the resizer has something to work from. */
const image = (width, height) =>
  sharp({ create: { width, height, channels: 3, background: '#135855' } }).png().toBuffer()

/**
 * The suite writes real files, because that is the behaviour under test — but
 * dropping the database afterwards does not remove them, so without this every
 * run leaves another handful of images in server/uploads/media. Only files that
 * appeared during the run are touched; anything already there is left alone.
 */
let preexisting = new Set()

beforeAll(() => {
  fs.mkdirSync(uploadsDir, { recursive: true })
  preexisting = new Set(fs.readdirSync(uploadsDir))
})

afterAll(() => {
  for (const name of fs.readdirSync(uploadsDir)) {
    if (!preexisting.has(name)) fs.rmSync(path.join(uploadsDir, name), { force: true })
  }
  fs.rmSync(stagingDir, { recursive: true, force: true })
})

/**
 * The runtime config is process state, and `invalidateRuntimeConfig()` only
 * marks it stale — the reload it triggers is deliberately not awaited, so the
 * request that follows is still served the previous values. A test that leaves
 * a storage zone configured would therefore hand it to the next one. Clearing
 * the document and awaiting the reload is what actually resets it.
 */
afterEach(async () => {
  vi.unstubAllGlobals()
  await Setting.deleteMany({})
  invalidateRuntimeConfig()
  await refreshRuntimeConfig()
})

describe('with no storage zone configured', () => {
  it('keeps images on the server disk, and deleting one removes the file', async () => {
    const { cookie } = await signUpAdmin()

    const res = await upload(cookie).expect(201)
    expect(res.body.storage).toBe('local')
    expect(res.body.url).toMatch(/^\/uploads\/media\//)
    expect(res.body.path).toBe('')

    const onDisk = path.join(uploadsDir, res.body.filename)
    expect(fs.existsSync(onDisk)).toBe(true)

    await agent().delete(`/api/admin/media/${res.body._id}`).set('Cookie', cookie).expect(200)
    expect(fs.existsSync(onDisk)).toBe(false)
  })

  it('reports the backend so the library can say where uploads go', async () => {
    const { cookie } = await signUpAdmin()
    const res = await agent().get('/api/admin/media').set('Cookie', cookie).expect(200)
    expect(res.body.storage.backend).toBe('local')
  })
})

describe('with a storage zone configured', () => {
  it('PUTs the bytes to the zone and stores the CDN address', async () => {
    const { cookie } = await signUpAdmin()
    await configureBunny()
    const calls = stubStorage()

    const res = await upload(cookie).expect(201)

    expect(res.body.storage).toBe('bunny')
    // Date-partitioned, uuid-named — never the caller's filename.
    expect(res.body.path).toMatch(/^blog\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/)
    expect(res.body.url).toBe(`https://cdn.example.net/${res.body.path.split('/').map(encodeURIComponent).join('/')}`)

    const put = calls.find((call) => call.method === 'PUT')
    expect(put.url).toBe(`https://sg.storage.bunnycdn.com/gs-media/${res.body.path}`)
    expect(put.headers.AccessKey).toBe('zone-password')
    expect(put.headers['content-type']).toBe('image/png')
    // Bunny rejects a body that does not match, so a truncated upload fails
    // loudly instead of storing a corrupt image.
    expect(put.headers.Checksum).toBe(crypto.createHash('sha256').update(PNG).digest('hex').toUpperCase())
  })

  it('leaves nothing behind in the staging directory', async () => {
    const { cookie } = await signUpAdmin()
    await configureBunny()
    stubStorage()

    await upload(cookie).expect(201)

    const staged = fs.existsSync(stagingDir) ? fs.readdirSync(stagingDir) : []
    expect(staged).toEqual([])
  })

  it('deletes the object from the zone, not from the disk', async () => {
    const { cookie } = await signUpAdmin()
    await configureBunny()
    const calls = stubStorage()

    const created = await upload(cookie).expect(201)
    await agent().delete(`/api/admin/media/${created.body._id}`).set('Cookie', cookie).expect(200)

    const del = calls.find((call) => call.method === 'DELETE')
    expect(del.url).toBe(`https://sg.storage.bunnycdn.com/gs-media/${created.body.path}`)
    expect(await Media.countDocuments()).toBe(0)
  })

  /**
   * The failure that matters most: "uploads are on the CDN" silently becoming
   * "uploads are on a disk the next deploy wipes" is the whole reason this path
   * exists, so a rejected write must be an error, not a fallback.
   */
  it('surfaces a rejected write instead of falling back to the disk', async () => {
    const { cookie } = await signUpAdmin()
    await configureBunny()
    stubStorage({ status: 500 })

    const res = await upload(cookie)

    expect(res.status).toBe(502)
    expect(await Media.countDocuments()).toBe(0)
    const staged = fs.existsSync(stagingDir) ? fs.readdirSync(stagingDir) : []
    expect(staged).toEqual([])
  })

  it('never returns the zone password to the browser', async () => {
    const { cookie } = await signUpAdmin()
    await configureBunny()

    const res = await agent().get('/api/admin/integrations').set('Cookie', cookie).expect(200)

    expect(JSON.stringify(res.body)).not.toContain('zone-password')
    expect(res.body.media.bunnyStoragePassword.set).toBe(true)
    expect(res.body.media.bunnyStoragePassword.source).toBe('admin')
    expect(res.body.status.imageStorage).toBe(true)
  })
})

describe('migrating an install that already has local files', () => {
  it('moves them into the zone and frees the disk', async () => {
    const { cookie } = await signUpAdmin()

    // Uploaded before the switch — on disk, as the old behaviour.
    const before = await upload(cookie, 'legacy.png').expect(201)
    const onDisk = path.join(uploadsDir, before.body.filename)
    expect(fs.existsSync(onDisk)).toBe(true)

    await configureBunny()
    const calls = stubStorage()

    const res = await agent().post('/api/admin/media/migrate').set('Cookie', cookie).expect(200)

    expect(res.body).toMatchObject({ moved: 1, missing: 0, remaining: 0, failures: [] })
    expect(calls.some((call) => call.method === 'PUT')).toBe(true)
    expect(fs.existsSync(onDisk)).toBe(false)

    const moved = await Media.findById(before.body._id).lean()
    expect(moved.storage).toBe('bunny')
    expect(moved.url).toMatch(/^https:\/\/cdn\.example\.net\/blog\//)
  })

  it('counts rows whose file a previous deploy already took, rather than failing', async () => {
    const { cookie } = await signUpAdmin()

    const orphan = await upload(cookie, 'gone.png').expect(201)
    fs.unlinkSync(path.join(uploadsDir, orphan.body.filename))

    await configureBunny()
    stubStorage()

    const res = await agent().post('/api/admin/media/migrate').set('Cookie', cookie).expect(200)
    expect(res.body).toMatchObject({ moved: 0, missing: 1 })
  })

  it('refuses to run before a zone is configured', async () => {
    const { cookie } = await signUpAdmin()
    await agent().post('/api/admin/media/migrate').set('Cookie', cookie).expect(400)
  })
})

describe('derivative sizes', () => {
  it('renders WordPress\'s set from a large upload and records the dimensions', async () => {
    const { cookie } = await signUpAdmin()

    const res = await upload(cookie, 'banner.png', await image(1200, 630)).expect(201)

    expect(res.body.width).toBe(1200)
    expect(res.body.height).toBe(630)
    const byName = Object.fromEntries(res.body.sizes.map((s) => [s.name, s]))
    expect(Object.keys(byName).sort()).toEqual(['large', 'medium', 'medium_large', 'thumbnail'])
    // Thumbnails crop to a square; everything else keeps the aspect ratio.
    expect(byName.thumbnail).toMatchObject({ width: 150, height: 150 })
    expect(byName.medium).toMatchObject({ width: 300, height: 158 })
    expect(byName.large).toMatchObject({ width: 1024, height: 538 })
    // …and each derivative is genuinely smaller than the original.
    expect(byName.large.size).toBeLessThan(res.body.size)
  })

  /**
   * The rule that matters: upscaling produces a bigger file that looks worse,
   * so a size the original cannot fill is skipped rather than invented.
   */
  it('skips sizes the original is too small for', async () => {
    const { cookie } = await signUpAdmin()

    const res = await upload(cookie, 'small.png', await image(500, 300)).expect(201)

    expect(res.body.sizes.map((s) => s.name).sort()).toEqual(['medium', 'thumbnail'])
    expect(res.body.sizes.every((s) => s.width <= 500)).toBe(true)
  })

  it('names each derivative after its dimensions, as WordPress does', async () => {
    const { cookie } = await signUpAdmin()
    const res = await upload(cookie, 'banner.png', await image(1200, 630)).expect(201)
    const large = res.body.sizes.find((s) => s.name === 'large')
    expect(large.url).toMatch(/-1024x538\.png$/)
  })

  it('deletes the derivatives along with the original', async () => {
    const { cookie } = await signUpAdmin()
    const res = await upload(cookie, 'banner.png', await image(1200, 630)).expect(201)

    const files = [res.body.filename, ...res.body.sizes.map((s) => path.basename(s.url))]
    expect(files.every((name) => fs.existsSync(path.join(uploadsDir, name)))).toBe(true)

    await agent().delete(`/api/admin/media/${res.body._id}`).set('Cookie', cookie).expect(200)
    expect(files.some((name) => fs.existsSync(path.join(uploadsDir, name)))).toBe(false)
  })

  it('uploads every derivative to the zone as its own object', async () => {
    const { cookie } = await signUpAdmin()
    await configureBunny()
    const calls = stubStorage()

    const res = await upload(cookie, 'banner.png', await image(1200, 630)).expect(201)

    const puts = calls.filter((call) => call.method === 'PUT').map((call) => call.url)
    expect(puts).toHaveLength(1 + res.body.sizes.length)
    expect(puts.some((url) => url.endsWith('-150x150.png'))).toBe(true)
    expect(res.body.sizes.every((s) => s.url.startsWith('https://cdn.example.net/'))).toBe(true)
  })

  it('builds sizes for an image that predates them', async () => {
    const { cookie } = await signUpAdmin()
    const res = await upload(cookie, 'banner.png', await image(1200, 630)).expect(201)

    // Back to how a pre-existing row looks: original only.
    await Media.updateOne({ _id: res.body._id }, { $set: { sizes: [], width: 0, height: 0 } })
    const before = await agent().get('/api/admin/media').set('Cookie', cookie).expect(200)
    expect(before.body.storage.withoutSizes).toBe(1)

    const run = await agent().post('/api/admin/media/regenerate').set('Cookie', cookie).expect(200)

    expect(run.body).toMatchObject({ rebuilt: 1, remaining: 0, failures: [] })
    const after = await Media.findById(res.body._id).lean()
    expect(after.width).toBe(1200)
    expect(after.sizes).toHaveLength(4)
  })
})

describe('the public article', () => {
  it('carries a srcset built from the generated sizes', async () => {
    const { cookie } = await signUpAdmin()
    const media = await upload(cookie, 'banner.png', await image(1200, 630)).expect(201)

    const post = await agent()
      .post('/api/admin/blog')
      .set('Cookie', cookie)
      .send({
        title: 'Sized',
        status: 'Published',
        image: media.body.url,
        imageMediaId: media.body._id,
        body: [{ type: 'image', url: media.body.url, mediaId: media.body._id, alt: 'A banner' }],
      })
      .expect(201)

    const res = await agent().get(`/api/blog/${post.body.slug}`).expect(200)

    // Widest last, each candidate labelled with its real pixel width.
    expect(res.body.post.imageSrcset).toMatch(/150w.+300w.+768w.+1024w.+1200w/)
    expect(res.body.post.body[0].srcset).toContain('1200w')
    expect(res.body.post.imageWidth).toBe(1200)
  })
})
