---
task: 12
name: admin-approve-and-grant-access
parallel_group: 4
depends_on: [10]
type: backend
---

# Task 12: Admin payment approval and access granting

## What to build

Task 10 records UPI payments as PENDING transactions. This task is where an operator verifies the money actually arrived and turns it into course access. It is the only path that grants paid access until Razorpay lands in task 16.

**The approval action.** In `client/src/pages/admin/Transactions.jsx`, add an Approve action on pending transactions. Approving must, as one coherent operation:

1. Flip the transaction to `SUCCESS`
2. Resolve the buyer to a `User` — creating the account if none exists for that email
3. Grant enrollment via the `grantAccess(userId, courseId, { expiresAt, source })` helper from task 6, with `source: 'manual'` and `expiresAt` derived from the purchased plan's access tier (`Lifetime`, `12 months`, `6 months` — from `Course.pricingPlans`)
4. Send `access-granted`, and additionally `set-password` when the account was newly created

**Account creation is the part that does not exist yet.** The current admin enroll endpoint (`server/src/routes/admin/customer.routes.js`, lines 24–50) throws `400 'This customer has no learner account yet'` when the customer has no user. For UPI buyers that is the normal case — they paid without registering. Create the account with no usable password and send a set-password link using the task 9 token machinery. Never invent a password and email it.

**Idempotency.** Approving twice must not double-enroll, double-charge the counters, or send duplicate emails. Guard on the transaction's current status and make the whole action safe to retry — the operator will double-click.

**A rejection path** is needed too: a fake or unmatched UTR must be markable as `FAILED` with a reason, so pending transactions do not accumulate forever with no way to clear them.

**Show the operator what they need.** The pending queue should surface the UTR reference, amount, buyer contact and the course, so it can be reconciled against a bank statement without leaving the page. Sorting pending-first matters — this is the screen that gets checked several times a day.

Reuse the existing `DataTable` component from `client/src/components/admin/index.jsx` and the existing `useAdminMutation` hooks in `client/src/api/admin.js` rather than introducing new patterns.

The Refund action stays disabled — task 10 disabled it, and it stays that way until task 16 wires Razorpay's refund API.

## Acceptance criteria

- [ ] A pending transaction can be approved from the admin transactions page
- [ ] Approval sets status to SUCCESS and grants a working enrollment
- [ ] A buyer with no prior account gets one created plus a set-password email, and can sign in
- [ ] A buyer with an existing account is matched by email, and no duplicate account is created
- [ ] `expiresAt` reflects the purchased plan's access tier; Lifetime yields null
- [ ] Approving the same transaction twice produces one enrollment and one set of emails
- [ ] A transaction can be rejected as FAILED with a reason
- [ ] The pending queue shows UTR, amount, contact and course, sorted pending-first
- [ ] The Refund action remains disabled
- [ ] End-to-end: checkout → pending → approve → email arrives → student signs in → course plays
