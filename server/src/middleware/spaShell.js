import fs from 'node:fs'
import { toHeadHtml } from '@gs/seo'
import { captureServerError } from '../config/observability.js'
import { resolveSeo } from '../services/seo.js'

/**
 * The SPA fallback: every non-API GET is answered with the built index.html,
 * its head rewritten for the URL — title, description, canonical, robots, Open
 * Graph, Twitter and JSON-LD — so crawlers and link-preview bots see the page
 * they asked for instead of one generic title for the whole site.
 */

// The one header every shell response carries. index.html names the
// fingerprinted bundles, so a cached copy pins the browser to the previous
// deploy's filenames — which 404 once the old assets are gone.
const NO_CACHE = 'no-cache, must-revalidate'

// Each pattern takes the tag's own line with it, so no blank line is left.
const TITLE = /[ \t]*<title\b[^>]*>[\s\S]*?<\/title>[ \t]*(?:\r?\n)?/gi
// Attribute values may span lines (Vite keeps the source formatting), and
// `name` may sit before or after `content`.
const DESCRIPTION =
  /[ \t]*<meta\b(?=[^>]*\bname\s*=\s*["']?description["'\s/>])[^>]*>[ \t]*(?:\r?\n)?/gi
const HEAD_CLOSE = /<\/head>/i

/**
 * Prepares the template once, at boot, so a request costs a resolver call and
 * a string concatenation. The static title and description are removed from
 * the head — every response gets its own — and the document is split where
 * the new tags go: immediately before `</head>`.
 *
 * `original` is kept byte for byte: it is what a failed resolve serves.
 *
 * @param {string} html the built index.html
 * @returns {{ original: string, head: string, tail: string, pad: string, end: string } | null} null when there is no `</head>` to inject before
 */
export function prepareShell(html) {
  const at = html.search(HEAD_CLOSE)
  if (at === -1) return null
  const head = html.slice(0, at).replace(TITLE, '').replace(DESCRIPTION, '')
  // When `</head>` sits on its own line, the new tags go on lines of their own,
  // indented one step deeper; a minified head gets them inline.
  const indent = /\n([ \t]*)$/.exec(head)?.[1]
  if (indent === undefined) return { original: html, head, tail: html.slice(at), pad: '', end: '' }
  return {
    original: html,
    head: head.slice(0, head.length - indent.length),
    tail: html.slice(at),
    pad: `${indent}  `,
    end: `\n${indent}`,
  }
}

/** The shell with `meta` rendered into its head. */
export function renderShell(shell, meta) {
  const tags = toHeadHtml(meta)
    .split('\n')
    .map((line) => `${shell.pad}${line}`)
    .join(shell.pad ? '\n' : '')
  return `${shell.head}${tags}${shell.end}${shell.tail}`
}

/**
 * The `app.get('*')` fallback. It must sit after every `/api` router, the
 * static asset middleware and the legacy redirects; `/api/*` is passed through
 * so an unmatched API call still reaches the JSON 404.
 *
 * Failure policy: the shell never answers 500. Should resolving or rendering
 * throw (database down, a malformed record), the error is logged and captured
 * and the file is served exactly as built, with 200 — the page still boots and
 * renders client-side; it just carries the generic head for that request.
 *
 * `inject: false` (SEO_INJECT=0) skips all of this and sends the file from disk,
 * as before this existed.
 *
 * @param {{ indexHtml: string, inject?: boolean, resolve?: typeof resolveSeo }} options
 */
export function spaShell({ indexHtml, inject = true, resolve = resolveSeo }) {
  // Read once, at boot. A deploy replaces the file and restarts the process.
  const shell = inject ? prepareShell(fs.readFileSync(indexHtml, 'utf8')) : null
  if (inject && !shell) {
    console.error(`[seo] no </head> in ${indexHtml} — serving it without injected meta`)
  }

  return async function spaFallback(req, res, next) {
    if (req.path.startsWith('/api/')) return next()
    res.set('Cache-Control', NO_CACHE)
    if (!shell) return res.sendFile(indexHtml)

    let status = 200
    let html
    try {
      const url = new URL(req.originalUrl, 'http://shell.invalid')
      const meta = await resolve(req.path, url.searchParams)
      status = meta?.status || 200
      html = renderShell(shell, meta)
    } catch (err) {
      console.error(`[seo] head injection failed for ${req.originalUrl}:`, err)
      // Reported as a server error although the visitor gets a 200: a resolver
      // that throws on every request is an outage of every link preview.
      captureServerError(err, req, 500)
      status = 200
      html = shell.original
    }
    res.status(status).type('html').send(html)
  }
}
