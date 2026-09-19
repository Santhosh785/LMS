import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, Loading, TextAreaField, TextField, useToast } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import CoverArt from '../../components/CoverArt.jsx'
import { plainText, renderRich, safeHref } from '../../lib/richText.jsx'
import { embedFrom } from '../../lib/embed.js'

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * Renders the structured body blocks the API returns.
 *
 * Every block is a named shape rather than stored HTML, so nothing here reaches
 * dangerouslySetInnerHTML. Inline emphasis goes through renderRich, which only
 * understands the restricted `**bold** / *italic* / [text](url)` grammar — see
 * lib/richText.jsx.
 */
function Block({ block }) {
  const align =
    block.align === 'center'
      ? 'text-center'
      : block.align === 'right'
        ? 'text-right'
        : block.align === 'wide'
          ? 'mx-960:mx-0 -mx-8'
          : ''

  switch (block.type) {
    case 'h2':
      return (
        <h2 id={anchor(block.text)} className="mt-10 scroll-mt-28 text-[1.35rem]">
          {renderRich(block.text)}
        </h2>
      )
    case 'h3':
      return <h3 className="mt-8 text-[1.1rem]">{renderRich(block.text)}</h3>
    case 'h4':
      return <h4 className="mt-6 text-[1rem]">{renderRich(block.text)}</h4>
    case 'ul':
      return (
        <>
          {block.text && <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">{renderRich(block.text)}</p>}
          <ul className="mt-4 grid gap-2 text-[0.98rem] leading-relaxed text-muted">
            {block.items?.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent-mid">•</span>
                <span>{renderRich(item)}</span>
              </li>
            ))}
          </ul>
        </>
      )
    case 'ol':
      return (
        <>
          {block.text && <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">{renderRich(block.text)}</p>}
          <ol className="mt-4 grid list-decimal gap-2 pl-5 text-[0.98rem] leading-relaxed text-muted">
            {block.items?.map((item, i) => (
              <li key={i}>{renderRich(item)}</li>
            ))}
          </ol>
        </>
      )
    case 'quote':
      return (
        <blockquote className="mt-6 border-l-4 border-accent bg-white px-5 py-4 text-[1.02rem] italic text-brand-deep">
          {renderRich(block.text)}
          {block.citation && (
            <cite className="mt-2 block text-[0.82rem] not-italic text-muted">— {block.citation}</cite>
          )}
        </blockquote>
      )
    case 'callout':
      return (
        <aside className="mt-6 rounded-lg2 bg-accent-soft px-5 py-4">
          <p className="font-semibold text-brand">{renderRich(block.text)}</p>
          {block.items?.length > 0 && (
            <ul className="mt-2 grid gap-1 text-[0.92rem] text-brand-deep">
              {block.items.map((item, i) => (
                <li key={i}>• {renderRich(item)}</li>
              ))}
            </ul>
          )}
        </aside>
      )
    case 'image': {
      const image = (
        <img
          src={block.url}
          // Built from the Media Library's generated sizes — see the public
          // blog route. A phone picks the 300w file instead of the 1024w one.
          srcSet={block.srcset || undefined}
          sizes={block.srcset ? '(max-width: 960px) 100vw, 720px' : undefined}
          alt={block.alt || ''}
          width={block.width || undefined}
          height={block.height || undefined}
          loading="lazy"
          className={cn('rounded-lg2', block.align === 'center' ? 'mx-auto' : '')}
        />
      )
      return (
        <figure className={cn('mt-6', align)}>
          {safeHref(block.href) ? (
            <a href={safeHref(block.href)} target="_blank" rel="noreferrer noopener">
              {image}
            </a>
          ) : (
            image
          )}
          {block.caption && (
            <figcaption className="mt-2 text-center text-[0.8rem] text-muted">{renderRich(block.caption)}</figcaption>
          )}
        </figure>
      )
    }
    case 'code':
      return (
        <pre className="mt-6 overflow-x-auto rounded-lg2 bg-brand-deep px-5 py-4 text-[0.85rem] leading-relaxed text-white">
          {block.language && (
            <span className="mb-2 block text-[0.7rem] uppercase tracking-wider text-accent">{block.language}</span>
          )}
          <code>{block.text}</code>
        </pre>
      )
    case 'separator':
      return <hr className="mx-auto mt-8 w-24 border-t border-line-strong" />
    case 'button': {
      const href = safeHref(block.url)
      if (!href || !block.text) return null
      return (
        <p className={cn('mt-6', align || 'text-left')}>
          <a
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer noopener"
            className={cn(
              'inline-block rounded-full px-6 py-3 text-[0.92rem] font-semibold transition-colors duration-200',
              block.style === 'outline'
                ? 'border border-brand text-brand hover:bg-brand hover:text-white'
                : 'bg-brand text-white hover:bg-brand-deep',
            )}
          >
            {block.text}
          </a>
        </p>
      )
    }
    case 'embed':
      return <Embed block={block} />
    case 'table':
      return (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-[0.92rem]">
            <tbody>
              {block.rows?.map((row, r) => (
                <tr key={r} className={r === 0 && block.header ? 'bg-surface-mist font-semibold text-brand-deep' : ''}>
                  {row.cells?.map((cell, c) => (
                    <td key={c} className="border border-line px-3 py-2 align-top text-muted">
                      {renderRich(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">{renderRich(block.text)}</p>
  }
}

/**
 * Click-to-load video.
 *
 * The provider's iframe is only inserted once a reader asks for it, so an
 * article that happens to embed a video does not hand every visitor to YouTube
 * before they have chosen to watch anything.
 */
function Embed({ block }) {
  const [playing, setPlaying] = useState(false)
  const embed = embedFrom(block.url)
  if (!embed) return null

  return (
    <figure className="mt-6">
      <div className="relative aspect-video overflow-hidden rounded-lg2 bg-brand-deep">
        {playing ? (
          <iframe
            src={`${embed.src}?autoplay=1`}
            title={block.caption || `${embed.provider} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 grid h-full w-full place-items-center"
            aria-label={`Play the ${embed.provider} video`}
          >
            {embed.thumb && (
              <img src={embed.thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70" />
            )}
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white/90 text-[1.1rem] text-brand-deep transition-transform duration-200 ease-gs group-hover:scale-110">
              ▶
            </span>
          </button>
        )}
      </div>
      {block.caption && (
        <figcaption className="mt-2 text-center text-[0.8rem] text-muted">{renderRich(block.caption)}</figcaption>
      )}
    </figure>
  )
}

const anchor = (text = '') =>
  plainText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export default function BlogPost() {
  const { slug } = useParams()
  const [copied, setCopied] = useState(false)
  const [tocOpen, setTocOpen] = useState(true)
  const [consultDone, setConsultDone] = useState(false)
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isPending, error } = useQuery({
    queryKey: ['blog', 'post', slug],
    queryFn: async () => (await api.get(`/blog/${slug}`)).data,
  })

  useDocumentTitle(data?.post ? `${data.post.title} | Growth Scholar` : 'Article | Growth Scholar')

  useEffect(() => {
    const post = data?.post
    if (!post) return undefined
    const setMeta = (name, content) => {
      if (!content) return
      let tag = document.head.querySelector(`meta[name="${name}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.name = name
        document.head.appendChild(tag)
      }
      tag.content = content
    }
    const setProperty = (property, content) => {
      if (!content) return
      let tag = document.head.querySelector(`meta[property="${property}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('property', property)
        document.head.appendChild(tag)
      }
      tag.content = content
    }
    document.title = `${post.seo?.metaTitle || post.title} | Growth Scholar`
    setMeta('description', post.seo?.metaDescription || post.excerpt)
    setMeta('robots', post.seo?.noIndex ? 'noindex, nofollow' : 'index, follow')
    setProperty('og:title', post.seo?.metaTitle || post.title)
    setProperty('og:description', post.seo?.metaDescription || post.excerpt)
    setProperty('og:image', post.seo?.ogImage || post.image)
    if (post.seo?.canonicalUrl) {
      let tag = document.head.querySelector('link[rel="canonical"]')
      if (!tag) {
        tag = document.createElement('link')
        tag.rel = 'canonical'
        document.head.appendChild(tag)
      }
      tag.href = post.seo.canonicalUrl
    }
    return undefined
  }, [data?.post])

  const consult = useMutation({
    mutationFn: async (payload) =>
      (await api.post('/leads', { ...payload, source: 'blog-consult' })).data,
    onSuccess: () => setConsultDone(true),
    onError: (err) => toast.show(apiError(err)),
  })

  const comments = useQuery({
    queryKey: ['blog', 'comments', slug],
    queryFn: async () => (await api.get(`/blog/${slug}/comments`)).data,
    enabled: Boolean(data?.post?.allowComments),
  })
  const comment = useMutation({
    mutationFn: async (payload) => (await api.post(`/blog/${slug}/comments`, payload)).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['blog', 'comments', slug] })
      toast.show(result.message)
    },
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
              {[
                { label: 'WA', href: `https://wa.me/?text=${encodeURIComponent(window.location.href)}` },
                {
                  label: 'in',
                  href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`,
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-8 w-8 place-items-center rounded-full border border-line text-[0.7rem] font-bold text-muted hover:border-brand hover:text-brand"
                >
                  {s.label}
                </a>
              ))}
            </div>

            {/*
              The height belongs to the gradient, not to a photograph. Putting
              `h-48` on both states squeezed a real cover image into a 192px
              band the full width of the article and let object-cover zoom in to
              fill it, which reads as a blurry crop of the middle of the picture.
              Same split as the course and workshop pages.
            */}
            <CoverArt
              image={post.image}
              imageAlt={post.imageAlt}
              gradientClass={post.heroClass}
              label={post.heroLabel}
              labelClass="text-[1.6rem]"
              className="mt-7 rounded-xl2"
              fallbackClass="h-48 px-6"
              imageClass="aspect-[16/9]"
              srcSet={post.imageSrcset}
              naturalWidth={post.imageWidth}
              naturalHeight={post.imageHeight}
              sizes="(max-width: 960px) 100vw, calc(100vw - 340px)"
            />

            <div className="mt-8">
              {post.body?.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </div>

            {post.allowComments && (
              <section className="mt-12 border-t border-line pt-8">
                <h2 className="text-[1.25rem]">Comments</h2>
                {comments.data?.items?.length > 0 ? (
                  <div className="mt-5 grid gap-4">
                    {comments.data.items.map((entry) => (
                      <article key={entry._id} className="rounded-lg2 border border-line bg-white p-4">
                        <p className="text-[0.85rem] font-semibold text-brand-deep">{entry.name}</p>
                        <p className="mt-1 text-[0.78rem] text-muted">{fmt(entry.createdAt)}</p>
                        <p className="mt-2 whitespace-pre-wrap text-[0.92rem] leading-relaxed text-muted">{entry.body}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[0.88rem] text-muted">Be the first to comment.</p>
                )}
                <form
                  className="mt-6 grid gap-3 rounded-lg2 border border-line bg-white p-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const form = event.currentTarget
                    comment.mutate(Object.fromEntries(new FormData(form)), { onSuccess: () => form.reset() })
                  }}
                >
                  <h3 className="text-[1rem]">Leave a comment</h3>
                  <div className="grid grid-cols-2 gap-3 mx-640:grid-cols-1">
                    <TextField name="name" label="Name" required />
                    <TextField name="email" type="email" label="Email" required />
                  </div>
                  <TextAreaField name="body" label="Comment" rows={4} required />
                  <p className="text-[0.75rem] text-muted">Comments are reviewed before they appear.</p>
                  <Button type="submit" size="sm" disabled={comment.isPending}>
                    {comment.isPending ? 'Sending…' : 'Submit comment'}
                  </Button>
                </form>
              </section>
            )}
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
                      href={`#${anchor(h.text)}`}
                      className="text-[0.85rem] text-muted hover:text-brand"
                    >
                      {plainText(h.text)}
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
