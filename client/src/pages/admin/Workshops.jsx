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
  ToggleField,
  useToast,
} from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/**
 * Workshops and their registrants.
 *
 * `POST /api/workshops/:id/register` has been recording sign-ups that no admin
 * screen could read, so people were registering invisibly. This lists them,
 * marks attendance and exports the sheet whoever runs the session needs.
 */

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

export default function Workshops() {
  useDocumentTitle('Workshops | Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [openWorkshop, setOpenWorkshop] = useState(null)

  const summary = useQuery({
    queryKey: ['admin', 'workshops', 'summary'],
    queryFn: async () => (await api.get('/admin/workshops/summary')).data,
  })

  const registrations = useQuery({
    queryKey: ['admin', 'workshops', 'registrations', openWorkshop?._id],
    queryFn: async () =>
      (
        await api.get('/admin/workshops/registrations', {
          params: { workshopId: openWorkshop._id },
        })
      ).data,
    enabled: Boolean(openWorkshop),
  })

  const refresh = (msg) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'workshops'] })
    if (msg) toast.show(msg)
  }

  const mark = useMutation({
    mutationFn: async ({ id, body }) =>
      (await api.put(`/admin/workshops/registrations/${id}`, body)).data,
    onSuccess: () => refresh(),
    onError: (err) => toast.show(apiError(err)),
  })

  const removeRegistration = useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/workshops/registrations/${id}`)).data,
    onSuccess: () => refresh('Registration removed, seat freed'),
    onError: (err) => toast.show(apiError(err)),
  })

  const workshopColumns = [
    {
      key: 'title',
      label: 'Workshop',
      render: (w) => (
        <div>
          <p className="font-semibold text-ink">{w.title}</p>
          <p className="text-[0.8rem] text-muted">
            {fmt(w.startsAt)} · {w.mode === 'offline' ? w.venue || 'Offline' : 'Online'}
          </p>
        </div>
      ),
    },
    {
      key: 'registered',
      label: 'Registered',
      value: (w) => w.registered,
      render: (w) => (
        <span className="tabular-nums">
          {w.registered} / {w.capacity || '∞'}
        </span>
      ),
    },
    {
      key: 'seatsLeft',
      label: 'Seats left',
      value: (w) => w.seatsLeft,
      render: (w) =>
        w.capacity ? (
          <Pill tone={w.seatsLeft === 0 ? 'live' : w.seatsLeft < 5 ? 'warn' : 'neutral'}>
            {w.seatsLeft === 0 ? 'Full' : `${w.seatsLeft} left`}
          </Pill>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'attended',
      label: 'Attended',
      render: (w) => <span className="tabular-nums">{w.attended}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (w) => (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setOpenWorkshop(w)}>
            {w.registered > 0 ? `View ${w.registered}` : 'View'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      {toast.node}
      <PageHead
        title="Workshops"
        sub="Sessions, who registered, and who turned up."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv('workshops/registrations/export', 'workshop-registrations.csv')
            }
          >
            Export all registrations
          </Button>
        }
      />

      {summary.isPending ? (
        <Loading />
      ) : (
        <DataTable
          columns={workshopColumns}
          rows={summary.data?.items || []}
          searchPlaceholder="Search workshops…"
          empty="No workshops yet."
        />
      )}

      <Modal
        open={Boolean(openWorkshop)}
        onClose={() => setOpenWorkshop(null)}
        title={openWorkshop?.title || 'Registrations'}
        width="max-w-3xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  `workshops/registrations/export?workshopId=${openWorkshop._id}`,
                  'registrations.csv',
                )
              }
            >
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => setOpenWorkshop(null)}>
              Close
            </Button>
          </>
        }
      >
        {registrations.isPending ? (
          <Loading />
        ) : (registrations.data?.items || []).length === 0 ? (
          <p className="text-[0.9rem] text-muted">Nobody has registered for this workshop yet.</p>
        ) : (
          <div className="grid gap-2">
            {registrations.data.items.map((r) => (
              <div
                key={r._id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg2 border border-line p-3',
                  r.cancelledAt && 'opacity-60',
                )}
              >
                <div className="min-w-[180px] flex-1">
                  <p className="font-semibold text-ink">{r.name}</p>
                  <p className="text-[0.8rem] text-muted">
                    {r.email || 'No email'} · {r.phone || 'No phone'}
                  </p>
                </div>
                <Pill tone={r.kind === 'account' ? 'ok' : 'neutral'}>
                  {r.kind === 'account' ? 'Account' : 'Guest'}
                </Pill>
                {r.waitlisted && <Pill tone="warn">Waitlist</Pill>}
                <span className="text-[0.78rem] text-muted">{fmt(r.registeredAt)}</span>
                <ToggleField
                  id={`attended-${r._id}`}
                  label="Attended"
                  checked={r.attended}
                  onChange={(v) => mark.mutate({ id: r._id, body: { attended: v } })}
                  className="gap-2"
                />
                <Button size="sm" variant="ghost" onClick={() => removeRegistration.mutate(r._id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  )
}
