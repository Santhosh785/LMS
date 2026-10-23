import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { courses, enrollments } from '../db/schema/index.js'
import { findTransactionById } from '../db/repos/transactions.js'
import { findUserByEmail, normaliseEmail } from '../db/repos/users.js'
import { sendPasswordEmail } from '../services/passwordReset.js'
import { defineJob, enqueue } from '../services/queue.js'
import { dispatch } from './dispatch.js'
import { assertDelivered } from './mail.js'

/**
 * Job `fulfil-payment-side-effects` — data `{ transactionId, accountCreated }`.
 *
 * The mail that follows a fulfilled payment (services/fulfilment.js). The
 * fulfilment itself — the claim, the invoice number, the enrolment — has already
 * committed on the request by the time this is queued; this only tells the
 * buyer about it, and is safe to run any number of times.
 *
 * The payload is trusted for nothing but the id and the account-created flag.
 * Everything the mail says is re-read now, and nothing is sent unless the
 * transaction is still SUCCESS: a job that runs late, after a refund, must not
 * tell someone they have access they no longer have.
 *
 * Order and retries:
 *  1. The set-password mail for a new account, sent here and checked. If it
 *     fails the whole job throws and is retried — nothing else has gone out yet.
 *  2. The access-granted mail, handed to its own `send-mail` job. Once
 *     set-password has been delivered, a later access-granted failure is retried
 *     by that job alone, so the buyer is not sent a second set-password link
 *     (which would also kill the first one). Inline, `enqueue` sends it right
 *     here and a failure propagates the same way.
 */

const refuse = (transactionId, reason) => {
  console.warn(`[fulfilment] side effects for ${transactionId} not sent: ${reason}`)
  return { sent: [], refused: reason }
}

export async function fulfilPaymentSideEffects({ transactionId, accountCreated = false } = {}) {
  const transaction = await findTransactionById(transactionId)
  if (!transaction) return refuse(transactionId, 'transaction-missing')
  if (transaction.status !== 'SUCCESS') {
    return refuse(transactionId, `status-${String(transaction.status).toLowerCase()}`)
  }

  const email = normaliseEmail(transaction.buyer?.email || transaction.contact)
  const user = email ? await findUserByEmail(email) : null
  if (!user) return refuse(transactionId, 'user-missing')

  const [course] = transaction.courseId
    ? await db
        .select({ id: courses.id, title: courses.title, slug: courses.slug })
        .from(courses)
        .where(eq(courses.id, transaction.courseId))
    : []
  if (!course) return refuse(transactionId, 'course-missing')

  const [enrollment] = await db
    .select({ expiresAt: enrollments.expiresAt })
    .from(enrollments)
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, course.id)))
  if (!enrollment) return refuse(transactionId, 'enrollment-missing')

  const sent = []
  // A buyer who has already chosen a password (between attempts, or through a
  // self-service reset) has no use for an invite, and a new one would replace
  // whatever link they currently hold.
  if (accountCreated === true && !user.passwordChangedAt) {
    assertDelivered('set-password', await sendPasswordEmail(user, { isNewAccount: true }))
    sent.push('set-password')
  }

  await enqueue('send-mail', {
    template: 'access-granted',
    to: email,
    data: {
      name: user.name,
      email,
      courseTitle: course.title,
      courseSlug: course.slug,
      amount: transaction.amount,
      invoiceNo: transaction.invoiceNo,
      expiresAt: enrollment.expiresAt,
    },
  })
  sent.push('access-granted')
  return { sent }
}

defineJob('fulfil-payment-side-effects', {
  handler: fulfilPaymentSideEffects,
  /*
   * `exclusive`: at most one job per singleton key that is queued, waiting on
   * a retry or running. pg-boss's default policy ignores singleton keys
   * entirely, so without this a duplicate enqueue would not collapse.
   */
  queueOptions: { policy: 'exclusive' },
})

/**
 * Queues the side effects of a fulfilled payment, keyed `fulfil:<transactionId>`
 * so a duplicate enqueue for one transaction collapses into the job already
 * there. Never rejects — see dispatch.js.
 */
export const queueFulfilmentSideEffects = (transactionId, accountCreated) =>
  dispatch(
    'fulfil-payment-side-effects',
    { transactionId, accountCreated: Boolean(accountCreated) },
    { singletonKey: `fulfil:${transactionId}` },
  )
