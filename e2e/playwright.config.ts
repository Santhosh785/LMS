import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { isLocal as local, LOCAL_PORT as PORT, LOCAL_URL, targetUrl } from './fixtures/target'

/**
 * Two modes, chosen by the launcher (scripts/run.mjs) through E2E_MODE:
 *
 *  - local:  Playwright builds the client and starts the production server on
 *            :3000 against the test Supabase project, then runs the specs.
 *  - remote: no server; the specs run against BASE_URL.
 *
 * Both run the same specs, and every spec is read-only (no login, no writes,
 * no payment).
 */
const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  // Specs are independent and read-only, but a remote run is somebody's real
  // site: keep it to one worker so the suite never looks like a burst.
  workers: local ? 2 : 1,
  fullyParallel: false,
  retries: local ? 0 : 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: targetUrl(),
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: local
    ? {
        // Production build + production server: what a deploy actually runs.
        command: 'npm run build && node server/src/index.js',
        cwd: ROOT,
        url: `${LOCAL_URL}/api/health`,
        // Never adopt a server that happens to be on :3000: it could be pointed
        // at any database.
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          NODE_ENV: 'production',
          PORT: String(PORT),
          CLIENT_ORIGIN: LOCAL_URL,
          // Production refuses the built-in dev secret. Nothing here signs a
          // session (the suite never logs in), so any non-default value will do.
          JWT_SECRET: process.env.JWT_SECRET || 'e2e-smoke-only-not-a-real-secret',
          // Defence in depth for a read-only suite: nothing the app starts may
          // send mail, purge a CDN, report to Sentry or run a background job.
          BOSS_ENABLED: '0',
          RATE_LIMIT_STORE: 'memory',
          // Checkout answers 503 until a payment route is configured. A UPI id
          // is only displayed (the suite never pays), so a placeholder suffices
          // when the environment has none; a real one is left alone.
          UPI_VPA: process.env.UPI_VPA || 'e2e-smoke@okbank',
          UPI_PAYEE_NAME: process.env.UPI_PAYEE_NAME || 'Growth Scholar E2E',
          RESEND_API_KEY: '',
          MAIL_FROM: '',
          SENTRY_DSN: '',
          CF_ZONE_ID: '',
          CF_API_TOKEN: '',
        },
      }
    : undefined,
})
