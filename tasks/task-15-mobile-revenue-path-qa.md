---
task: 15
name: mobile-revenue-path-qa
parallel_group: 5
depends_on: [11, 12]
type: ui
---

# Task 15: Mobile QA on the revenue path

## What to build

The design was ported from a desktop static site and its breakpoints reflect that. Across the client there are roughly 118 desktop-down breakpoint usages, but only about 34 below 768px — and 28 of those are a single breakpoint. `mx-960`, a tablet/laptop width, accounts for 45 on its own. Phone widths are barely addressed.

Indian direct-to-consumer education traffic is typically 75–85% mobile, which means most buyers experience the purchase flow at a width the layout hardly considers. This is a conversion problem, not a polish problem.

**Scope is the revenue path only**, tested on a real device at 360px and 390px:

1. Home
2. Courses catalogue, including the filter sidebar
3. Course detail — especially the sticky purchase card carrying the price and buy button
4. Checkout (task 10) — the UPI QR must be large enough to scan from another device, and the UTR form must be usable with a phone keyboard
5. Login and signup
6. Course player (task 11) — video must be watchable and lesson navigation reachable

**Explicitly out of scope:** student dashboard, my-courses, live, certificates, achievements, profile, community, and the entire admin console. The admin console is used by one person on a laptop.

Highest-risk areas, based on the layout as written: the course detail sticky purchase card, the catalogue filter sidebar, and the new checkout page. The player uses an `aspect-video` container that should collapse cleanly, but confirm it.

Fix by adding the missing narrow-width breakpoints in the established Tailwind convention already used in this codebase — the custom `mx-*` max-width scale in the Tailwind config. Do not restructure to mobile-first; a partial conversion would be worse than a consistent desktop-first codebase.

Test in a real mobile browser, not just a desktop devtools emulator. Touch target sizes, sticky-element behaviour, keyboard overlay and QR scanning are all things emulators get wrong.

## Acceptance criteria

- [ ] Home, catalogue, course detail, checkout, login, signup and player all render without horizontal scroll at 360px and 390px
- [ ] The course detail purchase card and its price and button are reachable and tappable at 360px
- [ ] The catalogue filter sidebar is usable on a phone
- [ ] The UPI QR is scannable from a second device at phone width
- [ ] The UTR form is completable with a phone keyboard, with no field obscured by the keyboard overlay
- [ ] Video plays and lessons can be switched at phone width
- [ ] A complete purchase — browse to paid access — was performed on a real phone
- [ ] No desktop layout regressed at 1280px or wider
