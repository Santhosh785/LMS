import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { sendCsv } from '../../utils/csv.js'
import { Customer, Course, User } from '../../models/index.js'
import { grantAccess } from '../../services/access.js'

const router = Router()

router.get(
  '/export',
  asyncHandler(async (_req, res) => {
    const rows = await Customer.find().sort({ joinedAt: -1 }).lean()
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
    const customer = await Customer.findById(req.params.id)
    if (!customer) throw new HttpError(404, 'Customer not found')

    const course = await Course.findById(req.body.courseId)
    if (!course) throw new HttpError(404, 'Course not found')

    // Customers only become learners once they have a user account.
    let userId = customer.userId
    if (!userId) {
      const user = await User.findOne({ email: customer.email })
      if (!user) throw new HttpError(400, 'This customer has no learner account yet')
      userId = user._id
      customer.userId = userId
      await customer.save()
    }

    // Same upsert as before, now shared with the checkout approval in task 12 so
    // the two paths cannot drift apart on expiry or the enrolment counter.
    const { enrollment } = await grantAccess(userId, course._id, {
      expiresAt: null, // an operator adding someone by hand grants lifetime
      source: 'manual',
    })
    res.status(201).json(enrollment)
  }),
)

router.use(
  '/',
  crudRouter(Customer, {
    searchFields: ['name', 'email', 'product'],
    sort: { joinedAt: -1 },
    dateField: 'joinedAt',
  }),
)

export default router
