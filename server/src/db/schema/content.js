import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, legacyId, timestamps } from './_common.js'

/* --------------------------------- blog ---------------------------------- */

export const BLOCK_TYPES = [
  'p',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'quote',
  'callout',
  'image',
  'code',
  'separator',
  'button',
  'embed',
  'table',
]

export const BLOG_STATUSES = ['Draft', 'Pending', 'Published', 'Scheduled', 'Archived', 'Trash']

export const media = pgTable(
  'media',
  {
    id: id(),
    legacyId: legacyId(),
    url: text().notNull().unique(),
    filename: text().notNull(),
    originalName: text().notNull(),
    mimeType: text().notNull(),
    size: integer().notNull(),
    title: text().notNull().default(''),
    altText: text().notNull().default(''),
    caption: text().notNull().default(''),
    description: text().notNull().default(''),
    uploadedBy: text().notNull().default('Admin'),
    storage: text({ enum: ['local', 'bunny'] })
      .notNull()
      .default('local'),
    path: text().notNull().default(''),
    width: integer().notNull().default(0),
    height: integer().notNull().default(0),
    sizes: jsonb().notNull().default([]),
    ...timestamps,
  },
  (t) => [index().on(t.mimeType), index().on(t.storage), index().on(t.createdAt.desc())],
)

/**
 * The block body, SEO panel and revision history are jsonb. They are the
 * editor's document, read and written whole; nothing reports across them, and
 * modelling a block tree as tables would turn every save into dozens of writes.
 * Media references inside the body are therefore not foreign keys — the media
 * library already tolerates a block pointing at a deleted image.
 */
export const blogPosts = pgTable(
  'blog_posts',
  {
    id: id(),
    legacyId: legacyId(),
    title: text().notNull(),
    slug: text().notNull().unique(),
    category: text(),
    categories: text().array().notNull().default([]),
    tags: text().array().notNull().default([]),
    excerpt: text(),
    body: jsonb().notNull().default([]),
    author: jsonb(),
    publishedAt: timestamp({ withTimezone: true }).defaultNow(),
    readTime: text(),
    status: text({ enum: BLOG_STATUSES }).notNull().default('Draft'),
    trashedAt: timestamp({ withTimezone: true }),
    statusBeforeTrash: text(),
    visibility: text({ enum: ['Public', 'Private', 'Password'] })
      .notNull()
      .default('Public'),
    password: text(),
    featured: boolean().notNull().default(false),
    sticky: boolean().notNull().default(false),
    allowComments: boolean().notNull().default(false),
    image: text(),
    imageAlt: text(),
    imageMediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
    imageWidth: integer(),
    imageHeight: integer(),
    heroClass: text().default('feat-seo'),
    heroLabel: text(),
    seo: jsonb().notNull().default({}),
    revisions: jsonb().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    index().on(t.category),
    index().on(t.featured),
    index().on(t.status, t.publishedAt.desc()),
    index().using('gin', t.categories),
    index().using('gin', t.tags),
  ],
)

export const blogComments = pgTable(
  'blog_comments',
  {
    id: id(),
    legacyId: legacyId(),
    postId: uuid()
      .notNull()
      .references(() => blogPosts.id, { onDelete: 'cascade' }),
    parentId: uuid(),
    name: text().notNull(),
    email: text().notNull(),
    website: text().notNull().default(''),
    body: text().notNull(),
    status: text({ enum: ['Pending', 'Approved', 'Spam', 'Trash'] })
      .notNull()
      .default('Pending'),
    statusBeforeTrash: text(),
    byAdmin: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index().on(t.parentId),
    index().on(t.postId, t.status, t.createdAt.desc()),
    index().on(t.status, t.createdAt.desc()),
  ],
)

/* ------------------------------- taxonomy -------------------------------- */

export const TAXONOMIES = ['category', 'tag', 'topic', 'language', 'blog-category', 'workshop-city']

export const terms = pgTable(
  'terms',
  {
    id: id(),
    legacyId: legacyId(),
    taxonomy: text({ enum: TAXONOMIES }).notNull(),
    name: text().notNull(),
    shortLabel: text(),
    slug: text().notNull(),
    description: text(),
    parent: uuid(),
    icon: text(),
    color: text(),
    thumbClass: text(),
    order: integer().notNull().default(0),
    showInMenu: boolean().notNull().default(false),
    showInFilters: boolean().notNull().default(true),
    showOnCards: boolean().notNull().default(true),
    featured: boolean().notNull().default(false),
    showAsRail: boolean().notNull().default(false),
    linkTo: text(),
    status: text({ enum: ['Published', 'Draft', 'Archived'] })
      .notNull()
      .default('Published'),
    visibility: text({ enum: ['Public', 'Hidden'] })
      .notNull()
      .default('Public'),
    seo: jsonb().notNull().default({}),
    formerSlugs: text().array().notNull().default([]),
    ...timestamps,
  },
  (t) => [
    unique().on(t.taxonomy, t.slug),
    index().on(t.taxonomy, t.order, t.name),
    index().on(t.parent),
    index().on(t.featured),
    index().on(t.showAsRail),
    index().on(t.status),
    index().using('gin', t.formerSlugs),
  ],
)

/* ------------------------------- resources ------------------------------- */

export const playbooks = pgTable(
  'playbooks',
  {
    id: id(),
    legacyId: legacyId(),
    title: text().notNull(),
    slug: text().notNull().unique(),
    cardTitle: text(),
    tag: text(),
    deck: text(),
    summary: text(),
    visualClass: text().default('pb-v-seo'),
    heroClass: text().default('pb-hero-seo'),
    authorName: text(),
    authorRole: text(),
    initials: text(),
    achievement: jsonb(),
    sections: jsonb().notNull().default([]),
    tools: text(),
    relatedSkill: jsonb(),
    cta: jsonb(),
    order: integer().notNull().default(0),
    status: text({ enum: ['Published', 'Draft'] })
      .notNull()
      .default('Published'),
    ...timestamps,
  },
  (t) => [index().on(t.tag), index().on(t.status)],
)

export const claudeSkills = pgTable(
  'claude_skills',
  {
    id: id(),
    legacyId: legacyId(),
    title: text().notNull(),
    slug: text().notNull().unique(),
    cardTitle: text(),
    tagline: text(),
    summary: text(),
    about: text(),
    category: text(),
    badge: text(),
    icon: text().notNull().default('✦'),
    features: jsonb().notNull().default([]),
    worksWith: text().notNull().default('Claude'),
    readiness: text().notNull().default('Ready'),
    order: integer().notNull().default(0),
    status: text({ enum: ['Published', 'Draft'] })
      .notNull()
      .default('Published'),
    ...timestamps,
  },
  (t) => [index().on(t.category), index().on(t.status)],
)

/**
 * Programs are long-form landing pages. Everything below the identifying
 * columns is presentation copy rendered whole, so it is one jsonb per section
 * of the page rather than a table per repeated block.
 */
export const programs = pgTable(
  'programs',
  {
    id: id(),
    legacyId: legacyId(),
    title: text().notNull(),
    slug: text().notNull().unique(),
    eyebrow: text(),
    description: text(),
    categories: text().array().notNull().default([]),
    tags: text().array().notNull().default([]),
    weeks: integer().notNull().default(12),
    meta: text().array().notNull().default([]),
    heroImage: text(),
    outcomes: jsonb().notNull().default([]),
    stats: jsonb().notNull().default([]),
    comparison: jsonb(),
    curriculum: jsonb().notNull().default([]),
    audience: jsonb().notNull().default([]),
    batchNote: text(),
    trustBar: jsonb().notNull().default([]),
    why: jsonb(),
    structure: jsonb(),
    tracks: jsonb().notNull().default([]),
    toolGroups: jsonb().notNull().default([]),
    admission: jsonb().notNull().default([]),
    mentors: jsonb().notNull().default([]),
    testimonials: jsonb().notNull().default([]),
    faqs: jsonb().notNull().default([]),
    sectionCopy: jsonb().notNull().default([]),
    ctas: jsonb().notNull().default([]),
    phaseLabels: text().array().notNull().default([]),
    pricing: jsonb(),
    ...timestamps,
  },
  (t) => [index().using('gin', t.categories), index().using('gin', t.tags)],
)
