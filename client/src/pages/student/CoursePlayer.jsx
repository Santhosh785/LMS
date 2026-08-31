import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, Loading, useToast } from '../../components/ui/index.jsx'
import { ProgressBar } from '../../components/student/index.jsx'
import LessonPlayer from '../../components/student/LessonPlayer.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

export default function CoursePlayer() {
  const { slug } = useParams()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [activeId, setActiveId] = useState(null)
  const [openSections, setOpenSections] = useState({})

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

  // open the section the learner was last in and select their current lesson
  useEffect(() => {
    if (!data) return
    const currentId = data.enrollment.currentLessonId || flat[0]?._id
    setActiveId(String(currentId))
    const section = flat.find((l) => String(l._id) === String(currentId))?.sectionId
    if (section) setOpenSections({ [String(section)]: true })
  }, [data, flat])

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
      <div className="py-20 text-center">
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
  const next = flat[index + 1]
  const isDone = completed.has(String(lesson?._id))

  return (
    <>
      {toast.node}
      <nav className="mb-4 text-[0.8rem] text-muted" aria-label="Breadcrumb">
        <Link to="/student/courses" className="hover:text-brand">
          My Learning
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-brand-deep">{course.title}</span>
      </nav>

      {/* The lesson list drops below the player when stacked, and its own
          max-height scroll is removed there — a 70vh scroll region nested
          inside a scrolling page traps the thumb on a phone. */}
      <div className="grid grid-cols-[1fr_320px] gap-6 mx-1040:grid-cols-1">
        <section>
          <LessonPlayer slug={slug} lesson={lesson} thumbClass={course.thumbClass} />

          <div className="mt-5 rounded-lg2 border border-line bg-white p-5">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-accent-mid">
              {lesson?.sectionName}
            </p>
            <h1 className="mt-1 text-[1.3rem]">{lesson?.name}</h1>
            <p className="mt-1 text-[0.85rem] text-muted">
              {lesson?.duration} · {lesson?.contentType}
            </p>

            <ProgressBar value={enrollment.progressPct} className="mt-4" />
            <p className="mt-2 text-[0.82rem] text-muted">
              {enrollment.progressPct}% complete · {completed.size} of {flat.length} lessons
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant={isDone ? 'outline' : 'primary'}
                disabled={progress.isPending}
                onClick={() =>
                  progress.mutate({
                    lessonId: lesson._id,
                    sectionId: lesson.sectionId,
                    completed: !isDone,
                  })
                }
              >
                {isDone ? 'Mark as not done' : 'Mark complete'}
              </Button>
              {next && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setActiveId(String(next._id))
                    setOpenSections((s) => ({ ...s, [String(next.sectionId)]: true }))
                  }}
                >
                  Next: {next.name} →
                </Button>
              )}
            </div>
          </div>
        </section>

        <aside className="rounded-lg2 border border-line bg-white">
          <header className="border-b border-line px-4 py-3.5">
            <h2 className="text-[1rem]">Course content</h2>
            <p className="mt-0.5 text-[0.78rem] text-muted">
              {course.sections.length} modules · {flat.length} lessons
            </p>
          </header>

          <div className="max-h-[70vh] overflow-y-auto mx-1040:max-h-none mx-1040:overflow-visible">
            {course.sections.map((section) => {
              const open = openSections[String(section._id)]
              const sectionDone = section.lessons.filter((l) => completed.has(String(l._id))).length
              return (
                <div key={section._id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    aria-expanded={!!open}
                    onClick={() => setOpenSections((s) => ({ ...s, [String(section._id)]: !open }))}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-[0.9rem] font-semibold text-brand-deep">
                      {section.name}
                    </span>
                    <span className="shrink-0 text-[0.75rem] text-muted">
                      {sectionDone}/{section.lessons.length}{' '}
                      <span
                        className={cn('inline-block transition-transform', open && 'rotate-180')}
                      >
                        ▾
                      </span>
                    </span>
                  </button>
                  {open && (
                    <ul>
                      {section.lessons.map((l) => {
                        const done = completed.has(String(l._id))
                        const active = String(l._id) === activeId
                        return (
                          <li key={l._id}>
                            <button
                              type="button"
                              onClick={() => setActiveId(String(l._id))}
                              className={cn(
                                // min-h-[44px]: switching lessons is the one
                                // thing a phone viewer does constantly.
                                'flex min-h-[44px] w-full items-center gap-2.5 px-4 py-2.5 text-left text-[0.85rem] transition-colors duration-200 ease-gs',
                                active
                                  ? 'bg-accent-soft font-semibold text-brand'
                                  : 'text-muted hover:bg-surface-mist',
                              )}
                            >
                              <span
                                className={cn(
                                  'shrink-0',
                                  done ? 'text-accent-mid' : 'text-line-solid',
                                )}
                                aria-hidden="true"
                              >
                                {done ? '✓' : '○'}
                              </span>
                              <span className="flex-1 truncate">{l.name}</span>
                              <span className="shrink-0 text-[0.72rem]">{l.duration}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </>
  )
}
