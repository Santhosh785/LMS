import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { emailContacts } from '../db/schema/index.js'
import {
  findPublishedPlaybook,
  findPublishedSkill,
  listPublishedPlaybooks,
  listPublishedSkills,
} from '../db/repos/resources.js'

const router = Router()

/**
 * The public Resources section: mentor playbooks and Claude skills.
 *
 * The reads go through db/repos/resources.js, which the server-rendered
 * pages share; only the "notify me" write lives here.
 */

router.get(
  '/playbooks',
  asyncHandler(async (req, res) => {
    res.json(await listPublishedPlaybooks({ tag: req.query.tag }))
  }),
)

router.get(
  '/playbooks/:slug',
  asyncHandler(async (req, res) => {
    const playbook = await findPublishedPlaybook(req.params.slug)
    if (!playbook) throw new HttpError(404, 'Playbook not found')
    res.json(playbook)
  }),
)

router.get(
  '/skills',
  asyncHandler(async (req, res) => {
    res.json(await listPublishedSkills({ category: req.query.category }))
  }),
)

router.get(
  '/skills/:slug',
  asyncHandler(async (req, res) => {
    const skill = await findPublishedSkill(req.params.slug)
    if (!skill) throw new HttpError(404, 'Skill not found')
    res.json(skill)
  }),
)

/**
 * "Get notified when a new playbook drops" on the index page.
 *
 * Stored as an EmailContact, the model built for exactly this. Idempotent on
 * email: re-submitting re-subscribes rather than creating a duplicate, so a
 * double-tap cannot inflate the list.
 *
 * Note for whoever wires the sending side: the Email admin module is behind
 * FEATURE_EMAIL, so these addresses are captured but not browsable in the UI
 * until that flag is on. They are in the `email_contacts` table meanwhile.
 */
router.post(
  '/notify',
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  validate,
  asyncHandler(async (req, res) => {
    // email has no unique constraint (a contact list may legitimately hold
    // imports with duplicates), so the upsert is an update-then-insert.
    const updated = await db
      .update(emailContacts)
      .set({ status: 'Subscribed' })
      .where(sql`${emailContacts.email} = ${req.body.email}`)
      .returning({ id: emailContacts.id })
    if (!updated.length) {
      await db.insert(emailContacts).values({ email: req.body.email, status: 'Subscribed' })
    }
    res.status(201).json({ ok: true })
  }),
)

export default router
