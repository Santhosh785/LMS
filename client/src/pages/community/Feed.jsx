import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { EmptyState, Loading } from '../../components/ui/index.jsx'
import {
  ChallengeCard,
  Composer,
  HuddleCard,
  LeaderboardRail,
  PostCard,
} from '../../components/community/index.jsx'
import { featuredChallenge, huddle, leaderboardRail } from '../../data/communityContent.js'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import { useFeatures } from '../../context/SiteConfigContext.jsx'

export default function Feed() {
  useDocumentTitle('Community | Growth Scholar')
  const features = useFeatures()

  const { data, isPending } = useQuery({
    queryKey: ['feed'],
    queryFn: async () => (await api.get('/feed')).data,
  })

  const { data: live } = useQuery({
    queryKey: ['live'],
    queryFn: async () => (await api.get('/live')).data,
  })

  return (
    <div className="mx-auto grid max-w-shell grid-cols-[1fr_320px] gap-6 mx-1100:grid-cols-1">
      <div className="grid content-start gap-4">
        <Composer />
        <ChallengeCard challenge={featuredChallenge} />
        <HuddleCard huddle={huddle} />

        <h2 className="mt-2 text-[1.1rem]">Recent from the Hub</h2>
        {isPending ? (
          <Loading />
        ) : data.posts.length === 0 ? (
          <EmptyState icon="💬" title="Quiet in here" body="Be the first to post something." />
        ) : (
          data.posts.map((post) => <PostCard key={post._id} post={post} />)
        )}
      </div>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg2 border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[1rem]">Upcoming Workshops</h3>
            <a
              href="/community/workshops"
              className="text-[0.8rem] font-semibold text-brand hover:underline"
            >
              View all
            </a>
          </div>
          <div className="grid gap-2.5">
            {(live?.upcoming || []).slice(0, 4).map((w) => (
              <div key={w._id} className="border-b border-line pb-2.5 last:border-0 last:pb-0">
                <p className="text-[0.72rem] font-semibold text-accent-mid">
                  {new Date(w.startsAt).toLocaleString('en-IN', { month: 'short', day: 'numeric' })}{' '}
                  ·{' '}
                  {new Date(w.startsAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <h4 className="text-[0.9rem]">{w.title}</h4>
                <p className="text-[0.75rem] text-muted">Live · {w.durationMins} min · Zoom</p>
              </div>
            ))}
          </div>
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
