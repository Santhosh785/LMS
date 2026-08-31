import { describe, expect, it } from 'vitest'
import { resetEmailKey } from '../src/middleware/rateLimit.js'

/**
 * The limiters themselves skip under NODE_ENV=test — a suite is one IP making
 * hundreds of requests. That skip is also why a broken `keyGenerator` shipped
 * unnoticed: it is never invoked during a test run.
 *
 * So the key generator is tested directly. It threw `ERR_ERL_KEY_GEN_IPV6` on
 * the first real request, taking the whole forgot-password endpoint down rather
 * than merely weakening its limit — express-rate-limit refuses a bare `req.ip`
 * because a single IPv6 /64 gives an attacker billions of distinct addresses.
 */
describe('password reset rate-limit key', () => {
  it('keys on the submitted email, normalised', () => {
    expect(resetEmailKey({ body: { email: '  Buyer@Example.IN ' }, ip: '1.2.3.4' })).toBe(
      'buyer@example.in',
    )
  })

  it('falls back to an IPv4 address without throwing', () => {
    expect(() => resetEmailKey({ body: {}, ip: '203.0.113.9' })).not.toThrow()
    expect(typeof resetEmailKey({ body: {}, ip: '203.0.113.9' })).toBe('string')
  })

  it('falls back to an IPv6 address without throwing — the bug this guards', () => {
    const key = resetEmailKey({ body: {}, ip: '2001:db8:85a3:8d3:1319:8a2e:370:7348' })
    expect(typeof key).toBe('string')
    // Collapsed to the /64 subnet rather than the exact address, which is what
    // makes the limit meaningful against a single attacker.
    expect(key).not.toBe('2001:db8:85a3:8d3:1319:8a2e:370:7348')
  })

  it('survives a request with no body at all', () => {
    expect(() => resetEmailKey({ ip: '203.0.113.9' })).not.toThrow()
  })
})
