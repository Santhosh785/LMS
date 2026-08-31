# Razorpay (task 16)

Replaces the manual UPI flow as the primary sales channel. **The manual path is
not deleted** — it remains the fallback for a buyer whose card fails and for
offline sales, and both routes converge on the same `grantAccess`, so access is
granted one way regardless of origin.

## The one rule

**The webhook is the source of truth.** A buyer who closes the tab mid-redirect
has still paid and must still receive access. The browser callback
(`POST /api/checkout/razorpay/callback`) exists only to decide what the page
shows; it grants nothing.

## Activation

KYC takes **2–7 business days** and gates going live. Start it the moment the
policy pages from task 4 are reachable at a public URL — Razorpay's review looks
for privacy, terms, refund, delivery and contact pages, and a support phone
number. Fill the `[[ TO BE CONFIRMED ]]` fields in `client/src/data/legal.js`
first; the review rejects placeholder text.

Development proceeds against **test keys** in parallel. Nothing below needs
activation except the switch to live keys at the end.

## Configuration

```
RAZORPAY_KEY_ID=rzp_test_…       # public — it ships in the client bundle by design
RAZORPAY_KEY_SECRET=…            # signs API calls; server only
RAZORPAY_WEBHOOK_SECRET=…        # verifies deliveries; server only
INVOICE_PREFIX=GS
```

`RAZORPAY_WEBHOOK_SECRET` is set independently of the API keys, in
**Dashboard → Settings → Webhooks**. It is therefore entirely possible to have
working payments and a webhook that verifies nothing — money arrives and nobody
is ever granted anything. The handler logs an error and returns 503 when it is
missing, rather than silently accepting unverified payloads.

## Webhook setup

Dashboard → Settings → Webhooks → Add New Webhook.

| Field | Value |
|---|---|
| URL | `https://growthscholar.in/api/webhooks/razorpay` |
| Secret | a long random string, also placed in `RAZORPAY_WEBHOOK_SECRET` |
| Events | `payment.captured`, `payment.failed`, `refund.processed` |

### Why the route is mounted where it is

`server/src/index.js` mounts `/api/webhooks` **before** `express.json()`, with
`express.raw` on the route itself. Razorpay signs the exact bytes it sent; once
the JSON parser has consumed and discarded the raw buffer, the only way back is
re-serialising the object, which changes key order and whitespace — and then
every real payment is rejected as a forgery. If webhook verification ever starts
failing across the board, check that ordering first.

Verification is HMAC-SHA256 over the raw body with the webhook secret, compared
in constant time. A plain `===` leaks, through timing, how many leading bytes a
forgery got right.

### Idempotency

Razorpay retries on any non-2xx and duplicate delivery is routine. The handler:

- claims the transaction with a conditional update on `status: 'PENDING'`, so of
  N deliveries exactly one proceeds to grant access and send email
- carries a unique index on `razorpayPaymentId` as a second line of defence
- returns **200 for anything it has consciously handled**, including events it
  ignores. A 500 for an event we do not care about is an endless retry loop.

`payment.failed` deliberately leaves the PENDING transaction alone: buyers retry,
and the retry reuses the same order, so marking it FAILED would leave the
successful second attempt with nothing to claim.

## Order creation

`POST /api/checkout/razorpay/order` takes a **slug and a plan name, never an
amount**. The price is read from `Course.pricingPlans` (or `Course.amount`), so
a client-supplied amount is impossible rather than merely discouraged — it would
otherwise be a free-course exploit. A PENDING transaction shadowing the order is
created at the same time, which is what the webhook later claims.

## Refunds

`POST /api/admin/transactions/:id/refund` **calls Razorpay first** and records
only what the gateway confirms. The version this replaced wrote `refundedAmount`
to Mongo and moved no money — with real payments that is a way to mark a customer
refunded while keeping their cash.

- A **full** refund sets status `REFUNDED` and revokes the enrolment it paid for.
- A **partial** refund accumulates against `refundedAmount` and leaves access.
- A **manual UPI** transaction has no `razorpayPaymentId`, so there is no API to
  call. The endpoint refuses with an explanation and the button is disabled —
  that money goes back from your bank, by hand.

## Invoicing

`Transaction.invoiceNo` is assigned on fulfilment as `GS-<year>-<0000>`, from an
atomic `$inc` on a `Counter` document. Minting it at fulfilment rather than at
checkout means abandoned and rejected payments do not burn numbers and leave
gaps somebody later has to explain.

**No tax component.** The business is not GST-registered and prices are
all-inclusive. Watch the ₹20L threshold — crossing it makes registration
compulsory and changes what an invoice must show.

## Content Security Policy

Razorpay's hosted checkout injects a script, opens its form in an iframe and
beacons telemetry, so `checkout.razorpay.com`, `api.razorpay.com`,
`lumberjack.razorpay.com` and `cdn.razorpay.com` are named across `script-src`,
`frame-src`, `connect-src` and `img-src` in `server/src/index.js`. Miss one and
the modal opens blank — which reads to a buyer as a broken checkout, not a policy
error.

The checkout script is loaded **on demand** by `RazorpayButton.jsx`, not from
`index.html`: a third-party payment script on every page view is a tracking
surface and a render-blocking request for everyone who is not buying right now.

## Verifying in test mode

1. Test cards: `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234`.
2. Complete a payment → confirm one enrolment, one `access-granted` email, and a
   `set-password` email if the account was new.
3. **Close the tab at the redirect.** Access must still be granted — this is the
   whole reason the webhook is authoritative.
4. Replay a captured webhook body with `curl`: same signature → 200, one
   enrolment, no second email. Change one byte of the body → 400.
5. Refund in full from the admin console → Razorpay dashboard shows the refund,
   the transaction reads REFUNDED, and the student loses access.
6. Only then swap `rzp_test_*` for `rzp_live_*` and re-point the webhook.

Automated coverage of all of the above is task 20.
