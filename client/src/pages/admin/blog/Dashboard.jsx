import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../../api/client.js'
import useDocumentTitle from '../../../hooks/useDocumentTitle.js'
import { fmtDateTime, Icon, Postbox, Spinner, timeAgo, useNotices } from './wp.jsx'

/**
 * The blog Dashboard.
 *
 * WordPress's three working widgets — At a Glance, Activity and Quick Draft —
 * without the ones that only make sense for a hosted WordPress install.
 */
export default function Dashboard() {
  useDocumentTitle('Dashboard | Growth Scholar Blog')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notices = useNotices()
  const [draft, setDraft] = useState({ title: '', text: '' })

  const posts = useQuery({
    queryKey: ['admin', 'blog', 'dashboard-posts'],
    queryFn: async () => (await api.get('/admin/blog', { params: { perPage: 5, orderby: 'modified' } })).data,
  })
  const scheduled = useQuery({
    queryKey: ['admin', 'blog', 'dashboard-scheduled'],
    queryFn: async () =>
      (await api.get('/admin/blog', { params: { status: 'Scheduled', perPage: 5, orderby: 'date', order: 'asc' } })).data,
  })
  const comments = useQuery({
    queryKey: ['admin', 'blog', 'dashboard-comments'],
    queryFn: async () => (await api.get('/admin/blog/comments', { params: { perPage: 5 } })).data,
  })
  const media = useQuery({
    queryKey: ['admin', 'media', 'dashboard'],
    queryFn: async () => (await api.get('/admin/media', { params: { perPage: 1 } })).data,
  })

  const quickDraft = useMutation({
    mutationFn: async (values) =>
      (
        await api.post('/admin/blog', {
          title: values.title,
          status: 'Draft',
          body: values.text ? [{ type: 'p', text: values.text }] : [],
        })
      ).data,
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] })
      setDraft({ title: '', text: '' })
      notices.notify('Draft saved.')
      navigate(`/admin/blog/post/${post._id}`)
    },
    onError: (err) => notices.notify(apiError(err), 'error'),
  })

  const counts = posts.data?.counts || {}
  const commentCounts = comments.data?.counts || {}

  const glance = [
    ['post', `${counts.Published || 0} Published`, '/admin/blog?status=Published'],
    ['edit', `${counts.Draft || 0} Draft`, '/admin/blog'],
    ['clock', `${counts.Scheduled || 0} Scheduled`, '/admin/blog'],
    ['media', `${media.data?.total || 0} Media items`, '/admin/blog/media'],
    ['comments', `${commentCounts.Approved || 0} Approved comments`, '/admin/blog/comments'],
    ['warning', `${commentCounts.Pending || 0} Pending comments`, '/admin/blog/comments'],
  ]

  return (
    <div className="wp-wrap">
      <div className="wp-heading-row">
        <h1 className="wp-heading-inline">Dashboard</h1>
        <Link to="/admin/blog/new" className="wp-button wp-page-title-action">
          Add New Post
        </Link>
      </div>
      <hr className="wp-hr" />
      {notices.node}

      {commentCounts.Pending > 0 && (
        <div className="wp-notice wp-notice-warning">
          <p>
            {commentCounts.Pending} comment{commentCounts.Pending === 1 ? '' : 's'} awaiting moderation.{' '}
            <Link to="/admin/blog/comments?status=Pending">Moderate now</Link>
          </p>
        </div>
      )}

      <div className="wp-columns-dashboard">
        <Postbox title="At a Glance">
          {posts.isPending ? (
            <Spinner label="Loading…" />
          ) : (
            <div className="wp-glance">
              {glance.map(([icon, label, to]) => (
                <button key={label} type="button" onClick={() => navigate(to)}>
                  <Icon name={icon} size={16} style={{ fill: '#646970' }} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </Postbox>

        <Postbox title="Activity">
          {scheduled.data?.items?.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>Publishing soon</h3>
              <ul className="wp-activity-list" style={{ marginBottom: 16 }}>
                {scheduled.data.items.map((post) => (
                  <li key={post._id}>
                    <span className="wp-activity-date">{fmtDateTime(post.publishedAt)}</span>{' '}
                    <Link to={`/admin/blog/post/${post._id}`}>{post.title}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>Recently updated</h3>
          {posts.isPending ? (
            <Spinner label="Loading…" />
          ) : posts.data?.items?.length ? (
            <ul className="wp-activity-list">
              {posts.data.items.map((post) => (
                <li key={post._id}>
                  <span className="wp-activity-date">{timeAgo(post.updatedAt)}</span>{' '}
                  <Link to={`/admin/blog/post/${post._id}`}>{post.title}</Link>{' '}
                  <span style={{ color: '#646970' }}>— {post.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#646970' }}>No posts yet.</p>
          )}

          <h3 style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 6px' }}>Recent comments</h3>
          {comments.data?.items?.length ? (
            <ul className="wp-activity-list">
              {comments.data.items.map((comment) => (
                <li key={comment._id}>
                  <strong>{comment.name}</strong>{' '}
                  <span style={{ color: '#646970' }}>on {comment.postId?.title || 'a deleted post'}</span>
                  <p style={{ margin: '2px 0 0', color: '#50575e' }}>
                    {comment.body.slice(0, 120)}
                    {comment.body.length > 120 ? '…' : ''}
                  </p>
                  {comment.status === 'Pending' && (
                    <span className="post-state" style={{ color: '#b32d2e' }}>
                      Pending
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#646970' }}>No comments yet.</p>
          )}
        </Postbox>

        <Postbox title="Quick Draft">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (draft.title.trim()) quickDraft.mutate(draft)
            }}
          >
            <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>Title</span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="What is this about?"
              />
            </label>
            <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>Content</span>
              <textarea
                rows={4}
                value={draft.text}
                onChange={(event) => setDraft({ ...draft, text: event.target.value })}
                placeholder="What is on your mind?"
              />
            </label>
            <button
              type="submit"
              className="wp-button wp-button-primary"
              disabled={!draft.title.trim() || quickDraft.isPending}
            >
              {quickDraft.isPending ? 'Saving…' : 'Save Draft'}
            </button>
          </form>
        </Postbox>
      </div>
    </div>
  )
}
