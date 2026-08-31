import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import { Counter } from '../models/index.js'
import { cfg } from './runtimeConfig.js'

/**
 * Razorpay — the only place the SDK and its signing rules live.
 *
 * The one rule everything else follows: **the webhook is the source of truth.**
 * A buyer who closes the tab mid-redirect has still paid and must still receive
 * access, so the browser callback exists purely for redirect UX and grants
 * nothing on its own.
 */

let client = null

export const isRazorpayConfigured = () => Boolean(cfg.razorpay.keyId && cfg.razorpay.keySecret)

/** Payments can be live while the webhook secret is missing — check separately. */
export const isWebhookConfigured = () => Boolean(cfg.razorpay.webhookSecret)

export function razorpay() {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)')
  }
  if (!client) {
    client = new Razorpay({ key_id: cfg.razorpay.keyId, key_secret: cfg.razorpay.keySecret })
  }
  return client
}

/** Razorpay works in paise. ₹2,499 is 249900. */
export const toPaise = (rupees) => Math.round(Number(rupees) * 100)
export const toRupees = (paise) => Number(paise) / 100

/**
 * Constant-time comparison. A plain `===` on a signature leaks, through timing,
 * how many leading bytes a forgery got right, which is enough to construct one
 * byte at a time.
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8')
  const bufB = Buffer.from(String(b), 'utf8')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Verifies a webhook delivery.
 *
 * **Must be given the raw request body, byte for byte.** Razorpay signs the
 * exact bytes it sent; re-serialising a parsed object changes key order and
 * whitespace and every signature fails. That is why the webhook route is mounted
 * with `express.raw` ahead of the JSON body parser.
 *
 * An unverified webhook endpoint is an open door to granting free access —
 * anyone who learns the URL can POST themselves a course.
 */
export function verifyWebhookSignature(rawBody, signature) {
  if (!isWebhookConfigured() || !signature) return false
  const expected = crypto
    .createHmac('sha256', cfg.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex')
  return safeEqual(expected, signature)
}

/**
 * Verifies the browser callback after Razorpay Checkout closes.
 *
 * Signed with the API key secret over `order_id|payment_id` — a different secret
 * and a different payload from the webhook above. Used only to decide what to
 * show the buyer; access still waits for the webhook.
 */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!isRazorpayConfigured() || !signature) return false
  const expected = crypto
    .createHmac('sha256', cfg.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return safeEqual(expected, signature)
}

/**
 * Sequential invoice numbers, e.g. `GS-2026-0142`.
 *
 * The business is not GST-registered, so an invoice carries no tax component and
 * prices are all-inclusive. Watch the ₹20L threshold — crossing it makes
 * registration compulsory and changes what has to appear here.
 */
export async function nextInvoiceNo(now = new Date()) {
  const seq = await Counter.next('invoice')
  return `${cfg.invoicePrefix}-${now.getFullYear()}-${String(seq).padStart(4, '0')}`
}
