import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAdminDelete, useAdminList, useAdminSave } from '../../api/admin.js'
import {
  Button,
  EmptyState,
  Modal,
  Panel,
  SelectField,
  StatusPill,
  TextAreaField,
  TextField,
  useToast,
} from '../../components/ui/index.jsx'
import { DataTable, KpiRow, PageHead, StatCard } from '../../components/admin/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const fmt = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

/* ------------------------------- Broadcasts ------------------------------- */
export function Broadcasts() {
  useDocumentTitle('Broadcasts — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isPending } = useAdminList('email/broadcasts', { limit: 200 })
  const remove = useAdminDelete('email/broadcasts')

  const send = useMutation({
    mutationFn: async (id) => (await api.post(`/admin/email/broadcasts/${id}/send`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.show('Broadcast sent ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const rows = data?.items || []
  const sent = rows.filter((r) => r.status === 'sent')
  const delivered = sent.reduce((s, r) => s + (r.stats?.delivered || 0), 0)
  const opened = sent.reduce((s, r) => s + (r.stats?.opened || 0), 0)

  return (
    <>
      {toast.node}
      <PageHead
        title="All Broadcasts"
        sub="Email campaigns you’ve sent or scheduled"
        actions={
          <Button onClick={() => navigate('/admin/email/broadcasts/create')}>
            + New broadcast
          </Button>
        }
      />

      <KpiRow cols={3}>
        <StatCard
          label="Broadcasts sent"
          value={sent.length}
          sub={`${rows.length - sent.length} drafts`}
        />
        <StatCard label="Delivered" value={delivered.toLocaleString('en-IN')} sub="All time" />
        <StatCard
          label="Opened rate"
          value={delivered ? `${((opened / delivered) * 100).toFixed(2)}%` : '—'}
          sub={`${opened.toLocaleString('en-IN')} opens`}
        />
      </KpiRow>

      <DataTable
        loading={isPending}
        rows={rows}
        searchPlaceholder="Search broadcasts…"
        columns={[
          { key: 'subject', label: 'Subject' },
          { key: 'sendToListName', label: 'List' },
          { key: 'sentAt', label: 'Sent', render: (r) => fmt(r.sentAt) },
          { key: 'delivered', label: 'D', value: (r) => r.stats?.delivered ?? 0 },
          { key: 'opened', label: 'O', value: (r) => r.stats?.opened ?? 0 },
          { key: 'clicked', label: 'C', value: (r) => r.stats?.clicked ?? 0 },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <StatusPill status={r.status === 'sent' ? 'Active' : 'Draft'} />,
          },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) => (
              <div className="flex gap-3">
                {r.status !== 'sent' && (
                  <button
                    type="button"
                    onClick={() => send.mutate(r._id)}
                    className="text-[0.8rem] font-semibold text-brand hover:underline"
                  >
                    Send
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    remove.mutate(r._id, { onSuccess: () => toast.show('Broadcast deleted') })
                  }
                  className="text-[0.8rem] font-semibold text-danger-admin hover:underline"
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]}
        empty={<EmptyState icon="✉" title="No broadcasts yet" body="Write your first campaign." />}
      />
    </>
  )
}

/* --------------------------- Create a broadcast --------------------------- */
export function BroadcastCreate() {
  useDocumentTitle('New broadcast — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const { data: lists } = useAdminList('email/lists', { limit: 100 })
  const save = useAdminSave('email/broadcasts')

  const submit = (e, status) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget.form || e.currentTarget)
    const f = Object.fromEntries(form)
    const list = (lists?.items || []).find((l) => l._id === f.sendToListId)
    save.mutate(
      { ...f, sendToListName: list?.name, status },
      {
        onSuccess: () => {
          toast.show(status === 'sent' ? 'Broadcast queued ✓' : 'Draft saved ✓')
          navigate('/admin/email/broadcasts')
        },
        onError: (err) => toast.show(apiError(err)),
      },
    )
  }

  return (
    <>
      {toast.node}
      <PageHead
        title="New broadcast"
        breadcrumb={[{ label: 'Broadcasts', to: '/admin/email/broadcasts' }, { label: 'New' }]}
      />

      <form
        id="broadcast-form"
        onSubmit={(e) => submit(e, 'draft')}
        className="grid grid-cols-[1.4fr_0.8fr] gap-5 mx-1100:grid-cols-1"
      >
        <Panel title="Content" bodyClass="grid gap-4 p-5">
          <TextField name="subject" label="Subject line" required />
          <TextField name="fromName" label="From name" defaultValue="Growth Scholar" />
          <TextAreaField name="body" label="Email body" rows={12} />
        </Panel>

        <div className="grid content-start gap-5">
          <Panel title="Audience">
            <SelectField
              name="sendToListId"
              label="Send to list"
              options={(lists?.items || []).map((l) => ({
                value: l._id,
                label: `${l.name} (${l.contactCount})`,
              }))}
            />
          </Panel>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" disabled={save.isPending}>
              Save draft
            </Button>
            <Button type="button" onClick={(e) => submit(e, 'sent')} disabled={save.isPending}>
              Send now
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}

/* --------------------------------- Lists ---------------------------------- */
export function EmailLists() {
  useDocumentTitle('Email lists — Growth Scholar Admin')
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const { data, isPending } = useAdminList('email/lists', { limit: 200 })
  const save = useAdminSave('email/lists')
  const remove = useAdminDelete('email/lists')

  return (
    <>
      {toast.node}
      <PageHead
        title="Email Lists"
        sub="Segments you send to"
        actions={<Button onClick={() => setAdding(true)}>+ New list</Button>}
      />

      <DataTable
        loading={isPending}
        rows={data?.items || []}
        searchPlaceholder="Search lists…"
        columns={[
          { key: 'name', label: 'List' },
          { key: 'contactCount', label: 'Contacts' },
          {
            key: 'updatedAt',
            label: 'Updated',
            render: (r) =>
              new Date(r.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
          },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) => (
              <button
                type="button"
                onClick={() =>
                  remove.mutate(r._id, { onSuccess: () => toast.show('List deleted') })
                }
                className="text-[0.8rem] font-semibold text-danger-admin hover:underline"
              >
                Delete
              </button>
            ),
          },
        ]}
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="New list"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button form="new-list" type="submit">
              Create
            </Button>
          </>
        }
      >
        <form
          id="new-list"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(Object.fromEntries(new FormData(e.currentTarget)), {
              onSuccess: () => {
                setAdding(false)
                toast.show('List created ✓')
              },
            })
          }}
        >
          <TextField name="name" label="List name" required />
          <TextField name="description" label="Description" />
        </form>
      </Modal>
    </>
  )
}

/* -------------------------------- Contacts -------------------------------- */
export function EmailContacts() {
  useDocumentTitle('Contacts — Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

  const { data, isPending } = useAdminList('email/contacts', { limit: 500 })
  const { data: lists } = useAdminList('email/lists', { limit: 100 })
  const save = useAdminSave('email/contacts')
  const remove = useAdminDelete('email/contacts')

  const importCsv = useMutation({
    mutationFn: async (formData) =>
      (
        await api.post('/admin/email/contacts/import', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      ).data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setImporting(false)
      toast.show(`Imported ${res.created} new, updated ${res.updated}`)
    },
    onError: (err) => toast.show(apiError(err)),
  })

  return (
    <>
      {toast.node}
      <PageHead
        title="All Contacts"
        sub="Everyone who can receive email"
        actions={
          <>
            <Button variant="outline" onClick={() => setImporting(true)}>
              Import CSV
            </Button>
            <Button onClick={() => setAdding(true)}>+ Add contact</Button>
          </>
        }
      />

      <DataTable
        loading={isPending}
        rows={data?.items || []}
        searchPlaceholder="Search contacts…"
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          {
            key: 'lists',
            label: 'Lists',
            value: (r) => r.listIds?.map((l) => l.name).join(', ') || '—',
          },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
          {
            key: 'joinedAt',
            label: 'Joined',
            render: (r) =>
              new Date(r.joinedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
          },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) => (
              <button
                type="button"
                onClick={() =>
                  remove.mutate(r._id, { onSuccess: () => toast.show('Contact removed') })
                }
                className="text-[0.8rem] font-semibold text-danger-admin hover:underline"
              >
                Delete
              </button>
            ),
          },
        ]}
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add contact"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button form="add-contact" type="submit">
              Add
            </Button>
          </>
        }
      >
        <form
          id="add-contact"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const f = Object.fromEntries(new FormData(e.currentTarget))
            save.mutate(
              { ...f, listIds: f.listId ? [f.listId] : [] },
              {
                onSuccess: () => {
                  setAdding(false)
                  toast.show('Contact added ✓')
                },
                onError: (err) => toast.show(apiError(err)),
              },
            )
          }}
        >
          <TextField name="name" label="Name" />
          <TextField name="email" type="email" label="Email" required />
          <SelectField
            name="listId"
            label="Add to list"
            options={(lists?.items || []).map((l) => ({ value: l._id, label: l.name }))}
          />
        </form>
      </Modal>

      <Modal
        open={importing}
        onClose={() => setImporting(false)}
        title="Import contacts from CSV"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImporting(false)}>
              Cancel
            </Button>
            <Button form="import-contacts" type="submit" disabled={importCsv.isPending}>
              {importCsv.isPending ? 'Importing…' : 'Import'}
            </Button>
          </>
        }
      >
        <form
          id="import-contacts"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            importCsv.mutate(new FormData(e.currentTarget))
          }}
        >
          <p className="text-[0.85rem] text-muted-admin">
            The file needs an <code>email</code> column; a <code>name</code> column is optional.
          </p>
          <input type="file" name="file" accept=".csv" required className="text-[0.85rem]" />
          <SelectField
            name="listId"
            label="Add everyone to"
            options={(lists?.items || []).map((l) => ({ value: l._id, label: l.name }))}
          />
        </form>
      </Modal>
    </>
  )
}
