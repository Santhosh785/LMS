---
task: 16
name: razorpay-integration
parallel_group: 6
depends_on: [12, 14]
type: backend
---

# Task 16: Razorpay integration

## What to build

Replace the manual UPI flow (tasks 10 and 12) with a real payment gateway. Razorpay was chosen for Indian D2C: UPI, cards, netbanking and wallets, INR-native, straightforward KYC for an Indian entity, and reliable webhooks.

**Start KYC immediately** once the policy pages from task 4 are live — activation takes 2–7 business days and gates everything below. Development can proceed against test keys in parallel.

**The webhook is the source of truth.** Access is granted by the verified server-to-server webhook, never by the browser callback. A buyer who closes the tab mid-redirect has still paid, and must still receive access. The client callback exists only for redirect UX.

The webhook handler must:

- **Verify the signature** on every request before trusting anything in the body. An unverified webhook endpoint is an open door to granting free access.
- **Be idempotent on `razorpay_payment_id`.** Razorpay retries on non-2xx, and duplicate delivery is normal. A second delivery of the same payment must not create a second enrollment or send a second email.
- Reuse `grantAccess(userId, courseId, { expiresAt, source })` from task 6 with `source: 'paid'`, deriving `expiresAt` from the purchased plan's access tier — identical to what task 12 does for manual approvals.
- Reuse the `access-granted` and `set-password` email templates from task 7, and the account-creation path from task 12 for buyers with no prior account.

**Order creation.** A server endpoint that creates a Razorpay order for a given course and plan, with the amount taken **from the database, never from the client**. A client-supplied amount is a free-course exploit.

**Refunds.** Tasks 10 and 12 deliberately left the admin Refund action disabled because it only wrote `refundedAmount` to Mongo and moved no money. Re-enable it now: call Razorpay's refund API first, and only update the transaction once the gateway confirms. Revoke the corresponding enrollment on a full refund. Handle partial refunds against the existing `refundedAmount` field.

**Keep the manual path.** Do not delete the UPI checkout — it remains a fallback for buyers whose card fails and for offline sales, and it is the only mechanism that worked at launch. Both paths must converge on the same `grantAccess` helper so access is granted one way regardless of origin.

**Invoicing.** The business is not GST-registered, so invoices must show no tax component. The `Transaction` model has an unused `invoiceNo` field — use it, with sequential numbering.

## Acceptance criteria

- [ ] Webhook signature verification rejects a tampered payload
- [ ] Redelivering the same `razorpay_payment_id` grants access once and emails once
- [ ] Access is granted by the webhook even when the browser never returns from the redirect
- [ ] Order amounts come from the database; a client-supplied amount is ignored
- [ ] A successful payment grants enrollment with correct `expiresAt` and `source: 'paid'`
- [ ] A buyer with no account gets one created plus a set-password email
- [ ] Refund calls Razorpay first and updates the transaction only on confirmation
- [ ] A full refund revokes access; a partial refund updates `refundedAmount` correctly
- [ ] The manual UPI path still works and grants access through the same helper
- [ ] Invoices carry sequential numbers and no tax component
- [ ] Verified end to end in Razorpay test mode before switching to live keys
