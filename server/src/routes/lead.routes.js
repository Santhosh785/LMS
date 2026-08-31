import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../middleware/error.js'
import Lead from '../models/Lead.js'

const router = Router()

// Mirrors the mentor popup's own validation: email must be valid, phone non-empty.
router.post(
  '/',
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  validate,
  asyncHandler(async (req, res) => {
    const lead = await Lead.create({
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
    res.status(201).json({ ok: true, id: lead._id })
  }),
)

export default router
