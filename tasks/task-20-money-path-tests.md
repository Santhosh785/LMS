---
task: 20
name: money-path-tests
parallel_group: 7
depends_on: [16]
type: testing
---

# Task 20: Automated tests on the money paths

## What to build

The project has no tests of any kind — no test framework, no test files, no CI, on either client or server. Broad coverage is not the goal and is not a good use of time at this stage.

Cover only the paths where a bug costs money or gives away the product. These are exactly the paths where a regression is silent: nobody notices free access until revenue is missing.

**Set up a test runner** for the server (Vitest fits the existing Vite tooling), with an isolated test database. Tests must never touch development or production data — and note that task 3's seed guard exists precisely because that boundary was previously unenforced.

**What must be covered:**

*Paywall (task 6)* — self-enrolling in a paid course returns 402; a free course still enrolls; the 402 response does not create an enrollment as a side effect.

*Expiry (task 6)* — an enrollment past `expiresAt` denies course access, with an error distinct from not-enrolled; a null `expiresAt` means lifetime access and never expires.

*Playback authorization (task 8)* — a playback URL is refused for a non-enrolled user, for an expired enrollment, and for a lesson id that does not belong to the requested course. `BUNNY_SECURITY_KEY` never appears in a response.

*Checkout (task 10)* — submitting a UPI payment creates a PENDING transaction and **grants no access**; a duplicate UTR is rejected.

*Approval (task 12)* — approval grants exactly one enrollment; approving twice does not double-enroll or double-email; `expiresAt` matches the purchased plan's access tier.

*Razorpay webhook (task 16)* — a tampered signature is rejected; redelivering the same `razorpay_payment_id` grants access once; a client-supplied amount cannot override the database price; a full refund revokes access.

**Regression guard on the credential leak.** A test asserting that no built client artifact contains `password123` or any seeded credential. This bug shipped once; make it impossible to ship twice.

Write assertions against observable behaviour — HTTP status, response body, database state — not internal implementation, so the tests survive refactoring. Do not chase coverage on the admin console, community, or presentational components.

## Acceptance criteria

- [ ] A test runner is configured and runs with a single command
- [ ] Tests use an isolated database and cannot touch development or production data
- [ ] Every path listed above has at least one test asserting the security-relevant outcome
- [ ] The suite fails if the paywall is removed — verified by temporarily reverting the check
- [ ] The suite fails if webhook signature verification is removed
- [ ] The suite fails if a seeded credential is reintroduced into the client build
- [ ] The full suite runs in under a minute so it is actually used
- [ ] Every test passes against the current codebase
