import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/error.js'
import { db } from '../db/index.js'
import { leads } from '../db/schema/index.js'

const router = Router()

// Mirrors the mentor popup's own validation: email must be valid, phone non-empty.
router.post(
  '/',
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  validate,
  asyncHandler(async (req, res) => {
    const [lead] = await db
      .insert(leads)
      .values({
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        education: req.body.education,
        profile: req.body.profile,
        yearOfPassing: req.body.year || req.body.yearOfPassing,
        language: req.body.language,
        source: req.body.source || 'mentor-popup',
        page: req.body.page,
      })
      .returning({ id: leads.id })
    res.status(201).json({ ok: true, id: lead.id })
  }),
)

export default router
