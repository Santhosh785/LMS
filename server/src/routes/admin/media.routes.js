import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import Media from '../../models/Media.js'
import {
  deleteObject,
  getObject,
  isBunnyStorageConfigured,
  objectPathFor,
  putObject,
  storageGaps,
} from '../../services/bunnyStorage.js'
import { measure, renderSizes, sizedPath } from '../../services/imageSizes.js'

const router = Router()

/**
 * The Media Library's storage, which is either Bunny or this disk.
 *
 * `mediaDir` is still exported and still served statically by src/index.js:
 * an install that switches to Bunny keeps every image it uploaded beforehand,
 * and those keep resolving from here until they are migrated.
 */
export const mediaDir = fileURLToPath(new URL('../../../uploads/media/', import.meta.url))
fs.mkdirSync(mediaDir, { recursive: true })

/**
 * Where an upload is written before it is forwarded to Bunny.
 *
 * Bunny wants the bytes in one request, but buffering twenty 10MB files in
 * memory to do that is how a small VPS gets OOM-killed. So multer streams each
 * file to a scratch file first and it is read back one at a time — peak memory
 * is one image, not the whole batch. The scratch directory is outside the
 * project so a transient file never lands next to the source.
 */
const stagingDir = path.join(os.tmpdir(), 'growth-scholar-uploads')

// Raster formats only. An SVG is an executable document rather than just a
// picture, and one served from our own origin could run script against an
// admin session, so the Media Library does not accept it.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])

const upload = multer({
  storage: multer.diskStorage({
    /*
     * The directory is re-created on every write, not only at boot. It lives
     * outside the build output and is gitignored, so a deploy, a clean checkout
     * or a stray `rm -rf` can leave a long-running process pointing at a path
     * that no longer exists — and the only symptom is an ENOENT the moment an
     * editor tries to upload. `recursive: true` makes this a no-op when the
     * directory is already there.
     */
    destination: (_req, _file, done) => {
      const target = isBunnyStorageConfigured() ? stagingDir : mediaDir
      fs.mkdirSync(target, { recursive: true })
      done(null, target)
    },
    filename: (_req, file, done) => {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 10)
      done(null, `${crypto.randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, done) => {
    const ok = IMAGE_TYPES.has(file.mimetype)
    done(ok ? null : new HttpError(400, 'Upload a JPG, PNG, WebP, GIF or AVIF image'), ok)
  },
})

const rx = (value) => new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
const str = (value, max = 500) => String(value ?? '').trim().slice(0, max)
const titleFrom = (name) => str(path.basename(name, path.extname(name)).replace(/[-_]+/g, ' '), 200)

/** Resolves a stored filename inside a directory, or null if it escapes it. */
function resolveInside(directory, filename) {
  const root = path.resolve(directory)
  const file = path.resolve(root, filename || '')
  return file.startsWith(`${root}${path.sep}`) ? file : null
}

const unlinkQuietly = async (file) => {
  if (file) await fs.promises.unlink(file).catch(() => {})
}

/**
 * Removes the bytes behind a Media document, wherever they happen to live —
 * the original and every derivative, or the storage zone quietly accumulates
 * orphaned thumbnails nothing will ever reference again.
 */
async function removeBytes(media) {
  const derivatives = media.sizes || []
  if (media.storage === 'bunny' && media.path) {
    await Promise.all(derivatives.map((s) => (s.path ? deleteObject(s.path).catch(() => {}) : null)))
    return deleteObject(media.path)
  }
  await Promise.all(
    derivatives.map((s) => unlinkQuietly(resolveInside(mediaDir, path.basename(s.url || '')))),
  )
  return unlinkQuietly(resolveInside(mediaDir, media.filename))
}

/**
 * Turns one staged upload into a stored object.
 *
 * A failed Bunny write is surfaced, not silently written to disk instead:
 * "uploads are on the CDN" quietly becoming "uploads are on a disk that the
 * next deploy wipes" is exactly the failure this whole path exists to avoid.
 */
/**
 * Writes one derivative next to its original, on whichever backend is in use.
 * Returns the subdocument the Media row stores, or null if the write failed —
 * a missing derivative degrades the Size dropdown, it does not fail the upload.
 */
async function storeDerivative(fullPath, variant, mimeType, toBunny) {
  const target = sizedPath(fullPath, variant.width, variant.height)
  try {
    if (toBunny) {
      const { url } = await putObject(target, variant.buffer, mimeType)
      return { name: variant.name, width: variant.width, height: variant.height, url, path: target, size: variant.buffer.length }
    }
    const file = resolveInside(mediaDir, path.basename(target))
    if (!file) return null
    await fs.promises.writeFile(file, variant.buffer)
    return {
      name: variant.name,
      width: variant.width,
      height: variant.height,
      url: `/uploads/media/${path.basename(target)}`,
      path: '',
      size: variant.buffer.length,
    }
  } catch {
    return null
  }
}

async function store(file, uploadedBy) {
  const toBunny = isBunnyStorageConfigured()
  const staged = resolveInside(toBunny ? stagingDir : mediaDir, file.filename)
  if (!staged) throw new HttpError(400, 'Rejected an upload with an unexpected filename')

  const buffer = await fs.promises.readFile(staged)
  const dimensions = await measure(buffer)
  const base = {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    title: titleFrom(file.originalname),
    uploadedBy,
    ...dimensions,
  }

  if (!toBunny) {
    // The original is already where it belongs; only the derivatives are new.
    const variants = await renderSizes(buffer, file.mimetype, dimensions)
    const sizes = await Promise.all(
      variants.map((variant) => storeDerivative(`/${file.filename}`, variant, file.mimetype, false)),
    )
    return {
      ...base,
      storage: 'local',
      filename: file.filename,
      path: '',
      url: `/uploads/media/${file.filename}`,
      sizes: sizes.filter(Boolean),
    }
  }

  try {
    const objectPath = objectPathFor(file.originalname)
    const { url } = await putObject(objectPath, buffer, file.mimetype)
    const variants = await renderSizes(buffer, file.mimetype, dimensions)
    const sizes = await Promise.all(
      variants.map((variant) => storeDerivative(objectPath, variant, file.mimetype, true)),
    )
    return {
      ...base,
      storage: 'bunny',
      filename: path.basename(objectPath),
      path: objectPath,
      url,
      sizes: sizes.filter(Boolean),
    }
  } finally {
    await unlinkQuietly(staged)
  }
}

/** Drops a document's existing derivatives and renders a fresh set. */
async function rebuildSizes(media, buffer) {
  const toBunny = media.storage === 'bunny'
  await Promise.all(
    (media.sizes || []).map((variant) =>
      toBunny && variant.path
        ? deleteObject(variant.path).catch(() => {})
        : unlinkQuietly(resolveInside(mediaDir, path.basename(variant.url || ''))),
    ),
  )
  const dimensions = media.width && media.height ? { width: media.width, height: media.height } : await measure(buffer)
  const variants = await renderSizes(buffer, media.mimeType, dimensions)
  const basePath = toBunny ? media.path : `/${media.filename}`
  const sizes = await Promise.all(
    variants.map((variant) => storeDerivative(basePath, variant, media.mimeType, toBunny)),
  )
  return { sizes: sizes.filter(Boolean), ...dimensions }
}

/** The original's bytes, from wherever the document says they are. */
async function readOriginal(media) {
  if (media.storage === 'bunny' && media.path) return getObject(media.path)
  const file = resolveInside(mediaDir, media.filename)
  if (!file || !fs.existsSync(file)) return null
  return fs.promises.readFile(file)
}

router.get('/', asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.q?.trim()) {
    const q = rx(req.query.q.trim())
    filter.$or = [{ originalName: q }, { title: q }, { altText: q }, { caption: q }, { description: q }]
  }
  if (/^\d{6}$/.test(req.query.m || '')) {
    const year = Number(req.query.m.slice(0, 4))
    const month = Number(req.query.m.slice(4)) - 1
    filter.createdAt = { $gte: new Date(year, month, 1), $lt: new Date(year, month + 1, 1) }
  }

  const perPage = Math.min(Math.max(Number(req.query.perPage) || 40, 1), 200)
  const page = Math.max(Number(req.query.page) || 1, 1)

  const [items, total, months, byStorage, withoutSizes] = await Promise.all([
    Media.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    Media.countDocuments(filter),
    Media.aggregate([
      { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y%m' } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 60 },
    ]),
    Media.aggregate([{ $group: { _id: '$storage', count: { $sum: 1 } } }]),
    Media.countDocuments({ $or: [{ sizes: { $size: 0 } }, { sizes: { $exists: false } }] }),
  ])

  const counts = Object.fromEntries(byStorage.map((row) => [row._id || 'local', row.count]))
  res.json({
    items,
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    months: months.filter((m) => m._id).map((m) => ({ key: m._id, count: m.count })),
    // Lets the library tell an operator where new uploads will go, and how many
    // older files are still sitting on the server's disk.
    storage: {
      backend: isBunnyStorageConfigured() ? 'bunny' : 'local',
      // Named so a half-filled configuration reads as "the hostname is
      // missing" rather than as "Bunny is off".
      missing: storageGaps(),
      local: counts.local || 0,
      bunny: counts.bunny || 0,
      withoutSizes,
    },
  })
}))

/** Accepts either a single `file` or a multi-select drop of `files`. */
router.post('/', upload.any(), asyncHandler(async (req, res) => {
  const files = req.files || []
  if (!files.length) throw new HttpError(400, 'Choose an image to upload')

  const created = []
  try {
    // Sequential on purpose: see stagingDir above — one image in memory at a time.
    for (const file of files) {
      created.push(await Media.create(await store(file, req.user?.name || 'Admin')))
    }
  } catch (err) {
    // Whatever did not make it leaves nothing behind in the staging directory.
    await Promise.all(files.map((file) => unlinkQuietly(resolveInside(stagingDir, file.filename))))
    if (created.length) {
      return res.status(207).json({
        items: created,
        error: `Uploaded ${created.length} of ${files.length} files. ${err.message}`,
      })
    }
    throw new HttpError(502, `Upload failed: ${err.message}`)
  }

  // One file keeps the single-object shape the editor's featured-image picker
  // expects; a multi-drop returns the whole batch.
  res.status(201).json(created.length === 1 ? created[0] : { items: created })
}))

/**
 * Moves files already on this disk into the storage zone.
 *
 * Switching an install to Bunny leaves every earlier upload behind on a disk
 * the next deploy may well replace, so the switch is only half a migration
 * without this. Batched, because a library of a few thousand images would
 * otherwise be one request that times out halfway through with no record of
 * how far it got — each file is committed as it lands.
 */
router.post('/migrate', asyncHandler(async (req, res) => {
  if (!isBunnyStorageConfigured()) throw new HttpError(400, 'Configure Bunny Storage first')
  const limit = Math.min(Math.max(Number(req.body?.limit) || 25, 1), 100)

  const pending = await Media.find({ $or: [{ storage: 'local' }, { storage: { $exists: false } }] })
    .sort({ createdAt: 1 })
    .limit(limit)

  let moved = 0
  let missing = 0
  const failures = []

  for (const media of pending) {
    const local = resolveInside(mediaDir, media.filename)
    if (!local || !fs.existsSync(local)) {
      // The row points at a file this disk no longer has — a previous deploy
      // already took it. Nothing to move, and nothing to be done about it.
      missing += 1
      continue
    }
    try {
      const buffer = await fs.promises.readFile(local)
      const objectPath = objectPathFor(media.originalName, media.createdAt)
      const { url } = await putObject(objectPath, buffer, media.mimeType)

      // The derivatives have to move with the original — they are separate
      // files, and leaving them on the disk would point the Size dropdown at
      // URLs the next deploy removes.
      const staleSizes = media.sizes || []
      media.storage = 'bunny'
      media.path = objectPath
      media.url = url
      media.sizes = []
      const rebuilt = await rebuildSizes(media, buffer)
      Object.assign(media, rebuilt)
      await media.save()

      await Promise.all(
        staleSizes.map((variant) => unlinkQuietly(resolveInside(mediaDir, path.basename(variant.url || '')))),
      )
      await unlinkQuietly(local)
      moved += 1
    } catch (err) {
      failures.push(`${media.originalName}: ${err.message}`)
    }
  }

  const remaining = await Media.countDocuments({ $or: [{ storage: 'local' }, { storage: { $exists: false } }] })
  res.json({ ok: true, moved, missing, remaining, failures })
}))

/**
 * Rebuilds the derivative sizes for images that have none.
 *
 * Anything uploaded before sizes existed has only its original, so the Size
 * dropdown would offer nothing for it. `all=true` rebuilds every image instead,
 * which is what to run after changing the size list in services/imageSizes.js.
 */
router.post('/regenerate', asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.body?.limit) || 25, 1), 100)
  const filter = req.body?.all ? {} : { $or: [{ sizes: { $size: 0 } }, { sizes: { $exists: false } }] }

  const pending = await Media.find(filter).sort({ createdAt: 1 }).limit(limit)
  let rebuilt = 0
  let skipped = 0
  const failures = []

  for (const media of pending) {
    try {
      const buffer = await readOriginal(media)
      if (!buffer) {
        skipped += 1
        continue
      }
      const next = await rebuildSizes(media, buffer)
      Object.assign(media, next)
      await media.save()
      rebuilt += media.sizes.length ? 1 : 0
      if (!media.sizes.length) skipped += 1
    } catch (err) {
      failures.push(`${media.originalName}: ${err.message}`)
    }
  }

  const remaining = await Media.countDocuments({ $or: [{ sizes: { $size: 0 } }, { sizes: { $exists: false } }] })
  res.json({ ok: true, rebuilt, skipped, remaining, failures })
}))

router.post('/bulk', asyncHandler(async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
    .map(String)
    .filter((id) => /^[a-f\d]{24}$/i.test(id))
  if (!ids.length) throw new HttpError(400, 'Select at least one item')
  if (req.body?.action !== 'delete') throw new HttpError(400, 'Choose a bulk action')

  const items = await Media.find({ _id: { $in: ids } }).lean()
  await Media.deleteMany({ _id: { $in: ids } })
  // Best effort: the rows are gone either way, and a storage object that
  // outlives its row costs pennies, where a failed delete blocking the whole
  // batch would leave the library inconsistent.
  await Promise.all(items.map((item) => removeBytes(item).catch(() => {})))
  res.json({ ok: true, affected: items.length })
}))

/** One attachment, so the editor's Size dropdown knows what exists. */
router.get('/:id', asyncHandler(async (req, res) => {
  const media = await Media.findById(req.params.id).lean()
  if (!media) throw new HttpError(404, 'Media item not found')
  res.json(media)
}))

router.put('/:id', asyncHandler(async (req, res) => {
  const patch = {}
  for (const key of ['title', 'altText', 'caption', 'description']) {
    if (key in (req.body || {})) patch[key] = str(req.body[key], key === 'description' ? 2000 : 500)
  }
  if (!Object.keys(patch).length) throw new HttpError(400, 'Nothing to update')
  const media = await Media.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true })
  if (!media) throw new HttpError(404, 'Media item not found')
  res.json(media)
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const media = await Media.findByIdAndDelete(req.params.id)
  if (!media) throw new HttpError(404, 'Media item not found')
  await removeBytes(media).catch(() => {})
  res.json({ ok: true })
}))

export default router
