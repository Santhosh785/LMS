/**
 * Client-side error reporting.
 *
 * Sentry is **dynamically imported and only when a DSN is configured**, so the
 * ~30KB SDK stays out of the main bundle for a build that is not using it. The
 * bundle is already ~550KB with no code splitting (deliberately deferred), and
 * adding a tracking SDK every visitor downloads regardless would make that
 * worse for no benefit.
 *
 * Everything here is best-effort: reporting an error must never itself throw,
 * and a blocked or failed request to the tracker must not affect the page.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN || ''
const RELEASE = import.meta.env.VITE_RELEASE || undefined

let sentry = null
let loading = null

/** Same reasoning as the server scrubber: this data leaves for a third party. */
const SENSITIVE = /(password|token|secret|cookie|authorization|utr|apikey|api_key)/i

function scrubUrl(url) {
  try {
    const u = new URL(url, window.location.origin)
    // Query strings are where reset tokens live.
    return `${u.origin}${u.pathname}`
  } catch {
    return String(url || '')
  }
}

async function load() {
  if (!DSN) return null
  if (sentry) return sentry
  if (loading) return loading

  loading = import('@sentry/react')
    .then((mod) => {
      mod.init({
        dsn: DSN,
        release: RELEASE,
        environment: import.meta.env.PROD ? 'production' : 'development',
        // Errors only. No session replay, no tracing — both are a privacy
        // surface and neither answers "why did checkout fail".
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend(event) {
          if (event.request?.url) event.request.url = scrubUrl(event.request.url)
          delete event.request?.cookies
          event.user = undefined
          if (event.extra) {
            for (const key of Object.keys(event.extra)) {
              if (SENSITIVE.test(key)) event.extra[key] = '[redacted]'
            }
          }
          return event
        },
      })
      sentry = mod
      return mod
    })
    .catch(() => null)

  return loading
}

/** Render errors from the boundaries. */
export async function reportClientError(error, context = {}) {
  // Always visible locally, whether or not a tracker is configured.
  console.error('[client error]', error, context)
  const mod = await load()
  if (!mod) return
  try {
    mod.withScope((scope) => {
      scope.setLevel('error')
      scope.setTag('scope', context.scope || 'app')
      scope.setContext('react', { componentStack: context.componentStack })
      scope.setTag('path', scrubUrl(window.location.href))
      mod.captureException(error)
    })
  } catch {
    // Reporting must never break the page it is reporting about.
  }
}

/**
 * Rejections nobody caught — a failed mutation with no `onError`, an await in an
 * effect. These are invisible without this hook and are exactly the class of bug
 * behind "checkout didn't work and nothing happened".
 */
export function installGlobalHandlers() {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    // A rejected API call the UI has already surfaced as a form error is noise.
    if (reason?.isAxiosError && reason.response?.status < 500) return
    reportClientError(reason instanceof Error ? reason : new Error(String(reason)), {
      scope: 'unhandledrejection',
    })
  })

  window.addEventListener('error', (event) => {
    if (!event?.error) return // resource load failures, not code errors
    reportClientError(event.error, { scope: 'window.onerror' })
  })
}
