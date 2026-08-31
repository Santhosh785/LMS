import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Course, Customer, Enrollment, Transaction, User } from '../src/models/index.js'
import { agent, paidCourse, signUpAdmin } from './helpers/factories.js'

/**
 * The gateway client is stubbed at the module boundary, keeping every signing
 * and verification function real — those are the rules under test. `vi.hoisted`
 * is required because `vi.mock` is hoisted above the imports, so the spy has to
 * exist before this line runs.
 */
const { refundSpy, orderSpy } = vi.hoisted(() => ({
  refundSpy: vi.fn(),
  orderSpy: vi.fn(),
}))

vi.mock('../src/services/razorpay.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    razorpay: () => ({
      payments: { refund: refundSpy },
      orders: { create: orderSpy },
    }),
  }
})

/**
 * Razorpay (task 16).
 *
 * The gateway itself is stubbed — these test *our* rules, not Razorpay's
 * availability: signature verification, idempotency under redelivery, that the
 * price comes from the database, and that a full refund revokes access.
 */

const WEBHOOK_SECRET = 'test-razorpay-webhook-secret'
const ORDER_ID = 'order_TEST123'

const sign = (body, secret = WEBHOOK_SECRET) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex')

const capturedEvent = (paymentId = 'pay_TEST999', orderId = ORDER_ID, amount = 249900) =>
  JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, amount } } },
  })

const deliver = (body, signature) =>
  agent()
    .post('/api/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', signature)
    .send(body)

/** A PENDING gateway transaction, as the order endpoint would have created it. */
async function pendingOrder(course, overrides = {}) {
  const customer = await Customer.create({ name: 'Anjali R', email: 'anjali@example.in' })
  return Transaction.create({
    customerId: customer._id,
    customerName: 'Anjali R',
    contact: 'anjali@example.in',
    product: course.title,
    amount: 2499,
    status: 'PENDING',
    method: 'RAZORPAY',
    razorpayOrderId: ORDER_ID,
    courseId: course._id,
    courseSlug: course.slug,
    planName: '12 month access',
    planAccess: '12 months',
    buyer: { name: 'Anjali R', email: 'anjali@example.in', phone: '9876543210' },
    ...overrides,
  })
}

describe('razorpay webhook', () => {
  it('rejects a tampered payload and grants nothing', async () => {
    const course = await paidCourse()
    const txn = await pendingOrder(course)

    // Signature computed over a different body than the one sent.
    const res = await deliver(capturedEvent('pay_EVIL'), sign(capturedEvent()))

    expect(res.status).toBe(400)
    expect((await Transaction.findById(txn._id)).status).toBe('PENDING')
    expect(await Enrollment.countDocuments()).toBe(0)
  })

  it('rejects a signature made with the wrong secret', async () => {
    const course = await paidCourse()
    await pendingOrder(course)
    const body = capturedEvent()

    const res = await deliver(body, sign(body, 'not-the-secret'))

    expect(res.status).toBe(400)
    expect(await Enrollment.countDocuments()).toBe(0)
  })

  it('rejects a delivery with no signature at all', async () => {
    const course = await paidCourse()
    await pendingOrder(course)

    const res = await deliver(capturedEvent(), '')

    expect(res.status).toBe(400)
    expect(await Enrollment.countDocuments()).toBe(0)
  })

  it('grants access on a verified delivery, with the purchased expiry', async () => {
    const course = await paidCourse()
    const txn = await pendingOrder(course)
    const body = capturedEvent()

    const res = await deliver(body, sign(body))

    expect(res.status).toBe(200)
    const updated = await Transaction.findById(txn._id)
    expect(updated.status).toBe('SUCCESS')
    expect(updated.razorpayPaymentId).toBe('pay_TEST999')
    expect(updated.invoiceNo).toMatch(/^GS-\d{4}-\d{4}$/)

    const buyer = await User.findOne({ email: 'anjali@example.in' })
    expect(buyer).toBeTruthy()

    const enrollment = await Enrollment.findOne({ userId: buyer._id })
    expect(enrollment.source).toBe('paid')
    const months =
      (enrollment.expiresAt.getFullYear() - new Date().getFullYear()) * 12 +
      (enrollment.expiresAt.getMonth() - new Date().getMonth())
    expect(months).toBe(12)
  })

  it('grants access once when the same payment is redelivered', async () => {
    const course = await paidCourse()
    await pendingOrder(course)
    const body = capturedEvent()

    await deliver(body, sign(body))
    const second = await deliver(body, sign(body))

    // 200, or Razorpay retries forever.
    expect(second.status).toBe(200)
    expect(await Enrollment.countDocuments()).toBe(1)
    expect((await Course.findById(course._id)).enrolledCount).toBe(1)
  })

  it('does not mint a second invoice number on redelivery', async () => {
    const course = await paidCourse()
    const txn = await pendingOrder(course)
    const body = capturedEvent()

    await deliver(body, sign(body))
    const first = (await Transaction.findById(txn._id)).invoiceNo
    await deliver(body, sign(body))

    expect((await Transaction.findById(txn._id)).invoiceNo).toBe(first)
  })

  it('grants nothing for a payment against an unknown order', async () => {
    await paidCourse()
    const body = capturedEvent('pay_X', 'order_NOT_OURS')

    const res = await deliver(body, sign(body))

    // Acknowledged so Razorpay stops retrying, but nothing is granted.
    expect(res.status).toBe(200)
    expect(await Enrollment.countDocuments()).toBe(0)
  })

  it('leaves a PENDING transaction alone on payment.failed, so a retry can claim it', async () => {
    const course = await paidCourse()
    const txn = await pendingOrder(course)
    const body = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: { entity: { id: 'pay_F', order_id: ORDER_ID, error_description: 'declined' } },
      },
    })

    await deliver(body, sign(body))

    expect((await Transaction.findById(txn._id)).status).toBe('PENDING')
  })
})

describe('order creation', () => {
  beforeEach(() => {
    orderSpy.mockReset()
    orderSpy.mockResolvedValue({ id: ORDER_ID, amount: 249900, currency: 'INR' })
  })

  it('takes the amount from the database and ignores a client-supplied one', async () => {
    await paidCourse()

    const res = await agent().post('/api/checkout/razorpay/order').send({
      slug: 'seo-mastery',
      name: 'Anjali R',
      email: 'anjali@example.in',
      phone: '9876543210',
      plan: '12 month access',
      amount: 1, // the free-course exploit, if it were ever honoured
    })

    expect(res.status).toBe(201)
    // Razorpay works in paise: ₹2,499 must reach it as 249900, not 100.
    expect(orderSpy.mock.calls[0][0].amount).toBe(249900)
    expect(await Transaction.findOne({ amount: 1 })).toBeNull()
    expect((await Transaction.findOne({ razorpayOrderId: ORDER_ID })).amount).toBe(2499)
  })

  it('charges the tier the buyer chose, not the cheapest one', async () => {
    await paidCourse()

    await agent().post('/api/checkout/razorpay/order').send({
      slug: 'seo-mastery',
      name: 'Anjali R',
      email: 'anjali@example.in',
      phone: '9876543210',
      plan: 'Lifetime access',
    })

    expect(orderSpy.mock.calls[0][0].amount).toBe(499900)
    expect((await Transaction.findOne({})).planAccess).toBe('Lifetime')
  })

  it('rejects a plan that does not exist rather than falling back to a price', async () => {
    await paidCourse()

    const res = await agent().post('/api/checkout/razorpay/order').send({
      slug: 'seo-mastery',
      name: 'Anjali R',
      email: 'anjali@example.in',
      phone: '9876543210',
      plan: 'Made Up Plan',
    })

    expect(res.status).toBe(400)
    expect(await Transaction.countDocuments()).toBe(0)
  })

  it('grants no access at order time', async () => {
    await paidCourse()
    await agent().post('/api/checkout/razorpay/order').send({
      slug: 'seo-mastery',
      name: 'Anjali R',
      email: 'anjali@example.in',
      phone: '9876543210',
    })

    expect(await Enrollment.countDocuments()).toBe(0)
    expect(await User.countDocuments()).toBe(0)
  })
})

describe('refunds', () => {
  beforeEach(() => {
    refundSpy.mockReset()
    refundSpy.mockResolvedValue({ id: 'rfnd_TEST1' })
  })

  /** Drives a payment all the way to granted access, then refunds it. */
  async function paidAndGranted() {
    const course = await paidCourse()
    const txn = await pendingOrder(course)
    const body = capturedEvent()
    await deliver(body, sign(body))
    const buyer = await User.findOne({ email: 'anjali@example.in' })
    return { course, txn: await Transaction.findById(txn._id), buyer }
  }

  it('calls Razorpay before recording anything', async () => {
    const { txn } = await paidAndGranted()
    const { cookie } = await signUpAdmin()

    await agent()
      .post(`/api/admin/transactions/${txn._id}/refund`)
      .set('Cookie', cookie)
      .send({ amount: 2499, reason: 'Customer request' })

    expect(refundSpy).toHaveBeenCalledOnce()
    expect(refundSpy.mock.calls[0][0]).toBe('pay_TEST999')
    expect(refundSpy.mock.calls[0][1].amount).toBe(249900)
  })

  it('revokes access on a full refund', async () => {
    const { txn, buyer, course } = await paidAndGranted()
    const { cookie } = await signUpAdmin()

    const res = await agent()
      .post(`/api/admin/transactions/${txn._id}/refund`)
      .set('Cookie', cookie)
      .send({ amount: 2499, reason: 'Customer request' })

    expect(res.status).toBe(200)
    expect(res.body.full).toBe(true)
    expect((await Transaction.findById(txn._id)).status).toBe('REFUNDED')
    expect(await Enrollment.countDocuments({ userId: buyer._id, courseId: course._id })).toBe(0)
  })

  it('leaves access in place on a partial refund', async () => {
    const { txn, buyer } = await paidAndGranted()
    const { cookie } = await signUpAdmin()

    const res = await agent()
      .post(`/api/admin/transactions/${txn._id}/refund`)
      .set('Cookie', cookie)
      .send({ amount: 500, reason: 'Goodwill' })

    expect(res.status).toBe(200)
    expect(res.body.full).toBe(false)
    const updated = await Transaction.findById(txn._id)
    expect(updated.refundedAmount).toBe(500)
    expect(updated.status).toBe('SUCCESS')
    expect(await Enrollment.countDocuments({ userId: buyer._id })).toBe(1)
  })

  it('refuses to refund more than the remaining balance', async () => {
    const { txn } = await paidAndGranted()
    const { cookie } = await signUpAdmin()

    const res = await agent()
      .post(`/api/admin/transactions/${txn._id}/refund`)
      .set('Cookie', cookie)
      .send({ amount: 9999, reason: 'Oops' })

    expect(res.status).toBe(400)
    expect(refundSpy).not.toHaveBeenCalled()
  })

  it('refuses to refund a manual UPI payment through the gateway', async () => {
    const course = await paidCourse()
    const txn = await Transaction.create({
      customerName: 'Cash Buyer',
      contact: 'cash@example.in',
      product: course.title,
      amount: 2499,
      status: 'SUCCESS',
      method: 'MANUAL_UPI',
      utr: '999988887777',
      courseId: course._id,
    })
    const { cookie } = await signUpAdmin()

    const res = await agent()
      .post(`/api/admin/transactions/${txn._id}/refund`)
      .set('Cookie', cookie)
      .send({ amount: 2499, reason: 'Customer request' })

    expect(res.status).toBe(409)
    expect(res.body.details.code).toBe('NOT_A_GATEWAY_PAYMENT')
    expect(refundSpy).not.toHaveBeenCalled()
    // The bug this replaced: recording a refund that moved no money.
    expect((await Transaction.findById(txn._id)).refundedAmount).toBe(0)
  })
})
