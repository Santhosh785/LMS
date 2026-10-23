import { describe, expect, it } from 'vitest'
import { clientKey } from '../src/middleware/clientKey.js'

/**
 * The limiters skip under NODE_ENV=test, so the shared key helper is tested
 * directly, with the flag passed in rather than read from the environment.
 */
const req = (ip, header) => ({
  ip,
  headers: header === undefined ? {} : { 'cf-connecting-ip': header },
})

describe('rate-limit client key', () => {
  it('flag on, header present: keys on the header address', () => {
    expect(clientKey(req('172.71.0.1', '203.0.113.7'), true)).toBe('203.0.113.7')
  })

  it('flag on, header absent: falls back to req.ip', () => {
    expect(clientKey(req('198.51.100.4'), true)).toBe('198.51.100.4')
  })

  it('flag on, header empty or not an address: falls back to req.ip', () => {
    expect(clientKey(req('198.51.100.4', ''), true)).toBe('198.51.100.4')
    expect(clientKey(req('198.51.100.4', '   '), true)).toBe('198.51.100.4')
    expect(clientKey(req('198.51.100.4', 'not-an-ip'), true)).toBe('198.51.100.4')
  })

  it('flag off: ignores a present header', () => {
    expect(clientKey(req('198.51.100.4', '203.0.113.7'), false)).toBe('198.51.100.4')
  })

  it('flag on, IPv6 header: bucketed by subnet, not the exact address', () => {
    const a = clientKey(req('172.71.0.1', '2001:db8:85a3:8d3:1319:8a2e:370:7348'), true)
    const b = clientKey(req('172.71.0.1', '2001:db8:85a3:8d3:ffff:ffff:ffff:ffff'), true)
    expect(a).not.toBe('2001:db8:85a3:8d3:1319:8a2e:370:7348')
    expect(a).toBe(b)
  })

  it('defaults to the CF_PROXIED env flag, which is off in tests', () => {
    expect(clientKey(req('198.51.100.4', '203.0.113.7'))).toBe('198.51.100.4')
  })
})
