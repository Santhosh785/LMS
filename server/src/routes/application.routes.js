import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { db } from '../db/index.js'
import { fitCallBookings, flagshipApplications } from '../db/schema/index.js'

const router = Router()

/**
 * Public intake for the Flagship programme: the full application and the
 * 15-minute fit call.
 *
 * The redesign validates all of this in the browser only. A form that gates a
 * ₹79,999 programme cannot rely on that — anything worth enforcing is enforced
 * here as well, because the browser's copy is a convenience, not a control.
 */

/** Word counters on the essays, matching the `data-max-words` in the drop. */
const WORD_LIMITS = {
  whyFlagship: 200,
  twelveWeekOutcome: 120,
  shipStory: 250,
  curriculumHook: 80,
  scholarshipCase: 200,
}

const countWords = (s) =>
  String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

/** Experience levels the drop treats as "beginner" for its conditional blocks. */
const BEGINNER_LEVELS = ['exploring', 'complete-beginner']

/**
 * The anti-spam question: "Type the batch you are applying for". The drop's
 * pattern is `^([Bb]atch\s*)?4$`, and the same shape is accepted here.
 */
const BATCH_ANSWER = /^(batch\s*)?4$/i

const required = (field, message) => body(field).trim().notEmpty().withMessage(message)

router.post(
  '/applications',
  required('fullName', 'Your name is required'),
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('phone')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Enter a phone number we can reach you on'),
  required('city', 'City is required'),
  required('state', 'State is required'),
  required('trackPreference', 'Pick a track'),
  required('batchPreference', 'Pick a batch'),
  required('mentoringLanguage', 'Pick a mentoring language'),
  required('currentStatus', 'Tell us your current status'),
  required('weeklyHours', 'Tell us how many hours a week you can commit'),
  required('hasSetup', 'Tell us about your laptop and internet'),
  required('masterclassCity', 'Pick a masterclass city'),
  required('experienceLevel', 'Pick the closest experience level'),
  required('referralSource', 'Tell us how you found us'),
  required('referralDetail', 'Be specific about where you found us'),
  required('whyFlagship', 'This answer is required'),
  required('twelveWeekOutcome', 'This answer is required'),
  required('shipStory', 'This answer is required'),
  required('curriculumHook', 'This answer is required'),
  required('paymentPlan', 'Pick a payment plan'),
  validate,
  asyncHandler(async (req, res) => {
    const b = req.body

    // The gotcha is checked server-side too; a bot posting straight to the API
    // never runs the browser's pattern attribute.
    if (!BATCH_ANSWER.test(String(b.batchGotcha || '').trim())) {
      throw new HttpError(400, 'Please confirm the batch you are applying for')
    }

    if (b.consentWhatsapp !== true || b.consentAccurate !== true) {
      throw new HttpError(400, 'Both confirmations are required to submit')
    }

    const liveAvailability = Array.isArray(b.liveAvailability) ? b.liveAvailability : []
    if (!liveAvailability.length) {
      throw new HttpError(400, 'Pick at least one time you can attend live sessions')
    }

    const isScholarship = b.paymentPlan === 'scholarship'
    if (isScholarship && !String(b.scholarshipCase || '').trim()) {
      throw new HttpError(400, 'Tell us why you are applying for a scholarship')
    }

    for (const [field, limit] of Object.entries(WORD_LIMITS)) {
      if (countWords(b[field]) > limit) {
        throw new HttpError(400, `Keep "${field}" under ${limit} words`)
      }
    }

    /**
     * Conditional answers are stored only when the branch that asks them was
     * actually on screen. Someone who fills the experienced block, switches to
     * "beginner" and submits should not leave a spend figure behind for a
     * reviewer to read as current.
     */
    const isBeginner = BEGINNER_LEVELS.includes(b.experienceLevel)

    const [application] = await db
      .insert(flagshipApplications)
      .values({
        fullName: b.fullName,
        email: b.email,
        phone: b.phone,
        linkedin: b.linkedin,
        city: b.city,
        state: b.state,

        trackPreference: b.trackPreference,
        batchPreference: b.batchPreference,
        mentoringLanguage: b.mentoringLanguage,
        currentStatus: b.currentStatus,
        employer: b.employer,

        weeklyHours: b.weeklyHours,
        liveAvailability,
        hasSetup: b.hasSetup,
        masterclassCity: b.masterclassCity,
        scheduleBlockers: b.scheduleBlockers,

        experienceLevel: b.experienceLevel,
        channels: Array.isArray(b.channels) ? b.channels : [],
        monthlySpend: isBeginner ? undefined : b.monthlySpend,
        toolsUsed: isBeginner ? undefined : b.toolsUsed,
        portfolioUrl: isBeginner ? undefined : b.portfolioUrl,
        starterCourses: isBeginner ? b.starterCourses : undefined,

        referralSource: b.referralSource,
        referralDetail: b.referralDetail,
        whyFlagship: b.whyFlagship,
        twelveWeekOutcome: b.twelveWeekOutcome,
        shipStory: b.shipStory,
        curriculumHook: b.curriculumHook,

        paymentPlan: b.paymentPlan,
        scholarshipCase: isScholarship ? b.scholarshipCase : undefined,

        consentWhatsapp: true,
        consentAccurate: true,
        page: b.page,
      })
      .returning({ id: flagshipApplications.id })

    res.status(201).json({ ok: true, id: application.id })
  }),
)

router.post(
  '/fit-calls',
  required('fullName', 'Your name is required'),
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('phone')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Enter a phone number we can reach you on'),
  validate,
  asyncHandler(async (req, res) => {
    const b = req.body

    if (b.consent !== true) {
      throw new HttpError(400, 'Please agree to be contacted so we can call you')
    }

    const preferredSlots = Array.isArray(b.preferredSlots) ? b.preferredSlots : []
    if (!preferredSlots.length) {
      throw new HttpError(400, 'Pick at least one slot that works for you')
    }

    const [booking] = await db
      .insert(fitCallBookings)
      .values({
        fullName: b.fullName,
        email: b.email,
        phone: b.phone,
        timezone: b.timezone || 'IST',
        preferredWeek: b.preferredWeek,
        preferredSlots,
        callLanguage: b.callLanguage,
        scheduleNotes: b.scheduleNotes,
        currentStatus: b.currentStatus,
        weeklyHours: b.weeklyHours,
        submittedFullApplication: b.submittedFullApplication || 'no',
        whyCallNow: b.whyCallNow,
        biggestBlocker: b.biggestBlocker,
        callQuestions: b.callQuestions,
        referralSource: b.referralSource,
        consent: true,
        page: b.page,
      })
      .returning({ id: fitCallBookings.id })

    res.status(201).json({ ok: true, id: booking.id })
  }),
)

export default router
