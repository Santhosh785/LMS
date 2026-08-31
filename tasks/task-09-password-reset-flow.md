---
task: 9
name: password-reset-flow
parallel_group: 3
depends_on: [7]
type: backend
---

# Task 9: Password reset and set-password flow

## What to build

There is no way to recover an account. `server/src/routes/auth.routes.js` exposes register, login, logout, get-me and patch-me — and nothing else. Every forgotten password becomes a manual database edit by the operator, and every buyer whose account is created for them by the admin approval flow (task 12) has no way to sign in at all.

**Token model.** A reset token stored on the `User` document (or an adjacent collection), with:

- The token stored **hashed**, never in plaintext — a leaked database dump must not yield working reset links
- A short expiry, around one hour
- Single use — consumed on successful reset
- Invalidated when the password changes by any route

**Endpoints.**

- Request a reset by email. This must respond **identically whether or not the account exists** — a differing response is an account enumeration oracle. Send the email only when the account is real.
- Submit a new password with a token. Validate the token, enforce the same 8-character minimum the register route already uses via express-validator, hash with the existing `User.hashPassword` helper, consume the token, and invalidate any active session.

**Set-password variant.** Task 12 creates accounts for buyers who paid by UPI without registering. Those users need to set an initial password, which is the same mechanism with different copy — reuse the token machinery rather than building a parallel path. The `set-password` email template from task 7 carries this link.

**Rate limiting.** The reset-request endpoint is a spam vector — someone can mail-bomb a known address. Apply a limit per IP and per target email, consistent with the `express-rate-limit` setup task 2 adds to the auth routes.

**Client pages.** A forgot-password page and a reset-password page, following the existing form conventions in `client/src/pages/public/Login.jsx` — uncontrolled inputs read via FormData, server-supplied field errors rendered through the shared `TextField` component. Link to forgot-password from the login page.

Email delivery uses the mail wrapper from task 7. Note its no-op behaviour when unconfigured: in that state the reset flow must still work end-to-end for a developer reading the token from logs, rather than appearing broken.

## Acceptance criteria

- [ ] Requesting a reset for a non-existent email returns the same status, body and timing as for a real one
- [ ] Reset tokens are stored hashed — a database dump yields nothing usable
- [ ] A token expires after roughly one hour and cannot be reused after a successful reset
- [ ] Changing a password by any route invalidates outstanding tokens
- [ ] New passwords are rejected below 8 characters, matching the register route
- [ ] Repeated reset requests for one address are rate-limited
- [ ] The set-password variant lets an admin-created account sign in for the first time
- [ ] Forgot-password and reset-password pages work on a 360px phone screen
- [ ] Full round trip verified against a real inbox
