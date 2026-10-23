import crypto from 'node:crypto'
import { Router } from 'express'
import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  ne,
  or,
  param,
  sql,
} from 'drizzle-orm'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { db, withMongoId } from '../../db/index.js'
import { isUuid } from '../../db/coerce.js'
import { BLOCK_TYPES, blogComments, blogPosts, media } from '../../db/schema/index.js'
import { withoutColumns } from '../../db/repos/blog.js'
import { pickColumns } from '../../db/repos/content.js'
import { slugify } from '../../services/taxonomy.js'
import { safeContentChanged } from '../../services/contentEvents.js'

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
const SORTABLE = {
  title: blogPosts.title,
  date: blogPosts.publishedAt,
  modified: blogPosts.updatedAt,
  author: sql`${blogPosts.author}->>'name'`,
}

const WRITABLE = new Set([
  'title',
  'slug',
  'category',
  'categories',
  'tags',
  'excerpt',
  'body',
  'author',
  'publishedAt',
  'readTime',
  'status',
  'featured',
  'sticky',
  'allowComments',
  'image',
  'imageAlt',
  'heroClass',
  'heroLabel',
  'seo',
  'visibility',
  'password',
  'imageMediaId',
  'imageWidth',
  'imageHeight',
])
const REVISION_FIELDS = [
  'title',
  'slug',
  'excerpt',
  'body',
  'category',
  'categories',
  'tags',
  'image',
  'imageAlt',
  'heroClass',
  'heroLabel',
  'featured',
  'status',
  'publishedAt',
  'readTime',
  'seo',
]

const likeOf = (value) => `%${String(value).replace(/[\\%_]/g, (c) => `\\${c}`)}%`
const str = (value, max = 500) =>
  String(value ?? '')
    .trim()
    .slice(0, max)
const cleanStrings = (value) =>
  Array.isArray(value) ? [...new Set(value.map((v) => str(v, 120)).filter(Boolean))] : []
const idList = (value) =>
  (Array.isArray(value) ? value : []).map((id) => String(id)).filter((id) => isUuid(id))

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
    if (isUuid(raw?.mediaId || '')) block.mediaId = raw.mediaId
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
        cells: (Array.isArray(row?.cells) ? row.cells : [])
          .slice(0, 12)
          .map((cell) => str(cell, 500)),
      }))
    }
    return block
  })
}

const wordsIn = (body) =>
  body.reduce((total, block) => {
    const rows = (block.rows || []).flatMap((row) => row.cells || [])
    const text = [block.text, block.caption, ...(block.items || []), ...rows]
      .filter(Boolean)
      .join(' ')
    return total + text.trim().split(/\s+/).filter(Boolean).length
  }, 0)

const minutesFor = (body) => `${Math.max(1, Math.ceil(wordsIn(body) / 220))} min read`

async function uniqueSlug(input, exceptId) {
  const base = slugify(input) || 'post'
  for (let n = 1; n < 200; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`
    const [exists] = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(and(eq(blogPosts.slug, candidate), exceptId ? ne(blogPosts.id, exceptId) : undefined))
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
  if ('imageMediaId' in patch && !isUuid(patch.imageMediaId || '')) patch.imageMediaId = null
  if ('imageWidth' in patch) patch.imageWidth = Number(patch.imageWidth) || null
  if ('imageHeight' in patch) patch.imageHeight = Number(patch.imageHeight) || null
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

/**
 * A history entry. Revisions live in a jsonb array, so each carries its own
 * `_id` — the id the restore endpoint addresses it by, which Mongo's embedded
 * subdocuments used to provide.
 */
const revision = (post, user, autosave = false) =>
  Object.fromEntries(
    REVISION_FIELDS.map((key) => [key, post[key]]).concat([
      ['_id', crypto.randomUUID()],
      ['savedAt', new Date()],
      ['savedBy', user?.name || 'Admin'],
      ['autosave', autosave],
    ]),
  )

/*
 * Content-change events (services/contentEvents.js): the sitemap and the edge
 * cache follow every write that can change what a visitor sees. A post is on
 * the public site only while Published or Scheduled (repos/blog.js has the
 * full rule), so a write fires when the post was in one of those states
 * before it or is after it — editing a draft purges nothing.
 */
const PUBLIC_STATUSES = new Set(['Published', 'Scheduled'])
const mayBePublic = (post) => Boolean(post) && PUBLIC_STATUSES.has(post.status)

/** One event for every listed post that is, or just was, public. */
function postsChanged(...posts) {
  const slugs = [...new Set(posts.filter(mayBePublic).map((p) => p.slug))]
  return slugs.length ? safeContentChanged({ kind: 'post', slugs }) : undefined
}

/** A single post's write: `before` and `after` are the row either side of it. */
function postChanged(before, after) {
  if (!mayBePublic(before) && !mayBePublic(after)) return undefined
  // Under its old slug too, when the write renamed it.
  return postsChanged({ ...before, status: 'Published' }, { ...after, status: 'Published' })
}

async function findPost(id) {
  if (!isUuid(id)) return null
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id))
  return row || null
}

async function savePost(id, values) {
  const [row] = await db.update(blogPosts).set(values).where(eq(blogPosts.id, id)).returning()
  return withMongoId(row)
}

/* ------------------------------- list screen ------------------------------ */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const status = STATUSES.includes(req.query.status) ? req.query.status : ''
    const clauses = [status ? eq(blogPosts.status, status) : ne(blogPosts.status, 'Trash')]
    if (req.query.category) {
      const category = String(req.query.category)
      clauses.push(
        or(eq(blogPosts.category, category), arrayContains(blogPosts.categories, [category])),
      )
    }
    if (req.query.tag) clauses.push(arrayContains(blogPosts.tags, [String(req.query.tag)]))
    if (req.query.author)
      clauses.push(sql`${blogPosts.author}->>'name' = ${String(req.query.author)}`)
    if (req.query.q?.trim()) {
      const q = likeOf(req.query.q.trim())
      clauses.push(
        or(
          ilike(blogPosts.title, q),
          ilike(blogPosts.slug, q),
          ilike(blogPosts.excerpt, q),
          ilike(blogPosts.category, q),
          sql`exists (select 1 from unnest(${blogPosts.tags}) t where t ilike ${q})`,
        ),
      )
    }
    // `m` is a YYYYMM archive key, exactly like WordPress's date dropdown.
    if (/^\d{6}$/.test(req.query.m || '')) {
      const year = Number(req.query.m.slice(0, 4))
      const month = Number(req.query.m.slice(4)) - 1
      clauses.push(
        gte(blogPosts.publishedAt, new Date(year, month, 1)),
        lt(blogPosts.publishedAt, new Date(year, month + 1, 1)),
      )
    }
    const where = and(...clauses)

    const perPage = Math.min(Math.max(Number(req.query.perPage) || 20, 1), 200)
    const page = Math.max(Number(req.query.page) || 1, 1)
    const key = SORTABLE[req.query.orderby] || blogPosts.publishedAt
    const direction = req.query.order === 'asc' ? asc : desc
    const notTrash = ne(blogPosts.status, 'Trash')
    // UTC, as Mongo's $dateToString was, so the archive keys do not move with
    // the server's time zone.
    const monthKey = sql`to_char(${blogPosts.publishedAt} at time zone 'UTC', 'YYYYMM')`

    const [items, [{ total }], statusCounts, months, authors] = await Promise.all([
      db
        .select(withoutColumns(['body', 'revisions', 'password']))
        .from(blogPosts)
        .where(where)
        .orderBy(direction(key), desc(blogPosts.id))
        .offset((page - 1) * perPage)
        .limit(perPage),
      db.select({ total: count() }).from(blogPosts).where(where),
      db
        .select({ status: blogPosts.status, count: count() })
        .from(blogPosts)
        .groupBy(blogPosts.status),
      db
        .select({ key: monthKey.as('key'), count: count() })
        .from(blogPosts)
        .where(notTrash)
        .groupBy(monthKey)
        .orderBy(desc(monthKey))
        .limit(60),
      db
        .selectDistinct({ name: sql`${blogPosts.author}->>'name'` })
        .from(blogPosts)
        .where(notTrash),
    ])

    const comments = items.length
      ? await db
          .select({ post: blogComments.postId, status: blogComments.status, count: count() })
          .from(blogComments)
          .where(
            and(
              inArray(
                blogComments.postId,
                items.map((post) => post.id),
              ),
              ne(blogComments.status, 'Trash'),
            ),
          )
          .groupBy(blogComments.postId, blogComments.status)
      : []
    const commentCounts = {}
    for (const row of comments) {
      const entry = (commentCounts[row.post] ||= { total: 0, pending: 0 })
      entry.total += row.count
      if (row.status === 'Pending') entry.pending += row.count
    }

    const byStatus = Object.fromEntries(
      statusCounts.map((row) => [row.status || 'Draft', row.count]),
    )
    const counts = {
      all: STATUSES.filter((s) => s !== 'Trash').reduce((sum, s) => sum + (byStatus[s] || 0), 0),
      ...Object.fromEntries(STATUSES.map((s) => [s, byStatus[s] || 0])),
    }

    res.json({
      items: withMongoId(items),
      total,
      page,
      perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
      counts,
      commentCounts,
      authors: authors.map((a) => a.name).filter(Boolean),
      months: months.filter((m) => m.key).map((m) => ({ key: m.key, count: m.count })),
    })
  }),
)

/* -------------------------------- comments -------------------------------- */
/* Declared before `/:id` so "comments" is never read as a post id. */

const COMMENT_STATUSES = ['Pending', 'Approved', 'Spam', 'Trash']

router.get(
  '/comments',
  asyncHandler(async (req, res) => {
    const status = COMMENT_STATUSES.includes(req.query.status) ? req.query.status : ''
    const clauses = [status ? eq(blogComments.status, status) : ne(blogComments.status, 'Trash')]
    if (isUuid(req.query.postId || '')) clauses.push(eq(blogComments.postId, req.query.postId))
    if (req.query.q?.trim()) {
      const q = likeOf(req.query.q.trim())
      clauses.push(
        or(ilike(blogComments.name, q), ilike(blogComments.email, q), ilike(blogComments.body, q)),
      )
    }
    const where = and(...clauses)

    const perPage = Math.min(Math.max(Number(req.query.perPage) || 20, 1), 200)
    const page = Math.max(Number(req.query.page) || 1, 1)

    const [rows, [{ total }], grouped] = await Promise.all([
      // The post is joined in as `postId: { _id, title, slug }`, the shape the
      // Mongo `populate` produced and the comments screen reads.
      db
        .select({ comment: blogComments, post: pickColumns(blogPosts, 'title slug') })
        .from(blogComments)
        .leftJoin(blogPosts, eq(blogPosts.id, blogComments.postId))
        .where(where)
        .orderBy(desc(blogComments.createdAt))
        .offset((page - 1) * perPage)
        .limit(perPage),
      db.select({ total: count() }).from(blogComments).where(where),
      db
        .select({ status: blogComments.status, count: count() })
        .from(blogComments)
        .groupBy(blogComments.status),
    ])

    const byStatus = Object.fromEntries(grouped.map((row) => [row.status, row.count]))
    res.json({
      items: rows.map(({ comment, post }) =>
        withMongoId({ ...comment, postId: post?.id ? post : null }),
      ),
      total,
      page,
      perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
      counts: {
        all: COMMENT_STATUSES.filter((s) => s !== 'Trash').reduce(
          (sum, s) => sum + (byStatus[s] || 0),
          0,
        ),
        ...Object.fromEntries(COMMENT_STATUSES.map((s) => [s, byStatus[s] || 0])),
      },
    })
  }),
)

router.post(
  '/comments/bulk',
  asyncHandler(async (req, res) => {
    const ids = idList(req.body?.ids)
    const action = req.body?.action
    if (!ids.length) throw new HttpError(400, 'Select at least one comment')
    const selected = inArray(blogComments.id, ids)

    if (action === 'delete') {
      const rows = await db.delete(blogComments).where(selected).returning({ id: blogComments.id })
      return res.json({ ok: true, affected: rows.length })
    }
    if (action === 'trash') {
      // Remember where each one came from, in the same statement that moves it.
      const rows = await db
        .update(blogComments)
        .set({ status: 'Trash', statusBeforeTrash: sql`${blogComments.status}` })
        .where(selected)
        .returning({ id: blogComments.id })
      return res.json({ ok: true, affected: rows.length })
    }
    if (action === 'restore') {
      const rows = await db
        .update(blogComments)
        .set({
          status: sql`case when ${blogComments.statusBeforeTrash} in ('Pending', 'Approved', 'Spam', 'Trash')
                        then ${blogComments.statusBeforeTrash} else 'Pending' end`,
          statusBeforeTrash: null,
        })
        .where(and(selected, eq(blogComments.status, 'Trash')))
        .returning({ id: blogComments.id })
      return res.json({ ok: true, affected: rows.length })
    }

    const target = { approve: 'Approved', unapprove: 'Pending', spam: 'Spam', unspam: 'Pending' }[
      action
    ]
    if (!target) throw new HttpError(400, 'Choose a bulk action')
    // Rows already in the target state are not "modified", as Mongo counted it.
    const rows = await db
      .update(blogComments)
      .set({ status: target })
      .where(and(selected, ne(blogComments.status, target)))
      .returning({ id: blogComments.id })
    res.json({ ok: true, affected: rows.length })
  }),
)

router.post(
  '/comments/empty-trash',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .delete(blogComments)
      .where(eq(blogComments.status, 'Trash'))
      .returning({ id: blogComments.id })
    res.json({ ok: true, affected: rows.length })
  }),
)

async function findComment(id) {
  if (!isUuid(id)) return null
  const [row] = await db.select().from(blogComments).where(eq(blogComments.id, id))
  return row || null
}

router.post(
  '/comments/:commentId/reply',
  asyncHandler(async (req, res) => {
    const parent = await findComment(req.params.commentId)
    if (!parent) throw new HttpError(404, 'Comment not found')
    const body = str(req.body?.body, 4000)
    if (!body) throw new HttpError(400, 'Write a reply first')
    const reply = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(blogComments)
        .values({
          postId: parent.postId,
          parentId: parent.id,
          name: req.user?.name || 'Admin',
          email: req.user?.email || 'admin@localhost',
          body,
          status: 'Approved',
          byAdmin: true,
        })
        .returning()
      // Replying is an implicit approval of what is being replied to.
      if (parent.status === 'Pending') {
        await tx
          .update(blogComments)
          .set({ status: 'Approved' })
          .where(eq(blogComments.id, parent.id))
      }
      return row
    })
    res.status(201).json(withMongoId(reply))
  }),
)

router.put(
  '/comments/:commentId',
  asyncHandler(async (req, res) => {
    const comment = await findComment(req.params.commentId)
    if (!comment) throw new HttpError(404, 'Comment not found')

    const patch = {}
    if ('status' in (req.body || {})) {
      if (!COMMENT_STATUSES.includes(req.body.status)) {
        throw new HttpError(400, 'Choose a valid comment status')
      }
      if (req.body.status === 'Trash' && comment.status !== 'Trash') {
        patch.statusBeforeTrash = comment.status
      }
      patch.status = req.body.status
    }
    if ('name' in (req.body || {})) patch.name = str(req.body.name, 100) || comment.name
    if ('email' in (req.body || {})) patch.email = str(req.body.email, 254) || comment.email
    if ('website' in (req.body || {})) patch.website = str(req.body.website, 254)
    if ('body' in (req.body || {})) {
      const body = str(req.body.body, 4000)
      if (!body) throw new HttpError(400, 'A comment cannot be empty')
      patch.body = body
    }
    const [row] = Object.keys(patch).length
      ? await db.update(blogComments).set(patch).where(eq(blogComments.id, comment.id)).returning()
      : [comment]
    res.json(withMongoId(row))
  }),
)

router.delete(
  '/comments/:commentId',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.commentId)) throw new HttpError(404, 'Comment not found')
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(blogComments)
        .where(eq(blogComments.id, req.params.commentId))
        .returning({ id: blogComments.id })
      // `parentId` carries no foreign key (a reply may outlive a moderated
      // parent elsewhere), so its replies are removed explicitly.
      if (row) await tx.delete(blogComments).where(eq(blogComments.parentId, row.id))
      return row
    })
    if (!removed) throw new HttpError(404, 'Comment not found')
    res.json({ ok: true })
  }),
)

/* ------------------------------- bulk + trash ----------------------------- */

router.post(
  '/bulk',
  asyncHandler(async (req, res) => {
    const ids = idList(req.body?.ids)
    const action = req.body?.action
    if (!ids.length) throw new HttpError(400, 'Select at least one post')
    const selected = inArray(blogPosts.id, ids)
    const touched = { id: blogPosts.id, slug: blogPosts.slug, status: blogPosts.status }
    // As they were, so a post leaving the public site is purged too.
    const before = await db.select(touched).from(blogPosts).where(selected)
    const done = async (rows) => {
      const affected = new Set(rows.map((r) => r.id))
      await postsChanged(...before.filter((r) => affected.has(r.id)), ...rows)
      return res.json({ ok: true, affected: rows.length })
    }

    if (action === 'delete') {
      // Comments go with their post via the foreign key cascade.
      const rows = await db.delete(blogPosts).where(selected).returning(touched)
      // Deleted rows are gone, whatever `returning` says their status was.
      return done(rows.map((r) => ({ ...r, status: 'Trash' })))
    }
    if (action === 'trash') {
      const rows = await db
        .update(blogPosts)
        .set({
          status: 'Trash',
          statusBeforeTrash: sql`${blogPosts.status}`,
          trashedAt: new Date(),
        })
        .where(and(selected, ne(blogPosts.status, 'Trash')))
        .returning(touched)
      return done(rows)
    }
    if (action === 'restore') {
      const rows = await db
        .update(blogPosts)
        .set({
          status: sql`case when ${blogPosts.statusBeforeTrash} in ('Draft', 'Pending', 'Published', 'Scheduled', 'Archived', 'Trash')
                        then ${blogPosts.statusBeforeTrash} else 'Draft' end`,
          statusBeforeTrash: null,
          trashedAt: null,
        })
        .where(and(selected, eq(blogPosts.status, 'Trash')))
        .returning(touched)
      return done(rows)
    }
    if (action === 'edit') {
      // WordPress's bulk-edit row: only the fields the operator actually filled in.
      const patch = {}
      if (STATUSES.includes(req.body?.status)) patch.status = req.body.status
      if (str(req.body?.category)) patch.category = str(req.body.category, 120)
      if (req.body?.allowComments === 'open') patch.allowComments = true
      if (req.body?.allowComments === 'closed') patch.allowComments = false
      if (req.body?.sticky === 'sticky') patch.featured = true
      if (req.body?.sticky === 'unsticky') patch.featured = false
      const tags = cleanStrings(req.body?.addTags)
      if (!Object.keys(patch).length && !tags.length) {
        throw new HttpError(400, 'Nothing to change — fill in at least one field')
      }
      // Set-union, as $addToSet was: existing tags first, new ones appended once.
      if (tags.length) {
        patch.tags = sql`array(select t from unnest(${blogPosts.tags} || ${param(tags)}::text[]) with ordinality u(t, n) group by t order by min(n))`
      }
      const rows = await db.update(blogPosts).set(patch).where(selected).returning(touched)
      return done(rows)
    }
    throw new HttpError(400, 'Choose a bulk action')
  }),
)

router.post(
  '/empty-trash',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .delete(blogPosts)
      .where(eq(blogPosts.status, 'Trash'))
      .returning({ id: blogPosts.id })
    res.json({ ok: true, affected: rows.length })
  }),
)

/* ----------------------------- import / export ---------------------------- */
/* Also before `/:id`, for the same reason the comment routes are. */

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const where = STATUSES.includes(req.query.status)
      ? eq(blogPosts.status, req.query.status)
      : ne(blogPosts.status, 'Trash')
    const posts = await db
      .select(withoutColumns(['revisions', 'password']))
      .from(blogPosts)
      .where(where)
      .orderBy(desc(blogPosts.publishedAt))
    res.json({
      generator: 'Growth Scholar Blog',
      exportedAt: new Date().toISOString(),
      count: posts.length,
      posts: withMongoId(posts),
    })
  }),
)

/**
 * Restores an export file. Posts are matched on slug so re-importing the same
 * file updates rather than duplicating, which is what makes the export usable
 * as a backup rather than only as a one-way copy.
 */
router.post(
  '/import',
  asyncHandler(async (req, res) => {
    const incoming = Array.isArray(req.body?.posts) ? req.body.posts : []
    if (!incoming.length) throw new HttpError(400, 'That file contains no posts')
    if (incoming.length > 500) throw new HttpError(400, 'Import at most 500 posts at a time')

    let created = 0
    let updated = 0
    let skipped = 0
    const changed = []

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
      // An export carries the media ids of the site it came from; on another
      // site they may point at nothing, and a dangling id would fail the
      // foreign key rather than just render no image.
      if (patch.imageMediaId) {
        const [found] = await db
          .select({ id: media.id })
          .from(media)
          .where(eq(media.id, patch.imageMediaId))
        if (!found) patch.imageMediaId = null
      }

      const [existing] = raw.slug
        ? await db
            .select({ id: blogPosts.id, slug: blogPosts.slug, status: blogPosts.status })
            .from(blogPosts)
            .where(eq(blogPosts.slug, slugify(raw.slug)))
        : []
      if (existing) {
        if (req.body?.mode === 'skip') {
          skipped += 1
          continue
        }
        delete patch.slug
        const [row] = await db
          .update(blogPosts)
          .set(patch)
          .where(eq(blogPosts.id, existing.id))
          .returning({ slug: blogPosts.slug, status: blogPosts.status })
        changed.push(existing, row)
        updated += 1
      } else {
        const [row] = await db
          .insert(blogPosts)
          .values({ ...patch, slug: await uniqueSlug(raw.slug || patch.title) })
          .returning({ slug: blogPosts.slug, status: blogPosts.status })
        changed.push(row)
        created += 1
      }
    }

    await postsChanged(...changed)
    res.json({ ok: true, created, updated, skipped })
  }),
)

/* --------------------------------- single --------------------------------- */

router.post(
  '/',
  asyncHandler(async (req, res) => {
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
    const [row] = await db.insert(blogPosts).values(patch).returning()
    // Only a post created already published (or scheduled) is on the site.
    await postsChanged(row)
    res.status(201).json(withMongoId(row))
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    res.json(withMongoId(post))
  }),
)

router.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return res.json({ items: [] })
    const items = await db
      .select()
      .from(blogComments)
      .where(and(eq(blogComments.postId, req.params.id), ne(blogComments.status, 'Trash')))
      .orderBy(desc(blogComments.createdAt))
    res.json({ items: withMongoId(items) })
  }),
)

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')

    const patch = patchFrom(req.body)
    if ('title' in patch && !patch.title) patch.title = '(no title)'
    // The slug only follows the title while the post has never been published —
    // after that, changing it silently would break every shared link.
    if ('slug' in req.body) {
      patch.slug = await uniqueSlug(str(req.body.slug) || patch.title || post.title, post.id)
    }
    if ('body' in patch && !str(patch.readTime)) patch.readTime = minutesFor(patch.body)
    normaliseSchedule(patch, post)

    // An autosave overwrites the rolling autosave entry instead of burying the
    // manual save points an editor actually wants to go back to.
    const autosave = req.query.autosave === 'true'
    const history = (post.revisions || []).filter((entry) => !(autosave && entry.autosave))
    patch.revisions = [revision(post, req.user, autosave), ...history].slice(0, 25)

    // Publishing is an update too: a draft saved as Published fires here.
    const saved = await savePost(post.id, patch)
    await postChanged(post, saved)
    res.json(saved)
  }),
)

router.post(
  '/:id/duplicate',
  asyncHandler(async (req, res) => {
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    // Everything except the identity and the history of the original.
    const {
      id: _omitId,
      legacyId: _omitLegacy,
      createdAt: _omitCreated,
      updatedAt: _omitUpdated,
      revisions: _omitRevisions,
      ...rest
    } = post
    const [copy] = await db
      .insert(blogPosts)
      .values({
        ...rest,
        title: `${post.title} (copy)`,
        slug: await uniqueSlug(`${post.slug}-copy`),
        status: 'Draft',
        featured: false,
        revisions: [],
        trashedAt: null,
        statusBeforeTrash: null,
      })
      .returning()
    res.status(201).json(withMongoId(copy))
  }),
)

router.post(
  '/:id/trash',
  asyncHandler(async (req, res) => {
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    if (post.status !== 'Trash') {
      const saved = await savePost(post.id, {
        statusBeforeTrash: post.status,
        status: 'Trash',
        trashedAt: new Date(),
      })
      await postChanged(post, saved)
      return res.json(saved)
    }
    res.json(withMongoId(post))
  }),
)

router.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    const saved = await savePost(post.id, {
      status: STATUSES.includes(post.statusBeforeTrash) ? post.statusBeforeTrash : 'Draft',
      statusBeforeTrash: null,
      trashedAt: null,
    })
    await postChanged(post, saved)
    res.json(saved)
  }),
)

router.post(
  '/:id/revisions/:revisionId/restore',
  asyncHandler(async (req, res) => {
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    const saved = (post.revisions || []).find(
      (entry) => String(entry._id) === String(req.params.revisionId),
    )
    if (!saved) throw new HttpError(404, 'Revision not found')
    const patch = { revisions: [revision(post, req.user), ...(post.revisions || [])].slice(0, 25) }
    for (const field of REVISION_FIELDS) {
      // jsonb hands dates back as strings; the column wants a Date.
      patch[field] =
        field === 'publishedAt' && saved[field] ? new Date(saved[field]) : (saved[field] ?? null)
    }
    // Never resurrect a slug another post has taken since this revision.
    if (patch.slug && patch.slug !== post.slug) patch.slug = await uniqueSlug(patch.slug, post.id)
    // NOT NULL columns cannot take a revision's missing value.
    for (const key of [
      'title',
      'slug',
      'status',
      'body',
      'categories',
      'tags',
      'featured',
      'seo',
    ]) {
      if (patch[key] === null) delete patch[key]
    }
    const restored = await savePost(post.id, patch)
    await postChanged(post, restored)
    res.json(restored)
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Post not found')
    // Comments go with their post via the foreign key cascade.
    const [row] = await db
      .delete(blogPosts)
      .where(eq(blogPosts.id, req.params.id))
      .returning({ id: blogPosts.id, slug: blogPosts.slug, status: blogPosts.status })
    if (!row) throw new HttpError(404, 'Post not found')
    // `row` is the post as it was: a published post deleted outright is purged.
    await postsChanged(row)
    res.json({ ok: true })
  }),
)

export default router
