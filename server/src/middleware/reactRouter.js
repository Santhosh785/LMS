import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createRequestHandler } from '@react-router/express'
import { env } from '../config/env.js'
import { repos } from '../db/repos/index.js'
import { publicUser } from '../routes/auth.routes.js'
import { resolveSeo } from '../services/seo.js'
import { getSiteConfig } from '../services/siteConfig.js'
import { cfg } from '../services/runtimeConfig.js'

/**
 * The client, server-rendered by this process through React Router's Express
 * adapter. One origin for pages and the API, as before: the auth cookie stays
 * same-site and nothing about CORS changes on launch night.
 *
 * Mount order is load-bearing. The handler answers every non-API request, so
 * it sits after the auth middleware (loaders see `req.user`), the media static
 * handler, the legacy redirects, the sitemap and every `/api` router; `/api/*`
 * itself is passed through, so an unmatched API call still reaches the JSON
 * 404 instead of a page of HTML.
 */

const CLIENT_DIR = path.resolve(fileURLToPath(new URL('../../../client', import.meta.url)))
const BUILD_DIR = path.join(CLIENT_DIR, 'build')
const SERVER_BUILD = path.join(BUILD_DIR, 'server', 'index.js')
const CLIENT_BUILD = path.join(BUILD_DIR, 'client')

/** The site config the document falls back to when the database is unreachable. */
const FALLBACK_SITE_CONFIG = () => ({
  features: cfg.features,
  branding: {
    brandName: 'Growth Scholar',
    productName: 'Growth Scholar Learn',
    logoUrl: '/logo.png',
    faviconUrl: '/logo.png',
    accentColor: '#3ecf8e',
  },
  menu: {
    showWorkshops: true,
    showCourses: true,
    showCommunity: true,
    showBlog: true,
    showPractice: true,
  },
  help: { supportEmail: '', salesEmail: '', helpCenterUrl: '', hours: '' },
  taxonomy: {},
})

/**
 * What every loader receives as `context` (typed in
 * client/src/types/load-context.d.ts). The user is the same public shape
 * GET /api/auth/me serialises; the nonce is the one the CSP middleware minted
 * for this response, so the inline scripts React Router emits are allowed.
 */
export async function getLoadContext(req, res) {
  let siteConfig
  try {
    siteConfig = await getSiteConfig()
  } catch (err) {
    // The page still renders, with default branding, rather than 500ing on a
    // database blip; the API surfaces the real error on its own.
    console.error('[ssr] site config unavailable, rendering with defaults:', err.message)
    siteConfig = FALLBACK_SITE_CONFIG()
  }
  return {
    repos,
    user: req.user ? publicUser(req.user) : null,
    siteConfig,
    seo: { resolve: resolveSeo },
    nonce: res.locals.cspNonce,
  }
}

/**
 * The request handler with the `/api/*` pass-through.
 *
 * The adapter appends the response's headers to `res` rather than replacing
 * them, so cookies the auth middleware set before this ran (a refreshed access
 * token) survive on a document response — tests/ssr-handler.test.js checks
 * that against the real adapter.
 *
 * @param {{ build: import('react-router').ServerBuild | (() => Promise<import('react-router').ServerBuild>), mode: 'development' | 'production', getLoadContext?: typeof getLoadContext }} options
 */
export function reactRouterHandler({ build, mode, getLoadContext: loadContext = getLoadContext }) {
  const handler = createRequestHandler({ build, mode, getLoadContext: loadContext })
  return function reactRouter(req, res, next) {
    if (req.path.startsWith('/api/')) return next()
    return handler(req, res, next)
  }
}

/**
 * Production: the server bundle `react-router build` wrote, and the client
 * build's assets served with a year-long immutable cache (Vite fingerprints
 * everything under /assets). Development: Vite in middleware mode, rooted at
 * the client folder, with the server build loaded through it so route modules
 * hot-reload. Nothing here runs under test — the suite must never import the
 * client build or start Vite.
 *
 * @param {import('express').Express} app
 * @param {import('node:http').Server} [httpServer] the server `app` will listen
 *   on — in development Vite attaches its hot-module WebSocket to it, so HMR
 *   shares the app's origin instead of opening a second port the CSP would
 *   have to allow.
 */
export async function mountReactRouter(app, httpServer) {
  if (env.isTest) return false

  if (env.isProd) {
    if (!fs.existsSync(SERVER_BUILD)) {
      // A broken deploy, not a preference: every page request would get the
      // JSON 404.
      console.error(`[server] client build missing at ${BUILD_DIR} — run "npm run build"`)
      return false
    }
    app.use(
      '/assets',
      express.static(path.join(CLIENT_BUILD, 'assets'), {
        immutable: true,
        maxAge: '1y',
        fallthrough: false,
      }),
    )
    // Everything else in public/ (logo.png, the marketing images) under a
    // short cache, since these names do not change between deploys.
    app.use(express.static(CLIENT_BUILD, { index: false, maxAge: '1h' }))
    app.use(
      reactRouterHandler({
        build: await import(SERVER_BUILD),
        mode: 'production',
      }),
    )
    console.log(`[server] serving the React Router app from ${BUILD_DIR}`)
    return true
  }

  // Development only — never reached in production, so Vite stays a
  // devDependency and is never imported there.
  const { createServer } = await import('vite')
  const vite = await createServer({
    root: CLIENT_DIR,
    server: { middlewareMode: true, hmr: httpServer ? { server: httpServer } : undefined },
  })
  app.use(vite.middlewares)
  app.use(
    reactRouterHandler({
      build: () => vite.ssrLoadModule('virtual:react-router/server-build'),
      mode: 'development',
    }),
  )
  console.log('[server] Vite dev middleware mounted — the React Router app is served from source')
  return true
}
