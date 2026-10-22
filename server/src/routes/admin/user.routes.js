import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { and, count, desc, eq, ilike, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { isUuid } from '../../db/coerce.js'
import { courses, enrollments, transactions, users } from '../../db/schema/index.js'
import { deleteAccount, findUserById, normaliseEmail, profile } from '../../db/repos/users.js'
import { initialsFor } from '../../db/schema/users.js'
import { supabaseAdmin } from '../../services/supabaseAdmin.js'
import { sendCsv } from '../../utils/csv.js'
import { sendPasswordEmail } from '../../services/passwordReset.js'

const router = Router()

/**
 * User management.
 *
 * There was no way to see, let alone manage, a human being: no list, no role
 * change, no suspension, and admins could only be created by a CLI seeder.
 *
 * Two rules run through everything here, both guarding against an operator
 * locking the business out of its own admin panel:
 *
 *   1. Nobody can change their own role or suspend themselves.
 *   2. The last remaining admin cannot be demoted, suspended or deleted.
 */

const ROLES = ['student', 'admin']

const isSelf = (req, id) => String(req.user.id) === String(id)

const loadUser = async (id) => {
  const user = isUuid(id) ? await findUserById(id) : null
  if (!user) throw new HttpError(404, 'User not found')
  return user
}

const setUser = (id, values) => db.update(users).set(values).where(eq(users.id, id))

/** Throws if the change would leave the system with no usable admin. */
async function assertNotLastAdmin(user, { action }) {
  if (user.role !== 'admin') return
  const [{ others }] = await db
    .select({ others: count() })
    .from(users)
    .where(and(ne(users.id, user.id), eq(users.role, 'admin'), isNull(users.suspendedAt)))
  if (others === 0) {
    throw new HttpError(409, `This is the only active admin — ${action} would lock everyone out.`)
  }
}

const buildFilter = (query) => {
  const clauses = []
  if (query.role && ROLES.includes(query.role)) clauses.push(eq(users.role, query.role))
  if (query.status === 'suspended') clauses.push(isNotNull(users.suspendedAt))
  if (query.status === 'active') clauses.push(isNull(users.suspendedAt))

  const q = query.q?.trim()
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    clauses.push(
      or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.phone, pattern)),
    )
  }
  return clauses.length ? and(...clauses) : undefined
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = buildFilter(req.query)
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const skip = Number(req.query.skip) || 0

    const [items, [{ total }], [{ admins }]] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          phone: users.phone,
          suspendedAt: users.suspendedAt,
          suspendedReason: users.suspendedReason,
          createdAt: users.createdAt,
          seeds: users.seeds,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(skip),
      db.select({ total: count() }).from(users).where(where),
      db
        .select({ admins: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), isNull(users.suspendedAt))),
    ])

    res.json({ items: withMongoId(items), total, roles: ROLES, activeAdmins: admins })
  }),
)

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(users)
      .where(buildFilter(req.query))
      .orderBy(desc(users.createdAt))
    sendCsv(res, 'users.csv', rows, [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status', get: (r) => (r.suspendedAt ? 'suspended' : 'active') },
      { key: 'createdAt', label: 'Joined', get: (r) => r.createdAt?.toISOString().slice(0, 10) },
    ])
  }),
)

/** One user with the context you need before acting on them. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.params.id)

    const [enrolled, paid] = await Promise.all([
      db
        .select({
          id: enrollments.id,
          status: enrollments.status,
          expiresAt: enrollments.expiresAt,
          createdAt: enrollments.createdAt,
          course: { id: courses.id, title: courses.title, slug: courses.slug },
        })
        .from(enrollments)
        .leftJoin(courses, eq(courses.id, enrollments.courseId))
        .where(eq(enrollments.userId, user.id)),
      db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          status: transactions.status,
          createdAt: transactions.createdAt,
          invoiceNo: transactions.invoiceNo,
        })
        .from(transactions)
        .where(eq(transactions.buyerEmail, user.email))
        .orderBy(desc(transactions.createdAt))
        .limit(20),
    ])

    res.json({
      user,
      enrollments: enrolled.map(({ course, ...e }) => withMongoId({ ...e, courseId: course })),
      transactions: withMongoId(paid),
    })
  }),
)

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.params.id)
    const { name, email, phone, role } = req.body
    const values = {}

    if (role !== undefined && role !== user.role) {
      if (!ROLES.includes(role)) throw new HttpError(400, 'Unknown role')
      if (isSelf(req, user.id)) throw new HttpError(403, 'You cannot change your own role')
      await assertNotLastAdmin(user, { action: 'changing their role' })
      values.role = role
    }
    if (name !== undefined) {
      values.name = name
      values.avatarInitials = initialsFor(name)
    }
    if (phone !== undefined) values.phone = phone
    const nextEmail = email !== undefined ? normaliseEmail(email) : user.email
    if (nextEmail !== user.email) {
      const [clash] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, nextEmail), ne(users.id, user.id)))
      if (clash) throw new HttpError(409, 'Another account already uses that email')
      // The sign-in identity has to move too, or the account would answer to
      // the old address at login while every page shows the new one.
      const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
        email: nextEmail,
        email_confirm: true,
      })
      if (error) throw new HttpError(409, `Could not change the sign-in email: ${error.message}`)
      values.email = nextEmail
    }

    const [row] = Object.keys(values).length
      ? await db.update(users).set(values).where(eq(users.id, user.id)).returning()
      : [user]
    res.json({ ok: true, user: profile(row) })
  }),
)

router.post(
  '/:id/suspend',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.params.id)
    if (isSelf(req, user.id)) throw new HttpError(403, 'You cannot suspend yourself')
    await assertNotLastAdmin(user, { action: 'suspending them' })

    await setUser(user.id, { suspendedAt: new Date(), suspendedReason: req.body?.reason || '' })
    res.json({ ok: true })
  }),
)

router.post(
  '/:id/reactivate',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.params.id)
    await setUser(user.id, { suspendedAt: null, suspendedReason: null })
    res.json({ ok: true })
  }),
)

/**
 * Sends the user a reset link rather than setting a password on their behalf —
 * an admin who can type a password into someone else's account can then sign in
 * as them, and nothing in the audit trail would show it.
 */
router.post(
  '/:id/send-reset',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.params.id)

    const sent = await sendPasswordEmail(user)
    res.json({
      ok: true,
      // The mail layer no-ops without a transport configured; say so rather
      // than reporting a delivery that did not happen.
      delivered: Boolean(sent),
    })
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await loadUser(req.params.id)
    if (isSelf(req, user.id)) throw new HttpError(403, 'You cannot delete your own account')
    await assertNotLastAdmin(user, { action: 'deleting them' })

    const [{ enrolled }] = await db
      .select({ enrolled: count() })
      .from(enrollments)
      .where(eq(enrollments.userId, user.id))
    if (enrolled > 0 && req.query.force !== 'true') {
      throw new HttpError(
        409,
        `${user.name} has ${enrolled} enrolment(s). Suspending keeps the purchase history; confirm to delete anyway.`,
      )
    }

    // The Supabase identity goes too, or the address could still sign in. The
    // profile and its enrolments follow through the FK cascades.
    await deleteAccount(user.id)
    res.json({ ok: true })
  }),
)

export default router
