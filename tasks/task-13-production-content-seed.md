---
task: 13
name: production-content-seed
parallel_group: 4
depends_on: [3]
type: mechanical
---

# Task 13: Load real content, remove fabricated data

## What to build

The seeded database mixes genuine catalogue content with fabricated demo data. Going live with the fabricated half means showing customers invented people and invented numbers.

**Keep as real:** the 13 courses, programs, workshops, blog posts, community channels and practice items. This is the actual product catalogue and needs copy review, not deletion.

**Must not reach production:** the six demo users (Priya Sharma, Sowndarya, Thiyagarajan, Anishmon A, Gokul, Priya M), all demo transactions, customers, leads, funnel leads, leaderboard entries, workshop registrations, enrollments and certificates.

Run only `seedContent` from task 3 against the production database. Verify afterwards that the user, transaction, customer, enrollment, certificate, lead and leaderboard collections are empty apart from the single real admin account.

**Honest numbers.** Seeded courses carry `enrolledCount` and `rating` values that were invented for a demo. On a live site these are claims about your business made to prospective buyers. Either reset them to true values (zero, or whatever real history exists) or hide those stats on the course card and detail page until real data accumulates. Do not ship invented enrollment counts and star ratings.

**Publish only what is deliverable.** A course is publishable only when its lessons have a `bunnyVideoId` attached (the field added in task 8, editable through the admin curriculum editor in task 11). Any course without attached video stays `status: 'Draft'` so it does not appear in the catalogue. A catalogue where some courses cannot be watched after payment is worse than a smaller catalogue.

Note the seeded pricing plans reference `Lifetime`, `12 months` and `6 months` access tiers. Confirm the amounts on each published course are the prices actually intended to be charged — task 10 shows these to buyers and task 12 derives access expiry from them.

**The admin account** needs a real email and a strong password from `SEED_PASSWORD` (task 2). Confirm `team@growthscholar.in` is a mailbox that is actually monitored, since password reset and operational email will go there.

## Acceptance criteria

- [ ] Production contains the catalogue content and exactly one real admin user
- [ ] User, transaction, customer, enrollment, certificate, lead, funnel-lead and leaderboard collections hold no demo data
- [ ] No course displays an invented `enrolledCount` or `rating`
- [ ] Every `Published` course has video attached to its lessons and plays after purchase
- [ ] Courses without attached video are `Draft` and absent from the public catalogue
- [ ] Prices on published courses are the amounts actually intended to be charged
- [ ] The admin account uses a real monitored mailbox and a strong password
- [ ] Re-running `seedContent` updates content without duplicating it or touching customer data
