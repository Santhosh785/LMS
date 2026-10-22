import dotenv from 'dotenv'

dotenv.config()

/**
 * Feature flags are opt-in: anything not explicitly switched on stays off, so a
 * deployment that forgets the variable ships the safe state rather than the
 * half-built one.
 */
const flag = (value) =>
  ['1', 'true', 'yes', 'on'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  )

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/growth-scholar',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isProd: process.env.NODE_ENV === 'production',
  /**
   * Under test the module must not open a connection or bind a port — supertest
   * drives the exported `app` directly, and the suite owns the database
   * lifecycle so it can guarantee which database it is pointed at.
   */
  isTest: process.env.NODE_ENV === 'test',

  // Reverse proxies in front of the app (0 = none, exposed directly). Login
  // rate limiting keys on req.ip, so behind an unacknowledged proxy every
  // visitor would share the proxy's IP and one bucket. Set it to the real hop
  // count and no higher — extra hops are client-spoofable via X-Forwarded-For.
  trustProxy: Number.isFinite(Number(process.env.TRUST_PROXY))
    ? Number(process.env.TRUST_PROXY)
    : 0,

  // Shared password for the seeded accounts. Required by `npm run seed`, which
  // aborts when it is missing rather than falling back to a repo-visible value.
  seedPassword: process.env.SEED_PASSWORD || '',

  /**
   * The single real operator account (task 13). Password reset and every
   * operational notification land here, so it must be a monitored mailbox — an
   * alias nobody reads means a locked-out admin stays locked out.
   */
  adminEmail: (process.env.ADMIN_EMAIL || 'team@growthscholar.in').toLowerCase(),

  // Bunny Stream playback signing (task 8)
  bunnyLibraryId: process.env.BUNNY_LIBRARY_ID || '',
  bunnySecurityKey: process.env.BUNNY_SECURITY_KEY || '',

  /**
   * Bunny Stream management API (task 22 — in-app video upload). The library
   * API key authorises create/read/delete against video.bunnycdn.com and signs
   * TUS upload requests. Server-side only — the browser gets a per-video
   * signature, never this key. Unset means uploads fall back to the manual
   * paste-a-GUID flow; playback signing above keeps working regardless.
   */
  bunnyApiKey: process.env.BUNNY_API_KEY || '',

  /**
   * Bunny webhooks carry no signature, so the URL itself carries a shared
   * secret: /api/webhooks/bunny?token=<this>. Unset disables the endpoint —
   * an unauthenticated status-update endpoint is worse than polling.
   */
  bunnyWebhookToken: process.env.BUNNY_WEBHOOK_TOKEN || '',

  /**
   * Bunny Storage — the object store behind the Media Library's images.
   *
   * A different product from the Stream settings above: `zone` is the storage
   * zone name, `password` its access key, `region` the storage endpoint prefix
   * ('' for the default German zone) and `host` the Pull Zone hostname images
   * are actually served from. All four blank means image uploads stay on the
   * server's own disk, which is the previous behaviour.
   */
  bunnyStorageZone: process.env.BUNNY_STORAGE_ZONE || '',
  bunnyStoragePassword: process.env.BUNNY_STORAGE_PASSWORD || '',
  bunnyStorageRegion: process.env.BUNNY_STORAGE_REGION || '',
  bunnyStorageHost: process.env.BUNNY_STORAGE_HOST || '',

  // Resend transactional email (task 7)
  resendApiKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || '',

  // Absolute base for links inside emails. In production the SPA and the API
  // share one origin (task 14), so this is simply the public site URL; in
  // development it is the Vite dev server, not the API port.
  siteUrl: (process.env.PUBLIC_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(
    /\/+$/,
    '',
  ),

  /**
   * Sender identity printed in the footer of every transactional email. Indian
   * consumers expect a named business with a reachable address, and bulk
   * filters weight its presence — so this is deliverability, not decoration.
   * Mirrors `client/src/data/legal.js`; fill both when the entity is confirmed.
   */
  business: {
    name: process.env.BUSINESS_LEGAL_NAME || 'Growth Scholar',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@growthscholar.in',
    address: process.env.BUSINESS_ADDRESS || '',
  },

  // UPI checkout (task 10)
  upiVpa: process.env.UPI_VPA || '',
  upiPayeeName: process.env.UPI_PAYEE_NAME || '',

  /**
   * Razorpay (task 16). The key id is public — it ships in the client bundle by
   * design. The key secret signs API calls and the webhook secret verifies
   * incoming deliveries; neither ever leaves the server.
   *
   * `webhookSecret` is set independently of the API keys in the Razorpay
   * dashboard, so it is possible to have working payments and a webhook that
   * verifies nothing. Both are required before the gateway is considered live.
   */
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  /** Prefix for the sequential invoice numbers on the Transaction model. */
  invoicePrefix: process.env.INVOICE_PREFIX || 'GS',

  /**
   * Error tracking (task 19). Unset means errors are logged locally only — the
   * same no-op-rather-than-break contract the mail layer uses.
   */
  sentryDsn: process.env.SENTRY_DSN || '',
  /** Stamped on every event so a regression can be tied to a deploy. */
  release: process.env.RELEASE || '',

  /**
   * Modules whose admin UI is finished but whose backing behaviour is not.
   * Off by default, which hides them in three places at once: the admin
   * navigation, the client routes (both read the flags from GET /api/config)
   * and the API itself (see middleware/features.js). Turning one back on is a
   * deploy-time change, not a code change — nothing here was deleted.
   *
   *   funnels      — no public /f/* pages exist, so every lead and view number
   *                  a funnel reports is invented.
   *   email        — broadcasts have no mail transport; Send marks a campaign
   *                  sent and mails nobody.
   *   gamification — nothing awards seeds, so badges never unlock and the
   *                  leaderboard only ever shows seeded rows.
   */
  features: {
    funnels: flag(process.env.FEATURE_FUNNELS),
    email: flag(process.env.FEATURE_EMAIL),
    gamification: flag(process.env.FEATURE_GAMIFICATION),
  },
}

if (env.isProd && env.jwtSecret === 'dev-only-insecure-secret') {
  throw new Error('JWT_SECRET must be set in production')
}
