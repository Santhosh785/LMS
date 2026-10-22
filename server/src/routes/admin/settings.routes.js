import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { Setting } from '../../models/index.js'
import { invalidateSiteConfig } from '../../services/siteConfig.js'

const router = Router()

const TABS = ['branding', 'menu', 'help', 'domain']

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await Setting.getSingleton())
  }),
)

for (const tab of TABS) {
  router.put(
    `/${tab}`,
    asyncHandler(async (req, res) => {
      const setting = await Setting.getSingleton()
      setting[tab] = { ...setting[tab].toObject(), ...req.body }
      await setting.save()
      // These fields are served to every visitor via GET /api/config, so the
      // cached copy has to go the moment one of them changes.
      invalidateSiteConfig()
      res.json(setting)
    }),
  )
}

router.post(
  '/domain/verify',
  asyncHandler(async (req, res) => {
    const setting = await Setting.getSingleton()
    if (!setting.domain?.host) throw new HttpError(400, 'Set a domain first')
    // No DNS lookup here — the original page only toggled a verified badge.
    setting.domain.verified = true
    await setting.save()
    res.json(setting.domain)
  }),
)

export default router
