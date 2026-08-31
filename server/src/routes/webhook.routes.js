import { Router } from 'express'
import express from 'express'
import crypto from 'node:crypto'
import { asyncHandler } from '../middleware/error.js'
import { captureMessage } from '../config/observability.js'
import { isWebhookConfigured, verifyWebhookSignature } from '../services/razorpay.js'
import { fulfilGatewayPayment } from '../services/fulfilment.js'
import { Course } from '../models/index.js'
import { getVideo, isBunnyManagementConfigured, mapBunnyStatus } from '../services/bunnyApi.js'
import { cfg } from '../services/runtimeConfig.js'

const router = Router()

/**
 * Razorpay webhook — **the source of truth for whether a payment happened.**
 *
 * Access is granted here and nowhere else on the gateway path. A buyer who
 * closes the tab mid-redirect has still paid, and must still get their course;
 * the browser callback in checkout.routes.js only decides what they are shown.
 *
 * Three things this handler gets right, each of which is a real failure if
 * dropped:
 *
 *  1. **Raw body.** `express.raw` is mounted here, and this route is registered
 *     ahead of the global `express.json()` in index.js. Razorpay signs the exact
 *     bytes it sent; re-serialising a parsed object changes key order and
 *     whitespace, and every signature then fails.
 *
 *  2. **Verify before trusting anything.** An unverified webhook endpoint is an
 *     open door: anyone who learns the URL can POST themselves a free course.
 *     The check runs before the body is even parsed.
 *
 *  3. **2xx or Razorpay retries.** Delivery is at-least-once and duplicates are
 *     routine, so the handler is idempotent (see `fulfilGatewayPayment`) and
 *     answers 200 for anything it has consciously handled — including events it
 *     ignores. Returning 500 for an event we simply do not care about produces
 *     an endless retry loop.
 */
router.post(
  '/razorpay',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    if (!isWebhookConfigured()) {
      // Alerted, not merely logged: payments can be live while this secret is
      // missing, which means money arriving and nobody ever being given
      // anything — the worst failure this system has.
      captureMessage('Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not set', {
        severity: 'critical',
      })
      return res.status(503).json({ error: 'Webhook is not configured' })
    }

    const signature = req.get('x-razorpay-signature')
    if (!verifyWebhookSignature(req.body, signature)) {
      captureMessage('Razorpay webhook signature verification failed', {
        hasSignature: Boolean(signature),
      })
      return res.status(400).json({ error: 'Invalid signature' })
    }

    let event
    try {
      event = JSON.parse(req.body.toString('utf8'))
    } catch {
      return res.status(400).json({ error: 'Malformed payload' })
    }

    const payment = event?.payload?.payment?.entity

    switch (event.event) {
      case 'payment.captured': {
        if (!payment?.order_id) {
          console.error('[razorpay] payment.captured with no order_id — ignoring')
          break
        }
        const result = await fulfilGatewayPayment({
          orderId: payment.order_id,
          paymentId: payment.id,
          amountPaise: payment.amount,
        })
        if (!result.ok) {
          // A payment for an order we do not recognise. 200 anyway — retrying
          // will not make the order appear — but this is somebody who has paid
          // and has nothing, so it alerts rather than only logging.
          captureMessage('Razorpay payment could not be fulfilled', {
            code: result.code,
            paymentId: payment.id,
            orderId: payment.order_id,
          })
        } else if (result.alreadyProcessed) {
          console.log(`[razorpay] ${payment.id} already fulfilled — no action`)
        } else {
          console.log(`[razorpay] fulfilled ${payment.id} for order ${payment.order_id}`)
        }
        break
      }

      case 'payment.failed':
        console.log(
          `[razorpay] payment failed for order ${payment?.order_id}: ${payment?.error_description || 'no reason given'}`,
        )
        // The PENDING transaction is deliberately left alone. Buyers retry, and
        // the retry reuses the same order — marking it FAILED here would leave
        // the successful second attempt with nothing to claim.
        break

      case 'refund.processed':
        // Refunds are initiated from the admin console, which already records
        // them (see refundTransaction). Logged so a refund issued directly in
        // the Razorpay dashboard is at least visible.
        console.log(`[razorpay] refund processed: ${event?.payload?.refund?.entity?.id}`)
        break

      default:
        // Subscribed to more events than we handle. Acknowledge and move on.
        break
    }

    res.json({ ok: true })
  }),
)

/**
 * Bunny Stream encoding webhook (task 22) — an accelerant, not a dependency.
 * The admin UI reaches `ready` by polling the status endpoint regardless; this
 * just makes the flip immediate. Configure in the Bunny dashboard: Stream →
 * the library → API → Webhook URL:
 *
 *   https://<site>/api/webhooks/bunny?token=<BUNNY_WEBHOOK_TOKEN>
 *
 * Bunny signs nothing, so the token in the URL is the whole authentication —
 * compared in constant time, and the endpoint is disabled outright when no
 * token is configured. Worst case for a leaked token is a forged *status
 * poke*: the status itself is re-read from Bunny's API, so a forger cannot
 * mark a broken video playable — only cause a harmless re-check.
 *
 * Same 2xx contract as Razorpay above: anything consciously handled answers
 * 200, including videos we no longer track — retrying will not make a deleted
 * lesson reappear.
 */
router.post(
  '/bunny',
  express.json({ limit: '100kb' }),
  asyncHandler(async (req, res) => {
    if (!cfg.bunnyWebhookToken) {
      return res.status(503).json({ error: 'Webhook is not configured' })
    }
    const supplied = String(req.query.token || '')
    const expected = cfg.bunnyWebhookToken
    const match =
      supplied.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    if (!match) return res.status(401).json({ error: 'Invalid token' })

    const { VideoLibraryId, VideoGuid, Status } = req.body || {}
    if (!VideoGuid) return res.status(400).json({ error: 'Malformed payload' })
    if (String(VideoLibraryId) !== String(cfg.bunnyLibraryId)) {
      // A different library's events are misconfiguration, not an attack.
      console.warn(`[bunny] webhook for foreign library ${VideoLibraryId} — ignoring`)
      return res.json({ ok: true })
    }

    const course = await Course.findOne({ 'sections.lessons.bunnyVideoId': VideoGuid })
    if (!course) return res.json({ ok: true }) // video no longer attached to anything

    let target
    for (const section of course.sections) {
      for (const l of section.lessons) {
        if (l.bunnyVideoId === VideoGuid) target = l
      }
    }
    if (!target) return res.json({ ok: true })

    /**
     * The webhook's Status enum differs from the video object's — so when the
     * management API is configured (it always is when uploads run in-app) the
     * authoritative status and duration are re-read rather than trusted from
     * the poke. The fallback mapping (3 finished / 5 failed) only runs when
     * someone wired the webhook without an API key.
     */
    let next
    let lengthSeconds = null
    if (isBunnyManagementConfigured()) {
      try {
        const video = await getVideo(VideoGuid)
        next = mapBunnyStatus(video.status)
        lengthSeconds = video.length || 0
      } catch (err) {
        console.warn(`[bunny] webhook re-read failed for ${VideoGuid}: ${err.message}`)
        return res.json({ ok: true }) // polling will catch it
      }
    } else {
      const n = Number(Status)
      next = n === 3 ? 'ready' : n === 5 ? 'failed' : 'processing'
    }

    if (next !== target.videoStatus) {
      target.videoStatus = next
      if (next === 'ready') {
        if (lengthSeconds != null) target.videoDurationSeconds = lengthSeconds
        if ((!target.duration || target.duration === '00:00') && lengthSeconds) {
          const h = Math.floor(lengthSeconds / 3600)
          const m = Math.floor((lengthSeconds % 3600) / 60)
          const s = String(Math.round(lengthSeconds % 60)).padStart(2, '0')
          target.duration = h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
        }
      }
      if (next === 'failed') {
        // An admin uploaded a lecture and walked away believing it worked;
        // this is the only signal anyone gets before a student hits play.
        captureMessage('Bunny video encoding failed', {
          videoId: VideoGuid,
          courseId: String(course._id),
          lesson: target.name,
        })
      }
      await course.save()
      console.log(`[bunny] ${VideoGuid} → ${next} (${course.slug} / ${target.name})`)
    }

    res.json({ ok: true })
  }),
)

export default router
