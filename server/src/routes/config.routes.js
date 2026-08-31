import { Router } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { getSiteConfig } from '../services/siteConfig.js'

const router = Router()

/**
 * Runtime configuration the browser needs before it can render.
 *
 * The client builds its branding, navigation, catalogue filters and route table
 * from this payload, so all of it has to arrive at runtime rather than at build
 * time. Editing a setting or a taxonomy term in admin therefore changes the
 * live site with no rebuild and no code change.
 *
 * Public and unauthenticated on purpose: it carries display configuration only,
 * never a secret, and it has to be known before /auth/me has resolved.
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getSiteConfig())
  }),
)

export default router
