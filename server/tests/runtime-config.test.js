import { describe, expect, it } from 'vitest'
import { Setting } from '../src/models/index.js'
import { cfg, refreshRuntimeConfig } from '../src/services/runtimeConfig.js'
import { mask, open, seal } from '../src/utils/secretBox.js'
import { agent, signUpAdmin } from './helpers/factories.js'

/**
 * Admin-managed configuration (CFG-4 / CFG-5).
 *
 * Two properties matter more than the happy path:
 *
 *   - **A stored secret never comes back out.** These are live payment and mail
 *     credentials; the admin API may report that one is set and show a hint,
 *     never the value.
 *   - **A blank field falls back to the environment.** That is what made this
 *     safe to introduce on a running deployment — until an operator fills
 *     something in, every service behaves exactly as it did before.
 */

async function adminAgent() {
  const { cookie } = await signUpAdmin()
  return (method, url) => agent()[method](url).set('Cookie', cookie)
}

describe('secret box', () => {
  it('round-trips a value', () => {
    const sealed = seal('rzp_live_supersecret')
    expect(sealed).not.toContain('supersecret')
    expect(open(sealed)).toBe('rzp_live_supersecret')
  })

  it('returns empty rather than throwing on a corrupt or foreign value', () => {
    expect(open('not-a-sealed-value')).toBe('')
    expect(open('v1:aaa:bbb:ccc')).toBe('')
    expect(open('')).toBe('')
    expect(open(undefined)).toBe('')
  })

  it('masks to a recognisable but unusable hint', () => {
    expect(mask('rzp_live_abcd1234')).toBe('••••1234')
    expect(mask('abc')).toBe('••••')
    expect(mask('')).toBe('')
  })
})

describe('config precedence', () => {
  it('falls back to the environment when nothing is stored', async () => {
    await Setting.getSingleton()
    await refreshRuntimeConfig()
    // The test environment sets these; see tests/setup.js.
    expect(cfg.razorpay.keyId).toBe('rzp_test_key')
    expect(cfg.upiVpa).toBe('test@okbank')
  })

  it('prefers an admin-stored value over the environment', async () => {
    const doc = await Setting.getSingleton()
    doc.payments = { razorpayKeyId: 'rzp_live_from_admin', upiVpa: 'admin@okbank' }
    await doc.save()
    await refreshRuntimeConfig()

    expect(cfg.razorpay.keyId).toBe('rzp_live_from_admin')
    expect(cfg.upiVpa).toBe('admin@okbank')
  })

  it('treats a blank stored value as "not set" rather than as an override', async () => {
    const doc = await Setting.getSingleton()
    doc.payments = { razorpayKeyId: '' }
    await doc.save()
    await refreshRuntimeConfig()

    expect(cfg.razorpay.keyId).toBe('rzp_test_key')
  })

  it('decrypts a stored secret for the services that need it', async () => {
    const doc = await Setting.getSingleton()
    doc.payments = { razorpayKeySecretEnc: seal('live-secret-from-admin') }
    await doc.save()
    await refreshRuntimeConfig()

    expect(cfg.razorpay.keySecret).toBe('live-secret-from-admin')
  })

  it('reads a feature flag as tri-state', async () => {
    const doc = await Setting.getSingleton()

    doc.features = { gamification: true }
    await doc.save()
    await refreshRuntimeConfig()
    expect(cfg.features.gamification).toBe(true)

    doc.features = { gamification: null }
    await doc.save()
    await refreshRuntimeConfig()
    // Back to whatever the environment says — off in tests.
    expect(cfg.features.gamification).toBe(false)
  })
})

describe('admin integrations API', () => {
  it('never returns a stored secret, only whether one is set and a hint', async () => {
    const doc = await Setting.getSingleton()
    doc.payments = { razorpayKeySecretEnc: seal('rzp_secret_abcd9999') }
    await doc.save()
    await refreshRuntimeConfig()

    const as = await adminAgent()
    const res = await as('get', '/api/admin/integrations').expect(200)

    expect(JSON.stringify(res.body)).not.toContain('rzp_secret_abcd9999')
    expect(res.body.payments.razorpayKeySecret).toMatchObject({ set: true, source: 'admin' })
    expect(res.body.payments.razorpayKeySecret.hint).toBe('••••9999')
  })

  it('reports a secret that is coming from the environment', async () => {
    await Setting.getSingleton()
    await refreshRuntimeConfig()
    const as = await adminAgent()

    const res = await as('get', '/api/admin/integrations').expect(200)
    expect(res.body.payments.razorpayKeySecret.source).toBe('environment')
  })

  it('stores a submitted secret encrypted, not in the clear', async () => {
    const as = await adminAgent()
    await as('put', '/api/admin/integrations/payments')
      .send({ razorpayKeySecret: 'plaintext-should-not-persist' })
      .expect(200)

    const raw = await Setting.findOne({ key: 'site' })
      .select('+payments.razorpayKeySecretEnc')
      .lean()
    expect(raw.payments.razorpayKeySecretEnc).not.toContain('plaintext-should-not-persist')
    expect(open(raw.payments.razorpayKeySecretEnc)).toBe('plaintext-should-not-persist')
  })

  it('leaves a stored secret alone when the field comes back blank', async () => {
    const as = await adminAgent()
    await as('put', '/api/admin/integrations/payments')
      .send({ razorpayKeySecret: 'keep-me' })
      .expect(200)

    // The form re-submits '' for the masked field it could not display.
    await as('put', '/api/admin/integrations/payments')
      .send({ razorpayKeySecret: '', upiVpa: 'changed@okbank' })
      .expect(200)

    await refreshRuntimeConfig()
    expect(cfg.razorpay.keySecret).toBe('keep-me')
    expect(cfg.upiVpa).toBe('changed@okbank')
  })

  it('clears a secret only when explicitly nulled', async () => {
    const as = await adminAgent()
    await as('put', '/api/admin/integrations/payments')
      .send({ razorpayKeySecret: 'temporary' })
      .expect(200)

    await as('put', '/api/admin/integrations/payments')
      .send({ razorpayKeySecret: null })
      .expect(200)

    await refreshRuntimeConfig()
    // Falls back to the environment again, rather than becoming empty.
    expect(cfg.razorpay.keySecret).toBe('test-razorpay-key-secret')
  })

  it('takes a feature flag live without a restart', async () => {
    const as = await adminAgent()

    // Gamification is off in the test environment, so its admin API 404s.
    await as('get', '/api/admin/gamification/points').expect(404)

    await as('put', '/api/admin/integrations/features').send({ gamification: true }).expect(200)
    await as('get', '/api/admin/gamification/points').expect(200)

    const config = await agent().get('/api/config').expect(200)
    expect(config.body.features.gamification).toBe(true)
  })

  it('rejects an unknown settings block', async () => {
    const as = await adminAgent()
    await as('put', '/api/admin/integrations/nonsense').send({ x: 1 }).expect(400)
  })

  it('is closed without an admin session', async () => {
    await agent().get('/api/admin/integrations').expect(401)
  })
})

describe('production traps', () => {
  it('ignores a secret it cannot decrypt rather than serving garbage', async () => {
    const doc = await Setting.getSingleton()
    // What a key encrypted under a different CONFIG_SECRET looks like.
    doc.payments = { razorpayKeySecretEnc: 'v1:AAAA:BBBB:CCCC' }
    await doc.save()
    await refreshRuntimeConfig()

    // Falls back to the environment; never returns the undecryptable bytes.
    expect(cfg.razorpay.keySecret).toBe('test-razorpay-key-secret')
  })

  it('reports an undecryptable secret as coming from the environment', async () => {
    const doc = await Setting.getSingleton()
    doc.payments = { razorpayKeySecretEnc: 'v1:AAAA:BBBB:CCCC' }
    await doc.save()
    await refreshRuntimeConfig()

    const as = await adminAgent()
    const res = await as('get', '/api/admin/integrations').expect(200)
    // Not 'admin': the stored bytes exist but cannot be read, and the app is
    // running on the environment value.
    expect(res.body.payments.razorpayKeySecret.source).toBe('unreadable')
  })
})
