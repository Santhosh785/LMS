/**
 * Renders every template with realistic sample data so they can be eyeballed
 * without sending anything.
 *
 *   npm --prefix server run mail:preview        # writes .mail-preview/*.html|.txt
 *
 * Open the HTML files in a browser at a 360px window, and read the .txt files —
 * the plain-text alternative is what watches and text-only clients show, and it
 * is checked far less often than it is used.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { renderTemplate, TEMPLATE_NAMES } from './templates.js'

const SAMPLES = {
  'payment-received': {
    name: 'Anjali Ramesh',
    courseTitle: 'SEO Mastery',
    amount: 2499,
    utr: '429518847213',
    transactionId: '66b2f1c0a4d9e51234ab7de9',
    verificationWindow: 'within 24 hours',
  },
  'access-granted': {
    name: 'Anjali Ramesh',
    email: 'anjali.ramesh@example.in',
    courseTitle: 'SEO Mastery',
    courseSlug: 'seo-mastery',
    amount: 2499,
    invoiceNo: 'GS-2026-0142',
    expiresAt: new Date('2027-08-10'),
  },
  'set-password': {
    name: 'Anjali Ramesh',
    email: 'anjali.ramesh@example.in',
    resetUrl: 'https://growthscholar.in/reset-password?token=8f2c1d9e4b7a6503f1e2d8c4b9a70653',
    expiresInLabel: '1 hour',
    isNewAccount: true,
  },
  'workshop-confirmation': {
    name: 'Anjali Ramesh',
    workshopTitle: 'Meta Ads in 90 Minutes',
    startsAt: new Date('2026-08-23T18:30:00+05:30'),
    language: 'Tamil',
    mode: 'Online',
    joinUrl: 'https://meet.growthscholar.in/meta-ads-90',
  },
}

const outDir = path.resolve(process.cwd(), '.mail-preview')
await mkdir(outDir, { recursive: true })

for (const name of TEMPLATE_NAMES) {
  const rendered = renderTemplate(name, SAMPLES[name])
  await writeFile(path.join(outDir, `${name}.html`), rendered.html)
  await writeFile(
    path.join(outDir, `${name}.txt`),
    `Subject: ${rendered.subject}\n\n${rendered.text}`,
  )
  console.log(`${name.padEnd(24)} ${rendered.subject}`)
}

console.log(`\nWrote ${TEMPLATE_NAMES.length} previews to ${outDir}`)
