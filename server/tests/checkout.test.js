import { describe, expect, it } from 'vitest'
import { Customer, Enrollment, Transaction, User } from '../src/models/index.js'
import { agent, paidCourse, signUpAdmin, submitUpiPayment } from './helpers/factories.js'

/**
 * Manual UPI checkout (task 10) and admin approval (task 12).
 *
 * The load-bearing assertion in the first block is that checkout grants
 * **nothing**: a typed UTR is a claim of payment, not proof, and anyone can
 * invent twelve digits.
 */
describe('manual UPI checkout', () => {
  it('creates a PENDING transaction and a customer', async () => {
    const course = await paidCourse()
    const res = await submitUpiPayment()

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('PENDING')

    const txn = await Transaction.findById(res.body.transactionId)
    expect(txn.status).toBe('PENDING')
    expect(txn.utr).toBe('429518847213')
    expect(txn.courseId.toString()).toBe(course._id.toString())
    expect(txn.buyer.email).toBe('anjali@example.in')
    expect(await Customer.countDocuments({ email: 'anjali@example.in' })).toBe(1)
  })

  it('grants no access whatsoever', async () => {
    await paidCourse()
    await submitUpiPayment()

    expect(await Enrollment.countDocuments()).toBe(0)
    expect(await User.countDocuments()).toBe(0)
  })

  it('takes the amount from the database, ignoring anything the client sends', async () => {
    await paidCourse()
    const res = await agent().post('/api/checkout/upi').send({
      slug: 'seo-mastery',
      name: 'Anjali R',
      email: 'anjali@example.in',
      phone: '9876543210',
      utr: '429518847213',
      amount: 1,
      plan: '12 month access',
    })

    const txn = await Transaction.findById(res.body.transactionId)
    expect(txn.amount).toBe(2499)
  })

  it('rejects a duplicate UTR', async () => {
    await paidCourse()
    await submitUpiPayment()

    const res = await submitUpiPayment({ email: 'someone.else@example.in' })

    expect(res.status).toBe(409)
    expect(res.body.details.utr).toBeTruthy()
    expect(await Transaction.countDocuments()).toBe(1)
  })

  it('rejects malformed input with field-level errors', async () => {
    await paidCourse()
    const res = await agent()
      .post('/api/checkout/upi')
      .send({ slug: 'seo-mastery', name: 'A', email: 'not-an-email', phone: '', utr: 'x' })

    expect(res.status).toBe(400)
    expect(res.body.details.email).toBeTruthy()
    expect(res.body.details.phone).toBeTruthy()
    expect(res.body.details.utr).toBeTruthy()
  })

  it('refuses a course that is not on public sale', async () => {
    await paidCourse({ status: 'Draft' })
    const res = await submitUpiPayment()
    expect(res.status).toBe(404)
  })
})

describe('admin approval', () => {
  const approve = async (id, cookie) =>
    agent().post(`/api/admin/transactions/${id}/approve`).set('Cookie', cookie).send({})

  it('grants exactly one enrollment and creates the buyer account', async () => {
    const course = await paidCourse()
    const { cookie } = await signUpAdmin()
    const { body } = await submitUpiPayment({ plan: '12 month access' })

    const res = await approve(body.transactionId, cookie)

    expect(res.status).toBe(200)
    expect(res.body.accountCreated).toBe(true)

    const buyer = await User.findOne({ email: 'anjali@example.in' })
    expect(buyer).toBeTruthy()
    expect(await Enrollment.countDocuments({ userId: buyer._id })).toBe(1)
    expect((await Transaction.findById(body.transactionId)).status).toBe('SUCCESS')
    expect((await course.constructor.findById(course._id)).enrolledCount).toBe(1)
  })

  it('sets expiresAt from the purchased plan tier', async () => {
    await paidCourse()
    const { cookie } = await signUpAdmin()
    const { body } = await submitUpiPayment({ plan: '12 month access' })

    await approve(body.transactionId, cookie)

    const enrollment = await Enrollment.findOne({})
    const months =
      (enrollment.expiresAt.getFullYear() - new Date().getFullYear()) * 12 +
      (enrollment.expiresAt.getMonth() - new Date().getMonth())
    expect(months).toBe(12)
    expect(enrollment.source).toBe('manual')
  })

  it('yields a null expiresAt for a Lifetime plan', async () => {
    await paidCourse()
    const { cookie } = await signUpAdmin()
    const { body } = await submitUpiPayment({ plan: 'Lifetime access' })

    await approve(body.transactionId, cookie)

    expect((await Enrollment.findOne({})).expiresAt).toBeNull()
  })

  it('does not double-enroll or double-charge the counter when approved twice', async () => {
    const course = await paidCourse()
    const { cookie } = await signUpAdmin()
    const { body } = await submitUpiPayment()

    await approve(body.transactionId, cookie)
    const second = await approve(body.transactionId, cookie)

    expect(second.status).toBe(200)
    expect(second.body.alreadyProcessed).toBe(true)
    expect(await Enrollment.countDocuments()).toBe(1)
    expect((await course.constructor.findById(course._id)).enrolledCount).toBe(1)
  })

  it('matches an existing account by email instead of creating a second one', async () => {
    await paidCourse()
    const { cookie } = await signUpAdmin()
    await User.create({
      name: 'Anjali R',
      email: 'anjali@example.in',
      passwordHash: await User.hashPassword('an-existing-password'),
    })
    const before = await User.countDocuments()

    const { body } = await submitUpiPayment()
    const res = await approve(body.transactionId, cookie)

    expect(res.body.accountCreated).toBe(false)
    expect(await User.countDocuments()).toBe(before)
  })

  it('assigns a sequential invoice number on approval', async () => {
    await paidCourse()
    const { cookie } = await signUpAdmin()
    const first = await submitUpiPayment({ utr: '111111111111' })
    const second = await submitUpiPayment({ utr: '222222222222', email: 'b@example.in' })

    await approve(first.body.transactionId, cookie)
    await approve(second.body.transactionId, cookie)

    const a = await Transaction.findById(first.body.transactionId)
    const b = await Transaction.findById(second.body.transactionId)
    expect(a.invoiceNo).toMatch(/^GS-\d{4}-0001$/)
    expect(b.invoiceNo).toMatch(/^GS-\d{4}-0002$/)
  })

  it('can reject a payment as FAILED with a reason, granting nothing', async () => {
    await paidCourse()
    const { cookie } = await signUpAdmin()
    const { body } = await submitUpiPayment()

    const res = await agent()
      .post(`/api/admin/transactions/${body.transactionId}/reject`)
      .set('Cookie', cookie)
      .send({ reason: 'No matching credit in the statement' })

    expect(res.status).toBe(200)
    const txn = await Transaction.findById(body.transactionId)
    expect(txn.status).toBe('FAILED')
    expect(txn.failureReason).toBe('No matching credit in the statement')
    expect(await Enrollment.countDocuments()).toBe(0)
  })

  it('refuses approval to a non-admin', async () => {
    await paidCourse()
    const { body } = await submitUpiPayment()
    const { signUp } = await import('./helpers/factories.js')
    const { cookie } = await signUp()

    const res = await approve(body.transactionId, cookie)
    expect(res.status).toBe(403)
    expect(await Enrollment.countDocuments()).toBe(0)
  })
})
