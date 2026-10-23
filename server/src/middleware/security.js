import crypto from 'node:crypto'
import helmet from 'helmet'

/**
 * Security headers.
 *
 * Third-party origins the app legitimately needs. Helmet's stock policy falls
 * back to default-src 'self' for frames and media, which would kill the Bunny
 * player outright, so the origins are named here rather than dropping the CSP.
 */
const FONTSHARE_CSS = 'https://api.fontshare.com' // <link> from client/src/root.tsx links()
const FONTSHARE_FILES = 'https://cdn.fontshare.com' // the woff2 files that CSS pulls
const BUNNY_EMBED = 'https://iframe.mediadelivery.net' // Bunny Stream player iframe
const BUNNY_CDN = 'https://*.b-cdn.net' // vz-*.b-cdn.net: HLS segments + thumbnails
// Razorpay's hosted checkout (task 16). It injects a script, opens its payment
// form in an iframe and beacons telemetry, so it needs all four directives —
// miss one and the modal opens blank, which reads to a buyer as a broken
// checkout rather than a policy error.
const RZP_CHECKOUT = 'https://checkout.razorpay.com'
const RZP_API = 'https://api.razorpay.com'
const RZP_TELEMETRY = 'https://lumberjack.razorpay.com'
const RZP_CDN = 'https://cdn.razorpay.com'

/**
 * A fresh nonce per request, for the inline scripts React Router emits
 * (hydration data, scroll restoration). Registered before helmet, which reads
 * it back through the function value in `script-src` below.
 */
export function cspNonce(_req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64')
  next()
}

/**
 * The `script-src` sources.
 *
 * Production: 'self', Razorpay and the request nonce (a function, so helmet
 * evaluates it per request). Development: 'unsafe-inline' instead, for Vite's
 * dev client preamble — and *not* the nonce alongside it, because a browser
 * ignores 'unsafe-inline' whenever a nonce is present in the same directive,
 * which would block the dev client. Never 'unsafe-inline' in production.
 *
 * @param {{ isProd: boolean }} options
 */
export function scriptSrc({ isProd }) {
  return isProd
    ? ["'self'", RZP_CHECKOUT, (_req, res) => `'nonce-${res.locals.cspNonce}'`]
    : ["'self'", RZP_CHECKOUT, "'unsafe-inline'"]
}

/** @param {{ isProd: boolean }} options */
export function securityHeaders({ isProd }) {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
        'script-src': scriptSrc({ isProd }),
        'style-src': ["'self'", "'unsafe-inline'", FONTSHARE_CSS],
        'font-src': ["'self'", 'data:', FONTSHARE_FILES, FONTSHARE_CSS],
        /*
         * `https:` rather than a host list, because image URLs are now operator
         * input: the logo, favicon, course covers, workshop banners and blog
         * heroes are all pasted into the admin panel and can point at any CDN.
         * A fixed allowlist would block whatever host the client actually uses,
         * and the failure only appears in production — the dev server does not
         * apply this policy, so it would have shipped looking fine.
         *
         * Widened for images only. Scripts, frames and connections stay pinned
         * to named hosts, which is where the real risk is.
         */
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https:',
          BUNNY_CDN,
          BUNNY_EMBED,
          RZP_CDN,
          RZP_CHECKOUT,
        ],
        'media-src': ["'self'", 'blob:', BUNNY_CDN],
        'frame-src': ["'self'", BUNNY_EMBED, RZP_CHECKOUT, RZP_API],
        'connect-src': ["'self'", BUNNY_CDN, RZP_API, RZP_CHECKOUT, RZP_TELEMETRY],
        // Only meaningful once the site is on https; in development it would
        // rewrite http://localhost API calls and break them.
        'upgrade-insecure-requests': isProd ? [] : null,
      },
    },
  })
}
