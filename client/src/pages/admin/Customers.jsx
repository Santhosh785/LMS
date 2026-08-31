import { useState } from 'react'
import { useAdminDelete, useAdminList, useAdminSave, downloadCsv } from '../../api/admin.js'
import { api, apiError } from '../../api/client.js'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Modal,
  SelectField,
  StatusPill,
  TextField,
  useToast,
} from '../../components/ui/index.jsx'
import { DataTable, PageHead } from '../../components/admin/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function AdminCustomers() {
  useDocumentTitle('Customers — Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [enrolling, setEnrolling] = useState(null)

  const { data, isPending } = useAdminList('customers', { limit: 200 })
  const { data: courseData } = useAdminList('courses', { limit: 200 })
  const save = useAdminSave('customers')
  const remove = useAdminDelete('customers')

  const enroll = useMutation({
    mutationFn: async ({ id, courseId }) =>
      (await api.post(`/admin/customers/${id}/enroll`, { courseId })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setEnrolling(null)
      toast.show('Enrolled ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  return (
    <>
      {toast.node}
      <PageHead
        title="Customers"
        sub="Students & buyers"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => downloadCsv('customers/export', 'customers.csv')}
            >
              Export CSV
            </Button>
            <Button onClick={() => setAdding(true)}>+ Add customer</Button>
          </>
        }
      />

      <DataTable
        loading={isPending}
        rows={data?.items || []}
        searchPlaceholder="Search customers…"
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'product', label: 'Product' },
          { key: 'joinedAt', label: 'Joined', render: (r) => fmt(r.joinedAt) },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) => (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEnrolling(r)}
                  className="text-[0.8rem] font-semibold text-brand hover:underline"
                >
                  Enroll
                </button>
                <button
                  type="button"
                  onClick={() =>
                    remove.mutate(r._id, { onSuccess: () => toast.show('Customer removed') })
                  }
                  className="text-[0.8rem] font-semibold text-danger-admin hover:underline"
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add customer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button form="add-customer" type="submit" disabled={save.isPending}>
              Add
            </Button>
          </>
        }
      >
        <form
          id="add-customer"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(Object.fromEntries(new FormData(e.currentTarget)), {
              onSuccess: () => {
                setAdding(false)
                toast.show('Customer added ✓')
              },
              onError: (err) => toast.show(apiError(err)),
            })
          }}
        >
          <TextField name="name" label="Name" required />
          <TextField name="email" type="email" label="Email" required />
          <TextField name="product" label="Product" />
          <SelectField
            name="status"
            label="Status"
            defaultValue="Active"
            options={['Active', 'Trial']}
          />
        </form>
      </Modal>

      <Modal
        open={!!enrolling}
        onClose={() => setEnrolling(null)}
        title={`Enroll ${enrolling?.name || ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEnrolling(null)}>
              Cancel
            </Button>
            <Button form="enroll-customer" type="submit" disabled={enroll.isPending}>
              Enroll
            </Button>
          </>
        }
      >
        <form
          id="enroll-customer"
          onSubmit={(e) => {
            e.preventDefault()
            enroll.mutate({
              id: enrolling._id,
              courseId: new FormData(e.currentTarget).get('courseId'),
            })
          }}
        >
          <SelectField
            name="courseId"
            label="Course"
            options={(courseData?.items || []).map((c) => ({ value: c._id, label: c.title }))}
          />
          <p className="mt-3 text-[0.8rem] text-muted-admin">
            The customer needs a learner account with the same email before they can be enrolled.
          </p>
        </form>
      </Modal>
    </>
  )
}
