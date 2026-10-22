import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { courses, customers, transactions } from '../db/schema/index.js'
import { txnDoc, findTransactionById } from '../db/repos/transactions.js'
import {
  createAccount,
  EmailTakenError,
  findUserByEmail,
  normaliseEmail,
} from '../db/repos/users.js'
import { send } from '../mail/index.js'
import { expiryForAccessTier, grantAccess, revokeAccess } from './access.js'
import { sendPasswordEmail } from './passwordReset.js'
import { nextInvoiceNo } from './razorpay.js'

/**
 * Turning a confirmed payment into access.
 *
 * Deliberately shared between the manual UPI approval (task 12) and the Razorpay
 * webhook (task 16). Two payment origins converging on one fulfilment path is
 * what keeps "did this customer get what they paid for" a single question with a
 * single answer — and means a fix to one origin cannot leave the other broken.
 *
 * Under Postgres the guarantee is stronger than it was: the status flip, the
 * invoice number, the enrolment and the customer link commit together or not at
 * all. A failure halfway leaves the payment PENDING and retryable — never
 * SUCCESS-without-access, which Mongo could produce.
 */

const buyerEmail = (txn) => normaliseEmail(txn.buyer?.email || txn.contact)

/**
 * Finds or creates the learner account behind a payment.
 *
 * Runs before the database transaction, not inside it: the identity lives in
 * Supabase Auth, which cannot roll back with our tables. That is safe because
 * it is idempotent — an account created for a payment that then fails to
 * fulfil is simply there next time. The account is created without any
 * password; the set-password link is the only way in.
 */
export async function resolveBuyerAccount({ email, name, phone }) {
  const existing = await findUserByEmail(email)
  if (existing) return { user: existing, created: false }
  try {
    const user = await createAccount({ email, name, phone, role: 'student' })
    return { user, created: true }
  } catch (err) {
    // Lost a race with a concurrent fulfilment for the same buyer.
    if (err instanceof EmailTakenError) {
      return { user: await findUserByEmail(email), created: false }
    }
    throw err
  }
}

/**
 * Grants access for a transaction already claimed inside `tx`.
 *
 * Returns the outcome plus `notify`, the emails to send — the caller sends them
 * only after commit, so a rolled-back fulfilment can never have told a customer
 * they have access.
 */
async function fulfilClaimed(tx, transaction, { user, created }) {
  const [course] = transaction.courseId
    ? await tx.select().from(courses).where(eq(courses.id, transaction.courseId))
    : []
  if (!course) {
    // Nothing to grant, but the payment is real and now marked SUCCESS.
    // Loud, because it means someone paid for a course that has since vanished.
    console.error(
      `[fulfilment] transaction ${transaction.id} has no resolvable course — access NOT granted`,
    )
    return { granted: false, reason: 'course-missing', notify: () => {} }
  }

  const email = buyerEmail(transaction)

  /**
   * Invoice number, assigned once and only for a completed sale. Sequential and
   * gapless: the counter increments inside this transaction, so it rolls back
   * with everything else. Minting it here rather than at checkout means
   * abandoned and rejected payments do not burn numbers. No tax component: the
   * business is not GST-registered and prices are all-inclusive.
   */
  const invoiceNo =
    transaction.invoiceNo || (await nextInvoiceNo(transaction.date || new Date(), { tx }))
  if (!transaction.invoiceNo) {
    await tx.update(transactions).set({ invoiceNo }).where(eq(transactions.id, transaction.id))
  }

  // Expiry comes from the tier actually purchased. Lifetime yields null.
  const expiresAt = expiryForAccessTier(transaction.planAccess, new Date())
  const { enrollment } = await grantAccess(
    user.id,
    course.id,
    { expiresAt, source: transaction.method === 'MANUAL_UPI' ? 'manual' : 'paid' },
    { tx },
  )

  /*
   * Link the customer record to the learner account so the admin customer page
   * stops treating a paying buyer as an unmatched contact. By id when the
   * checkout recorded one (public checkout always does); otherwise the first
   * customer with this email — one row, as Mongo's updateOne did.
   */
  const link = { userId: user.id, status: 'Active', product: course.title }
  let linked = []
  if (transaction.customerId) {
    linked = await tx
      .update(customers)
      .set(link)
      .where(eq(customers.id, transaction.customerId))
      .returning({ id: customers.id })
  }
  if (!linked.length) {
    await tx
      .update(customers)
      .set(link)
      .where(
        eq(
          customers.id,
          sql`(select id from ${customers} where ${customers.email} = ${email} order by ${customers.createdAt} limit 1)`,
        ),
      )
  }

  // Not awaited, and `send` swallows its own failures: a bounced confirmation
  // must never leave a paying customer without the access they bought.
  const notify = () => {
    if (created) void sendPasswordEmail(user, { isNewAccount: true })
    void send('access-granted', email, {
      name: user.name,
      email,
      courseTitle: course.title,
      courseSlug: course.slug,
      amount: transaction.amount,
      invoiceNo,
      expiresAt,
    })
  }

  return {
    granted: true,
    user,
    enrollment,
    accountCreated: created,
    course,
    expiresAt,
    invoiceNo,
    notify,
  }
}

/**
 * Claims a PENDING transaction matching `where`, fulfils it, commits, then
 * notifies. Of two concurrent claims exactly one updates a row: the UPDATE
 * takes the row lock, and the loser re-evaluates `status = 'PENDING'` after the
 * winner commits and matches nothing.
 */
async function claimAndFulfil(where, set, preview) {
  const email = buyerEmail(preview)
  const account = email
    ? await resolveBuyerAccount({
        email,
        name: preview.buyer?.name || preview.customerName,
        phone: preview.buyer?.phone,
      })
    : null

  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(transactions)
      .set(set)
      .where(and(where, eq(transactions.status, 'PENDING')))
      .returning()
    if (!row) return null
    const claimed = txnDoc(row)
    if (!account) {
      // Claimed but ungrantable: the payment is real, so it stays SUCCESS for a
      // human to resolve, as it always has.
      console.error(`[fulfilment] transaction ${claimed.id} has no buyer email`)
      return { claimed, result: { granted: false, reason: 'no-email', notify: () => {} } }
    }
    const result = await fulfilClaimed(tx, claimed, account)
    if (result.invoiceNo) claimed.invoiceNo = result.invoiceNo
    return { claimed, result }
  })

  if (!outcome) return { claimed: null }
  outcome.result.notify()
  const { notify: _notify, ...result } = outcome.result
  return { claimed: outcome.claimed, result }
}

/**
 * Approves a pending transaction. Safe to call twice.
 *
 * Everything expensive and everything with a side effect — the account, the
 * enrolment, both emails — happens only on the branch that won the claim.
 */
export async function approveTransaction(transactionId, { reviewedBy } = {}) {
  const current = await findTransactionById(transactionId)
  if (!current) return { ok: false, code: 'NOT_FOUND' }
  if (current.status !== 'PENDING') {
    // Already handled — by an earlier click, or by the other half of a
    // double-submit. Report the outcome without repeating any of it.
    return { ok: true, alreadyProcessed: true, transaction: current, status: current.status }
  }

  const { claimed, result } = await claimAndFulfil(
    eq(transactions.id, current.id),
    { status: 'SUCCESS', reviewedAt: new Date(), reviewedBy: reviewedBy ?? null },
    current,
  )
  if (!claimed) {
    const latest = await findTransactionById(transactionId)
    return { ok: true, alreadyProcessed: true, transaction: latest, status: latest.status }
  }
  return { ok: true, alreadyProcessed: false, transaction: claimed, ...result }
}

/**
 * The Razorpay webhook's entry point. Same shape as `approveTransaction` and for
 * the same reason: of N deliveries of one payment exactly one proceeds to grant
 * access and send email. Razorpay retries on any non-2xx and duplicate delivery
 * is routine, not exceptional.
 */
export async function fulfilGatewayPayment({ orderId, paymentId, amountPaise }) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.razorpayOrderId, orderId))
  const current = txnDoc(row)
  if (!current) {
    // A payment we have no order for. Never invent access from it — log loudly
    // and let a human reconcile against the Razorpay dashboard.
    console.error(`[razorpay] webhook for unknown order ${orderId} (payment ${paymentId})`)
    return { ok: false, code: 'UNKNOWN_ORDER' }
  }
  if (current.status !== 'PENDING')
    return { ok: true, alreadyProcessed: true, transaction: current }

  // Worth knowing about, but not worth withholding access for: the buyer paid
  // what Razorpay's hosted page showed them, and that amount came from our own
  // order, which came from the database.
  if (amountPaise != null && Math.round(current.amount * 100) !== amountPaise) {
    console.error(
      `[razorpay] amount mismatch on ${paymentId}: charged ${amountPaise} paise, transaction says ${Math.round(current.amount * 100)}`,
    )
  }

  const { claimed, result } = await claimAndFulfil(
    eq(transactions.razorpayOrderId, orderId),
    { status: 'SUCCESS', razorpayPaymentId: paymentId, reviewedAt: new Date() },
    current,
  )
  if (!claimed) return { ok: true, alreadyProcessed: true, transaction: current }
  return { ok: true, alreadyProcessed: false, transaction: claimed, ...result }
}

/**
 * Refund. **Calls Razorpay first and only records what the gateway confirms.**
 *
 * The version this replaces wrote `refundedAmount` and moved no money, which
 * with real payments arriving means marking a customer refunded while keeping
 * their cash. Updating our record before the gateway confirms would be the same
 * bug wearing a better disguise.
 *
 * A full refund revokes the enrolment; a partial one leaves access in place and
 * accumulates against `refundedAmount`. The record update and the revoke commit
 * together.
 */
export async function refundTransaction(transactionId, { amount, reason, reviewedBy } = {}) {
  const txn = await findTransactionById(transactionId)
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

  const { updated, revoked, isFull } = await db.transaction(async (tx) => {
    // Accumulate in SQL, not from the value read above: two partial refunds
    // racing must both count.
    const [row] = await tx
      .update(transactions)
      .set({
        refundedAmount: sql`${transactions.refundedAmount} + ${value}`,
        razorpayRefundIds: sql`array_append(${transactions.razorpayRefundIds}, ${refund.id})`,
        reviewedBy: reviewedBy ?? null,
        reviewedAt: new Date(),
      })
      .where(eq(transactions.id, txn.id))
      .returning()

    const full = row.refundedAmount >= row.amount
    let finalRow = row
    if (full) {
      ;[finalRow] = await tx
        .update(transactions)
        .set({ status: 'REFUNDED', failureReason: reason || 'Refunded' })
        .where(eq(transactions.id, txn.id))
        .returning()
    }

    // Full refund means the sale is undone, so the access it bought goes with it.
    let didRevoke = false
    if (full && row.courseId) {
      const email = buyerEmail(txnDoc(row))
      const user = email ? await findUserByEmail(email, { tx }) : null
      if (user) didRevoke = await revokeAccess(user.id, row.courseId, { tx })
    }
    return { updated: txnDoc(finalRow), revoked: didRevoke, isFull: full }
  })

  return {
    ok: true,
    refundId: refund.id,
    amount: value,
    full: isFull,
    revoked,
    transaction: updated,
  }
}

/** Marks a pending transaction as failed with a reason. Also idempotent. */
export async function rejectTransaction(transactionId, { reason, reviewedBy } = {}) {
  const current = await findTransactionById(transactionId)
  if (!current) return { ok: false, code: 'NOT_FOUND' }

  const [row] = await db
    .update(transactions)
    .set({
      status: 'FAILED',
      failureReason: reason || 'Payment could not be verified',
      reviewedAt: new Date(),
      reviewedBy: reviewedBy ?? null,
    })
    .where(and(eq(transactions.id, current.id), eq(transactions.status, 'PENDING')))
    .returning()

  if (!row) {
    const latest = await findTransactionById(transactionId)
    return { ok: true, alreadyProcessed: true, transaction: latest, status: latest.status }
  }
  return { ok: true, alreadyProcessed: false, transaction: txnDoc(row) }
}
