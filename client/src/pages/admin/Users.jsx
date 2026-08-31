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
  TextField,
  useToast,
} from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import { useAuth } from '../../context/AuthContext.jsx'

/**
 * User management.
 *
 * There was no way to see or act on an account before this: no list, no role
 * change, no suspension, and admins existed only via a CLI seeder. The server
 * refuses to let anyone demote or suspend themselves, or to remove the last
 * active admin; this screen mirrors that so the controls are not merely dead.
 */

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

export default function Users() {
  useDocumentTitle('Users | Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const { user: me } = useAuth()

  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null)
  const [suspending, setSuspending] = useState(null)
  const [reason, setReason] = useState('')

  const params = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
  }

  const list = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: async () => (await api.get('/admin/users', { params })).data,
  })

  const detail = useQuery({
    queryKey: ['admin', 'users', openId],
    queryFn: async () => (await api.get(`/admin/users/${openId}`)).data,
    enabled: Boolean(openId),
  })

  const refresh = (msg) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    if (msg) toast.show(msg)
  }

  const act = useMutation({
    mutationFn: async ({ id, path, method = 'post', body }) =>
      (await api[method](`/admin/users/${id}${path}`, body)).data,
    onSuccess: (data, vars) => {
      setSuspending(null)
      setReason('')
      if (vars.path === '/send-reset') {
        return toast.show(
          data?.delivered
            ? 'Reset link sent'
            : 'Reset link generated — no mail transport is configured, so check the server log',
        )
      }
      refresh('Done')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const isMe = (u) => String(u._id) === String(me?._id)
  const lastAdmin = (u) => u.role === 'admin' && (list.data?.activeAdmins ?? 0) <= 1

  const columns = [
    {
      key: 'name',
      label: 'User',
      render: (u) => (
        <div>
          <p className="font-semibold text-ink">
            {u.name} {isMe(u) && <span className="text-[0.75rem] text-muted">(you)</span>}
          </p>
          <p className="text-[0.8rem] text-muted">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (u) => <Pill tone={u.role === 'admin' ? 'ok' : 'neutral'}>{u.role}</Pill>,
    },
    {
      key: 'suspendedAt',
      label: 'Status',
      render: (u) =>
        u.suspendedAt ? (
          <Pill tone="live">Suspended</Pill>
        ) : (
          <span className="text-[0.85rem] text-muted">Active</span>
        ),
    },
    { key: 'createdAt', label: 'Joined', render: (u) => fmt(u.createdAt) },
    {
      key: 'actions',
      label: '',
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setOpenId(u._id)}>
            Open
          </Button>
          {u.suspendedAt ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => act.mutate({ id: u._id, path: '/reactivate' })}
            >
              Reactivate
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={isMe(u) || lastAdmin(u)}
              title={
                isMe(u)
                  ? 'You cannot suspend yourself'
                  : lastAdmin(u)
                    ? 'The only active admin cannot be suspended'
                    : undefined
              }
              onClick={() => setSuspending(u)}
            >
              Suspend
            </Button>
          )}
        </div>
      ),
    },
  ]

  const u = detail.data?.user

  return (
    <>
      {toast.node}
      <PageHead
        title="Users"
        sub="Everyone with an account — learners and admins."
        actions={
          <Button
            variant="outline"
            onClick={() => downloadCsv(`users/export?${new URLSearchParams(params)}`, 'users.csv')}
          >
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SelectField
          label=""
          aria-label="Filter by role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={[
            { value: '', label: 'All roles' },
            { value: 'student', label: 'Students' },
            { value: 'admin', label: 'Admins' },
          ]}
        />
        <SelectField
          label=""
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: '', label: 'Any status' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          aria-label="Search users"
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
          empty="No accounts match those filters."
        />
      )}

      {/* ------------------------------ detail ------------------------------ */}
      <Modal
        open={Boolean(openId)}
        onClose={() => setOpenId(null)}
        title={u?.name || 'User'}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => act.mutate({ id: openId, path: '/send-reset' })}>
              Send password reset
            </Button>
            <Button variant="outline" onClick={() => setOpenId(null)}>
              Close
            </Button>
          </>
        }
      >
        {detail.isPending || !u ? (
          <Loading />
        ) : (
          <div className="grid gap-4">
            {u.suspendedAt && (
              <p className="rounded-md2 bg-[#fee2e2] px-3 py-2 text-[0.88rem] text-danger">
                Suspended {fmt(u.suspendedAt)}
                {u.suspendedReason ? ` — ${u.suspendedReason}` : ''}. They are signed out
                immediately and cannot sign back in.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mx-640:grid-cols-1">
              <TextField
                label="Name"
                defaultValue={u.name}
                onBlur={(e) =>
                  e.target.value !== u.name &&
                  act.mutate({ id: u._id, path: '', method: 'put', body: { name: e.target.value } })
                }
              />
              <TextField
                label="Email"
                defaultValue={u.email}
                onBlur={(e) =>
                  e.target.value !== u.email &&
                  act.mutate({
                    id: u._id,
                    path: '',
                    method: 'put',
                    body: { email: e.target.value },
                  })
                }
              />
              <TextField
                label="Phone"
                defaultValue={u.phone || ''}
                onBlur={(e) =>
                  act.mutate({
                    id: u._id,
                    path: '',
                    method: 'put',
                    body: { phone: e.target.value },
                  })
                }
              />
              <SelectField
                label="Role"
                value={u.role}
                disabled={isMe(u)}
                hint={isMe(u) ? 'You cannot change your own role.' : undefined}
                onChange={(e) =>
                  act.mutate({ id: u._id, path: '', method: 'put', body: { role: e.target.value } })
                }
                options={[
                  { value: 'student', label: 'Student' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>

            <div>
              <h4 className="mb-2 text-[0.95rem]">Enrolments</h4>
              {(detail.data.enrollments || []).length === 0 ? (
                <p className="text-[0.85rem] text-muted">None.</p>
              ) : (
                <ul className="grid gap-1.5 text-[0.88rem]">
                  {detail.data.enrollments.map((e) => (
                    <li
                      key={e._id}
                      className="flex justify-between rounded-md2 border border-line px-3 py-2"
                    >
                      <span>{e.courseId?.title || 'Course removed'}</span>
                      <span className={cn('text-muted', e.status === 'Completed' && 'text-brand')}>
                        {e.progress ?? 0}% · {e.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-[0.95rem]">Payments</h4>
              {(detail.data.transactions || []).length === 0 ? (
                <p className="text-[0.85rem] text-muted">None.</p>
              ) : (
                <ul className="grid gap-1.5 text-[0.88rem]">
                  {detail.data.transactions.map((t) => (
                    <li
                      key={t._id}
                      className="flex justify-between rounded-md2 border border-line px-3 py-2"
                    >
                      <span>
                        {t.invoiceNo || '—'} · {fmt(t.createdAt)}
                      </span>
                      <span className="tabular-nums">
                        ₹{Number(t.amount || 0).toLocaleString('en-IN')} · {t.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ----------------------------- suspend ------------------------------ */}
      <Modal
        open={Boolean(suspending)}
        onClose={() => setSuspending(null)}
        title={`Suspend ${suspending?.name || ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setSuspending(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => act.mutate({ id: suspending._id, path: '/suspend', body: { reason } })}
            >
              Suspend
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <p className="text-[0.9rem] text-muted">
            They are signed out on their next request and cannot sign back in. Enrolments and
            payment history are kept — nothing is deleted.
          </p>
          <TextField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            hint="Shown to admins on this account, not to the user."
          />
        </div>
      </Modal>
    </>
  )
}
