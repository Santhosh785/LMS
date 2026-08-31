import { env } from '../config/env.js'
import { cfg } from '../services/runtimeConfig.js'

/**
 * One brand shell for every transactional email.
 *
 * Table-based and fully inline-styled on purpose: Outlook and most Indian
 * webmail clients drop <style> blocks and flex/grid outright, so anything
 * cleverer than this renders as an unstyled column on a real phone.
 */

const BRAND = '#0f766e' // teal — matches the site's primary
const INK = '#111827'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** ₹1,499 — the format buyers see on the site. */
export const rupees = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export const button = (label, url) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="border-radius:6px;background:${BRAND};">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`

/** Label/value rows for order and access summaries. */
export const detailRows = (rows) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:16px 0;">
    ${rows
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(
        ([label, value]) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};">${escapeHtml(label)}</td>
        <td style="padding:8px 0;border-bottom:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${INK};font-weight:bold;text-align:right;">${escapeHtml(value)}</td>
      </tr>`,
      )
      .join('')}
  </table>`

const footerHtml = () => {
  const bits = [cfg.business.name, cfg.business.address].filter(Boolean)
  return `
    <tr><td style="padding:24px 32px;border-top:1px solid ${LINE};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:20px;color:${MUTED};">
      <div style="font-weight:bold;color:${INK};">${escapeHtml(bits[0] || 'Growth Scholar')}</div>
      ${bits[1] ? `<div>${escapeHtml(bits[1])}</div>` : ''}
      <div>Questions? Reply to this email or write to
        <a href="mailto:${escapeHtml(cfg.business.supportEmail)}" style="color:${BRAND};">${escapeHtml(cfg.business.supportEmail)}</a>
      </div>
      <div style="margin-top:8px;">You are receiving this because you bought or requested access at
        <a href="${escapeHtml(env.siteUrl)}" style="color:${BRAND};">${escapeHtml(env.siteUrl.replace(/^https?:\/\//, ''))}</a>.
      </div>
    </td></tr>`
}

const footerText = () =>
  [
    '',
    '—',
    cfg.business.name,
    cfg.business.address,
    `Support: ${cfg.business.supportEmail}`,
    env.siteUrl,
  ]
    .filter(Boolean)
    .join('\n')

/**
 * `preheader` is the grey line a phone shows next to the subject. Left empty,
 * mail clients pull the first thing they find — usually the brand name repeated.
 */
export const wrapHtml = ({ title, preheader = '', body }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">
        <tr><td style="padding:24px 32px;background:${BRAND};font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">Growth Scholar</td></tr>
        <tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:${INK};">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:${INK};">${escapeHtml(title)}</h1>
          ${body}
        </td></tr>
        ${footerHtml()}
      </table>
    </td></tr>
  </table>
</body>
</html>`

export const wrapText = ({ title, body }) =>
  `${title}\n${'='.repeat(title.length)}\n\n${body}\n${footerText()}\n`

export const p = (html) => `<p style="margin:0 0 16px;">${html}</p>`
