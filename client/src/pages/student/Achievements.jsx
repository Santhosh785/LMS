import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { cn, Loading } from '../../components/ui/index.jsx'
import { PageHead, StatTile } from '../../components/student/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const toneRing = {
  gold: 'bg-gold/15 text-gold',
  silver: 'bg-silver/20 text-silver',
  bronze: 'bg-bronze/15 text-bronze',
}

export default function Achievements() {
  useDocumentTitle('Achievements | Growth Scholar')

  const { data, isPending } = useQuery({
    queryKey: ['me', 'achievements'],
    queryFn: async () => (await api.get('/me/achievements')).data,
  })

  if (isPending) return <Loading />

  return (
    <>
      <PageHead title="Achievements" sub="Seeds, streaks and badges you’ve earned along the way." />

      <div className="mb-8 grid grid-cols-3 gap-4 mx-640:grid-cols-1">
        <StatTile
          label="Seeds"
          value={data.seeds.toLocaleString('en-IN')}
          sub="Earn more by helping peers"
        />
        <StatTile label="Learning streak" value={data.streakDays} sub="days in a row" />
        <StatTile
          label="Weekly rank"
          value={data.rank ? `#${data.rank}` : '—'}
          sub="On the community leaderboard"
        />
      </div>

      <h2 className="mb-4 text-[1.15rem]">Badges</h2>
      <div className="grid grid-cols-4 gap-4 mx-1040:grid-cols-2 mx-560:grid-cols-1">
        {data.badges.map((badge) => (
          <article
            key={badge._id}
            className={cn(
              'rounded-lg2 border bg-white p-5 text-center shadow-tiny',
              badge.earned ? 'border-accent' : 'border-line opacity-60',
            )}
          >
            <span
              className={cn(
                'mx-auto grid h-14 w-14 place-items-center rounded-full text-[1.4rem]',
                toneRing[badge.tone] || toneRing.gold,
              )}
              aria-hidden="true"
            >
              {badge.icon}
            </span>
            <h3 className="mt-3 text-[0.98rem]">{badge.name}</h3>
            <p className="mt-1 text-[0.8rem] text-muted">{badge.description}</p>
            <p className="mt-2 text-[0.75rem] font-semibold text-brand">
              {badge.earned
                ? 'Earned ✓'
                : `${badge.seedsThreshold?.toLocaleString('en-IN')} Seeds needed`}
            </p>
          </article>
        ))}
      </div>
    </>
  )
}
