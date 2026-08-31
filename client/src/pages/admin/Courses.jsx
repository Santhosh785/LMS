import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminDelete, useAdminList, useAdminSave } from '../../api/admin.js'
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

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export default function AdminCourses() {
  useDocumentTitle('Courses — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data, isPending } = useAdminList('courses', { limit: 200 })
  /*
   * The admin term list rather than the published one: hiding a topic from the
   * public filters is not the same as retiring it from the editor.
   */
  const { data: topicData } = useAdminList('taxonomy', { taxonomy: 'topic' })
  const topics = topicData?.items || []
  const save = useAdminSave('courses')
  const remove = useAdminDelete('courses')

  const onCreate = (e) => {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget))
    save.mutate(
      { ...form, slug: slugify(form.title), status: 'Draft', amount: Number(form.amount || 0) },
      {
        onSuccess: (course) => {
          setCreating(false)
          toast.show('Course created')
          navigate(`/admin/courses/${course._id}/information`)
        },
        onError: () => toast.show('Could not create the course'),
      },
    )
  }

  return (
    <>
      {toast.node}
      <PageHead
        title="Courses"
        sub="Everything you sell and teach"
        actions={<Button onClick={() => setCreating(true)}>+ New course</Button>}
      />

      <DataTable
        loading={isPending}
        rows={data?.items || []}
        searchPlaceholder="Search courses…"
        onRowClick={(row) => navigate(`/admin/courses/${row._id}/information`)}
        columns={[
          { key: 'title', label: 'Course' },
          {
            key: 'type',
            label: 'Type',
            render: (r) =>
              r.type === 'combo' ? 'Combo' : r.type === 'starter' ? 'Free Starter' : 'Self-paced',
          },
          {
            key: 'durationLabel',
            label: 'Duration',
            render: (r) => r.durationLabel || `${r.hours} Hrs`,
          },
          { key: 'sections', label: 'Modules', value: (r) => r.sections?.length || 0 },
          {
            key: 'amount',
            label: 'Price',
            render: (r) => (r.amount ? `₹${r.amount.toLocaleString('en-IN')}` : 'Free'),
          },
          { key: 'enrolledCount', label: 'Enrolled' },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete(r)
                }}
                className="text-[0.8rem] font-semibold text-danger-admin hover:underline"
              >
                Delete
              </button>
            ),
          },
        ]}
      />

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create a course"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button form="new-course" type="submit" disabled={save.isPending}>
              {save.isPending ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <form id="new-course" onSubmit={onCreate} className="grid gap-4">
          <TextField name="title" label="Course title" required />
          {/*
            From the Term registry, so adding or renaming a topic under
            Taxonomy shows up here without a deploy. This list was hardcoded and
            had already drifted from the eight topics the catalogue actually
            filters on.
          */}
          <SelectField
            name="topic"
            label="Topic"
            defaultValue={topics[0]?.name || ''}
            options={topics.map((t) => ({ value: t.name, label: t.name }))}
            hint={
              topics.length
                ? 'Managed under Taxonomy → Course topics.'
                : 'No topics yet — add them under Taxonomy first.'
            }
          />
          <SelectField
            name="type"
            label="Course type"
            defaultValue="self"
            options={[
              { value: 'self', label: 'Self-Paced' },
              { value: 'combo', label: 'Combo' },
              { value: 'starter', label: 'Free Starter' },
            ]}
          />
          {/*
            The paid/free flag was missing here entirely, so every course was
            created "paid" whatever the amount said — and a ₹0 course never
            appeared under the homepage's Free Courses tab. The server keeps the
            two consistent; this makes the choice explicit at creation.
          */}
          <SelectField
            name="price"
            label="Pricing"
            defaultValue="paid"
            options={[
              { value: 'paid', label: 'Paid' },
              { value: 'free', label: 'Free' },
            ]}
          />
          <TextField
            name="amount"
            type="number"
            min="0"
            label="Price (₹)"
            defaultValue={0}
            hint="Leave at 0 for a free course."
          />
        </form>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete course"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(confirmDelete._id, {
                  onSuccess: () => {
                    setConfirmDelete(null)
                    toast.show('Course deleted')
                  },
                })
              }
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[0.9rem] text-muted-admin">
          Delete <strong className="text-brand-deep">{confirmDelete?.title}</strong>? Its curriculum
          and pricing go with it. Enrollment records are kept.
        </p>
      </Modal>
    </>
  )
}
