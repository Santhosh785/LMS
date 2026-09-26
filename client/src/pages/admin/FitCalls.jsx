import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { downloadCsv } from '../../api/admin.js'
import { DataTable, PageHead } from '../../components/admin/index.jsx'
import {
  Button,
  cn,
  Loading,
  Modal,
  Pill,
  SelectField,
  TextAreaField,
  TextField,
  useToast,
} from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/**
 * The fit-call inbox — requests from /programs/fit-call.
 *
 * Shorter than an application: the job here is to pick a slot and mark what
 * happened, so the detail view leads with scheduling.
 */

const STATUS_TONE = {
  Requested: 'warn',
  Scheduled: 'neutral',
  Completed: 'ok',
  'No-show': 'draft',
  Cancelled: 'live',
}

const SLOT_LABEL = {
  'mon-fri-10-12': 'Mon–Fri 10–12',
  'mon-fri-12-3': 'Mon–Fri 12–3',
  'mon-fri-7-10': 'Mon–Fri 7–10 PM',
  'sat-10-1': 'Sat 10–1',
  'sat-2-6': 'Sat 2–6',
  'sun-10-1': 'Sun 10–1',
}

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

/** <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` in local time. */
const toLocalInput = (d) => {
  if (!d) return ''
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function FitCalls() {
  useDocumentTitle('Fit calls | Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [note, setNote] = useState('')

  const params = { ...(status ? { status } : {}), ...(search.trim() ? { q: search.trim() } : {}) }

  const list = useQuery({
    queryKey: ['admin', 'fit-calls', params],
    queryFn: async () => (await api.get('/admin/fit-calls', { params })).data,
  })

  const detail = useQuery({
    queryKey: ['admin', 'fit-calls', openId],
    queryFn: async () => (await api.get(`/admin/fit-calls/${openId}`)).data,
    enabled: Boolean(openId),
  })

  const owners = useQuery({
    queryKey: ['admin', 'users', 'owners'],
    queryFn: async () => (await api.get('/admin/users', { params: { role: 'admin' } })).data,
  })

  const refresh = (msg) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'fit-calls'] })
    if (msg) toast.show(msg)
  }

  const update = useMutation({
    mutationFn: async ({ id, body }) => (await api.put(`/admin/fit-calls/${id}`, body)).data,
    onSuccess: () => refresh('Saved'),
    onError: (err) => toast.show(apiError(err)),
  })

  const addNote = useMutation({
    mutationFn: async ({ id, body }) =>
      (await api.post(`/admin/fit-calls/${id}/notes`, { body })).data,
    onSuccess: () => {
      setNote('')
      refresh('Note added')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const counts = list.data?.counts || {}
  const statuses = list.data?.statuses || []
  const ownerOptions = [
    { value: '', label: '— Unassigned —' },
    ...(owners.data?.items || []).map((u) => ({ value: u._id, label: u.name })),
  ]
  const open = detail.data

  const columns = [
    {
      key: 'fullName',
      label: 'Requester',
      render: (r) => (
        <div>
          <p className="font-semibold text-ink">{r.fullName}</p>
          <p className="text-[0.8rem] text-muted">{r.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <Pill tone={STATUS_TONE[r.status] || 'neutral'}>{r.status}</Pill>,
    },
    { key: 'preferredWeek', label: 'When' },
    {
      key: 'preferredSlots',
      label: 'Slots',
      render: (r) => (r.preferredSlots || []).map((s) => SLOT_LABEL[s] || s).join(', ') || '—',
    },
    { key: 'submittedFullApplication', label: 'Applied?' },
    { key: 'createdAt', label: 'Requested', render: (r) => fmt(r.createdAt) },
    {
      key: 'open',
      label: '',
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setOpenId(r._id)}>
          Open
        </Button>
      ),
    },
  ]

  return (
    <>
      {toast.node}
      <PageHead
        title="Fit calls"
        subtitle="15-minute calls requested from /programs/fit-call. A call does not reserve a seat."
        actions={
          <Button variant="outline" onClick={() => downloadCsv('/admin/fit-calls/export', params)}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatus('')}
          className={cn(
            'rounded-full border px-4 py-1.5 text-[0.85rem] font-semibold',
            !status ? 'border-brand bg-brand text-white' : 'border-line bg-white text-muted',
          )}
        >
          All ({list.data?.total ?? 0})
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-[0.85rem] font-semibold',
              status === s ? 'border-brand bg-brand text-white' : 'border-line bg-white text-muted',
            )}
          >
            {s} ({counts[s] || 0})
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          aria-label="Search fit calls"
          className="ml-auto h-10 w-[min(320px,50vw)] rounded-full border border-line px-4 text-[0.88rem] outline-none focus:border-brand"
        />
      </div>

      {list.isPending ? (
        <Loading />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items || []}
          searchable={false}
          pageSize={25}
          empty="No fit calls requested yet."
        />
      )}

      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={open?.fullName || 'Fit call'}
        width="max-w-2xl"
        footer={
          <Button variant="outline" onClick={() => setOpenId(null)}>
            Close
          </Button>
        }
      >
        {detail.isPending || !open ? (
          <Loading />
        ) : (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-3 mx-640:grid-cols-1">
              <SelectField
                label="Status"
                value={open.status}
                options={statuses.map((s) => ({ value: s, label: s }))}
                onChange={(e) => update.mutate({ id: open._id, body: { status: e.target.value } })}
              />
              <SelectField
                label="Owner"
                value={open.owner?._id || ''}
                options={ownerOptions}
                onChange={(e) => update.mutate({ id: open._id, body: { owner: e.target.value } })}
              />
              <TextField
                label="Scheduled for"
                type="datetime-local"
                defaultValue={toLocalInput(open.scheduledAt)}
                onBlur={(e) =>
                  update.mutate({ id: open._id, body: { scheduledAt: e.target.value || null } })
                }
              />
            </div>

            {open.applications?.length > 0 && (
              <p className="rounded-lg2 bg-accent-soft px-4 py-3 text-[0.85rem] text-brand">
                Has {open.applications.length} Flagship application
                {open.applications.length > 1 ? 's' : ''} — latest: {open.applications[0].status}.
              </p>
            )}

            <dl className="grid grid-cols-2 gap-3 rounded-lg2 bg-surface-mist p-4 text-[0.88rem] mx-640:grid-cols-1">
              {[
                ['Email', open.email],
                ['Phone', open.phone],
                ['Preferred week', open.preferredWeek],
                ['Slots', (open.preferredSlots || []).map((s) => SLOT_LABEL[s] || s).join(', ')],
                ['Timezone', open.timezone],
                ['Language', open.callLanguage],
                ['Schedule notes', open.scheduleNotes],
                ['Applied already?', open.submittedFullApplication],
                ['Current role', open.currentStatus],
                ['Weekly hours', open.weeklyHours],
                ['Biggest blocker', open.biggestBlocker],
                ['Found us via', open.referralSource],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[0.75rem] uppercase tracking-wide text-muted">{label}</dt>
                    <dd className="text-ink">{value}</dd>
                  </div>
                ))}
            </dl>

            {[
              ['Why a call now', open.whyCallNow],
              ['Questions for the call', open.callQuestions],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="rounded-lg2 border border-line p-4">
                  <p className="mb-1 text-[0.75rem] uppercase tracking-wide text-muted">{label}</p>
                  <p className="whitespace-pre-line text-[0.9rem] leading-relaxed text-ink">
                    {value}
                  </p>
                </div>
              ))}

            <div>
              <p className="mb-2 text-[0.85rem] font-semibold text-brand-deep">Notes</p>
              {(open.notes || []).map((n) => (
                <p key={`${n.at}-${n.body}`} className="mb-2 text-[0.85rem] text-muted">
                  <span className="font-semibold text-ink">{n.authorName || 'Team'}</span> ·{' '}
                  {fmt(n.at)} — {n.body}
                </p>
              ))}
              <TextAreaField
                label="Add a note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                size="sm"
                className="mt-2"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate({ id: open._id, body: note })}
              >
                Add note
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
