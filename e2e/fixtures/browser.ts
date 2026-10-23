import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Browser helpers shared by the enrol, auth-shell and hydration specs.
 */

/**
 * Waits until React has hydrated the element: hydration stores the element's
 * props under a `__reactProps$…` key, so a button that only has its server HTML
 * has no handler yet and clicking it does nothing. Polling this instead of
 * sleeping is what keeps the click-through specs from racing the bundle.
 */
export async function expectHydrated(locator: Locator) {
  await expect
    .poll(
      () => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps$'))),
      { message: 'element never hydrated (no React props attached)' },
    )
    .toBe(true)
}

/** Everything that must never leave the browser during a read-only run. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Makes a page physically unable to write to the app: any request that is not a
 * GET/HEAD/OPTIONS to the app's own origin is aborted and recorded. The specs
 * assert the record is empty, so an accidental write fails the run loudly even
 * though the abort already stopped it reaching the server.
 */
export async function blockWrites(page: Page, origin: string) {
  const attempted: string[] = []
  await page.route(
    (url) => url.origin === origin,
    (route) => {
      const req = route.request()
      if (SAFE_METHODS.has(req.method())) return route.continue()
      attempted.push(`${req.method()} ${req.url()}`)
      return route.abort('blockedbyclient')
    },
  )
  return attempted
}

/**
 * A hydration or markup-mismatch message from React.
 *
 * Development builds say "Hydration failed…" / "did not match". The production
 * build the suite runs against is minified and prints "Minified React error
 * #418" with only a link — and that is the build whose hydration errors matter —
 * so the codes React documents for hydration failures are matched too:
 * 418 (text/markup mismatch), 419 (server could not finish), 422/423/425
 * (client-render fallback and text mismatch).
 */
export const HYDRATION_ERROR =
  /hydrat|did not match|mismatch|expected server html|minified react error #(418|419|422|423|425)\b|(react\.dev\/errors\/|invariant=)(418|419|422|423|425)\b/i

/** Collects console errors and uncaught page errors, from before navigation. */
export function collectBrowserErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`))
  return errors
}

/** Lets the page finish hydrating and fetching before errors are read. */
export async function settle(page: Page) {
  await expectHydrated(page.locator('body'))
  await page.waitForLoadState('networkidle')
  // Hydration errors are reported from React's own task queue; one idle turn
  // after the network is quiet is enough for them to have fired.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 250))),
  )
}
