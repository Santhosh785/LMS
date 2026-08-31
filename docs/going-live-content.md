# Going live — content and data (task 13)

The seeded database mixes the real catalogue with data fabricated for a demo.
Shipping the fabricated half means showing customers invented people and invented
numbers. This is the sequence that puts only the real half into production.

Run it **against the production `MONGO_URI`, with `NODE_ENV=production`**. Every
command below is non-destructive; `npm run seed:demo` is the destructive one and
refuses to run in production without an override flag it is not worth typing.

## 1. Publish the catalogue

```sh
npm --prefix server run seed
```

Idempotent upsert by slug of the 13 courses, the program, 14 workshops, 10 blog
posts, 9 community channels, practice items, badges and point rules. It reads and
writes no account, enrolment, payment or certificate document — not even to
count.

Three things it deliberately does **not** own on a course that already exists:

- `status` — publishing state belongs to whoever decided the course was
  deliverable. Republishing content must not put an unwatchable course back in
  the catalogue.
- `rating`, `enrolledCount`, `enrolledLabel` — see step 3.
- `bunnyVideoId` / `videoUrl` on a lesson — attached by hand in the admin editor
  and absent from the seed data, so they are carried forward from the stored
  document. Lesson `_id`s are carried forward too, or every republish would reset
  everybody's progress.

## 2. Create the operator account

```sh
ADMIN_EMAIL=team@growthscholar.in \
SEED_PASSWORD="$(openssl rand -base64 24)" \
npm --prefix server run seed:admin
```

Creates exactly one admin, or resets its password if it already exists. Creates
no demo accounts.

`ADMIN_EMAIL` **must be a mailbox someone actually reads** — password reset and
every operational notification go there, and an alias nobody monitors means a
locked-out admin stays locked out.

Sign in once, then use *Forgot password* to set a password of your own so the
value in `.env` stops being a live credential.

## 3. Zero the invented numbers, draft what cannot be delivered

```sh
npm --prefix server run seed:prepare        # add --dry-run to preview
```

Two changes, both about not lying to buyers:

**Invented statistics.** The seeded `rating` and `enrolledCount` values came out
of the old static site's markup. On a live site they are claims about the
business made to prospective buyers. Ratings go to `0` and enrolment counts are
recomputed from actual `Enrollment` documents. The UI hides both when they are
zero — no stars at all is honest; "★ 0" would be a worse lie than the invented
number was. The home page's "4.8★ Average learner rating" card was removed for
the same reason.

**Deliverability.** Any `Published` course whose lessons have no `bunnyVideoId`
is moved to `Draft`. A catalogue where some courses cannot be watched after
payment is worse than a smaller catalogue: the first is a refund and a bad
review, the second is just fewer things to buy. Draft and Hidden courses are now
absent from the public catalogue, 404 on their detail page, and cannot be bought
— before this, `status` was decorative.

`prepare` never promotes a course to `Published`. That stays a human decision.

## 4. Attach video and publish, course by course

Admin → Courses → *(course)* → Curriculum → *(lesson)* → **Bunny Video ID**.

Paste the video's GUID from the Bunny dashboard — not the embed URL. See
[bunny-stream.md](./bunny-stream.md), including the Token Authentication toggle
that has to be on for any of the signing to be enforcement.

Once every lesson on a course has a video, set its status to **Published** in the
Information tab. Re-run `seed:audit` and it will stop flagging that course.

## 5. Confirm prices

`seed:audit` prints the amount and pricing plans for every published course.
Check each one is what you actually intend to charge: the checkout shows this
number to buyers, and the plan's access tier (`Lifetime`, `12 months`,
`6 months`) is what task 12 derives the enrolment expiry from. A wrong tier here
means somebody keeps access they paid twelve months for, forever.

## 6. Audit

```sh
npm --prefix server run seed:audit
```

Read-only. **Exits non-zero when it finds a problem**, so it can gate a deploy
rather than being read by eye. It reports:

- Transaction, Customer, Enrollment, Certificate, Lead, FunnelLead,
  LeaderboardEntry and WorkshopRegistration counts
- Any of the six fabricated demo accounts (Priya Sharma, Sowndarya,
  Thiyagarajan, Anishmon A, Gokul, Priya M) plus the demo second admin
- Courses still advertising a rating or an enrolment count above the real one
- Courses `Published` without video attached
- Prices and pricing plans on every published course

A clean run reads:

```
[seed] audit clean ✔ — catalogue content only, no fabricated data
```

## If demo data did reach production

`seed:audit` names the offending accounts. Delete them and their dependent rows
by hand — there is deliberately no scripted "wipe production" path, because a
script that deletes customer data is exactly what task 3 removed.
