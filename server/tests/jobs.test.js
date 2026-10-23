import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../src/db/index.js'
import { courses, customers, enrollments, transactions, users } from '../src/db/schema/index.js'
import { findTransactionById, insertTransaction } from '../src/db/repos/transactions.js'
import { enqueue } from '../src/services/queue.js'
import { countRows, findRow, insertRow } from './helpers/commerce.js'
import { agent, paidCourse, signUp, submitUpiPayment } from './helpers/factories.js'

/**
 * Transactional mail and payment side effects on the queue (task 9).
 *
 * The queue is never started under test, so `enqueue` runs each handler inline
 * — which is what lets these assert on what a job did. Two module-boundary spies:
 *
 *  - `enqueue` wraps the real one, to count what was queued and to await the
 *    handlers that call sites start in the background;
 *  - `send` wraps the real mail layer (which no-ops: no RESEND_API_KEY under
 *    test), so a test can record which mails went out, in what order, and make
 *    one fail the way Resend does.
 */
const { enqueueSpy, sendSpy } = vi.hoisted(() => ({ enqueueSpy: vi.fn(), sendSpy: vi.fn() }))

vi.mock('../src/services/queue.js', async (importOriginal) => {
  const actual = await importOriginal()
  enqueueSpy.mockImplementation((...args) => actual.enqueue(...args))
  return { ...actual, enqueue: enqueueSpy }
})

vi.mock('../src/mail/index.js', async (importOriginal) => {
  const actual = await importOriginal()
  sendSpy.mockImplementation((...args) => actual.send(...args))
  return { ...actual, send: sendSpy }
})

const PROVIDER_DOWN = { ok: false, skipped: false, error: 'Resend: service unavailable' }

const WEBHOOK_SECRET = 'test-razorpay-webhook-secret'
const ORDER_ID = 'order_JOBS123'
const BUYER = 'anjali@example.in'

const sign = (body) => crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
const captured = (paymentId = 'pay_JOBS999') =>
  JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: ORDER_ID, amount: 249900 } } },
  })
const deliver = (body) =>
  agent()
    .post('/api/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', sign(body))
    .send(body)

async function pendingOrder(course, overrides = {}) {
  const customer = await insertRow(customers, { name: 'Anjali R', email: BUYER })
  return insertTransaction({
    customerId: customer._id,
    customerName: 'Anjali R',
    contact: BUYER,
    product: course.title,
    amount: 2499,
    status: 'PENDING',
    method: 'RAZORPAY',
    razorpayOrderId: ORDER_ID,
    courseId: course._id,
    courseSlug: course.slug,
    planName: '12 month access',
    planAccess: '12 months',
    buyer: { name: 'Anjali R', email: BUYER, phone: '9876543210' },
    ...overrides,
  })
}

/** Lets every handler a call site started in the background run to completion. */
const settle = () => Promise.allSettled(enqueueSpy.mock.results.map((r) => r.value))

const enqueuesOf = (name) => enqueueSpy.mock.calls.filter(([n]) => n === name)
const templatesSent = () => sendSpy.mock.calls.map(([template]) => template)

/** A course paid for through the webhook: SUCCESS, enrolled, new account. */
async function paidThroughWebhook() {
  const course = await paidCourse()
  const txn = await pendingOrder(course)
  await deliver(captured()).expect(200)
  await settle()
  enqueueSpy.mockClear()
  sendSpy.mockClear()
  return { course, txn: await findTransactionById(txn._id) }
}

beforeEach(async () => {
  // Earlier tests may have left handlers running against data the wipe removed.
  await settle()
  enqueueSpy.mockClear()
  sendSpy.mockClear()
})

describe('fulfilment side effects', () => {
  it('queues one fulfil job and grants access once when a webhook is redelivered', async () => {
    const course = await paidCourse()
    const txn = await pendingOrder(course)
    const body = captured()

    await deliver(body).expect(200)
    await deliver(body).expect(200)
    await settle()

    const fulfils = enqueuesOf('fulfil-payment-side-effects')
    expect(fulfils).toHaveLength(1)
    expect(fulfils[0][1]).toEqual({ transactionId: txn._id, accountCreated: true })
    expect(fulfils[0][2]).toMatchObject({ singletonKey: `fulfil:${txn._id}` })

    expect(await countRows(enrollments)).toBe(1)
    expect((await findRow(courses, { id: course.id })).enrolledCount).toBe(1)
    // The buyer was new, so: an invite, then the receipt — once each.
    expect(templatesSent()).toEqual(['set-password', 'access-granted'])
  })

  it('answers the webhook 200 and keeps access when the mail provider is down', async () => {
    const course = await paidCourse()
    await pendingOrder(course)
    sendSpy.mockResolvedValueOnce(PROVIDER_DOWN)

    const res = await deliver(captured())
    await settle()

    // The invite failed, so the job threw — inline that is logged, not retried,
    // and it never reaches the webhook's response or the access it granted.
    expect(res.status).toBe(200)
    expect(await countRows(enrollments)).toBe(1)
    expect(templatesSent()).toEqual(['set-password'])
  })

  it('sends set-password then access-granted for a new account', async () => {
    const { txn } = await paidThroughWebhook()

    const result = await enqueue('fulfil-payment-side-effects', {
      transactionId: txn._id,
      accountCreated: true,
    })

    expect(result.sent).toEqual(['set-password', 'access-granted'])
    expect(templatesSent()).toEqual(['set-password', 'access-granted'])
    const [, , granted] = sendSpy.mock.calls[1]
    expect(granted).toMatchObject({
      name: 'Anjali R',
      email: BUYER,
      courseTitle: 'SEO Mastery',
      courseSlug: 'seo-mastery',
      amount: 2499,
      invoiceNo: txn.invoiceNo,
    })
    expect(granted.expiresAt).toBeInstanceOf(Date)
    expect(sendSpy.mock.calls[0][2]).toMatchObject({ isNewAccount: true, expiresInLabel: '1 day' })
  })

  it('sends only access-granted for an existing account', async () => {
    const { txn } = await paidThroughWebhook()

    await enqueue('fulfil-payment-side-effects', { transactionId: txn._id, accountCreated: false })

    expect(templatesSent()).toEqual(['access-granted'])
  })

  it.each(['PENDING', 'FAILED', 'REFUNDED'])(
    'sends nothing, and does not throw, for a %s transaction',
    async (status) => {
      const { txn } = await paidThroughWebhook()
      await db.update(transactions).set({ status }).where(eq(transactions.id, txn._id))

      const result = await enqueue('fulfil-payment-side-effects', {
        transactionId: txn._id,
        accountCreated: true,
      })

      expect(result.sent).toEqual([])
      expect(sendSpy).not.toHaveBeenCalled()
    },
  )

  it('sends nothing for a transaction or buyer that no longer exists', async () => {
    const { txn } = await paidThroughWebhook()

    await expect(
      enqueue('fulfil-payment-side-effects', {
        transactionId: crypto.randomUUID(),
        accountCreated: true,
      }),
    ).resolves.toMatchObject({ sent: [] })

    await db.delete(users).where(eq(users.email, BUYER))
    await expect(
      enqueue('fulfil-payment-side-effects', { transactionId: txn._id, accountCreated: true }),
    ).resolves.toMatchObject({ sent: [] })
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('fails the job, before access-granted, when the set-password mail fails', async () => {
    const { txn } = await paidThroughWebhook()
    sendSpy.mockResolvedValueOnce(PROVIDER_DOWN)

    await expect(
      enqueue('fulfil-payment-side-effects', { transactionId: txn._id, accountCreated: true }),
    ).rejects.toThrow(/service unavailable/)
    expect(templatesSent()).toEqual(['set-password'])
  })

  it('fails the job when the access-granted mail fails', async () => {
    const { txn } = await paidThroughWebhook()
    sendSpy.mockResolvedValueOnce(PROVIDER_DOWN)

    await expect(
      enqueue('fulfil-payment-side-effects', { transactionId: txn._id, accountCreated: false }),
    ).rejects.toThrow(/service unavailable/)
  })
})

describe('send-mail', () => {
  const job = { template: 'payment-received', to: BUYER, data: { name: 'Anjali' } }

  it('throws with the provider message on a rejection or network failure', async () => {
    sendSpy.mockResolvedValueOnce(PROVIDER_DOWN)

    await expect(enqueue('send-mail', job)).rejects.toThrow(/Resend: service unavailable/)
  })

  it('completes on a deliberate skip: no API key configured', async () => {
    // The real mail layer, unconfigured under test.
    await expect(enqueue('send-mail', job)).resolves.toMatchObject({ ok: true, skipped: true })
  })

  it('completes on a skip that a retry cannot fix', async () => {
    await expect(
      enqueue('send-mail', { ...job, template: 'no-such-template' }),
    ).resolves.toMatchObject({ ok: false, skipped: true })
    await expect(enqueue('send-mail', { ...job, to: '' })).resolves.toMatchObject({
      ok: false,
      skipped: true,
    })
  })
})

describe('request call sites', () => {
  it('queues the payment-received mail, and a provider failure does not fail the checkout', async () => {
    await paidCourse()
    sendSpy.mockResolvedValueOnce(PROVIDER_DOWN)

    const res = await submitUpiPayment()
    await settle()

    expect(res.status).toBe(201)
    const [[, mail]] = enqueuesOf('send-mail')
    expect(mail).toMatchObject({ template: 'payment-received', to: BUYER })
    expect(await countRows(transactions, { status: 'PENDING' })).toBe(1)
  })

  it('forgot-password does the same thing for known and unknown addresses', async () => {
    await signUp({ email: 'known@example.in' })
    enqueueSpy.mockClear()
    sendSpy.mockClear()

    const known = await agent()
      .post('/api/auth/forgot-password')
      .send({ email: 'known@example.in' })
    const unknown = await agent()
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.in' })
    await settle()

    expect(known.status).toBe(unknown.status)
    expect(known.body).toEqual(unknown.body)
    // Both requests queue the same job and nothing else; the lookup and the
    // token happen inside it.
    expect(enqueueSpy.mock.calls.map(([name, data]) => [name, data])).toEqual([
      ['send-password-reset', { email: 'known@example.in' }],
      ['send-password-reset', { email: 'unknown@example.in' }],
    ])
    expect(templatesSent()).toEqual(['set-password'])
    expect(sendSpy.mock.calls[0][1]).toBe('known@example.in')
  })

  it('forgot-password still answers 200 when the mail provider is down', async () => {
    await signUp({ email: 'known@example.in' })
    sendSpy.mockResolvedValueOnce(PROVIDER_DOWN)

    const res = await agent().post('/api/auth/forgot-password').send({ email: 'known@example.in' })
    await settle()

    expect(res.status).toBe(200)
    expect(sendSpy).toHaveBeenCalledOnce()
  })
})
