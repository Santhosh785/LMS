import { describe, expect, it } from 'vitest'
import * as seo from '../src/index.js'
import {
  absoluteUrl,
  blogPosting,
  breadcrumbList,
  course,
  courseMeta,
  escapeHtml,
  event,
  itemList,
  jsonLdScript,
  noindexMeta,
  notFoundMeta,
  organization,
  postMeta,
  programMeta,
  STATIC_PATHS,
  staticMeta,
  termMeta,
  toHeadHtml,
  toMetaDescriptors,
  webSite,
  workshopMeta,
} from '../src/index.js'

const site = {
  url: 'https://growthscholar.in/',
  brandName: 'Growth Scholar',
  logoUrl: '/logo.png',
  defaultDescription:
    'Native-language marketing upskilling. Self-paced courses and live workshops.',
}

const sampleCourse = {
  title: 'Performance Marketing Masterclass',
  slug: 'performance-marketing',
  summary: 'Plan, launch and scale Google and Meta ad campaigns that pay back.',
  image: '/uploads/courses/performance.jpg',
  imageAlt: 'Ads dashboard',
  amount: '4999.00',
  strikeAmount: '9999.00',
  hours: 12.5,
  rating: 4.6,
  enrolledCount: 1200,
  categories: ['Performance Marketing'],
  status: 'Published',
  visibility: 'Public',
}

const SUFFIX = ' | Growth Scholar'
const BAD_TEXT = /undefined|null|NaN|\[object Object\]/

/** Every mapper result must have the full SeoMeta shape with string fields. */
function expectComplete(meta) {
  expect(typeof meta.title).toBe('string')
  expect(meta.title.length).toBeGreaterThan(0)
  expect(typeof meta.description).toBe('string')
  expect(typeof meta.canonical).toBe('string')
  expect(typeof meta.robots).toBe('string')
  expect(meta.og).toEqual({
    type: expect.any(String),
    url: meta.canonical,
    image: expect.any(String),
    siteName: 'Growth Scholar',
  })
  expect(['summary', 'summary_large_image']).toContain(meta.twitterCard)
  expect(Array.isArray(meta.jsonLd)).toBe(true)
  expect(JSON.stringify(meta)).not.toMatch(BAD_TEXT)
  expect(toHeadHtml(meta)).not.toMatch(BAD_TEXT)
}

describe('exports', () => {
  it('exposes every named export', () => {
    for (const name of [
      'courseMeta',
      'programMeta',
      'workshopMeta',
      'postMeta',
      'termMeta',
      'staticMeta',
      'noindexMeta',
      'notFoundMeta',
      'organization',
      'webSite',
      'course',
      'blogPosting',
      'event',
      'breadcrumbList',
      'itemList',
      'absoluteUrl',
      'escapeHtml',
      'jsonLdScript',
      'toHeadHtml',
      'toMetaDescriptors',
    ]) {
      expect(typeof seo[name], name).toBe('function')
    }
  })
})

describe('absoluteUrl', () => {
  it('joins relative paths without double slashes', () => {
    expect(absoluteUrl(site, '/logo.png')).toBe('https://growthscholar.in/logo.png')
    expect(absoluteUrl(site, 'logo.png')).toBe('https://growthscholar.in/logo.png')
    expect(absoluteUrl({ ...site, url: 'https://growthscholar.in' }, '/a/b')).toBe(
      'https://growthscholar.in/a/b',
    )
  })
  it('passes absolute URLs through untouched', () => {
    expect(absoluteUrl(site, 'https://cdn.example.com/x.png?w=1')).toBe(
      'https://cdn.example.com/x.png?w=1',
    )
    expect(absoluteUrl(site, 'http://cdn.example.com/x.png')).toBe('http://cdn.example.com/x.png')
  })
  it('returns empty string for missing input', () => {
    expect(absoluteUrl(site, '')).toBe('')
    expect(absoluteUrl(site, null)).toBe('')
    expect(absoluteUrl(site, undefined)).toBe('')
  })
})

describe('escapeHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe('a &amp; b &lt; c &gt; d &quot; e &#39; f')
  })
  it('coerces non-strings and blanks null/undefined', () => {
    expect(escapeHtml(42)).toBe('42')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('title and description formatting', () => {
  it('suffixes the brand and keeps titles within ~60 chars', () => {
    const meta = courseMeta(
      {
        ...sampleCourse,
        title: 'An extremely long course title that goes on and on about marketing',
      },
      site,
    )
    expect(meta.title.endsWith(SUFFIX)).toBe(true)
    expect(meta.title.length).toBeLessThanOrEqual(60)
    expect(meta.title).toContain('…')
  })
  it('does not duplicate the brand', () => {
    expect(postMeta({ title: 'Hello | Growth Scholar', slug: 'x' }, site).title).toBe(
      'Hello | Growth Scholar',
    )
    expect(noindexMeta(site).title).toBe('Growth Scholar')
  })
  it('collapses whitespace and trims descriptions to ~160 chars on a word boundary', () => {
    const long = `Learn   growth\n\nmarketing ${'with practical projects and live mentors '.repeat(10)}`
    const meta = courseMeta({ ...sampleCourse, summary: long }, site)
    expect(meta.description.length).toBeLessThanOrEqual(160)
    expect(meta.description).not.toMatch(/\s{2,}/)
    expect(meta.description.endsWith('…')).toBe(true)
    const body = meta.description.slice(0, -1)
    expect(long.replace(/\s+/g, ' ')).toContain(`${body} `)
  })
  it('falls back to the site default description', () => {
    expect(courseMeta({ ...sampleCourse, summary: '   ' }, site).description).toBe(
      site.defaultDescription,
    )
  })
})

describe('courseMeta', () => {
  it('builds canonical, og, robots and twitter card', () => {
    const meta = courseMeta(sampleCourse, site)
    expectComplete(meta)
    expect(meta.title).toBe('Performance Marketing Masterclass | Growth Scholar')
    expect(meta.canonical).toBe('https://growthscholar.in/courses/performance-marketing')
    expect(meta.robots).toBe('index, follow')
    expect(meta.og.type).toBe('website')
    expect(meta.og.image).toBe('https://growthscholar.in/uploads/courses/performance.jpg')
    expect(meta.twitterCard).toBe('summary_large_image')
    expect(meta.jsonLd.map((j) => j['@type'])).toEqual(['Course', 'BreadcrumbList'])
  })
  it('falls back to the logo with a summary card when there is no image', () => {
    const meta = courseMeta({ ...sampleCourse, image: null }, site)
    expect(meta.og.image).toBe('https://growthscholar.in/logo.png')
    expect(meta.twitterCard).toBe('summary')
  })
  it('noindexes draft or hidden courses', () => {
    expect(courseMeta({ ...sampleCourse, status: 'Draft' }, site).robots).toMatch(/noindex/)
    expect(courseMeta({ ...sampleCourse, visibility: 'Hidden' }, site).robots).toMatch(/noindex/)
  })
  it('does not throw on an empty record', () => {
    expectComplete(courseMeta({}, site))
    expectComplete(courseMeta(null, site))
  })
})

describe('course JSON-LD', () => {
  it('has provider, INR offer and an online course instance', () => {
    const ld = course(sampleCourse, site)
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Course')
    expect(ld.name).toBe(sampleCourse.title)
    expect(ld.url).toBe('https://growthscholar.in/courses/performance-marketing')
    expect(ld.provider).toEqual({
      '@type': 'Organization',
      name: 'Growth Scholar',
      url: 'https://growthscholar.in',
      logo: 'https://growthscholar.in/logo.png',
    })
    expect(ld.offers).toMatchObject({
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: 4999,
      availability: 'https://schema.org/InStock',
      url: ld.url,
    })
    expect(ld.hasCourseInstance).toEqual({
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseWorkload: 'PT12H30M',
    })
  })
  it('derives ISO durations from hours', () => {
    expect(course({ ...sampleCourse, hours: 3 }, site).hasCourseInstance.courseWorkload).toBe(
      'PT3H',
    )
    expect(course({ ...sampleCourse, hours: '0.75' }, site).hasCourseInstance.courseWorkload).toBe(
      'PT45M',
    )
    expect(course({ ...sampleCourse, hours: 0 }, site).hasCourseInstance).not.toHaveProperty(
      'courseWorkload',
    )
    expect(
      course({ ...sampleCourse, hours: undefined }, site).hasCourseInstance,
    ).not.toHaveProperty('courseWorkload')
  })
  it('prices free courses at 0', () => {
    expect(course({ ...sampleCourse, amount: 0 }, site).offers.price).toBe(0)
    expect(course({ ...sampleCourse, price: 'free' }, site).offers.price).toBe(0)
    expect(course({ ...sampleCourse, amount: null }, site).offers.price).toBe(0)
  })
  it('adds aggregateRating only with a rating and a review count', () => {
    expect(course(sampleCourse, site)).not.toHaveProperty('aggregateRating')
    expect(course({ ...sampleCourse, rating: 0, ratingCount: 10 }, site)).not.toHaveProperty(
      'aggregateRating',
    )
    expect(course({ ...sampleCourse, ratingCount: 37 }, site).aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: 4.6,
      ratingCount: 37,
    })
  })
  it('omits missing optional properties', () => {
    const ld = course({ title: 'X', slug: 'x' }, site)
    expect(ld).not.toHaveProperty('image')
    expect(JSON.stringify(ld)).not.toMatch(BAD_TEXT)
  })
})

describe('programMeta', () => {
  it('maps a program', () => {
    const meta = programMeta(
      {
        title: 'Flagship Growth Cohort',
        slug: 'flagship',
        description: 'A 12-week mentor-led cohort.',
        eyebrow: 'Cohort',
        heroImage: 'https://cdn.example.com/hero.jpg',
        weeks: 12,
        pricing: { amount: 50000 },
      },
      site,
    )
    expectComplete(meta)
    expect(meta.canonical).toBe('https://growthscholar.in/programs/flagship')
    expect(meta.description).toBe('A 12-week mentor-led cohort.')
    expect(meta.og.image).toBe('https://cdn.example.com/hero.jpg')
    expect(meta.robots).toBe('index, follow')
  })
  it('does not throw on an empty record', () => {
    expectComplete(programMeta({}, site))
  })
})

describe('workshopMeta and event JSON-LD', () => {
  const online = {
    title: 'SEO Sprint',
    slug: 'seo-sprint',
    mode: 'online',
    image: '/uploads/ws.jpg',
    priceNew: '499',
    startsAt: '2026-11-12T13:30:00.000Z',
    durationLabel: '2 hours',
    host: 'Asha Rao',
    level: 'Beginner',
  }
  it('maps an online workshop to a VirtualLocation event', () => {
    const meta = workshopMeta(online, site)
    expectComplete(meta)
    expect(meta.canonical).toBe('https://growthscholar.in/workshops/seo-sprint')
    expect(meta.description).toContain('Online workshop on 12 Nov 2026')
    const ld = meta.jsonLd.find((j) => j['@type'] === 'Event')
    expect(ld.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode')
    expect(ld.location).toEqual({ '@type': 'VirtualLocation', url: meta.canonical })
    expect(ld.startDate).toBe('2026-11-12T13:30:00.000Z')
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled')
    expect(ld.organizer['@type']).toBe('Organization')
    expect(ld.offers).toMatchObject({ price: 499, priceCurrency: 'INR', url: meta.canonical })
  })
  it('maps an offline workshop to a Place', () => {
    const ld = event(
      {
        ...online,
        mode: 'offline',
        venue: 'WeWork, Bengaluru',
        startsAt: new Date('2026-11-12T13:30:00Z'),
      },
      site,
    )
    expect(ld.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode')
    expect(ld.location).toEqual({
      '@type': 'Place',
      name: 'WeWork, Bengaluru',
      address: 'WeWork, Bengaluru',
    })
    expect(ld.startDate).toBe('2026-11-12T13:30:00.000Z')
  })
  it('omits startDate when it is missing or invalid', () => {
    expect(event({ ...online, startsAt: null }, site)).not.toHaveProperty('startDate')
    expect(event({ ...online, startsAt: 'not a date' }, site)).not.toHaveProperty('startDate')
  })
  it('does not throw on an empty record', () => {
    expectComplete(workshopMeta({}, site))
  })
})

describe('postMeta and blogPosting JSON-LD', () => {
  const post = {
    title: 'How to plan an SEO content calendar',
    slug: 'seo-content-calendar',
    excerpt: '<p>A step-by-step guide.</p>',
    image: '/uploads/blog/seo.jpg',
    author: { name: 'Ravi Kumar', role: 'Editor' },
    publishedAt: '2026-10-01T05:00:00.000Z',
    updatedAt: '2026-10-05T05:00:00.000Z',
    category: 'SEO',
    seo: {},
  }
  it('maps a post', () => {
    const meta = postMeta(post, site)
    expectComplete(meta)
    expect(meta.canonical).toBe('https://growthscholar.in/blog/seo-content-calendar')
    expect(meta.og.type).toBe('article')
    expect(meta.robots).toBe('index, follow')
    expect(meta.description).toBe('A step-by-step guide.')
    const ld = meta.jsonLd.find((j) => j['@type'] === 'BlogPosting')
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      headline: post.title,
      image: 'https://growthscholar.in/uploads/blog/seo.jpg',
      datePublished: '2026-10-01T05:00:00.000Z',
      dateModified: '2026-10-05T05:00:00.000Z',
      author: { '@type': 'Person', name: 'Ravi Kumar' },
      publisher: { '@type': 'Organization', name: 'Growth Scholar' },
      mainEntityOfPage: { '@type': 'WebPage', '@id': meta.canonical },
    })
  })
  it('falls back for dateModified and author', () => {
    const ld = blogPosting({ ...post, updatedAt: null, author: null }, site)
    expect(ld.dateModified).toBe(ld.datePublished)
    expect(ld.author).toMatchObject({ '@type': 'Organization', name: 'Growth Scholar' })
  })
  it('honours seo overrides', () => {
    const meta = postMeta(
      {
        ...post,
        seo: {
          metaTitle: 'SEO calendar template',
          metaDescription: 'Download our SEO calendar.',
          canonicalUrl: '/blog/seo-calendar/?utm=x#top',
          ogImage: 'https://cdn.example.com/og.png',
          noIndex: true,
        },
      },
      site,
    )
    expect(meta.title).toBe('SEO calendar template | Growth Scholar')
    expect(meta.description).toBe('Download our SEO calendar.')
    expect(meta.canonical).toBe('https://growthscholar.in/blog/seo-calendar')
    expect(meta.og.url).toBe(meta.canonical)
    expect(meta.og.image).toBe('https://cdn.example.com/og.png')
    expect(meta.robots).toBe('noindex, nofollow')
    expect(meta.jsonLd[0].mainEntityOfPage['@id']).toBe(meta.canonical)
  })
  it('keeps an absolute canonical override as-is', () => {
    const meta = postMeta(
      { ...post, seo: { canonicalUrl: 'https://medium.com/@gs/original-post' } },
      site,
    )
    expect(meta.canonical).toBe('https://medium.com/@gs/original-post')
  })
  it('ignores empty-string overrides', () => {
    const meta = postMeta(
      {
        ...post,
        seo: { metaTitle: '', metaDescription: ' ', canonicalUrl: '', ogImage: '', noIndex: false },
      },
      site,
    )
    expect(meta.title).toBe(`${post.title}${SUFFIX}`)
    expect(meta.canonical).toBe('https://growthscholar.in/blog/seo-content-calendar')
    expect(meta.og.image).toBe('https://growthscholar.in/uploads/blog/seo.jpg')
    expect(meta.robots).toBe('index, follow')
  })
  it('does not throw on an empty record', () => {
    expectComplete(postMeta({}, site))
    expectComplete(postMeta({ seo: null, author: 'not json' }, site))
  })
})

describe('termMeta', () => {
  it('keeps the topic query in the canonical', () => {
    const meta = termMeta(
      { name: 'Social Media & Ads', slug: 'social', description: 'Grow on social.' },
      site,
    )
    expectComplete(meta)
    expect(meta.canonical).toBe(
      'https://growthscholar.in/courses/category?topic=Social%20Media%20%26%20Ads',
    )
    expect(meta.title).toBe('Social Media & Ads courses | Growth Scholar')
    expect(meta.description).toBe('Grow on social.')
    expect(meta.robots).toBe('index, follow')
  })
  it('honours seo overrides', () => {
    const meta = termMeta(
      {
        name: 'SEO',
        seo: {
          metaTitle: 'Best SEO courses',
          metaDescription: 'Rank higher.',
          ogImage: '/uploads/seo.png',
          canonicalUrl: 'https://growthscholar.in/courses/category?topic=SEO',
          noIndex: true,
        },
      },
      site,
    )
    expect(meta.title).toBe('Best SEO courses | Growth Scholar')
    expect(meta.description).toBe('Rank higher.')
    expect(meta.og.image).toBe('https://growthscholar.in/uploads/seo.png')
    expect(meta.canonical).toBe('https://growthscholar.in/courses/category?topic=SEO')
    expect(meta.robots).toMatch(/noindex/)
  })
  it('does not throw on an empty record', () => {
    expectComplete(termMeta({}, site))
  })
})

describe('staticMeta', () => {
  const listed = [
    '/',
    '/about',
    '/courses',
    '/workshops',
    '/blog',
    '/privacy',
    '/terms',
    '/refund',
    '/delivery',
    '/contact',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/programs/apply',
    '/programs/fit-call',
    '/resources/playbooks',
    '/resources/claude-skills',
  ]
  it('covers exactly the 18 listed paths with distinct titles and descriptions', () => {
    expect([...STATIC_PATHS].sort()).toEqual([...listed].sort())
    const metas = listed.map((p) => staticMeta(p, site))
    metas.forEach(expectComplete)
    expect(new Set(metas.map((m) => m.title)).size).toBe(18)
    expect(new Set(metas.map((m) => m.description)).size).toBe(18)
    for (const m of metas) {
      expect(m.title.length).toBeLessThanOrEqual(60)
      expect(m.description.length).toBeLessThanOrEqual(160)
    }
    for (const [i, p] of listed.entries()) {
      expect(metas[i].canonical).toBe(
        p === '/' ? 'https://growthscholar.in' : `https://growthscholar.in${p}`,
      )
    }
  })
  it('emits organization and webSite JSON-LD on the home page', () => {
    const meta = staticMeta('/', site)
    expect(meta.jsonLd).toEqual([organization(site), webSite(site)])
    expect(meta.robots).toBe('index, follow')
  })
  it('noindexes auth pages but follows links', () => {
    for (const p of ['/login', '/signup', '/forgot-password', '/reset-password']) {
      expect(staticMeta(p, site).robots).toBe('noindex, follow')
    }
    expect(staticMeta('/about', site).robots).toBe('index, follow')
  })
  it('ignores trailing slashes', () => {
    expect(staticMeta('/about/', site)).toEqual(staticMeta('/about', site))
    expect(staticMeta('/resources/playbooks//', site)).toEqual(
      staticMeta('/resources/playbooks', site),
    )
  })
  it('returns the noindex result for unknown paths', () => {
    expect(staticMeta('/nope', site)).toEqual(noindexMeta(site))
    expect(staticMeta('/admin', site)).toEqual(noindexMeta(site))
  })
})

describe('noindexMeta and notFoundMeta', () => {
  it('noindexMeta is brand-default and noindex with no JSON-LD', () => {
    const meta = noindexMeta(site)
    expect(meta.title).toBe('Growth Scholar')
    expect(meta.description).toBe(site.defaultDescription)
    expect(meta.robots).toBe('noindex, nofollow')
    expect(meta.jsonLd).toEqual([])
    expect(meta).not.toHaveProperty('status')
  })
  it('notFoundMeta returns 404 and noindex', () => {
    const meta = notFoundMeta(site)
    expect(meta.status).toBe(404)
    expect(meta.title).toBe('Page not found | Growth Scholar')
    expect(meta.robots).toMatch(/noindex/)
    expect(meta.jsonLd).toEqual([])
    expect(toHeadHtml(meta)).not.toContain('rel="canonical"')
  })
})

describe('breadcrumbList and itemList', () => {
  it('numbers breadcrumb items from 1', () => {
    expect(
      breadcrumbList([
        { name: 'Home', url: 'https://x.in' },
        { name: 'Courses', url: 'https://x.in/courses' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://x.in' },
        { '@type': 'ListItem', position: 2, name: 'Courses', item: 'https://x.in/courses' },
      ],
    })
  })
  it('lists URLs from 1', () => {
    expect(itemList(['https://x.in/a', 'https://x.in/b'])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, url: 'https://x.in/a' },
        { '@type': 'ListItem', position: 2, url: 'https://x.in/b' },
      ],
    })
  })
  it('names { url, name } entries and skips entries without a URL', () => {
    expect(
      itemList([
        { url: 'https://x.in/a', name: '  Post  A ' },
        { url: '', name: 'No URL' },
        { url: 'https://x.in/b' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, url: 'https://x.in/a', name: 'Post A' },
        { '@type': 'ListItem', position: 2, url: 'https://x.in/b' },
      ],
    })
  })
})

describe('jsonLdScript', () => {
  it('never contains a raw < inside the JSON and round-trips', () => {
    const obj = {
      a: '</script><script>alert(1)</script>',
      b: 'x > y & z',
      c: 'line\u2028sep\u2029',
    }
    const html = jsonLdScript(obj)
    const inner = html.slice('<script type="application/ld+json">'.length, -'</script>'.length)
    expect(inner).not.toContain('<')
    expect(inner).not.toContain('>')
    expect(inner).not.toContain('&')
    expect(inner).not.toContain('\u2028')
    expect(inner).not.toContain('\u2029')
    expect(JSON.parse(inner)).toEqual(obj)
  })
})

describe('toHeadHtml', () => {
  it('renders every tag for a course', () => {
    const html = toHeadHtml(courseMeta(sampleCourse, site))
    for (const needle of [
      '<title>Performance Marketing Masterclass | Growth Scholar</title>',
      '<meta name="description" content="',
      '<link rel="canonical" href="https://growthscholar.in/courses/performance-marketing">',
      '<meta name="robots" content="index, follow">',
      '<meta property="og:title"',
      '<meta property="og:description"',
      '<meta property="og:type" content="website">',
      '<meta property="og:url" content="https://growthscholar.in/courses/performance-marketing">',
      '<meta property="og:image"',
      '<meta property="og:site_name" content="Growth Scholar">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title"',
      '<meta name="twitter:description"',
      '<meta name="twitter:image"',
    ]) {
      expect(html).toContain(needle)
    }
    expect(html.match(/<script type="application\/ld\+json">/g)).toHaveLength(2)
  })
  it('a hostile title cannot break out of any tag', () => {
    const evil = `</script><script>alert(1)</script>"'&`
    const html = toHeadHtml(
      courseMeta(
        { ...sampleCourse, title: evil, summary: evil, image: `/x.png" onerror="alert(1)` },
        site,
      ),
    )
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toContain('</script><script>')
    expect(html).not.toContain('" onerror="')
    // Only the two JSON-LD scripts open and close.
    expect(html.match(/<script/g)).toHaveLength(2)
    expect(html.match(/<\/script>/g)).toHaveLength(2)
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&amp;')
  })
  it('escapes & < > " \' in text and attribute values', () => {
    const meta = {
      ...noindexMeta(site),
      title: `A & B <C> "D" 'E'`,
      description: `x & y <z> "q" 'r'`,
      canonical: `https://x.in/a?b=1&c="2"`,
    }
    const html = toHeadHtml(meta)
    expect(html).toContain('<title>A &amp; B &lt;C&gt; &quot;D&quot; &#39;E&#39;</title>')
    expect(html).toContain(
      '<meta name="description" content="x &amp; y &lt;z&gt; &quot;q&quot; &#39;r&#39;">',
    )
    expect(html).toContain('<link rel="canonical" href="https://x.in/a?b=1&amp;c=&quot;2&quot;">')
  })
})

describe('toMetaDescriptors', () => {
  it('returns the five descriptor shapes with one script per JSON-LD entry', () => {
    const meta = courseMeta({ ...sampleCourse, title: 'Ads & <Analytics>' }, site)
    const descriptors = toMetaDescriptors(meta)
    expect(descriptors[0]).toEqual({ title: 'Ads & <Analytics> | Growth Scholar' })
    expect(descriptors).toContainEqual({ name: 'description', content: meta.description })
    expect(descriptors).toContainEqual({ name: 'robots', content: 'index, follow' })
    expect(descriptors).toContainEqual({ property: 'og:title', content: meta.title })
    expect(descriptors).toContainEqual({ property: 'og:type', content: 'website' })
    expect(descriptors).toContainEqual({ property: 'og:url', content: meta.canonical })
    expect(descriptors).toContainEqual({ property: 'og:image', content: meta.og.image })
    expect(descriptors).toContainEqual({ property: 'og:site_name', content: 'Growth Scholar' })
    expect(descriptors).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(descriptors).toContainEqual({ name: 'twitter:image', content: meta.og.image })
    expect(descriptors).toContainEqual({ tagName: 'link', rel: 'canonical', href: meta.canonical })
    const scripts = descriptors.filter((d) => 'script:ld+json' in d)
    expect(scripts).toHaveLength(meta.jsonLd.length)
    expect(scripts.map((d) => d['script:ld+json'])).toEqual(meta.jsonLd)
  })
  it('does not HTML-escape values', () => {
    const descriptors = toMetaDescriptors({ ...noindexMeta(site), title: 'A & B' })
    expect(descriptors[0]).toEqual({ title: 'A & B' })
  })
  it('omits the canonical link when there is none', () => {
    expect(toMetaDescriptors(notFoundMeta(site)).some((d) => d.rel === 'canonical')).toBe(false)
  })
})
