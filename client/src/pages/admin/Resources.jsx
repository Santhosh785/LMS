import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { DataTable, PageHead } from '../../components/admin/index.jsx'
import {
  Button,
  cn,
  Loading,
  Modal,
  StatusPill,
  TextAreaField,
  TextField,
  SelectField,
  useToast,
} from '../../components/ui/index.jsx'

/**
 * Admin for the Resources section — playbooks and Claude skills on one screen,
 * because they are the same job (write a card, write a body, publish it) and
 * splitting them would mean two near-identical pages.
 *
 * The long-form bodies are edited as structured lists rather than raw JSON:
 * one section per block for a playbook, one feature per line for a skill.
 */

const TABS = [
  { key: 'playbooks', label: 'Playbooks', endpoint: '/admin/playbooks' },
  { key: 'skills', label: 'Claude Skills', endpoint: '/admin/skills' },
]

const STATUSES = [
  { value: 'Published', label: 'Published' },
  { value: 'Draft', label: 'Draft' },
]

const blank = {
  playbooks: {
    title: '',
    slug: '',
    tag: '',
    cardTitle: '',
    summary: '',
    deck: '',
    status: 'Draft',
  },
  skills: {
    title: '',
    slug: '',
    category: 'seo',
    badge: '',
    icon: '✦',
    summary: '',
    status: 'Draft',
  },
}

/** "Title :: body" per line — the shape used for both features and sections. */
const pairsToText = (rows, a, b) => (rows || []).map((r) => `${r[a]} :: ${r[b]}`).join('\n')
const textToPairs = (text, a, b) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [first, ...rest] = l.split('::')
      return { [a]: first.trim(), [b]: rest.join('::').trim() }
    })

export default function Resources() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('playbooks')
  const [draft, setDraft] = useState(null)

  const active = TABS.find((t) => t.key === tab)

  const list = useQuery({
    queryKey: ['admin', tab],
    queryFn: async () => (await api.get(active.endpoint, { params: { limit: 200 } })).data,
  })

  const refresh = (msg) => {
    queryClient.invalidateQueries({ queryKey: ['admin', tab] })
    if (msg) toast.show(msg)
  }

  const save = useMutation({
    mutationFn: async (body) => {
      const { _id, ...rest } = body
      return _id
        ? (await api.put(`${active.endpoint}/${_id}`, rest)).data
        : (await api.post(active.endpoint, rest)).data
    },
    onSuccess: () => {
      setDraft(null)
      refresh('Saved')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const remove = useMutation({
    mutationFn: async (id) => (await api.delete(`${active.endpoint}/${id}`)).data,
    onSuccess: () => {
      setDraft(null)
      refresh('Deleted')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const field = (k, v) => setDraft((d) => ({ ...d, [k]: v }))

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (r) => (
        <div>
          <p className="font-semibold text-ink">{r.cardTitle || r.title}</p>
          <p className="text-[0.8rem] text-muted">/{r.slug}</p>
        </div>
      ),
    },
    tab === 'playbooks'
      ? { key: 'tag', label: 'Tag' }
      : { key: 'badge', label: 'Category', render: (r) => r.badge || r.category },
    tab === 'playbooks'
      ? { key: 'authorName', label: 'Author' }
      : { key: 'worksWith', label: 'Works with' },
    { key: 'order', label: 'Order' },
    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
    {
      key: 'edit',
      label: '',
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => setDraft(r)}>
          Edit
        </Button>
      ),
    },
  ]

  return (
    <>
      {toast.node}
      <PageHead
        title="Resources"
        subtitle="Mentor playbooks and Claude skills shown under /resources."
        actions={
          <Button onClick={() => setDraft({ ...blank[tab] })}>
            New {tab === 'playbooks' ? 'playbook' : 'skill'}
          </Button>
        }
      />

      <div className="mb-5 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-[0.85rem] font-semibold',
              tab === t.key
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-white text-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.isPending ? (
        <Loading />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items || []}
          pageSize={25}
          empty={`No ${tab} yet.`}
        />
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={
          draft?._id ? `Edit ${draft.title}` : `New ${tab === 'playbooks' ? 'playbook' : 'skill'}`
        }
        width="max-w-3xl"
        footer={
          <>
            {draft?._id && (
              <Button variant="ghost" onClick={() => remove.mutate(draft._id)}>
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
              <TextField
                label="Title"
                value={draft.title || ''}
                onChange={(e) => field('title', e.target.value)}
              />
              <TextField
                label="Slug"
                value={draft.slug || ''}
                onChange={(e) => field('slug', e.target.value)}
                hint="Left blank on a new entry, it is derived from the title."
              />
              <TextField
                label="Card title"
                value={draft.cardTitle || ''}
                onChange={(e) => field('cardTitle', e.target.value)}
                hint="Shown on the index card when it differs from the full title."
              />
              <SelectField
                label="Status"
                value={draft.status || 'Draft'}
                options={STATUSES}
                onChange={(e) => field('status', e.target.value)}
              />
            </div>

            <TextAreaField
              label="Card summary"
              rows={2}
              value={draft.summary || ''}
              onChange={(e) => field('summary', e.target.value)}
            />

            {tab === 'playbooks' ? (
              <>
                <div className="grid grid-cols-3 gap-4 mx-640:grid-cols-1">
                  <TextField
                    label="Tag"
                    value={draft.tag || ''}
                    onChange={(e) => field('tag', e.target.value)}
                  />
                  <TextField
                    label="Card gradient"
                    value={draft.visualClass || ''}
                    onChange={(e) => field('visualClass', e.target.value)}
                    hint="e.g. pb-v-seo"
                  />
                  <TextField
                    label="Hero gradient"
                    value={draft.heroClass || ''}
                    onChange={(e) => field('heroClass', e.target.value)}
                    hint="e.g. pb-hero-seo"
                  />
                  <TextField
                    label="Author"
                    value={draft.authorName || ''}
                    onChange={(e) => field('authorName', e.target.value)}
                  />
                  <TextField
                    label="Author role"
                    value={draft.authorRole || ''}
                    onChange={(e) => field('authorRole', e.target.value)}
                  />
                  <TextField
                    label="Initials"
                    value={draft.initials || ''}
                    onChange={(e) => field('initials', e.target.value)}
                  />
                </div>
                <TextAreaField
                  label="Deck"
                  rows={2}
                  value={draft.deck || ''}
                  onChange={(e) => field('deck', e.target.value)}
                />
                <TextAreaField
                  label="Proudest achievement"
                  rows={2}
                  value={draft.achievement?.body || ''}
                  onChange={(e) =>
                    field('achievement', { ...(draft.achievement || {}), body: e.target.value })
                  }
                />
                <TextAreaField
                  label="Sections"
                  rows={10}
                  value={(draft.sections || [])
                    .map((s) => `${s.heading} :: ${(s.body || []).join(' ')}`)
                    .join('\n')}
                  onChange={(e) =>
                    field(
                      'sections',
                      textToPairs(e.target.value, 'heading', 'text').map((s, i) => ({
                        // The anchor has to stay stable for the contents list.
                        id:
                          draft.sections?.[i]?.id ||
                          s.heading
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                        heading: s.heading,
                        body: [s.text],
                        items: draft.sections?.[i]?.items || [],
                      })),
                    )
                  }
                  hint="One per line, as “Heading :: body text”. The contents list is generated from these."
                />
                <TextField
                  label="Tools used"
                  value={draft.tools || ''}
                  onChange={(e) => field('tools', e.target.value)}
                />
                <TextField
                  label="Related skill slug"
                  value={draft.relatedSkill?.slug || ''}
                  onChange={(e) => field('relatedSkill', { slug: e.target.value })}
                  hint="Cross-link in the sidebar. An unpublished slug simply renders nothing."
                />
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mx-640:grid-cols-1">
                  <TextField
                    label="Category key"
                    value={draft.category || ''}
                    onChange={(e) => field('category', e.target.value)}
                    hint="seo, ads, copy, funnel, analytics"
                  />
                  <TextField
                    label="Badge"
                    value={draft.badge || ''}
                    onChange={(e) => field('badge', e.target.value)}
                  />
                  <TextField
                    label="Icon"
                    value={draft.icon || ''}
                    onChange={(e) => field('icon', e.target.value)}
                  />
                  <TextField
                    label="Works with"
                    value={draft.worksWith || ''}
                    onChange={(e) => field('worksWith', e.target.value)}
                  />
                  <TextField
                    label="Readiness"
                    value={draft.readiness || ''}
                    onChange={(e) => field('readiness', e.target.value)}
                  />
                </div>
                <TextAreaField
                  label="Tagline"
                  rows={2}
                  value={draft.tagline || ''}
                  onChange={(e) => field('tagline', e.target.value)}
                />
                <TextAreaField
                  label="About"
                  rows={3}
                  value={draft.about || ''}
                  onChange={(e) => field('about', e.target.value)}
                />
                <TextAreaField
                  label="What it does"
                  rows={6}
                  value={pairsToText(draft.features, 'title', 'body')}
                  onChange={(e) => field('features', textToPairs(e.target.value, 'title', 'body'))}
                  hint="One per line, as “Title :: description”."
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
