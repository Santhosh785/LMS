import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import Workshop from '../models/Workshop.js'
import WorkshopRegistration from '../models/WorkshopRegistration.js'
import { send } from '../mail/index.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {}
    if (req.query.mode) filter.mode = req.query.mode
    if (req.query.language) filter.language = req.query.language
    const items = await Workshop.find(filter).sort({ language: 1, startsAt: 1 }).lean()
    res.json({ items })
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const workshop = await Workshop.findOne({ slug: req.params.slug }).lean()
    if (!workshop) throw new HttpError(404, 'Workshop not found')
    res.json(workshop)
  }),
)

router.post(
  '/:id/register',
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  validate,
  asyncHandler(async (req, res) => {
    const workshop = await Workshop.findById(req.params.id).lean()
    if (!workshop) throw new HttpError(404, 'Workshop not found')

    /**
     * Idempotent. Registering twice used to create a second document and add
     * another to `registeredCount`, so anyone could inflate the number on a
     * workshop page by refreshing the form.
     *
     * Returning the existing registration rather than erroring is the friendlier
     * half of that: someone who double-taps Register, or comes back to check
     * they did it, should be told they are in — not shown a failure.
     */
    const identity = req.user
      ? { workshopId: workshop._id, userId: req.user._id }
      : { workshopId: workshop._id, 'guest.email': req.body.email }

    const existing = await WorkshopRegistration.findOne(identity).lean()
    if (existing) {
      return res.status(200).json({
        ok: true,
        alreadyRegistered: true,
        registeredCount: workshop.registeredCount,
      })
    }

    try {
      await WorkshopRegistration.create({
        workshopId: workshop._id,
        userId: req.user?._id,
        guest: { name: req.body.name, email: req.body.email, phone: req.body.phone },
      })
    } catch (err) {
      // The unique index caught a duplicate the check above raced past.
      if (err?.code === 11000) {
        return res.status(200).json({
          ok: true,
          alreadyRegistered: true,
          registeredCount: workshop.registeredCount,
        })
      }
      throw err
    }

    // $inc, not read-modify-write — concurrent registrations lose increments.
    const updated = await Workshop.findByIdAndUpdate(
      workshop._id,
      { $inc: { registeredCount: 1 } },
      { new: true },
    ).lean()

    // Not awaited, and `send` swallows its own failures: a bounced confirmation
    // must not turn a successful registration into an error.
    void send('workshop-confirmation', req.body.email, {
      name: req.body.name || req.user?.name || 'there',
      workshopTitle: workshop.title,
      startsAt: workshop.startsAt,
      language: workshop.language,
      mode: workshop.mode,
      // No join link is held on the Workshop record, so the template says the
      // link follows rather than rendering a dead button.
    })

    res.status(201).json({ ok: true, registeredCount: updated.registeredCount })
  }),
)

export default router
