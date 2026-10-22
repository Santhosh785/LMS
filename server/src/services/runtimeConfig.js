import { env } from '../config/env.js'
import { Setting } from '../models/index.js'
import { open } from '../utils/secretBox.js'

/**
 * Configuration that an admin can change without touching the server.
 *
 * Feature flags, payment keys, the mail transport, Bunny credentials and the
 * business identity all used to live only in `server/.env`, so changing any of
 * them meant editing a file on the box and restarting. They are editable in
 * `/admin/integrations` now.
 *
 * ## Precedence
 *
 * A value set in admin wins; anything left blank falls back to the environment.
 * That ordering is what makes this safe to introduce on a running deployment —
 * before an operator fills anything in, every service behaves exactly as it did
 * when it read `env` directly.
 *
 * ## Why the accessors are synchronous
 *
 * The consumers are the payment, playback and mail paths, which read config in
 * the middle of request handling. Turning forty call sites into `await` would
 * be a large change to the code most expensive to get wrong, so the resolved
 * values are held in a plain object refreshed at boot and on every admin write,
 * and exposed through getters. Callers keep reading `cfg.razorpay.keyId`.
 *
 * The TTL is the multi-process safety net: `refresh()` only clears the worker
 * that served the write, so every other worker picks the change up within a
 * minute rather than at the next restart.
 */

const TTL_MS = 60_000

let overrides = {}
let loadedAt = 0

/** Secrets are stored sealed; `select: false` means they must be asked for. */
const SECRET_PATHS = [
  '+payments.razorpayKeySecretEnc',
  '+payments.razorpayWebhookSecretEnc',
  '+mail.resendApiKeyEnc',
  '+video.bunnySecurityKeyEnc',
  '+video.bunnyApiKeyEnc',
  '+video.bunnyWebhookTokenEnc',
  '+media.bunnyStoragePasswordEnc',
].join(' ')

/** '' and null both mean "not set here" — only a real value overrides env. */
const pick = (value, fallback) =>
  value === undefined || value === null || value === '' ? fallback : value

/** A tri-state flag: true/false override the environment, null defers to it. */
const flag = (value, fallback) => (typeof value === 'boolean' ? value : fallback)

/**
 * Warns when a stored secret cannot be opened.
 *
 * The encryption root is `CONFIG_SECRET`, falling back to `JWT_SECRET`. That
 * fallback is convenient and it is also a trap: deploy with a fresh
 * `JWT_SECRET` against a database that already holds admin-entered keys, and
 * every one of them silently becomes unreadable. Config then falls back to the
 * environment and the symptom is "payments stopped working" with nothing in the
 * logs. This makes it loud instead.
 */
function warnOnUnreadableSecrets(doc) {
  if (!doc) return
  const sealed = [
    ['Razorpay key secret', doc.payments?.razorpayKeySecretEnc],
    ['Razorpay webhook secret', doc.payments?.razorpayWebhookSecretEnc],
    ['Resend API key', doc.mail?.resendApiKeyEnc],
    ['Bunny security key', doc.video?.bunnySecurityKeyEnc],
    ['Bunny API key', doc.video?.bunnyApiKeyEnc],
    ['Bunny webhook token', doc.video?.bunnyWebhookTokenEnc],
    ['Bunny Storage password', doc.media?.bunnyStoragePasswordEnc],
  ].filter(([, value]) => Boolean(value))

  const broken = sealed.filter(([, value]) => !open(value)).map(([name]) => name)
  if (broken.length) {
    console.error(
      `[config] ${broken.length} stored secret(s) could not be decrypted: ${broken.join(', ')}. ` +
        'CONFIG_SECRET (or JWT_SECRET, if CONFIG_SECRET is unset) does not match the value they ' +
        'were saved with. They are being ignored and the environment is being used instead — ' +
        're-enter them in /admin/integrations, or restore the original key.',
    )
  }
}

export async function refreshRuntimeConfig() {
  try {
    const doc = await Setting.findOne({ key: 'site' }).select(SECRET_PATHS).lean()
    warnOnUnreadableSecrets(doc)
    overrides = doc || {}
  } catch {
    // A database blip must not take payments down: keep whatever was loaded
    // last and let the environment carry the request.
    overrides = overrides || {}
  }
  loadedAt = Date.now()
  return overrides
}

/** Called after every admin write so the change applies to the next request. */
export function invalidateRuntimeConfig() {
  loadedAt = 0
}

/**
 * Reloads in the background once the TTL has passed. Deliberately not awaited —
 * the current request is served from the values already in hand, and the next
 * one gets the fresh copy.
 */
function current() {
  if (Date.now() - loadedAt > TTL_MS) {
    loadedAt = Date.now()
    refreshRuntimeConfig().catch(() => {})
  }
  return overrides
}

export const cfg = {
  get features() {
    const f = current().features || {}
    return {
      funnels: flag(f.funnels, env.features.funnels),
      email: flag(f.email, env.features.email),
      gamification: flag(f.gamification, env.features.gamification),
    }
  },

  get razorpay() {
    const p = current().payments || {}
    return {
      keyId: pick(p.razorpayKeyId, env.razorpay.keyId),
      keySecret: pick(open(p.razorpayKeySecretEnc), env.razorpay.keySecret),
      webhookSecret: pick(open(p.razorpayWebhookSecretEnc), env.razorpay.webhookSecret),
    }
  },

  get upiVpa() {
    return pick(current().payments?.upiVpa, env.upiVpa)
  },
  get upiPayeeName() {
    return pick(current().payments?.upiPayeeName, env.upiPayeeName)
  },
  get invoicePrefix() {
    return pick(current().payments?.invoicePrefix, env.invoicePrefix)
  },

  get resendApiKey() {
    return pick(open(current().mail?.resendApiKeyEnc), env.resendApiKey)
  },
  get mailFrom() {
    return pick(current().mail?.from, env.mailFrom)
  },

  get bunnyLibraryId() {
    return pick(current().video?.bunnyLibraryId, env.bunnyLibraryId)
  },
  get bunnySecurityKey() {
    return pick(open(current().video?.bunnySecurityKeyEnc), env.bunnySecurityKey)
  },
  get bunnyApiKey() {
    return pick(open(current().video?.bunnyApiKeyEnc), env.bunnyApiKey)
  },
  get bunnyWebhookToken() {
    return pick(open(current().video?.bunnyWebhookTokenEnc), env.bunnyWebhookToken)
  },

  get bunnyStorage() {
    const m = current().media || {}
    return {
      zone: pick(m.bunnyStorageZone, env.bunnyStorageZone),
      password: pick(open(m.bunnyStoragePasswordEnc), env.bunnyStoragePassword),
      region: pick(m.bunnyStorageRegion, env.bunnyStorageRegion),
      host: pick(m.bunnyStorageHost, env.bunnyStorageHost),
    }
  },

  get business() {
    const b = current().business || {}
    return {
      name: pick(b.legalName, env.business.name),
      supportEmail: pick(b.supportEmail, env.business.supportEmail),
      address: pick(b.address, env.business.address),
      phone: pick(b.phone, ''),
      gstin: pick(b.gstin, ''),
      jurisdictionCity: pick(b.jurisdictionCity, ''),
      grievanceOfficer: pick(b.grievanceOfficer, ''),
    }
  },

  get adminEmail() {
    return pick(current().business?.operatorEmail, env.adminEmail)
  },
}
