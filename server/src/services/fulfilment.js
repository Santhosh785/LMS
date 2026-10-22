import { Course, Customer, Transaction, User } from '../models/index.js'
import { send } from '../mail/index.js'
import { expiryForAccessTier, grantAccess, revokeAccess } from './access.js'
import { sendPasswordEmail, unusablePasswordHash } from './passwordReset.js'
import { nextInvoiceNo } from './razorpay.js'

/**
 * Turning a confirmed payment into access.
 *
 * Deliberately shared between the manual UPI approval (task 12) and the Razorpay
 * webhook (task 16). Two payment origins converging on one fulfilment path is
 * what keeps "did this customer get what they paid for" a single question with a
 * single answer — and means a fix to one origin cannot leave the other broken.
 */

/**
 * Finds or creates the learner account behind a payment.
 *
 * Account creation is the part that did not exist before: a UPI buyer normally
 * pays without ever registering, and the old admin enroll route simply refused
 * with "this customer has no learner account yet". The account is created with a
 * password nobody knows — never an invented one emailed in plaintext — and the
 * set-password link is the only way in.
 */
export async function resolveBuyerAccount({ email, name, phone }) {
  const existing = await User.findOne({ email })
  if (existing) return { user: existing, created: false }

  const user = await User.create({
    name: name || email.split('@')[0],
    email,
    phone,
    passwordHash: await unusablePasswordHash(),
    role: 'student',
  })
  return { user, created: true }
}

/**
 * Grants access for a transaction and sends the emails that go with it.
 *
 * Assumes the caller has already flipped the transaction to SUCCESS **atomically
 * and exactly once** — that guard, not anything here, is what makes a
 * double-click or a redelivered webhook safe.
 */
export async function fulfilTransaction(transaction) {
  const course = transaction.courseId ? await Course.findById(transaction.courseId).lean() : null
  if (!course) {
    // Nothing to grant, but the payment is real and already marked SUCCESS.
    // Loud, because it means someone paid for a course that has since vanished.
    console.error(
      `[fulfilment] transaction ${transaction._id} has no resolvable course — access NOT granted`,
    )
    return { granted: false, reason: 'course-missing' }
  }

  const email = transaction.buyer?.email || transaction.contact
  if (!email) {
    console.error(`[fulfilment] transaction ${transaction._id} has no buyer email`)
    return { granted: false, reason: 'no-email' }
  }

  const { user, created } = await resolveBuyerAccount({
    email,
    name: transaction.buyer?.name || transaction.customerName,
    phone: transaction.buyer?.phone,
  })

  /**
   * Invoice number, assigned once and only for a completed sale. Sequential and
   * gapless via an atomic counter — minting it here rather than at checkout
   * means abandoned and rejected payments do not burn numbers and leave holes
   * somebody later has to explain. No tax component: the business is not
   * GST-registered and prices are all-inclusive.
   */
  if (!transaction.invoiceNo) {
    const invoiceNo = await nextInvoiceNo(transaction.date || new Date())
    await Transaction.updateOne({ _id: transaction._id }, { $set: { invoiceNo } })
    // `transaction` is a document this call already claimed exclusively, so
    // nothing else can be writing it between the await and this assignment.
    // eslint-disable-next-line require-atomic-updates
    transaction.invoiceNo = invoiceNo
  }

  // Expiry comes from the tier actually purchased. Lifetime yields null.
  const expiresAt = expiryForAccessTier(transaction.planAccess, new Date())
  const { enrollment } = await grantAccess(user._id, course._id, {
    expiresAt,
    source: transaction.method === 'MANUAL_UPI' ? 'manual' : 'paid',
  })

  /*
   * Link the customer record to the learner account so the admin customer page
   * stops treating a paying buyer as an unmatched contact.
   *
   * The `_id` branch is only included when there actually is one. Mongoose
   * strips an undefined value but keeps the clause, so `{ _id: undefined }`
   * reaches MongoDB as `{}` — which matches every document, and `updateOne`
   * would then stamp this buyer's account onto whichever customer the query
   * planner happened to return first. Public checkout always sets customerId;
   * a transaction entered by hand in the admin panel does not.
   */
  const customerMatch = [
    ...(transaction.customerId ? [{ _id: transaction.customerId }] : []),
    { email },
  ]
  await Customer.updateOne(
    { $or: customerMatch },
    { $set: { userId: user._id, status: 'Active', product: course.title } },
  )

  // Emails are notifications about a transaction that has already completed.
  // Not awaited, and `send` swallows its own failures: a bounced confirmation
  // must never leave a paying customer without the access they bought.
  if (created) void sendPasswordEmail(user, { isNewAccount: true })
  void send('access-granted', email, {
    name: user.name,
    email,
    courseTitle: course.title,
    courseSlug: course.slug,
    amount: transaction.amount,
    invoiceNo: transaction.invoiceNo,
    expiresAt,
  })

  return { granted: true, user, enrollment, accountCreated: created, course, expiresAt }
}

/**
 * Approves a pending transaction. Safe to call twice.
 *
 * The status flip is a conditional update on `status: 'PENDING'`, so of two
 * concurrent approvals exactly one matches a document and the other gets null.
 * Everything expensive and everything with a side effect — the account, the
 * enrolment, both emails — happens only on the branch that won.
 */
export async function approveTransaction(transactionId, { reviewedBy } = {}) {
  const claimed = await Transaction.findOneAndUpdate(
    { _id: transactionId, status: 'PENDING' },
    { $set: { status: 'SUCCESS', reviewedAt: new Date(), reviewedBy } },
    { new: true },
  )

  if (!claimed) {
    const current = await Transaction.findById(transactionId).lean()
    if (!current) return { ok: false, code: 'NOT_FOUND' }
    // Already handled — by an earlier click, or by the other half of a
    // double-submit. Report the outcome without repeating any of it.
    return { ok: true, alreadyProcessed: true, transaction: current, status: current.status }
  }

  const result = await fulfilTransaction(claimed)
  return { ok: true, alreadyProcessed: false, transaction: claimed, ...result }
}

/**
 * The Razorpay webhook's entry point.
 *
 * Same shape as `approveTransaction` and for the same reason: the status flip is
 * a conditional update, so of N deliveries of one payment exactly one proceeds
 * to grant access and send email. Razorpay retries on any non-2xx and duplicate
 * delivery is routine, not exceptional.
 */
export async function fulfilGatewayPayment({ orderId, paymentId, amountPaise }) {
  const claimed = await Transaction.findOneAndUpdate(
    { razorpayOrderId: orderId, status: 'PENDING' },
    {
      $set: {
        status: 'SUCCESS',
        razorpayPaymentId: paymentId,
        reviewedAt: new Date(),
      },
    },
    { new: true },
  )

  if (!claimed) {
    const current = await Transaction.findOne({ razorpayOrderId: orderId }).lean()
    if (!current) {
      // A payment we have no order for. Never invent access from it — log loudly
      // and let a human reconcile against the Razorpay dashboard.
      console.error(`[razorpay] webhook for unknown order ${orderId} (payment ${paymentId})`)
      return { ok: false, code: 'UNKNOWN_ORDER' }
    }
    return { ok: true, alreadyProcessed: true, transaction: current }
  }

  // Worth knowing about, but not worth withholding access for: the buyer paid
  // what Razorpay's hosted page showed them, and that amount came from our own
  // order, which came from the database.
  if (amountPaise != null && Math.round(claimed.amount * 100) !== amountPaise) {
    console.error(
      `[razorpay] amount mismatch on ${paymentId}: charged ${amountPaise} paise, transaction says ${Math.round(claimed.amount * 100)}`,
    )
  }

  const result = await fulfilTransaction(claimed)
  return { ok: true, alreadyProcessed: false, transaction: claimed, ...result }
}

/**
 * Refund. **Calls Razorpay first and only records what the gateway confirms.**
 *
 * The version this replaces wrote `refundedAmount` to Mongo and moved no money,
 * which with real payments arriving means marking a customer refunded while
 * keeping their cash. Updating our record before the gateway confirms would be
 * the same bug wearing a better disguise.
 *
 * A full refund revokes the enrolment; a partial one leaves access in place and
 * accumulates against `refundedAmount`.
 */
export async function refundTransaction(transactionId, { amount, reason, reviewedBy } = {}) {
  const txn = await Transaction.findById(transactionId)
  if (!txn) return { ok: false, code: 'NOT_FOUND' }
  if (txn.status !== 'SUCCESS' && txn.status !== 'REFUNDED') {
    return {
      ok: false,
      code: 'NOT_REFUNDABLE',
      message: `A ${txn.status} payment cannot be refunded`,
    }
  }
  if (!txn.razorpayPaymentId) {
    // Manual UPI money never went through the gateway, so there is nothing here
    // to call. Sending it back is a bank transfer someone makes by hand.
    return {
      ok: false,
      code: 'NOT_A_GATEWAY_PAYMENT',
      message: 'This was paid by manual UPI — refund it from your UPI app or bank, not here.',
    }
  }

  const remaining = txn.amount - (txn.refundedAmount || 0)
  const value = Number(amount ?? remaining)
  if (!(value > 0) || value > remaining) {
    return { ok: false, code: 'BAD_AMOUNT', message: 'Refund amount exceeds the remaining balance' }
  }

  // Gateway first. If this throws, nothing below runs and the record still
  // matches reality.
  const { razorpay, toPaise } = await import('./razorpay.js')
  const refund = await razorpay().payments.refund(txn.razorpayPaymentId, {
    amount: toPaise(value),
    speed: 'normal',
    notes: { reason: reason || 'Requested by the customer' },
  })

  txn.refundedAmount = (txn.refundedAmount || 0) + value
  txn.razorpayRefundIds = [...(txn.razorpayRefundIds || []), refund.id]
  txn.reviewedBy = reviewedBy
  txn.reviewedAt = new Date()

  const isFull = txn.refundedAmount >= txn.amount
  if (isFull) {
    txn.status = 'REFUNDED'
    txn.failureReason = reason || 'Refunded'
  }
  await txn.save()

  // Full refund means the sale is undone, so the access it bought goes with it.
  let revoked = false
  if (isFull && txn.courseId) {
    const email = txn.buyer?.email || txn.contact
    const user = email ? await User.findOne({ email }) : null
    if (user) revoked = await revokeAccess(user._id, txn.courseId)
  }

  return { ok: true, refundId: refund.id, amount: value, full: isFull, revoked, transaction: txn }
}

/** Marks a pending transaction as failed with a reason. Also idempotent. */
export async function rejectTransaction(transactionId, { reason, reviewedBy } = {}) {
  const claimed = await Transaction.findOneAndUpdate(
    { _id: transactionId, status: 'PENDING' },
    {
      $set: {
        status: 'FAILED',
        failureReason: reason || 'Payment could not be verified',
        reviewedAt: new Date(),
        reviewedBy,
      },
    },
    { new: true },
  )

  if (!claimed) {
    const current = await Transaction.findById(transactionId).lean()
    if (!current) return { ok: false, code: 'NOT_FOUND' }
    return { ok: true, alreadyProcessed: true, transaction: current, status: current.status }
  }
  return { ok: true, alreadyProcessed: false, transaction: claimed }
}
