import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { Button, cn, EmptyState, Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import { useTerms } from '../../context/SiteConfigContext.jsx'
import CoverArt from '../../components/CoverArt.jsx'

/**
 * "Latest Articles" is the unfiltered view rather than a category, so it stays
 * here as the leading entry; everything after it comes from the Term registry
 * and is editable in admin.
 */
const ALL_POSTS = 'Latest Articles'
const ROTATE_MS = 8000

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export default function Blog() {
  useDocumentTitle('Blog | Growth Scholar')
  const [category, setCategory] = useState(ALL_POSTS)
  const [slide, setSlide] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const categories = [ALL_POSTS, ...useTerms('blog-category', 'filters').map((t) => t.name)]

  const { data, isPending } = useQuery({
    queryKey: ['blog', category, search, page],
    queryFn: async () =>
      (
        await api.get('/blog', {
          params: {
            category: category === ALL_POSTS ? 'latest' : category,
            q: search || undefined,
            page,
            limit: 12,
          },
        })
      ).data,
  })

  const featured = data?.featured || []
  const items = data?.items || []
  const pages = data?.pages || 1

  // 8s auto-rotate, same cadence as js/blog.js
  useEffect(() => {
    if (featured.length < 2) return undefined
    const timer = setInterval(() => setSlide((s) => (s + 1) % featured.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [featured.length])

  const current = featured[slide]

  return (
    <div className="px-5 py-10">
      <div className="mx-auto max-w-shell">
        <nav className="mb-4 text-[0.8rem] text-muted" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-brand">
            Home
          </Link>
          <span className="px-1.5">/</span>
          <span className="text-brand-deep">Blog</span>
        </nav>

        <h1 className="mb-7 text-[clamp(1.7rem,3vw,2.3rem)]">Growth Scholar Blog</h1>

        {/* ---------------------------- featured rail --------------------------- */}
        {current && (
          <section className="relative mb-12 overflow-hidden rounded-xl2 border border-line bg-white shadow-softer">
            <div className="grid grid-cols-[1fr_1.1fr] mx-960:grid-cols-1">
              <CoverArt
                image={current.image}
                imageAlt={current.imageAlt}
                gradientClass={current.heroClass}
                label={current.heroLabel}
                labelClass="text-[1.6rem]"
                className="min-h-[260px] px-6"
                sizes="(max-width: 960px) 100vw, 50vw"
              />
              <div className="flex flex-col justify-center gap-3 p-8">
                <p className="flex flex-wrap items-center gap-2 text-[0.78rem] text-muted">
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 font-semibold text-brand">
                    {current.category}
                  </span>
                  <span>{fmt(current.publishedAt)}</span>
                  <span>· {current.readTime}</span>
                </p>
                <h2 className="text-[clamp(1.2rem,2.2vw,1.7rem)]">
                  <Link to={`/blog/${current.slug}`} className="hover:text-brand">
                    {current.title}
                  </Link>
                </h2>
                <p className="text-[0.95rem] text-muted">{current.excerpt}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-[0.75rem] font-bold text-brand">
                    {current.author?.avatar}
                  </span>
                  <span className="text-[0.85rem] font-medium text-muted">
                    {current.author?.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-8 flex gap-2 mx-960:left-1/2 mx-960:-translate-x-1/2">
              {featured.map((f, i) => (
                <button
                  key={f._id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={cn(
                    'h-2 rounded-full transition-all duration-200',
                    i === slide ? 'w-6 bg-brand' : 'w-2 bg-line-solid',
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next article"
              onClick={() => setSlide((s) => (s + 1) % featured.length)}
              className="absolute bottom-4 right-4 grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-muted hover:border-brand hover:text-brand"
            >
              ›
            </button>
          </section>
        )}

        <div className="grid grid-cols-[220px_1fr] gap-8 mx-960:grid-cols-1">
          <aside>
            <h2 className="mb-3 text-[1rem]">Discover blogs by category</h2>
            <nav className="flex flex-col gap-1 mx-960:flex-row mx-960:flex-wrap">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c)
                    setPage(1)
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-md2 px-3 py-2 text-left text-[0.88rem] transition-colors duration-200 ease-gs',
                    category === c
                      ? 'bg-accent-soft font-semibold text-brand'
                      : 'text-muted hover:bg-surface-mist hover:text-brand',
                  )}
                >
                  {c} <span aria-hidden="true">›</span>
                </button>
              ))}
            </nav>
          </aside>

          <section>
            <form
              className="mb-5 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
              }}
            >
              <label className="sr-only" htmlFor="blog-search">
                Search articles
              </label>
              <input
                id="blog-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search articles…"
                className="min-h-[42px] w-full rounded-md2 border border-line bg-white px-3 text-[0.88rem] outline-none focus:border-brand"
              />
              <Button type="submit" variant="outline" size="sm">
                Search
              </Button>
            </form>
            {isPending ? (
              <Loading />
            ) : items.length === 0 ? (
              <EmptyState
                icon="📝"
                title="No articles in this category yet"
                body="Try another category — more posts are published every week."
              />
            ) : (
              <div className="grid grid-cols-3 gap-5 mx-1040:grid-cols-2 mx-640:grid-cols-1">
                {items.map((post) => (
                  <article
                    key={post._id}
                    className="overflow-hidden rounded-lg2 border border-line bg-white shadow-softer transition-transform duration-200 ease-gs hover:-translate-y-1"
                  >
                    <Link to={`/blog/${post.slug}`}>
                      <CoverArt
                        image={post.image}
                        imageAlt={post.imageAlt}
                        gradientClass={post.heroClass}
                        label={post.heroLabel}
                        labelClass="text-[1.05rem]"
                        className="h-32 px-4"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    </Link>
                    <div className="p-4">
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.7rem] font-semibold text-brand">
                        {post.category}
                      </span>
                      <h3 className="mt-2.5 text-[1rem] leading-snug">
                        <Link to={`/blog/${post.slug}`} className="hover:text-brand">
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-3 text-[0.78rem] text-muted">
                        By {post.author?.name} · {fmt(post.publishedAt)} | {post.readTime}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {pages > 1 && (
              <nav className="mt-7 flex items-center justify-center gap-3" aria-label="Blog pages">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <span className="text-[0.82rem] text-muted">
                  Page {page} of {pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </section>
        </div>

        <section className="feat-cta mt-14 rounded-xl2 px-8 py-12 text-center text-white">
          <h2 className="text-white">Learn it, then ship it</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/85">
            Reading is a start. Our courses turn these ideas into campaigns you actually run.
          </p>
          <Button to="/courses" variant="light" className="mt-5">
            Browse courses
          </Button>
        </section>
      </div>
    </div>
  )
}
