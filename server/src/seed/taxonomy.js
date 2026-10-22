import { BlogPost, Course, Program, Workshop } from '../models/index.js'
import Term from '../models/Term.js'
import { slugify, uniqueSlug } from '../services/taxonomy.js'
import { log } from './guard.js'

/**
 * Backfills the Term registry from the classification already in the database.
 *
 * Before the registry existed, a course's topic and a post's category were
 * unvalidated free text, and the filter sidebar was a hardcoded array in the
 * client. This turns both into editable records without changing what a visitor
 * sees: the presets below reproduce the old hardcoded order exactly, and any
 * value found in the database that the presets do not mention is appended
 * rather than dropped.
 *
 * Idempotent, and deletes nothing — a term an operator has since renamed,
 * hidden or reordered is left alone on a re-run.
 */

/**
 * The order the client used to hardcode, preserved so the sidebar, the blog
 * rail and the workshop groupings render identically after the migration.
 *
 * `menu: true` marks the terms that were also header dropdown entries.
 */
const PRESETS = {
  /*
   * `featured` puts a topic in the homepage career banner, and `short` is the
   * abbreviation that banner uses — both were hardcoded in Home.jsx, including
   * a `pill === 'Social Advertising' ? 'Social Ads'` ladder that a rename would
   * have silently outlived.
   */
  topic: [
    { name: 'SEO', menu: true, featured: true },
    { name: 'Copywriting', menu: true, featured: true },
    { name: 'Social Advertising', menu: true, featured: true, short: 'Social Ads' },
    { name: 'PPC', menu: true, featured: true },
    { name: 'Affiliate Marketing', menu: true, featured: true, short: 'Affiliate' },
    { name: 'Funnel', menu: true, featured: true },
    { name: 'Email', menu: true },
    { name: 'Analytics', menu: true },
  ],
  language: [{ name: 'Tamil' }, { name: 'English' }, { name: 'Hindi' }],
  'blog-category': [
    { name: 'SEO' },
    { name: 'Paid Media' },
    { name: 'Copywriting' },
    { name: 'Funnels' },
    { name: 'Affiliate' },
    { name: 'Career' },
    { name: 'Growth Strategy' },
  ],
  'workshop-city': [{ name: 'Chennai' }, { name: 'Bangalore' }],
  category: [],
  /*
   * The homepage's three "New and popular" rails, which used to be hardcoded
   * lists of course slugs in Home.jsx. Seeding them as tags reproduces that
   * strip exactly while making it editable: `members` is applied only when the
   * tag is first created, so re-running the seed never re-tags a course an
   * operator has since moved.
   */
  tag: [
    {
      name: 'Most popular',
      rail: true,
      linkTo: '/courses',
      members: { courses: ['seo-mastery', 'meta-ads-foundations', 'copywriting-sprint'] },
    },
    {
      name: 'Hot new releases',
      rail: true,
      linkTo: '/courses?sort=newest',
      members: {
        courses: ['funnel-building-lab', 'ppc-essentials', 'affiliate-marketing-lab'],
      },
    },
    {
      name: 'Flagship program',
      rail: true,
      linkTo: '/programs/complete-growth-marketing',
      members: {
        programs: ['complete-growth-marketing'],
        courses: ['social-advertising', 'digital-marketing-starter'],
      },
    },
  ],
}

/** Tags the seed members of a freshly created rail. Never touches an existing tag. */
async function applyMembers(entry) {
  if (!entry.members) return
  const { courses = [], programs = [] } = entry.members
  if (courses.length) {
    await Course.updateMany({ slug: { $in: courses } }, { $addToSet: { tags: entry.name } })
  }
  if (programs.length) {
    await Program.updateMany({ slug: { $in: programs } }, { $addToSet: { tags: entry.name } })
  }
}

/** Distinct values actually present in the content, so nothing is orphaned. */
async function observedValues() {
  const [topics, courseLangs, blogCategories, workshopLangs, venues] = await Promise.all([
    Course.distinct('topic'),
    Course.distinct('languages'),
    BlogPost.distinct('category'),
    Workshop.distinct('language'),
    Workshop.distinct('venue'),
  ])
  return {
    topic: topics,
    language: [...courseLangs, ...workshopLangs],
    'blog-category': blogCategories,
    'workshop-city': venues,
  }
}

export async function seedTaxonomy() {
  const observed = await observedValues()
  let created = 0
  let skipped = 0

  for (const [taxonomy, presets] of Object.entries(PRESETS)) {
    // Presets first so they keep their intended order, then anything else the
    // content actually uses, appended in the order it was found.
    const presetNames = presets.map((p) => p.name)
    const extras = (observed[taxonomy] || [])
      .filter(Boolean)
      .map((v) => String(v).trim())
      .filter((v) => v && !presetNames.includes(v))

    const wanted = [...presets, ...[...new Set(extras)].map((name) => ({ name }))]

    for (const [index, entry] of wanted.entries()) {
      // Match on slug rather than name so a term the operator has renamed is
      // recognised as already-seeded instead of being recreated.
      const existing = await Term.findOne({ taxonomy, slug: slugify(entry.name) })
      if (existing) {
        skipped += 1
        continue
      }
      await Term.create({
        taxonomy,
        name: entry.name,
        slug: await uniqueSlug(taxonomy, entry.name),
        order: index,
        shortLabel: entry.short || '',
        showInMenu: Boolean(entry.menu),
        showInFilters: true,
        showOnCards: true,
        featured: Boolean(entry.featured),
        showAsRail: Boolean(entry.rail),
        linkTo: entry.linkTo,
        status: 'Published',
        visibility: 'Public',
      })
      await applyMembers(entry)
      created += 1
    }
  }

  log(`taxonomy: ${created} terms created, ${skipped} already present`)
  return { created, skipped }
}
