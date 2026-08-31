import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn } from '../ui/index.jsx'

const relative = (date) => {
  const mins = Math.round((Date.now() - new Date(date)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24)
    return `Today · ${new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

/* -------------------------------- Composer -------------------------------- */
export function Composer({ channelSlug, onPosted }) {
  const [body, setBody] = useState('')
  const [focused, setFocused] = useState(false)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [error, setError] = useState(null)

  const post = useMutation({
    mutationFn: async () => (await api.post('/posts', { body, channelSlug })).data,
    onSuccess: () => {
      setBody('')
      setFocused(false)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['channel'] })
      onPosted?.()
    },
    onError: (err) => setError(apiError(err)),
  })

  return (
    <section
      className={cn(
        'rounded-lg2 border bg-white p-4 transition-colors duration-200 ease-gs',
        focused ? 'border-brand shadow-tiny' : 'border-line',
      )}
    >
      <div className="flex gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-[0.72rem] font-bold text-white">
          {user?.avatarInitials || 'AR'}
        </span>
        <textarea
          data-composer
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Share a win, ask a question, drop a campaign teardown…"
          rows={focused ? 4 : 2}
          aria-label="Write a post"
          className="w-full resize-none border-0 text-[0.92rem] outline-none placeholder:text-muted/70"
        />
      </div>

      {focused && (
        <>
          {error && <p className="mt-2 text-[0.8rem] text-danger">{error}</p>}
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <div className="flex gap-1 text-[1rem] text-muted" aria-hidden="true">
              {['🖼', '▶', '▤', '📎'].map((i) => (
                <span
                  key={i}
                  className="grid h-8 w-8 place-items-center rounded-md2 hover:bg-surface-mist"
                >
                  {i}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFocused(false)
                  setBody('')
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => post.mutate()}
                disabled={!body.trim() || post.isPending}
              >
                {post.isPending ? 'Posting…' : 'Post'}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

/* -------------------------------- PostCard -------------------------------- */
/**
 * Report / block / delete, on one post.
 *
 * Every action here is enforced server-side. The menu decides what is worth
 * offering, not what is permitted: user A hitting the delete endpoint against
 * user B's post gets a 403 regardless of what this renders.
 */
function PostMenu({ post, isAuthor, isAdmin, onChanged }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  const act = async (fn, message) => {
    setBusy(true)
    try {
      await fn()
      setDone(message)
      onChanged?.()
    } catch (err) {
      setDone(apiError(err))
    } finally {
      setBusy(false)
      setTimeout(() => setOpen(false), 1200)
    }
  }

  const report = () =>
    act(
      () => api.post('/reports', { targetType: 'post', targetId: post._id, reason: 'other' }),
      'Reported — a moderator will take a look.',
    )

  const block = () =>
    act(
      () => api.post('/blocks', { userId: post.authorId?._id || post.authorId }),
      'Blocked. You will not see their posts.',
    )

  const remove = () => act(() => api.delete(`/posts/${post._id}`), 'Deleted.')

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        aria-label="Post options"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-mist hover:text-brand"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-md2 border border-line bg-white py-1 shadow-soft"
          onMouseLeave={() => !busy && setOpen(false)}
        >
          {done ? (
            <p className="px-3 py-2 text-[0.8rem] text-muted">{done}</p>
          ) : (
            <>
              {(isAuthor || isAdmin) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={remove}
                  className="block w-full px-3 py-2 text-left text-[0.85rem] text-danger hover:bg-surface-mist"
                >
                  {isAuthor ? 'Delete my post' : 'Delete post (admin)'}
                </button>
              )}
              {!isAuthor && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={report}
                    className="block w-full px-3 py-2 text-left text-[0.85rem] text-muted hover:bg-surface-mist hover:text-brand"
                  >
                    Report this post
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={block}
                    className="block w-full px-3 py-2 text-left text-[0.85rem] text-muted hover:bg-surface-mist hover:text-brand"
                  >
                    Block {post.authorId?.name || 'this member'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function PostCard({ post }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [likes, setLikes] = useState(post.likes?.length || 0)
  const [liked, setLiked] = useState(
    (post.likes || []).some((id) => String(id) === String(user?.id)),
  )
  const authorId = String(post.authorId?._id || post.authorId || '')
  const isAuthor = Boolean(user) && authorId === String(user.id)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    setLikes(post.likes?.length || 0)
    setLiked((post.likes || []).some((id) => String(id) === String(user?.id)))
  }, [post.likes, user?.id])

  const toggleLike = useMutation({
    mutationFn: async () => (await api.post(`/posts/${post._id}/like`)).data,
    onSuccess: (res) => {
      setLikes(res.likes)
      setLiked(res.liked)
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  return (
    <article className="rounded-lg2 border border-line bg-white p-5">
      <header className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-[0.72rem] font-bold text-brand">
          {post.authorId?.avatarInitials}
        </span>
        <div>
          <p className="flex items-center gap-2 text-[0.9rem] font-semibold text-brand-deep">
            {post.authorId?.name}
            {post.authorId?.role === 'admin' && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-bold text-brand">
                Creator
              </span>
            )}
          </p>
          <p className="text-[0.75rem] text-muted">
            {relative(post.createdAt)}
            {post.channelId?.slug ? ` · #${post.channelId.slug}` : ''}
          </p>
        </div>
        {post.pinned && (
          <span className="ml-auto text-[0.72rem] font-semibold text-muted">📌 Pinned</span>
        )}
        {user && (
          <PostMenu
            post={post}
            isAuthor={isAuthor}
            isAdmin={isAdmin}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ['feed'] })
              queryClient.invalidateQueries({ queryKey: ['channel'] })
            }}
          />
        )}
      </header>

      <p className="mt-3 whitespace-pre-line text-[0.95rem] leading-relaxed">{post.body}</p>

      <footer className="mt-4 flex items-center gap-4 border-t border-line pt-3 text-[0.82rem]">
        <button
          type="button"
          onClick={() => toggleLike.mutate()}
          className={cn(
            'font-medium transition-colors',
            liked ? 'text-brand' : 'text-muted hover:text-brand',
          )}
        >
          👏 {likes}
        </button>
        <span className="text-muted">💬 {post.commentCount || 0}</span>
        <span className="ml-auto text-muted">🌱 Seed</span>
      </footer>
    </article>
  )
}

/* ------------------------------ Sidebar cards ----------------------------- */
export function ChallengeCard({ challenge }) {
  return (
    <section className="rounded-lg2 border border-line bg-white p-5">
      <p className="text-[0.72rem] font-bold uppercase tracking-wide text-accent-mid">
        {challenge.label}
      </p>
      <h3 className="mt-1 text-[1.05rem]">{challenge.title}</h3>
      <p className="mt-2 text-[0.88rem] text-muted">{challenge.body}</p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" to="/community/challenge-submission">
          {challenge.primaryCta}
        </Button>
        <Button size="sm" variant="outline">
          {challenge.secondaryCta}
        </Button>
      </div>
    </section>
  )
}

export function HuddleCard({ huddle }) {
  const [remaining, setRemaining] = useState(huddle.startsInSeconds)

  useEffect(() => {
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const hh = String(Math.floor(remaining / 3600)).padStart(2, '0')
  const mm = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <section className="flex items-center gap-3 rounded-lg2 border border-line bg-white p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.75rem] font-bold text-brand">
        {huddle.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-danger">
          <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-danger" /> Live soon
        </p>
        <h3 className="text-[1rem]">{huddle.title}</h3>
        <p className="text-[0.78rem] text-muted">
          Starts in{' '}
          <strong className="text-brand-deep">
            {hh}:{mm}:{ss}
          </strong>{' '}
          · {huddle.note}
        </p>
      </div>
      <Button size="sm">Join</Button>
    </section>
  )
}

export function LeaderboardRail({ entries }) {
  const [period, setPeriod] = useState('week')
  const medals = ['🥇', '🥈', '🥉']

  return (
    <section className="rounded-lg2 border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[1rem]">Leaderboard</h3>
        <span className="text-[0.75rem] text-muted">🌱 Seeds</span>
      </div>
      <div className="mb-3 flex rounded-full bg-surface-mist p-0.5">
        {[
          { id: 'all', label: 'All Time' },
          { id: 'month', label: 'Month' },
          { id: 'week', label: 'Week' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPeriod(t.id)}
            className={cn(
              'flex-1 rounded-full px-2 py-1 text-[0.75rem] font-semibold transition-colors duration-200 ease-gs',
              period === t.id ? 'bg-white text-brand shadow-tiny' : 'text-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ol className="grid gap-2">
        {entries.map((e, i) => (
          <li key={e.name} className="flex items-center gap-2.5">
            <span className="w-6 shrink-0 text-center text-[0.85rem]">{medals[i] || e.rank}</span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-mist text-[0.68rem] font-bold text-muted">
              {e.initials}
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.85rem] font-medium">{e.name}</span>
            <span className="shrink-0 text-[0.78rem] text-muted">
              <strong className="text-brand-deep">{e.points.toLocaleString('en-IN')}</strong> Seeds
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
