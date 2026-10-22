import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { channels, comments, emailLists, posts, reports } from '../src/db/schema/index.js'
import { agent, signUp, signUpAdmin } from './helpers/factories.js'

/**
 * Community moderation and the join tables that replaced embedded arrays.
 *
 * The rule under test is the one services/moderation.js states: every delete is
 * authorised on the server. A hidden button is not access control — user A
 * calling the endpoint directly against user B's post must get a 403.
 */

const as = (cookie) => (method, url) => agent()[method](url).set('Cookie', cookie)

async function channel() {
  const [row] = await db.insert(channels).values({ name: 'General', slug: 'general' }).returning()
  return row
}

async function postAs(cookie, body = 'Hello') {
  const res = await as(cookie)('post', '/api/posts')
    .send({ channelSlug: 'general', body })
    .expect(201)
  return res.body
}

describe('posts and comments', () => {
  it('returns posts with the author populated and likes as ids', async () => {
    await channel()
    const { cookie } = await signUp({ name: 'Asha Rao' })
    const post = await postAs(cookie)
    expect(post.authorId).toMatchObject({ name: 'Asha Rao', avatarInitials: 'AR' })
    expect(post.likes).toEqual([])

    const feed = await agent().get('/api/feed').expect(200)
    expect(feed.body.posts[0].channelId).toMatchObject({ slug: 'general' })
  })

  it('toggles a like and counts it once per member', async () => {
    await channel()
    const { cookie } = await signUp()
    const post = await postAs(cookie)
    const like = () => as(cookie)('post', `/api/posts/${post._id}/like`).expect(200)

    expect((await like()).body).toEqual({ likes: 1, liked: true })
    expect((await like()).body).toEqual({ likes: 0, liked: false })
  })

  it('keeps commentCount in step with comments, floored at zero', async () => {
    await channel()
    const { cookie } = await signUp()
    const post = await postAs(cookie)
    const c = await as(cookie)('post', `/api/posts/${post._id}/comments`)
      .send({ body: 'First' })
      .expect(201)
    expect(c.body.authorId.name).toBeTruthy()

    let [row] = await db.select().from(posts).where(eq(posts.id, post._id))
    expect(row.commentCount).toBe(1)

    await as(cookie)('delete', `/api/comments/${c.body._id}`).expect(200)
    ;[row] = await db.select().from(posts).where(eq(posts.id, post._id))
    expect(row.commentCount).toBe(0)
  })
})

describe('moderation', () => {
  it("refuses to delete someone else's post, but lets an admin", async () => {
    await channel()
    const author = await signUp({ email: 'author@example.in' })
    const other = await signUp({ email: 'other@example.in' })
    const post = await postAs(author.cookie)

    await as(other.cookie)('delete', `/api/posts/${post._id}`).expect(403)
    const admin = await signUpAdmin()
    await as(admin.cookie)('delete', `/api/posts/${post._id}`).expect(200)
  })

  it('deleting a post takes its comments with it', async () => {
    await channel()
    const { cookie } = await signUp()
    const post = await postAs(cookie)
    await as(cookie)('post', `/api/posts/${post._id}/comments`).send({ body: 'x' }).expect(201)

    await as(cookie)('delete', `/api/posts/${post._id}`).expect(200)
    expect(await db.select().from(comments).where(eq(comments.postId, post._id))).toHaveLength(0)
  })

  it('records one report per reporter, and never on your own content', async () => {
    await channel()
    const author = await signUp({ email: 'author@example.in' })
    const reporter = await signUp({ email: 'reporter@example.in' })
    const post = await postAs(author.cookie)
    const report = (cookie) =>
      as(cookie)('post', '/api/reports').send({
        targetType: 'post',
        targetId: post._id,
        reason: 'spam',
      })

    await report(reporter.cookie).expect(201)
    await report(reporter.cookie).expect(201) // answered as success, stored once
    await report(author.cookie).expect(400)
    expect(await db.select().from(reports)).toHaveLength(1)
  })

  it('resolving a report with remove deletes the content and closes it', async () => {
    await channel()
    const author = await signUp({ email: 'author@example.in' })
    const reporter = await signUp({ email: 'reporter@example.in' })
    const post = await postAs(author.cookie)
    await as(reporter.cookie)('post', '/api/reports')
      .send({ targetType: 'post', targetId: post._id })
      .expect(201)

    const admin = await signUpAdmin()
    const queue = await as(admin.cookie)('get', '/api/admin/community/reports').expect(200)
    expect(queue.body.openCount).toBe(1)
    expect(queue.body.items[0].reporterId.email).toBe('reporter@example.in')

    await as(admin.cookie)(
      'post',
      `/api/admin/community/reports/${queue.body.items[0]._id}/resolve`,
    )
      .send({ action: 'remove' })
      .expect(200)
    expect(await db.select().from(posts).where(eq(posts.id, post._id))).toHaveLength(0)
    const [closed] = await db.select().from(reports)
    expect(closed.status).toBe('actioned')
  })

  it('blocking hides each side from the other', async () => {
    await channel()
    const a = await signUp({ email: 'a@example.in' })
    const b = await signUp({ email: 'b@example.in' })
    await postAs(b.cookie, 'from b')

    await as(a.cookie)('post', '/api/blocks').send({ userId: b.user.id }).expect(201)
    await as(a.cookie)('post', '/api/blocks').send({ userId: b.user.id }).expect(201)

    const feedA = await as(a.cookie)('get', '/api/feed').expect(200)
    expect(feedA.body.posts).toHaveLength(0)
    const blocks = await as(a.cookie)('get', '/api/blocks').expect(200)
    expect(blocks.body.items).toHaveLength(1)
    expect(blocks.body.items[0].blockedId.name).toBeTruthy()
  })

  it('deleting a channel removes its posts, their comments and reports', async () => {
    const ch = await channel()
    const author = await signUp({ email: 'author@example.in' })
    const reporter = await signUp({ email: 'reporter@example.in' })
    const post = await postAs(author.cookie)
    await as(author.cookie)('post', `/api/posts/${post._id}/comments`)
      .send({ body: 'x' })
      .expect(201)
    await as(reporter.cookie)('post', '/api/reports')
      .send({ targetType: 'post', targetId: post._id })
      .expect(201)

    const admin = await signUpAdmin()
    const res = await as(admin.cookie)('delete', `/api/admin/community/channels/${ch.id}`).expect(
      200,
    )
    expect(res.body.deleted).toEqual({ posts: 1, comments: 1, reports: 1 })
    expect(await db.select().from(comments)).toHaveLength(0)
  })
})

/** The email module is feature-flagged off in tests; switch it on through the API. */
async function emailAdmin() {
  const admin = await signUpAdmin()
  await as(admin.cookie)('put', '/api/admin/integrations/features')
    .send({ email: true })
    .expect(200)
  return admin
}

describe('email contacts', () => {
  it('keeps list membership as populated listIds and maintains list counts', async () => {
    const [list] = await db.insert(emailLists).values({ name: 'Newsletter' }).returning()
    const admin = await emailAdmin()
    const req = as(admin.cookie)

    const created = await req('post', '/api/admin/email/contacts')
      .send({ email: 'reader@example.in', listIds: [list.id] })
      .expect(201)
    expect(created.body.listIds.map((l) => l.name)).toEqual(['Newsletter'])

    let [row] = await db.select().from(emailLists).where(eq(emailLists.id, list.id))
    expect(row.contactCount).toBe(1)

    await req('put', `/api/admin/email/contacts/${created.body._id}`)
      .send({ listIds: [] })
      .expect(200)
    ;[row] = await db.select().from(emailLists).where(eq(emailLists.id, list.id))
    expect(row.contactCount).toBe(0)
  })

  it('imports a CSV once per address and adds to, never replaces, membership', async () => {
    const [list] = await db.insert(emailLists).values({ name: 'Imported' }).returning()
    const admin = await emailAdmin()
    const csv = 'email,name\nA@example.in,A\na@example.in,A2\nnot-an-email,X\n'

    const res = await as(admin.cookie)('post', '/api/admin/email/contacts/import')
      .field('listId', list.id)
      .attach('file', Buffer.from(csv), 'contacts.csv')
      .expect(201)
    expect(res.body).toMatchObject({ created: 1, updated: 0, skipped: 1 })

    const again = await as(admin.cookie)('post', '/api/admin/email/contacts/import')
      .field('listId', list.id)
      .attach('file', Buffer.from(csv), 'contacts.csv')
      .expect(201)
    expect(again.body).toMatchObject({ created: 0, updated: 1 })

    const [row] = await db.select().from(emailLists).where(eq(emailLists.id, list.id))
    expect(row.contactCount).toBe(1)
  })
})
