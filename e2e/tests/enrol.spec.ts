import { blockWrites, expectHydrated } from '../fixtures/browser'
import { test, expect } from '../fixtures/content'

/**
 * Open a course, click Enrol, land on checkout. Stops there.
 *
 * Never pays and never submits: the page is physically unable to write (every
 * non-GET request to the app is aborted), and the spec fails if one is even
 * attempted. A FREE course would not go to checkout — its button enrols the
 * visitor, which is a write — so the spec refuses to click one.
 */
test('Enrol on a paid course leads to checkout with a price and a pay control', async ({
  page,
  baseURL,
  discovered,
}) => {
  const { course } = discovered
  expect(
    course.price,
    `"${course.slug}" is a ${course.price || 'unpriced'} course: only a paid course routes Enrol to ` +
      'checkout (a free one enrols the visitor, which is a write). Unset E2E_COURSE_SLUG or pick a paid course.',
  ).toBe('paid')

  const attemptedWrites = await blockWrites(page, new URL(baseURL!).origin)

  await page.goto(`/courses/${course.slug}`)

  // #enroll is the buy box; the page repeats the button in a sticky bar and a
  // mobile strip, so scoping to it keeps the locator unambiguous.
  const enrol = page.locator('#enroll').getByRole('button', { name: /enrol/i })
  await expect(enrol).toBeVisible()
  await expectHydrated(enrol)
  await enrol.click()

  await expect(page).toHaveURL(new RegExp(`/checkout/${course.slug}/?(\\?.*)?$`))
  await expect(page.getByRole('heading', { name: 'Complete your payment' })).toBeVisible()

  // The price, in rupees, in the order summary.
  await expect(page.getByText(/₹\s?[\d,]+/).first()).toBeVisible()

  // A UPI or Razorpay control: the gateway's "Pay now" panel, its pay button, or
  // the manual UPI panel / switch. Whichever the deployment is configured for.
  const payControl = page
    .getByRole('heading', { name: /^(Pay now|Pay by UPI)$/ })
    .or(page.getByRole('button', { name: /pay by (card|upi)|upi (app|transfer)/i }))
    .first()
  await expect(payControl).toBeVisible()

  // Nothing was clicked past this point, and nothing tried to write.
  expect(attemptedWrites, 'writes attempted during a read-only run').toEqual([])
})
