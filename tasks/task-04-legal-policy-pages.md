---
task: 4
name: legal-policy-pages
parallel_group: 1
depends_on: []
type: ui
---

# Task 4: Legal and policy pages

## What to build

The site footer advertises Privacy Policy, Terms of Use and Refund Policy as `href="#"` — dead links with no pages behind them (`client/src/components/public/SiteFooter.jsx`, around lines 53–55). The mentor popup's consent text has the same problem (`client/src/components/public/MentorPopup.jsx`, around lines 178–179).

This is not cosmetic. **Razorpay will not activate a live merchant account** without reachable Terms, Privacy, Refund/Cancellation, Contact and — for digital goods — Delivery policy pages. Publishing these is a prerequisite for even starting KYC, which is why it happens on Day 1 despite the gateway landing later (task 16).

Add five public pages under the existing `PublicLayout` route group in `client/src/App.jsx`: `/privacy`, `/terms`, `/refund`, `/contact`, and delivery terms (either its own `/delivery` route or a clearly-headed section within the refund page).

Content requirements specific to this business:

- **Digital goods, no physical shipping.** Delivery means immediate access to online course content on the platform after payment confirmation.
- **Manual payment window.** Until task 16 lands, purchases go through UPI and are confirmed by an admin, so access is not instantaneous. The refund and delivery policies must state the actual confirmation window honestly rather than promising instant access.
- **No GST.** The business has a registered entity and bank account but is not GST-registered. Pricing is all-inclusive and invoices carry no tax component. State "Prices are inclusive. GST not applicable." Do not display a tax breakdown anywhere.
- **Contact page** must carry a real business name, email and address — Razorpay's review checks for these.

Style them consistently with the existing public pages using the established Tailwind theme tokens. Then replace every `href="#"` in the footer and the mentor popup with real routes.

These are legal documents. Where the correct content depends on business specifics not available in the codebase, leave a clearly marked placeholder rather than inventing terms — an invented refund window is worse than an obvious blank.

## Acceptance criteria

- [ ] `/privacy`, `/terms`, `/refund`, `/contact` and delivery terms all render within `PublicLayout`
- [ ] No `href="#"` remains in `SiteFooter.jsx` or `MentorPopup.jsx`
- [ ] Every page is reachable by clicking from the footer of the live site
- [ ] The refund and delivery policies describe the manual UPI confirmation window, not instant access
- [ ] "GST not applicable" appears in the pricing/terms copy, and no tax breakdown is shown anywhere
- [ ] The contact page carries business name, email and address
- [ ] Any content requiring business input is marked as an obvious placeholder, not invented
- [ ] All five pages are legible on a 360px-wide phone screen
