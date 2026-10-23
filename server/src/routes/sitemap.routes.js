import { Router } from 'express'
import { getSitemap, robotsTxt } from '../services/sitemap.js'

export { invalidateSitemap } from '../services/sitemap.js'

/**
 * GET /sitemap.xml and GET /robots.txt. Mounted at the root, ahead of the page
 * handler, which would otherwise answer both with the not-found page.
 */
const router = Router()

router.get('/sitemap.xml', async (_req, res, next) => {
  try {
    const xml = await getSitemap()
    res.set('Cache-Control', 'public, max-age=600')
    res.type('application/xml').send(xml)
  } catch (err) {
    next(err)
  }
})

router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(robotsTxt())
})

export default router
