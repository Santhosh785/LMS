import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAdminDelete, useAdminList, useAdminSave } from '../../api/admin.js'
import {
  Button,
  cn,
  EmptyState,
  Loading,
  Modal,
  Panel,
  SelectField,
  TextField,
  Toggle,
  useToast,
} from '../../components/ui/index.jsx'
import { DataTable, PageHead } from '../../components/admin/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/* --------------------------------- Points --------------------------------- */
export function GamificationPoints() {
  useDocumentTitle('Points — Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [rules, setRules] = useState([])
  const [meta, setMeta] = useState({ pointsName: 'Seeds', pointsIcon: '🌱' })

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'gamification', 'points'],
    queryFn: async () => (await api.get('/admin/gamification/points')).data,
  })

  useEffect(() => {
    if (!data) return
    setRules(data.rules)
    setMeta({ pointsName: data.gamification.pointsName, pointsIcon: data.gamification.pointsIcon })
  }, [data])

  const save = useMutation({
    mutationFn: async () =>
      (await api.put('/admin/gamification/points', { rules, gamification: meta })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.show('Points saved ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  if (isPending) return <Loading />

  return (
    <>
      {toast.node}
      <PageHead
        title="Points"
        sub="What learners earn, and for what"
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <div className="grid grid-cols-[0.8fr_1.2fr] gap-5 mx-1100:grid-cols-1">
        <Panel title="Point identity">
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-[1.6rem]">
                {meta.pointsIcon}
              </span>
              <TextField
                label="Icon"
                value={meta.pointsIcon}
                onChange={(e) => setMeta((m) => ({ ...m, pointsIcon: e.target.value }))}
                className="flex-1"
              />
            </div>
            <TextField
              id="point-name"
              label="Point name"
              maxLength={6}
              value={meta.pointsName}
              onChange={(e) => setMeta((m) => ({ ...m, pointsName: e.target.value }))}
              hint={`${meta.pointsName.length}/6`}
            />
          </div>
        </Panel>

        <Panel title="Assign Points">
          <div className="grid gap-2">
            {rules.map((rule, i) => (
              <div
                key={rule._id}
                className="flex items-center gap-3 rounded-lg2 border border-line-admin px-4 py-3"
              >
                <span className="flex-1 text-[0.9rem]">{rule.activity}</span>
                <input
                  type="number"
                  min="0"
                  value={rule.points}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((r, x) => (x === i ? { ...r, points: Number(e.target.value) } : r)),
                    )
                  }
                  aria-label={`Points for ${rule.activity}`}
                  className="w-20 rounded-md2 border border-line-admin px-2 py-1.5 text-right text-[0.88rem] outline-none focus:border-brand"
                />
                <Toggle
                  checked={rule.enabled !== false}
                  onChange={(v) =>
                    setRules((prev) => prev.map((r, x) => (x === i ? { ...r, enabled: v } : r)))
                  }
                  label={`Enable ${rule.activity}`}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}

/* --------------------------------- Badges --------------------------------- */
const TONES = {
  gold: 'bg-gold/15 text-gold',
  silver: 'bg-silver/20 text-silver',
  bronze: 'bg-bronze/15 text-bronze',
}

export function GamificationBadges() {
  useDocumentTitle('Badges — Growth Scholar Admin')
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [automation, setAutomation] = useState(false)
  const [assignWhen, setAssignWhen] = useState('Seeds points')

  const { data, isPending } = useAdminList('gamification/badges', { limit: 100 })
  const save = useAdminSave('gamification/badges')
  const remove = useAdminDelete('gamification/badges')

  return (
    <>
      {toast.node}
      <PageHead
        title="Badges"
        sub="Milestones learners can unlock"
        actions={<Button onClick={() => setCreating(true)}>Create Badge</Button>}
      />

      {isPending ? (
        <Loading />
      ) : (data?.items || []).length === 0 ? (
        <EmptyState icon="🛡" title="No badges yet" body="Create your first milestone badge." />
      ) : (
        <div className="grid grid-cols-4 gap-4 mx-1100:grid-cols-2 mx-640:grid-cols-1">
          {data.items.map((b) => (
            <article
              key={b._id}
              className="rounded-lg2 border border-line-admin bg-white p-5 text-center shadow-admin"
            >
              <span
                className={cn(
                  'mx-auto grid h-14 w-14 place-items-center rounded-full text-[1.4rem]',
                  TONES[b.tone] || TONES.gold,
                )}
              >
                {b.icon}
              </span>
              <h3 className="mt-3 text-[1rem]">{b.name}</h3>
              <p className="mt-1 text-[0.8rem] text-muted-admin">{b.description}</p>
              <p className="mt-2 text-[0.75rem] font-semibold text-brand">
                {b.assignWhen === 'Seeds points'
                  ? `${b.seedsThreshold?.toLocaleString('en-IN')} Seeds`
                  : 'Course based'}
              </p>
              <button
                type="button"
                onClick={() =>
                  remove.mutate(b._id, { onSuccess: () => toast.show('Badge deleted') })
                }
                className="mt-3 text-[0.78rem] font-semibold text-danger-admin hover:underline"
              >
                Delete
              </button>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create Badge"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button form="new-badge" type="submit" disabled={save.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form
          id="new-badge"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            const f = Object.fromEntries(new FormData(e.currentTarget))
            save.mutate(
              {
                ...f,
                automationEnabled: automation,
                assignWhen,
                seedsThreshold: Number(f.seedsThreshold || 0),
              },
              {
                onSuccess: () => {
                  setCreating(false)
                  toast.show('Badge created ✓')
                },
                onError: (err) => toast.show(apiError(err)),
              },
            )
          }}
        >
          <TextField name="name" label="Badge name" required />
          <TextField name="description" label="Description" />
          <div className="grid grid-cols-2 gap-4">
            <TextField name="icon" label="Icon" defaultValue="🛡" />
            <SelectField
              name="tone"
              label="Tone"
              defaultValue="gold"
              options={['gold', 'silver', 'bronze']}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg2 bg-surface-admin/60 px-4 py-3">
            <div>
              <p className="text-[0.85rem] font-semibold text-brand-deep">Enable automation</p>
              <p className="text-[0.78rem] text-muted-admin">
                Automatically assign when conditions match
              </p>
            </div>
            <Toggle checked={automation} onChange={setAutomation} label="Enable automation" />
          </div>

          {automation && (
            <>
              <SelectField
                label="Assign when"
                value={assignWhen}
                onChange={(e) => setAssignWhen(e.target.value)}
                options={['Seeds points', 'Select course / service']}
              />
              {assignWhen === 'Seeds points' && (
                <TextField
                  name="seedsThreshold"
                  type="number"
                  min="0"
                  label="Seeds required"
                  defaultValue={500}
                />
              )}
              <p className="text-[0.78rem] text-muted-admin">
                Automation awards cannot be revoked automatically. Review thresholds before saving.
              </p>
            </>
          )}
        </form>
      </Modal>
    </>
  )
}

/* ------------------------------ Leaderboard ------------------------------- */
export function GamificationLeaderboard() {
  useDocumentTitle('Leaderboard — Growth Scholar Admin')
  const [period, setPeriod] = useState('week')

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'gamification', 'leaderboard', period],
    queryFn: async () =>
      (await api.get('/admin/gamification/leaderboard', { params: { period } })).data,
  })

  return (
    <>
      <PageHead title="Leaderboard" sub="Who is earning the most" />

      <div className="mb-5 flex rounded-full border border-line-admin bg-white p-1" role="tablist">
        {[
          { id: 'all', label: 'All Time' },
          { id: 'month', label: 'Month' },
          { id: 'week', label: 'Week' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={period === t.id}
            onClick={() => setPeriod(t.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-[0.85rem] font-semibold transition-colors duration-200 ease-gs',
              period === t.id ? 'bg-brand text-white' : 'text-muted-admin hover:text-brand',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <Loading />
      ) : (
        (data.boards || []).map((board) => (
          <div key={board.board} className="mb-6">
            <h2 className="mb-3 text-[1.05rem]">{board.board}</h2>
            <DataTable
              searchable={false}
              pageSize={10}
              rows={board.entries}
              columns={[
                { key: 'rank', label: 'Rank' },
                { key: 'name', label: 'User' },
                { key: 'email', label: 'Contact' },
                { key: 'badge', label: 'Badge' },
                {
                  key: 'points',
                  label: 'Points',
                  render: (r) => `${r.points.toLocaleString('en-IN')} Seeds`,
                },
                { key: 'service', label: 'Service' },
              ]}
            />
          </div>
        ))
      )}
    </>
  )
}

/* ------------------------------- Settings --------------------------------- */
export function GamificationSettings() {
  useDocumentTitle('Gamification settings — Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(null)

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'gamification', 'settings'],
    queryFn: async () => (await api.get('/admin/gamification/settings')).data,
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: async () => (await api.put('/admin/gamification/settings', form)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.show('Settings saved ✓')
    },
  })

  if (isPending || !form) return <Loading />

  return (
    <>
      {toast.node}
      <PageHead
        title="Gamification settings"
        sub="How points and leaderboards behave"
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save
          </Button>
        }
      />

      <Panel title="Options" className="max-w-2xl">
        <div className="grid gap-4">
          <TextField
            label="Point name"
            value={form.pointsName}
            onChange={(e) => setForm((f) => ({ ...f, pointsName: e.target.value }))}
          />
          <TextField
            label="Point icon"
            value={form.pointsIcon}
            onChange={(e) => setForm((f) => ({ ...f, pointsIcon: e.target.value }))}
          />
          {[
            ['leaderboardEnabled', 'Show the leaderboard to learners'],
            ['showOnProfile', 'Show points on learner profiles'],
          ].map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg2 bg-surface-admin/60 px-4 py-3"
            >
              <span className="text-[0.85rem] text-muted-admin">{label}</span>
              <Toggle
                checked={!!form[key]}
                onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                label={label}
              />
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
