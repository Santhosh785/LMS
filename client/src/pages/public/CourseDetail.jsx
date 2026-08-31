import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { Button, cn, ErrorNote, Loading, useToast } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import CoverArt from '../../components/CoverArt.jsx'

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'journey', label: 'Learning journey' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'tools', label: 'Tools' },
  { id: 'who', label: 'Who should enroll' },
  { id: 'careers', label: 'Careers' },
  { id: 'faq', label: 'FAQ' },
]

function Accordion({ summary, meta, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="overflow-hidden rounded-lg2 border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-brand-deep">{summary}</span>
        <span className="flex shrink-0 items-center gap-3 text-[0.8rem] text-muted">
          {meta}
          <span className={cn('transition-transform duration-200 ease-gs', open && 'rotate-180')}>
            ▾
          </span>
        </span>
      </button>
      {open && <div className="border-t border-line px-5 py-4">{children}</div>}
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

  return (
    <>
      {toast.node}

      {/* -------------------------------- hero ------------------------------- */}
      <section className="border-b border-line bg-white px-5 py-10">
        {/*
          On a phone the purchase card is moved above the description with
          `order`. Stacked in source order it lands below a full page of copy,
          which on the highest-traffic width means the price and the buy button
          are off-screen on arrival — a conversion problem, not a polish one.
        */}
        <div className="mx-auto grid max-w-shell grid-cols-[1.6fr_1fr] items-start gap-10 mx-960:grid-cols-1 mx-960:gap-6">
          <div className="mx-960:order-2">
            <nav className="mb-3 text-[0.8rem] text-muted" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-brand">
                Home
              </Link>
              <span className="px-1.5">/</span>
              <Link to="/courses" className="hover:text-brand">
                Courses
              </Link>
              <span className="px-1.5">/</span>
              <span className="text-brand-deep">{course.topic}</span>
            </nav>
            <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
              {course.kind}
            </p>
            <h1 className="text-[clamp(1.8rem,3.2vw,2.5rem)]">{course.title}</h1>
            <p className="mt-3 max-w-2xl text-[1rem] text-muted">{course.summary}</p>

            {/* The Enrolled stat drops out entirely until real enrolments exist
                — see the note in Courses.jsx. */}
            <div className="mt-6 grid grid-cols-4 gap-4 mx-960:grid-cols-3 mx-640:grid-cols-2">
              {[
                course.enrolledCount > 0 && {
                  value: course.enrolledLabel?.replace(' Enrolled', '') || course.enrolledCount,
                  label: 'Enrolled',
                },
                { value: `${course.hours} Hours`, label: 'Recorded content' },
                { value: `${course.sections?.length || 0} Modules`, label: 'With projects' },
                {
                  value: course.languages?.join(' + ').replace('English', 'EN'),
                  label: 'Language',
                },
              ]
                .filter(Boolean)
                .map((s) => (
                  <div key={s.label}>
                    <strong className="block text-[1.1rem] text-brand-deep">{s.value}</strong>
                    <span className="text-[0.78rem] text-muted">{s.label}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* `static` below 960: a sticky element inside a single-column stack
              pins itself over the content the buyer is trying to read. */}
          <aside className="sticky top-[calc(var(--h,76px)+1rem)] rounded-xl2 border border-line bg-white p-6 shadow-soft mx-960:static mx-960:order-1 mx-480:p-5">
            <CoverArt
              image={course.image}
              imageAlt={course.imageAlt}
              gradientClass={course.thumbClass}
              label={course.mediaLabel || course.title}
              labelClass="text-[1.2rem]"
              className="mb-4 rounded-lg2"
              fallbackClass="h-32"
              imageClass="aspect-[16/9]"
              sizes="(max-width: 960px) 100vw, 400px"
            />
            <div className="flex items-baseline gap-2">
              <span className="text-[1.7rem] font-black text-brand-deep">
                {course.amount ? inr(course.amount) : 'Free'}
              </span>
              {course.strikeAmount ? (
                <span className="text-muted line-through">{inr(course.strikeAmount)}</span>
              ) : null}
            </div>
            <Button block className="mt-4" onClick={onEnroll} disabled={enroll.isPending}>
              {enroll.isPending
                ? 'Enrolling…'
                : isPaid && course.amount
                  ? `Enroll Now — ${inr(course.amount)}`
                  : 'Start for free'}
            </Button>
            <ul className="mt-4 grid gap-2 text-[0.85rem] text-muted">
              {[
                'Lifetime access to lessons',
                'Practice worksheets & templates',
                'Certificate on completion',
                'Community doubt support',
              ].map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-accent-mid">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {/* --------------------------------- toc ------------------------------- */}
      <nav className="sticky top-header z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-shell gap-1 overflow-x-auto px-5 no-scrollbar">
          {TOC.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className="whitespace-nowrap px-3 py-3 text-[0.85rem] font-medium text-muted hover:text-brand"
            >
              {t.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-shell px-5 py-12">
        <section id="overview" className="scroll-mt-32">
          <h2 className="mb-4 text-[1.5rem]">Course Overview</h2>
          <div className="grid gap-3 text-[0.98rem] leading-relaxed text-muted">
            {(course.overview?.length ? course.overview : [course.summary]).map((p) => (
              <p key={p?.slice(0, 20)}>{p}</p>
            ))}
          </div>
        </section>

        {course.journey?.length > 0 && (
          <section id="journey" className="mt-14 scroll-mt-32">
            <h2 className="mb-4 text-[1.5rem]">Your learning journey</h2>
            <div className="grid gap-3">
              {course.journey.map((j) => (
                <article
                  key={j.step}
                  className="flex gap-4 rounded-lg2 border border-line bg-white p-5"
                >
                  <span className="text-[1.3rem] font-black text-accent-mid">{j.step}</span>
                  <div>
                    <h3 className="text-[1rem]">{j.title}</h3>
                    <p className="mt-1 text-[0.9rem] text-muted">{j.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section id="curriculum" className="mt-14 scroll-mt-32">
          <h2 className="mb-4 text-[1.5rem]">Curriculum</h2>
          <div className="grid gap-2">
            {course.sections?.map((section, i) => (
              <Accordion
                key={section._id}
                defaultOpen={i === 0}
                summary={section.name}
                meta={[section.duration, section.difficulty].filter(Boolean).join(' · ')}
              >
                <div className="grid grid-cols-2 gap-6 mx-640:grid-cols-1">
                  {section.keyTopics?.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-[0.85rem] uppercase tracking-wide text-muted">
                        Key Topics
                      </h4>
                      <ul className="grid gap-1.5 text-[0.9rem] text-muted">
                        {section.keyTopics.map((t) => (
                          <li key={t}>• {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {section.industryRelevance?.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-[0.85rem] uppercase tracking-wide text-muted">
                        Industry Relevance
                      </h4>
                      <ul className="grid gap-1.5 text-[0.9rem] text-muted">
                        {section.industryRelevance.map((t) => (
                          <li key={t}>• {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Accordion>
            ))}
          </div>
        </section>

        {course.tools?.length > 0 && (
          <section id="tools" className="mt-14 scroll-mt-32">
            <h2 className="mb-4 text-[1.5rem]">Tools you’ll practice with</h2>
            <div className="flex flex-wrap gap-2">
              {course.tools.map((tool) => (
                <span
                  key={tool}
                  className="rounded-full border border-line bg-white px-3.5 py-2 text-[0.85rem] text-muted"
                >
                  {tool}
                </span>
              ))}
            </div>
          </section>
        )}

        {course.whoShouldEnroll?.intro && (
          <section id="who" className="mt-14 scroll-mt-32">
            <h2 className="mb-4 text-[1.5rem]">Who should enroll in {course.title}?</h2>
            <p className="text-[0.98rem] leading-relaxed text-muted">
              {course.whoShouldEnroll.intro}
            </p>
            <ul className="mt-4 grid gap-2 text-[0.92rem] text-muted">
              {course.whoShouldEnroll.points?.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-accent-mid">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </section>
        )}

        {course.careers?.length > 0 && (
          <section id="careers" className="mt-14 scroll-mt-32">
            <h2 className="mb-4 text-[1.5rem]">What you’ll be ready for</h2>
            <div className="grid grid-cols-2 gap-3 mx-640:grid-cols-1">
              {course.careers.map((c) => (
                <div
                  key={c}
                  className="rounded-lg2 border border-line bg-white px-4 py-3.5 font-medium text-brand-deep"
                >
                  {c}
                </div>
              ))}
            </div>
          </section>
        )}

        {course.faqs?.length > 0 && (
          <section id="faq" className="mt-14 scroll-mt-32">
            <h2 className="mb-4 text-[1.5rem]">Frequently Asked Questions</h2>
            <div className="grid gap-2">
              {course.faqs.map((f) => (
                <Accordion key={f.q} summary={f.q}>
                  <p className="text-[0.92rem] leading-relaxed text-muted">{f.a}</p>
                </Accordion>
              ))}
            </div>
          </section>
        )}

        <ErrorNote error={enroll.error && apiError(enroll.error)} />
      </div>
    </>
  )
}
