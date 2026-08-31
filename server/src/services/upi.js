import QRCode from 'qrcode'
import { cfg } from './runtimeConfig.js'

/**
 * Manual UPI checkout.
 *
 * Razorpay activation needs KYC review plus published policy pages and takes
 * 2–7 business days, which cannot be compressed. This is the interim sales
 * channel: a real, recorded checkout that takes money today and is replaced by
 * the gateway in task 16 without losing a single row — both paths converge on
 * the same `Transaction` and the same `grantAccess`.
 */

export const isUpiConfigured = () => Boolean(cfg.upiVpa && cfg.upiPayeeName)

/**
 * A standard UPI deep link. Every Indian payments app understands it and
 * pre-fills payee, name and amount, so the buyer types nothing that could go to
 * the wrong account.
 *
 *   pa  payee address (VPA)   pn  payee name
 *   am  amount                cu  currency
 *   tn  transaction note      tr  our reference
 *
 * `am` is fixed to two decimals: some apps reject "2499" where they accept
 * "2499.00", and a rejected intent looks to the buyer like a broken checkout.
 */
export function upiIntentUri({ amount, note, reference }) {
  const params = new URLSearchParams({
    pa: cfg.upiVpa,
    pn: cfg.upiPayeeName,
    am: Number(amount).toFixed(2),
    cu: 'INR',
  })
  if (note) params.set('tn', note)
  if (reference) params.set('tr', reference)
  return `upi://pay?${params.toString()}`
}

/**
 * The QR as an SVG data URI. SVG rather than PNG because task 15 requires it to
 * stay scannable from a second device at 360px — a raster QR blown up to fill a
 * phone card is exactly the case where scanning starts failing.
 *
 * Error correction 'M' tolerates a little glare and camera angle without making
 * the modules so dense that a small render loses them.
 */
export async function upiQrDataUri(uri) {
  const svg = await QRCode.toString(uri, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#0d3f3d', light: '#ffffff' },
  })
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * A UTR (Unique Transaction Reference) is the 12-digit number a UPI app shows
 * after a transfer. Banks are not perfectly consistent — some show a 16- or
 * 22-character RRN — so this checks for something plausible rather than
 * enforcing a format that would reject a real payment. The operator verifies it
 * against the bank statement either way; this only catches "asdf".
 */
export const UTR_PATTERN = /^[A-Za-z0-9]{9,25}$/

/**
 * Chooses the plan a buyer is paying for. Returns null when they named a plan
 * that does not exist — the caller must reject rather than quietly fall back,
 * because falling back to a different price is how someone ends up charged for
 * a tier they did not choose.
 *
 * The amount always comes from the database. A client-supplied amount is a
 * free-course exploit, and task 16 inherits the same rule for Razorpay orders.
 */
export function resolvePlan(course, planName) {
  const plans = course.pricingPlans || []

  if (planName) {
    const chosen = plans.find((p) => p.name === planName)
    if (!chosen) return null
    return { name: chosen.name, amount: chosen.price, access: chosen.access }
  }

  const first = plans[0]
  if (first) return { name: first.name, amount: first.price, access: first.access }

  // No pricing plans configured: the course's own `amount` is the price shown on
  // the course page, so it is the price that must be charged.
  return { name: null, amount: course.amount, access: 'Lifetime' }
}
