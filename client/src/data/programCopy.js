/**
 * The wording the program page ships with.
 *
 * Every string here used to be inline JSX in ProgramDetail.jsx. It now lives in
 * `Program.sectionCopy` / `Program.ctas` and is edited in admin — this file is
 * only the fallback, so a program created before the fields existed, or one an
 * operator has left blank, still renders sensible copy instead of a gap.
 *
 * Updated for the 2026 redesign: the page is now hero → why → who → structure →
 * playbook → Common Core → tracks → tools → admission → pricing → FAQ → CTA.
 */
export const DEFAULT_SECTION_COPY = {
  hero: { eyebrow: '', heading: 'Flagship LIVE Cohort', subhead: '' },
  why: { eyebrow: '', heading: 'The Why behind the program', subhead: '' },
  audience: { eyebrow: '', heading: 'Who is this programme for?', subhead: '' },
  structure: {
    eyebrow: 'How the cohort works',
    heading: 'Same Common Core first — then your track',
    subhead: '',
  },
  comparison: {
    eyebrow: 'Not “digital marketing + one AI slide”',
    heading: 'The 2026 playbook — built live on real data',
    subhead: '',
  },
  curriculum: {
    eyebrow: 'Weeks 1–6 · Common Core',
    heading: 'AI-native fundamentals every graduate shares',
    subhead: '',
  },
  tracks: { eyebrow: 'After Week 6', heading: 'Choose your track', subhead: '' },
  tools: {
    eyebrow: 'Stack you’ll touch',
    heading: 'Recommended tools (taught in context)',
    subhead: '',
  },
  admission: { eyebrow: 'Selection', heading: 'How admission works', subhead: '' },
  pricing: { eyebrow: '', heading: 'What your fee is actually funding', subhead: '' },
  faqs: { eyebrow: 'FAQ', heading: 'Frequently asked questions', subhead: '' },
  cta: {
    eyebrow: 'Growth Scholar',
    heading: 'Stop watching growth. Start shipping it.',
    subhead: '',
  },
}

/** Button labels, keyed the same way. `to` is the destination. */
export const DEFAULT_CTAS = {
  heroApply: { label: 'Apply for this batch', to: '/programs/apply' },
  heroPricing: { label: 'See pricing', to: '#apply' },
  pricingApply: { label: 'Apply for this batch', to: '/programs/apply' },
  pricingFitCall: { label: 'Book fit call', to: '/programs/fit-call' },
  finalApply: { label: 'Apply for this batch', to: '/programs/apply' },
  finalSecondary: { label: '', to: '' },
  stickyApply: { label: 'Apply now', to: '/programs/apply' },
}

export const DEFAULT_PHASE_LABELS = ['During the Program', 'After the Program']

/** The section keys an admin can edit, in the order they appear on the page. */
export const SECTION_KEYS = Object.keys(DEFAULT_SECTION_COPY)
export const CTA_KEYS = Object.keys(DEFAULT_CTAS)
