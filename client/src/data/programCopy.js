/**
 * The wording the program page shipped with.
 *
 * Every string here used to be inline JSX in ProgramDetail.jsx. It now lives in
 * `Program.sectionCopy` / `Program.ctas` and is edited in admin — this file is
 * only the fallback, so a program created before the fields existed, or one an
 * operator has left blank, still renders the original copy instead of a gap.
 */
export const DEFAULT_SECTION_COPY = {
  outcomes: {
    eyebrow: 'During & after the program',
    heading: 'What you build, learn, and leave with',
    subhead: 'Real campaigns. Real feedback. A portfolio you can defend.',
  },
  comparison: {
    eyebrow: 'Not a certificate factory',
    heading: 'Not another digital marketing course. A build sprint.',
    subhead: 'You show up. You ship. You leave with proof.',
  },
  curriculum: {
    eyebrow: 'Week-by-week',
    heading: 'Curriculum built like a real growth team',
    subhead: 'Validate → Acquire → Convert → Compound.',
  },
  audience: { eyebrow: 'Who it’s for', heading: 'Built for people ready to ship', subhead: '' },
  admission: { eyebrow: 'Selection', heading: 'How admission works', subhead: '' },
  pricing: { eyebrow: 'Investment', heading: '', subhead: '' },
  testimonials: { eyebrow: '', heading: 'Learner stories', subhead: '' },
  faqs: { eyebrow: '', heading: 'Frequently asked questions', subhead: '' },
  cta: {
    eyebrow: '',
    heading: 'Stop watching growth. Start shipping it.',
    subhead: '',
  },
}

/** Button labels, keyed the same way. `to` is the destination. */
export const DEFAULT_CTAS = {
  heroApply: { label: 'Apply Now', to: '/signup' },
  heroCurriculum: { label: 'See Curriculum', to: '#curriculum' },
  pricingApply: { label: 'Apply for Cohort', to: '/signup' },
  pricingTalk: { label: 'Talk to the Team', to: '/?mentor=1' },
  finalApply: { label: 'Apply Now', to: '/signup' },
  finalSecondary: { label: '', to: '' },
}

export const DEFAULT_PHASE_LABELS = ['During the Program', 'After the Program']

/** The section keys an admin can edit, in the order they appear on the page. */
export const SECTION_KEYS = Object.keys(DEFAULT_SECTION_COPY)
export const CTA_KEYS = Object.keys(DEFAULT_CTAS)
