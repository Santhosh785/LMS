import { isIP } from 'node:net'
import { ipKeyGenerator } from 'express-rate-limit'
import { env } from '../config/env.js'

/**
 * The client address every rate limiter counts against — one helper so no
 * limiter has its own idea of who the client is.
 *
 * With `CF_PROXIED` on, the site sits behind Cloudflare and `CF-Connecting-IP`
 * carries the real visitor. Without Traefik trusting Cloudflare's forwarded
 * header, `req.ip` would be a Cloudflare edge address and every visitor routed
 * through that edge would share one bucket. If the header is absent, empty or
 * not an IP address, the key falls back to `req.ip`.
 *
 * The header is client-spoofable when the origin accepts traffic that did not
 * pass through Cloudflare, so `CF_PROXIED` is only safe once origin ingress is
 * restricted to Cloudflare's published IP ranges (docs/cloudflare.md).
 *
 * Both paths go through `ipKeyGenerator`, which buckets an IPv6 address by its
 * subnet: a raw IPv6 address is per-device, and one /64 holds billions.
 *
 * @param {import('express').Request} req
 * @param {boolean} [proxied] Defaults to env.cfProxied; a parameter so tests can flip it.
 */
export function clientKey(req, proxied = env.cfProxied) {
  if (proxied) {
    const raw = req.headers?.['cf-connecting-ip']
    const header = String(Array.isArray(raw) ? raw[0] : raw || '')
      .split(',')[0]
      .trim()
    if (header && isIP(header)) return ipKeyGenerator(header)
  }
  return ipKeyGenerator(req.ip)
}
