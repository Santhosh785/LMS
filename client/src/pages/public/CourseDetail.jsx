import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn, Loading, useToast } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'

/**
 * /courses/:slug — the 2026 redesign's course page (.course-page).
 *
 * Markup follows courses/seo.html so the vendored styles/redesign/course.css
 * applies unchanged. The purchase path is untouched: paid courses still go to
 * /checkout/:slug logged out, and only free courses reach POST /api/enrollments.
 */

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const thumbTone = (thumbClass) => (thumbClass || '').replace(/^(media|art)-/, '')

/** Only the sections this course actually has get a link in the rail. */
const tocFor = (course) =>
  [
    course.overview?.length && { id: 'overview', label: 'Course Overview' },
    course.journey?.length && { id: 'journey', label: 'Learning Journey' },
    course.sections?.length && { id: 'syllabus', label: 'Syllabus' },
    course.tools?.length && { id: 'tools', label: 'Tools' },
    course.whoShouldEnroll?.points?.length && { id: 'who', label: 'Who Should Enroll' },
    course.careers?.length && { id: 'careers', label: 'Careers' },
    course.faqs?.length && { id: 'faq', label: 'FAQ' },
  ].filter(Boolean)

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
          {course.strikeAmount > 0 && <span className="was">{inr(course.strikeAmount)}</span>}
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

  const {
    data: course,
    isPending,
    error,
  } = useQuery({
    queryKey: ['course', slug],
    queryFn: async () => (await api.get(`/courses/${slug}`)).data,
  })

  useDocumentTitle(course ? `${course.title} | Growth Scholar` : 'Course | Growth Scholar')
  useBodyClass('gs-redesign course-page--convert')

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

  if (isPending) return <Loading />
  if (error) {
    return (
      <div className="px-5 py-20 text-center">
        <h1 className="text-[1.5rem]">Course not found</h1>
        <p className="mt-2 text-muted">{apiError(error)}</p>
        <Button to="/courses" variant="outline" className="mt-5">
          Browse courses
        </Button>
      </div>
    )
  }

  const isPaid = course.price !== 'free'
  const toc = tocFor(course)
  const discount =
    course.strikeAmount > 0 && course.amount > 0
      ? Math.round(100 - (course.amount / course.strikeAmount) * 100)
      : 0

  /**
   * Paid courses go to checkout, and go there logged out — requiring an account
   * before payment loses sales, and the admin approval creates it. Only free
   * courses touch the enrolment endpoint, and those still need an account to
   * enrol into.
   */
  const onEnroll = () => {
    if (isPaid) return navigate(`/checkout/${slug}`)
    if (!user) return navigate('/login', { state: { from: `/courses/${slug}` } })
    return enroll.mutate()
  }

  const enrollLabel = isPaid ? `Enroll — ${inr(course.amount)}` : 'Start free'

  return (
    <div className="course-page">
      {toast.node}

      <section className="course-hero">
        <div className="course-hero-inner">
          <div>
            <p className="breadcrumb">
              <Link to="/">Home</Link> / <Link to="/courses">Courses</Link> / {course.topic}
            </p>
            {discount > 0 && (
              <p className="course-hero-ribbon">
                Limited-time · <strong>{discount}% off</strong>
              </p>
            )}
            {course.kind && <p className="eyebrow">{course.kind}</p>}
            <h1>{course.title}</h1>
            {course.summary && <p className="hero-sub">{course.summary}</p>}

            {/* The Enrolled stat drops out entirely until real enrolments exist
                — see the note in Courses.jsx. */}
            <div className="course-stats">
              {course.enrolledCount > 0 && (
                <div>
                  <strong>
                    {course.enrolledLabel?.replace(' Enrolled', '') || course.enrolledCount}
                  </strong>
                  <span>Enrolled</span>
                </div>
              )}
              {course.hours > 0 && (
                <div>
                  <strong>{course.hours} Hours</strong>
                  <span>Recorded content</span>
                </div>
              )}
              {course.sections?.length > 0 && (
                <div>
                  <strong>{course.sections.length} Modules</strong>
                  <span>With projects</span>
                </div>
              )}
              {course.languages?.length > 0 && (
                <div>
                  <strong>{course.languages.join(' + ')}</strong>
                  <span>Language</span>
                </div>
              )}
            </div>

            <div className="course-hero-cta">
              <button className="course-btn-primary" type="button" onClick={onEnroll}>
                {enrollLabel}
              </button>
              <Link className="course-btn-secondary" to="/workshops">
                Try a free live workshop
              </Link>
            </div>
            <p className="course-hero-micro">
              Lifetime access · Certificate · 7-day refund on self-paced
            </p>
          </div>

          {/*
            The purchase card is a grid sibling of the copy, which is how the
            stylesheet is able to lift it above the description on a phone. In
            source order it would land below a full page of copy — on the
            highest-traffic width that puts the price and the buy button
            off-screen on arrival, which is a conversion problem, not polish.
          */}
          <aside className="course-buy" id="enroll">
            {course.image ? (
              <div
                className="course-buy-media"
                style={{
                  backgroundImage: `url(${course.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                role="img"
                aria-label={course.imageAlt || course.title}
              />
            ) : (
              <div
                className={cn('course-buy-media', course.thumbClass, thumbTone(course.thumbClass))}
              >
                {course.mediaLabel || course.title}
              </div>
            )}
            <div className="course-buy-body">
              {discount > 0 && <p className="course-buy-tag">Limited-time pricing</p>}
              <div className="price-row">
                <span className="price">{course.amount ? inr(course.amount) : 'Free'}</span>
                {course.strikeAmount > 0 && (
                  <span className="strike">{inr(course.strikeAmount)}</span>
                )}
                {discount > 0 && <span className="save-pill">Save {discount}%</span>}
              </div>
              <button
                className="course-btn-primary course-btn-block"
                type="button"
                onClick={onEnroll}
                disabled={enroll.isPending}
              >
                {enroll.isPending ? 'Enrolling…' : enrollLabel}
              </button>
              <Link className="course-buy-alt" to="/workshops">
                Not ready? Join a free live workshop →
              </Link>
              <ul className="buy-list">
                <li>Lifetime access to lessons</li>
                <li>Practice worksheets &amp; templates</li>
                <li>Certificate on completion</li>
                <li>Community doubt support</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {toc.length > 0 && (
        <nav className="course-toc" aria-label="Course sections">
          <div className="course-toc-inner">
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`}>
                {t.label}
              </a>
            ))}
          </div>
        </nav>
      )}

      <div className="course-layout">
        <div className="course-main">
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

          {course.sections?.length > 0 && (
            <section id="syllabus">
              <h2>Curriculum</h2>
              <p className="lede" style={{ marginBottom: '1.25rem' }}>
                Expand each module for key topics and industry relevance.
              </p>
              {course.sections.map((section, i) => (
                <details className="module" key={section._id || section.name} open={i === 0}>
                  <summary>
                    <span>{section.name}</span>
                    <span className="meta">
                      {section.lessons?.length || 0}{' '}
                      {section.lessons?.length === 1 ? 'lesson' : 'lessons'}
                    </span>
                  </summary>
                  <div className="module-body">
                    <div>
                      <h4>Lessons</h4>
                      <ul>
                        {(section.lessons || []).map((lesson) => (
                          <li key={lesson._id || lesson.name}>{lesson.name}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              ))}
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

          <section className="course-convert-band">
            <h2>Want live feedback before you enroll?</h2>
            <p>
              Join the next live workshop — three hours live with mentors, certificate included.
            </p>
            <div className="course-convert-actions">
              <Link className="course-btn-primary" to="/workshops">
                Browse live workshops
              </Link>
              <a className="course-btn-secondary on-dark" href="#enroll">
                Enroll self-paced
              </a>
            </div>
          </section>

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

        <div className="course-side" aria-hidden="true" />
      </div>

      <StickyBar course={course} onEnroll={onEnroll} isPaid={isPaid} />
    </div>
  )
}
