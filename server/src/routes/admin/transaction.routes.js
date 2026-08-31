import { Router } from 'express'
import { body } from 'express-validator'
import { crudRouter } from '../../utils/crudRouter.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { sendCsv } from '../../utils/csv.js'
import { Transaction } from '../../models/index.js'
import {
  approveTransaction,
  refundTransaction,
  rejectTransaction,
} from '../../services/fulfilment.js'
import { isRazorpayConfigured } from '../../services/razorpay.js'

const router = Router()

/**
 * The reconciliation queue: pending first, newest first within each group.
 *
 * A dedicated endpoint rather than a client-side re-sort, because the list is
 * paginated — sorting a page of 200 after the fact would leave a pending payment
 * stranded on page three while the operator looks at page one.
 */
router.get(
  '/queue',
  asyncHandler(async (_req, res) => {
    const items = await Transaction.aggregate([
      { $addFields: { _pendingFirst: { $cond: [{ $eq: ['$status', 'PENDING'] }, 0, 1] } } },
      { $sort: { _pendingFirst: 1, date: -1 } },
      { $limit: 200 },
      { $project: { _pendingFirst: 0 } },
    ])
    const pendingCount = await Transaction.countDocuments({ status: 'PENDING' })
    res.json({ items, pendingCount })
  }),
)

/**
 * Approve a claimed payment: flip to SUCCESS, resolve or create the learner
 * account, grant access with expiry from the purchased tier, and email.
 *
 * Idempotent by construction — see approveTransaction. The operator will
 * double-click; the second click must not double-enrol or double-email.
 */
router.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const result = await approveTransaction(req.params.id, { reviewedBy: req.user._id })
    if (!result.ok) throw new HttpError(404, 'Transaction not found')

    if (result.alreadyProcessed) {
      return res.json({
        ok: true,
        alreadyProcessed: true,
        status: result.status,
        message: `This transaction was already marked ${result.status}. Nothing was changed.`,
      })
    }
    if (!result.granted) {
      // The payment is recorded as SUCCESS but access could not be granted.
      // Surfaced as an error so the operator chases it rather than assuming.
      throw new HttpError(
        409,
        result.reason === 'course-missing'
          ? 'Marked paid, but the purchased course no longer exists — grant access manually.'
          : 'Marked paid, but no buyer email is on this transaction — grant access manually.',
        { code: 'FULFILMENT_INCOMPLETE' },
      )
    }

    res.json({
      ok: true,
      alreadyProcessed: false,
      accountCreated: result.accountCreated,
      expiresAt: result.expiresAt,
      message: result.accountCreated
        ? 'Approved. Account created and a set-password email sent.'
        : 'Approved. Access granted and the buyer notified.',
    })
  }),
)

/**
 * Reject an unmatched or fake reference. Without this, pending rows accumulate
 * forever with no honest way to clear them.
 */
router.post(
  '/:id/reject',
  body('reason').trim().notEmpty().withMessage('Give a reason so the queue stays honest'),
  validate,
  asyncHandler(async (req, res) => {
    const result = await rejectTransaction(req.params.id, {
      reason: req.body.reason,
      reviewedBy: req.user._id,
    })
    if (!result.ok) throw new HttpError(404, 'Transaction not found')
    res.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      message: result.alreadyProcessed
        ? `This transaction was already marked ${result.status}. Nothing was changed.`
        : 'Marked as failed.',
    })
  }),
)

router.get(
  '/export',
  asyncHandler(async (_req, res) => {
    const rows = await Transaction.find().sort({ date: -1 }).lean()
    sendCsv(res, 'transactions.csv', rows, [
      { key: 'date', label: 'Date', get: (r) => r.date?.toISOString().slice(0, 10) },
      { key: 'customerName', label: 'Customer' },
      { key: 'contact', label: 'Contact' },
      { key: 'product', label: 'Product' },
      { key: 'quantity', label: 'Qty' },
      { key: 'amount', label: 'Amount' },
      { key: 'cycle', label: 'Cycle' },
      { key: 'status', label: 'Status' },
    ])
  }),
)

/**
 * Refund through Razorpay.
 *
 * Until task 16 this endpoint only wrote `refundedAmount` to Mongo and moved no
 * money — a way to mark a customer refunded while keeping their cash. It now
 * calls the gateway **first** and records only what the gateway confirms; a
 * full refund revokes the enrolment it paid for.
 *
 * Manual UPI payments never went through Razorpay, so there is nothing to call:
 * those are refused with an explanation rather than silently written to Mongo,
 * which is the original bug.
 */
router.post(
  '/:id/refund',
  asyncHandler(async (req, res) => {
    if (!isRazorpayConfigured()) {
      throw new HttpError(
        501,
        'Razorpay is not configured, so no refund can be issued from here. Send the money back from your bank and record it once the gateway is live.',
        { code: 'REFUNDS_DISABLED' },
      )
    }

    const result = await refundTransaction(req.params.id, {
      amount: req.body.amount,
      reason: req.body.reason,
      reviewedBy: req.user._id,
    })

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'BAD_AMOUNT' ? 400 : 409
      throw new HttpError(status, result.message || 'Refund failed', { code: result.code })
    }

    res.json({
      ok: true,
      refundId: result.refundId,
      amount: result.amount,
      full: result.full,
      message: result.full
        ? `Refunded ${result.amount} in full via Razorpay${result.revoked ? ' and revoked course access' : ''}.`
        : `Refunded ${result.amount} via Razorpay. Access is unchanged.`,
    })
  }),
)

router.use(
  '/',
  crudRouter(Transaction, {
    searchFields: ['customerName', 'contact', 'product', 'invoiceNo'],
    sort: { date: -1 },
    dateField: 'date',
  }),
)

export default router
