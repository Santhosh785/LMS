/**
 * Single source of truth for the business details quoted on the legal and
 * policy pages (privacy, terms, refund, delivery, contact).
 *
 * IMPORTANT: anything the business owner still has to supply is deliberately
 * left as `null` here. A null value renders through <Tbc> as a highlighted
 * `[[ TO BE CONFIRMED: ... ]]` marker on the live page. Never replace a null
 * with a guess — these are legal documents and an invented refund window or
 * registered address is far worse than an obvious blank.
 *
 * To go live: fill every null below, then the markers disappear on their own.
 */
export const business = {
  /** Trading / brand name shown to learners. */
  brandName: 'Growth Scholar',
  /** Registered legal entity that holds the bank account and Razorpay merchant ID. */
  legalName: null,
  /** Support inbox — matches the default in server/src/models/Setting.js. */
  supportEmail: 'support@growthscholar.in',
  /** Sales / pre-purchase enquiries. */
  salesEmail: 'hello@growthscholar.in',
  /** Publicly listed support phone number (Razorpay's review looks for one). */
  phone: null,
  /** Full registered office address, including PIN code. */
  address: null,
  /** City whose courts have exclusive jurisdiction under the Terms. */
  jurisdictionCity: null,
  /** Days and hours the support team answers, e.g. "Mon–Sat, 10:00–19:00 IST". */
  supportHours: null,
  /** Grievance officer's name (required by the IT Rules / DPDP Act). */
  grievanceOfficer: null,
  /** Shown as "Last updated" on every policy page. */
  policyLastUpdated: '10 August 2026',
}

/**
 * The commercial terms that change the meaning of the refund and delivery
 * policies. All null until the owner confirms them — see the note above.
 */
export const policyTerms = {
  /** How long an admin takes to verify a UPI payment and open access. */
  paymentConfirmationSla: null,
  /** Days after access is granted during which a refund can be requested. */
  refundWindowDays: null,
  /** How much of a course may be consumed and still qualify for a refund. */
  refundConsumptionLimit: null,
  /** Working days taken to send an approved refund back to the payer. */
  refundProcessingDays: null,
  /** Notice needed to cancel a seat in a LIVE batch or workshop. */
  liveCancellationCutoff: null,
}

/** Every policy page, in the order they are listed in the site footer. */
export const legalNav = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Use', to: '/terms' },
  { label: 'Refund Policy', to: '/refund' },
  { label: 'Delivery Policy', to: '/delivery' },
  { label: 'Contact Us', to: '/contact' },
]
