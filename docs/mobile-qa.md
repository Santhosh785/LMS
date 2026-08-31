# Mobile QA — the revenue path (task 15)

Indian D2C education traffic is typically 75–85% mobile, so most buyers meet the
purchase flow at a width the ported layout barely considered: roughly 118
desktop-down breakpoints existed, but only ~34 below 768px, and `mx-960` — a
tablet/laptop width — accounted for 45 on its own.

**Scope is the revenue path only.** Student dashboard, my-courses, live,
certificates, achievements, profile, community and the whole admin console are
explicitly out of scope; the admin console is used by one person on a laptop.

## What changed

### New breakpoints

`client/tailwind.config.js` gains `mx-480`, `mx-390` and `mx-360`, in the same
desktop-first max-width convention as the rest of the scale. 360px is the most
common Android width in India, 390 is an iPhone 14/15, 480 covers a small tablet
held in portrait. No mobile-first conversion — a partial one would be worse than
a consistent desktop-first codebase.

### The iOS zoom bug (the important one)

`inputClass` in `components/ui/index.jsx` was `text-[0.9rem]` — 14.4px. **iOS
Safari auto-zooms the viewport whenever a focused input is under 16px.** Every
tap into the checkout form zoomed the page, pushed the layout sideways, and left
the buyer scrolled off the field they were typing in. That single line was the
cause of most of the "horizontal scroll on a phone" symptom on this path.

Fixed with `mx-768:text-base`, so phones get 16px and desktop keeps its original
size. The catalogue's bespoke search input had the same defect and the same fix.
The viewport meta tag is left without `maximum-scale` — suppressing zoom that way
breaks pinch-to-zoom for anyone who needs it.

### Course detail — the sticky purchase card

The highest-risk element on the highest-traffic width. Two changes below 960px:

- `mx-960:order-1` / `order-2` puts the price and buy button **above** the
  description. Stacked in source order the card landed below a full page of
  copy, so the thing being sold was off-screen on arrival.
- `mx-960:static` — a `sticky` element inside a single-column stack pins itself
  over the content the buyer is trying to read.

The hero stat row also collapses 4 → 3 → 2 columns rather than 4 → 2.

### Checkout

- **The QR grows on a phone rather than shrinking**: `max-w-[220px]` becomes
  320px below 860, easing back to 260px at 360 so the card keeps its padding.
  It is an SVG, so enlarging costs no sharpness, and the white quiet zone is
  preserved. This QR is most often photographed by a *second* device, and a
  220px code scanned across a table is exactly where scanning starts failing.
- The two-column pay/confirm layout stacks at 860, with the QR first.
- The UTR field gets `inputMode="numeric"` plus `autoCapitalize`/`spellCheck`
  off, so the phone keyboard opens on digits and does not autocorrect a
  reference number.
- Card padding tightens at 560.

### Everything else on the path

- Catalogue filter rows: `min-h-[44px]` summaries, `py-2.5` labels and a larger
  checkbox below 960. A 16px checkbox is fine with a mouse and genuinely hard to
  hit with a thumb. The panel already collapsed behind a ⚙ Filters toggle.
- Catalogue search goes full width below 480 instead of floating right.
- Login / signup / forgot-password / reset-password cards: `mx-560:p-6`.
- Course player: the lesson list's `max-h-[70vh] overflow-y-auto` is removed when
  stacked — a scroll region nested inside a scrolling page traps the thumb — and
  lesson rows get a 44px tap target, since switching lessons is the one thing a
  phone viewer does constantly. The `aspect-video` frame collapses cleanly.
- Every form field is now `min-h-[44px]`.

Desktop is unaffected: every change is inside a `max-width` query, or a
`min-height` no larger than the existing 42px control height.

---

## Still outstanding — must be done on a real device

**This has not been verified on a physical phone.** Everything above was derived
from the markup and from known mobile browser behaviour, and the build compiles,
but emulators get exactly the things that matter here wrong: touch target size,
sticky behaviour during momentum scroll, the keyboard overlay, and whether a QR
actually scans.

Walk this on a real handset at 360px and 390px, in Chrome on Android **and**
Safari on iOS:

- [ ] Home, catalogue, course detail, checkout, login, signup and player render
      with **no horizontal scroll**. Drag the page sideways to check — a
      1-pixel overflow is invisible but real.
- [ ] Course detail: price and buy button are visible without scrolling.
- [ ] Catalogue: ⚙ Filters opens, checkboxes are hittable with a thumb, chips
      wrap without overflow.
- [ ] Checkout: **scan the QR with a second phone** and confirm the UPI app
      opens with payee and amount pre-filled.
- [ ] Checkout: complete the UTR form with the on-screen keyboard. No field
      hidden behind the keyboard, and **no zoom on focus** — the zoom is the
      regression to watch for if `inputClass` is ever edited.
- [ ] Player: a video plays, goes fullscreen, and lessons can be switched.
- [ ] **One complete real purchase at ₹1**, browse → pay → approve → sign in →
      play, performed on a phone start to finish.
- [ ] Re-check 1280px and wider for regressions.

Until that pass is done and the boxes are ticked, treat this task as code-complete
but unverified.
