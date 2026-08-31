import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { cn, EmptyState, Loading } from '../../components/ui/index.jsx'
import { Composer, LeaderboardRail, PostCard } from '../../components/community/index.jsx'
import { leaderboardRail } from '../../data/communityContent.js'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import { useFeatures } from '../../context/SiteConfigContext.jsx'

const TABS = [
  { id: 'feed', label: 'Feed' },
  { id: 'messages', label: 'Messages' },
]

export default function Channel() {
  const { slug } = useParams()
  const [tab, setTab] = useState('feed')
  const features = useFeatures()

  const { data, isPending, error } = useQuery({
    queryKey: ['channel', slug],
    queryFn: async () => (await api.get(`/channels/${slug}/posts`)).data,
  })

  useDocumentTitle(
    data?.channel ? `#${data.channel.name} | Growth Scholar` : 'Channel | Growth Scholar',
  )

  if (isPending) return <Loading />
  if (error) {
    return <EmptyState icon="🚧" title="Channel not found" body={apiError(error)} />
  }

  const { channel, posts } = data

  return (
    <div className="mx-auto grid max-w-shell grid-cols-[1fr_320px] gap-6 mx-1100:grid-cols-1">
      <div className="grid content-start gap-4">
        <header className="rounded-lg2 border border-line bg-white p-5">
          <p className="text-[0.72rem] font-bold uppercase tracking-wide text-muted">
            {channel.group}
          </p>
          <h1 className="mt-1 text-[1.35rem]"># {channel.name}</h1>
          {channel.description && (
            <p className="mt-1 text-[0.9rem] text-muted">{channel.description}</p>
          )}

          <div className="mt-4 flex gap-1 border-b border-line" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2 text-[0.88rem] font-semibold transition-colors duration-200 ease-gs',
                  tab === t.id
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-brand',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {tab === 'feed' ? (
          <>
            <Composer channelSlug={slug} />
            {posts.length === 0 ? (
              <EmptyState
                icon="💬"
                title="No posts in this channel yet"
                body="Start the conversation above."
              />
            ) : (
              posts.map((post) => <PostCard key={post._id} post={post} />)
            )}
          </>
        ) : (
          <EmptyState
            icon="✉"
            title="Direct messages"
            body="Messaging is not part of this build."
          />
        )}
      </div>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg2 border border-line bg-white p-5">
          <h3 className="text-[1rem]">About this channel</h3>
          <dl className="mt-3 grid gap-2 text-[0.85rem]">
            <div className="flex justify-between">
              <dt className="text-muted">Group</dt>
              <dd className="font-semibold text-brand-deep">{channel.group}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Members</dt>
              <dd className="font-semibold text-brand-deep">{channel.memberIds?.length || 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Posts</dt>
              <dd className="font-semibold text-brand-deep">{posts.length}</dd>
            </div>
          </dl>
        </section>

        {/*
          The leaderboard is a hardcoded list of eight invented people — nothing
          in the product awards seeds, so it can only ever be fabricated. Gated
          on FEATURE_GAMIFICATION for the same reason task 5 hid the rest of the
          module: showing customers invented leaders is worse than showing them
          nothing. The data and the component are kept, so it is reversible.
        */}
        {features.gamification && <LeaderboardRail entries={leaderboardRail} />}
      </aside>
    </div>
  )
}
