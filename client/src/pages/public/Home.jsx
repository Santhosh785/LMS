import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { Button, cn } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import { useBranding, useTerms } from '../../context/SiteConfigContext.jsx'
import CoverArt from '../../components/CoverArt.jsx'

const CATALOG_TABS = [
  {
    id: 'self-paced',
    label: 'Self-Paced',
    filter: (c) => c.type === 'self',
    tone: 'bg-surface-mist text-muted',
  },
  {
    id: 'paid',
    label: 'Paid Courses',
    filter: (c) => c.price === 'paid',
    tone: 'bg-accent-soft text-brand',
  },
  {
    id: 'free',
    label: 'Free Courses',
    filter: (c) => c.price === 'free',
    tone: 'bg-accent-soft text-brand',
  },
  {
    id: 'combos',
    label: 'Combos',
    filter: (c) => c.type === 'combo',
    tone: 'bg-[#fef3c7] text-warn',
  },
]

const WHY = [
  {
    title: 'Native language first',
    body: 'Short videos and drills you understand deeply — not English lectures you half-follow.',
  },
  {
    title: 'Practice over theory',
    body: 'Every concept ends in a problem set or live campaign task. Test. Learn. Repeat.',
  },
  {
    title: 'Humans when stuck',
    body: '1:1 doubt clearance and mentor reviews so you never stall mid-module.',
  },
]

/**
 * Claims made to prospective buyers, so each one has to be true. The first three
 * are the owner's own copy, repeated in the story below. A fourth card read
 * "4.8★ Average learner rating" — a figure invented for the demo, with no
 * reviews behind it — and was removed rather than replaced with a different
 * guess. Put it back when there are ratings to average.
 */
const OUTCOMES = [
  { value: '1,000+', label: 'Learners since 2021' },
  { value: '6', label: 'Trending growth skills' },
  { value: '1:1', label: 'Mentorship support' },
]

const STORY = [
  'Did you know that in India, more than 70% of institutes charge more than ₹40,000 for a course? The majority of modules just describe what is what — no case study or in-depth explanation. That is a significant amount of time, money, and effort wasted.',
  'Similar to you, a lot of students, marketers, housewives, startup founders, and other people are looking for a better approach to access affordable courses and improve their marketing / digital marketing skills. We recently polled people to determine how well they understood digital marketing and marketing strategy. The fact is that 71% of people struggle to understand the idea in English even when they expect it to be understood in their native languages as well.',
  'We, therefore, set out with the simple goal of providing coaching courses in their native language. Following several requests from learners and industry professionals, we created Growth Scholar so people can learn in their native language and become growth marketers without spending huge costs.',
  'Our additional goal is to nurture the future generation. We intend to provide digital marketing and marketing coaching to school students, enabling them to generate passive income and fostering young entrepreneurs when they enter college. To ensure students grasp the material effectively, we tailor the curriculum to their comprehension.',
  'We’ve been upgrading skills for more than 1,000 students since our launch in 2021, including college students and people seeking to change careers. We are so confident in our courses that we offer 1:1 mentorship, a Hub for Practice, Compete, and Ready, FREE courses, and a Community network.',
]

const TESTIMONIALS = [
  {
    quote:
      'I thought I knew Facebook Ads until this course. It revealed strategies that turned my campaigns around.',
    author: 'Sowndarya · Chidambaram',
  },
  {
    quote:
      'Like uncovering the magic behind search engines. It turned me into an SEO operator, not just a viewer.',
    author: 'A. Thiyagarajan · Dindigul',
  },
  {
    quote:
      'Learning in my native language made the journey clear and enjoyable — my marketing game leveled up.',
    author: 'Anishmon A · Kanyakumari',
  },
]

/**
 * One entry in a "New and popular" rail. Courses and programs both appear
 * there, so the card takes the flattened shape /api/showcase returns rather
 * than a course document.
 */
function RailItem({ item }) {
  const { brandName } = useBranding()

  return (
    <Link
      to={item.to}
      className="flex items-start gap-3 rounded-lg2 p-2 transition-colors duration-200 ease-gs hover:bg-surface-mist"
    >
      <CoverArt
        image={item.image}
        imageAlt={item.imageAlt}
        gradientClass={item.thumbClass || 'art-flag'}
        label=""
        className="h-14 w-14 shrink-0 rounded-md2"
        sizes="56px"
      />
      <div>
        <p className="text-[0.75rem] text-muted">{item.eyebrow || brandName}</p>
        <h3 className="text-[0.95rem]">{item.title}</h3>
        {item.sub && <p className="text-[0.78rem] text-muted">{item.sub}</p>}
        {/* Hidden until real ratings exist — see the note in Courses.jsx. */}
        {item.rating > 0 && (
          <p className="text-[0.78rem] font-semibold text-brand">★ {item.rating}</p>
        )}
      </div>
    </Link>
  )
}

export default function Home() {
  useDocumentTitle('Growth Scholar — Become a Growth Marketer')
  const [tab, setTab] = useState('self-paced')
  const [activePill, setActivePill] = useState('')

  const { data } = useQuery({
    queryKey: ['courses', 'home'],
    queryFn: async () =>
      (await api.get('/courses', { params: { price: 'paid,free', limit: 50, sort: 'popularity' } }))
        .data,
  })

  // The "New and popular" rails: one per tag flagged as a homepage rail.
  const { data: showcase } = useQuery({
    queryKey: ['showcase'],
    queryFn: async () => (await api.get('/showcase')).data,
  })

  const courses = data?.items || []
  const rails = showcase?.rails || []
  // The career banner shows the topics an operator flagged "Featured".
  const careerPills = useTerms('topic').filter((t) => t.featured)
  const { brandName } = useBranding()
  /*
   * The four cards under the banner were a hardcoded list of titles and slugs.
   * They rendered whether or not those courses were published — clicking one
   * led to "Course not found" — and the topic pills above them changed nothing,
   * because the list they were supposed to filter was a constant.
   *
   * They come from the catalogue now: real published courses for the selected
   * topic, so a card can only ever link somewhere that exists.
   */
  const activeTopic = activePill || careerPills[0]?.name || ''
  const careerCards = courses.filter((c) => !activeTopic || c.topic === activeTopic).slice(0, 4)
  const activeTab = CATALOG_TABS.find((t) => t.id === tab)

  return (
    <>
      {/* ------------------------------- hero ------------------------------- */}
      {/* One seamless banner, three flush panels — as in the original .cs-hero-banner */}
      <section className="bg-white px-[clamp(1rem,3vw,2rem)] pb-6 pt-5">
        <div className="mx-auto grid min-h-[340px] max-w-shell grid-cols-[1.1fr_0.7fr_0.9fr] overflow-hidden rounded-lg2 bg-[#0f3f3d] mx-1040:grid-cols-1">
          <div className="flex flex-col justify-center p-[clamp(1.75rem,4vw,2.75rem)] text-white">
            <p className="mb-[0.65rem] text-base font-bold text-accent">Growth Scholar</p>
            <h1 className="mb-3 max-w-[14ch] text-white text-[clamp(1.7rem,3.2vw,2.35rem)] font-bold leading-[1.2]">
              Start, switch, or advance your marketing career
            </h1>
            <p className="mb-[1.35rem] max-w-[32ch] text-base leading-[1.55] text-white/80">
              Learn SEO, ads, copy, funnels, and affiliate marketing — taught in your native
              language.
            </p>
            <Button href="#popular" variant="light" className="self-start shadow-none">
              Join for Free →
            </Button>
          </div>

          <div className="hero-media-wash grid place-items-center overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80"
              alt="Growth marketer smiling in a bright workspace"
              width={1200}
              height={1200}
              className="h-[78%] w-[78%] rounded-full border-[6px] border-white/35 object-cover"
            />
          </div>

          <aside className="flex flex-col justify-center bg-[#f3f4f6] p-[clamp(1.5rem,3vw,2.25rem)]">
            <h2 className="mb-[0.55rem] text-[1.25rem]">Become a growth operator</h2>
            <p className="mb-[0.85rem] text-[0.95rem] leading-[1.5] text-muted">
              Ship real campaigns in our 12-week Complete Growth Marketing Course.
            </p>
            <Link
              to="/programs/complete-growth-marketing"
              className="mb-5 text-[0.95rem] font-semibold text-brand hover:underline"
            >
              Explore the program →
            </Link>
            <div className="flex flex-wrap gap-[0.45rem]">
              {['SEO', 'Meta Ads', 'Google Ads', 'Funnels'].map((s) => (
                <span
                  key={s}
                  className="rounded border border-line-admin bg-white px-[0.65rem] py-[0.35rem] text-[0.78rem]"
                >
                  {s}
                </span>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {/* ---------------------------- new & popular -------------------------- */}
      {/*
        Each column is a tag flagged "show as a homepage rail" in admin, headed
        by the tag's name and filled with whatever carries it. This used to be
        three hardcoded lists of course slugs, so curating the homepage meant a
        deploy; the whole strip is now hidden when nothing is tagged.
      */}
      {rails.length > 0 && (
        <section id="popular" className="bg-white px-[clamp(1rem,3vw,2rem)] py-11">
          <div className="mx-auto max-w-shell">
            <h2 className="mb-6 text-[clamp(1.4rem,2.4vw,1.9rem)]">New and popular</h2>
            <div className="grid grid-cols-3 gap-8 mx-960:grid-cols-1">
              {rails.map((rail) => (
                <div key={rail.slug} className="flex flex-col gap-1">
                  <Link
                    to={rail.linkTo}
                    className="mb-2 text-[0.95rem] font-bold text-brand hover:underline"
                  >
                    {rail.name} →
                  </Link>
                  {rail.items.map((item) => (
                    <RailItem key={`${item.kind}-${item.slug}`} item={item} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------- career banner --------------------------- */}
      <section id="categories" className="career-banner-wash px-5 py-14 text-white">
        <div className="mx-auto max-w-shell">
          <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Skill categories">
            {careerPills.map((pill) => (
              <Link
                key={pill.slug}
                to={`/courses/category?topic=${encodeURIComponent(pill.name)}`}
                onClick={() => setActivePill(pill.name)}
                className={cn(
                  'rounded-full px-4 py-2 text-[0.85rem] font-semibold transition-colors duration-200 ease-gs',
                  (activePill || careerPills[0]?.name) === pill.name
                    ? 'bg-white text-brand-deep'
                    : 'bg-white/12 text-white hover:bg-white/20',
                )}
              >
                {/* The abbreviation is the term's own short label, so renaming
                    a topic cannot leave a stale nickname behind. */}
                {pill.shortLabel || pill.name}
              </Link>
            ))}
          </div>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-white">Get job-ready for an in-demand growth career</h2>
              <p className="mt-1 text-white/80">No prior experience needed to get started.</p>
            </div>
            <Button to="/programs/complete-growth-marketing" variant="light">
              View program
            </Button>
          </div>
          {careerCards.length === 0 && (
            <p className="text-[0.9rem] text-white/75">No published courses in this track yet.</p>
          )}
          <div className="grid grid-cols-4 gap-4 mx-960:grid-cols-2 mx-560:grid-cols-1">
            {careerCards.map((card) => (
              <Link
                key={card._id}
                to={`/courses/${card.slug}`}
                className="overflow-hidden rounded-lg2 bg-white text-ink transition-transform duration-200 ease-gs hover:-translate-y-1"
              >
                <CoverArt
                  image={card.image}
                  imageAlt={card.imageAlt}
                  gradientClass={card.thumbClass}
                  label=""
                  className="h-28"
                  sizes="(max-width: 560px) 100vw, (max-width: 960px) 50vw, 25vw"
                />
                <div className="p-4">
                  <p className="text-[0.75rem] text-muted">{brandName}</p>
                  <h3 className="text-[1rem]">{card.title}</h3>
                  <p className="text-[0.8rem] text-muted">
                    {[card.kind, card.durationLabel || (card.hours ? `${card.hours} Hrs` : '')]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------- browse by type ------------------------- */}
      <section id="catalog" className="bg-white px-[clamp(1rem,3vw,2rem)] py-11">
        <div className="mx-auto max-w-shell">
          <h2 className="mb-6 text-[clamp(1.4rem,2.4vw,1.9rem)]">Browse by type</h2>
          <div
            className="mb-5 flex flex-wrap gap-2 border-b border-line"
            role="tablist"
            aria-label="Course types"
          >
            {CATALOG_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  '-mb-px border-b-2 px-4 py-2.5 text-[0.9rem] font-semibold transition-colors duration-200 ease-gs',
                  tab === t.id
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted hover:text-brand',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="grid gap-2">
            {courses
              .filter(activeTab.filter)
              .slice(0, 6)
              .map((c) => (
                <Link
                  key={c._id}
                  to={`/courses/${c.slug}`}
                  className="flex items-center justify-between rounded-lg2 border border-line bg-white px-4 py-3.5 transition-colors duration-200 ease-gs hover:border-brand"
                >
                  <span className="font-medium">{c.title}</span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[0.72rem] font-semibold',
                      activeTab.tone,
                    )}
                  >
                    {activeTab.label.replace(' Courses', '')}
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- why -------------------------------- */}
      <section className="border-y border-[#eef0ef] bg-[#f8faf9] px-[clamp(1rem,3vw,2rem)] py-11">
        <div className="mx-auto max-w-shell">
          <h2 className="mb-8 text-[clamp(1.4rem,2.4vw,1.9rem)]">
            Why people choose Growth Scholar
          </h2>
          <div className="grid grid-cols-3 gap-6 mx-960:grid-cols-1">
            {WHY.map((w) => (
              <article key={w.title} className="rounded-lg2 bg-white p-6 shadow-softer">
                <h3 className="mb-2 text-[1.05rem]">{w.title}</h3>
                <p className="text-[0.9rem] text-muted">{w.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 rounded-lg2 bg-white p-6 shadow-softer mx-640:grid-cols-1">
            {OUTCOMES.map((o) => (
              <div key={o.label} className="text-center">
                <strong className="block text-[1.5rem] text-brand-deep">{o.value}</strong>
                <span className="text-[0.82rem] text-muted">{o.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- story ------------------------------- */}
      <section id="story" className="bg-white px-[clamp(1rem,3vw,2rem)] py-11">
        <div className="mx-auto max-w-3xl">
          <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-[0.14em] text-accent-mid">
            About us
          </p>
          <h2 className="mb-6 text-[clamp(1.4rem,2.4vw,1.9rem)]">The Growth Scholar Story</h2>
          <div className="grid gap-4 text-[0.98rem] leading-relaxed text-muted">
            {STORY.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <p className="font-semibold text-brand-deep">
              Stop wasting time, money, and effort — start becoming a 1% growth marketer now.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------- testimonials --------------------------- */}
      <section
        id="community"
        className="border-y border-[#eef0ef] bg-[#f8faf9] px-[clamp(1rem,3vw,2rem)] py-11"
      >
        <div className="mx-auto max-w-shell">
          <h2 className="mb-8 text-[clamp(1.4rem,2.4vw,1.9rem)]">Learner stories</h2>
          <div className="grid grid-cols-3 gap-6 mx-960:grid-cols-1">
            {TESTIMONIALS.map((t) => (
              <blockquote key={t.author} className="rounded-lg2 bg-white p-6 shadow-softer">
                <p className="text-[0.95rem] leading-relaxed text-ink">“{t.quote}”</p>
                <footer className="mt-4 text-[0.82rem] font-semibold text-muted">{t.author}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------- cta ------------------------------- */}
      <section className="brand-wash-deep px-5 py-16 text-center text-white">
        <div className="mx-auto max-w-shell">
          <h2 className="text-white text-[clamp(1.5rem,2.6vw,2rem)]">
            Ready to become a growth marketer?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Start free, go self-paced, or join the Complete Growth Marketing Course.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button to="/programs/complete-growth-marketing" variant="light" size="lg">
              Explore Program
            </Button>
            <Button
              to="/courses"
              size="lg"
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              Browse Courses
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
