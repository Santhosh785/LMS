import { Link } from 'react-router-dom'
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
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import CoverArt from '../../components/CoverArt.jsx'

export default function Dashboard() {
  useDocumentTitle('My Learning Dashboard | Growth Scholar')
  const { user } = useAuth()
  const features = useFeatures()

  const { data, isPending } = useQuery({
    queryKey: ['me', 'dashboard'],
    queryFn: async () => (await api.get('/me/dashboard')).data,
  })

  if (isPending) return <Loading />

  const { stats, current, inProgress, upcoming } = data
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
    </>
  )
}
