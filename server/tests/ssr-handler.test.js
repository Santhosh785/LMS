import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { errorHandler, notFound } from '../src/middleware/error.js'
import { reactRouterHandler } from '../src/middleware/reactRouter.js'
import { ACCESS_COOKIE, REFRESH_COOKIE, setSessionCookies } from '../src/middleware/auth.js'

/**
 * The React Router Express handler (task 10), over the real adapter and the
 * real server runtime, with the smallest build that renders a document: one
 * root route whose loader echoes the load context and an entry that writes it
 * as HTML. Nothing from the client build is imported — under test it does not
 * exist — so what is covered is the Express side: the `/api/*` pass-through,
 * the load context reaching the loader, and the headers the adapter sends.
 */

function fakeBuild() {
  const root = {
    id: 'root',
    path: '',
    module: {
      default: () => null,
      loader: ({ context }) => ({ user: context.user, nonce: context.nonce }),
    },
  }
  // The real route table hangs every page off the root; one splat stands in.
  const page = { id: 'page', parentId: 'root', path: '*', module: { default: () => null } }
  const manifestRoute = (id, over) => ({
    id,
    imports: [],
    module: `/${id}.js`,
    hasAction: false,
    hasLoader: false,
    hasClientAction: false,
    hasClientLoader: false,
    hasErrorBoundary: false,
    ...over,
  })
  return {
    entry: {
      module: {
        default(request, status, headers, context, loadContext) {
          const data = context.staticHandlerContext.loaderData.root
          headers.set('Content-Type', 'text/html')
          return new Response(
            `<!doctype html><html><body data-nonce="${loadContext.nonce}">${JSON.stringify(data)}</body></html>`,
            { status, headers },
          )
        },
      },
    },
    routes: { root, page },
    assets: {
      entry: { imports: [], module: '/entry.js' },
      routes: {
        root: manifestRoute('root', { hasLoader: true }),
        page: manifestRoute('page', { parentId: 'root', path: '*' }),
      },
      url: '/manifest.js',
      version: 'test',
    },
    basename: '/',
    publicPath: '/',
    assetsBuildDirectory: '',
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: 'lazy', manifestPath: '/__manifest' },
  }
}

/** The app as index.js mounts it: auth-ish middleware, API, then the handler. */
function app({ refresh = false } = {}) {
  const a = express()
  a.use(cookieParser())
  a.use((req, res, next) => {
    res.locals.cspNonce = 'test-nonce'
    // attachUser renewing an expired access token: cookies set on `res`
    // before the React Router handler runs.
    if (refresh) {
      setSessionCookies(res, { access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 })
      req.user = { _id: 'u1', name: 'Priya', email: 'priya@example.in', role: 'student' }
    }
    next()
  })
  a.get('/api/ping', (_req, res) => res.json({ ok: true }))
  a.use(
    reactRouterHandler({
      build: fakeBuild(),
      mode: 'production',
      getLoadContext: (req, res) => ({
        user: req.user ? { id: req.user._id, name: req.user.name } : null,
        nonce: res.locals.cspNonce,
      }),
    }),
  )
  a.use(notFound)
  a.use(errorHandler)
  return a
}

describe('React Router Express handler', () => {
  it('renders a document for a page URL with the load context in the loader', async () => {
    const res = await request(app()).get('/anything')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/^text\/html/)
    expect(res.text).toContain('data-nonce="test-nonce"')
    expect(res.text).toContain('{"user":null,"nonce":"test-nonce"}')
  })

  it('passes /api/* through: a mounted route answers, an unknown one gets the JSON 404', async () => {
    const ok = await request(app()).get('/api/ping')
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ ok: true })

    const missing = await request(app()).get('/api/no-such-route')
    expect(missing.status).toBe(404)
    expect(missing.headers['content-type']).toMatch(/json/)
    expect(missing.body.error).toBe('No route for GET /api/no-such-route')
  })

  it('keeps the auth cookies a token refresh set before it on a document response', async () => {
    const res = await request(app({ refresh: true })).get('/student')
    expect(res.status).toBe(200)
    const cookies = res.headers['set-cookie'] || []
    expect(cookies.some((c) => c.startsWith(`${ACCESS_COOKIE}=new-at;`))).toBe(true)
    expect(cookies.some((c) => c.startsWith(`${REFRESH_COOKIE}=new-rt;`))).toBe(true)
    // And the refreshed session is what the loader saw.
    expect(res.text).toContain('"user":{"id":"u1","name":"Priya"}')
  })
})
