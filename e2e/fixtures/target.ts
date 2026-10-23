/**
 * Where the suite points. Shared by playwright.config.ts and the worker-scoped
 * slug discovery, which runs outside any test and so cannot read `baseURL`
 * from the test options.
 *
 * `E2E_MODE` is set by scripts/run.mjs: `local` (the server Playwright starts)
 * or `remote` (BASE_URL, nothing started).
 */
export const LOCAL_PORT = 3000
export const LOCAL_URL = `http://localhost:${LOCAL_PORT}`
export const isLocal = process.env.E2E_MODE === 'local'

export function targetUrl(): string {
  if (isLocal) return LOCAL_URL
  const base = process.env.BASE_URL?.trim()
  if (!base) {
    throw new Error(
      'No target. Use `npm run e2e` (local, test project) or `BASE_URL=<url> npm run e2e:prod`.',
    )
  }
  return base
}
