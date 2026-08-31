import { cfg } from '../services/runtimeConfig.js'

/**
 * Gate a router behind a feature flag (see cfg.features).
 *
 * A disabled module answers exactly like a URL that was never mounted — same
 * 404 body as the app's notFound handler — so a crafted request cannot tell a
 * hidden module from a typo, and nothing leaks about what is being built next.
 * Hiding the navigation and the client routes is cosmetic on its own; this is
 * the part that actually closes the module.
 */
export const requireFeature = (name) => (req, res, next) => {
  if (cfg.features[name]) return next()
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` })
}
