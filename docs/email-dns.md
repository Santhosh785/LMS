# Transactional email — DNS records (task 7 → task 14)

The mail layer (`server/src/mail/`) sends through **Resend**. Code alone does not
put mail in an inbox: until the sending domain is verified, **Resend will only
deliver to the address that owns the Resend account.** Everything a real buyer is
supposed to receive — payment received, access granted, set password — silently
goes nowhere. Applying these records is part of task 14, not optional polish.

## 1. Add the domain in Resend

Resend dashboard → **Domains → Add Domain** → `growthscholar.in`.

Choose the region closest to the audience (`ap-south-1` / Mumbai for India). The
dashboard then prints the exact records below **with values specific to this
domain** — the selector and the DKIM public key are generated per domain, so copy
them from the dashboard rather than from here. The shapes are documented here so
the DNS work can be planned before the account exists.

## 2. Records to add at the DNS host

Add these where the domain's nameservers live (Hostinger hPanel → Domains → DNS
Zone if the domain is registered there). `@` means the apex.

| Type | Name (host) | Value | TTL | Why |
|---|---|---|---|---|
| `TXT` | `send` (i.e. `send.growthscholar.in`) | `v=spf1 include:amazonses.com ~all` | 3600 | **SPF.** Authorises Resend's sending infrastructure for the subdomain mail leaves from. |
| `MX` | `send` | `feedback-smtp.ap-south-1.amazonses.com` priority `10` | 3600 | Bounce and complaint returns. Without it, hard bounces are invisible and reputation quietly rots. |
| `TXT` | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ…` (long key from the dashboard) | 3600 | **DKIM.** Cryptographically signs each message. Gmail treats unsigned bulk mail as suspect. |
| `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@growthscholar.in` | 3600 | **DMARC.** Not required by Resend, but Gmail and Yahoo require it for bulk senders and it is the only way to see who is spoofing the domain. Start at `p=none`, read reports for two weeks, then tighten to `p=quarantine`. |

### Watch for these

- **Do not paste the DKIM value with line breaks.** Some DNS panels wrap long TXT
  records; the key must be one unbroken string.
- **Do not add a second SPF record at the apex.** More than one `v=spf1` record on
  the same name is a permanent SPF failure. If the apex already has SPF for
  Google Workspace/Zoho, leave it alone — Resend's record lives on the `send`
  subdomain and does not conflict.
- **Hostinger's panel appends the domain** to the Name field. Enter `send`, not
  `send.growthscholar.in`, or the record lands on `send.growthscholar.in.growthscholar.in`.

## 3. Verify

1. Resend dashboard → Domains → **Verify**. Propagation is usually minutes, up to
   a few hours.
2. From the VPS, confirm the records resolve:
   ```sh
   dig +short TXT send.growthscholar.in
   dig +short TXT resend._domainkey.growthscholar.in
   dig +short MX  send.growthscholar.in
   dig +short TXT _dmarc.growthscholar.in
   ```
3. Set `MAIL_FROM` in `server/.env` to an address **on the verified domain**, with
   a display name:
   ```
   MAIL_FROM="Growth Scholar <no-reply@send.growthscholar.in>"
   RESEND_API_KEY=re_…
   SUPPORT_EMAIL=support@growthscholar.in
   ```
   `replyTo` is set to `SUPPORT_EMAIL` automatically, so replies reach a human
   even though the From address does not accept mail.
4. End-to-end check — task 14's acceptance criterion. Trigger a real send and
   confirm it lands in an **external** inbox (a Gmail address, not the Resend
   account owner's), then open *Show original* in Gmail and confirm all three
   lines read `PASS`:
   ```
   SPF: PASS   DKIM: PASS   DMARC: PASS
   ```

## Behaviour when this is not done

`send()` no-ops with a warning and logs the full rendered message when
`RESEND_API_KEY` or `MAIL_FROM` is missing. Nothing throws and no flow breaks —
which is exactly why an unverified domain can go unnoticed. If a launch has to
happen before DNS verifies, the operator must send access details by hand and
read set-password links out of the server log.
