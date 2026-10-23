import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useFeatures } from '../../context/SiteConfigContext.jsx'
import { Button, cn, EmptyState, Loading } from '../../components/ui/index.jsx'
import {
  CourseProgressCard,
  EventCard,
  PageHead,
  ProgressBar,
  StatTile,
} from '../../components/student/index.jsx'
import CoverArt from '../../components/CoverArt.jsx'

/** "Today", "Yesterday", or a short date — the drop's activity/deadline stamps. */
function dayLabel(value) {
  if (!value) return ''
  const d = new Date(value)
  const days = Math.round((d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function Dashboard() {
  const { user } = useAuth()
  const features = useFeatures()

  const { data, isPending } = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: async () => (await api.get('/me/dashboard')).data,
  })

  if (isPending) return <Loading />

  const { stats, current, inProgress, upcoming, deadlines, activity, recommended } = data
  const currentCourse = current?.courseId
  const goalPct = Math.round((stats.hoursThisWeek / (user?.weeklyGoalHours || 8)) * 100)

  return (
    <>
      <PageHead
        title={`Welcome back, ${user?.name?.split(' ')[0]}`}
        sub="Pick up where you left off — or jump into a live workshop."
        action={
          currentCourse && (
            <Button to={`/student/courses/${currentCourse.slug}`}>Continue learning</Button>
          )
        }
      />

      {/*
        Seeds and the streak only move when something awards them, so while
        gamification is off the server leaves both out of /me/dashboard and the
        row narrows to the two figures that are real.
      */}
      <div
        className={cn(
          'mb-6 grid gap-4 mx-960:grid-cols-2 mx-560:grid-cols-1',
          features.gamification ? 'grid-cols-4' : 'grid-cols-2',
        )}
      >
        {features.gamification && (
          <StatTile label="Learning streak" value={stats.streakDays} sub="days · keep it going" />
        )}
        <StatTile
          label="Hours this week"
          value={stats.hoursThisWeek}
          sub={`Goal: ${user?.weeklyGoalHours || 8} hrs`}
        />
        {features.gamification && (
          <StatTile label="Seeds" value={stats.seeds.toLocaleString('en-IN')} sub="+120 today" />
        )}
        <StatTile label="Courses active" value={stats.activeCourses} sub="1 nearly done" />
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-6 mx-1040:grid-cols-1">
        {currentCourse ? (
          <section className="overflow-hidden rounded-lg2 border border-line bg-white shadow-tiny">
            <CoverArt
              image={currentCourse.image}
              imageAlt={currentCourse.imageAlt}
              gradientClass={currentCourse.thumbClass}
              label={currentCourse.mediaLabel || currentCourse.title}
              labelClass="text-[1.3rem]"
              className="h-36 px-4"
              sizes="(max-width: 960px) 100vw, 480px"
            />
            <div className="p-6">
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-accent-mid">
                Continue learning
              </p>
              <h2 className="mt-1 text-[1.25rem]">{currentCourse.title}</h2>
              <p className="mt-1 text-[0.88rem] text-muted">
                {currentCourse.sections?.find(
                  (s) => String(s._id) === String(current.currentSectionId),
                )?.name || currentCourse.sections?.[0]?.name}
              </p>
              <ProgressBar value={current.progressPct} className="mt-4" />
              <p className="mt-2 flex justify-between text-[0.8rem] text-muted">
                <span>{current.progressPct}% complete</span>
                <span>~48 min left this module</span>
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button to={`/student/courses/${currentCourse.slug}`}>Resume</Button>
                <Button to="/student/courses" variant="outline">
                  All my courses
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <EmptyState
            icon="📚"
            title="No courses yet"
            body="Browse the catalog and enroll in your first course."
            action={
              <Button to="/courses" className="mt-3">
                Browse courses
              </Button>
            }
          />
        )}

        <div className="grid content-start gap-4">
          <section className="rounded-lg2 border border-line bg-white p-5 shadow-tiny">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[1rem]">Upcoming live</h3>
              <Link
                to="/student/live"
                className="text-[0.82rem] font-semibold text-brand hover:underline"
              >
                View schedule
              </Link>
            </div>
            <div className="grid gap-2.5">
              {upcoming.length ? (
                upcoming.map((e) => <EventCard key={e._id} event={e} />)
              ) : (
                <p className="text-[0.88rem] text-muted">Nothing scheduled right now.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg2 border border-line bg-white p-5 shadow-tiny">
            <h3 className="text-[1rem]">Weekly goal</h3>
            <p className="mt-2 flex justify-between text-[0.85rem] text-muted">
              <span>
                {stats.hoursThisWeek} / {user?.weeklyGoalHours || 8} hours
              </span>
              <span className="font-semibold text-brand">{goalPct}%</span>
            </p>
            <ProgressBar value={goalPct} className="mt-2" />
            <p className="mt-3 text-[0.82rem] text-muted">
              Finish the current module to hit your goal.
            </p>
          </section>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[1.15rem]">In progress</h2>
          <Link
            to="/student/courses"
            className="text-[0.85rem] font-semibold text-brand hover:underline"
          >
            See all →
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-4 mx-1100:grid-cols-3 mx-960:grid-cols-2 mx-560:grid-cols-1">
          {inProgress.map((e) => (
            <CourseProgressCard key={e._id} enrollment={e} />
          ))}
        </div>
      </section>

      {/*
        The three sections the 2026 redesign added. Each is built from a real
        signal — registered sessions, issued certificates, completed courses,
        community posts, and the topics this learner studies — so each is
        omitted rather than filled with placeholders when there is nothing yet.
      */}
      {(deadlines?.length > 0 || activity?.length > 0) && (
        <div className="mt-8 grid grid-cols-2 gap-6 mx-960:grid-cols-1">
          {deadlines?.length > 0 && (
            <section className="rounded-lg2 border border-line bg-white p-5 shadow-tiny">
              <h3 className="mb-4 text-[1rem]">Deadlines &amp; next steps</h3>
              <div className="grid gap-3">
                {deadlines.map((d) => (
                  <Link
                    key={`${d.kind}-${d.title}-${d.at}`}
                    to={d.to}
                    className="flex items-center gap-3 rounded-md2 p-2 hover:bg-surface-mist"
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 shrink-0 rounded-full',
                        d.kind === 'live' ? 'bg-danger' : 'bg-accent',
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-[0.92rem]">{d.title}</h4>
                      <p className="truncate text-[0.78rem] text-muted">{d.body}</p>
                    </div>
                    <span className="shrink-0 text-[0.78rem] font-semibold text-brand">
                      {dayLabel(d.at)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activity?.length > 0 && (
            <section className="rounded-lg2 border border-line bg-white p-5 shadow-tiny">
              <h3 className="mb-4 text-[1rem]">Recent activity</h3>
              <ul className="grid gap-3">
                {activity.map((a) => (
                  <li key={`${a.text}-${a.at}`} className="flex items-start gap-3">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-mist text-[0.85rem]"
                      aria-hidden="true"
                    >
                      {a.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.88rem] text-ink">{a.text}</p>
                      <time className="text-[0.75rem] text-muted">{dayLabel(a.at)}</time>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {recommended?.length > 0 && (
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[1.15rem]">Recommended for you</h2>
            <Link
              to="/courses/category"
              className="text-[0.85rem] font-semibold text-brand hover:underline"
            >
              Browse catalog →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 mx-960:grid-cols-2 mx-560:grid-cols-1">
            {recommended.map((c) => (
              <Link
                key={c.slug}
                to={`/courses/${c.slug}`}
                className="rounded-lg2 border border-line bg-white p-5 shadow-tiny transition-transform duration-200 ease-gs hover:-translate-y-1"
              >
                <p className="text-[0.72rem] font-bold uppercase tracking-wide text-accent-mid">
                  Because you study {c.topic}
                </p>
                <h3 className="mt-1 text-[1rem]">{c.title}</h3>
                {c.summary && (
                  <p className="mt-2 line-clamp-2 text-[0.85rem] text-muted">{c.summary}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
