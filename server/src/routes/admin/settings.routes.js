import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { getSettings, updateSettings } from '../../db/repos/settings.js'
import { invalidateEverywhere } from '../../services/invalidation.js'
import { safeContentChanged } from '../../services/contentEvents.js'

const router = Router()

/**
 * The keys each tab may write. Mongoose dropped anything its schema did not
 * declare; a jsonb column keeps whatever it is given, so the allow-list is
 * explicit here — otherwise a form could plant arbitrary keys (or a `*Enc`
 * secret) in the settings row.
 */
export const TAB_KEYS = {
  branding: ['brandName', 'productName', 'logoUrl', 'faviconUrl', 'accentColor'],
  menu: ['showWorkshops', 'showCourses', 'showCommunity', 'showBlog', 'showPractice'],
  help: ['supportEmail', 'salesEmail', 'helpCenterUrl', 'hours'],
  domain: ['host', 'verified'],
}
const TABS = Object.keys(TAB_KEYS)

export const pickKeys = (body, keys) =>
  Object.fromEntries(Object.entries(body || {}).filter(([k]) => keys.includes(k)))

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getSettings())
  }),
)

for (const tab of TABS) {
  router.put(
    `/${tab}`,
    asyncHandler(async (req, res) => {
      const setting = await updateSettings({ [tab]: pickKeys(req.body, TAB_KEYS[tab]) })
      // These fields are served to every visitor via GET /api/config, so the
      // cached copy has to go the moment one of them changes — on every instance.
      await invalidateEverywhere('siteConfig')
      // The header and footer render them on every page: purge the whole edge.
      await safeContentChanged({ kind: 'settings' })
      res.json(setting)
    }),
  )
}

router.post(
  '/domain/verify',
  asyncHandler(async (req, res) => {
    const setting = await getSettings()
    if (!setting.domain?.host) throw new HttpError(400, 'Set a domain first')
    // No DNS lookup here — the original page only toggled a verified badge.
    const updated = await updateSettings({ domain: { verified: true } })
    res.json(updated.domain)
  }),
)

export default router
