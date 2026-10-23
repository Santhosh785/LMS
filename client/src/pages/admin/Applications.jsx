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
  useToast,
} from '../../components/ui/index.jsx'

/**
 * The Flagship application inbox.
 *
 * /programs/apply writes a reviewable document with five essays behind it; this
 * is the screen the team scores a batch from. Without it the form would be
 * write-only, which is exactly the failure the leads inbox exists to fix.
 */

const STATUS_TONE = {
  New: 'warn',
  Shortlisted: 'neutral',
  'Fit call booked': 'neutral',
  Accepted: 'ok',
  Waitlisted: 'draft',
  Rejected: 'live',
}

const TRACK_LABEL = {
  'track-a': 'Track A — owner',
  'track-b': 'Track B — freelancer',
  undecided: 'Undecided',
}

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

const list2 = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '—')

/** The five long-form answers, in the order the applicant wrote them. */
const ESSAYS = [
  ['Why Flagship LIVE now', 'whyFlagship'],
  ['Success in 12 weeks', 'twelveWeekOutcome'],
  ['Something they shipped', 'shipStory'],
  ['Curriculum they’ll lean on', 'curriculumHook'],
  ['Scholarship case', 'scholarshipCase'],
]

export default function Applications() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [note, setNote] = useState('')

  const params = { ...(status ? { status } : {}), ...(search.trim() ? { q: search.trim() } : {}) }

  const list = useQuery({
    queryKey: ['admin', 'applications', params],
    queryFn: async () => (await api.get('/admin/applications', { params })).data,
  })

  // The list view omits the essays, so the detail is fetched on open.
  const detail = useQuery({
    queryKey: ['admin', 'applications', openId],
    queryFn: async () => (await api.get(`/admin/applications/${openId}`)).data,
    enabled: Boolean(openId),
  })

  const owners = useQuery({
    queryKey: ['admin', 'users', 'owners'],
    queryFn: async () => (await api.get('/admin/users', { params: { role: 'admin' } })).data,
  })

  const refresh = (msg) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] })
    if (msg) toast.show(msg)
  }

  const update = useMutation({
    mutationFn: async ({ id, body }) => (await api.put(`/admin/applications/${id}`, body)).data,
    onSuccess: () => refresh('Saved'),
    onError: (err) => toast.show(apiError(err)),
  })

  const addNote = useMutation({
    mutationFn: async ({ id, body }) =>
      (await api.post(`/admin/applications/${id}/notes`, { body })).data,
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
      label: 'Applicant',
      render: (a) => (
        <div>
          <p className="font-semibold text-ink">{a.fullName}</p>
          <p className="text-[0.8rem] text-muted">{a.email}</p>
        </div>
      ),
    },
    {
      key: 'trackPreference',
      label: 'Track',
      render: (a) => TRACK_LABEL[a.trackPreference] || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (a) => <Pill tone={STATUS_TONE[a.status] || 'neutral'}>{a.status}</Pill>,
    },
    {
      key: 'paymentPlan',
      label: 'Fee',
      render: (a) => (a.paymentPlan === 'scholarship' ? 'Scholarship' : 'Full'),
    },
    { key: 'city', label: 'City' },
    {
      key: 'owner',
      label: 'Owner',
      render: (a) => (
        <span className={cn('text-[0.85rem]', !a.owner && 'text-muted')}>
          {a.owner?.name || 'Unassigned'}
        </span>
      ),
    },
    { key: 'createdAt', label: 'Received', render: (a) => fmt(a.createdAt) },
    {
      key: 'open',
      label: '',
      render: (a) => (
        <Button size="sm" variant="outline" onClick={() => setOpenId(a._id)}>
          Review
        </Button>
      ),
    },
  ]

  return (
    <>
      {toast.node}
      <PageHead
        title="Flagship applications"
        subtitle="Submissions from /programs/apply. Ten seats per batch — every essay is read."
        actions={
          <Button
            variant="outline"
            onClick={() => downloadCsv('/admin/applications/export', params)}
          >
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
          placeholder="Search name, email, phone or city…"
          aria-label="Search applications"
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
          empty="No applications yet. They arrive from /programs/apply."
        />
      )}

      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={open?.fullName || 'Application'}
        width="max-w-3xl"
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
            <div className="grid grid-cols-2 gap-3 mx-640:grid-cols-1">
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
            </div>

            {open.fitCalls?.length > 0 && (
              <p className="rounded-lg2 bg-accent-soft px-4 py-3 text-[0.85rem] text-brand">
                This applicant has {open.fitCalls.length} fit call request
                {open.fitCalls.length > 1 ? 's' : ''} — latest: {open.fitCalls[0].status}.
              </p>
            )}

            <dl className="grid grid-cols-2 gap-3 rounded-lg2 bg-surface-mist p-4 text-[0.88rem] mx-640:grid-cols-1">
              {[
                ['Email', open.email],
                ['Phone', open.phone],
                ['City / state', `${open.city}, ${open.state}`],
                ['LinkedIn', open.linkedin],
                ['Track', TRACK_LABEL[open.trackPreference]],
                ['Batch', open.batchPreference],
                ['Language', open.mentoringLanguage],
                ['Current status', open.currentStatus],
                ['Company', open.employer],
                ['Weekly hours', open.weeklyHours],
                ['Availability', list2(open.liveAvailability)],
                ['Setup', open.hasSetup],
                ['Masterclass city', open.masterclassCity],
                ['Blockers', open.scheduleBlockers],
                ['Experience', open.experienceLevel],
                ['Channels', list2(open.channels)],
                ['Monthly spend', open.monthlySpend],
                ['Tools', open.toolsUsed],
                ['Portfolio', open.portfolioUrl],
                ['Starter courses', open.starterCourses],
                ['Found us via', open.referralSource],
                ['Referral detail', open.referralDetail],
                ['Payment plan', open.paymentPlan],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[0.75rem] uppercase tracking-wide text-muted">{label}</dt>
                    <dd className="text-ink">{value}</dd>
                  </div>
                ))}
            </dl>

            <div className="grid gap-3">
              {ESSAYS.filter(([, key]) => open[key]).map(([label, key]) => (
                <div key={key} className="rounded-lg2 border border-line p-4">
                  <p className="mb-1 text-[0.75rem] uppercase tracking-wide text-muted">{label}</p>
                  <p className="whitespace-pre-line text-[0.9rem] leading-relaxed text-ink">
                    {open[key]}
                  </p>
                </div>
              ))}
            </div>

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
