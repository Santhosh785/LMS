import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { cspNonce, scriptSrc, securityHeaders } from '../src/middleware/security.js'

/** The CSP as index.js mounts it, with a route that reveals the request nonce. */
function app({ isProd }) {
  const a = express()
  a.use(cspNonce)
  a.use(securityHeaders({ isProd }))
  a.get('/', (_req, res) => res.json({ nonce: res.locals.cspNonce }))
  return a
}

const directive = (csp, name) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `))

describe('Content Security Policy', () => {
  it('mints a fresh base64 nonce per request', async () => {
    const [a, b] = await Promise.all([
      request(app({ isProd: true })).get('/'),
      request(app({ isProd: true })).get('/'),
    ])
    expect(a.body.nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(a.body.nonce).not.toBe(b.body.nonce)
  })

  it('in production, script-src carries that request’s nonce and no unsafe-inline', async () => {
    const res = await request(app({ isProd: true })).get('/')
    const csp = res.headers['content-security-policy']
    const script = directive(csp, 'script-src')
    expect(script).toContain(`'nonce-${res.body.nonce}'`)
    expect(script).toContain("'self'")
    expect(script).toContain('https://checkout.razorpay.com')
    expect(script).not.toContain("'unsafe-inline'")
    expect(csp).toContain('upgrade-insecure-requests')
  })

  it('outside production, script-src allows unsafe-inline for the Vite dev client and omits the nonce', async () => {
    const res = await request(app({ isProd: false })).get('/')
    const csp = res.headers['content-security-policy']
    const script = directive(csp, 'script-src')
    expect(script).toContain("'unsafe-inline'")
    // A nonce next to 'unsafe-inline' makes browsers ignore the latter, which
    // would block the dev preamble — so it is left out in development.
    expect(script).not.toContain("'nonce-")
    expect(csp).not.toContain('upgrade-insecure-requests')
  })

  it('leaves the other directives as before', async () => {
    const csp = (await request(app({ isProd: true })).get('/')).headers['content-security-policy']
    expect(directive(csp, 'frame-src')).toBe(
      "frame-src 'self' https://iframe.mediadelivery.net https://checkout.razorpay.com https://api.razorpay.com",
    )
    expect(directive(csp, 'img-src')).toContain('https:')
    expect(directive(csp, 'object-src')).toBe("object-src 'none'")
    expect(directive(csp, 'style-src')).toBe(
      "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
    )
  })

  it('scriptSrc is a per-request function value only in production', () => {
    expect(scriptSrc({ isProd: true }).some((s) => typeof s === 'function')).toBe(true)
    expect(scriptSrc({ isProd: false }).every((s) => typeof s === 'string')).toBe(true)
  })
})
