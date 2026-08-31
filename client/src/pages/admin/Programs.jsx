import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { DataTable, PageHead } from '../../components/admin/index.jsx'
import TermPicker from '../../components/admin/TermPicker.jsx'
import {
  Button,
  cn,
  Loading,
  Modal,
  Panel,
  TextAreaField,
  TextField,
  useToast,
} from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import {
  CTA_KEYS,
  DEFAULT_CTAS,
  DEFAULT_SECTION_COPY,
  SECTION_KEYS,
} from '../../data/programCopy.js'

/**
 * Programs — list, create, and edit every part of the public program page.
 *
 * Programs were seed-only until now: the flagship's price and all of its page
 * copy lived in `seed/data/program.js`, so changing "Apply Now" or the cohort
 * price meant a code change and a re-seed.
 */

const TABS = [
  { key: 'information', label: 'Information' },
  { key: 'copy', label: 'Page copy' },
  { key: 'pricing', label: 'Pricing' },
]

/** Turns the stored array into a lookup the form can edit by key. */
const byKey = (rows = []) => Object.fromEntries(rows.map((r) => [r.key, r]))

export default function Programs() {
  useDocumentTitle('Programs | Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()

  const [editingId, setEditingId] = useState(null)
  const [tab, setTab] = useState('information')
  const [draft, setDraft] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const list = useQuery({
    queryKey: ['admin', 'programs'],
    queryFn: async () => (await api.get('/admin/programs')).data,
  })

  const open = (program) => {
    setEditingId(program._id)
    setTab('information')
    setDraft({
      ...program,
      sectionCopy: byKey(program.sectionCopy),
      ctas: byKey(program.ctas),
      pricing: program.pricing || {},
    })
  }

  const save = useMutation({
    mutationFn: async ({ id, tab: which, body }) =>
      (await api.put(`/admin/programs/${id}/${which}`, body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'programs'] })
      toast.show('Saved ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const create = useMutation({
    mutationFn: async (title) => (await api.post('/admin/programs', { title, slug: title })).data,
    onSuccess: (program) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'programs'] })
      setCreating(false)
      setNewTitle('')
      open(program)
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const remove = useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/programs/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'programs'] })
      toast.show('Program deleted')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const field = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

  const setSection = (key, part, value) =>
    setDraft((d) => ({
      ...d,
      sectionCopy: {
        ...d.sectionCopy,
        [key]: { ...(d.sectionCopy[key] || {}), key, [part]: value },
      },
    }))

  const setCta = (key, part, value) =>
    setDraft((d) => ({
      ...d,
      ctas: { ...d.ctas, [key]: { ...(d.ctas[key] || {}), key, [part]: value } },
    }))

  const submit = () => {
    if (tab === 'information') {
      return save.mutate({
        id: editingId,
        tab: 'information',
        body: {
          title: draft.title,
          slug: draft.slug,
          eyebrow: draft.eyebrow,
          description: draft.description,
          weeks: Number(draft.weeks) || 0,
          meta: draft.meta || [],
          heroImage: draft.heroImage,
          categories: draft.categories || [],
          tags: draft.tags || [],
        },
      })
    }
    if (tab === 'copy') {
      return save.mutate({
        id: editingId,
        tab: 'copy',
        body: {
          // Only the entries an operator actually filled in are stored; the rest
          // fall back to the shipped wording at render time.
          sectionCopy: Object.values(draft.sectionCopy).filter(
            (s) => s.eyebrow || s.heading || s.subhead,
          ),
          ctas: Object.values(draft.ctas).filter((c) => c.label || c.to),
          phaseLabels: draft.phaseLabels || [],
        },
      })
    }
    return save.mutate({
      id: editingId,
      tab: 'pricing',
      body: { pricing: { ...draft.pricing, amount: Number(draft.pricing.amount) || 0 } },
    })
  }

  const columns = [
    { key: 'title', label: 'Program' },
    { key: 'slug', label: 'Slug', render: (p) => <code className="text-[0.8rem]">{p.slug}</code> },
    { key: 'weeks', label: 'Weeks', render: (p) => `${p.weeks || '—'}` },
    {
      key: 'amount',
      label: 'Price',
      value: (p) => p.pricing?.amount || 0,
      render: (p) =>
        p.pricing?.amount ? `₹${Number(p.pricing.amount).toLocaleString('en-IN')}` : '—',
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (p) => <span className="text-[0.82rem] text-muted">{p.tags?.join(', ') || '—'}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => open(p)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => remove.mutate(p._id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      {toast.node}
      <PageHead
        title="Programs"
        sub="Cohort programs and every word on their public page."
        actions={<Button onClick={() => setCreating(true)}>New program</Button>}
      />

      {list.isPending ? (
        <Loading />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items || []}
          searchPlaceholder="Search programs…"
          empty="No programs yet."
        />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New program"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button disabled={!newTitle.trim()} onClick={() => create.mutate(newTitle.trim())}>
              Create
            </Button>
          </>
        }
      >
        <TextField
          label="Title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          hint="The URL slug is derived from this and can be changed after."
        />
      </Modal>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.title || 'Program'}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Close
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save this tab'}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-4">
            <div className="flex gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-[0.85rem] font-semibold',
                    tab === t.key
                      ? 'border-brand bg-brand text-white'
                      : 'border-line bg-white text-muted hover:border-brand',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'information' && (
              <div className="grid gap-4">
                <TextField
                  label="Title"
                  value={draft.title || ''}
                  onChange={(e) => field('title', e.target.value)}
                />
                <TextField
                  label="URL slug"
                  value={draft.slug || ''}
                  onChange={(e) => field('slug', e.target.value)}
                  hint="Used in /programs/<slug>"
                />
                <TextField
                  label="Eyebrow"
                  value={draft.eyebrow || ''}
                  onChange={(e) => field('eyebrow', e.target.value)}
                  hint="The small label above the title, e.g. “Flagship Program”."
                />
                <TextAreaField
                  label="Description"
                  rows={3}
                  value={draft.description || ''}
                  onChange={(e) => field('description', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
                  <TextField
                    label="Weeks"
                    type="number"
                    value={draft.weeks ?? ''}
                    onChange={(e) => field('weeks', e.target.value)}
                  />
                  <TextField
                    label="Hero image URL"
                    value={draft.heroImage || ''}
                    onChange={(e) => field('heroImage', e.target.value)}
                  />
                </div>
                <TextField
                  label="Hero chips"
                  value={(draft.meta || []).join(', ')}
                  onChange={(e) =>
                    field(
                      'meta',
                      e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    )
                  }
                  hint="Comma separated, e.g. 12 Weeks, Part-time, Live + Practice"
                />
                <TermPicker
                  taxonomy="category"
                  label="Categories"
                  value={draft.categories || []}
                  onChange={(v) => field('categories', v)}
                />
                <TermPicker
                  taxonomy="tag"
                  label="Tags"
                  value={draft.tags || []}
                  onChange={(v) => field('tags', v)}
                  hint="★ marks a tag that publishes this program to a homepage rail."
                />
              </div>
            )}

            {tab === 'copy' && (
              <div className="grid gap-4">
                <p className="text-[0.86rem] text-muted">
                  Every heading and button on the public program page. Leave a box empty to keep the
                  wording the page ships with.
                </p>

                <TextField
                  label="Outcome column headings"
                  value={(draft.phaseLabels || []).join(', ')}
                  onChange={(e) =>
                    field(
                      'phaseLabels',
                      e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    )
                  }
                  hint="Comma separated. Must match the phase set on each outcome."
                />

                {SECTION_KEYS.map((key) => (
                  <Panel key={key} title={key.replace(/^\w/, (c) => c.toUpperCase())}>
                    <div className="grid gap-3">
                      {['eyebrow', 'heading', 'subhead'].map((part) =>
                        DEFAULT_SECTION_COPY[key][part] !== undefined ? (
                          <TextField
                            key={part}
                            label={part.replace(/^\w/, (c) => c.toUpperCase())}
                            value={draft.sectionCopy[key]?.[part] || ''}
                            onChange={(e) => setSection(key, part, e.target.value)}
                            placeholder={DEFAULT_SECTION_COPY[key][part] || '—'}
                          />
                        ) : null,
                      )}
                    </div>
                  </Panel>
                ))}

                <Panel title="Buttons">
                  <div className="grid gap-3">
                    {CTA_KEYS.map((key) => (
                      <div key={key} className="grid grid-cols-2 gap-3 mx-640:grid-cols-1">
                        <TextField
                          label={`${key} — label`}
                          value={draft.ctas[key]?.label || ''}
                          onChange={(e) => setCta(key, 'label', e.target.value)}
                          placeholder={DEFAULT_CTAS[key].label || 'Hidden when empty'}
                        />
                        <TextField
                          label={`${key} — links to`}
                          value={draft.ctas[key]?.to || ''}
                          onChange={(e) => setCta(key, 'to', e.target.value)}
                          placeholder={DEFAULT_CTAS[key].to || '—'}
                        />
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {tab === 'pricing' && (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
                  <TextField
                    label="Amount (₹)"
                    type="number"
                    value={draft.pricing.amount ?? ''}
                    onChange={(e) => field('pricing', { ...draft.pricing, amount: e.target.value })}
                  />
                  <TextField
                    label="Compare-at price (₹)"
                    type="number"
                    value={draft.pricing.strikeAmount ?? ''}
                    onChange={(e) =>
                      field('pricing', { ...draft.pricing, strikeAmount: e.target.value })
                    }
                  />
                </div>
                <TextField
                  label="Price note"
                  value={draft.pricing.note || ''}
                  onChange={(e) => field('pricing', { ...draft.pricing, note: e.target.value })}
                />
                <TextAreaField
                  label="What's included"
                  rows={5}
                  value={(draft.pricing.benefits || []).join('\n')}
                  onChange={(e) =>
                    field('pricing', {
                      ...draft.pricing,
                      benefits: e.target.value.split('\n').filter(Boolean),
                    })
                  }
                  hint="One per line."
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
