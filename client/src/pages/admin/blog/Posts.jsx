import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../../api/client.js'
import useDocumentTitle from '../../../hooks/useDocumentTitle.js'
import {
  ConfirmDialog,
  fmtDateTime,
  Icon,
  Pagination,
  RowActions,
  ScreenMeta,
  SortableTh,
  Spinner,
  toLocalInput,
  useNotices,
  useScreenOption,
  Views,
} from './wp.jsx'

/**
 * Posts → All Posts.
 *
 * A faithful wp-admin list table: status views with counts, bulk actions
 * including inline Bulk Edit, date/category filters, sortable columns, hover
 * row actions, inline Quick Edit, Screen Options and pagination.
 */

const VIEW_LABELS = [
  ['', 'All'],
  ['Published', 'Published'],
  ['Scheduled', 'Scheduled'],
  ['Draft', 'Draft'],
  ['Pending', 'Pending'],
  ['Archived', 'Archived'],
  ['Trash', 'Trash'],
]

const ALL_COLUMNS = [
  ['author', 'Author'],
  ['categories', 'Categories'],
  ['tags', 'Tags'],
  ['comments', 'Comments'],
  ['date', 'Date'],
]

/** The "— Draft", "— Password protected" suffixes WordPress puts after a title. */
function postStates(post, view) {
  const states = []
  if (post.status !== 'Published' && post.status !== view && post.status !== 'Trash') states.push(post.status)
  if (post.featured) states.push('Sticky')
  if (post.visibility === 'Password') states.push('Password protected')
  if (post.visibility === 'Private') states.push('Private')
  return states
}

export default function Posts() {
  useDocumentTitle('Posts | Growth Scholar Blog')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notices = useNotices()

  const [view, setView] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useScreenOption('posts-per-page', 20)
  const [columns, setColumns] = useScreenOption('posts-columns', ['author', 'categories', 'tags', 'comments', 'date'])
  const [orderby, setOrderby] = useState('date')
  const [order, setOrder] = useState('desc')
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [month, setMonth] = useState('')
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState([])
  const [bulkAction, setBulkAction] = useState('')
  const [bulkEditing, setBulkEditing] = useState(false)
  const [quickEdit, setQuickEdit] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const params = {
    ...(view ? { status: view } : {}),
    ...(search ? { q: search } : {}),
    ...(month ? { m: month } : {}),
    ...(category ? { category } : {}),
    page,
    perPage,
    orderby,
    order,
  }

  const posts = useQuery({
    queryKey: ['admin', 'blog', 'list', params],
    queryFn: async () => (await api.get('/admin/blog', { params })).data,
    placeholderData: (previous) => previous,
  })
  const categories = useQuery({
    queryKey: ['admin', 'taxonomy', 'blog-category'],
    queryFn: async () => (await api.get('/admin/taxonomy', { params: { taxonomy: 'blog-category' } })).data,
  })
  const tags = useQuery({
    queryKey: ['admin', 'taxonomy', 'tag'],
    queryFn: async () => (await api.get('/admin/taxonomy', { params: { taxonomy: 'tag' } })).data,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] })
    queryClient.invalidateQueries({ queryKey: ['blog'] })
  }
  const fail = (err) => notices.notify(apiError(err), 'error')

  const bulk = useMutation({
    mutationFn: async (payload) => (await api.post('/admin/blog/bulk', payload)).data,
    onSuccess: (result, payload) => {
      refresh()
      setSelected([])
      setBulkEditing(false)
      setBulkAction('')
      const verb = { trash: 'moved to the Trash', restore: 'restored', delete: 'permanently deleted', edit: 'updated' }[payload.action]
      notices.notify(`${result.affected} post${result.affected === 1 ? '' : 's'} ${verb}.`)
    },
    onError: fail,
  })
  const rowAction = useMutation({
    mutationFn: async ({ id, action }) =>
      action === 'delete'
        ? (await api.delete(`/admin/blog/${id}`)).data
        : (await api.post(`/admin/blog/${id}/${action}`)).data,
    onSuccess: (result, { action }) => {
      refresh()
      if (action === 'duplicate') {
        notices.notify('Draft copy created.')
        navigate(`/admin/blog/post/${result._id}`)
        return
      }
      notices.notify(
        { trash: '1 post moved to the Trash.', restore: '1 post restored from the Trash.', delete: '1 post permanently deleted.' }[action],
      )
    },
    onError: fail,
  })
  const saveQuick = useMutation({
    mutationFn: async (post) => (await api.put(`/admin/blog/${post._id}`, post)).data,
    onSuccess: () => {
      refresh()
      setQuickEdit(null)
      notices.notify('Post updated.')
    },
    onError: fail,
  })
  const emptyTrash = useMutation({
    mutationFn: async () => (await api.post('/admin/blog/empty-trash')).data,
    onSuccess: (result) => {
      refresh()
      notices.notify(`${result.affected} post${result.affected === 1 ? '' : 's'} permanently deleted.`)
    },
    onError: fail,
  })

  const items = posts.data?.items || []
  const counts = posts.data?.counts || {}
  const allChecked = items.length > 0 && selected.length === items.length
  const inTrash = view === 'Trash'
  const shown = useMemo(() => ALL_COLUMNS.filter(([key]) => columns.includes(key)), [columns])

  const toggleAll = () => setSelected(allChecked ? [] : items.map((post) => post._id))
  const toggleOne = (id) => setSelected((rows) => (rows.includes(id) ? rows.filter((row) => row !== id) : [...rows, id]))
  const resetPage = (fn) => (value) => {
    setPage(1)
    fn(value)
  }

  const applyBulk = () => {
    if (!bulkAction) return notices.notify('Select a bulk action first.', 'error')
    if (!selected.length) return notices.notify('Select at least one post.', 'error')
    if (bulkAction === 'edit') return setBulkEditing(true)
    if (bulkAction === 'delete') {
      return setConfirm({
        title: 'Delete permanently',
        message: `Permanently delete ${selected.length} post${selected.length === 1 ? '' : 's'}? This cannot be undone.`,
        confirmLabel: 'Delete permanently',
        destructive: true,
        onConfirm: () => bulk.mutate({ ids: selected, action: 'delete' }),
      })
    }
    return bulk.mutate({ ids: selected, action: bulkAction })
  }

  return (
    <div className="wp-wrap">
      <ScreenMeta
        options={
          <>
            <h5>Columns</h5>
            <div className="wp-screen-options-row">
              {ALL_COLUMNS.map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={columns.includes(key)}
                    onChange={() =>
                      setColumns(columns.includes(key) ? columns.filter((c) => c !== key) : [...columns, key])
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <h5 style={{ marginTop: 16 }}>Pagination</h5>
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
          </>
        }
        help={
          <>
            <h5>Overview</h5>
            <p>
              This screen lists every post. Hover a row to reveal its actions: <strong>Edit</strong> opens the block
              editor, <strong>Quick Edit</strong> changes the common fields without leaving the list, and{' '}
              <strong>Trash</strong> is reversible until you empty the Trash.
            </p>
            <h5>Bulk actions</h5>
            <p>
              Tick rows, choose an action, then press Apply. <strong>Edit</strong> opens an inline panel that changes
              category, tags, status or comment settings on every selected post at once.
            </p>
          </>
        }
      />

      <div className="wp-heading-row">
        <h1 className="wp-heading-inline">Posts</h1>
        <Link to="/admin/blog/new" className="wp-button wp-page-title-action">
          Add New Post
        </Link>
        {search && (
          <span className="wp-subtitle">
            Search results for: <strong>{search}</strong>
          </span>
        )}
      </div>
      <hr className="wp-hr" />
      {notices.node}

      <Views
        views={VIEW_LABELS.map(([value, label]) => ({
          value,
          label,
          count: value === '' ? counts.all : counts[value],
        })).filter((entry) => entry.value !== 'Trash' || counts.Trash > 0)}
        current={view}
        onChange={(value) => {
          setView(value)
          setPage(1)
          setSelected([])
        }}
      />

      <form
        className="wp-tablenav"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setSearch(searchDraft)
        }}
      >
        <div className="wp-alignleft">
          <label className="wp-screen-reader-text" htmlFor="bulk-action">
            Select bulk action
          </label>
          <select id="bulk-action" value={bulkAction} onChange={(event) => setBulkAction(event.target.value)}>
            <option value="">Bulk actions</option>
            {inTrash ? (
              <>
                <option value="restore">Restore</option>
                <option value="delete">Delete permanently</option>
              </>
            ) : (
              <>
                <option value="edit">Edit</option>
                <option value="trash">Move to Trash</option>
              </>
            )}
          </select>
          <button type="button" className="wp-button" onClick={applyBulk} disabled={bulk.isPending}>
            Apply
          </button>

          <select
            aria-label="Filter by date"
            value={month}
            onChange={(event) => resetPage(setMonth)(event.target.value)}
          >
            <option value="">All dates</option>
            {(posts.data?.months || []).map((entry) => (
              <option key={entry.key} value={entry.key}>
                {`${entry.key.slice(0, 4)}/${entry.key.slice(4)}`} ({entry.count})
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(event) => resetPage(setCategory)(event.target.value)}
          >
            <option value="">All categories</option>
            {(categories.data?.items || []).map((term) => (
              <option key={term._id} value={term.name}>
                {term.name}
              </option>
            ))}
          </select>
          {inTrash && counts.Trash > 0 && (
            <button
              type="button"
              className="wp-button"
              onClick={() =>
                setConfirm({
                  title: 'Empty Trash',
                  message: `Permanently delete all ${counts.Trash} post(s) in the Trash? This cannot be undone.`,
                  confirmLabel: 'Empty Trash',
                  destructive: true,
                  onConfirm: () => emptyTrash.mutate(),
                })
              }
            >
              Empty Trash
            </button>
          )}
          {posts.isFetching && <Spinner />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <input
            type="search"
            value={searchDraft}
            aria-label="Search posts"
            placeholder="Search posts"
            onChange={(event) => setSearchDraft(event.target.value)}
            style={{ width: 200 }}
          />
          <button type="submit" className="wp-button">
            Search Posts
          </button>
        </div>
      </form>

      <div className="wp-tablenav">
        <Pagination
          page={posts.data?.page || 1}
          pages={posts.data?.pages || 1}
          total={posts.data?.total || 0}
          onPage={setPage}
          noun="item"
        />
      </div>

      {bulkEditing && (
        <BulkEdit
          count={selected.length}
          titles={items.filter((post) => selected.includes(post._id)).map((post) => post.title)}
          categories={categories.data?.items || []}
          onCancel={() => setBulkEditing(false)}
          onApply={(values) => bulk.mutate({ ids: selected, action: 'edit', ...values })}
          saving={bulk.isPending}
        />
      )}

      <table className="wp-list-table striped">
        <thead>
          <tr>
            <td className="check-column">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all posts" />
            </td>
            <SortableTh
              column="title"
              label="Title"
              orderby={orderby}
              order={order}
              className="column-title"
              onSort={(c, o) => {
                setOrderby(c)
                setOrder(o)
              }}
            />
            {shown.map(([key, label]) =>
              key === 'date' || key === 'author' ? (
                <SortableTh
                  key={key}
                  column={key === 'date' ? 'date' : 'author'}
                  label={label}
                  orderby={orderby}
                  order={order}
                  className={`column-${key}`}
                  onSort={(c, o) => {
                    setOrderby(c)
                    setOrder(o)
                  }}
                />
              ) : (
                <th key={key} scope="col" className={`column-${key}`}>
                  {key === 'comments' ? <Icon name="comments" size={16} aria-label="Comments" /> : label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {posts.isPending ? (
            <tr>
              <td colSpan={shown.length + 2} className="wp-no-items">
                <Spinner label="Loading posts…" />
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={shown.length + 2} className="wp-no-items">
                No posts found.
              </td>
            </tr>
          ) : (
            items.map((post) =>
              quickEdit?._id === post._id ? (
                <QuickEdit
                  key={post._id}
                  post={quickEdit}
                  colSpan={shown.length + 2}
                  categories={categories.data?.items || []}
                  allTags={tags.data?.items || []}
                  onChange={setQuickEdit}
                  onCancel={() => setQuickEdit(null)}
                  onSave={() => saveQuick.mutate(quickEdit)}
                  saving={saveQuick.isPending}
                />
              ) : (
                <tr key={post._id}>
                  <th scope="row" className="check-column">
                    <input
                      type="checkbox"
                      checked={selected.includes(post._id)}
                      onChange={() => toggleOne(post._id)}
                      aria-label={`Select ${post.title}`}
                    />
                  </th>
                  <td className="column-title">
                    <strong>
                      {inTrash ? (
                        <span style={{ fontSize: 14 }}>{post.title}</span>
                      ) : (
                        <button type="button" className="row-title" onClick={() => navigate(`/admin/blog/post/${post._id}`)}>
                          {post.title}
                        </button>
                      )}
                      {postStates(post, view).map((state) => (
                        <span key={state} className="post-state">
                          {' '}
                          — {state}
                        </span>
                      ))}
                    </strong>
                    <RowActions
                      actions={
                        inTrash
                          ? [
                              { label: 'Restore', onClick: () => rowAction.mutate({ id: post._id, action: 'restore' }) },
                              {
                                label: 'Delete permanently',
                                destructive: true,
                                onClick: () =>
                                  setConfirm({
                                    title: 'Delete permanently',
                                    message: `Permanently delete “${post.title}”? This cannot be undone.`,
                                    confirmLabel: 'Delete permanently',
                                    destructive: true,
                                    onConfirm: () => rowAction.mutate({ id: post._id, action: 'delete' }),
                                  }),
                              },
                            ]
                          : [
                              { label: 'Edit', onClick: () => navigate(`/admin/blog/post/${post._id}`) },
                              {
                                label: 'Quick Edit',
                                onClick: () =>
                                  setQuickEdit({
                                    ...post,
                                    publishedAt: post.publishedAt,
                                    tags: post.tags || [],
                                  }),
                              },
                              {
                                label: 'Trash',
                                destructive: true,
                                onClick: () => rowAction.mutate({ id: post._id, action: 'trash' }),
                              },
                              {
                                label: post.status === 'Published' ? 'View' : 'Preview',
                                href: `/blog/${post.slug}`,
                                external: true,
                              },
                              { label: 'Duplicate', onClick: () => rowAction.mutate({ id: post._id, action: 'duplicate' }) },
                            ]
                      }
                    />
                  </td>
                  {shown.map(([key]) => (
                    <td key={key} className={`column-${key}`}>
                      {key === 'author' && (post.author?.name || '—')}
                      {key === 'categories' && (post.category || '—')}
                      {key === 'tags' && (post.tags?.length ? post.tags.join(', ') : '—')}
                      {key === 'comments' && (
                        <CommentBubble
                          counts={posts.data?.commentCounts?.[post._id]}
                          onClick={() => navigate(`/admin/blog/comments?postId=${post._id}`)}
                        />
                      )}
                      {key === 'date' && (
                        <>
                          <span style={{ display: 'block' }}>
                            {post.status === 'Scheduled' ? 'Scheduled' : post.status === 'Published' ? 'Published' : 'Last Modified'}
                          </span>
                          <span>{fmtDateTime(post.status === 'Published' || post.status === 'Scheduled' ? post.publishedAt : post.updatedAt)}</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ),
            )
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="check-column">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all posts" />
            </td>
            <th scope="col" className="column-title">
              Title
            </th>
            {shown.map(([key, label]) => (
              <th key={key} scope="col" className={`column-${key}`}>
                {label}
              </th>
            ))}
          </tr>
        </tfoot>
      </table>

      <div className="wp-tablenav">
        <div className="wp-alignleft">
          <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value)} aria-label="Select bulk action">
            <option value="">Bulk actions</option>
            {inTrash ? (
              <>
                <option value="restore">Restore</option>
                <option value="delete">Delete permanently</option>
              </>
            ) : (
              <>
                <option value="edit">Edit</option>
                <option value="trash">Move to Trash</option>
              </>
            )}
          </select>
          <button type="button" className="wp-button" onClick={applyBulk}>
            Apply
          </button>
        </div>
        <Pagination
          page={posts.data?.page || 1}
          pages={posts.data?.pages || 1}
          total={posts.data?.total || 0}
          onPage={setPage}
          noun="item"
        />
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

function CommentBubble({ counts, onClick }) {
  const total = counts?.total || 0
  const pending = counts?.pending || 0
  return (
    <button
      type="button"
      className={`wp-comment-bubble ${pending ? 'has-pending' : ''} ${total ? '' : 'is-zero'}`}
      onClick={onClick}
      aria-label={`${total} comments, ${pending} awaiting moderation`}
      title={pending ? `${pending} awaiting moderation` : `${total} comments`}
    >
      {total}
    </button>
  )
}

/* ------------------------------- quick edit ------------------------------- */

function QuickEdit({ post, colSpan, categories, allTags, onChange, onCancel, onSave, saving }) {
  const set = (key, value) => onChange({ ...post, [key]: value })
  return (
    <tr className="wp-quick-edit">
      <td colSpan={colSpan}>
        <div className="wp-quick-edit-inner">
          <fieldset>
            <legend>Quick Edit</legend>
            <div className="wp-quick-edit-grid">
              <label>
                Title
                <input type="text" value={post.title || ''} onChange={(event) => set('title', event.target.value)} />
              </label>
              <label>
                Slug
                <input type="text" value={post.slug || ''} onChange={(event) => set('slug', event.target.value)} />
              </label>
              <label>
                Date
                <input
                  type="datetime-local"
                  value={toLocalInput(post.publishedAt)}
                  onChange={(event) => set('publishedAt', event.target.value ? new Date(event.target.value).toISOString() : null)}
                />
              </label>
              <label>
                Category
                <select value={post.category || ''} onChange={(event) => set('category', event.target.value)}>
                  <option value="">— No category —</option>
                  {categories.map((term) => (
                    <option key={term._id} value={term.name}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tags (comma separated)
                <input
                  type="text"
                  list="quick-edit-tags"
                  value={(post.tags || []).join(', ')}
                  onChange={(event) =>
                    set(
                      'tags',
                      event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
                    )
                  }
                />
                <datalist id="quick-edit-tags">
                  {allTags.map((term) => (
                    <option key={term._id} value={term.name} />
                  ))}
                </datalist>
              </label>
              <label>
                Status
                <select value={post.status || 'Draft'} onChange={(event) => set('status', event.target.value)}>
                  <option>Draft</option>
                  <option>Pending</option>
                  <option>Published</option>
                  <option>Archived</option>
                </select>
              </label>
              <label>
                Visibility
                <select value={post.visibility || 'Public'} onChange={(event) => set('visibility', event.target.value)}>
                  <option>Public</option>
                  <option>Private</option>
                  <option>Password</option>
                </select>
              </label>
              {post.visibility === 'Password' && (
                <label>
                  Password
                  <input type="text" value={post.password || ''} onChange={(event) => set('password', event.target.value)} />
                </label>
              )}
              <label className="inline">
                <input
                  type="checkbox"
                  checked={Boolean(post.allowComments)}
                  onChange={(event) => set('allowComments', event.target.checked)}
                />
                Allow comments
              </label>
              <label className="inline">
                <input type="checkbox" checked={Boolean(post.featured)} onChange={(event) => set('featured', event.target.checked)} />
                Make this post sticky
              </label>
            </div>
          </fieldset>
          <div className="wp-quick-edit-actions">
            <button type="button" className="wp-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="wp-button wp-button-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Updating…' : 'Update'}
            </button>
            {saving && <Spinner />}
          </div>
        </div>
      </td>
    </tr>
  )
}

/* -------------------------------- bulk edit ------------------------------- */

function BulkEdit({ count, titles, categories, onCancel, onApply, saving }) {
  const [values, setValues] = useState({ status: '', category: '', addTags: '', allowComments: '', sticky: '' })
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }))
  return (
    <div className="wp-quick-edit" style={{ border: '1px solid #c3c4c7', borderBottom: 0, background: '#fff' }}>
      <div className="wp-quick-edit-inner">
        <fieldset>
          <legend>Bulk Edit — {count} post{count === 1 ? '' : 's'}</legend>
          <div className="editor-token-list" style={{ marginBottom: 12, border: '1px solid #dcdcde' }}>
            {titles.map((title) => (
              <span key={title} className="editor-token">
                {title}
              </span>
            ))}
          </div>
          <div className="wp-quick-edit-grid">
            <label>
              Category
              <select value={values.category} onChange={(event) => set('category', event.target.value)}>
                <option value="">— No change —</option>
                {categories.map((term) => (
                  <option key={term._id} value={term.name}>
                    {term.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Add tags (comma separated)
              <input type="text" value={values.addTags} onChange={(event) => set('addTags', event.target.value)} />
            </label>
            <label>
              Status
              <select value={values.status} onChange={(event) => set('status', event.target.value)}>
                <option value="">— No change —</option>
                <option>Draft</option>
                <option>Pending</option>
                <option>Published</option>
                <option>Archived</option>
              </select>
            </label>
            <label>
              Comments
              <select value={values.allowComments} onChange={(event) => set('allowComments', event.target.value)}>
                <option value="">— No change —</option>
                <option value="open">Allow</option>
                <option value="closed">Do not allow</option>
              </select>
            </label>
            <label>
              Sticky
              <select value={values.sticky} onChange={(event) => set('sticky', event.target.value)}>
                <option value="">— No change —</option>
                <option value="sticky">Sticky</option>
                <option value="unsticky">Not sticky</option>
              </select>
            </label>
          </div>
        </fieldset>
        <div className="wp-quick-edit-actions">
          <button type="button" className="wp-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="wp-button wp-button-primary"
            disabled={saving}
            onClick={() =>
              onApply({
                ...values,
                addTags: values.addTags.split(',').map((tag) => tag.trim()).filter(Boolean),
              })
            }
          >
            {saving ? 'Updating…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}
