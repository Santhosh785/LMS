import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'

import { env } from './config/env.js'
import { connectDb } from './config/db.js'
import { accessLogStream, captureMessage, initObservability } from './config/observability.js'
import { attachUser } from './middleware/auth.js'
import { errorHandler, notFound } from './middleware/error.js'

import configRoutes from './routes/config.routes.js'
import showcaseRoutes from './routes/showcase.routes.js'
import { refreshRuntimeConfig } from './services/runtimeConfig.js'
import authRoutes from './routes/auth.routes.js'
import courseRoutes from './routes/course.routes.js'
import programRoutes from './routes/program.routes.js'
import workshopRoutes from './routes/workshop.routes.js'
import blogRoutes from './routes/blog.routes.js'
import leadRoutes from './routes/lead.routes.js'
import meRoutes from './routes/me.routes.js'
import enrollmentRoutes from './routes/enrollment.routes.js'
import checkoutRoutes from './routes/checkout.routes.js'
import webhookRoutes from './routes/webhook.routes.js'
import liveRoutes from './routes/live.routes.js'
import communityRoutes from './routes/community.routes.js'
import adminRoutes from './routes/admin/index.js'

const app = express()

// Must be set before the rate limiter reads req.ip. See env.trustProxy.
app.set('trust proxy', env.trustProxy)

/* ----------------------------- security headers ---------------------------- */
// Third-party origins the app legitimately needs. Helmet's stock policy falls
// back to default-src 'self' for frames and media, which would kill the Bunny
// player outright, so the origins are named here rather than dropping the CSP.
const FONTSHARE_CSS = 'https://api.fontshare.com' // <link> in client/index.html
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

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
        'script-src': ["'self'", RZP_CHECKOUT],
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
        'upgrade-insecure-requests': env.isProd ? [] : null,
      },
    },
  }),
)

/**
 * `dev` is a development formatter — colourised, no timestamps, unparseable. In
 * production the combined format carries a timestamp and a status per line, and
 * goes to a file that survives a restart as well as to stdout for the
 * supervisor. Rotation is logrotate's job; see docs/observability.md.
 */
const logFile = accessLogStream()
// Silent under test: 50 request lines per file bury the assertion that failed.
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'))
if (logFile) app.use(morgan('combined', { stream: logFile }))

app.use(cors({ origin: env.clientOrigin, credentials: true }))

/**
 * Webhooks mount BEFORE the JSON body parser, and this ordering is load-bearing.
 *
 * Razorpay signs the exact bytes it sent. Once `express.json()` has parsed and
 * discarded the raw buffer, the only way back is re-serialising the object —
 * which changes key order and whitespace, so every signature check fails and
 * every real payment is rejected as a forgery.
 *
 * These routes are server-to-server, so they also sit ahead of cookie parsing
 * and `attachUser`: there is no session here, only a signature.
 */
app.use('/api/webhooks', webhookRoutes)

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(attachUser)

/**
 * Health check.
 *
 * This used to return `{ ok: true }` unconditionally, so it reported healthy
 * while MongoDB was unreachable and every request 500ed — an uptime monitor
 * pointed at it would have stayed green through a total outage.
 *
 * It now checks the connection state and answers **503** when the database is
 * not usable, which is what makes an external monitor meaningful.
 */
app.get('/api/health', async (_req, res) => {
  // 1 = connected, 2 = connecting. Anything else is unusable.
  const state = mongoose.connection.readyState
  let dbOk = state === 1

  if (dbOk) {
    try {
      // readyState can lag a network partition, so actually round-trip.
      await mongoose.connection.db.admin().ping()
    } catch {
      dbOk = false
    }
  }

  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    db: dbOk ? 'up' : 'down',
    uptime: Math.round(process.uptime()),
    release: env.release || undefined,
  })
})

app.use('/api/config', configRoutes)
app.use('/api/showcase', showcaseRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/programs', programRoutes)
app.use('/api/workshops', workshopRoutes)
app.use('/api/blog', blogRoutes)
app.use('/api/leads', leadRoutes)
app.use('/api/me', meRoutes)
app.use('/api/enrollments', enrollmentRoutes)
app.use('/api/checkout', checkoutRoutes)
app.use('/api/live', liveRoutes)
app.use('/api', communityRoutes)
app.use('/api/admin', adminRoutes)

/* ------------------------------ the SPA ---------------------------------- */
/**
 * Express serves the built client from the same origin as the API.
 *
 * That is the whole point: one origin means the auth cookie is same-site and the
 * existing `sameSite: 'lax'` setting works untouched, with no CORS configuration
 * to get wrong on launch night.
 *
 * Ordering matters and is the reason this block sits here rather than higher up.
 * Every `/api/*` route is already mounted, so the fallback below cannot shadow
 * one; and the fallback answers only GET, so an unmatched POST /api/whatever
 * still reaches `notFound` and gets JSON instead of a page of HTML.
 */
const clientDist = path.resolve(fileURLToPath(new URL('../../client/dist', import.meta.url)))
const indexHtml = path.join(clientDist, 'index.html')

if (fs.existsSync(indexHtml)) {
  app.use(
    express.static(clientDist, {
      // `index: false` so *every* HTML response — "/" included — goes through
      // the one fallback below and gets the same headers. Otherwise "/" and
      // "/courses/seo-mastery" are served by different code paths and only one
      // of them ends up with the right cache policy.
      index: false,
      setHeaders: (res, filePath) => {
        // Vite fingerprints everything under /assets, so those never change
        // under a fixed name and can be cached for a year.
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      },
    }),
  )

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    // index.html must never be cached: it names the fingerprinted bundles, so a
    // cached copy pins the browser to the previous deploy's filenames — which
    // 404 once the old assets are gone.
    res.set('Cache-Control', 'no-cache, must-revalidate')
    res.sendFile(indexHtml)
  })
  console.log(`[server] serving the SPA from ${clientDist}`)
} else if (env.isProd) {
  // In production this is a broken deploy, not a preference: the site would
  // answer every page request with a JSON 404.
  console.error(`[server] client build missing at ${clientDist} — run "npm run build"`)
} else {
  console.log('[server] no client build found — Vite dev server serves the SPA')
}

app.use(notFound)
app.use(errorHandler)

await initObservability()

/**
 * Anything that escapes a request handler. Without these the process either dies
 * silently or, worse for an unhandled rejection, keeps running in an unknown
 * state with nothing recorded.
 */
process.on('unhandledRejection', (reason) => {
  captureMessage('Unhandled promise rejection', { reason: String(reason) })
})
process.on('uncaughtException', (err) => {
  captureMessage('Uncaught exception — exiting', { error: err.message, stack: err.stack })
  // Exit and let the supervisor restart: after an uncaught exception the
  // process state is undefined, and serving payments from it is worse than
  // being down for two seconds.
  setTimeout(() => process.exit(1), 500)
})

// Under test the suite owns the connection and supertest drives `app` directly.
if (!env.isTest) {
  connectDb()
    // Admin-set credentials and feature flags live in the database, so they can
    // only be read once it is reachable. Loaded before the port opens, or the
    // first requests would be served from the environment alone.
    .then(() => refreshRuntimeConfig())
    .then(() => {
      app.listen(env.port, () => {
        console.log(`[server] listening on http://localhost:${env.port}`)
      })
    })
    .catch((err) => {
      console.error('[server] failed to start:', err.message)
      process.exit(1)
    })
}

export default app
