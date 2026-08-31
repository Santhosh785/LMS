import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { PageHead, DataTable } from '../../components/admin/index.jsx'
import {
  Button,
  cn,
  ErrorNote,
  Field,
  inputClass,
  Loading,
  Modal,
  Pill,
  SelectField,
  TextAreaField,
  TextField,
  ToggleField,
  useToast,
} from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/**
 * Categories, tags and the rest of the term registry.
 *
 * Everything on this screen used to be either free text on the content
 * documents or a hardcoded array in the client, so a category could not be
 * renamed, reordered or hidden without a deploy. Writes here invalidate the
 * public config cache, so a change shows up on the site on the next page load.
 */

const BLANK = {
  name: '',
  shortLabel: '',
  slug: '',
  description: '',
  parent: '',
  icon: '',
  color: '',
  order: 0,
  showInMenu: false,
  showInFilters: true,
  showOnCards: true,
  featured: false,
  showAsRail: false,
  linkTo: '',
  status: 'Published',
  visibility: 'Public',
  seo: { metaTitle: '', metaDescription: '', ogImage: '' },
}

export default function Taxonomy() {
  useDocumentTitle('Taxonomy | Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()

  const [taxonomy, setTaxonomy] = useState('category')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [replaceWith, setReplaceWith] = useState('')
  const [merging, setMerging] = useState(null)
  const [mergeInto, setMergeInto] = useState('')
  const [formError, setFormError] = useState(null)

  const taxonomies = useQuery({
    queryKey: ['admin', 'taxonomy', 'taxonomies'],
    queryFn: async () => (await api.get('/admin/taxonomy/taxonomies')).data,
  })

  const terms = useQuery({
    queryKey: ['admin', 'taxonomy', taxonomy],
    queryFn: async () => (await api.get('/admin/taxonomy', { params: { taxonomy } })).data,
  })

  const meta = taxonomies.data?.items?.find((t) => t.name === taxonomy)
  const rows = terms.data?.items || []
  const usage = terms.data?.usage || {}

  const done = (message) => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] })
    toast.show(message)
  }

  const save = useMutation({
    mutationFn: async (term) => {
      const body = {
        ...term,
        taxonomy,
        parent: term.parent || null,
        order: Number(term.order) || 0,
      }
      return term._id
        ? (await api.put(`/admin/taxonomy/${term._id}`, body)).data
        : (await api.post('/admin/taxonomy', body)).data
    },
    onSuccess: (data) => {
      setEditing(null)
      setFormError(null)
      done(data?.reassigned ? `Saved — ${data.reassigned} item(s) repointed` : 'Saved')
    },
    onError: (err) => setFormError(apiError(err)),
  })

  const remove = useMutation({
    mutationFn: async ({ id, replacement, force }) =>
      (
        await api.delete(`/admin/taxonomy/${id}`, {
          params: replacement ? { replaceWith: replacement } : force ? { force: 'true' } : {},
        })
      ).data,
    onSuccess: () => {
      setDeleting(null)
      setReplaceWith('')
      done('Term deleted')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const merge = useMutation({
    mutationFn: async ({ sourceId, targetId }) =>
      (await api.post('/admin/taxonomy/merge', { sourceId, targetId })).data,
    onSuccess: (data) => {
      setMerging(null)
      setMergeInto('')
      done(`Merged — ${data.moved} item(s) moved`)
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const reorder = useMutation({
    mutationFn: async (items) => (await api.post('/admin/taxonomy/reorder', { items })).data,
    onSuccess: () => done('Order updated'),
  })

  /** Swaps a term with its neighbour and persists both positions. */
  const move = (term, direction) => {
    const ordered = [...rows]
    const index = ordered.findIndex((t) => t._id === term._id)
    const target = index + direction
    if (target < 0 || target >= ordered.length) return
    ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
    reorder.mutate(ordered.map((t, i) => ({ id: t._id, order: i })))
  }

  const parentOptions = useMemo(
    () => [
      { value: '', label: '— No parent (top level) —' },
      ...rows
        .filter((t) => !editing?._id || t._id !== editing._id)
        .map((t) => ({ value: t._id, label: t.name })),
    ],
    [rows, editing],
  )

  const nameOf = (id) => rows.find((t) => t._id === id)?.name || '—'

  const columns = [
    {
      key: 'name',
      label: 'Term',
      value: (t) => t.name,
      render: (t) => (
        <div className="flex items-center gap-2">
          {t.parent && (
            <span className="text-muted" aria-hidden="true">
              ↳
            </span>
          )}
          <span className="font-semibold text-ink">
            {t.icon ? `${t.icon} ` : ''}
            {t.name}
          </span>
          {t.parent && <span className="text-[0.75rem] text-muted">in {nameOf(t.parent)}</span>}
        </div>
      ),
    },
    { key: 'slug', label: 'Slug', render: (t) => <code className="text-[0.8rem]">{t.slug}</code> },
    {
      key: 'usage',
      label: 'Used by',
      value: (t) => usage[t._id] || 0,
      render: (t) => (
        <span className={cn('text-[0.85rem]', !usage[t._id] && 'text-muted')}>
          {usage[t._id] || 0} item{usage[t._id] === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      key: 'shown',
      label: 'Shown in',
      render: (t) => (
        <div className="flex flex-wrap gap-1">
          {t.showInMenu && <Pill tone="ok">Menu</Pill>}
          {t.showInFilters && <Pill tone="neutral">Filters</Pill>}
          {t.showOnCards && <Pill tone="neutral">Cards</Pill>}
          {t.featured && <Pill tone="ok">Featured</Pill>}
          {t.showAsRail && <Pill tone="ok">Homepage rail</Pill>}
          {t.status !== 'Published' && <Pill tone="warn">{t.status}</Pill>}
          {t.visibility === 'Hidden' && <Pill tone="live">Hidden</Pill>}
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => move(t, -1)}
            aria-label={`Move ${t.name} up`}
            className="grid h-7 w-7 place-items-center rounded-md2 text-muted hover:bg-surface-mist hover:text-brand"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => move(t, 1)}
            aria-label={`Move ${t.name} down`}
            className="grid h-7 w-7 place-items-center rounded-md2 text-muted hover:bg-surface-mist hover:text-brand"
          >
            ↓
          </button>
          <Button size="sm" variant="ghost" onClick={() => setEditing({ ...BLANK, ...t })}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMerging(t)}>
            Merge
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleting(t)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const field = (key, value) => setEditing((prev) => ({ ...prev, [key]: value }))

  return (
    <>
      <PageHead
        title="Taxonomy"
        sub="Categories, tags and the other term lists the site filters and menus are built from."
        actions={
          <Button onClick={() => setEditing({ ...BLANK, order: rows.length })}>New term</Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {(taxonomies.data?.items || []).map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setTaxonomy(t.name)}
            className={cn(
              'rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition-colors duration-200',
              taxonomy === t.name
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-white text-muted hover:border-brand hover:text-brand',
            )}
          >
            {t.label} <span className="opacity-70">({t.termCount})</span>
          </button>
        ))}
      </div>

      {meta?.help && <p className="mb-4 text-[0.88rem] text-muted">{meta.help}</p>}

      {terms.isPending ? (
        <Loading />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          searchPlaceholder="Search terms…"
          pageSize={25}
          empty={`No ${meta?.label?.toLowerCase() || 'terms'} yet. Add the first one.`}
        />
      )}

      {/* ------------------------------ editor ------------------------------ */}
      <Modal
        open={Boolean(editing)}
        onClose={() => {
          setEditing(null)
          setFormError(null)
        }}
        title={editing?._id ? `Edit ${editing.name}` : 'New term'}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4">
            {formError && <ErrorNote error={formError} />}

            <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
              <TextField
                label="Name"
                value={editing.name}
                onChange={(e) => field('name', e.target.value)}
                hint={
                  editing._id
                    ? 'Renaming updates every course, post and workshop using this term.'
                    : undefined
                }
              />
              <TextField
                label="Short label"
                value={editing.shortLabel || ''}
                onChange={(e) => field('shortLabel', e.target.value)}
                hint="Optional. Used where space is tight, e.g. “Social Ads”."
              />
              <TextField
                label="Slug"
                value={editing.slug}
                onChange={(e) => field('slug', e.target.value)}
                hint={
                  editing._id
                    ? 'The old slug keeps redirecting here.'
                    : 'Left blank, derived from the name.'
                }
              />
            </div>

            <TextAreaField
              label="Description"
              rows={2}
              value={editing.description || ''}
              onChange={(e) => field('description', e.target.value)}
            />

            {meta?.hierarchical && (
              <SelectField
                label="Parent"
                options={parentOptions}
                value={editing.parent || ''}
                onChange={(e) => field('parent', e.target.value)}
              />
            )}

            <div className="grid grid-cols-3 gap-4 mx-640:grid-cols-1">
              <TextField
                label="Icon"
                value={editing.icon || ''}
                onChange={(e) => field('icon', e.target.value)}
                hint="An emoji, optional."
              />
              <Field label="Colour">
                <input
                  type="color"
                  value={editing.color || '#3ecf8e'}
                  onChange={(e) => field('color', e.target.value)}
                  className={cn(inputClass, 'h-10 p-1')}
                />
              </Field>
              <TextField
                label="Order"
                type="number"
                value={editing.order ?? 0}
                onChange={(e) => field('order', e.target.value)}
              />
            </div>

            <fieldset className="grid gap-3 rounded-lg2 border border-line p-4">
              <legend className="px-1 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">
                Where this term appears
              </legend>
              <ToggleField
                id="showInMenu"
                label="Show in the site menu"
                hint="Header and footer navigation."
                checked={editing.showInMenu}
                onChange={(v) => field('showInMenu', v)}
              />
              <ToggleField
                id="showInFilters"
                label="Show in the catalogue filter sidebar"
                hint="Visitors can filter by it on /courses."
                checked={editing.showInFilters}
                onChange={(v) => field('showInFilters', v)}
              />
              <ToggleField
                id="showOnCards"
                label="Show on content cards"
                checked={editing.showOnCards}
                onChange={(v) => field('showOnCards', v)}
              />
              <ToggleField
                id="featured"
                label="Featured"
                hint={
                  taxonomy === 'topic'
                    ? 'Shows this topic in the homepage career banner.'
                    : undefined
                }
                checked={editing.featured}
                onChange={(v) => field('featured', v)}
              />
              {taxonomy === 'tag' && (
                <>
                  <ToggleField
                    id="showAsRail"
                    label="Show as a rail on the homepage"
                    hint="Content tagged with this becomes a column in “New and popular”."
                    checked={editing.showAsRail}
                    onChange={(v) => field('showAsRail', v)}
                  />
                  {editing.showAsRail && (
                    <TextField
                      label="Rail heading links to"
                      value={editing.linkTo || ''}
                      onChange={(e) => field('linkTo', e.target.value)}
                      hint="Left blank, the heading links to this tag's own course list."
                    />
                  )}
                </>
              )}
            </fieldset>

            <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
              <SelectField
                label="Status"
                value={editing.status}
                onChange={(e) => field('status', e.target.value)}
                options={[
                  { value: 'Published', label: 'Published' },
                  { value: 'Draft', label: 'Draft' },
                  { value: 'Archived', label: 'Archived' },
                ]}
              />
              <SelectField
                label="Visibility"
                value={editing.visibility}
                onChange={(e) => field('visibility', e.target.value)}
                options={[
                  { value: 'Public', label: 'Public' },
                  { value: 'Hidden', label: 'Hidden' },
                ]}
              />
            </div>

            <fieldset className="grid gap-3 rounded-lg2 border border-line p-4">
              <legend className="px-1 text-[0.8rem] font-semibold uppercase tracking-wide text-muted">
                Search engines
              </legend>
              <TextField
                label="Meta title"
                value={editing.seo?.metaTitle || ''}
                onChange={(e) => field('seo', { ...editing.seo, metaTitle: e.target.value })}
              />
              <TextAreaField
                label="Meta description"
                rows={2}
                value={editing.seo?.metaDescription || ''}
                onChange={(e) => field('seo', { ...editing.seo, metaDescription: e.target.value })}
              />
            </fieldset>
          </div>
        )}
      </Modal>

      {/* ------------------------------ delete ------------------------------ */}
      <Modal
        open={Boolean(deleting)}
        onClose={() => {
          setDeleting(null)
          setReplaceWith('')
        }}
        title={`Delete ${deleting?.name || ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate({
                  id: deleting._id,
                  replacement: replaceWith || null,
                  force: !replaceWith,
                })
              }
            >
              {replaceWith ? 'Reassign and delete' : 'Delete'}
            </Button>
          </>
        }
      >
        {deleting && (
          <div className="grid gap-3">
            {usage[deleting._id] ? (
              <>
                <p className="text-[0.92rem] text-muted">
                  <strong className="text-ink">{deleting.name}</strong> is used by{' '}
                  {usage[deleting._id]} item(s). Move them to another term, or delete and leave them
                  without one.
                </p>
                <SelectField
                  label="Move them to"
                  value={replaceWith}
                  onChange={(e) => setReplaceWith(e.target.value)}
                  options={[
                    { value: '', label: '— Remove the term from them —' },
                    ...rows
                      .filter((t) => t._id !== deleting._id)
                      .map((t) => ({ value: t._id, label: t.name })),
                  ]}
                />
              </>
            ) : (
              <p className="text-[0.92rem] text-muted">
                Nothing uses this term, so deleting it changes no content.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ------------------------------- merge ------------------------------ */}
      <Modal
        open={Boolean(merging)}
        onClose={() => {
          setMerging(null)
          setMergeInto('')
        }}
        title={`Merge ${merging?.name || ''} into…`}
        footer={
          <>
            <Button variant="outline" onClick={() => setMerging(null)}>
              Cancel
            </Button>
            <Button
              disabled={!mergeInto || merge.isPending}
              onClick={() => merge.mutate({ sourceId: merging._id, targetId: mergeInto })}
            >
              Merge
            </Button>
          </>
        }
      >
        {merging && (
          <div className="grid gap-3">
            <p className="text-[0.92rem] text-muted">
              Everything tagged <strong className="text-ink">{merging.name}</strong> moves to the
              term you pick. <strong className="text-ink">{merging.name}</strong> is then removed,
              and its old links keep resolving to the winner.
            </p>
            <SelectField
              label="Keep this term"
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
              options={[
                { value: '', label: '— Pick a term —' },
                ...rows
                  .filter((t) => t._id !== merging._id)
                  .map((t) => ({ value: t._id, label: t.name })),
              ]}
            />
          </div>
        )}
      </Modal>
    </>
  )
}
