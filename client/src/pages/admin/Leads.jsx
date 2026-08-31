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
 * The leads inbox.
 *
 * The mentor popup has been creating Lead records since launch that nothing
 * could read — this is the first screen that shows them. Status, owner and
 * notes make the list workable rather than merely visible.
 */

const STATUS_TONE = {
  New: 'ok',
  Contacted: 'neutral',
  Qualified: 'neutral',
  Converted: 'ok',
  Lost: 'draft',
}

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

export default function Leads() {
  useDocumentTitle('Leads | Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)
  const [note, setNote] = useState('')

  const params = { ...(status ? { status } : {}), ...(search.trim() ? { q: search.trim() } : {}) }

  const list = useQuery({
    queryKey: ['admin', 'leads', params],
    queryFn: async () => (await api.get('/admin/leads', { params })).data,
  })

  const owners = useQuery({
    queryKey: ['admin', 'users', 'owners'],
    queryFn: async () => (await api.get('/admin/users', { params: { role: 'admin' } })).data,
  })

  const refresh = (msg) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] })
    if (msg) toast.show(msg)
  }

  const update = useMutation({
    mutationFn: async ({ id, body }) => (await api.put(`/admin/leads/${id}`, body)).data,
    onSuccess: (lead) => {
      setOpen((o) => (o && o._id === lead._id ? lead : o))
      refresh('Saved')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const addNote = useMutation({
    mutationFn: async ({ id, body }) => (await api.post(`/admin/leads/${id}/notes`, { body })).data,
    onSuccess: (lead) => {
      setOpen(lead)
      setNote('')
      refresh('Note added')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const remove = useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/leads/${id}`)).data,
    onSuccess: () => {
      setOpen(null)
      refresh('Lead deleted')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const counts = list.data?.counts || {}
  const statuses = list.data?.statuses || []
  const ownerOptions = [
    { value: '', label: '— Unassigned —' },
    ...(owners.data?.items || []).map((u) => ({ value: u._id, label: u.name })),
  ]

  const columns = [
    {
      key: 'name',
      label: 'Lead',
      render: (l) => (
        <div>
          <p className="font-semibold text-ink">{l.name || 'No name given'}</p>
          <p className="text-[0.8rem] text-muted">{l.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone' },
    {
      key: 'status',
      label: 'Status',
      render: (l) => <Pill tone={STATUS_TONE[l.status] || 'neutral'}>{l.status}</Pill>,
    },
    { key: 'source', label: 'Source' },
    {
      key: 'owner',
      label: 'Owner',
      render: (l) => (
        <span className={cn('text-[0.85rem]', !l.owner && 'text-muted')}>
          {l.owner?.name || 'Unassigned'}
        </span>
      ),
    },
    { key: 'createdAt', label: 'Received', render: (l) => fmt(l.createdAt) },
    {
      key: 'actions',
      label: '',
      render: (l) => (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setOpen(l)}>
            Open
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      {toast.node}
      <PageHead
        title="Leads"
        sub="Enquiries from the mentor popup and the blog consult form."
        actions={
          <Button
            variant="outline"
            onClick={() => downloadCsv(`leads/export?${new URLSearchParams(params)}`, 'leads.csv')}
          >
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
          aria-label="Search leads"
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
          empty="No leads yet. They arrive from the mentor popup on the public site."
        />
      )}

      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.name || open?.email || 'Lead'}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => remove.mutate(open._id)}>
              Delete
            </Button>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Close
            </Button>
          </>
        }
      >
        {open && (
          <div className="grid gap-4">
            <dl className="grid grid-cols-2 gap-3 rounded-lg2 bg-surface-mist p-4 text-[0.88rem] mx-640:grid-cols-1">
              {[
                ['Email', open.email],
                ['Phone', open.phone],
                ['Education', open.education],
                ['Profile', open.profile],
                ['Year of passing', open.yearOfPassing],
                ['Language', open.language],
                ['Source', open.source],
                ['Came from', open.page],
                ['Received', fmt(open.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[0.75rem] uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="text-ink">{value || '—'}</dd>
                </div>
              ))}
            </dl>

            <div className="grid grid-cols-3 gap-3 mx-640:grid-cols-1">
              <SelectField
                label="Status"
                value={open.status}
                onChange={(e) => update.mutate({ id: open._id, body: { status: e.target.value } })}
                options={statuses.map((s) => ({ value: s, label: s }))}
              />
              <SelectField
                label="Owner"
                value={open.owner?._id || ''}
                onChange={(e) => update.mutate({ id: open._id, body: { owner: e.target.value } })}
                options={ownerOptions}
              />
              <TextField
                label="Follow up on"
                type="date"
                value={open.nextFollowUpAt ? open.nextFollowUpAt.slice(0, 10) : ''}
                onChange={(e) =>
                  update.mutate({ id: open._id, body: { nextFollowUpAt: e.target.value } })
                }
              />
            </div>

            <div>
              <h4 className="mb-2 text-[0.95rem]">Notes</h4>
              <div className="grid gap-2">
                {(open.notes || []).length === 0 && (
                  <p className="text-[0.85rem] text-muted">Nothing recorded yet.</p>
                )}
                {(open.notes || []).map((n, i) => (
                  <div key={i} className="rounded-md2 border border-line p-3 text-[0.88rem]">
                    <p>{n.body}</p>
                    <p className="mt-1 text-[0.75rem] text-muted">
                      {n.authorName || 'Someone'} · {fmt(n.at)}
                    </p>
                  </div>
                ))}
              </div>
              <TextAreaField
                label="Add a note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-3"
              />
              <Button
                className="mt-2"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate({ id: open._id, body: note.trim() })}
              >
                Save note
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
