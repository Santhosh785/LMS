import http from 'node:http'
import { sql } from 'drizzle-orm'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'

import { env } from './config/env.js'
import { connectDb } from './config/db.js'
import { db, closeDb } from './db/index.js'
import { accessLogStream, captureMessage, initObservability } from './config/observability.js'
import { attachUser } from './middleware/auth.js'
import { errorHandler, notFound } from './middleware/error.js'
import { cspNonce, securityHeaders } from './middleware/security.js'
import { apiNoStore } from './middleware/cacheControl.js'
import { mountReactRouter } from './middleware/reactRouter.js'

import configRoutes from './routes/config.routes.js'
import showcaseRoutes from './routes/showcase.routes.js'
import { refreshRuntimeConfig } from './services/runtimeConfig.js'
import { startQueue, stopQueue } from './services/queue.js'
// Job definitions register themselves on import; they must exist before startQueue().
import { scheduleRecurringJobs } from './jobs/index.js'
import { startInvalidationListener, stopInvalidationListener } from './services/invalidation.js'
import { isBunnyStorageConfigured } from './services/bunnyStorage.js'
import { assertReplicaSafe } from './config/replicas.js'
import authRoutes from './routes/auth.routes.js'
import courseRoutes from './routes/course.routes.js'
import programRoutes from './routes/program.routes.js'
import workshopRoutes from './routes/workshop.routes.js'
import blogRoutes from './routes/blog.routes.js'
import leadRoutes from './routes/lead.routes.js'
import applicationRoutes from './routes/application.routes.js'
import resourceRoutes from './routes/resource.routes.js'
import meRoutes from './routes/me.routes.js'
import enrollmentRoutes from './routes/enrollment.routes.js'
import checkoutRoutes from './routes/checkout.routes.js'
import webhookRoutes from './routes/webhook.routes.js'
import liveRoutes from './routes/live.routes.js'
import communityRoutes from './routes/community.routes.js'
import adminRoutes from './routes/admin/index.js'
import { mediaDir } from './routes/admin/media.routes.js'
import { legacyRedirect } from './middleware/legacyRedirect.js'
import sitemapRoutes from './routes/sitemap.routes.js'

const app = express()
// Created here rather than by app.listen() so development Vite can share it
// for hot-module WebSockets (one origin, nothing extra for the CSP to allow).
const httpServer = http.createServer(app)

// Must be set before the rate limiter reads req.ip. See env.trustProxy.
app.set('trust proxy', env.trustProxy)

/* ----------------------------- security headers ---------------------------- */
// The per-request CSP nonce first: helmet reads it back for `script-src`, and
// the React Router handler puts it on the inline scripts it emits. Directives
// live in middleware/security.js.
app.use(cspNonce)
app.use(securityHeaders({ isProd: env.isProd }))

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

// Every API response is `no-store` unless a route says otherwise (GET
// /api/config does). Before the routers, so theirs is the last word.
app.use('/api', apiNoStore)

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
  // A pool reports nothing useful about reachability, so actually round-trip.
  let dbOk = true
  try {
    await db.execute(sql`select 1`)
  } catch {
    dbOk = false
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
// Flagship intake: POST /api/applications and POST /api/fit-calls
app.use('/api', applicationRoutes)
// Resources: playbooks and Claude skills
app.use('/api/resources', resourceRoutes)
app.use('/api/me', meRoutes)
app.use('/api/enrollments', enrollmentRoutes)
app.use('/api/checkout', checkoutRoutes)
app.use('/api/live', liveRoutes)
app.use('/api', communityRoutes)
app.use('/api/admin', adminRoutes)
// The Media Library stores public images under a separate path, never inside
// the client build, so deploys do not wipe an editor's uploaded images.
app.use('/uploads/media', express.static(mediaDir, { fallthrough: false, maxAge: '7d' }))

// Mongo-era bookmarks (/admin/courses/<ObjectId>) → their Postgres ids, and the
// old static site's .html URLs. Ahead of the app so the browser is redirected
// before a page is rendered.
app.use(legacyRedirect)

// /sitemap.xml and /robots.txt, ahead of the app, which would otherwise answer
// both with a page.
app.use(sitemapRoutes)

/* ------------------------------- the app --------------------------------- */
/**
 * The client, server-rendered here by React Router (middleware/reactRouter.js):
 * the production build in production, Vite in middleware mode in development.
 * Same origin as the API, so the auth cookie stays same-site with no CORS to
 * get wrong on launch night.
 *
 * Last, after every `/api` router, the media files, the legacy redirects and
 * the sitemap: it answers every other request, and passes `/api/*` through so
 * an unmatched API call still gets the JSON 404 below. Nothing is mounted
 * under test — the suite never imports the client build or starts Vite.
 */
await mountReactRouter(app, httpServer)

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

/**
 * Graceful shutdown on SIGTERM/SIGINT: stop accepting connections, let the job
 * queue finish its in-flight handlers, close the database pool, exit 0. The
 * whole sequence is capped at 30 seconds, and a second signal forces an exit —
 * a deploy should never hang on a stuck handler.
 */
const SHUTDOWN_TIMEOUT_MS = 30_000
let shuttingDown = false

async function shutdown(signal) {
  if (shuttingDown) {
    console.error(`[server] ${signal} again — forcing exit`)
    process.exit(1)
  }
  shuttingDown = true
  console.log(`[server] ${signal} received — shutting down`)
  setTimeout(() => {
    console.error('[server] shutdown took longer than 30s — forcing exit')
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS).unref()

  try {
    // close() stops new connections at once; its callback waits for in-flight
    // requests, which finish alongside the queue drain rather than ahead of it.
    const httpClosed = new Promise((resolve) => httpServer.close(() => resolve()))
    await stopQueue()
    await httpClosed
    // Its own long-lived connection, outside the pool closeDb() ends.
    await stopInvalidationListener()
    await closeDb()
    process.exit(0)
  } catch (err) {
    console.error('[server] shutdown failed:', err.message)
    process.exit(1)
  }
}

// Under test the suite owns the connection and supertest drives `app` directly.
if (!env.isTest) {
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  connectDb()
    // Admin-set credentials and feature flags live in the database, so they can
    // only be read once it is reachable. Loaded before the port opens, or the
    // first requests would be served from the environment alone.
    .then(() => refreshRuntimeConfig())
    // After the runtime config load, because Bunny Storage may be configured in
    // /admin/integrations rather than the environment — the same check the
    // media routes make. Throwing here exits before the queue or port start.
    .then(() =>
      assertReplicaSafe({ replicas: env.replicas, storageConfigured: isBunnyStorageConfigured() }),
    )
    // After the config refresh, before the port opens: a request that enqueues
    // a job should find the workers already running.
    .then(() => startQueue())
    // Cron schedules (the six-hourly sitemap rebuild) need the started queue.
    .then(() => scheduleRecurringJobs())
    .then(() => {
      // Cross-instance cache invalidation. Not awaited: an unreachable listener
      // database leaves the caches on their TTLs, it never blocks or fails boot.
      startInvalidationListener()
      httpServer.listen(env.port, () => {
        console.log(`[server] listening on http://localhost:${env.port}`)
      })
    })
    .catch((err) => {
      console.error('[server] failed to start:', err.message)
      process.exit(1)
    })
}

export default app
