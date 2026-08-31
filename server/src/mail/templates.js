import { env } from '../config/env.js'
import { button, detailRows, escapeHtml, p, rupees, wrapHtml, wrapText } from './layout.js'

/**
 * Every transactional template the product sends.
 *
 * A template is `{ subject, html, text }` over the data it is given, and both
 * bodies are always produced — a plain-text alternative is not optional. Its
 * absence is one of the strongest single spam signals, and it is what watches,
 * screen readers and text-only clients actually render.
 *
 * Data is escaped at render time (see `escapeHtml`); values here come from buyer
 * input, so treating them as trusted markup would make the inbox an XSS sink.
 */

const url = (path) => `${env.siteUrl}${path}`

const templates = {
  /**
   * Sent the moment a buyer submits a UPI reference (task 10). Its entire job is
   * to be honest about the wait: nothing here is access, and saying so now is
   * what stops a refund request twenty minutes later.
   */
  'payment-received': {
    subject: (d) => `We have your payment reference for ${d.courseTitle}`,
    html: (d) =>
      wrapHtml({
        title: 'Payment reference received',
        preheader: `We are verifying your payment for ${d.courseTitle}.`,
        body: [
          p(`Hi ${escapeHtml(d.name)},`),
          p(
            `Thanks — we have your payment details for <strong>${escapeHtml(d.courseTitle)}</strong> and they are queued for verification.`,
          ),
          detailRows([
            ['Course', d.courseTitle],
            ['Amount', rupees(d.amount)],
            ['UPI reference (UTR)', d.utr],
            ['Reference ID', d.transactionId],
          ]),
          p(
            `<strong>This is not access yet.</strong> A person checks each UPI payment against our bank statement, normally ${escapeHtml(d.verificationWindow || 'within 24 hours')}. You will get a second email the moment your course is open.`,
          ),
          p(
            `If you do not hear from us in that window, reply to this email with your UTR and we will chase it.`,
          ),
        ].join(''),
      }),
    text: (d) =>
      wrapText({
        title: 'Payment reference received',
        body: [
          `Hi ${d.name},`,
          '',
          `Thanks — we have your payment details for "${d.courseTitle}" and they are queued for verification.`,
          '',
          `Course:              ${d.courseTitle}`,
          `Amount:              ${rupees(d.amount)}`,
          `UPI reference (UTR): ${d.utr}`,
          `Reference ID:        ${d.transactionId}`,
          '',
          `THIS IS NOT ACCESS YET. A person checks each UPI payment against our bank`,
          `statement, normally ${d.verificationWindow || 'within 24 hours'}. You will get a second email the`,
          `moment your course is open.`,
          '',
          'If you do not hear from us in that window, reply to this email with your UTR',
          'and we will chase it.',
        ].join('\n'),
      }),
  },

  /** Sent when an admin approves the payment (task 12) or a gateway confirms it (task 16). */
  'access-granted': {
    subject: (d) => `Your access to ${d.courseTitle} is open`,
    html: (d) =>
      wrapHtml({
        title: `You're in — ${d.courseTitle}`,
        preheader: `Your course is open. Start whenever you like.`,
        body: [
          p(`Hi ${escapeHtml(d.name)},`),
          p(
            `Payment confirmed. <strong>${escapeHtml(d.courseTitle)}</strong> is now open on your account.`,
          ),
          button('Start the course', url(`/student/courses/${d.courseSlug}`)),
          detailRows([
            ['Course', d.courseTitle],
            ['Access', d.expiresAt ? `Until ${formatDate(d.expiresAt)}` : 'Lifetime'],
            ['Amount paid', d.amount ? rupees(d.amount) : null],
            ['Invoice', d.invoiceNo],
          ]),
          p(
            `Sign in with <strong>${escapeHtml(d.email)}</strong>. If you have not set a password yet, use the set-password link in the separate email we just sent.`,
          ),
        ].join(''),
      }),
    text: (d) =>
      wrapText({
        title: `You're in — ${d.courseTitle}`,
        body: [
          `Hi ${d.name},`,
          '',
          `Payment confirmed. "${d.courseTitle}" is now open on your account.`,
          '',
          `Start here: ${url(`/student/courses/${d.courseSlug}`)}`,
          '',
          `Course:      ${d.courseTitle}`,
          `Access:      ${d.expiresAt ? `Until ${formatDate(d.expiresAt)}` : 'Lifetime'}`,
          d.amount ? `Amount paid: ${rupees(d.amount)}` : null,
          d.invoiceNo ? `Invoice:     ${d.invoiceNo}` : null,
          '',
          `Sign in with ${d.email}. If you have not set a password yet, use the`,
          `set-password link in the separate email we just sent.`,
        ]
          .filter((line) => line !== null)
          .join('\n'),
      }),
  },

  /**
   * Carries the single-use token from task 9. Doubles as the first-password
   * email for buyers whose account was created for them — same machinery, the
   * `isNewAccount` flag only changes the copy.
   */
  'set-password': {
    subject: (d) =>
      d.isNewAccount ? 'Set your Growth Scholar password' : 'Reset your Growth Scholar password',
    html: (d) =>
      wrapHtml({
        title: d.isNewAccount ? 'Set your password' : 'Reset your password',
        preheader: `This link works once and expires in ${escapeHtml(d.expiresInLabel || '1 hour')}.`,
        body: [
          p(`Hi ${escapeHtml(d.name)},`),
          p(
            d.isNewAccount
              ? `We created an account for <strong>${escapeHtml(d.email)}</strong> so you can reach the course you bought. Choose a password to finish setting it up.`
              : `Someone asked to reset the password for <strong>${escapeHtml(d.email)}</strong>. If that was you, choose a new one below.`,
          ),
          button(d.isNewAccount ? 'Set my password' : 'Reset my password', d.resetUrl),
          p(
            `<span style="color:#6b7280;font-size:14px;">This link works once and expires in ${escapeHtml(d.expiresInLabel || '1 hour')}. If the button does not work, paste this into your browser:<br><a href="${escapeHtml(d.resetUrl)}" style="color:#0f766e;word-break:break-all;">${escapeHtml(d.resetUrl)}</a></span>`,
          ),
          p(
            `<span style="color:#6b7280;font-size:14px;">Did not ask for this? Ignore this email — your ${d.isNewAccount ? 'account stays unusable' : 'password stays unchanged'} until the link is used.</span>`,
          ),
        ].join(''),
      }),
    text: (d) =>
      wrapText({
        title: d.isNewAccount ? 'Set your password' : 'Reset your password',
        body: [
          `Hi ${d.name},`,
          '',
          d.isNewAccount
            ? `We created an account for ${d.email} so you can reach the course you bought.`
            : `Someone asked to reset the password for ${d.email}.`,
          '',
          `Open this link to continue:`,
          d.resetUrl,
          '',
          `It works once and expires in ${d.expiresInLabel || '1 hour'}.`,
          '',
          `Did not ask for this? Ignore this email — your ${d.isNewAccount ? 'account stays unusable' : 'password stays unchanged'} until the link is used.`,
        ].join('\n'),
      }),
  },

  'workshop-confirmation': {
    subject: (d) => `You're registered — ${d.workshopTitle}`,
    html: (d) =>
      wrapHtml({
        title: `You're registered`,
        preheader: `${d.workshopTitle} — ${formatDateTime(d.startsAt)}`,
        body: [
          p(`Hi ${escapeHtml(d.name)},`),
          p(`Your seat for <strong>${escapeHtml(d.workshopTitle)}</strong> is confirmed.`),
          detailRows([
            ['Workshop', d.workshopTitle],
            ['When', formatDateTime(d.startsAt)],
            ['Language', d.language],
            ['Mode', d.mode],
          ]),
          d.joinUrl ? button('Join link', d.joinUrl) : '',
          p(
            d.joinUrl
              ? `Save this email — the join link above is the same one we will remind you with.`
              : `We will email the join link before it starts. Save this email so you can find it.`,
          ),
        ].join(''),
      }),
    text: (d) =>
      wrapText({
        title: `You're registered`,
        body: [
          `Hi ${d.name},`,
          '',
          `Your seat for "${d.workshopTitle}" is confirmed.`,
          '',
          `Workshop: ${d.workshopTitle}`,
          `When:     ${formatDateTime(d.startsAt)}`,
          d.language ? `Language: ${d.language}` : null,
          d.mode ? `Mode:     ${d.mode}` : null,
          d.joinUrl
            ? `\nJoin link: ${d.joinUrl}`
            : '\nWe will email the join link before it starts.',
        ]
          .filter((line) => line !== null)
          .join('\n'),
      }),
  },
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function formatDateTime(value) {
  if (!value) return 'To be announced'
  return `${new Date(value).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })} IST`
}

export const TEMPLATE_NAMES = Object.keys(templates)

export function renderTemplate(name, data = {}) {
  const template = templates[name]
  if (!template) throw new Error(`Unknown mail template "${name}"`)
  return {
    subject: template.subject(data),
    html: template.html(data),
    text: template.text(data),
  }
}
