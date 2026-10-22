import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: String,
    contact: String,
    product: String,
    quantity: { type: Number, default: 1 },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    cycle: { type: String, enum: ['ONETIME', 'SUBSCRIPTION'], default: 'ONETIME' },
    status: {
      type: String,
      enum: ['SUCCESS', 'REFUNDED', 'FAILED', 'PENDING'],
      default: 'SUCCESS',
      index: true,
    },
    refundedAmount: { type: Number, default: 0 },
    invoiceNo: String,

    /* ------------------------- checkout (task 10) ------------------------- */
    /** How the money arrived. MANUAL_UPI until the gateway lands in task 16. */
    method: {
      type: String,
      enum: ['MANUAL_UPI', 'RAZORPAY', 'OTHER'],
      default: 'OTHER',
      index: true,
    },
    /**
     * The buyer's UPI transaction reference, typed in from their payments app.
     * It is a *claim* of payment, not proof — anyone can invent twelve digits —
     * which is why nothing here grants access until an operator reconciles it
     * against the bank statement (task 12).
     */
    utr: { type: String, trim: true },
    /** What was bought, resolvable after the fact even if the title changes. */
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },
    courseSlug: String,
    /** Which `Course.pricingPlans` entry, so expiry can be derived on approval. */
    planName: String,
    planAccess: { type: String, enum: ['Lifetime', '12 months', '6 months'] },
    /** Buyer contact captured at checkout — they may have no account yet. */
    buyer: {
      name: String,
      email: { type: String, lowercase: true, trim: true },
      phone: String,
    },
    /* ------------------------- Razorpay (task 16) ------------------------- */
    razorpayOrderId: { type: String, index: true },
    /**
     * The gateway's payment id. Unique where present — Razorpay retries a
     * webhook on any non-2xx and duplicate delivery is routine, so this index is
     * the last line of defence against granting access twice for one payment.
     */
    razorpayPaymentId: { type: String },
    razorpayRefundIds: [String],

    /* -------------------------- review (task 12) -------------------------- */
    reviewedAt: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Why a transaction was rejected, so the queue can be cleared honestly. */
    failureReason: String,
  },
  { timestamps: true },
)

/**
 * One UTR may back one live claim. The filter is deliberate: a reference already
 * PENDING or SUCCESS cannot be submitted again — that is someone copying another
 * buyer's reference, or double-submitting a form — while a FAILED one is free to
 * reuse, because the usual reason a transaction fails is that the buyer mistyped
 * their own reference and needs to enter it correctly.
 */
transactionSchema.index(
  { utr: 1 },
  {
    unique: true,
    partialFilterExpression: { utr: { $type: 'string' }, status: { $in: ['PENDING', 'SUCCESS'] } },
  },
)

// The admin queue filters by status and orders by date together.
transactionSchema.index({ status: 1, date: -1 })

// One payment, one transaction — see the note on razorpayPaymentId.
transactionSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } },
)

export default mongoose.model('Transaction', transactionSchema)
