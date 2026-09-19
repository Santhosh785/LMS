import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../../api/client.js'
import useDocumentTitle from '../../../hooks/useDocumentTitle.js'
import {
  ConfirmDialog,
  fmtDateTime,
  Pagination,
  RowActions,
  ScreenMeta,
  Spinner,
  timeAgo,
  useNotices,
  useScreenOption,
  Views,
} from './wp.jsx'

/**
 * The Comments screen.
 *
 * WordPress's moderation queue, including the parts that make it usable: the
 * status rail with live counts, bulk approve/spam/trash, the inline reply box
 * that also approves what it answers, and inline editing of a comment's text.
 */

const VIEWS = [
  ['', 'All'],
  ['Pending', 'Pending'],
  ['Approved', 'Approved'],
  ['Spam', 'Spam'],
  ['Trash', 'Trash'],
]

export default function Comments() {
  useDocumentTitle('Comments | Growth Scholar Blog')
  const queryClient = useQueryClient()
  const notices = useNotices()
  const [searchParams, setSearchParams] = useSearchParams()
  const postId = searchParams.get('postId') || ''

  const [view, setView] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useScreenOption('comments-per-page', 20)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [selected, setSelected] = useState([])
  const [bulkAction, setBulkAction] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const params = {
    ...(view ? { status: view } : {}),
    ...(search ? { q: search } : {}),
    ...(postId ? { postId } : {}),
    page,
    perPage,
  }
  const comments = useQuery({
    queryKey: ['admin', 'blog', 'comments', params],
    queryFn: async () => (await api.get('/admin/blog/comments', { params })).data,
    placeholderData: (previous) => previous,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] })
    queryClient.invalidateQueries({ queryKey: ['blog'] })
  }
  const fail = (err) => notices.notify(apiError(err), 'error')

  const moderate = useMutation({
    mutationFn: async ({ id, ...patch }) => (await api.put(`/admin/blog/comments/${id}`, patch)).data,
    onSuccess: (_result, variables) => {
      refresh()
      setEditing(null)
      notices.notify(variables.status ? `Comment marked as ${variables.status.toLowerCase()}.` : 'Comment updated.')
    },
    onError: fail,
  })
  const bulk = useMutation({
    mutationFn: async (payload) => (await api.post('/admin/blog/comments/bulk', payload)).data,
    onSuccess: (result) => {
      refresh()
      setSelected([])
      setBulkAction('')
      notices.notify(`${result.affected} comment${result.affected === 1 ? '' : 's'} updated.`)
    },
    onError: fail,
  })
  const reply = useMutation({
    mutationFn: async ({ id, body }) => (await api.post(`/admin/blog/comments/${id}/reply`, { body })).data,
    onSuccess: () => {
      refresh()
      setReplyTo(null)
      setReplyText('')
      notices.notify('Reply published.')
    },
    onError: fail,
  })
  const emptySpam = useMutation({
    mutationFn: async () => (await api.post('/admin/blog/comments/empty-trash')).data,
    onSuccess: (result) => {
      refresh()
      notices.notify(`${result.affected} comment${result.affected === 1 ? '' : 's'} permanently deleted.`)
    },
    onError: fail,
  })

  const items = comments.data?.items || []
  const counts = comments.data?.counts || {}
  const allChecked = items.length > 0 && selected.length === items.length
  const inTrash = view === 'Trash'

  const applyBulk = () => {
    if (!bulkAction) return notices.notify('Select a bulk action first.', 'error')
    if (!selected.length) return notices.notify('Select at least one comment.', 'error')
    if (bulkAction === 'delete') {
      return setConfirm({
        title: 'Delete permanently',
        message: `Permanently delete ${selected.length} comment(s)? This cannot be undone.`,
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
            <h5>Moderating comments</h5>
            <p>
              A new comment waits as <strong>Pending</strong> and is invisible on the public article until you approve
              it. <strong>Reply</strong> approves the comment it answers, because answering something implies accepting
              it.
            </p>
            <h5>Spam and Trash</h5>
            <p>Both are reversible. Only “Delete permanently” removes a comment for good.</p>
          </>
        }
      />

      <div className="wp-heading-row">
        <h1 className="wp-heading-inline">Comments</h1>
        {postId && (
          <span className="wp-subtitle">
            on one post —{' '}
            <button
              type="button"
              className="wp-button-link"
              onClick={() => {
                searchParams.delete('postId')
                setSearchParams(searchParams)
              }}
            >
              show all comments
            </button>
          </span>
        )}
      </div>
      <hr className="wp-hr" />
      {notices.node}

      <Views
        views={VIEWS.map(([value, label]) => ({
          value,
          label,
          count: value === '' ? counts.all : counts[value],
        }))}
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
          <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value)} aria-label="Select bulk action">
            <option value="">Bulk actions</option>
            {inTrash ? (
              <>
                <option value="restore">Restore</option>
                <option value="delete">Delete permanently</option>
              </>
            ) : (
              <>
                <option value="approve">Approve</option>
                <option value="unapprove">Unapprove</option>
                <option value="spam">Mark as spam</option>
                <option value="trash">Move to Trash</option>
              </>
            )}
          </select>
          <button type="button" className="wp-button" onClick={applyBulk}>
            Apply
          </button>
          {inTrash && counts.Trash > 0 && (
            <button
              type="button"
              className="wp-button"
              onClick={() =>
                setConfirm({
                  title: 'Empty Trash',
                  message: `Permanently delete all ${counts.Trash} comment(s) in the Trash?`,
                  confirmLabel: 'Empty Trash',
                  destructive: true,
                  onConfirm: () => emptySpam.mutate(),
                })
              }
            >
              Empty Trash
            </button>
          )}
          {comments.isFetching && <Spinner />}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <input
            type="search"
            value={searchDraft}
            placeholder="Search comments"
            aria-label="Search comments"
            onChange={(event) => setSearchDraft(event.target.value)}
            style={{ width: 200 }}
          />
          <button type="submit" className="wp-button">
            Search Comments
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
                aria-label="Select all comments"
                onChange={() => setSelected(allChecked ? [] : items.map((row) => row._id))}
              />
            </td>
            <th scope="col" style={{ width: '18%' }}>
              Author
            </th>
            <th scope="col">Comment</th>
            <th scope="col" className="column-inresponse" style={{ width: '20%' }}>
              In response to
            </th>
            <th scope="col" className="column-date" style={{ width: '14%' }}>
              Submitted on
            </th>
          </tr>
        </thead>
        <tbody>
          {comments.isPending ? (
            <tr>
              <td colSpan={5} className="wp-no-items">
                <Spinner label="Loading comments…" />
              </td>
            </tr>
          ) : !items.length ? (
            <tr>
              <td colSpan={5} className="wp-no-items">
                No comments found.
              </td>
            </tr>
          ) : (
            items.map((comment) => (
              <tr key={comment._id} style={comment.status === 'Pending' ? { background: '#fcf9e8' } : undefined}>
                <th scope="row" className="check-column">
                  <input
                    type="checkbox"
                    checked={selected.includes(comment._id)}
                    aria-label={`Select comment by ${comment.name}`}
                    onChange={() =>
                      setSelected((rows) =>
                        rows.includes(comment._id) ? rows.filter((row) => row !== comment._id) : [...rows, comment._id],
                      )
                    }
                  />
                </th>
                <td>
                  <strong>{comment.name}</strong>
                  {comment.byAdmin && <span className="post-state"> — you</span>}
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: '#646970', wordBreak: 'break-all' }}>
                    {comment.email}
                  </p>
                  {comment.website && (
                    <p style={{ margin: 0, fontSize: 13, wordBreak: 'break-all' }}>
                      <a href={comment.website} target="_blank" rel="noreferrer noopener">
                        {comment.website}
                      </a>
                    </p>
                  )}
                </td>
                <td>
                  {comment.parentId && <p style={{ margin: '0 0 4px', color: '#646970', fontSize: 13 }}>In reply to a comment</p>}
                  {editing?._id === comment._id ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <textarea
                        rows={4}
                        value={editing.body}
                        onChange={(event) => setEditing({ ...editing, body: event.target.value })}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="wp-button wp-button-primary wp-button-small"
                          onClick={() => moderate.mutate({ id: editing._id, body: editing.body, name: editing.name })}
                        >
                          Update
                        </button>
                        <button type="button" className="wp-button wp-button-small" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{comment.body}</p>
                  )}

                  {replyTo === comment._id && (
                    <div style={{ display: 'grid', gap: 6, marginTop: 10, padding: 10, background: '#f6f7f7', border: '1px solid #dcdcde' }}>
                      <strong style={{ fontSize: 13 }}>Reply to {comment.name}</strong>
                      <textarea
                        rows={3}
                        autoFocus
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder="Write your reply…"
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="wp-button wp-button-primary wp-button-small"
                          disabled={!replyText.trim() || reply.isPending}
                          onClick={() => reply.mutate({ id: comment._id, body: replyText })}
                        >
                          {reply.isPending ? 'Replying…' : 'Reply'}
                        </button>
                        <button
                          type="button"
                          className="wp-button wp-button-small"
                          onClick={() => {
                            setReplyTo(null)
                            setReplyText('')
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <RowActions
                    actions={
                      inTrash
                        ? [
                            { label: 'Restore', onClick: () => bulk.mutate({ ids: [comment._id], action: 'restore' }) },
                            {
                              label: 'Delete permanently',
                              destructive: true,
                              onClick: () =>
                                setConfirm({
                                  title: 'Delete permanently',
                                  message: 'Permanently delete this comment? This cannot be undone.',
                                  confirmLabel: 'Delete permanently',
                                  destructive: true,
                                  onConfirm: () => bulk.mutate({ ids: [comment._id], action: 'delete' }),
                                }),
                            },
                          ]
                        : [
                            comment.status === 'Approved'
                              ? { label: 'Unapprove', onClick: () => moderate.mutate({ id: comment._id, status: 'Pending' }) }
                              : { label: 'Approve', onClick: () => moderate.mutate({ id: comment._id, status: 'Approved' }) },
                            { label: 'Reply', onClick: () => setReplyTo(comment._id) },
                            { label: 'Edit', onClick: () => setEditing({ ...comment }) },
                            comment.status === 'Spam'
                              ? { label: 'Not spam', onClick: () => moderate.mutate({ id: comment._id, status: 'Pending' }) }
                              : { label: 'Spam', onClick: () => moderate.mutate({ id: comment._id, status: 'Spam' }) },
                            {
                              label: 'Trash',
                              destructive: true,
                              onClick: () => moderate.mutate({ id: comment._id, status: 'Trash' }),
                            },
                          ]
                    }
                  />
                </td>
                <td className="column-inresponse">
                  {comment.postId ? (
                    <>
                      <Link to={`/admin/blog/post/${comment.postId._id}`}>{comment.postId.title}</Link>
                      <p style={{ margin: '2px 0 0' }}>
                        <a href={`/blog/${comment.postId.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
                          View Post
                        </a>
                      </p>
                    </>
                  ) : (
                    <span style={{ color: '#646970' }}>Post deleted</span>
                  )}
                </td>
                <td className="column-date" style={{ color: '#646970' }}>
                  {fmtDateTime(comment.createdAt)}
                  <br />
                  <span style={{ fontSize: 12 }}>{timeAgo(comment.createdAt)}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="wp-tablenav">
        <Pagination
          page={comments.data?.page || 1}
          pages={comments.data?.pages || 1}
          total={comments.data?.total || 0}
          onPage={setPage}
          noun="comment"
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
