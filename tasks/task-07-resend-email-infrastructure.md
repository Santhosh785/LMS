---
task: 7
name: resend-email-infrastructure
parallel_group: 2
depends_on: [1]
type: backend
---

# Task 7: Transactional email infrastructure (Resend)

## What to build

The application cannot send email. There is no mail transport anywhere in the codebase — the only reference is a comment in `server/src/routes/admin/email.routes.js` noting that broadcast sending records a send and mails nothing. A paid product needs, at minimum: payment received, access granted, set your password, and workshop confirmation.

Build a small mail layer on **Resend**, chosen for integration speed over Zoho ZeptoMail and AWS SES.

**The wrapper.** A single module exposing something like `send(template, to, data)`. Two behaviours matter:

- When `RESEND_API_KEY` is unset it must **no-op with a warning log and resolve successfully**, never throw. Local development and the seeder must not break because email is unconfigured.
- A failed send must never fail the request that triggered it. Granting course access must succeed even if the confirmation email bounces — log the failure and carry on. Payment and access are the transaction; email is a notification.

**Templates.** Four to start:

| Template | Sent when |
|---|---|
| `payment-received` | Buyer submits a UPI payment reference (task 10). Confirms receipt, states the manual verification window honestly. |
| `access-granted` | Admin approves the payment (task 12). Contains the course and a direct link to it. |
| `set-password` | A user account was created for a buyer who had none. Carries the single-use reset token from task 9. |
| `workshop-confirmation` | Workshop registration succeeds. |

Templates must carry the Growth Scholar brand, work in plain text as well as HTML, and include the sender's business identity — required for deliverability and expected by Indian consumers.

Configuration comes from `RESEND_API_KEY` and `MAIL_FROM`, added to `server/src/config/env.js` and `.env.example` by task 1. The sending domain needs SPF and DKIM records; document what must be added to DNS so task 14 can apply them, and note that until DNS verifies, Resend will only deliver to the account owner's own address.

This task builds the transport and templates. Task 9 wires password reset, task 10 wires checkout, task 12 wires access granting — do not implement those flows here.

## Acceptance criteria

- [ ] A single mail module is the only place the Resend SDK is imported
- [ ] With `RESEND_API_KEY` unset, calling send logs a warning, resolves, and throws nothing
- [ ] A simulated Resend failure does not propagate into the calling request
- [ ] All four templates render with realistic sample data in both HTML and plain text
- [ ] Templates are legible in a mobile mail client
- [ ] Required SPF/DKIM DNS records are documented for task 14
- [ ] No existing route's behaviour changes as a result of this task
