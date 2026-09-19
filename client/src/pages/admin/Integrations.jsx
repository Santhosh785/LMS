import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { PageHead } from '../../components/admin/index.jsx'
import {
  Button,
  cn,
  Field,
  inputClass,
  Loading,
  Panel,
  Pill,
  SelectField,
  TextField,
  useToast,
} from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/**
 * Integrations, feature flags and business identity.
 *
 * These lived only in `server/.env`, so changing a payment key or turning a
 * module on meant editing a file on the server and restarting it. A blank field
 * here still falls back to the environment, which is why every value shows
 * where it is currently coming from.
 */

/** A stored secret is never sent to the browser — only a hint and its source. */
function SecretField({ label, state, hint, value, onChange, onClear }) {
  return (
    <Field
      label={label}
      hint={
        state?.source === 'unreadable'
          ? 'A key is stored here but cannot be decrypted — CONFIG_SECRET has changed since it was saved. The server is using the environment value instead. Re-enter it below.'
          : state?.set
            ? `Currently ${state.hint} — from ${state.source === 'admin' ? 'this screen' : 'the server environment'}. Leave blank to keep it.`
            : hint || 'Not set.'
      }
    >
      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="new-password"
          placeholder={state?.set ? '••••••••  (unchanged)' : 'Paste the key'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, 'flex-1')}
        />
        {state?.set && state.source === 'admin' && (
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
    </Field>
  )
}

/** Tri-state: on, off, or deferring to the environment. */
function FlagRow({ name, label, stored, effective, onChange }) {
  const options = [
    { value: 'null', label: 'Use server default' },
    { value: 'true', label: 'On' },
    { value: 'false', label: 'Off' },
  ]
  const current = stored === true ? 'true' : stored === false ? 'false' : 'null'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div>
        <p className="font-semibold text-ink">{label}</p>
        <p className="text-[0.8rem] text-muted">
          Currently {effective ? 'on' : 'off'}
          {current === 'null' ? ' (from the server environment)' : ''}
        </p>
      </div>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(name, o.value === 'null' ? null : o.value === 'true')}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold',
              current === o.value
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-white text-muted hover:border-brand',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Integrations() {
  useDocumentTitle('Integrations | Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({})

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: async () => (await api.get('/admin/integrations')).data,
  })

  const save = useMutation({
    mutationFn: async ({ block, body }) =>
      (await api.put(`/admin/integrations/${block}`, body)).data,
    onSuccess: (_d, vars) => {
      // Clear only the fields that were just written, so an unsaved edit in a
      // different panel is not silently discarded.
      setDraft((prev) => {
        const next = { ...prev }
        Object.keys(vars.body).forEach((k) => delete next[k])
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] })
      toast.show('Saved ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const test = useMutation({
    mutationFn: async (name) => (await api.post(`/admin/integrations/${name}/test`)).data,
    onSuccess: (res) => toast.show(res.message || 'Works'),
    onError: (err) => toast.show(apiError(err)),
  })

  if (isPending || !data) return <Loading />

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }))
  const val = (key, fallback) => (draft[key] !== undefined ? draft[key] : (fallback ?? ''))

  const saveBlock = (block, fields) => {
    const body = {}
    fields.forEach((f) => {
      if (draft[f] !== undefined) body[f] = draft[f]
    })
    if (Object.keys(body).length === 0) return toast.show('Nothing changed')
    return save.mutate({ block, body })
  }

  const status = data.status || {}

  return (
    <>
      {toast.node}
      <PageHead
        title="Integrations"
        sub="Payment, email, video and image-storage credentials, feature switches and business identity. A blank field falls back to the server environment."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['Razorpay', status.razorpay],
          ['UPI', status.upi],
          ['Email', status.mail],
          ['Video playback', status.playback],
          ['Video upload', status.upload],
          ['Image storage', status.imageStorage],
        ].map(([label, ok]) => (
          <Pill key={label} tone={ok ? 'ok' : 'draft'}>
            {ok ? '✓' : '○'} {label}
          </Pill>
        ))}
      </div>

      <div className="grid gap-5">
        {/* ----------------------------- features ---------------------------- */}
        <Panel title="Modules">
          {[
            ['funnels', 'Marketing funnels'],
            ['email', 'Email broadcasts'],
            ['gamification', 'Gamification'],
          ].map(([name, label]) => (
            <FlagRow
              key={name}
              name={name}
              label={label}
              stored={draft[name] !== undefined ? draft[name] : data.features.stored?.[name]}
              effective={data.features.effective?.[name]}
              onChange={(k, v) => set(k, v)}
            />
          ))}
          <Button
            className="mt-4"
            onClick={() => saveBlock('features', ['funnels', 'email', 'gamification'])}
          >
            Save modules
          </Button>
        </Panel>

        {/* ----------------------------- payments ---------------------------- */}
        <Panel
          title="Payments"
          actions={
            <Button size="sm" variant="outline" onClick={() => test.mutate('razorpay')}>
              Test Razorpay
            </Button>
          }
        >
          <div className="grid gap-4">
            <TextField
              label="Razorpay key id"
              value={val('razorpayKeyId', data.payments.razorpayKeyId)}
              onChange={(e) => set('razorpayKeyId', e.target.value)}
              hint="Public by design — it ships in the checkout page."
            />
            <SecretField
              label="Razorpay key secret"
              state={data.payments.razorpayKeySecret}
              value={val('razorpayKeySecret')}
              onChange={(v) => set('razorpayKeySecret', v)}
              onClear={() => save.mutate({ block: 'payments', body: { razorpayKeySecret: null } })}
            />
            <SecretField
              label="Razorpay webhook secret"
              state={data.payments.razorpayWebhookSecret}
              value={val('razorpayWebhookSecret')}
              onChange={(v) => set('razorpayWebhookSecret', v)}
              onClear={() =>
                save.mutate({ block: 'payments', body: { razorpayWebhookSecret: null } })
              }
              hint="Set separately in the Razorpay dashboard. Without it, deliveries are not verified."
            />
            <div className="grid grid-cols-3 gap-4 mx-640:grid-cols-1">
              <TextField
                label="UPI VPA"
                value={val('upiVpa', data.payments.upiVpa)}
                onChange={(e) => set('upiVpa', e.target.value)}
              />
              <TextField
                label="UPI payee name"
                value={val('upiPayeeName', data.payments.upiPayeeName)}
                onChange={(e) => set('upiPayeeName', e.target.value)}
              />
              <TextField
                label="Invoice prefix"
                value={val('invoicePrefix', data.payments.invoicePrefix)}
                onChange={(e) => set('invoicePrefix', e.target.value)}
              />
            </div>
            <Button
              onClick={() =>
                saveBlock('payments', [
                  'razorpayKeyId',
                  'razorpayKeySecret',
                  'razorpayWebhookSecret',
                  'upiVpa',
                  'upiPayeeName',
                  'invoicePrefix',
                ])
              }
            >
              Save payments
            </Button>
          </div>
        </Panel>

        {/* ------------------------------- mail ------------------------------ */}
        <Panel
          title="Email"
          actions={
            <Button size="sm" variant="outline" onClick={() => test.mutate('mail')}>
              Send test email
            </Button>
          }
        >
          <div className="grid gap-4">
            <SecretField
              label="Resend API key"
              state={data.mail.resendApiKey}
              value={val('resendApiKey')}
              onChange={(v) => set('resendApiKey', v)}
              onClear={() => save.mutate({ block: 'mail', body: { resendApiKey: null } })}
            />
            <TextField
              label="From address"
              value={val('from', data.mail.from)}
              onChange={(e) => set('from', e.target.value)}
              hint="Must be on a domain verified with Resend."
            />
            <Button onClick={() => saveBlock('mail', ['resendApiKey', 'from'])}>Save email</Button>
          </div>
        </Panel>

        {/* ------------------------------ video ------------------------------ */}
        <Panel
          title="Video (Bunny Stream)"
          actions={
            <Button size="sm" variant="outline" onClick={() => test.mutate('bunny')}>
              Test Bunny
            </Button>
          }
        >
          <div className="grid gap-4">
            <TextField
              label="Library id"
              value={val('bunnyLibraryId', data.video.bunnyLibraryId)}
              onChange={(e) => set('bunnyLibraryId', e.target.value)}
            />
            <SecretField
              label="Security key (playback signing)"
              state={data.video.bunnySecurityKey}
              value={val('bunnySecurityKey')}
              onChange={(v) => set('bunnySecurityKey', v)}
              onClear={() => save.mutate({ block: 'video', body: { bunnySecurityKey: null } })}
            />
            <SecretField
              label="API key (uploads)"
              state={data.video.bunnyApiKey}
              value={val('bunnyApiKey')}
              onChange={(v) => set('bunnyApiKey', v)}
              onClear={() => save.mutate({ block: 'video', body: { bunnyApiKey: null } })}
            />
            <SecretField
              label="Webhook token"
              state={data.video.bunnyWebhookToken}
              value={val('bunnyWebhookToken')}
              onChange={(v) => set('bunnyWebhookToken', v)}
              onClear={() => save.mutate({ block: 'video', body: { bunnyWebhookToken: null } })}
              hint="Bunny webhooks carry no signature, so the URL carries this instead. Unset disables the endpoint."
            />
            <Button
              onClick={() =>
                saveBlock('video', [
                  'bunnyLibraryId',
                  'bunnySecurityKey',
                  'bunnyApiKey',
                  'bunnyWebhookToken',
                ])
              }
            >
              Save video
            </Button>
          </div>
        </Panel>

        {/* -------------------------- image storage -------------------------- */}
        <Panel
          title="Images (Bunny Storage)"
          actions={
            <Button size="sm" variant="outline" onClick={() => test.mutate('bunny-storage')}>
              Test storage
            </Button>
          }
        >
          <p className="mb-4 text-[0.86rem] text-muted">
            Where the blog&rsquo;s Media Library keeps its images. This is Bunny&rsquo;s file storage
            product, separate from the Stream library above — it needs its own zone. Leave it blank
            and images stay on the server&rsquo;s own disk, which a redeploy replaces.
          </p>
          <div className="grid gap-4">
            <TextField
              label="Storage zone name"
              value={val('bunnyStorageZone', data.media.bunnyStorageZone)}
              onChange={(e) => set('bunnyStorageZone', e.target.value)}
              hint="Bunny dashboard → Storage → the zone's name, e.g. growth-scholar."
            />
            <SecretField
              label="Storage password"
              state={data.media.bunnyStoragePassword}
              value={val('bunnyStoragePassword')}
              onChange={(v) => set('bunnyStoragePassword', v)}
              onClear={() => save.mutate({ block: 'media', body: { bunnyStoragePassword: null } })}
              hint="Storage → the zone → FTP & API Access → Password. It grants write access to the whole zone, so uploads pass through the server rather than the browser."
            />
            <SelectField
              label="Region"
              value={val('bunnyStorageRegion', data.media.bunnyStorageRegion)}
              onChange={(e) => set('bunnyStorageRegion', e.target.value)}
              options={[
                { value: '', label: 'Germany (default)' },
                { value: 'uk', label: 'United Kingdom' },
                { value: 'se', label: 'Sweden' },
                { value: 'ny', label: 'New York' },
                { value: 'la', label: 'Los Angeles' },
                { value: 'sg', label: 'Singapore' },
                { value: 'syd', label: 'Sydney' },
                { value: 'br', label: 'Brazil' },
                { value: 'jh', label: 'Johannesburg' },
              ]}
              hint="Must match the zone's main region, or Bunny answers 404."
            />
            <TextField
              label="CDN hostname"
              value={val('bunnyStorageHost', data.media.bunnyStorageHost)}
              onChange={(e) => set('bunnyStorageHost', e.target.value)}
              hint="The Pull Zone that serves the storage zone, e.g. growth-scholar.b-cdn.net. Images are linked from here; the storage endpoint itself is not public."
            />
            <Button
              onClick={() =>
                saveBlock('media', [
                  'bunnyStorageZone',
                  'bunnyStoragePassword',
                  'bunnyStorageRegion',
                  'bunnyStorageHost',
                ])
              }
            >
              Save image storage
            </Button>
          </div>
        </Panel>

        {/* ----------------------------- business ---------------------------- */}
        <Panel title="Business identity">
          <p className="mb-4 text-[0.86rem] text-muted">
            Printed on invoices, the policy pages and the footer of every transactional email.
            Razorpay&rsquo;s KYC review rejects placeholder text, so these need to be the real
            registered details.
          </p>
          <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
            {[
              ['legalName', 'Registered legal name'],
              ['supportEmail', 'Support email'],
              ['operatorEmail', 'Operator email (alerts land here)'],
              ['phone', 'Support phone'],
              ['gstin', 'GSTIN (leave blank if not registered)'],
              ['jurisdictionCity', 'Jurisdiction city'],
              ['grievanceOfficer', 'Grievance officer'],
              ['address', 'Registered address'],
            ].map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={val(key, data.business[key])}
                onChange={(e) => set(key, e.target.value)}
              />
            ))}
          </div>
          <Button
            className="mt-4"
            onClick={() =>
              saveBlock('business', [
                'legalName',
                'supportEmail',
                'operatorEmail',
                'phone',
                'gstin',
                'jurisdictionCity',
                'grievanceOfficer',
                'address',
              ])
            }
          >
            Save business identity
          </Button>
        </Panel>
      </div>
    </>
  )
}
