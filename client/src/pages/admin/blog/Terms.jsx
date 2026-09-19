import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../../api/client.js'
import useDocumentTitle from '../../../hooks/useDocumentTitle.js'
import {
  ConfirmDialog,
  Pagination,
  RowActions,
  ScreenMeta,
  Spinner,
  useNotices,
  useScreenOption,
} from './wp.jsx'

/**
 * Posts → Categories and Posts → Tags.
 *
 * WordPress's edit-tags.php: the add-new form on the left, the list table on the
 * right, both live at once. Terms are the shared Term registry the rest of the
 * catalogue uses (see server/src/models/Term.js), so renaming one here repoints
 * every post that carries it rather than orphaning the name.
 */

const EMPTY = { name: '', slug: '', description: '' }

export default function Terms({ taxonomy, title, singular, help }) {
  useDocumentTitle(`${title} | Growth Scholar Blog`)
  const queryClient = useQueryClient()
  const notices = useNotices()

  const [draft, setDraft] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useScreenOption(`terms-${taxonomy}-per-page`, 20)
  const [selected, setSelected] = useState([])
  const [confirm, setConfirm] = useState(null)

  const terms = useQuery({
    queryKey: ['admin', 'taxonomy', taxonomy, search],
    queryFn: async () =>
      (await api.get('/admin/taxonomy', { params: { taxonomy, ...(search ? { q: search } : {}) } })).data,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] })
    queryClient.invalidateQueries({ queryKey: ['siteConfig'] })
  }
  const fail = (err) => notices.notify(apiError(err), 'error')

  const create = useMutation({
    mutationFn: async (values) => (await api.post('/admin/taxonomy', { ...values, taxonomy })).data,
    onSuccess: () => {
      refresh()
      setDraft(EMPTY)
      notices.notify(`${singular} added.`)
    },
    onError: fail,
  })
  const update = useMutation({
    mutationFn: async (values) => (await api.put(`/admin/taxonomy/${values._id}`, values)).data,
    onSuccess: (result) => {
      refresh()
      setEditing(null)
      notices.notify(
        result.reassigned
          ? `${singular} updated — ${result.reassigned} item${result.reassigned === 1 ? '' : 's'} repointed.`
          : `${singular} updated.`,
      )
    },
    onError: fail,
  })
  const remove = useMutation({
    mutationFn: async ({ id, force }) =>
      (await api.delete(`/admin/taxonomy/${id}`, { params: force ? { force: 'true' } : {} })).data,
    onSuccess: () => {
      refresh()
      setSelected([])
      notices.notify(`${singular} deleted.`)
    },
    onError: fail,
  })

  const items = terms.data?.items || []
  const usage = terms.data?.usage || {}
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  const visible = items.slice((page - 1) * perPage, page * perPage)
  const allChecked = visible.length > 0 && visible.every((term) => selected.includes(term._id))

  const deleteTerm = (term) =>
    setConfirm({
      title: `Delete ${singular.toLowerCase()}`,
      message: usage[term._id]
        ? `“${term.name}” is used by ${usage[term._id]} item(s). Deleting it removes the ${singular.toLowerCase()} from them. Continue?`
        : `Delete “${term.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => remove.mutate({ id: term._id, force: Boolean(usage[term._id]) }),
    })

  return (
    <div className="wp-wrap">
      <ScreenMeta
        options={
          <label className="wp-screen-options-row">
            Number of items per page:
            <input
              type="number"
              min="1"
              max="200"
              value={perPage}
              style={{ width: 70 }}
              onChange={(event) => {
                setPage(1)
                setPerPage(Math.min(Math.max(Number(event.target.value) || 20, 1), 200))
              }}
            />
          </label>
        }
        help={
          <>
            <h5>Overview</h5>
            <p>{help}</p>
            <h5>Renaming</h5>
            <p>
              Renaming a term rewrites every post that carries it, so the archive and the posts never drift apart. The
              old URL keeps working through the term&apos;s former slugs.
            </p>
          </>
        }
      />

      <div className="wp-heading-row">
        <h1 className="wp-heading-inline">{title}</h1>
        {search && (
          <span className="wp-subtitle">
            Search results for: <strong>{search}</strong>
          </span>
        )}
      </div>
      <hr className="wp-hr" />
      {notices.node}

      <div className="wp-taxonomy-layout">
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
            {editing ? `Edit ${singular}` : `Add New ${singular}`}
          </h2>
          <form
            className="wp-postbox"
            style={{ padding: 12 }}
            onSubmit={(event) => {
              event.preventDefault()
              if (editing) update.mutate(editing)
              else create.mutate(draft)
            }}
          >
            {[
              ['name', 'Name', `The name is how it appears on your site.`],
              ['slug', 'Slug', 'The “slug” is the URL-friendly version of the name. Leave blank to generate it.'],
            ].map(([key, label, hint]) => (
              <label key={key} style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {label}
                  {key === 'name' && <span className="wp-required"> *</span>}
                </span>
                <input
                  type="text"
                  required={key === 'name'}
                  value={(editing || draft)[key] || ''}
                  onChange={(event) =>
                    editing
                      ? setEditing({ ...editing, [key]: event.target.value })
                      : setDraft({ ...draft, [key]: event.target.value })
                  }
                />
                <span className="wp-description">{hint}</span>
              </label>
            ))}
            <label style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Description</span>
              <textarea
                rows={4}
                value={(editing || draft).description || ''}
                onChange={(event) =>
                  editing
                    ? setEditing({ ...editing, description: event.target.value })
                    : setDraft({ ...draft, description: event.target.value })
                }
              />
              <span className="wp-description">Shown on the archive page by some themes.</span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="submit" className="wp-button wp-button-primary" disabled={create.isPending || update.isPending}>
                {editing ? 'Update' : `Add New ${singular}`}
              </button>
              {editing && (
                <button type="button" className="wp-button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              )}
              {(create.isPending || update.isPending) && <Spinner />}
            </div>
          </form>
        </div>

        <div>
          <form
            className="wp-tablenav"
            onSubmit={(event) => {
              event.preventDefault()
              setPage(1)
              setSearch(searchDraft)
            }}
          >
            <div className="wp-alignleft">
              <button
                type="button"
                className="wp-button"
                disabled={!selected.length}
                onClick={() =>
                  setConfirm({
                    title: 'Delete selected',
                    message: `Delete ${selected.length} ${title.toLowerCase()}? Items using them lose the ${singular.toLowerCase()}.`,
                    confirmLabel: 'Delete',
                    destructive: true,
                    onConfirm: () => selected.forEach((id) => remove.mutate({ id, force: true })),
                  })
                }
              >
                Delete selected
              </button>
              {terms.isFetching && <Spinner />}
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <input
                type="search"
                value={searchDraft}
                placeholder={`Search ${title.toLowerCase()}`}
                aria-label={`Search ${title}`}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
              <button type="submit" className="wp-button">
                Search {title}
              </button>
            </div>
          </form>

          <table className="wp-list-table striped">
            <thead>
              <tr>
                <td className="check-column">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    aria-label="Select all"
                    onChange={() => setSelected(allChecked ? [] : visible.map((term) => term._id))}
                  />
                </td>
                <th scope="col" className="column-title">
                  Name
                </th>
                <th scope="col">Description</th>
                <th scope="col" className="column-slug">
                  Slug
                </th>
                <th scope="col" style={{ width: 70 }}>
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {terms.isPending ? (
                <tr>
                  <td colSpan={5} className="wp-no-items">
                    <Spinner label="Loading…" />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="wp-no-items">
                    No {title.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                visible.map((term) => (
                  <tr key={term._id}>
                    <th scope="row" className="check-column">
                      <input
                        type="checkbox"
                        checked={selected.includes(term._id)}
                        aria-label={`Select ${term.name}`}
                        onChange={() =>
                          setSelected((rows) =>
                            rows.includes(term._id) ? rows.filter((row) => row !== term._id) : [...rows, term._id],
                          )
                        }
                      />
                    </th>
                    <td className="column-title">
                      <strong>
                        <button type="button" className="row-title" onClick={() => setEditing(term)}>
                          {term.icon ? `${term.icon} ` : ''}
                          {term.name}
                        </button>
                      </strong>
                      <RowActions
                        actions={[
                          { label: 'Edit', onClick: () => setEditing(term) },
                          { label: 'Delete', destructive: true, onClick: () => deleteTerm(term) },
                          { label: 'View', href: `/blog?category=${encodeURIComponent(term.name)}`, external: true },
                        ]}
                      />
                    </td>
                    <td style={{ color: '#646970' }}>{term.description || '—'}</td>
                    <td className="column-slug" style={{ color: '#646970' }}>
                      {term.slug}
                    </td>
                    <td>{usage[term._id] || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="wp-tablenav">
            <Pagination page={page} pages={pages} total={items.length} onPage={setPage} noun="item" />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}
