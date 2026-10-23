import { useEffect, useState } from 'react'
import { Link, useLoaderData, useNavigation, useSearchParams } from 'react-router'
import { useTerms } from '../../context/SiteConfigContext.jsx'
import { cn, EmptyState } from '../../components/ui/index.jsx'
import { RESOURCES_PAGES_READY } from '../../data/nav.js'
import { ALL_POSTS, blogCategory } from '../../lib/blogParams.js'

/**
 * /blog — the 2026 redesign's archive (.blog-wrap), server-rendered.
 *
 * Masthead, topic rail, spotlight, latest strip and a category-filtered grid.
 * The posts come from the route loader (routes/public/blog.ts); the category,
 * search text and page all live in the URL (`?category=&q=&page=`), so the
 * server HTML and a shared link show the same view. Categories come from the
 * taxonomy, and the 8-second featured rotation is unchanged (client-only — the
 * server and the first client render both show the first featured post).
 */

const ROTATE_MS = 8000
const SEARCH_DEBOUNCE_MS = 350

// A fixed time zone: the server renders in UTC, the visitor's browser in IST,
// and a post published late in the evening would otherwise hydrate onto a
// different date.
const dateLabel = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : ''

/** `params` with `key` set, or removed when `value` is empty. */
const withParam = (params, key, value) => {
  const next = new URLSearchParams(params)
  if (value) next.set(key, String(value))
  else next.delete(key)
  return next
}

/** The drop paints thumbnails with `.thumb.seo`; the database stores `feat-seo`. */
const heroTone = (heroClass) => (heroClass || '').replace(/^(feat|thumb)-/, '')

function BlogCard({ post }) {
  return (
    <Link className="blog-card" to={`/blog/${post.slug}`}>
      <div
        className={cn('thumb', post.heroClass, heroTone(post.heroClass))}
        style={
          post.image
            ? {
                backgroundImage: `url(${post.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <span className="bookmark" aria-hidden="true">
          🔖
        </span>
        {!post.image && <span className="thumb-label">{post.heroLabel || post.title}</span>}
      </div>
      <div className="body">
        {post.category && <p className="cat-label">{post.category}</p>}
        <h3>{post.title}</h3>
        <p className="card-meta">
          By {post.author?.name || 'Growth Scholar'}
          <br />
          {dateLabel(post.publishedAt)}
          {post.readTime ? ` | ${post.readTime}` : ''}
        </p>
      </div>
    </Link>
  )
}

export default function Blog() {
  const { featured, items, page, pages } = useLoaderData()
  const navigation = useNavigation()
  const [searchParams, setSearchParams] = useSearchParams()
  // The filters follow the URL at once; the posts follow when the loader
  // returns. The topic rail is real, shareable links — `.blog-topic-row a` is
  // also what the stylesheet targets.
  const category = blogCategory(searchParams.get('category')) || ALL_POSTS
  const q = (searchParams.get('q') || '').trim()
  const [slide, setSlide] = useState(0)
  const categories = [ALL_POSTS, ...useTerms('blog-category', 'filters').map((t) => t.name)]
  const loading = navigation.state === 'loading' && navigation.location?.pathname === '/blog'

  /**
   * The search box is local while typing and lands in `?q=` after a pause, so
   * a keystroke is not a navigation. `pushed` is the last value the box sent;
   * `seenQ` the last `?q=` this component reacted to. A URL change the box did
   * not make (a topic link, Back) resets the box; the box's own push landing
   * leaves it alone. (A newer push aborts the older navigation, so a stale
   * value never lands after a newer one.)
   */
  const [search, setSearch] = useState(q)
  const [pushed, setPushed] = useState(q)
  const [seenQ, setSeenQ] = useState(q)
  if (q !== seenQ) {
    setSeenQ(q)
    if (q !== pushed) {
      setPushed(q)
      setSearch(q)
    }
  }
  useEffect(() => {
    const value = search.trim()
    if (value === pushed) return undefined
    const timer = setTimeout(() => {
      setPushed(value)
      // Any filter change but paging goes back to page 1.
      setSearchParams((prev) => withParam(withParam(prev, 'q', value), 'page', null), {
        replace: true,
        preventScrollReset: true,
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search, pushed, setSearchParams])

  // 8s auto-rotate, same cadence as js/blog.js
  useEffect(() => {
    if (featured.length < 2) return undefined
    const timer = setInterval(() => setSlide((s) => (s + 1) % featured.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [featured.length])

  const current = featured.length ? featured[slide % featured.length] : null
  const latest = items.slice(0, 8)

  /** A category's URL: the search text carries over, the page starts again. */
  const categoryParams = (c) =>
    withParam(withParam({}, 'category', c === ALL_POSTS ? '' : c), 'q', q)
  const categoryHref = (c) => {
    const qs = categoryParams(c).toString()
    return qs ? `/blog?${qs}` : '/blog'
  }

  const pick = (c) =>
    setSearchParams(categoryParams(c), { replace: true, preventScrollReset: true })

  const goToPage = (n) =>
    setSearchParams((prev) => withParam(prev, 'page', n > 1 ? n : null), {
      replace: true,
      preventScrollReset: true,
    })

  return (
    <div className="blog-wrap">
      <p className="blog-crumb">
        <Link to="/">Home</Link> <span>›</span> Blog
      </p>

      <header className="blog-masthead">
        <div className="blog-masthead-copy">
          <p className="blog-masthead-eyebrow">Digital marketing strategies for growth marketers</p>
          <h1>Smart marketing starts here.</h1>
          <p className="blog-masthead-deck">
            SEO, paid media, AI discovery, funnels, and career guides — written for founders,
            freelancers, and growth teams in India.
          </p>
        </div>
        <form
          className="blog-search blog-search--masthead"
          role="search"
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="sr-only" htmlFor="blog-search-input">
            Search blog
          </label>
          <input
            id="blog-search-input"
            type="search"
            placeholder="Search articles…"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </header>

      <nav className="blog-topic-row" aria-label="Blog topics">
        {categories.map((c) => (
          <Link
            key={c}
            to={categoryHref(c)}
            className={cn(category === c && 'is-active')}
            preventScrollReset
          >
            {c === ALL_POSTS ? 'All' : c}
          </Link>
        ))}
      </nav>

      {current && (
        <section className="blog-spotlight" aria-label="Featured article">
          <Link className="blog-spotlight-link" to={`/blog/${current.slug}`}>
            <div
              className={cn('blog-spotlight-media', current.heroClass, heroTone(current.heroClass))}
              style={
                current.image
                  ? {
                      backgroundImage: `url(${current.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : undefined
              }
              role="img"
              aria-label={current.imageAlt || `Featured: ${current.title}`}
            />
            <div className="blog-spotlight-body">
              <p className="blog-spotlight-meta">
                {current.category && <span>{current.category}</span>}
                <span>{dateLabel(current.publishedAt)}</span>
                {current.readTime && <span>{current.readTime}</span>}
              </p>
              <h2>{current.title}</h2>
              {current.excerpt && <p>{current.excerpt}</p>}
              <span className="blog-spotlight-cta">Read the full study →</span>
            </div>
          </Link>
        </section>
      )}

      {/*
        The drop's strip opened with "12,000+ learners trained", which
        contradicts the 1,000+ figure the homepage and About page both carry.
        The consistent number is used here; the rest are cadence claims, not
        counts, so they stand as written.
      */}
      <ul className="blog-stats-strip" aria-label="Growth Scholar impact">
        <li>
          <strong>1,000+</strong> learners trained
        </li>
        <li>
          <strong>Weekly</strong> new articles
        </li>
        <li>
          <strong>10</strong> seats per Flagship batch
        </li>
        <li>
          <strong>Weekly</strong> workshop drops
        </li>
      </ul>

      {latest.length > 0 && (
        <section className="blog-latest-strip" aria-labelledby="latest-heading">
          <div className="blog-latest-head">
            <h2 id="latest-heading">Latest from the blog</h2>
            <a href="#discover-heading">View all categories</a>
          </div>
          <div className="blog-latest-scroll">
            {latest.map((p) => (
              <Link className="blog-latest-card" to={`/blog/${p.slug}`} key={p._id}>
                <div
                  className={cn('blog-latest-thumb', p.heroClass, heroTone(p.heroClass))}
                  style={
                    p.image
                      ? {
                          backgroundImage: `url(${p.image})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : undefined
                  }
                />
                {p.category && <p className="blog-latest-cat">{p.category}</p>}
                <h3>{p.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Hidden until the Resources pages exist — see RESOURCES_PAGES_READY. */}
      {RESOURCES_PAGES_READY && (
        <section className="blog-ai-promo" aria-labelledby="ai-promo-heading">
          <div>
            <h2 id="ai-promo-heading">Learn how to level-up with AI</h2>
            <p>
              Use our Claude skills and playbooks to audit pages, draft campaigns, and ship faster —
              then practice live in Flagship.
            </p>
          </div>
          <div className="blog-ai-promo-actions">
            <Link className="btn-lm-primary" to="/resources/claude-skills">
              Browse Claude Skills
            </Link>
            <Link className="btn-lm-ghost" to="/resources/playbooks">
              Open playbooks
            </Link>
          </div>
        </section>
      )}

      <section className="blog-discover" aria-labelledby="discover-heading">
        <h2 id="discover-heading">
          Discover Blogs by <em>Categories</em>
        </h2>

        <div className="blog-layout">
          <aside className="blog-cats" aria-label="Blog categories">
            {categories.map((c) => (
              <button
                key={c}
                className={cn('blog-cat', category === c && 'is-active')}
                type="button"
                onClick={() => pick(c)}
              >
                {c} <span className="chev">›</span>
              </button>
            ))}
          </aside>

          <div aria-busy={loading || undefined}>
            <h3 className="visually-hidden">{category}</h3>
            {items.length === 0 ? (
              <EmptyState
                icon="📝"
                title="Nothing here yet"
                body="No articles match this category or search."
              />
            ) : (
              <div className="blog-grid">
                {items.map((p) => (
                  <BlogCard post={p} key={p._id} />
                ))}
              </div>
            )}

            {pages > 1 && (
              <div className="blog-pager">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  ← Newer
                </button>
                <span>
                  Page {page} of {pages}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={page >= pages}
                  onClick={() => goToPage(page + 1)}
                >
                  Older →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
