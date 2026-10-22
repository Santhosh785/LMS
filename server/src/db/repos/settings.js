import { eq } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { settings, SETTING_DEFAULTS } from '../schema/index.js'

/**
 * The site settings singleton (`key = 'site'`).
 *
 * Mongoose gave every read the schema defaults and hid the `*Enc` fields behind
 * `select: false`. jsonb has neither, so both happen here: defaults are merged
 * under what is stored, and ciphertext is stripped unless the caller asks for it
 * by name (runtimeConfig, which decrypts; integrations, which reports "set").
 */
export const GROUPS = Object.keys(SETTING_DEFAULTS)

const isSecretKey = (k) => k.endsWith('Enc')

function stripSecrets(group = {}) {
  return Object.fromEntries(Object.entries(group).filter(([k]) => !isSecretKey(k)))
}

function shape(row, { secrets }) {
  const out = { ...row }
  for (const g of GROUPS) {
    const merged = { ...SETTING_DEFAULTS[g], ...(row[g] || {}) }
    out[g] = secrets ? merged : stripSecrets(merged)
  }
  return withMongoId(out)
}

/** Reads the singleton, creating it on first use (the old getSingleton). */
export async function getSettings({ secrets = false, tx = db } = {}) {
  let [row] = await tx.select().from(settings).where(eq(settings.key, 'site'))
  if (!row) {
    await tx.insert(settings).values({ key: 'site' }).onConflictDoNothing({ target: settings.key })
    ;[row] = await tx.select().from(settings).where(eq(settings.key, 'site'))
  }
  return shape(row, { secrets })
}

/**
 * Merges `patch` into the singleton, one level deep per group — the same
 * semantics as Mongo's `$set: { 'branding.logoUrl': … }`: keys a form did not
 * send are left alone, including secrets a non-secret form never sees.
 *
 * `patch` is `{ branding: { … }, payments: { … } }`; unknown groups are ignored.
 * A key set to `undefined` is left alone; set to `null` it is removed.
 */
export async function updateSettings(patch = {}, { tx = db } = {}) {
  return tx.transaction(async (t) => {
    const current = await getSettings({ secrets: true, tx: t })
    const values = {}
    for (const g of GROUPS) {
      if (!patch[g] || typeof patch[g] !== 'object') continue
      const next = { ...(current[g] || {}) }
      for (const [k, v] of Object.entries(patch[g])) {
        if (v === undefined) continue
        if (v === null) delete next[k]
        else next[k] = v
      }
      values[g] = next
    }
    if (Object.keys(values).length) {
      await t.update(settings).set(values).where(eq(settings.key, 'site'))
    }
    return getSettings({ tx: t })
  })
}
