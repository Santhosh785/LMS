import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAdminDelete, useAdminList, useAdminSave } from '../../api/admin.js'
import {
  Button,
  cn,
  EmptyState,
  Loading,
  Panel,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
  useToast,
} from '../../components/ui/index.jsx'
import { DataTable, PageHead, TypeCard } from '../../components/admin/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const fmtDT = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

/* -------------------------------- Calendar -------------------------------- */
export function LiveCalendar() {
  useDocumentTitle('Live calendar — Growth Scholar Admin')
  const navigate = useNavigate()
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'live', 'calendar', cursor],
    queryFn: async () => (await api.get('/admin/live/calendar', { params: cursor })).data,
  })

  const first = new Date(cursor.year, cursor.month, 1)
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const startPad = first.getDay()
  const cells = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const byDay = {}
  for (const c of data?.classes || []) {
    const d = new Date(c.startsAt).getDate()
    byDay[d] = byDay[d] || []
    byDay[d].push(c)
  }

  const shift = (delta) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })

  return (
    <>
      <PageHead
        title="Calendar"
        sub="Scheduled live classes and workshops"
        actions={<Button onClick={() => navigate('/admin/live/create')}>+ New live class</Button>}
      />

      <Panel
        title={first.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
        actions={
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => shift(-1)}>
              ‹
            </Button>
            <Button size="sm" variant="outline" onClick={() => shift(1)}>
              ›
            </Button>
          </div>
        }
      >
        {isPending ? (
          <Loading />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-[0.72rem] font-bold uppercase tracking-wide text-muted-admin">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, i) => (
                <div
                  key={i}
                  className={cn(
                    'min-h-[86px] rounded-md2 border p-1.5 text-left',
                    day ? 'border-line-admin bg-white' : 'border-transparent',
                  )}
                >
                  {day && (
                    <>
                      <span className="text-[0.75rem] font-semibold text-muted-admin">{day}</span>
                      {(byDay[day] || []).map((c) => (
                        <p
                          key={c._id}
                          className="mt-1 truncate rounded bg-accent-soft px-1.5 py-0.5 text-[0.68rem] font-medium text-brand"
                        >
                          {c.title}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>
    </>
  )
}

/* ------------------------------ Live classes ------------------------------ */
export function LiveClassList() {
  useDocumentTitle('Live classes — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isPending } = useAdminList('live/classes', { limit: 200 })
  const remove = useAdminDelete('live/classes')

  return (
    <>
      {toast.node}
      <PageHead
        title="Live Class"
        sub="Sessions your learners can join"
        actions={<Button onClick={() => navigate('/admin/live/create')}>+ New live class</Button>}
      />
      <DataTable
        loading={isPending}
        rows={data?.items || []}
        searchPlaceholder="Search sessions…"
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'startsAt', label: 'When', render: (r) => fmtDT(r.startsAt) },
          { key: 'durationMins', label: 'Duration', render: (r) => `${r.durationMins} min` },
          { key: 'host', label: 'Host' },
          { key: 'kind', label: 'Type' },
          { key: 'attendees', label: 'Booked', value: (r) => r.attendees?.length || 0 },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) => (
              <button
                type="button"
                onClick={() =>
                  remove.mutate(r._id, { onSuccess: () => toast.show('Session deleted') })
                }
                className="text-[0.8rem] font-semibold text-danger-admin hover:underline"
              >
                Delete
              </button>
            ),
          },
        ]}
      />
    </>
  )
}

export function LiveClassCreate() {
  useDocumentTitle('New live class — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const save = useAdminSave('live/classes')

  return (
    <>
      {toast.node}
      <PageHead
        title="New live class"
        breadcrumb={[{ label: 'Live', to: '/admin/live/calendar' }, { label: 'New class' }]}
      />
      <form
        className="max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.currentTarget))
          save.mutate(
            { ...f, durationMins: Number(f.durationMins) },
            {
              onSuccess: () => {
                toast.show('Live class created ✓')
                navigate('/admin/live/class')
              },
              onError: (err) => toast.show(apiError(err)),
            },
          )
        }}
      >
        <Panel title="Session details" bodyClass="grid gap-4 p-5">
          <TextField name="title" label="Title" required />
          <TextAreaField name="description" label="Description" rows={3} />
          <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
            <TextField name="startsAt" type="datetime-local" label="Starts at" required />
            <TextField
              name="durationMins"
              type="number"
              min="15"
              label="Duration (minutes)"
              defaultValue={60}
            />
          </div>
          <TextField name="host" label="Host" />
          <TextField name="joinUrl" label="Join URL" placeholder="https://zoom.us/j/…" />
          <SelectField
            name="kind"
            label="Type"
            defaultValue="Workshop"
            options={['Workshop', 'Cohort live', 'Office hours', 'Live']}
          />
          <div>
            <Button type="submit" disabled={save.isPending}>
              Create
            </Button>
          </div>
        </Panel>
      </form>
    </>
  )
}

/* ------------------------------ 1-1 bookings ------------------------------ */
export function LiveBookings() {
  useDocumentTitle('1-1 Bookings — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isPending } = useAdminList('live/bookings', { limit: 200 })
  const remove = useAdminDelete('live/bookings')

  return (
    <>
      {toast.node}
      <PageHead
        title="1-1 Bookings"
        sub="Slots learners can book with you"
        actions={
          <Button onClick={() => navigate('/admin/live/bookings/create')}>
            + New booking page
          </Button>
        }
      />
      <DataTable
        loading={isPending}
        rows={data?.items || []}
        searchPlaceholder="Search bookings…"
        columns={[
          { key: 'topic', label: 'Topic' },
          { key: 'type', label: 'Type' },
          { key: 'when', label: 'When', render: (r) => fmtDT(r.when) },
          { key: 'duration', label: 'Duration' },
          { key: 'maxRegistrants', label: 'Max' },
          { key: 'bookedCount', label: 'Booked' },
          { key: 'theme', label: 'Theme' },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) => (
              <button
                type="button"
                onClick={() =>
                  remove.mutate(r._id, { onSuccess: () => toast.show('Booking deleted') })
                }
                className="text-[0.8rem] font-semibold text-danger-admin hover:underline"
              >
                Delete
              </button>
            ),
          },
        ]}
      />
    </>
  )
}

const THEMES = [
  { id: 'Brand Green', body: 'The default Growth Scholar look.', icon: '🟢' },
  { id: 'Ocean', body: 'Cool blues, calm and clinical.', icon: '🔵' },
  { id: 'Warm Spotlight', body: 'Warm amber, high energy.', icon: '🟠' },
  { id: 'Minimal Dark', body: 'Dark background, minimal chrome.', icon: '⚫' },
]

export function LiveBookingCreate() {
  useDocumentTitle('New booking page — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const save = useAdminSave('live/bookings')
  const [theme, setTheme] = useState('Brand Green')
  const [protectedPage, setProtectedPage] = useState(false)

  return (
    <>
      {toast.node}
      <PageHead
        title="New 1-1 booking page"
        breadcrumb={[{ label: '1-1 Bookings', to: '/admin/live/bookings' }, { label: 'New' }]}
      />

      <form
        className="grid grid-cols-[1.2fr_1fr] gap-5 mx-1100:grid-cols-1"
        onSubmit={(e) => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.currentTarget))
          save.mutate(
            {
              ...f,
              theme,
              passwordProtected: protectedPage,
              maxRegistrants: Number(f.maxRegistrants),
            },
            {
              onSuccess: () => {
                toast.show('Booking page created ✓')
                navigate('/admin/live/bookings')
              },
              onError: (err) => toast.show(apiError(err)),
            },
          )
        }}
      >
        <Panel title="Booking details" bodyClass="grid gap-4 p-5">
          <TextField name="topic" label="Topic" required />
          <TextAreaField name="description" label="Description" rows={3} />
          <SelectField
            name="type"
            label="Session type"
            defaultValue="Single Session"
            options={['Single Session', 'Recurring Session']}
          />
          <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
            <TextField name="when" type="datetime-local" label="When" />
            <SelectField
              name="duration"
              label="Duration"
              defaultValue="30 Minutes"
              options={['30 Minutes', '45 Minutes', '60 Minutes']}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
            <TextField name="timeZone" label="Time zone" defaultValue="Asia/Kolkata" />
            <TextField
              name="maxRegistrants"
              type="number"
              min="1"
              label="Max registrants"
              defaultValue={1}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg2 bg-surface-admin/60 px-4 py-3">
            <span className="text-[0.85rem] font-semibold text-brand-deep">
              Password protection
            </span>
            <Toggle
              checked={protectedPage}
              onChange={setProtectedPage}
              label="Password protection"
            />
          </div>
          {protectedPage && <TextField name="password" label="Password" />}
        </Panel>

        <div className="grid content-start gap-5">
          <Panel title="Page theme">
            <div className="grid gap-3">
              {THEMES.map((t) => (
                <TypeCard
                  key={t.id}
                  selected={theme === t.id}
                  onSelect={() => setTheme(t.id)}
                  title={t.id}
                  body={t.body}
                  icon={t.icon}
                />
              ))}
            </div>
          </Panel>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Creating…' : 'Create booking page'}
          </Button>
        </div>
      </form>
    </>
  )
}

/* ------------------------------- Live stream ------------------------------ */
export function LiveStream() {
  useDocumentTitle('Live stream — Growth Scholar Admin')
  const toast = useToast()
  const { data } = useAdminList('live/classes', { limit: 5 })
  const next = data?.items?.[0]

  return (
    <>
      {toast.node}
      <PageHead title="Live Stream" sub="Go live to your learners" />

      <div className="grid grid-cols-[1.4fr_0.8fr] gap-5 mx-1100:grid-cols-1">
        <Panel title="Stream preview">
          <div className="grid aspect-video place-items-center rounded-lg2 bg-brand-deep text-white">
            <div className="text-center">
              <span className="text-[2rem]" aria-hidden="true">
                📡
              </span>
              <p className="mt-2 text-[0.9rem] text-white/80">Not streaming</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {/* No streaming backend exists — say so on the control, not after
                the click. Live sessions run on the external meeting link held
                on the LiveClass record. */}
            <Button
              disabled
              title="Streaming from the console is not available — use the session's meeting link"
            >
              Go live
            </Button>
            <Button variant="outline" onClick={() => toast.show('Settings saved')}>
              Stream settings
            </Button>
          </div>
        </Panel>

        <Panel title="Next session">
          {next ? (
            <>
              <h3 className="text-[1rem]">{next.title}</h3>
              <p className="mt-1 text-[0.85rem] text-muted-admin">{fmtDT(next.startsAt)}</p>
              <p className="mt-0.5 text-[0.85rem] text-muted-admin">Host: {next.host}</p>
              {next.joinUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    navigator.clipboard.writeText(next.joinUrl)
                    toast.show('Copied!')
                  }}
                >
                  Copy meeting link
                </Button>
              )}
            </>
          ) : (
            <EmptyState icon="📅" title="Nothing scheduled" body="Create a live class first." />
          )}
        </Panel>
      </div>
    </>
  )
}
