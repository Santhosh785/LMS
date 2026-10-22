import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { sendCsv } from '../../utils/csv.js'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { isUuid } from '../../db/coerce.js'
import { courses, customers } from '../../db/schema/index.js'
import { findUserByEmail } from '../../db/repos/users.js'
import { enrollmentDocs } from '../../db/repos/enrollments.js'
import { grantAccess } from '../../services/access.js'

const router = Router()

router.get(
  '/export',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(customers).orderBy(desc(customers.joinedAt))
    sendCsv(res, 'customers.csv', rows, [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'product', label: 'Product' },
      { key: 'joinedAt', label: 'Joined', get: (r) => r.joinedAt?.toISOString().slice(0, 10) },
      { key: 'status', label: 'Status' },
    ])
  }),
)

/** "Add to course" from the customers table. */
router.post(
  '/:id/enroll',
  asyncHandler(async (req, res) => {
    const [customer] = isUuid(req.params.id)
      ? await db.select().from(customers).where(eq(customers.id, req.params.id))
      : []
    if (!customer) throw new HttpError(404, 'Customer not found')

    const [course] = isUuid(req.body.courseId)
      ? await db.select({ id: courses.id }).from(courses).where(eq(courses.id, req.body.courseId))
      : []
    if (!course) throw new HttpError(404, 'Course not found')

    // Customers only become learners once they have a user account.
    let userId = customer.userId
    if (!userId) {
      const user = await findUserByEmail(customer.email)
      if (!user) throw new HttpError(400, 'This customer has no learner account yet')
      userId = user.id
      await db.update(customers).set({ userId }).where(eq(customers.id, customer.id))
    }

    // Same grant as before, now shared with the checkout approval in task 12 so
    // the two paths cannot drift apart on expiry or the enrolment counter.
    const { enrollment } = await grantAccess(userId, course.id, {
      expiresAt: null, // an operator adding someone by hand grants lifetime
      source: 'manual',
    })
    res.status(201).json(await enrollmentDocs(enrollment))
  }),
)

router.use(
  '/',
  crudRouter(customers, {
    name: 'Customer',
    searchFields: ['name', 'email', 'product'],
    sort: { joinedAt: -1 },
    dateField: 'joinedAt',
  }),
)

export default router
