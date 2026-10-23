import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, Loading, useToast } from '../../components/ui/index.jsx'
import { ProgressBar } from '../../components/student/index.jsx'
import LessonPlayer from '../../components/student/LessonPlayer.jsx'
import BrandLogo from '../../components/BrandLogo.jsx'
import CurriculumList from '../../components/student/Curriculum.jsx'
import { formatTotal, lessonLength, toSeconds } from '../../components/student/curriculum.js'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/**
 * The course player: an immersive, full-height layout — video stage, a
 * collapsible "Course content" sidebar, and tabs under the video. It renders
 * outside the student dashboard shell (see App.jsx) so the video gets the
 * width a learner actually watches at.
 *
 * Below 1040px there is no room for a sidebar, so the same curriculum becomes
 * the first tab under the video — one list, two placements.
 */

/** Remembered per browser; a learner who closes the sidebar wants it closed. */
const SIDEBAR_KEY = 'gs_player_sidebar'

const readSidebarPref = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== 'closed'
  } catch {
    return true
  }
}

const writeSidebarPref = (open) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, open ? 'open' : 'closed')
  } catch {
    // Storage blocked (private mode, site data cleared) — the toggle still works
    // for this visit, it just is not remembered.
  }
}

export default function CoursePlayer() {
  const { slug } = useParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [activeId, setActiveId] = useState(null)
  const [openSections, setOpenSections] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarPref)
  // 'content' only exists as a tab on narrow screens; wide screens fall back to
  // Overview through CSS, so resizing never strands the learner on a blank tab.
  const [tab, setTab] = useState('content')

  const { data, isPending, error } = useQuery({
    queryKey: ['enrollment', slug],
    queryFn: async () => (await api.get(`/enrollments/course/${slug}`)).data,
  })

  useDocumentTitle(
    data?.course ? `${data.course.title} | Growth Scholar` : 'Course | Growth Scholar',
  )

  const flat = useMemo(() => {
    if (!data?.course) return []
    return data.course.sections.flatMap((s) =>
      s.lessons.map((l) => ({ ...l, sectionId: s._id, sectionName: s.name })),
    )
  }, [data])

  // Open the section the learner was last in and select their current lesson —
  // once, when the course first loads, so a later refetch (after marking a
  // lesson done) does not yank them back to their saved position.
  const loaded = Boolean(data)
  useEffect(() => {
    if (!loaded) return
    const currentId = data.enrollment.currentLessonId || flat[0]?._id
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId((prev) => prev ?? (currentId ? String(currentId) : null))
    const section = flat.find((l) => String(l._id) === String(currentId))?.sectionId
    if (section) setOpenSections((s) => ({ [String(section)]: true, ...s }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const progress = useMutation({
    mutationFn: async (payload) =>
      (await api.patch(`/enrollments/${data.enrollment._id}/progress`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', slug] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => toast.show(apiError(err)),
  })

  if (isPending) return <Loading />
  if (error) {
    // Two different problems with two different fixes — buy, or renew. Task 6
    // returns distinguishable codes so this page never tells a lapsed customer
    // they were never enrolled.
    const expired = error?.response?.data?.details?.code === 'ACCESS_EXPIRED'
    return (
      <div className="px-4 py-20 text-center">
        <h1 className="text-[1.4rem]">{expired ? 'Your access has expired' : 'Not enrolled'}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">{apiError(error)}</p>
        {expired ? (
          <Button to={`/checkout/${slug}`} className="mt-5">
            Renew access
          </Button>
        ) : (
          <Button to={`/courses/${slug}`} variant="outline" className="mt-5">
            View course page
          </Button>
        )}
      </div>
    )
  }

  const { course, enrollment } = data
  const completed = new Set(enrollment.completedLessonIds.map(String))
  const lesson = flat.find((l) => String(l._id) === activeId) || flat[0]
  const index = flat.findIndex((l) => String(l._id) === String(lesson?._id))
  const prev = index > 0 ? flat[index - 1] : null
  const next = flat[index + 1]
  const isDone = completed.has(String(lesson?._id))
  const totalSeconds = flat.reduce((t, l) => t + toSeconds(l.duration), 0)

  const select = (l) => {
    setActiveId(String(l._id))
    setOpenSections((s) => ({ ...s, [String(l.sectionId)]: true }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleSection = (id) => setOpenSections((s) => ({ ...s, [String(id)]: !s[String(id)] }))

  const toggleDone = (l, done) =>
    progress.mutate({ lessonId: l._id, sectionId: l.sectionId, completed: done })

  const setSidebar = (open) => {
    setSidebarOpen(open)
    writeSidebarPref(open)
  }

  const curriculum = (
    <CurriculumList
      course={course}
      completed={completed}
      activeId={lesson ? String(lesson._id) : null}
      openSections={openSections}
      onToggleSection={toggleSection}
      onSelect={select}
      onToggleDone={toggleDone}
      busy={progress.isPending}
    />
  )

  const arrow =
    'absolute top-1/2 z-10 grid h-11 w-9 -translate-y-1/2 place-items-center bg-brand-deep/85 text-[1.1rem] text-white shadow-lg transition-colors duration-200 ease-gs hover:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'

  return (
    <div className="min-h-screen bg-white">
      {toast.node}

      {/* ------------------------------ top bar ------------------------------ */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 bg-brand-deep px-4 text-white">
        <Link
          to="/student"
          aria-label="Back to my dashboard"
          // The logo is drawn for light backgrounds; a white chip keeps it
          // legible on the dark bar.
          className="shrink-0 rounded-md bg-white px-1.5 py-0.5"
        >
          <BrandLogo width={96} height={60} className="h-8 w-auto rounded-sm2" />
        </Link>
        <span className="h-6 w-px shrink-0 bg-white/25 mx-560:hidden" aria-hidden="true" />
        <h1 className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold text-white">
          {course.title}
        </h1>
        <div className="flex shrink-0 items-center gap-3 text-[0.8rem] text-white/80">
          <span className="mx-640:hidden">
            {completed.size} of {flat.length} complete
          </span>
          <span className="w-24 mx-640:w-16">
            <ProgressBar value={enrollment.progressPct} />
          </span>
          <Link
            to="/student/courses"
            className="rounded-lg border border-white/30 px-3 py-1.5 font-semibold text-white transition-colors duration-200 ease-gs hover:bg-white/10 mx-480:hidden"
          >
            My learning
          </Link>
        </div>
      </header>

      <div className="flex">
        {/* ---------------------------- main column ---------------------------- */}
        <main className="min-w-0 flex-1">
          <div className="relative bg-ink">
            {/* Height-capped so a wide monitor shows the controls without
                scrolling; the [&>div] override flattens the player's rounded
                card frame into an edge-to-edge stage. */}
            <div className="mx-auto w-full max-w-[min(100%,calc((100vh-9rem)*1.7778))] [&>div]:rounded-none">
              <LessonPlayer slug={slug} lesson={lesson} thumbClass={course.thumbClass} />
            </div>

            {prev && (
              <button
                type="button"
                onClick={() => select(prev)}
                className={cn(arrow, 'left-0 rounded-r-lg')}
                aria-label={`Previous lesson: ${prev.name}`}
                title={`Previous: ${prev.name}`}
              >
                ‹
              </button>
            )}
            {next && (
              <button
                type="button"
                onClick={() => select(next)}
                className={cn(arrow, 'right-0 rounded-l-lg')}
                aria-label={`Next lesson: ${next.name}`}
                title={`Next: ${next.name}`}
              >
                ›
              </button>
            )}

            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebar(true)}
                className="absolute right-0 top-4 z-10 flex items-center gap-2 rounded-l-lg bg-white px-3 py-2 text-[0.82rem] font-semibold text-brand-deep shadow-lg transition-colors duration-200 ease-gs hover:bg-accent-soft mx-1040:hidden"
              >
                <span aria-hidden="true">←</span> Course content
              </button>
            )}
          </div>

          {/* ------------------------------- tabs ------------------------------- */}
          <div className="sticky top-14 z-20 border-b border-line-solid bg-white">
            <div role="tablist" className="flex gap-6 overflow-x-auto px-6 mx-640:px-4">
              {[
                { id: 'content', label: 'Course content', narrowOnly: true },
                { id: 'overview', label: 'Overview' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'shrink-0 border-b-2 py-3.5 text-[0.92rem] font-semibold transition-colors duration-200 ease-gs',
                    t.narrowOnly && 'hidden mx-1040:block',
                    // On wide screens Overview is always the visible panel, so
                    // it always reads as selected there.
                    tab === t.id || (t.id === 'overview' && tab === 'content')
                      ? 'border-brand text-brand-deep'
                      : 'border-transparent text-muted hover:text-brand-deep',
                    t.id === 'overview' &&
                      tab === 'content' &&
                      'mx-1040:border-transparent mx-1040:text-muted',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'content' && <div className="hidden mx-1040:block">{curriculum}</div>}

          <section
            className={cn('px-6 py-8 mx-640:px-4', tab === 'content' && 'mx-1040:hidden')}
            aria-label="Overview"
          >
            <div className="mx-auto max-w-3xl">
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-accent-mid">
                {lesson?.sectionName}
              </p>
              <h2 className="mt-1 text-[1.4rem] leading-snug">{lesson?.name}</h2>
              <p className="mt-1 text-[0.85rem] text-muted">
                {[lessonLength(lesson?.duration), lesson?.contentType].filter(Boolean).join(' · ')}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  variant={isDone ? 'outline' : 'primary'}
                  disabled={progress.isPending || !lesson}
                  onClick={() => toggleDone(lesson, !isDone)}
                >
                  {isDone ? 'Mark as not done' : 'Mark complete'}
                </Button>
                {next && (
                  <Button variant="ghost" onClick={() => select(next)}>
                    Next: {next.name} →
                  </Button>
                )}
              </div>

              <hr className="my-8 border-line-solid" />

              {course.summary && (
                <p className="text-[1.1rem] leading-relaxed text-ink">{course.summary}</p>
              )}

              <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <dt className="text-[0.75rem] text-muted">Your progress</dt>
                  <dd className="text-[1.05rem] font-bold text-brand-deep">
                    {enrollment.progressPct}%
                  </dd>
                </div>
                <div>
                  <dt className="text-[0.75rem] text-muted">Lessons</dt>
                  <dd className="text-[1.05rem] font-bold text-brand-deep">{flat.length}</dd>
                </div>
                <div>
                  <dt className="text-[0.75rem] text-muted">Sections</dt>
                  <dd className="text-[1.05rem] font-bold text-brand-deep">
                    {course.sections.length}
                  </dd>
                </div>
                {totalSeconds > 0 && (
                  <div>
                    <dt className="text-[0.75rem] text-muted">Total length</dt>
                    <dd className="text-[1.05rem] font-bold text-brand-deep">
                      {formatTotal(totalSeconds)}
                    </dd>
                  </div>
                )}
              </dl>

              {course.overview?.length > 0 && (
                <>
                  <h3 className="mt-8 text-[1.1rem]">What you&rsquo;ll learn</h3>
                  <ul className="mt-3 grid gap-2.5 text-[0.92rem] text-ink">
                    {course.overview.map((point) => (
                      <li key={point} className="flex gap-2.5">
                        <span className="text-accent-mid" aria-hidden="true">
                          ✓
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
        </main>

        {/* ------------------------- desktop sidebar -------------------------- */}
        {sidebarOpen && (
          <aside
            className="sticky top-14 h-[calc(100vh-3.5rem)] w-[380px] shrink-0 overflow-y-auto border-l border-line-solid bg-white mx-1100:w-[340px] mx-1040:hidden"
            aria-label="Course content"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line-solid bg-white px-4 py-3.5">
              <div>
                <h2 className="text-[1rem]">Course content</h2>
                <p className="mt-0.5 text-[0.75rem] text-muted">
                  {course.sections.length} sections · {flat.length} lessons
                  {totalSeconds > 0 && ` · ${formatTotal(totalSeconds)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSidebar(false)}
                aria-label="Close course content"
                className="grid h-8 w-8 place-items-center rounded-md text-[1.1rem] text-muted transition-colors duration-200 ease-gs hover:bg-surface hover:text-brand-deep"
              >
                ✕
              </button>
            </header>
            {curriculum}
          </aside>
        )}
      </div>
    </div>
  )
}
