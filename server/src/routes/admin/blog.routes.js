import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import BlogPost, { BLOCK_TYPES } from '../../models/BlogPost.js'
import BlogComment from '../../models/BlogComment.js'
import { slugify } from '../../services/taxonomy.js'

/**
 * The editorial API behind /admin/blog.
 *
 * It is shaped after wp-admin rather than after the generic CRUD router used by
 * the rest of the admin: the list screen needs per-status counts, a month
 * archive and comment tallies in the same round trip the rows arrive in, and
 * destructive actions go through Trash before they delete anything.
 */
const router = Router()

const BODY_TYPES = new Set(BLOCK_TYPES)
const STATUSES = ['Draft', 'Pending', 'Published', 'Scheduled', 'Archived', 'Trash']
const ALIGNMENTS = new Set(['left', 'center', 'right', 'wide'])
const VISIBILITIES = new Set(['Public', 'Private', 'Password'])
const SORTABLE = { title: 'title', date: 'publishedAt', modified: 'updatedAt', author: 'author.name' }

const WRITABLE = new Set([
  'title', 'slug', 'category', 'categories', 'tags', 'excerpt', 'body', 'author', 'publishedAt',
  'readTime', 'status', 'featured', 'sticky', 'allowComments', 'image', 'imageAlt', 'heroClass',
  'heroLabel', 'seo', 'visibility', 'password', 'imageMediaId', 'imageWidth', 'imageHeight',
])
const REVISION_FIELDS = [
  'title', 'slug', 'excerpt', 'body', 'category', 'categories', 'tags', 'image', 'imageAlt',
  'heroClass', 'heroLabel', 'featured', 'status', 'publishedAt', 'readTime', 'seo',
]

const rx = (value) => new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
const str = (value, max = 500) => String(value ?? '').trim().slice(0, max)
const cleanStrings = (value) =>
  Array.isArray(value) ? [...new Set(value.map((v) => str(v, 120)).filter(Boolean))] : []
const idList = (value) =>
  (Array.isArray(value) ? value : []).map((id) => String(id)).filter((id) => /^[a-f\d]{24}$/i.test(id))

/** Only named, typed fields survive a save — never a slab of caller HTML. */
function cleanBody(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 400).map((raw) => {
    const block = {
      type: BODY_TYPES.has(raw?.type) ? raw.type : 'p',
      text: String(raw?.text ?? '').slice(0, 20000),
      items: cleanStrings(raw?.items).slice(0, 200),
    }
    if (raw?.url) block.url = str(raw.url, 2000)
    if (/^[a-f\d]{24}$/i.test(raw?.mediaId || '')) block.mediaId = raw.mediaId
    if (Number(raw?.width) > 0) block.width = Math.min(Number(raw.width), 20000)
    if (Number(raw?.height) > 0) block.height = Math.min(Number(raw.height), 20000)
    if (raw?.alt) block.alt = str(raw.alt, 300)
    if (raw?.caption) block.caption = str(raw.caption, 500)
    if (raw?.citation) block.citation = str(raw.citation, 300)
    if (ALIGNMENTS.has(raw?.align)) block.align = raw.align
    if (raw?.language) block.language = str(raw.language, 40)
    if (raw?.style) block.style = str(raw.style, 40)
    if (raw?.provider) block.provider = str(raw.provider, 40)
    if (raw?.header) block.header = true
    if (Array.isArray(raw?.rows)) {
      block.rows = raw.rows.slice(0, 60).map((row) => ({
        cells: (Array.isArray(row?.cells) ? row.cells : []).slice(0, 12).map((cell) => str(cell, 500)),
      }))
    }
    return block
  })
}

const wordsIn = (body) =>
  body.reduce((total, block) => {
    const rows = (block.rows || []).flatMap((row) => row.cells || [])
    const text = [block.text, block.caption, ...(block.items || []), ...rows].filter(Boolean).join(' ')
    return total + text.trim().split(/\s+/).filter(Boolean).length
  }, 0)

const minutesFor = (body) => `${Math.max(1, Math.ceil(wordsIn(body) / 220))} min read`

async function uniqueSlug(input, exceptId) {
  const base = slugify(input) || 'post'
  for (let n = 1; n < 200; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`
    const exists = await BlogPost.exists({ slug: candidate, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    if (!exists) return candidate
  }
  throw new HttpError(409, 'Could not make a unique post URL')
}

function patchFrom(body) {
  const patch = Object.fromEntries(Object.entries(body || {}).filter(([key]) => WRITABLE.has(key)))
  if ('title' in patch) patch.title = str(patch.title, 300)
  if ('excerpt' in patch) patch.excerpt = str(patch.excerpt, 2000)
  if ('category' in patch) patch.category = str(patch.category, 120)
  if ('categories' in patch) patch.categories = cleanStrings(patch.categories)
  if ('tags' in patch) patch.tags = cleanStrings(patch.tags)
  if ('body' in patch) patch.body = cleanBody(patch.body)
  if ('status' in patch && !STATUSES.includes(patch.status)) delete patch.status
  if ('visibility' in patch && !VISIBILITIES.has(patch.visibility)) delete patch.visibility
  if ('publishedAt' in patch) {
    const when = new Date(patch.publishedAt)
    patch.publishedAt = Number.isNaN(when.valueOf()) ? new Date() : when
  }
  if ('imageMediaId' in patch && !/^[a-f\d]{24}$/i.test(patch.imageMediaId || '')) patch.imageMediaId = null
  if ('featured' in patch) patch.featured = Boolean(patch.featured)
  if ('sticky' in patch) patch.sticky = Boolean(patch.sticky)
  if ('allowComments' in patch) patch.allowComments = Boolean(patch.allowComments)
  if ('seo' in patch) {
    patch.seo = {
      metaTitle: str(patch.seo?.metaTitle, 300),
      metaDescription: str(patch.seo?.metaDescription, 500),
      canonicalUrl: str(patch.seo?.canonicalUrl, 2000),
      ogImage: str(patch.seo?.ogImage, 2000),
      focusKeyword: str(patch.seo?.focusKeyword, 120),
      noIndex: Boolean(patch.seo?.noIndex),
    }
  }
  // A password only means anything while visibility says so, and clearing the
  // visibility has to clear the secret with it.
  if (patch.visibility && patch.visibility !== 'Password') patch.password = ''
  else if ('password' in patch) patch.password = str(patch.password, 200)
  return patch
}

/** "Published, but dated in the future" is what WordPress calls Scheduled. */
function normaliseSchedule(patch, current = {}) {
  const status = patch.status ?? current.status
  const when = patch.publishedAt ?? current.publishedAt
  if (!when || !['Published', 'Scheduled'].includes(status)) return patch
  patch.status = new Date(when).getTime() > Date.now() ? 'Scheduled' : 'Published'
  return patch
}

const revision = (post, user, autosave = false) =>
  Object.fromEntries(
    REVISION_FIELDS.map((key) => [key, post[key]]).concat([
      ['savedAt', new Date()],
      ['savedBy', user?.name || 'Admin'],
      ['autosave', autosave],
    ]),
  )

/* ------------------------------- list screen ------------------------------ */

router.get('/', asyncHandler(async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : ''
  const filter = status ? { status } : { status: { $ne: 'Trash' } }
  if (req.query.category) filter.$or = [{ category: req.query.category }, { categories: req.query.category }]
  if (req.query.tag) filter.tags = req.query.tag
  if (req.query.author) filter['author.name'] = req.query.author
  if (req.query.q?.trim()) {
    const q = rx(req.query.q.trim())
    filter.$and = [{ $or: [{ title: q }, { slug: q }, { excerpt: q }, { category: q }, { tags: q }] }]
  }
  // `m` is a YYYYMM archive key, exactly like WordPress's date dropdown.
  if (/^\d{6}$/.test(req.query.m || '')) {
    const year = Number(req.query.m.slice(0, 4))
    const month = Number(req.query.m.slice(4)) - 1
    filter.publishedAt = { $gte: new Date(year, month, 1), $lt: new Date(year, month + 1, 1) }
  }

  const perPage = Math.min(Math.max(Number(req.query.perPage) || 20, 1), 200)
  const page = Math.max(Number(req.query.page) || 1, 1)
  const key = SORTABLE[req.query.orderby] || 'publishedAt'
  const direction = req.query.order === 'asc' ? 1 : -1

  const [items, total, statusCounts, months, authors] = await Promise.all([
    BlogPost.find(filter)
      .select('-body -revisions -password')
      .sort({ [key]: direction, _id: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean(),
    BlogPost.countDocuments(filter),
    BlogPost.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    BlogPost.aggregate([
      { $match: { status: { $ne: 'Trash' } } },
      { $group: { _id: { $dateToString: { date: '$publishedAt', format: '%Y%m' } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 60 },
    ]),
    BlogPost.distinct('author.name', { status: { $ne: 'Trash' } }),
  ])

  const comments = items.length
    ? await BlogComment.aggregate([
        { $match: { postId: { $in: items.map((post) => post._id) }, status: { $ne: 'Trash' } } },
        { $group: { _id: { post: '$postId', status: '$status' }, count: { $sum: 1 } } },
      ])
    : []
  const commentCounts = {}
  for (const row of comments) {
    const entry = (commentCounts[row._id.post] ||= { total: 0, pending: 0 })
    entry.total += row.count
    if (row._id.status === 'Pending') entry.pending += row.count
  }

  const byStatus = Object.fromEntries(statusCounts.map((row) => [row._id || 'Draft', row.count]))
  const counts = {
    all: STATUSES.filter((s) => s !== 'Trash').reduce((sum, s) => sum + (byStatus[s] || 0), 0),
    ...Object.fromEntries(STATUSES.map((s) => [s, byStatus[s] || 0])),
  }

  res.json({
    items,
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    counts,
    commentCounts,
    authors: authors.filter(Boolean),
    months: months.filter((m) => m._id).map((m) => ({ key: m._id, count: m.count })),
  })
}))

/* -------------------------------- comments -------------------------------- */
/* Declared before `/:id` so "comments" is never read as a post id. */

const COMMENT_STATUSES = ['Pending', 'Approved', 'Spam', 'Trash']

router.get('/comments', asyncHandler(async (req, res) => {
  const status = COMMENT_STATUSES.includes(req.query.status) ? req.query.status : ''
  const filter = status ? { status } : { status: { $ne: 'Trash' } }
  if (/^[a-f\d]{24}$/i.test(req.query.postId || '')) filter.postId = req.query.postId
  if (req.query.q?.trim()) {
    const q = rx(req.query.q.trim())
    filter.$or = [{ name: q }, { email: q }, { body: q }]
  }

  const perPage = Math.min(Math.max(Number(req.query.perPage) || 20, 1), 200)
  const page = Math.max(Number(req.query.page) || 1, 1)

  const [items, total, grouped] = await Promise.all([
    BlogComment.find(filter)
      .populate('postId', 'title slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean(),
    BlogComment.countDocuments(filter),
    BlogComment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ])

  const byStatus = Object.fromEntries(grouped.map((row) => [row._id, row.count]))
  res.json({
    items,
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    counts: {
      all: COMMENT_STATUSES.filter((s) => s !== 'Trash').reduce((sum, s) => sum + (byStatus[s] || 0), 0),
      ...Object.fromEntries(COMMENT_STATUSES.map((s) => [s, byStatus[s] || 0])),
    },
  })
}))

router.post('/comments/bulk', asyncHandler(async (req, res) => {
  const ids = idList(req.body?.ids)
  const action = req.body?.action
  if (!ids.length) throw new HttpError(400, 'Select at least one comment')

  if (action === 'delete') {
    const { deletedCount } = await BlogComment.deleteMany({ _id: { $in: ids } })
    return res.json({ ok: true, affected: deletedCount })
  }
  if (action === 'trash') {
    const rows = await BlogComment.find({ _id: { $in: ids } }).select('status').lean()
    await BlogComment.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { status: 'Trash', statusBeforeTrash: row.status } },
        },
      })),
    )
    return res.json({ ok: true, affected: rows.length })
  }
  if (action === 'restore') {
    const rows = await BlogComment.find({ _id: { $in: ids }, status: 'Trash' }).select('statusBeforeTrash').lean()
    await BlogComment.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: { status: COMMENT_STATUSES.includes(row.statusBeforeTrash) ? row.statusBeforeTrash : 'Pending' },
            $unset: { statusBeforeTrash: '' },
          },
        },
      })),
    )
    return res.json({ ok: true, affected: rows.length })
  }

  const target = { approve: 'Approved', unapprove: 'Pending', spam: 'Spam', unspam: 'Pending' }[action]
  if (!target) throw new HttpError(400, 'Choose a bulk action')
  const { modifiedCount } = await BlogComment.updateMany({ _id: { $in: ids } }, { $set: { status: target } })
  res.json({ ok: true, affected: modifiedCount })
}))

router.post('/comments/empty-trash', asyncHandler(async (_req, res) => {
  const { deletedCount } = await BlogComment.deleteMany({ status: 'Trash' })
  res.json({ ok: true, affected: deletedCount })
}))

router.post('/comments/:commentId/reply', asyncHandler(async (req, res) => {
  const parent = await BlogComment.findById(req.params.commentId).lean()
  if (!parent) throw new HttpError(404, 'Comment not found')
  const body = str(req.body?.body, 4000)
  if (!body) throw new HttpError(400, 'Write a reply first')
  const reply = await BlogComment.create({
    postId: parent.postId,
    parentId: parent._id,
    name: req.user?.name || 'Admin',
    email: req.user?.email || 'admin@localhost',
    body,
    status: 'Approved',
    byAdmin: true,
  })
  // Replying is an implicit approval of what is being replied to.
  if (parent.status === 'Pending') {
    await BlogComment.updateOne({ _id: parent._id }, { $set: { status: 'Approved' } })
  }
  res.status(201).json(reply)
}))

router.put('/comments/:commentId', asyncHandler(async (req, res) => {
  const comment = await BlogComment.findById(req.params.commentId)
  if (!comment) throw new HttpError(404, 'Comment not found')

  if ('status' in (req.body || {})) {
    if (!COMMENT_STATUSES.includes(req.body.status)) throw new HttpError(400, 'Choose a valid comment status')
    if (req.body.status === 'Trash' && comment.status !== 'Trash') comment.statusBeforeTrash = comment.status
    comment.status = req.body.status
  }
  if ('name' in (req.body || {})) comment.name = str(req.body.name, 100) || comment.name
  if ('email' in (req.body || {})) comment.email = str(req.body.email, 254) || comment.email
  if ('website' in (req.body || {})) comment.website = str(req.body.website, 254)
  if ('body' in (req.body || {})) {
    const body = str(req.body.body, 4000)
    if (!body) throw new HttpError(400, 'A comment cannot be empty')
    comment.body = body
  }
  await comment.save()
  res.json(comment)
}))

router.delete('/comments/:commentId', asyncHandler(async (req, res) => {
  const comment = await BlogComment.findByIdAndDelete(req.params.commentId)
  if (!comment) throw new HttpError(404, 'Comment not found')
  await BlogComment.deleteMany({ parentId: comment._id })
  res.json({ ok: true })
}))

/* ------------------------------- bulk + trash ----------------------------- */

router.post('/bulk', asyncHandler(async (req, res) => {
  const ids = idList(req.body?.ids)
  const action = req.body?.action
  if (!ids.length) throw new HttpError(400, 'Select at least one post')

  if (action === 'delete') {
    const posts = await BlogPost.find({ _id: { $in: ids } }).select('_id').lean()
    await BlogPost.deleteMany({ _id: { $in: ids } })
    await BlogComment.deleteMany({ postId: { $in: posts.map((p) => p._id) } })
    return res.json({ ok: true, affected: posts.length })
  }
  if (action === 'trash') {
    const rows = await BlogPost.find({ _id: { $in: ids }, status: { $ne: 'Trash' } }).select('status').lean()
    await BlogPost.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: { $set: { status: 'Trash', statusBeforeTrash: row.status, trashedAt: new Date() } },
        },
      })),
    )
    return res.json({ ok: true, affected: rows.length })
  }
  if (action === 'restore') {
    const rows = await BlogPost.find({ _id: { $in: ids }, status: 'Trash' }).select('statusBeforeTrash').lean()
    await BlogPost.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: { status: STATUSES.includes(row.statusBeforeTrash) ? row.statusBeforeTrash : 'Draft' },
            $unset: { statusBeforeTrash: '', trashedAt: '' },
          },
        },
      })),
    )
    return res.json({ ok: true, affected: rows.length })
  }
  if (action === 'edit') {
    // WordPress's bulk-edit row: only the fields the operator actually filled in.
    const patch = {}
    const add = {}
    if (STATUSES.includes(req.body?.status)) patch.status = req.body.status
    if (str(req.body?.category)) patch.category = str(req.body.category, 120)
    if (req.body?.allowComments === 'open') patch.allowComments = true
    if (req.body?.allowComments === 'closed') patch.allowComments = false
    if (req.body?.sticky === 'sticky') patch.featured = true
    if (req.body?.sticky === 'unsticky') patch.featured = false
    const tags = cleanStrings(req.body?.addTags)
    if (tags.length) add.tags = { $each: tags }
    if (!Object.keys(patch).length && !Object.keys(add).length) {
      throw new HttpError(400, 'Nothing to change — fill in at least one field')
    }
    const update = { ...(Object.keys(patch).length ? { $set: patch } : {}), ...(Object.keys(add).length ? { $addToSet: add } : {}) }
    const { modifiedCount } = await BlogPost.updateMany({ _id: { $in: ids } }, update)
    return res.json({ ok: true, affected: modifiedCount })
  }
  throw new HttpError(400, 'Choose a bulk action')
}))

router.post('/empty-trash', asyncHandler(async (_req, res) => {
  const posts = await BlogPost.find({ status: 'Trash' }).select('_id').lean()
  await BlogPost.deleteMany({ status: 'Trash' })
  await BlogComment.deleteMany({ postId: { $in: posts.map((p) => p._id) } })
  res.json({ ok: true, affected: posts.length })
}))

/* ----------------------------- import / export ---------------------------- */
/* Also before `/:id`, for the same reason the comment routes are. */

router.get('/export', asyncHandler(async (req, res) => {
  const filter = STATUSES.includes(req.query.status) ? { status: req.query.status } : { status: { $ne: 'Trash' } }
  const posts = await BlogPost.find(filter).select('-revisions -password -__v').sort({ publishedAt: -1 }).lean()
  res.json({
    generator: 'Growth Scholar Blog',
    exportedAt: new Date().toISOString(),
    count: posts.length,
    posts,
  })
}))

/**
 * Restores an export file. Posts are matched on slug so re-importing the same
 * file updates rather than duplicating, which is what makes the export usable
 * as a backup rather than only as a one-way copy.
 */
router.post('/import', asyncHandler(async (req, res) => {
  const incoming = Array.isArray(req.body?.posts) ? req.body.posts : []
  if (!incoming.length) throw new HttpError(400, 'That file contains no posts')
  if (incoming.length > 500) throw new HttpError(400, 'Import at most 500 posts at a time')

  let created = 0
  let updated = 0
  let skipped = 0

  for (const raw of incoming) {
    const patch = patchFrom(raw)
    if (!patch.title) {
      skipped += 1
      continue
    }
    patch.body ||= []
    if (!str(patch.readTime)) patch.readTime = minutesFor(patch.body)
    patch.author = raw.author?.name ? raw.author : { name: req.user.name, role: 'Editorial' }
    normaliseSchedule(patch)

    const existing = raw.slug ? await BlogPost.findOne({ slug: slugify(raw.slug) }) : null
    if (existing) {
      if (req.body?.mode === 'skip') {
        skipped += 1
        continue
      }
      Object.assign(existing, patch)
      await existing.save()
      updated += 1
    } else {
      await BlogPost.create({ ...patch, slug: await uniqueSlug(raw.slug || patch.title) })
      created += 1
    }
  }

  res.json({ ok: true, created, updated, skipped })
}))

/* --------------------------------- single --------------------------------- */

router.post('/', asyncHandler(async (req, res) => {
  const patch = patchFrom(req.body)
  patch.title ||= '(no title)'
  patch.slug = await uniqueSlug(req.body.slug || patch.title)
  patch.author = patch.author?.name
    ? patch.author
    : { name: req.user.name, avatar: req.user.avatarInitials, role: 'Editorial' }
  patch.body ||= []
  patch.publishedAt ||= new Date()
  patch.status ||= 'Draft'
  if (!str(patch.readTime)) patch.readTime = minutesFor(patch.body)
  normaliseSchedule(patch)
  res.status(201).json(await BlogPost.create(patch))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id).lean()
  if (!post) throw new HttpError(404, 'Post not found')
  res.json(post)
}))

router.get('/:id/comments', asyncHandler(async (req, res) => {
  const items = await BlogComment.find({ postId: req.params.id, status: { $ne: 'Trash' } })
    .sort({ createdAt: -1 })
    .lean()
  res.json({ items })
}))

router.put('/:id', asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id)
  if (!post) throw new HttpError(404, 'Post not found')

  const patch = patchFrom(req.body)
  if ('title' in patch && !patch.title) patch.title = '(no title)'
  // The slug only follows the title while the post has never been published —
  // after that, changing it silently would break every shared link.
  if ('slug' in req.body) {
    patch.slug = await uniqueSlug(str(req.body.slug) || patch.title || post.title, post._id)
  }
  if ('body' in patch && !str(patch.readTime)) patch.readTime = minutesFor(patch.body)
  normaliseSchedule(patch, post)

  // An autosave overwrites the rolling autosave entry instead of burying the
  // manual save points an editor actually wants to go back to.
  const autosave = req.query.autosave === 'true'
  const history = (post.revisions || []).filter((entry) => !(autosave && entry.autosave))
  post.revisions = [revision(post, req.user, autosave), ...history].slice(0, 25)

  Object.assign(post, patch)
  await post.save()
  res.json(post)
}))

router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id).lean()
  if (!post) throw new HttpError(404, 'Post not found')
  // Everything except the identity and the history of the original.
  const { _id: _omitId, createdAt: _omitCreated, updatedAt: _omitUpdated, revisions: _omitRevisions, ...rest } = post
  const copy = await BlogPost.create({
    ...rest,
    title: `${post.title} (copy)`,
    slug: await uniqueSlug(`${post.slug}-copy`),
    status: 'Draft',
    featured: false,
    revisions: [],
    trashedAt: undefined,
    statusBeforeTrash: undefined,
  })
  res.status(201).json(copy)
}))

router.post('/:id/trash', asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id)
  if (!post) throw new HttpError(404, 'Post not found')
  if (post.status !== 'Trash') {
    post.statusBeforeTrash = post.status
    post.status = 'Trash'
    post.trashedAt = new Date()
    await post.save()
  }
  res.json(post)
}))

router.post('/:id/restore', asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id)
  if (!post) throw new HttpError(404, 'Post not found')
  post.status = STATUSES.includes(post.statusBeforeTrash) ? post.statusBeforeTrash : 'Draft'
  post.statusBeforeTrash = undefined
  post.trashedAt = undefined
  await post.save()
  res.json(post)
}))

router.post('/:id/revisions/:revisionId/restore', asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id)
  if (!post) throw new HttpError(404, 'Post not found')
  const saved = post.revisions.id(req.params.revisionId)
  if (!saved) throw new HttpError(404, 'Revision not found')
  post.revisions = [revision(post, req.user), ...(post.revisions || [])].slice(0, 25)
  for (const field of REVISION_FIELDS) post[field] = saved[field]
  await post.save()
  res.json(post)
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const post = await BlogPost.findByIdAndDelete(req.params.id)
  if (!post) throw new HttpError(404, 'Post not found')
  await BlogComment.deleteMany({ postId: post._id })
  res.json({ ok: true })
}))

export default router
