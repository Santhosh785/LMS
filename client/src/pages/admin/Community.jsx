import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import {
  Button,
  Modal,
  SelectField,
  StatusPill,
  TextField,
  useToast,
} from '../../components/ui/index.jsx'
import { DataTable, KpiRow, PageHead, StatCard } from '../../components/admin/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const GROUPS = ['Yoda Class Cohort', 'Growth Scholar Hub', 'Group Chats']

const REASON_LABEL = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate: 'Hate speech',
  sexual: 'Sexual content',
  misinformation: 'Misinformation',
  other: 'Other',
}

/**
 * The moderation queue.
 *
 * Sits above the channel management on the same page because it is the part
 * that is time-sensitive: an abusive post left up is a liability, a badly named
 * channel is not. Each row carries the reported text inline, including the
 * excerpt captured at report time, so a post its author deleted the moment it
 * was reported is still reviewable.
 */
function ReportsQueue({ toast }) {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'community', 'reports'],
    queryFn: async () => (await api.get('/admin/community/reports')).data,
  })

  const resolve = useMutation({
    mutationFn: async ({ id, action }) =>
      (await api.post(`/admin/community/reports/${id}/resolve`, { action })).data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community'] })
      toast.show(res.message || 'Done')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const items = data?.items || []
  if (!isPending && !items.length) return null

  return (
    <section className="mb-6 rounded-lg2 border border-warn-admin/40 bg-warn/5 p-5">
      <h2 className="text-[1rem]">
        Reported content{' '}
        <span className="ml-1 rounded-full bg-danger-admin px-2 py-0.5 text-[0.7rem] font-bold text-white">
          {data?.openCount || 0}
        </span>
      </h2>
      <p className="mt-1 text-[0.85rem] text-muted-admin">
        Reviewing one report closes every other report on the same item.
      </p>

      <div className="mt-4 grid gap-3">
        {items.map((r) => (
          <article key={r._id} className="rounded-md2 border border-line-admin bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-[0.78rem] text-muted-admin">
              <span className="rounded-full bg-surface-admin px-2 py-0.5 font-semibold">
                {REASON_LABEL[r.reason] || r.reason}
              </span>
              <span>{r.targetType}</span>
              <span>· by {r.authorId?.name || 'unknown'}</span>
              <span>· reported by {r.reporterId?.name || 'unknown'}</span>
              {r.deleted && (
                <span className="font-semibold text-danger-admin">· already deleted</span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-line text-[0.9rem] leading-relaxed text-ink">
              {r.target?.body || r.excerpt || (
                <em className="text-muted-admin">No content captured</em>
              )}
            </p>
            {r.note && <p className="mt-2 text-[0.82rem] text-muted-admin">Note: {r.note}</p>}
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="danger"
                disabled={resolve.isPending || r.deleted}
                onClick={() => resolve.mutate({ id: r._id, action: 'remove' })}
              >
                Remove content
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: r._id, action: 'dismiss' })}
              >
                Dismiss
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function AdminCommunity() {
  useDocumentTitle('Communities — Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'community'],
    queryFn: async () => (await api.get('/admin/community')).data,
  })

  const create = useMutation({
    mutationFn: async (body) => (await api.post('/admin/community/channels', body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community'] })
      setAdding(false)
      toast.show('Channel created ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const remove = useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/community/channels/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'community'] })
      toast.show('Channel deleted')
    },
  })

  const groups = data?.groups || []
  const channels = data?.channels || []

  return (
    <>
      {toast.node}
      <PageHead
        title="Communities"
        sub="Channels, feed, peer learning"
        actions={<Button onClick={() => setAdding(true)}>+ New channel</Button>}
      />

      <ReportsQueue toast={toast} />

      <KpiRow cols={3}>
        <StatCard label="Groups" value={groups.length} sub="Community spaces" />
        <StatCard label="Channels" value={channels.length} sub="Across all groups" />
        <StatCard
          label="Posts"
          value={groups.reduce((s, g) => s + g.postCount, 0)}
          sub="All time"
        />
      </KpiRow>

      <h2 className="mb-3 text-[1.05rem]">Groups</h2>
      <div className="mb-8">
        <DataTable
          loading={isPending}
          searchable={false}
          rows={groups}
          rowKey={(r) => r.name}
          columns={[
            { key: 'name', label: 'Group' },
            { key: 'memberCount', label: 'Members' },
            { key: 'channelCount', label: 'Channels' },
            { key: 'postCount', label: 'Posts' },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
          ]}
        />
      </div>

      <h2 className="mb-3 text-[1.05rem]">Channels</h2>
      <DataTable
        loading={isPending}
        rows={channels}
        searchPlaceholder="Search channels…"
        columns={[
          { key: 'name', label: 'Channel', render: (r) => `# ${r.name}` },
          { key: 'group', label: 'Group' },
          { key: 'postCount', label: 'Posts' },
          { key: 'members', label: 'Members', value: (r) => r.memberIds?.length || 0 },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) => (
              <button
                type="button"
                onClick={() => remove.mutate(r._id)}
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
        title="New channel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button form="new-channel" type="submit" disabled={create.isPending}>
              Create
            </Button>
          </>
        }
      >
        <form
          id="new-channel"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const f = Object.fromEntries(new FormData(e.currentTarget))
            create.mutate({ ...f, slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') })
          }}
        >
          <TextField name="name" label="Channel name" required />
          <SelectField name="group" label="Group" defaultValue={GROUPS[1]} options={GROUPS} />
          <TextField name="description" label="Description" />
        </form>
      </Modal>
    </>
  )
}
