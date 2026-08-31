import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import {
  useAdminDelete,
  useAdminList,
  useAdminOne,
  useAdminSave,
  downloadCsv,
} from '../../api/admin.js'
import {
  Button,
  EmptyState,
  Loading,
  Panel,
  SelectField,
  StatusPill,
  TextAreaField,
  TextField,
  Toggle,
  useToast,
} from '../../components/ui/index.jsx'
import {
  DataTable,
  KpiRow,
  PageHead,
  StatCard,
  SubNavTabs,
  TypeCard,
} from '../../components/admin/index.jsx'
import { funnelTabs } from '../../data/nav.js'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

/* ------------------------------ All funnels ------------------------------- */
export function FunnelsList() {
  useDocumentTitle('Funnels — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isPending } = useAdminList('funnels', { limit: 200 })
  const remove = useAdminDelete('funnels')

  return (
    <>
      {toast.node}
      <PageHead
        title="Marketing Funnels"
        sub="Landing pages & steps"
        actions={
          <Button onClick={() => navigate('/admin/funnels/create')}>+ Create new funnel</Button>
        }
      />

      {isPending ? (
        <Loading />
      ) : (data?.items || []).length === 0 ? (
        <EmptyState
          icon="↘"
          title="No funnels yet"
          body="Build a lead magnet, video series or survey funnel."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4 mx-1100:grid-cols-2 mx-640:grid-cols-1">
          {data.items.map((f) => (
            <article
              key={f._id}
              className="rounded-lg2 border border-line-admin bg-white p-5 shadow-admin"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[1.02rem]">{f.name}</h3>
                <StatusPill status={f.status} />
              </div>
              <p className="mt-1 text-[0.8rem] text-muted-admin">{f.template}</p>
              <p className="mt-3 text-[1.4rem] font-black text-brand-deep">
                {f.leadCount}{' '}
                <span className="text-[0.8rem] font-medium text-muted-admin">Leads</span>
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" to={`/admin/funnels/${f._id}/overview`}>
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    remove.mutate(f._id, { onSuccess: () => toast.show('Funnel deleted') })
                  }
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

/* ----------------------------- Create funnel ------------------------------ */
export function FunnelCreate() {
  useDocumentTitle('Create funnel — Growth Scholar Admin')
  const navigate = useNavigate()
  const toast = useToast()
  const save = useAdminSave('funnels')
  const [template, setTemplate] = useState('Lead Magnet')

  return (
    <>
      {toast.node}
      <PageHead
        title="Create a funnel"
        breadcrumb={[{ label: 'Funnels', to: '/admin/funnels' }, { label: 'Create' }]}
      />

      <form
        className="grid grid-cols-[1fr_1fr] gap-5 mx-960:grid-cols-1"
        onSubmit={(e) => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.currentTarget))
          save.mutate(
            {
              ...f,
              template,
              status: 'Draft',
              slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            },
            {
              onSuccess: (funnel) => {
                toast.show('Funnel created ✓')
                navigate(`/admin/funnels/${funnel._id}/steps`)
              },
              onError: (err) => toast.show(apiError(err)),
            },
          )
        }}
      >
        <Panel title="Pick a template">
          <div className="grid gap-3">
            {[
              {
                id: 'Lead Magnet',
                title: 'Lead Magnet',
                body: 'Optin → thank you → nurture.',
                icon: '🧲',
              },
              {
                id: 'Video Series',
                title: 'Video Series',
                body: 'Multi-step video sequence to an offer.',
                icon: '🎬',
              },
              {
                id: 'Survey Funnel',
                title: 'Survey Funnel',
                body: 'Qualify leads, then route them.',
                icon: '📋',
              },
            ].map((t) => (
              <TypeCard
                key={t.id}
                selected={template === t.id}
                onSelect={() => setTemplate(t.id)}
                {...t}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Details" bodyClass="grid gap-4 p-5">
          <TextField name="name" label="Funnel name" required />
          <TextField name="domain" label="Domain" defaultValue="growthscholar.in" />
          <TextAreaField name="description" label="Description" rows={4} />
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Creating…' : 'Create funnel'}
          </Button>
        </Panel>
      </form>
    </>
  )
}

/* --------------------------- Funnel shell + tabs -------------------------- */
export function FunnelEditor() {
  const { id } = useParams()
  const { data: funnel, isPending } = useAdminOne('funnels', id)
  useDocumentTitle(
    funnel ? `${funnel.name} — Growth Scholar Admin` : 'Funnel — Growth Scholar Admin',
  )

  if (isPending) return <Loading />
  if (!funnel) return <p className="py-16 text-center text-muted-admin">Funnel not found.</p>

  return (
    <>
      <PageHead
        title={funnel.name}
        sub={funnel.template}
        breadcrumb={[{ label: 'Funnels', to: '/admin/funnels' }, { label: funnel.name }]}
        actions={<StatusPill status={funnel.status} />}
      />
      <SubNavTabs tabs={funnelTabs(id)} />
      <Outlet context={funnel} />
    </>
  )
}

export function FunnelOverview() {
  const { id } = useParams()
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'funnels', id, 'overview'],
    queryFn: async () => (await api.get(`/admin/funnels/${id}/overview`)).data,
  })

  if (isPending) return <Loading />

  return (
    <>
      <KpiRow>
        <StatCard label="Total leads" value={data.leadCount} sub="All time" />
        <StatCard label="New" value={data.byStatus.New || 0} sub="Awaiting nurture" />
        <StatCard label="Purchased" value={data.byStatus.Purchased || 0} sub="Converted" />
        <StatCard label="Steps" value={data.steps.length} sub="In this funnel" />
      </KpiRow>

      <Panel title="Step performance">
        <FunnelShape steps={data.steps} />
      </Panel>
    </>
  )
}

/** The funnel-shaped step visualisation from admin/funnel-steps.html. */
function FunnelShape({ steps }) {
  if (!steps.length)
    return (
      <EmptyState
        icon="↘"
        title="No steps yet"
        body="Add the first step on the Funnel Steps tab."
      />
    )
  const max = Math.max(...steps.map((s) => s.uniqueVisitors), 1)

  return (
    <div className="grid gap-2">
      {steps.map((step, i) => {
        const width = 45 + (step.uniqueVisitors / max) * 55
        return (
          <div key={step._id || i}>
            <div
              className="mx-auto rounded-lg2 border border-line-admin bg-surface-admin/60 p-4 transition-all"
              style={{ width: `${width}%` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[0.95rem]">{step.name}</h4>
                <span className="text-[0.78rem] text-muted-admin">{step.url}</span>
              </div>
              <p className="mt-1 flex gap-4 text-[0.78rem] text-muted-admin">
                <span>
                  Unique Visitors:{' '}
                  <strong className="text-brand-deep">{step.uniqueVisitors}</strong>
                </span>
                <span>
                  Total Views: <strong className="text-brand-deep">{step.totalViews}</strong>
                </span>
              </p>
            </div>
            {i < steps.length - 1 && (
              <p className="py-1 text-center text-[0.8rem] font-semibold text-accent-mid">
                ↓ {step.conversionPct}%
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function FunnelDetails() {
  const funnel = useOutletContext()
  const save = useAdminSave('funnels')
  const toast = useToast()

  return (
    <>
      {toast.node}
      <form
        className="max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(
            { id: funnel._id, ...Object.fromEntries(new FormData(e.currentTarget)) },
            { onSuccess: () => toast.show('Saved ✓'), onError: (err) => toast.show(apiError(err)) },
          )
        }}
      >
        <Panel title="Funnel details" bodyClass="grid gap-4 p-5">
          <TextField name="name" label="Name" defaultValue={funnel.name} required />
          <TextField name="domain" label="Domain" defaultValue={funnel.domain || ''} />
          <SelectField
            name="template"
            label="Template"
            defaultValue={funnel.template}
            options={['Lead Magnet', 'Video Series', 'Survey Funnel']}
          />
          <SelectField
            name="status"
            label="Status"
            defaultValue={funnel.status}
            options={['Live', 'Draft', 'Paused']}
          />
          <TextAreaField
            name="description"
            label="Description"
            rows={4}
            defaultValue={funnel.description || ''}
          />
          <div>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </div>
        </Panel>
      </form>
    </>
  )
}

export function FunnelSteps() {
  const { id } = useParams()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [steps, setSteps] = useState([])

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'funnels', id, 'steps'],
    queryFn: async () => (await api.get(`/admin/funnels/${id}/steps`)).data,
  })

  useEffect(() => {
    if (data?.items) setSteps(data.items)
  }, [data])

  const save = useMutation({
    mutationFn: async () => (await api.put(`/admin/funnels/${id}/steps`, { steps })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.show('Steps saved ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  if (isPending) return <Loading />

  const patch = (i, p) => setSteps((prev) => prev.map((s, x) => (x === i ? { ...s, ...p } : s)))

  return (
    <>
      {toast.node}
      <Panel
        title="Funnel steps"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setSteps((p) => [
                  ...p,
                  {
                    name: `Step ${p.length + 1}`,
                    url: '',
                    uniqueVisitors: 0,
                    totalViews: 0,
                    conversionPct: 0,
                  },
                ])
              }
            >
              + Add step
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </div>
        }
      >
        {steps.length === 0 ? (
          <EmptyState icon="↘" title="No steps yet" body="Add an optin page to get started." />
        ) : (
          <div className="grid gap-3">
            {steps.map((s, i) => (
              <div
                key={s._id || i}
                className="grid grid-cols-[1fr_1.4fr_110px_110px_110px_auto] items-end gap-3 rounded-lg2 border border-line-admin p-4 mx-1100:grid-cols-1"
              >
                <TextField
                  label="Name"
                  value={s.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
                <TextField
                  label="URL"
                  value={s.url || ''}
                  onChange={(e) => patch(i, { url: e.target.value })}
                />
                <TextField
                  label="Unique"
                  type="number"
                  value={s.uniqueVisitors}
                  onChange={(e) => patch(i, { uniqueVisitors: Number(e.target.value) })}
                />
                <TextField
                  label="Views"
                  type="number"
                  value={s.totalViews}
                  onChange={(e) => patch(i, { totalViews: Number(e.target.value) })}
                />
                <TextField
                  label="Conv %"
                  type="number"
                  step="0.01"
                  value={s.conversionPct}
                  onChange={(e) => patch(i, { conversionPct: Number(e.target.value) })}
                />
                <button
                  type="button"
                  onClick={() => setSteps((p) => p.filter((_, x) => x !== i))}
                  className="pb-2 text-danger-admin"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="mt-5">
        <Panel title="Preview">
          <FunnelShape steps={steps} />
        </Panel>
      </div>
    </>
  )
}

export function FunnelLeads() {
  const { id } = useParams()
  const scoped = !!id
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'funnels', id || 'all', 'leads'],
    queryFn: async () =>
      (await api.get(scoped ? `/admin/funnels/${id}/leads` : '/admin/funnels/leads')).data,
  })

  useDocumentTitle('Funnel leads — Growth Scholar Admin')

  return (
    <>
      {!scoped && <PageHead title="Leads" sub="Everyone captured across your funnels" />}
      <DataTable
        loading={isPending}
        rows={data?.items || []}
        searchPlaceholder="Search leads…"
        toolbar={
          scoped ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadCsv(`funnels/${id}/leads/export`, 'funnel-leads.csv')}
            >
              Export CSV
            </Button>
          ) : null
        }
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          ...(scoped
            ? []
            : [{ key: 'funnel', label: 'Funnel', value: (r) => r.funnelId?.name || '—' }]),
          { key: 'sourceStep', label: 'Source step' },
          { key: 'date', label: 'Date', render: (r) => fmt(r.date) },
          { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
        ]}
        empty={
          <EmptyState
            icon="🧲"
            title="No leads yet"
            body="They appear here as soon as the funnel captures one."
          />
        }
      />
    </>
  )
}

export function FunnelAutomation() {
  const funnel = useOutletContext()
  const { id } = useParams()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [rules, setRules] = useState(funnel.automationRules || [])

  const save = useMutation({
    mutationFn: async () =>
      (await api.put(`/admin/funnels/${id}/automation`, { automationRules: rules })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.show('Automation saved ✓')
    },
  })

  const patch = (i, p) => setRules((prev) => prev.map((r, x) => (x === i ? { ...r, ...p } : r)))

  return (
    <>
      {toast.node}
      <Panel
        title="Automation"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setRules((p) => [
                  ...p,
                  {
                    trigger: 'On optin',
                    action: 'Send email sequence',
                    delay: 'Immediate',
                    enabled: true,
                  },
                ])
              }
            >
              + Add rule
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </div>
        }
      >
        {rules.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="No automation yet"
            body="React to optins and purchases automatically."
          />
        ) : (
          <div className="grid gap-3">
            {rules.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_160px_auto_auto] items-end gap-3 rounded-lg2 border border-line-admin p-4 mx-960:grid-cols-1"
              >
                <SelectField
                  label="When"
                  value={r.trigger}
                  onChange={(e) => patch(i, { trigger: e.target.value })}
                  options={['On optin', 'On purchase', 'On step view']}
                />
                <SelectField
                  label="Then"
                  value={r.action}
                  onChange={(e) => patch(i, { action: e.target.value })}
                  options={['Send email sequence', 'Add tag', 'Webhook']}
                />
                <TextField
                  label="Delay"
                  value={r.delay}
                  onChange={(e) => patch(i, { delay: e.target.value })}
                />
                <div className="pb-2">
                  <Toggle
                    checked={!!r.enabled}
                    onChange={(v) => patch(i, { enabled: v })}
                    label="Rule enabled"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRules((p) => p.filter((_, x) => x !== i))}
                  className="pb-2 text-danger-admin"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}
