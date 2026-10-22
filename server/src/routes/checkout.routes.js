import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { checkoutLimiter } from '../middleware/rateLimit.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { Course, Customer, Transaction } from '../models/index.js'
import { send } from '../mail/index.js'
import {
  isUpiConfigured,
  resolvePlan,
  upiIntentUri,
  upiQrDataUri,
  UTR_PATTERN,
} from '../services/upi.js'
import {
  isRazorpayConfigured,
  razorpay,
  toPaise,
  verifyPaymentSignature,
} from '../services/razorpay.js'
import { cfg } from '../services/runtimeConfig.js'

const router = Router()

/**
 * Manual UPI checkout — the sales channel that works on Day 1.
 *
 * Deliberately open to logged-out visitors. Requiring an account before payment
 * loses sales, and task 12 creates the account on approval, so there is nothing
 * to gain by putting a signup wall in front of the money.
 *
 * Nothing here grants access. A submitted UTR is a claim of payment; an operator
 * reconciles it against the bank statement and approves it in task 12. Anyone
 * can type twelve plausible digits.
 */

/** How long buyers are told to expect to wait. Quoted in the copy and the email. */
const VERIFICATION_WINDOW = 'within 24 hours'

/** Public: what the checkout page needs to render. */
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const course = await Course.findOne({ slug: req.params.slug }).lean()
    if (!course) throw new HttpError(404, 'Course not found')
    // Nothing that is not publicly on sale can be bought — task 13 drafts any
    // course whose lessons have no video, and taking money for one of those is
    // the exact failure the drafting exists to prevent.
    if (course.status !== 'Published' || course.visibility !== 'Public') {
      throw new HttpError(404, 'Course not found')
    }
    if (course.price === 'free') {
      throw new HttpError(400, 'This course is free — no payment is needed', {
        code: 'FREE_COURSE',
      })
    }

    const plan = resolvePlan(course, req.query.plan)
    if (!plan) throw new HttpError(400, 'That pricing plan is not available for this course')
    if (!plan.amount) {
      throw new HttpError(409, 'This course has no price set yet', { code: 'NO_PRICE' })
    }

    const gatewayLive = isRazorpayConfigured()
    if (!isUpiConfigured() && !gatewayLive) {
      // Nothing the buyer can do about it, and a QR pointing at an empty VPA
      // would send money nowhere. Fail visibly instead.
      throw new HttpError(503, 'Online payment is temporarily unavailable', {
        code: 'PAYMENT_UNCONFIGURED',
      })
    }

    const note = `${course.title}`.slice(0, 50)
    const uri = isUpiConfigured() ? upiIntentUri({ amount: plan.amount, note }) : null

    res.json({
      course: {
        slug: course.slug,
        title: course.title,
        summary: course.summary,
        thumbClass: course.thumbClass,
        mediaLabel: course.mediaLabel,
        hours: course.hours,
        moduleCount: course.sections?.length || 0,
      },
      plans: (course.pricingPlans || []).map((p) => ({
        name: p.name,
        price: p.price,
        access: p.access,
      })),
      plan,
      upi: uri
        ? {
            vpa: cfg.upiVpa,
            payeeName: cfg.upiPayeeName,
            intentUri: uri,
            qrDataUri: await upiQrDataUri(uri),
          }
        : null,
      // The key id is public by design — it identifies the merchant in
      // Razorpay's hosted checkout. The secret is not here and never will be.
      gateway: gatewayLive ? { provider: 'razorpay', keyId: cfg.razorpay.keyId } : null,
      verificationWindow: VERIFICATION_WINDOW,
    })
  }),
)

/* ------------------------------ Razorpay --------------------------------- */

/**
 * Creates a Razorpay order and the PENDING transaction that shadows it.
 *
 * **The amount is read from the database.** A client-supplied price is the
 * oldest exploit in online checkout, and here it would be a free-course exploit:
 * the request carries a slug and a plan name, never a number.
 *
 * This grants nothing. Access follows the verified webhook, which is the only
 * thing that knows whether money actually moved.
 */
router.post(
  '/razorpay/order',
  checkoutLimiter,
  body('slug').trim().notEmpty().withMessage('Course is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('phone')
    .trim()
    .matches(/^[+0-9 ()-]{8,20}$/)
    .withMessage('Enter a valid phone number'),
  validate,
  asyncHandler(async (req, res) => {
    if (!isRazorpayConfigured()) {
      throw new HttpError(503, 'Card and netbanking payment is temporarily unavailable', {
        code: 'GATEWAY_UNCONFIGURED',
      })
    }

    const { slug, name, email, phone, plan: planName } = req.body
    const course = await Course.findOne({ slug }).lean()
    if (!course) throw new HttpError(404, 'Course not found')
    if (course.status !== 'Published' || course.visibility !== 'Public') {
      throw new HttpError(404, 'Course not found')
    }
    if (course.price === 'free') {
      throw new HttpError(400, 'This course is free — no payment is needed', {
        code: 'FREE_COURSE',
      })
    }

    const plan = resolvePlan(course, planName)
    if (!plan) {
      throw new HttpError(400, 'Validation failed', { plan: 'That pricing plan is not available' })
    }
    if (!plan.amount) {
      throw new HttpError(409, 'This course has no price set yet', { code: 'NO_PRICE' })
    }

    const customer = await Customer.findOneAndUpdate(
      { email },
      {
        $set: { name, product: course.title },
        $setOnInsert: { joinedAt: new Date(), status: 'Trial' },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )

    const order = await razorpay().orders.create({
      amount: toPaise(plan.amount),
      currency: 'INR',
      // Razorpay caps receipt at 40 chars.
      receipt: String(customer._id).slice(-24),
      notes: { slug: course.slug, plan: plan.name || '', email },
    })

    const transaction = await Transaction.create({
      date: new Date(),
      customerId: customer._id,
      customerName: name,
      contact: email,
      product: course.title,
      amount: plan.amount,
      currency: 'INR',
      cycle: 'ONETIME',
      status: 'PENDING',
      method: 'RAZORPAY',
      razorpayOrderId: order.id,
      courseId: course._id,
      courseSlug: course.slug,
      planName: plan.name,
      planAccess: plan.access,
      buyer: { name, email, phone },
    })

    res.status(201).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: cfg.razorpay.keyId,
      transactionId: String(transaction._id),
      courseTitle: course.title,
      buyer: { name, email, phone },
    })
  }),
)

/**
 * The browser callback, after Razorpay Checkout closes.
 *
 * **Purely for what the buyer is shown.** It does not grant access and must not
 * be trusted to: a buyer who closes the tab mid-redirect never reaches this
 * endpoint and has still paid. The webhook is the source of truth; this exists
 * so the page can say "done" instead of "we'll email you" in the common case.
 */
router.post(
  '/razorpay/callback',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body
    const valid = verifyPaymentSignature({ orderId, paymentId, signature })
    if (!valid) {
      throw new HttpError(400, 'That payment could not be verified', { code: 'BAD_SIGNATURE' })
    }

    // Report what the webhook has already done, if it has arrived — it usually
    // beats the redirect, but not always, and either answer is honest.
    const txn = await Transaction.findOne({ razorpayOrderId: orderId }).lean()
    res.json({
      ok: true,
      status: txn?.status || 'PENDING',
      courseSlug: txn?.courseSlug,
      settled: txn?.status === 'SUCCESS',
    })
  }),
)

/**
 * Records a claimed payment. Creates a PENDING transaction and a customer, and
 * sends the payment-received email. Grants nothing.
 */
router.post(
  '/upi',
  checkoutLimiter,
  body('slug').trim().notEmpty().withMessage('Course is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('phone')
    .trim()
    .matches(/^[+0-9 ()-]{8,20}$/)
    .withMessage('Enter a valid phone number'),
  body('utr')
    .trim()
    .matches(UTR_PATTERN)
    .withMessage('Enter the reference number shown in your UPI app'),
  validate,
  asyncHandler(async (req, res) => {
    const { slug, name, email, phone, utr, plan: planName } = req.body

    const course = await Course.findOne({ slug }).lean()
    if (!course) throw new HttpError(404, 'Course not found')
    // Nothing that is not publicly on sale can be bought — task 13 drafts any
    // course whose lessons have no video, and taking money for one of those is
    // the exact failure the drafting exists to prevent.
    if (course.status !== 'Published' || course.visibility !== 'Public') {
      throw new HttpError(404, 'Course not found')
    }
    if (course.price === 'free') {
      throw new HttpError(400, 'This course is free — no payment is needed', {
        code: 'FREE_COURSE',
      })
    }

    // The amount is read here, never taken from the request. A client-supplied
    // price is the oldest exploit in online checkout.
    const plan = resolvePlan(course, planName)
    if (!plan) {
      throw new HttpError(400, 'Validation failed', { plan: 'That pricing plan is not available' })
    }

    // Checked explicitly so the buyer gets a field-level message rather than the
    // generic duplicate-key envelope. The partial unique index on Transaction is
    // still the real guard — this check races, that one does not.
    const clash = await Transaction.exists({ utr, status: { $in: ['PENDING', 'SUCCESS'] } })
    if (clash) {
      throw new HttpError(409, 'Validation failed', {
        utr: 'That reference has already been submitted. Check the number, or write to support if you paid twice.',
      })
    }

    const customer = await Customer.findOneAndUpdate(
      { email },
      {
        $set: { name, product: course.title },
        $setOnInsert: { joinedAt: new Date(), status: 'Trial' },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )

    let transaction
    try {
      transaction = await Transaction.create({
        date: new Date(),
        customerId: customer._id,
        customerName: name,
        contact: email,
        product: course.title,
        amount: plan.amount,
        currency: 'INR',
        cycle: 'ONETIME',
        status: 'PENDING',
        method: 'MANUAL_UPI',
        utr,
        courseId: course._id,
        courseSlug: course.slug,
        planName: plan.name,
        planAccess: plan.access,
        buyer: { name, email, phone },
      })
    } catch (err) {
      // The index caught a duplicate the check above raced past.
      if (err?.code === 11000) {
        throw new HttpError(409, 'Validation failed', {
          utr: 'That reference has already been submitted.',
        })
      }
      throw err
    }

    // Not awaited: a slow or failing mail provider must not make a buyer think
    // their payment was not recorded. The transaction is the record; this is a
    // notification about it, and `send` swallows its own failures.
    void send('payment-received', email, {
      name,
      courseTitle: course.title,
      amount: plan.amount,
      utr,
      transactionId: String(transaction._id),
      verificationWindow: VERIFICATION_WINDOW,
    })

    res.status(201).json({
      ok: true,
      transactionId: String(transaction._id),
      status: 'PENDING',
      verificationWindow: VERIFICATION_WINDOW,
    })
  }),
)

export default router
