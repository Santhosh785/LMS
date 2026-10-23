import { blockWrites, expectHydrated } from '../fixtures/browser'
import { test, expect } from '../fixtures/content'
import { inputs } from '../fixtures/html'

/**
 * The sign-in page and the auth wall, without ever signing in.
 */

test('/login ships its email and password fields in the server HTML', async ({ request }) => {
  const res = await request.get('/login')
  expect(res.status()).toBe(200)
  // The raw response, not the hydrated DOM: a form that only appears after
  // hydration is invisible to a slow connection and to a crawler.
  const fields = inputs(await res.text())
  expect(
    fields.find((f) => f.type === 'email' && f.name === 'email'),
    'email input in server HTML',
  ).toBeDefined()
  expect(
    fields.find((f) => f.type === 'password' && f.name === 'password'),
    'password input in server HTML',
  ).toBeDefined()
})

test('a logged-out visit to /student ends on /login', async ({ page, baseURL }) => {
  const attemptedWrites = await blockWrites(page, new URL(baseURL!).origin)

  await page.goto('/student')
  await expect(page).toHaveURL(/\/login(\?.*)?$/)
  expect(new URL(page.url()).pathname).toBe('/login')

  // And the login form is really there, hydrated, ready to use — but unused.
  const email = page.locator('input[name="email"]')
  await expect(email).toBeVisible()
  await expectHydrated(email)

  expect(attemptedWrites, 'writes attempted during a read-only run').toEqual([])
})
