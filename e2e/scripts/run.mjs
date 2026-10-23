/**
 * Entry point for both suite modes (root scripts `e2e` and `e2e:prod`).
 *
 *   node scripts/run.mjs local   build + start the app on :3000 against the TEST
 *                                Supabase project, after the content seed
 *   node scripts/run.mjs prod    run the same specs against BASE_URL; starts
 *                                nothing and writes nothing
 *
 * Why a launcher rather than a bare `playwright test`: local mode must refuse to
 * run against anything but the declared test project BEFORE it seeds or starts a
 * server, and prod mode must refuse to guess a URL. Both are checks Playwright's
 * config cannot make early enough.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const E2E_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const ROOT = path.resolve(E2E_DIR, '..')
const mode = process.argv[2]
const passthrough = process.argv.slice(3)

const fail = (message) => {
  console.error(`[e2e] ${message}`)
  process.exit(1)
}

if (mode !== 'local' && mode !== 'prod') fail('usage: run.mjs <local|prod> [playwright args…]')

const env = { ...process.env }

if (mode === 'prod') {
  const base = (env.BASE_URL || '').trim()
  if (!base) {
    fail(
      'BASE_URL is required, e.g. BASE_URL=https://growthscholar.in npm run e2e:prod. ' +
        'No local server is started in this mode.',
    )
  }
  try {
    const url = new URL(base)
    if (!/^https?:$/.test(url.protocol)) throw new Error('not http(s)')
  } catch {
    fail(`BASE_URL is not a valid http(s) URL: ${base}`)
  }
  env.E2E_MODE = 'remote'
} else {
  // Local mode always targets the server it starts itself. A BASE_URL left over
  // in the shell must not redirect a run that also seeds a database.
  delete env.BASE_URL
  env.E2E_MODE = 'local'

  /*
   * The same guard server/tests/setup.js applies. The seed below upserts content
   * and PUBLISHES draft courses, and the app it starts reads that database, so
   * both must be the project explicitly declared as the test project. Real
   * environment variables win over server/.env, exactly as dotenv would have it.
   */
  const dotenvFile = path.join(ROOT, 'server', '.env')
  const fromFile = fs.existsSync(dotenvFile) ? dotenv.parse(fs.readFileSync(dotenvFile)) : {}
  const setting = (name) => env[name] ?? fromFile[name]
  const ref = setting('SUPABASE_PROJECT_REF')
  const testRef = setting('TEST_SUPABASE_PROJECT_REF')
  if (!ref || !testRef || ref !== testRef) {
    fail(
      `Refusing to run: SUPABASE_PROJECT_REF (${ref || 'unset'}) must equal ` +
        `TEST_SUPABASE_PROJECT_REF (${testRef || 'unset'}). Local mode seeds and serves the ` +
        'database it is pointed at — use the dedicated test project only. To check production ' +
        'run `BASE_URL=<url> npm run e2e:prod` instead.',
    )
  }
  if (!String(setting('DATABASE_URL') || '').includes(testRef)) {
    fail('Refusing to run: DATABASE_URL does not point at the test project.')
  }

  if (env.E2E_SKIP_SEED !== '1') {
    console.log('[e2e] seeding the test project (content seed + publish, idempotent)…')
    const seed = spawnSync('npm', ['--prefix', 'server', 'run', 'seed:sample'], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    })
    if (seed.status !== 0) fail('seed failed — not running the suite against unseeded content.')
  }
}

const child = spawn('npx', ['playwright', 'test', ...passthrough], {
  cwd: E2E_DIR,
  env,
  stdio: 'inherit',
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
