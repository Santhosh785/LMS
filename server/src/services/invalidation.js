import crypto from 'node:crypto'
import pg from 'pg'
import { env } from '../config/env.js'
import { pool } from '../db/index.js'
import { invalidateSiteConfig } from './siteConfig.js'
import { invalidateRuntimeConfig, refreshRuntimeConfig } from './runtimeConfig.js'
import { invalidateSitemap } from './sitemap.js'

/**
 * Cross-instance cache invalidation over Postgres LISTEN/NOTIFY.
 *
 * The site config payload (GET /api/config) and the runtime config are both
 * held in process memory with a 60s TTL. An admin write used to clear only the
 * instance that served it, so with more than one instance a saved setting took
 * up to a minute to show up everywhere else. Now the write also publishes a
 * notification, and every instance holds one dedicated connection listening for
 * it. The TTLs stay as the safety net for when that listener is down.
 *
 * The sitemap memo (services/sitemap.js, 10 minute TTL) rides the same channel
 * under its own scope: the `regenerate-sitemap` job broadcasts it after a
 * content change so no instance keeps serving the old URL set.
 *
 * The payload is `{ scope: 'siteConfig' | 'runtimeConfig' | 'sitemap' | 'all',
 * origin }`, where `origin` identifies the publishing process. `all` clears
 * every cache above.
 */

export const CHANNEL = 'gs_invalidate'
export const SCOPES = Object.freeze(['siteConfig', 'runtimeConfig', 'sitemap', 'all'])

/** This process, as named in the notifications it publishes. */
export const INSTANCE_ID = crypto.randomUUID()

const defaultHandlers = {
  invalidateSiteConfig,
  invalidateRuntimeConfig,
  refreshRuntimeConfig,
  invalidateSitemap,
  instanceId: INSTANCE_ID,
  logger: console,
}

/**
 * Parses a notification payload into a scope, or null when it is not one we
 * understand. Never throws: a malformed payload is somebody else's bug and must
 * not take the listener down with it.
 */
export function parseInvalidation(payload, logger = console) {
  return readPayload(payload, logger)?.scope ?? null
}

/** `{ scope, origin }` from a payload, or null — see parseInvalidation. */
function readPayload(payload, logger) {
  let parsed
  try {
    parsed = JSON.parse(payload)
  } catch {
    logger.debug?.(`[invalidate] ignoring malformed payload: ${String(payload).slice(0, 200)}`)
    return null
  }
  const scope = parsed && typeof parsed === 'object' ? parsed.scope : undefined
  if (!SCOPES.includes(scope)) {
    logger.debug?.(`[invalidate] ignoring unknown scope: ${String(scope).slice(0, 100)}`)
    return null
  }
  return { scope, origin: typeof parsed.origin === 'string' ? parsed.origin : null }
}

/**
 * Clears the local cache(s) for a scope. Resolves once a runtime refresh, if one
 * was triggered, has finished — `invalidateEverywhere` waits for it so the admin
 * request that caused it sees its own write; the listener does not.
 *
 * For `all` the site config is cleared a second time after the runtime refresh:
 * the site payload embeds the runtime feature flags, and a request landing
 * between the two would otherwise rebuild it from the old flags and cache that
 * for a full TTL.
 */
export function applyInvalidation(scope, handlers = defaultHandlers) {
  const h = { ...defaultHandlers, ...handlers }
  const site = scope === 'siteConfig' || scope === 'all'
  const runtime = scope === 'runtimeConfig' || scope === 'all'

  if (scope === 'sitemap' || scope === 'all') h.invalidateSitemap()
  if (site) h.invalidateSiteConfig()
  if (!runtime) return Promise.resolve()

  h.invalidateRuntimeConfig()
  return Promise.resolve()
    .then(() => h.refreshRuntimeConfig())
    .catch((err) => h.logger.warn?.(`[invalidate] runtime config refresh failed: ${err?.message}`))
    .then(() => {
      if (site) h.invalidateSiteConfig()
    })
}

/**
 * What the listener does with a raw notification payload. A pure function of
 * the payload (given the handlers), so it is unit-testable without a database.
 * Returns the applied scope, or null when the payload was ignored.
 *
 * A notification this process published itself is ignored: `invalidateEverywhere`
 * already applied it locally before publishing, and applying it a second time
 * is not free — for the sitemap it would drop the memo the regenerate job has
 * just warmed.
 */
export function handleNotification(payload, handlers = defaultHandlers) {
  const h = { ...defaultHandlers, ...handlers }
  const parsed = readPayload(payload, h.logger)
  if (!parsed || (parsed.origin && parsed.origin === h.instanceId)) return null
  const { scope } = parsed
  try {
    applyInvalidation(scope, h).catch(() => {})
  } catch (err) {
    h.logger.warn?.(`[invalidate] handling ${scope} failed: ${err?.message}`)
  }
  return scope
}

/**
 * Clears the matching local cache(s) immediately, then tells every other
 * instance to do the same. Publishing goes through the normal pool — NOTIFY is
 * delivered at commit, so the transaction pooler is fine for sending; only
 * LISTEN needs a session.
 *
 * A failed publish is logged and swallowed: the write itself succeeded, and the
 * other instances converge within the TTL regardless. The publishing instance
 * receives its own notification too, and skips it by its `origin`.
 */
export async function invalidateEverywhere(scope, { publish = defaultPublish, ...handlers } = {}) {
  if (!SCOPES.includes(scope)) throw new Error(`Unknown invalidation scope: ${scope}`)
  const h = { ...defaultHandlers, ...handlers }
  await applyInvalidation(scope, h)
  try {
    await publish(JSON.stringify({ scope, origin: h.instanceId }))
  } catch (err) {
    h.logger.warn?.(
      `[invalidate] could not publish ${scope} invalidation (other instances will catch up ` +
        `within the cache TTL): ${err?.message}`,
    )
  }
}

async function defaultPublish(payload) {
  await pool.query('select pg_notify($1, $2)', [CHANNEL, payload])
}

/* ------------------------------- the listener ------------------------------ */

const sslFor = (connectionString) =>
  connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined

/**
 * One long-lived connection running `LISTEN gs_invalidate`, reconnecting forever
 * with exponential backoff (1s, 2s, 4s … capped at 30s, reset on success).
 *
 * It never throws and never crashes the process: every connection error is
 * caught here and turned into a reconnect. Each state change is logged once —
 * connected, lost, reconnecting — rather than once per attempt, so a database
 * that stays down for an hour produces three lines, not a hundred.
 *
 * Everything external is injectable so the backoff can be tested with a fake
 * client and fake timers.
 */
export function createInvalidationListener({
  // The queue's session-capable URL (BOSS_DATABASE_URL, else the direct URL):
  // LISTEN needs a session, so never the transaction pooler.
  connectionString = env.boss.databaseUrl,
  onNotification = (payload) => handleNotification(payload),
  createClient = (cs) =>
    new pg.Client({
      connectionString: cs,
      ssl: sslFor(cs),
      keepAlive: true,
      connectionTimeoutMillis: 10_000,
    }),
  logger = console,
  initialDelayMs = 1_000,
  maxDelayMs = 30_000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let stopped = true
  let client = null
  let timer = null
  let delay = initialDelayMs
  /** idle → connected | lost → reconnecting → connected … */
  let state = 'idle'
  /** Resolves when the attempt in progress settles; lets tests await it. */
  let attempt = Promise.resolve()

  function lost(err, fromState) {
    const reason = err?.message ? `: ${err.message}` : ''
    if (fromState === 'idle') {
      state = 'lost'
      logger.warn(
        `[invalidate] could not connect the listener${reason}. Config caches fall back to ` +
          'their 60s TTL; retrying in the background.',
      )
    } else if (fromState === 'connected') {
      state = 'lost'
      logger.warn(`[invalidate] listener connection lost${reason}`)
    }
    // Already lost/reconnecting: a further failed attempt is not a new state.
    schedule()
  }

  function schedule() {
    if (stopped || timer) return
    const wait = delay
    delay = Math.min(delay * 2, maxDelayMs)
    timer = setTimer(() => {
      timer = null
      attempt = connect()
    }, wait)
    // A pending retry must never be what keeps the process alive.
    timer?.unref?.()
  }

  async function connect() {
    if (stopped) return
    if (state === 'lost') {
      state = 'reconnecting'
      logger.log('[invalidate] reconnecting the listener')
    }

    let c
    try {
      c = createClient(connectionString)
    } catch (err) {
      lost(err, state)
      return
    }
    client = c
    let dead = false
    const onDown = (err) => {
      if (dead) return
      dead = true
      if (client === c) client = null
      c.removeAllListeners?.('notification')
      Promise.resolve()
        .then(() => c.end())
        .catch(() => {})
      if (stopped) return
      lost(err, state)
    }
    // Kept for the client's whole life: an 'error' with no listener would be
    // re-thrown by EventEmitter and kill the process.
    c.on('error', onDown)
    c.on('end', () => onDown())
    c.on('notification', (msg) => {
      if (msg.channel !== CHANNEL) return
      try {
        onNotification(msg.payload)
      } catch (err) {
        logger.warn(`[invalidate] notification handler failed: ${err?.message}`)
      }
    })

    try {
      await c.connect()
      await c.query(`LISTEN ${CHANNEL}`)
    } catch (err) {
      onDown(err)
      return
    }
    if (dead) return
    if (stopped) {
      dead = true
      await Promise.resolve(c.end()).catch(() => {})
      return
    }
    delay = initialDelayMs
    if (state !== 'connected') {
      state = 'connected'
      logger.log(`[invalidate] listening on ${CHANNEL}`)
    }
  }

  return {
    /** Fire-and-forget: boot never waits on (or fails because of) the listener. */
    start() {
      if (!stopped) return attempt
      stopped = false
      if (!connectionString) {
        logger.warn(
          '[invalidate] no session-capable database URL; config caches use their 60s TTL only',
        )
        stopped = true
        return attempt
      }
      attempt = connect()
      return attempt
    },
    async stop() {
      stopped = true
      if (timer) clearTimer(timer)
      timer = null
      const c = client
      client = null
      if (c) await Promise.resolve(c.end()).catch(() => {})
      state = 'idle'
    },
    /** For tests and diagnostics. */
    get state() {
      return state
    },
    get client() {
      return client
    },
    get nextDelayMs() {
      return delay
    },
    /** The connection attempt in progress, if any. */
    get settled() {
      return attempt
    },
  }
}

let listener = null

/** Starts the process-wide listener. Safe to call more than once. */
export function startInvalidationListener(options) {
  if (!listener) listener = createInvalidationListener(options)
  listener.start()
  return listener
}

/** Stops it so the open connection does not keep the process alive. */
export async function stopInvalidationListener() {
  const l = listener
  listener = null
  if (l) await l.stop()
}
