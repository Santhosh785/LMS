import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth.js'
import { requireFeature } from '../../middleware/features.js'

import statsRoutes from './stats.routes.js'
import courseRoutes from './course.routes.js'
import customerRoutes from './customer.routes.js'
import transactionRoutes from './transaction.routes.js'
import emailRoutes from './email.routes.js'
import funnelRoutes from './funnel.routes.js'
import liveRoutes from './live.routes.js'
import gamificationRoutes from './gamification.routes.js'
import communityRoutes from './community.routes.js'
import settingsRoutes from './settings.routes.js'
import taxonomyRoutes from './taxonomy.routes.js'
import programRoutes from './program.routes.js'
import leadRoutes from './lead.routes.js'
import adminWorkshopRoutes from './workshop.routes.js'
import userRoutes from './user.routes.js'
import integrationRoutes from './integration.routes.js'
import blogRoutes from './blog.routes.js'
import mediaRoutes from './media.routes.js'

const router = Router()

// Every admin endpoint is gated here rather than per-router.
router.use(requireAuth, requireRole('admin'))

router.use('/stats', statsRoutes)
router.use('/courses', courseRoutes)
router.use('/customers', customerRoutes)
router.use('/transactions', transactionRoutes)
// The three flagged modules stay mounted but answer 404 while their flag is
// off — hiding them in the client only would leave the endpoints open to a
// crafted request. See env.features for why each one is off.
router.use('/email', requireFeature('email'), emailRoutes)
router.use('/funnels', requireFeature('funnels'), funnelRoutes)
router.use('/live', liveRoutes)
router.use('/gamification', requireFeature('gamification'), gamificationRoutes)
router.use('/community', communityRoutes)
router.use('/settings', settingsRoutes)
router.use('/taxonomy', taxonomyRoutes)
router.use('/programs', programRoutes)
router.use('/leads', leadRoutes)
router.use('/workshops', adminWorkshopRoutes)
router.use('/users', userRoutes)
router.use('/integrations', integrationRoutes)
router.use('/blog', blogRoutes)
router.use('/media', mediaRoutes)

export default router
