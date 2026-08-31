import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { Setting } from '../../models/index.js'
import { cfg, invalidateRuntimeConfig, refreshRuntimeConfig } from '../../services/runtimeConfig.js'
import { invalidateSiteConfig } from '../../services/siteConfig.js'
import { mask, open, seal } from '../../utils/secretBox.js'
import { isRazorpayConfigured } from '../../services/razorpay.js'
import { isBunnyConfigured } from '../../services/bunny.js'
import { isBunnyManagementConfigured } from '../../services/bunnyApi.js'
import { isUpiConfigured } from '../../services/upi.js'

const router = Router()

/**
 * Integrations, feature flags and business identity — the settings that used to
 * exist only in `server/.env`.
 *
 * Three rules hold this together:
 *
 *   1. **A secret is never returned.** Reads carry a masked hint (`••••4f2a`)
 *      and a boolean saying whether anything is stored, never the value.
 *   2. **An empty string means "leave it alone".** Otherwise every save through
 *      a form showing masked values would wipe the keys it could not display.
 *      Clearing a secret is an explicit action, not a side effect.
 *   3. **A blank field falls back to the environment**, so introducing this on
 *      a running deployment changes nothing until an operator fills it in.
 */

/** Secret fields, by the block they live in: [apiField, storedField]. */
const SECRETS = {
  payments: [
    ['razorpayKeySecret', 'razorpayKeySecretEnc'],
    ['razorpayWebhookSecret', 'razorpayWebhookSecretEnc'],
  ],
  mail: [['resendApiKey', 'resendApiKeyEnc']],
  video: [
    ['bunnySecurityKey', 'bunnySecurityKeyEnc'],
    ['bunnyApiKey', 'bunnyApiKeyEnc'],
    ['bunnyWebhookToken', 'bunnyWebhookTokenEnc'],
  ],
}

/** Plain fields an admin may write, by block. */
const PLAIN = {
  payments: ['razorpayKeyId', 'upiVpa', 'upiPayeeName', 'invoicePrefix'],
  mail: ['from'],
  video: ['bunnyLibraryId'],
  business: [
    'legalName',
    'address',
    'supportEmail',
    'operatorEmail',
    'phone',
    'gstin',
    'jurisdictionCity',
    'grievanceOfficer',
  ],
  features: ['funnels', 'email', 'gamification'],
}

const BLOCKS = Object.keys(PLAIN)

/**
 * The projection that pulls the `select: false` secret fields back.
 *
 * These must be full paths (`+payments.razorpayKeySecretEnc`), not bare field
 * names — Mongoose silently ignores a projection path it cannot resolve, so
 * getting this wrong does not error, it just returns the document without its
 * secrets. On the write path that is worse than a read bug: the handler would
 * see no stored value, and "leave blank to keep the existing key" would quietly
 * erase it instead.
 */
const withSecrets = () =>
  Object.entries(SECRETS)
    .flatMap(([block, fields]) => fields.map(([, stored]) => `+${block}.${stored}`))
    .join(' ')

/**
 * The effective value for a secret, which may come from the environment rather
 * than the database — an operator needs to see that Razorpay is already working
 * from `.env`, not an empty box implying it is unconfigured.
 */
function secretState(effective, storedEnc) {
  // A stored value that will not decrypt is not "set here" — the app is
  // quietly using the environment instead. Saying "admin" would send whoever
  // is debugging a dead integration to the one screen that cannot explain it,
  // so it gets its own state.
  const readable = storedEnc ? Boolean(open(storedEnc)) : false
  const source = readable ? 'admin' : storedEnc ? 'unreadable' : effective ? 'environment' : 'unset'

  return { set: Boolean(effective), hint: mask(effective), source }
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const doc = await Setting.getSingleton()
    const full = await Setting.findById(doc._id).select(withSecrets()).lean()

    const payments = full.payments || {}
    const mail = full.mail || {}
    const video = full.video || {}

    res.json({
      features: {
        // null here means "no admin override" — the UI shows it as inheriting.
        stored: full.features || {},
        effective: cfg.features,
      },
      payments: {
        razorpayKeyId: cfg.razorpay.keyId,
        razorpayKeyIdSource: payments.razorpayKeyId ? 'admin' : 'environment',
        razorpayKeySecret: secretState(cfg.razorpay.keySecret, payments.razorpayKeySecretEnc),
        razorpayWebhookSecret: secretState(
          cfg.razorpay.webhookSecret,
          payments.razorpayWebhookSecretEnc,
        ),
        upiVpa: cfg.upiVpa,
        upiPayeeName: cfg.upiPayeeName,
        invoicePrefix: cfg.invoicePrefix,
      },
      mail: {
        from: cfg.mailFrom,
        resendApiKey: secretState(cfg.resendApiKey, mail.resendApiKeyEnc),
      },
      video: {
        bunnyLibraryId: cfg.bunnyLibraryId,
        bunnySecurityKey: secretState(cfg.bunnySecurityKey, video.bunnySecurityKeyEnc),
        bunnyApiKey: secretState(cfg.bunnyApiKey, video.bunnyApiKeyEnc),
        bunnyWebhookToken: secretState(cfg.bunnyWebhookToken, video.bunnyWebhookTokenEnc),
      },
      business: { ...cfg.business, operatorEmail: cfg.adminEmail },
      status: {
        razorpay: isRazorpayConfigured(),
        upi: isUpiConfigured(),
        mail: Boolean(cfg.resendApiKey && cfg.mailFrom),
        playback: isBunnyConfigured(),
        upload: isBunnyManagementConfigured(),
      },
    })
  }),
)

router.put(
  '/:block',
  asyncHandler(async (req, res) => {
    const { block } = req.params
    if (!BLOCKS.includes(block)) throw new HttpError(400, 'Unknown settings block')

    const setting = await Setting.getSingleton()
    const doc = await Setting.findById(setting._id).select(withSecrets())
    const patch = doc[block] || {}

    for (const field of PLAIN[block]) {
      if (req.body[field] === undefined) continue
      // A feature flag is tri-state: true, false, or null to defer to the
      // environment. Everything else is a trimmed string.
      patch[field] =
        block === 'features'
          ? req.body[field] === null
            ? null
            : Boolean(req.body[field])
          : String(req.body[field]).trim()
    }

    for (const [apiField, stored] of SECRETS[block] || []) {
      const value = req.body[apiField]
      if (value === undefined) continue
      // Explicit null clears; '' is the masked placeholder coming back
      // unchanged and must not wipe a working key.
      if (value === null) patch[stored] = ''
      else if (String(value).trim() !== '') patch[stored] = seal(String(value).trim())
    }

    doc[block] = patch
    doc.markModified(block)
    await doc.save()

    // Both caches serve this document: the public one carries branding and the
    // feature flags the browser reads, this one carries the credentials.
    invalidateRuntimeConfig()
    invalidateSiteConfig()
    await refreshRuntimeConfig()

    res.json({ ok: true })
  }),
)

/**
 * Confirms a credential actually works, rather than only that it is present.
 *
 * Payment and mail keys fail silently in the worst possible place — mid
 * checkout, or on a password reset nobody receives — so being able to check
 * before going live is the point of storing them here.
 */
router.post(
  '/:name/test',
  asyncHandler(async (req, res) => {
    const { name } = req.params

    if (name === 'razorpay') {
      if (!isRazorpayConfigured()) throw new HttpError(400, 'Add a key id and secret first')
      const { razorpay } = await import('../../services/razorpay.js')
      try {
        // Cheapest authenticated read that proves the key pair is valid.
        await razorpay().orders.all({ count: 1 })
        return res.json({ ok: true, message: 'Razorpay credentials accepted' })
      } catch (err) {
        throw new HttpError(400, `Razorpay rejected the credentials: ${err.message}`)
      }
    }

    if (name === 'mail') {
      if (!cfg.resendApiKey || !cfg.mailFrom) {
        throw new HttpError(400, 'Add an API key and a from address first')
      }
      const to = req.body?.to?.trim() || req.user.email
      // Reuses the real set-password template rather than a bespoke one, so a
      // successful test proves the template layer works too, not just the key.
      const { send } = await import('../../mail/index.js')
      const sent = await send('set-password', to, {
        name: req.user.name,
        email: to,
        resetUrl: `${'/'}`,
        expiresInLabel: 'a test message — this link does nothing',
        isNewAccount: false,
      })
      if (!sent) throw new HttpError(400, 'The mail provider did not accept the message')
      return res.json({ ok: true, message: `Test email sent to ${to}` })
    }

    if (name === 'bunny') {
      if (!isBunnyManagementConfigured()) {
        throw new HttpError(400, 'Add a library id and API key first')
      }
      const { getVideo } = await import('../../services/bunnyApi.js')
      try {
        // A GUID that cannot exist: Bunny answers 404 when the key is accepted
        // and 401 when it is not, so "not found" is the success case here.
        await getVideo('00000000-0000-0000-0000-000000000000')
        return res.json({ ok: true, message: 'Bunny library reachable' })
      } catch (err) {
        if (/404|not found/i.test(err.message)) {
          return res.json({ ok: true, message: 'Bunny library reachable' })
        }
        throw new HttpError(400, `Bunny rejected the credentials: ${err.message}`)
      }
    }

    throw new HttpError(400, 'Nothing to test by that name')
  }),
)

export default router
