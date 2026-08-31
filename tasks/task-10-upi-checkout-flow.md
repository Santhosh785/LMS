---
task: 10
name: upi-checkout-flow
parallel_group: 3
depends_on: [6, 7]
type: backend
---

# Task 10: Manual UPI checkout

## What to build

Razorpay cannot be live on Day 1 — activation requires KYC review plus published policy pages and takes 2–7 business days. This task is the interim sales channel: a real, recorded checkout that takes money by UPI today and is replaced by the gateway in task 16 without losing any data.

Task 6 made `POST /api/enrollments` return 402 for paid courses. This is where those buyers land.

**The checkout page.** A public route at `/checkout/:slug` showing the course, its price, a UPI QR code and the payee VPA, and a form collecting name, email, phone and the UTR / payment reference from the buyer's UPI app. Available to logged-out visitors — requiring an account before payment loses sales, and task 12 creates the account on approval.

UPI details come from `UPI_VPA` and `UPI_PAYEE_NAME`, added to config by task 1. Generate the QR from a standard UPI intent URI including payee, name and amount so the buyer's app pre-fills the transfer.

Copy must be explicit that access is granted after manual verification, and state the expected window. Setting the expectation here is what prevents refund requests twenty minutes later.

**The submission endpoint.** Creates:

- A `Transaction` with `status: 'PENDING'` — the enum in `server/src/models/Transaction.js` already supports this, no schema change needed. Record amount, currency INR, product, the UTR reference, and the buyer's contact details.
- A `Customer` record, or a match against the existing one by email.

Then send the `payment-received` template from task 7.

**It must grant no access.** Access is granted only by the admin approval in task 12. A pending transaction is a claim of payment, not proof of it — anyone can type a fake UTR.

**Validate the input.** Use the existing `express-validator` + `validate` middleware pattern already applied in `server/src/routes/lead.routes.js`. Email format, phone, and a plausible UTR are all required. The UTR must be unique against existing pending or successful transactions so the same reference cannot be submitted twice.

Rate-limit the endpoint — it writes to the database from an unauthenticated origin.

**Wire the client.** `client/src/pages/public/CourseDetail.jsx` currently calls `enroll.mutate()` from its "Enroll Now — ₹2,499" button. Point it at `/checkout/:slug` instead.

**Disable the admin refund button.** `client/src/pages/admin/Transactions.jsx` has a Refund action that only writes `refundedAmount` to Mongo and moves no money (`server/src/routes/admin/transaction.routes.js`). With real payments arriving this becomes a way to mark a customer refunded while keeping their cash — a chargeback waiting to happen. Disable it visibly until task 16 wires the real refund API.

## Acceptance criteria

- [ ] `/checkout/:slug` renders course, price, UPI QR and VPA, and works logged out
- [ ] The QR opens a UPI app with payee and amount pre-filled
- [ ] Submitting the form creates a PENDING `Transaction` and a `Customer`, and sends `payment-received`
- [ ] Submitting grants **no** enrollment and no course access
- [ ] Invalid email, missing phone or missing UTR are rejected with field-level errors
- [ ] Re-submitting an already-used UTR is rejected
- [ ] The endpoint is rate-limited
- [ ] The CourseDetail purchase button routes to checkout, never to `POST /api/enrollments`
- [ ] The admin Refund action is disabled and explains why
- [ ] The whole flow is usable on a 360px phone screen
