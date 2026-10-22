import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { Enrollment, Transaction, User } from '../../models/index.js'
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

const isSelf = (req, id) => String(req.user._id) === String(id)

/** Throws if the change would leave the system with no usable admin. */
async function assertNotLastAdmin(user, { action }) {
  if (user.role !== 'admin') return
  const others = await User.countDocuments({
    _id: { $ne: user._id },
    role: 'admin',
    suspendedAt: { $exists: false },
  })
  if (others === 0) {
    throw new HttpError(409, `This is the only active admin — ${action} would lock everyone out.`)
  }
}

const buildFilter = (query) => {
  const filter = {}
  if (query.role && ROLES.includes(query.role)) filter.role = query.role
  if (query.status === 'suspended') filter.suspendedAt = { $exists: true }
  if (query.status === 'active') filter.suspendedAt = { $exists: false }

  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }]
  }
  return filter
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query)
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const skip = Number(req.query.skip) || 0

    const [items, total, admins] = await Promise.all([
      User.find(filter)
        .select('name email role phone suspendedAt suspendedReason createdAt seeds')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      User.countDocuments({ role: 'admin', suspendedAt: { $exists: false } }),
    ])

    res.json({ items, total, roles: ROLES, activeAdmins: admins })
  }),
)

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await User.find(buildFilter(req.query)).sort({ createdAt: -1 }).lean()
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
    const user = await User.findById(req.params.id).lean()
    if (!user) throw new HttpError(404, 'User not found')

    const [enrollments, transactions] = await Promise.all([
      Enrollment.find({ userId: user._id })
        .populate('courseId', 'title slug')
        .select('courseId progress status expiresAt createdAt')
        .lean(),
      Transaction.find({ 'buyer.email': user.email })
        .select('amount status createdAt invoiceNo')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ])

    res.json({ user, enrollments, transactions })
  }),
)

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
    if (!user) throw new HttpError(404, 'User not found')

    const { name, email, phone, role } = req.body

    if (role !== undefined && role !== user.role) {
      if (!ROLES.includes(role)) throw new HttpError(400, 'Unknown role')
      if (isSelf(req, user._id)) throw new HttpError(403, 'You cannot change your own role')
      await assertNotLastAdmin(user, { action: 'changing their role' })
      user.role = role
    }
    if (name !== undefined) user.name = name
    if (phone !== undefined) user.phone = phone
    if (email !== undefined && email !== user.email) {
      const clash = await User.findOne({
        email: String(email).toLowerCase(),
        _id: { $ne: user._id },
      })
      if (clash) throw new HttpError(409, 'Another account already uses that email')
      user.email = email
    }

    await user.save()
    res.json({ ok: true, user: { ...user.toObject(), passwordHash: undefined } })
  }),
)

router.post(
  '/:id/suspend',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
    if (!user) throw new HttpError(404, 'User not found')
    if (isSelf(req, user._id)) throw new HttpError(403, 'You cannot suspend yourself')
    await assertNotLastAdmin(user, { action: 'suspending them' })

    user.suspendedAt = new Date()
    user.suspendedReason = req.body?.reason || ''
    await user.save()
    res.json({ ok: true })
  }),
)

router.post(
  '/:id/reactivate',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
    if (!user) throw new HttpError(404, 'User not found')
    user.suspendedAt = undefined
    user.suspendedReason = undefined
    await user.save()
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
    const user = await User.findById(req.params.id)
    if (!user) throw new HttpError(404, 'User not found')

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
    const user = await User.findById(req.params.id)
    if (!user) throw new HttpError(404, 'User not found')
    if (isSelf(req, user._id)) throw new HttpError(403, 'You cannot delete your own account')
    await assertNotLastAdmin(user, { action: 'deleting them' })

    const enrolled = await Enrollment.countDocuments({ userId: user._id })
    if (enrolled > 0 && req.query.force !== 'true') {
      throw new HttpError(
        409,
        `${user.name} has ${enrolled} enrolment(s). Suspending keeps the purchase history; confirm to delete anyway.`,
      )
    }

    await user.deleteOne()
    res.json({ ok: true })
  }),
)

export default router
