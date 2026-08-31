import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { sortLabels } from '../../data/nav.js'
import { useTerms } from '../../context/SiteConfigContext.jsx'
import { Button, cn, Loading } from '../../components/ui/index.jsx'
import { ExploreCard } from './Courses.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/** Horizontal rail with the prev/next arrows from js/category.js (scroll by 75%). */
function Carousel({ title, courses }) {
  const ref = useRef(null)
  const scrollBy = (dir) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' })
  }

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[1.25rem]">{title}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollBy(-1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted hover:border-brand hover:text-brand"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollBy(1)}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted hover:border-brand hover:text-brand"
          >
            ›
          </button>
        </div>
      </div>
      <div ref={ref} className="flex gap-5 overflow-x-auto scroll-smooth pb-2 no-scrollbar">
        {courses.map((c) => (
          <div key={c._id} className="w-[286px] shrink-0">
            <ExploreCard course={c} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function CourseCategory() {
  useDocumentTitle('Marketing Courses | Growth Scholar')
  const [searchParams, setSearchParams] = useSearchParams()
  const topic = searchParams.get('topic') || ''
  const sort = searchParams.get('sort') || 'popularity'
  const topics = useTerms('topic', 'filters')

  const { data, isPending } = useQuery({
    queryKey: ['courses', 'category', topic, sort],
    queryFn: async () =>
      (
        await api.get('/courses', {
          params: { ...(topic ? { topic } : { price: 'paid,free' }), sort, limit: 50 },
        })
      ).data,
  })

  const items = data?.items || []
  const starters = items.filter((c) => c.type === 'starter')
  const paid = items.filter((c) => c.price === 'paid')

  const setTopic = (value) => {
    const params = new URLSearchParams(searchParams)
    if (value) params.set('topic', value)
    else params.delete('topic')
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="px-5 py-10">
      <div className="mx-auto max-w-shell">
        <nav className="mb-4 text-[0.8rem] text-muted" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-brand">
            Home
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-brand-deep">Marketing</span>
        </nav>

        <h1 className="text-[clamp(1.7rem,3vw,2.3rem)]">Marketing courses</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Pick a track and go deep — SEO, ads, copy, funnels, affiliate, and analytics, taught in
          your language.
        </p>

        <div className="my-7 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTopic('')}
            className={cn(
              'rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition-colors duration-200 ease-gs',
              !topic
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-white text-muted hover:border-brand hover:text-brand',
            )}
          >
            All topics
          </button>
          {topics.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setTopic(t.name)}
              className={cn(
                'rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition-colors duration-200 ease-gs',
                topic === t.name
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-white text-muted hover:border-brand hover:text-brand',
              )}
            >
              {t.name}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="cat-sort" className="text-[0.82rem] text-muted">
              Sort
            </label>
            <select
              id="cat-sort"
              value={sort}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams)
                params.set('sort', e.target.value)
                setSearchParams(params, { replace: true })
              }}
              className="rounded-full border border-line bg-white px-3 py-2 text-[0.85rem] outline-none focus:border-brand"
            >
              {Object.entries(sortLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isPending ? (
          <Loading />
        ) : (
          <>
            {starters.length > 0 && <Carousel title="Free starters" courses={starters} />}
            {paid.length > 0 && (
              <Carousel title={topic ? `${topic} courses` : 'All paid courses'} courses={paid} />
            )}

            <section className="mt-4">
              <h2 className="mb-4 text-[1.25rem]">Everything in this track</h2>
              <div className="grid grid-cols-3 gap-5 mx-1040:grid-cols-2 mx-640:grid-cols-1">
                {items.map((c) => (
                  <ExploreCard key={c._id} course={c} />
                ))}
              </div>
            </section>
          </>
        )}

        <div className="mt-14 rounded-xl2 brand-wash-deep px-8 py-10 text-center text-white">
          <h2 className="text-white">Want the full operator path?</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/85">
            The Complete Growth Marketing Course combines every track into 12 weeks of live
            campaigns.
          </p>
          <Button to="/programs/complete-growth-marketing" variant="light" className="mt-5">
            Explore program
          </Button>
        </div>
      </div>
    </div>
  )
}
