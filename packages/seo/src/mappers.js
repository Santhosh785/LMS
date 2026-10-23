/**
 * Page mappers: DB-shaped records in, a complete SeoMeta out. No routing —
 * a later layer decides which mapper serves which URL.
 */

import {
  absoluteUrl,
  asObject,
  canonicalUrl,
  collapse,
  formatDescription,
  formatTitle,
  plainText,
} from './format.js'
import {
  blogPosting,
  breadcrumbList,
  course,
  coursePath,
  event,
  organization,
  postPath,
  programPath,
  webSite,
  workshopDescription,
  workshopPath,
} from './jsonld.js'

/** @typedef {import('./types.js').Site} Site */
/** @typedef {import('./types.js').SeoMeta} SeoMeta */

export const INDEX = 'index, follow'
export const NOINDEX_FOLLOW = 'noindex, follow'
export const NOINDEX = 'noindex, nofollow'

/**
 * Assemble a SeoMeta from page-level inputs, applying the shared title,
 * description, image and Open Graph rules.
 * @returns {SeoMeta}
 */
function build({
  site,
  title,
  description,
  canonical,
  robots = INDEX,
  ogType = 'website',
  image,
  jsonLd = [],
  status,
}) {
  const pageImage = absoluteUrl(site, image)
  /** @type {SeoMeta} */
  const meta = {
    title: formatTitle(title, site),
    description: formatDescription(description, site),
    canonical,
    robots,
    og: {
      type: ogType,
      url: canonical,
      image: pageImage || absoluteUrl(site, site?.logoUrl),
      siteName: collapse(site?.brandName),
    },
    twitterCard: pageImage ? 'summary_large_image' : 'summary',
    jsonLd,
  }
  if (status != null) meta.status = status
  return meta
}

/** Breadcrumb items rooted at the home page. */
function crumbs(site, ...items) {
  return breadcrumbList([{ name: 'Home', url: canonicalUrl(site, '/') }, ...items])
}

/**
 * Reads the shared `seo` JSON overrides (posts and terms). Empty strings are
 * ignored so a cleared admin field falls back to the default.
 */
function seoOverrides(seoValue, site, { keepQuery = false } = {}) {
  const seo = asObject(seoValue)
  const pick = (key) => collapse(seo[key])
  const canonical = pick('canonicalUrl')
  return {
    title: pick('metaTitle'),
    description: pick('metaDescription'),
    image: pick('ogImage'),
    canonical: !canonical
      ? ''
      : /^https?:\/\//i.test(canonical)
        ? canonical
        : canonicalUrl(site, canonical, { keepQuery }),
    noIndex: seo.noIndex === true || seo.noIndex === 'true',
  }
}

/** Draft or hidden courses must not be indexed even if a URL leaks. */
function courseIsPublic(c) {
  const status = collapse(c.status).toLowerCase()
  const visibility = collapse(c.visibility).toLowerCase()
  return (!status || status === 'published') && (!visibility || visibility === 'public')
}

/**
 * @param {Record<string, any>} courseRecord
 * @param {Site} site
 * @returns {SeoMeta}
 */
export function courseMeta(courseRecord, site) {
  const c = asObject(courseRecord)
  const canonical = canonicalUrl(site, coursePath(c.slug))
  return build({
    site,
    title: c.title,
    description: c.summary,
    canonical,
    robots: courseIsPublic(c) ? INDEX : NOINDEX,
    image: c.image,
    jsonLd: [
      course(c, site),
      crumbs(
        site,
        { name: 'Courses', url: canonicalUrl(site, '/courses') },
        { name: collapse(c.title), url: canonical },
      ),
    ],
  })
}

/**
 * @param {Record<string, any>} program
 * @param {Site} site
 * @returns {SeoMeta}
 */
export function programMeta(program, site) {
  const p = asObject(program)
  const canonical = canonicalUrl(site, programPath(p.slug))
  const weeks = Number(p.weeks)
  const fallback =
    Number.isFinite(weeks) && weeks > 0 && collapse(p.title)
      ? `${collapse(p.title)}: a ${weeks}-week program from ${collapse(site?.brandName)}.`
      : ''
  return build({
    site,
    title: p.title,
    description: plainText(p.description) || plainText(p.eyebrow) || fallback,
    canonical,
    image: p.heroImage,
    jsonLd: [crumbs(site, { name: collapse(p.title), url: canonical })],
  })
}

/**
 * @param {Record<string, any>} workshop
 * @param {Site} site
 * @returns {SeoMeta}
 */
export function workshopMeta(workshop, site) {
  const w = asObject(workshop)
  const canonical = canonicalUrl(site, workshopPath(w.slug))
  return build({
    site,
    title: w.title,
    description: workshopDescription(w),
    canonical,
    image: w.image,
    jsonLd: [
      event(w, site),
      crumbs(
        site,
        { name: 'Workshops', url: canonicalUrl(site, '/workshops') },
        { name: collapse(w.title), url: canonical },
      ),
    ],
  })
}

/**
 * Blog post. Honours post.seo: metaTitle, metaDescription, canonicalUrl,
 * ogImage, noIndex.
 * @param {Record<string, any>} post
 * @param {Site} site
 * @returns {SeoMeta}
 */
export function postMeta(post, site) {
  const p = asObject(post)
  const seo = seoOverrides(p.seo, site)
  const canonical = seo.canonical || canonicalUrl(site, postPath(p.slug))
  const posting = blogPosting(p, site)
  return build({
    site,
    title: seo.title || p.title,
    description: seo.description || p.excerpt,
    canonical,
    robots: seo.noIndex ? NOINDEX : INDEX,
    ogType: 'article',
    image: seo.image || p.image,
    jsonLd: [
      { ...posting, url: canonical, mainEntityOfPage: { '@type': 'WebPage', '@id': canonical } },
      crumbs(
        site,
        { name: 'Blog', url: canonicalUrl(site, '/blog') },
        { name: collapse(p.title), url: canonical },
      ),
    ],
  })
}

/**
 * Course category page (`/courses/category?topic=<name>`) for a taxonomy
 * term. Honours term.seo with the same keys as posts.
 * @param {Record<string, any>} term
 * @param {Site} site
 * @returns {SeoMeta}
 */
export function termMeta(term, site) {
  const t = asObject(term)
  const seo = seoOverrides(t.seo, site, { keepQuery: true })
  const name = collapse(t.name)
  const canonical =
    seo.canonical ||
    canonicalUrl(
      site,
      name ? `/courses/category?topic=${encodeURIComponent(name)}` : '/courses/category',
      {
        keepQuery: true,
      },
    )
  const heading = !name ? 'Courses' : /\bcourses?$/i.test(name) ? name : `${name} courses`
  const brand = collapse(site?.brandName)
  return build({
    site,
    title: seo.title || heading,
    description:
      seo.description ||
      plainText(t.description) ||
      (name ? `Browse ${name} courses${brand ? ` from ${brand}` : ''}.` : ''),
    canonical,
    robots: seo.noIndex ? NOINDEX : INDEX,
    image: seo.image,
    jsonLd: [
      crumbs(
        site,
        { name: 'Courses', url: canonicalUrl(site, '/courses') },
        name ? { name, url: canonical } : null,
      ),
    ],
  })
}

/**
 * Static pages. Each value maps the brand name to a { title, description };
 * `robots` and `jsonLd` are optional.
 * @type {Record<string, (brand: string) => { title: string, description: string, robots?: string, jsonLd?: (site: Site) => object[] }>}
 */
const STATIC_PAGES = {
  '/': (brand) => ({
    title: 'Become a Growth Marketer',
    description: `Native-language marketing upskilling from ${brand}: self-paced courses, free starters, live workshops and the Complete Growth Marketing Course.`,
    jsonLd: (site) => [organization(site), webSite(site)],
  }),
  '/about': (brand) => ({
    title: 'About Us',
    description: `${brand} helps people learn growth marketing in their own language, with practical courses, live workshops and mentor-led cohorts.`,
  }),
  '/courses': () => ({
    title: 'Explore Digital Marketing Courses',
    description:
      'Browse self-paced growth and digital marketing courses, from free starters to in-depth tracks, taught in your language with practical projects.',
  }),
  '/workshops': () => ({
    title: 'Live Marketing Workshops',
    description:
      'Join live online and in-person growth marketing workshops led by practitioners. Pick a date, register, and learn hands-on in a few hours.',
  }),
  '/blog': (brand) => ({
    title: 'Blog',
    description: `Growth marketing guides, playbooks and case studies from the ${brand} team: SEO, paid ads, content, analytics and career advice.`,
  }),
  '/privacy': (brand) => ({
    title: 'Privacy Policy',
    description: `How ${brand} collects, uses and protects your personal data when you use our website, courses and services.`,
  }),
  '/terms': (brand) => ({
    title: 'Terms of Service',
    description: `The terms and conditions that govern your use of the ${brand} website, courses, workshops and other services.`,
  }),
  '/refund': (brand) => ({
    title: 'Refund Policy',
    description: `When and how you can request a refund for ${brand} courses, programs and workshops, and how long refunds take to process.`,
  }),
  '/delivery': (brand) => ({
    title: 'Delivery Policy',
    description: `How ${brand} delivers access to purchased courses, programs and workshops, including timelines and what to do if access is delayed.`,
  }),
  '/contact': (brand) => ({
    title: 'Contact Us',
    description: `Get in touch with the ${brand} team about courses, programs, workshops, payments or partnerships.`,
  }),
  '/login': (brand) => ({
    title: 'Sign in',
    description: `Sign in to your ${brand} account to continue your courses, join live sessions and track your progress.`,
    robots: NOINDEX_FOLLOW,
  }),
  '/signup': (brand) => ({
    title: 'Create your account',
    description: `Create a free ${brand} account to start learning growth marketing with free starter courses and live workshops.`,
    robots: NOINDEX_FOLLOW,
  }),
  '/forgot-password': (brand) => ({
    title: 'Forgot your password',
    description: `Reset the password for your ${brand} account. Enter your email address and we will send you a secure reset link.`,
    robots: NOINDEX_FOLLOW,
  }),
  '/reset-password': (brand) => ({
    title: 'Choose a new password',
    description: `Choose a new password for your ${brand} account.`,
    robots: NOINDEX_FOLLOW,
  }),
  '/programs/apply': (brand) => ({
    title: 'Apply for the Flagship Cohort',
    description: `Apply for the ${brand} flagship growth marketing cohort: a mentor-led program with live classes, real projects and career support.`,
  }),
  '/programs/fit-call': (brand) => ({
    title: 'Book a Fit Call',
    description: `Book a free call with the ${brand} team to find out whether the flagship growth marketing cohort is the right fit for your goals.`,
  }),
  '/resources/playbooks': () => ({
    title: 'Growth Playbooks',
    description:
      'Free, step-by-step growth marketing playbooks you can apply today: frameworks, checklists and templates from practitioners.',
  }),
  '/resources/claude-skills': () => ({
    title: 'Claude Skills for Marketers',
    description:
      'Ready-made Claude skills for marketers: reusable AI workflows for research, content, SEO and campaign analysis that you can copy and use.',
  }),
}

/** The paths staticMeta knows about, in table order. */
export const STATIC_PATHS = Object.freeze(Object.keys(STATIC_PAGES))

/** Path without query, hash or trailing slashes; '' becomes '/'. */
function normalisePath(path) {
  const value = collapse(path).split('#')[0].split('?')[0].replace(/\/+$/, '')
  return value || '/'
}

/**
 * @param {string} path e.g. "/about" (a trailing slash is ignored)
 * @param {Site} site
 * @returns {SeoMeta}
 */
export function staticMeta(path, site) {
  const key = normalisePath(path)
  if (!Object.prototype.hasOwnProperty.call(STATIC_PAGES, key)) return noindexMeta(site)
  const entry = STATIC_PAGES[key](collapse(site?.brandName))
  return build({
    site,
    title: entry.title,
    description: entry.description,
    canonical: canonicalUrl(site, key),
    robots: entry.robots || INDEX,
    jsonLd: entry.jsonLd ? entry.jsonLd(site) : [],
  })
}

/**
 * Brand-default title and description, `noindex, nofollow`, no canonical and
 * no JSON-LD. For pages that must not be indexed (unknown paths, private UI).
 * @param {Site} site
 * @returns {SeoMeta}
 */
export function noindexMeta(site) {
  return build({ site, title: '', description: '', canonical: '', robots: NOINDEX })
}

/**
 * Like noindexMeta, titled "Page not found", with `status: 404`.
 * @param {Site} site
 * @returns {SeoMeta}
 */
export function notFoundMeta(site) {
  return build({
    site,
    title: 'Page not found',
    description: '',
    canonical: '',
    robots: NOINDEX,
    status: 404,
  })
}
