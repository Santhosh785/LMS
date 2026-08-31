import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, Loading, TextField, useToast } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import CoverArt from '../../components/CoverArt.jsx'

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

/** Renders the structured body blocks the API returns. */
function Block({ block }) {
  switch (block.type) {
    case 'h2':
      return <h2 className="mt-10 text-[1.35rem]">{block.text}</h2>
    case 'h3':
      return <h3 className="mt-8 text-[1.1rem]">{block.text}</h3>
    case 'ul':
      return (
        <ul className="mt-4 grid gap-2 text-[0.98rem] leading-relaxed text-muted">
          {block.items?.map((i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent-mid">•</span>
              {i}
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="mt-4 grid list-decimal gap-2 pl-5 text-[0.98rem] leading-relaxed text-muted">
          {block.items?.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ol>
      )
    case 'quote':
      return (
        <blockquote className="mt-6 border-l-4 border-accent bg-white px-5 py-4 text-[1.02rem] italic text-brand-deep">
          {block.text}
        </blockquote>
      )
    case 'callout':
      return (
        <aside className="mt-6 rounded-lg2 bg-accent-soft px-5 py-4">
          <p className="font-semibold text-brand">{block.text}</p>
          {block.items?.length > 0 && (
            <ul className="mt-2 grid gap-1 text-[0.92rem] text-brand-deep">
              {block.items.map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
          )}
        </aside>
      )
    default:
      return <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">{block.text}</p>
  }
}

export default function BlogPost() {
  const { slug } = useParams()
  const [copied, setCopied] = useState(false)
  const [tocOpen, setTocOpen] = useState(true)
  const [consultDone, setConsultDone] = useState(false)
  const toast = useToast()

  const { data, isPending, error } = useQuery({
    queryKey: ['blog', 'post', slug],
    queryFn: async () => (await api.get(`/blog/${slug}`)).data,
  })

  useDocumentTitle(data?.post ? `${data.post.title} | Growth Scholar` : 'Article | Growth Scholar')

  const consult = useMutation({
    mutationFn: async (payload) =>
      (await api.post('/leads', { ...payload, source: 'blog-consult' })).data,
    onSuccess: () => setConsultDone(true),
    onError: (err) => toast.show(apiError(err)),
  })

  if (isPending) return <Loading />
  if (error) {
    return (
      <div className="px-5 py-20 text-center">
        <h1 className="text-[1.5rem]">Article not found</h1>
        <Button to="/blog" variant="outline" className="mt-5">
          Back to blog
        </Button>
      </div>
    )
  }

  const { post, related } = data
  const headings = post.body?.filter((b) => b.type === 'h2') || []

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="px-5 py-10">
      {toast.node}
      <div className="mx-auto max-w-shell">
        <nav className="mb-4 text-[0.8rem] text-muted" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-brand">
            Home
          </Link>
          <span className="px-1.5">›</span>
          <Link to="/blog" className="hover:text-brand">
            Blog
          </Link>
          <span className="px-1.5">›</span>
          <span className="text-brand-deep">{post.category}</span>
        </nav>

        <div className="grid grid-cols-[1fr_260px] gap-10 mx-960:grid-cols-1">
          <article>
            <h1 className="text-[clamp(1.7rem,3vw,2.3rem)]">{post.title}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-muted">
              <span className="font-semibold text-brand-deep">By {post.author?.name}</span>
              <span>· Updated on {fmt(post.publishedAt)}</span>
              <span>| {post.readTime}</span>
            </p>

            <div className="mt-4 flex items-center gap-2">
              <span className="text-[0.8rem] text-muted">Share:</span>
              <button
                type="button"
                onClick={copyLink}
                aria-label="Copy link"
                className="grid h-8 w-8 place-items-center rounded-full border border-line text-[0.8rem] text-muted hover:border-brand hover:text-brand"
              >
                {copied ? '✓' : '🔗'}
              </button>
              {['WA', 'in'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="grid h-8 w-8 place-items-center rounded-full border border-line text-[0.7rem] font-bold text-muted hover:border-brand hover:text-brand"
                >
                  {s}
                </a>
              ))}
            </div>

            <CoverArt
              image={post.image}
              imageAlt={post.imageAlt}
              gradientClass={post.heroClass}
              label={post.heroLabel}
              labelClass="text-[1.6rem]"
              className="mt-7 h-48 rounded-xl2 px-6"
              sizes="(max-width: 960px) 100vw, 720px"
            />

            <div className="mt-8">
              {post.body?.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </div>
          </article>

          <aside className="flex flex-col gap-6">
            <div className="sticky top-[calc(76px+1rem)] rounded-lg2 border border-line bg-white p-5">
              <button
                type="button"
                onClick={() => setTocOpen((v) => !v)}
                aria-expanded={tocOpen}
                className="flex w-full items-center justify-between font-semibold text-brand-deep"
              >
                Table of Contents
                <span
                  className={cn(
                    'transition-transform duration-200 ease-gs',
                    tocOpen && 'rotate-180',
                  )}
                >
                  ▾
                </span>
              </button>
              {tocOpen && (
                <nav className="mt-3 grid gap-2">
                  {headings.map((h) => (
                    <a
                      key={h.text}
                      href={`#${h.text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      className="text-[0.85rem] text-muted hover:text-brand"
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              )}
            </div>

            <div className="rounded-lg2 border border-line bg-white p-5">
              <h3 className="text-[1rem]">Talk to a mentor</h3>
              {consultDone ? (
                <p className="mt-3 text-[0.88rem] text-brand">
                  Submitted ✓ — we’ll be in touch shortly.
                </p>
              ) : (
                <form
                  className="mt-3 grid gap-2.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    consult.mutate(Object.fromEntries(new FormData(e.currentTarget)))
                  }}
                >
                  <TextField name="name" placeholder="Name" aria-label="Name" />
                  <TextField
                    name="email"
                    type="email"
                    placeholder="Email"
                    aria-label="Email"
                    required
                  />
                  <TextField
                    name="phone"
                    type="tel"
                    placeholder="Phone"
                    aria-label="Phone"
                    required
                  />
                  <Button type="submit" size="sm" block disabled={consult.isPending}>
                    {consult.isPending ? 'Submitting…' : 'Request a call'}
                  </Button>
                </form>
              )}
            </div>
          </aside>
        </div>

        {related?.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-5 text-[1.25rem]">Related reading</h2>
            <div className="grid grid-cols-3 gap-5 mx-1040:grid-cols-2 mx-640:grid-cols-1">
              {related.map((r) => (
                <Link
                  key={r._id}
                  to={`/blog/${r.slug}`}
                  className="overflow-hidden rounded-lg2 border border-line bg-white shadow-softer transition-transform duration-200 ease-gs hover:-translate-y-1"
                >
                  <CoverArt
                    image={r.image}
                    imageAlt={r.imageAlt}
                    gradientClass={r.heroClass}
                    label={r.heroLabel}
                    labelClass="text-[0.95rem]"
                    className="h-24"
                    sizes="240px"
                  />
                  <div className="p-4">
                    <h3 className="text-[0.95rem] leading-snug">{r.title}</h3>
                    <p className="mt-2 text-[0.75rem] text-muted">
                      {fmt(r.publishedAt)} · {r.readTime}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
