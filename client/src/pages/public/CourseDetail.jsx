import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLoaderData, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { cn, useToast } from '../../components/ui/index.jsx'
import CurriculumList from '../../components/student/Curriculum.jsx'
import {
  courseSeconds,
  formatTotal,
  isPlayablePreview,
  lessonCount,
} from '../../components/student/curriculum.js'
import LessonPlayer from '../../components/student/LessonPlayer.jsx'

/**
 * /courses/:slug — the public course page, in the same Udemy-style frame as the
 * course player: a video stage, a "Course content" sidebar, and tabs under the
 * stage. A visitor sees the curriculum with every lesson locked except the free
 * previews, which play right here; the sales copy lives in the Overview tab.
 *
 * Server-rendered: the course arrives as loader data (routes/public/
 * course-detail.ts), already stripped of video references, so the first render
 * on the server and in the browser is the same anonymous page. Everything
 * personal — the enrollment lookup, the player's signed preview URL — happens
 * in the browser after hydration. The <title> and the rest of the head come
 * from the route's `meta`.
 *
 * The purchase path is untouched: paid courses still go to /checkout/:slug
 * logged out, and only free courses reach POST /api/enrollments. A signed-in
 * student who already owns the course gets "Go to course" instead of a second
 * checkout.
 */

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const thumbTone = (thumbClass) => (thumbClass || '').replace(/^(media|art)-/, '')

const BUY_POINTS = [
  'Lifetime access to lessons',
  'Practice worksheets & templates',
  'Certificate on completion',
  'Community doubt support',
]

/** The drop's sticky price bar, shown once the buy box has scrolled away. */
function StickyBar({ course, onEnroll, isPaid }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const buyBox = document.getElementById('enroll')
      let overlapping = false
      if (buyBox) {
        const rect = buyBox.getBoundingClientRect()
        overlapping = rect.bottom > 0
      }
      setShown(window.scrollY > 480 && !overlapping)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={cn('course-sticky', shown && 'is-visible')} aria-hidden={!shown}>
      <div className="course-sticky-inner">
        <div className="course-sticky-price">
          <span className="now">{course.amount ? inr(course.amount) : 'Free'}</span>
          <span className="label">
            {course.title} · {course.kind || 'Self-paced'}
          </span>
        </div>
        <button
          className="course-btn-primary course-btn-sm"
          type="button"
          onClick={onEnroll}
          tabIndex={shown ? 0 : -1}
        >
          {isPaid ? 'Enroll now' : 'Start free'}
        </button>
      </div>
    </div>
  )
}

export default function CourseDetail() {
  const { slug } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { course } = useLoaderData()
  // The first section starts open, as the old syllabus did — from the first
  // render, so the server HTML already shows its lessons.
  const firstSection = course.sections?.[0]?._id
  const [openSections, setOpenSections] = useState(() =>
    firstSection ? { [String(firstSection)]: true } : {},
  )
  const [previewId, setPreviewId] = useState(null)
  // 'content' only exists as a tab on narrow screens; wide screens show the
  // curriculum in the sidebar and fall back to Overview through CSS.
  const [tab, setTab] = useState('content')

  // Only asked when someone is signed in, and only ever in the browser (queries
  // do not run during SSR); a 403/404 simply means "not yours".
  const { data: owned } = useQuery({
    queryKey: ['enrollment', slug],
    queryFn: async () => (await api.get(`/enrollments/course/${slug}`)).data,
    enabled: Boolean(user),
    retry: false,
  })
  const isEnrolled = Boolean(owned?.enrollment)

  // A client-side move to another course keeps this component mounted; open
  // that course's first section too.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (firstSection) setOpenSections((s) => ({ [String(firstSection)]: true, ...s }))
  }, [firstSection])

  const previews = useMemo(
    () => (course.sections || []).flatMap((s) => s.lessons.filter(isPlayablePreview)),
    [course],
  )

  // Stable, because LessonPlayer refetches whenever its source changes.
  const previewSource = useCallback(
    (lessonId) => `/courses/${slug}/preview/${encodeURIComponent(lessonId)}`,
    [slug],
  )

  /**
   * Only free courses self-enrol. POST /api/enrollments answers a paid slug with
   * 402 and the checkout path — the button below never reaches it for a paid
   * course, and the redirect here is the safety net if it somehow does.
   */
  const enroll = useMutation({
    mutationFn: async () => (await api.post('/enrollments', { slug })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      navigate(`/student/courses/${slug}`)
    },
    onError: (err) => {
      const checkoutPath = err?.response?.data?.details?.checkoutPath
      if (checkoutPath) return navigate(checkoutPath)
      toast.show(apiError(err))
    },
  })

  const isPaid = course.price !== 'free'
  const totalSeconds = courseSeconds(course)
  const lessons = lessonCount(course)
  const previewLesson = previews.find((l) => String(l._id) === previewId)

  /**
   * Paid courses go to checkout, and go there logged out — requiring an account
   * before payment loses sales, and the admin approval creates it. Only free
   * courses touch the enrolment endpoint, and those still need an account to
   * enrol into.
   */
  const onEnroll = () => {
    if (isEnrolled) return navigate(`/student/courses/${slug}`)
    if (isPaid) return navigate(`/checkout/${slug}`)
    if (!user) return navigate('/login', { state: { from: `/courses/${slug}` } })
    return enroll.mutate()
  }

  const enrollLabel = isEnrolled
    ? 'Go to course →'
    : isPaid
      ? `Enroll — ${inr(course.amount)}`
      : 'Start free'

  const playPreview = (lesson) => {
    setPreviewId(String(lesson._id))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleSection = (id) => setOpenSections((s) => ({ ...s, [String(id)]: !s[String(id)] }))

  const curriculum = (
    <CurriculumList
      course={course}
      mode="preview"
      activeId={previewId}
      openSections={openSections}
      onToggleSection={toggleSection}
      onSelect={playPreview}
    />
  )

  const enrollButton = (block) => (
    <button
      className={cn('course-btn-primary', block && 'course-btn-block')}
      type="button"
      onClick={onEnroll}
      disabled={enroll.isPending}
    >
      {enroll.isPending ? 'Enrolling…' : enrollLabel}
    </button>
  )

  return (
    <div className="course-page bg-white pt-header">
      {toast.node}

      <div className="flex">
        {/* ---------------------------- main column ---------------------------- */}
        <main className="min-w-0 flex-1">
          {/* The stage: the cover until a preview is chosen, then the player. */}
          <div className="relative bg-ink">
            <div className="mx-auto w-full max-w-[min(100%,calc((100vh-9rem)*1.7778))] [&>div]:rounded-none">
              {previewLesson ? (
                <LessonPlayer
                  slug={slug}
                  lesson={previewLesson}
                  thumbClass={course.thumbClass}
                  source={previewSource}
                />
              ) : (
                <div className="relative grid aspect-video place-items-end overflow-hidden">
                  {course.image ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${course.image})` }}
                      role="img"
                      aria-label={course.imageAlt || course.title}
                    />
                  ) : (
                    <div
                      className={cn(
                        'absolute inset-0',
                        course.thumbClass,
                        thumbTone(course.thumbClass),
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/10"
                    aria-hidden="true"
                  />

                  <div className="relative w-full p-[clamp(1.25rem,4vw,2.5rem)] text-white">
                    <p className="text-[0.8rem] text-white/75">
                      <Link to="/" className="hover:text-white">
                        Home
                      </Link>{' '}
                      /{' '}
                      <Link to="/courses" className="hover:text-white">
                        Courses
                      </Link>
                      {course.topic && ` / ${course.topic}`}
                    </p>
                    {course.kind && (
                      <p className="mt-3 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-accent">
                        {course.kind}
                      </p>
                    )}
                    <h1 className="mt-1 max-w-3xl text-[clamp(1.6rem,3.6vw,2.6rem)] leading-tight text-white">
                      {course.title}
                    </h1>
                    {course.summary && (
                      <p className="mt-2 max-w-2xl text-[0.98rem] leading-relaxed text-white/80 mx-560:hidden">
                        {course.summary}
                      </p>
                    )}
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem] text-white/85">
                      {/* Enrolled stays out until real enrolments exist — see
                          the note in Courses.jsx. */}
                      {course.enrolledCount > 0 && (
                        <span>
                          {course.enrolledLabel?.replace(' Enrolled', '') || course.enrolledCount}{' '}
                          enrolled
                        </span>
                      )}
                      {course.hours > 0 && <span>{course.hours} hours</span>}
                      <span>{course.sections.length} sections</span>
                      <span>{lessons} lessons</span>
                      {course.languages?.length > 0 && <span>{course.languages.join(' + ')}</span>}
                    </p>
                    {previews.length > 0 && (
                      <button
                        type="button"
                        onClick={() => playPreview(previews[0])}
                        className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-white px-5 py-2.5 text-[0.92rem] font-bold text-brand-deep shadow-lg transition-colors duration-200 ease-gs hover:bg-accent-soft"
                      >
                        <span aria-hidden="true">▶</span> Play preview
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Narrow screens: the price and button the sidebar holds on desktop. */}
          <div className="hidden items-center justify-between gap-4 border-b border-line-solid px-4 py-4 mx-1040:flex">
            <span className="text-[1.5rem] font-bold text-brand-deep">
              {isEnrolled ? 'Enrolled' : course.amount ? inr(course.amount) : 'Free'}
            </span>
            {enrollButton(false)}
          </div>

          {/* ------------------------------- tabs ------------------------------- */}
          <div className="sticky top-header z-20 border-b border-line-solid bg-white">
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

          <div
            className={cn(
              'course-main px-6 py-8 mx-640:px-4',
              tab === 'content' && 'mx-1040:hidden',
            )}
          >
            <div className="mx-auto max-w-3xl">
              {/* The cover drops the summary on phones; it leads the tab instead. */}
              {course.summary && (
                <p className="mb-8 hidden text-[1.02rem] leading-relaxed text-ink mx-560:block">
                  {course.summary}
                </p>
              )}
              {course.overview?.length > 0 && (
                <section id="overview">
                  <h2>Course Overview</h2>
                  <div className="prose">
                    {course.overview.map((p) => (
                      <p key={p.slice(0, 40)}>{p}</p>
                    ))}
                  </div>
                </section>
              )}

              {course.journey?.length > 0 && (
                <section id="journey">
                  <h2>Your learning journey</h2>
                  <div className="journey">
                    {course.journey.map((step) => (
                      <article className="journey-step" key={step.title}>
                        <span className="num">{step.step}</span>
                        <div>
                          <h3>{step.title}</h3>
                          <p>{step.body}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {course.tools?.length > 0 && (
                <section id="tools">
                  <h2>Tools you’ll practice with</h2>
                  <div className="tools" style={{ marginTop: '1rem' }}>
                    {course.tools.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </section>
              )}

              {course.whoShouldEnroll?.points?.length > 0 && (
                <section id="who">
                  <h2>Who should enroll in {course.title}?</h2>
                  <div className="prose">
                    {course.whoShouldEnroll.intro && <p>{course.whoShouldEnroll.intro}</p>}
                    <ul>
                      {course.whoShouldEnroll.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {course.careers?.length > 0 && (
                <section id="careers">
                  <h2>What you’ll be ready for after {course.title}</h2>
                  <div className="prose">
                    <ul>
                      {course.careers.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {course.faqs?.length > 0 && (
                <section id="faq" className="faq">
                  <h2>Frequently Asked Questions</h2>
                  {course.faqs.map((f, i) => (
                    <details key={f.q} open={i === 0}>
                      <summary>{f.q}</summary>
                      <p>{f.a}</p>
                    </details>
                  ))}
                </section>
              )}
            </div>
          </div>
        </main>

        {/* -------------------------- desktop sidebar ------------------------- */}
        <aside
          className="sticky top-header h-[calc(100vh-var(--header-h))] w-[380px] shrink-0 overflow-y-auto border-l border-line-solid bg-white mx-1100:w-[340px] mx-1040:hidden"
          aria-label="Enroll and course content"
        >
          {/* id="enroll": the sticky price bar hides while this is on screen. */}
          <div id="enroll" className="border-b border-line-solid p-5">
            <p className="text-[1.9rem] font-bold leading-none text-brand-deep">
              {isEnrolled ? 'You’re enrolled' : course.amount ? inr(course.amount) : 'Free'}
            </p>
            <div className="mt-4">{enrollButton(true)}</div>
            {!isEnrolled && (
              <ul className="mt-4 grid gap-1.5 text-[0.82rem] text-muted">
                {BUY_POINTS.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-accent-mid" aria-hidden="true">
                      ✓
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <header className="sticky top-0 z-10 border-b border-line-solid bg-white px-4 py-3.5">
            <h2 className="text-[1rem]">Course content</h2>
            <p className="mt-0.5 text-[0.75rem] text-muted">
              {course.sections.length} sections · {lessons} lessons
              {totalSeconds > 0 && ` · ${formatTotal(totalSeconds)}`}
              {previews.length > 0 && ` · ${previews.length} free preview`}
              {previews.length > 1 && 's'}
            </p>
          </header>
          {curriculum}
        </aside>
      </div>

      {!isEnrolled && <StickyBar course={course} onEnroll={onEnroll} isPaid={isPaid} />}
    </div>
  )
}
