/**
 * Boot-time guard for running more than one instance.
 *
 * Most per-process state is now safe to replicate (config caches invalidate
 * across instances over LISTEN/NOTIFY). Media is not: without Bunny Storage the
 * Media Library writes uploads to the instance's own disk, so an image uploaded
 * through one replica 404s on every other. Refusing to start is far kinder than
 * a site whose images appear and disappear depending on which instance answers.
 *
 * Kept free of imports so it can be unit-tested and read by config/env.js.
 */

/** `REPLICAS` as a positive integer; anything missing or invalid means 1. */
export function parseReplicas(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) return 1
  const n = Number(text)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
}

/** Throws a descriptive error when the deployment shape cannot work. */
export function assertReplicaSafe({ replicas, storageConfigured }) {
  if (replicas > 1 && !storageConfigured) {
    throw new Error(
      `REPLICAS=${replicas} but Bunny Storage is not configured. Without it, Media Library ` +
        'uploads fall back to the local disk (server/uploads/media), which is not shared ' +
        'between replicas, so an uploaded image would exist on only one instance. Configure ' +
        'Bunny Storage (BUNNY_STORAGE_* or /admin/integrations) or set REPLICAS=1.',
    )
  }
}
