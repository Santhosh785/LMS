/**
 * The Flagship application, transcribed from the 2026 redesign's
 * programs/apply.html.
 *
 * Declared as data rather than JSX because four separate things have to agree
 * about these fields: the step that renders them, the per-step validation, the
 * review summary on step 5, and the draft saved to localStorage. Keeping one
 * list means adding a question cannot leave the review screen out of date.
 *
 * `showWhen` marks a fieldset the drop reveals conditionally; see VISIBILITY.
 */

const opts = (...values) => values.map((v) => (typeof v === 'string' ? { value: v, label: v } : v))

export const STATES = opts(
  'Tamil Nadu',
  'Karnataka',
  'Andhra Pradesh',
  'Telangana',
  'Kerala',
  'Maharashtra',
  'Delhi NCR',
  'Gujarat',
  'West Bengal',
  'Other India',
  'Outside India',
)

/** Which conditional blocks are on screen for a given set of answers. */
export const VISIBILITY = {
  experienced: (v) =>
    Boolean(v.experienceLevel) && !['exploring', 'complete-beginner'].includes(v.experienceLevel),
  beginner: (v) => ['exploring', 'complete-beginner'].includes(v.experienceLevel),
  scholarship: (v) => v.paymentPlan === 'scholarship',
}

export const APPLY_STEPS = [
  {
    key: 'about',
    nav: 'About you',
    title: 'About you',
    intro:
      'Contact details and how you’d like to learn. We use WhatsApp for cohort updates — keep your number active.',
    fieldsets: [
      {
        legend: 'Contact',
        fields: [
          { name: 'fullName', label: 'Full name', type: 'text', required: true, placeholder: 'As on certificate', autoComplete: 'name' },
          { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@email.com', autoComplete: 'email' },
          { name: 'phone', label: 'Phone / WhatsApp', type: 'tel', required: true, placeholder: '+91 …', hint: 'Primary number for fit call & cohort', autoComplete: 'tel', minLength: 10 },
          { name: 'linkedin', label: 'LinkedIn or portfolio URL', type: 'url', placeholder: 'https://linkedin.com/in/…' },
          { name: 'city', label: 'City', type: 'text', required: true, autoComplete: 'address-level2' },
          { name: 'state', label: 'State', type: 'select', required: true, placeholder: 'Select state', options: STATES },
        ],
      },
      {
        legend: 'Program preferences',
        fields: [
          {
            name: 'trackPreference',
            label: 'Track preference',
            type: 'select',
            required: true,
            options: opts(
              { value: 'track-a', label: 'Track A — Business owner (12 weeks · 78 hrs)' },
              { value: 'track-b', label: 'Track B — Fresher / freelancer (14 weeks · 92 hrs)' },
              { value: 'undecided', label: 'Not sure yet — discuss on fit call' },
            ),
          },
          {
            name: 'batchPreference',
            label: 'Batch preference',
            type: 'select',
            required: true,
            options: opts(
              { value: 'batch-4', label: 'Batch 4 (next cohort — 10 seats per batch)' },
              { value: 'batch-5-waitlist', label: 'Batch 5 waitlist if Batch 4 fills' },
              { value: 'flexible', label: 'Flexible — earliest with mentor fit' },
            ),
          },
          {
            name: 'mentoringLanguage',
            label: 'Mentoring language',
            type: 'select',
            required: true,
            options: opts({ value: 'tamil', label: 'Tamil (tool UI may use English labels)' }),
          },
          {
            name: 'currentStatus',
            label: 'Current status',
            type: 'select',
            required: true,
            span: 2,
            options: opts(
              'Student (full-time)',
              'Working professional (full-time job)',
              'Freelancer / consultant',
              'Founder / business owner',
              'Career break / job seeking',
              'Other',
            ),
          },
          { name: 'employer', label: 'Company / brand you work on (optional)', type: 'text', span: 2, placeholder: 'e.g. D2C brand, agency, own startup' },
        ],
      },
    ],
  },

  {
    key: 'readiness',
    nav: 'Readiness',
    title: 'Readiness & logistics',
    intro:
      'Flagship is LIVE with ~10–12 hours per week, offline masterclass meetups, and weekly ship sprints. We admit only learners who can commit.',
    fieldsets: [
      {
        legend: 'Weekly commitment',
        full: true,
        fields: [
          {
            name: 'weeklyHours',
            label: 'Realistic hours per week for live + builds',
            type: 'select',
            required: true,
            span: 2,
            options: opts(
              { value: '8-10', label: '8–10 hours' },
              { value: '10-12', label: '10–12 hours (recommended)' },
              { value: '12-15', label: '12–15 hours' },
              { value: 'under-8', label: 'Under 8 — may not be ready yet' },
            ),
          },
          {
            name: 'liveAvailability',
            label: 'Live session availability (IST)',
            type: 'checkboxes',
            requireOne: true,
            span: 2,
            options: opts(
              { value: 'weekday-evening', label: 'Weekday evenings (7–10 PM)' },
              { value: 'weekend', label: 'Weekends' },
              { value: 'weekday-afternoon', label: 'Weekday afternoons' },
              { value: 'flexible-recordings', label: 'Can catch up via recordings if needed' },
            ),
          },
        ],
      },
      {
        legend: 'Setup & masterclass',
        full: true,
        fields: [
          {
            name: 'hasSetup',
            label: 'Do you have a laptop + stable internet for Meta/Google/Analytics work?',
            type: 'radio',
            required: true,
            options: opts(
              { value: 'yes', label: 'Yes, reliable setup' },
              { value: 'partial', label: 'Partial — may need support' },
              { value: 'no', label: 'Not yet' },
            ),
          },
          {
            name: 'masterclassCity',
            label: 'Offline masterclass — nearest city you can travel to',
            type: 'select',
            required: true,
            options: opts(
              'Chennai',
              'Coimbatore',
              'Bengaluru',
              'Hyderabad',
              'Mumbai',
              'Other — willing to travel within state',
              'Cannot travel — online-only exception needed',
            ),
          },
          {
            name: 'scheduleBlockers',
            label: 'Anything that blocks you for 12 weeks? (travel, exams, wedding, etc.)',
            type: 'textarea',
            rows: 3,
            span: 2,
            placeholder: 'Be honest — we’d rather waitlist you than set you up to fail.',
          },
        ],
      },
    ],
  },

  {
    key: 'background',
    nav: 'Background',
    title: 'Growth background',
    intro:
      'We score readiness and baseline — not perfection. Beginners with strong motivation are welcome; experienced marketers should show what they’ve shipped.',
    fieldsets: [
      {
        legend: 'Experience level',
        full: true,
        fields: [
          {
            name: 'experienceLevel',
            type: 'select',
            required: true,
            span: 2,
            placeholder: 'Select closest match',
            options: opts(
              { value: 'exploring', label: 'Exploring marketing — no campaigns yet' },
              { value: 'complete-beginner', label: 'Beginner — consumed content, little execution' },
              { value: 'some-campaigns', label: 'Run some campaigns (₹5k–50k spend or organic projects)' },
              { value: 'working-marketer', label: 'Working marketer / agency (6+ months)' },
              { value: 'founder-operator', label: 'Founder / operator owning growth' },
            ),
          },
        ],
      },
      {
        legend: 'Channels you’ve touched',
        full: true,
        fields: [
          {
            name: 'channels',
            type: 'checkboxes',
            span: 2,
            options: opts(
              { value: 'seo', label: 'SEO / content' },
              { value: 'meta', label: 'Meta ads' },
              { value: 'google', label: 'Google Ads' },
              { value: 'email', label: 'Email / WhatsApp' },
              { value: 'funnels', label: 'Landing pages / funnels' },
              { value: 'analytics', label: 'Analytics / GA4' },
              { value: 'affiliate', label: 'Affiliate / partnerships' },
              { value: 'none', label: 'None yet' },
            ),
          },
        ],
      },
      {
        legend: 'For experienced applicants',
        full: true,
        showWhen: 'experienced',
        fields: [
          {
            name: 'monthlySpend',
            label: 'Largest monthly ad spend you’ve managed (approx.)',
            type: 'select',
            options: opts('Under ₹25k', '₹25k – ₹1L', '₹1L – ₹5L', '₹5L+'),
          },
          { name: 'toolsUsed', label: 'Tools you use regularly', type: 'text', placeholder: 'Meta Ads, Google Ads, Ahrefs, …' },
          { name: 'portfolioUrl', label: 'Best proof of work (URL)', type: 'url', span: 2, placeholder: 'Case study, Notion doc, live site, deck…' },
        ],
      },
      {
        legend: 'For beginners',
        full: true,
        showWhen: 'beginner',
        fields: [
          { name: 'starterCourses', label: 'Growth Scholar courses or workshops completed (if any)', type: 'text', span: 2, placeholder: 'e.g. SEO Mastery self-paced, free workshop…' },
        ],
      },
    ],
  },

  {
    key: 'goals',
    nav: 'Goals & fit',
    title: 'Goals, motivation & fit',
    intro:
      'Specific answers beat generic passion. We read every response — this is how we choose 10 learners per batch.',
    fieldsets: [
      {
        legend: 'Discovery',
        full: true,
        fields: [
          {
            name: 'referralSource',
            label: 'How did you find Growth Scholar Flagship?',
            type: 'select',
            required: true,
            options: opts(
              'Instagram / YouTube',
              'LinkedIn',
              'Friend / alumni referral',
              'Workshop attendee',
              'Self-paced course first',
              'Google search',
              'Other',
            ),
          },
          { name: 'referralDetail', label: 'Name the video, post, or person (be specific)', type: 'text', required: true, placeholder: 'Shows you researched us' },
        ],
      },
      {
        legend: 'Short essays',
        full: true,
        fields: [
          { name: 'whyFlagship', label: 'Why Flagship LIVE now — not self-paced or another course?', type: 'textarea', required: true, maxWords: 200, placeholder: 'What changed that makes 12 weeks of shipping worth it?' },
          { name: 'twelveWeekOutcome', label: 'What must be true in 12 weeks for you to call this a success?', type: 'textarea', required: true, maxWords: 120, placeholder: 'Job, clients, revenue, portfolio — be measurable where possible.' },
          { name: 'shipStory', label: 'Describe one growth/marketing thing you tried — win or failure', type: 'textarea', required: true, maxWords: 250, placeholder: 'What did you do, what happened, what did you learn?' },
          { name: 'curriculumHook', label: 'Which part of the curriculum will you lean on first? (SEO, Meta, Google, funnels, Demo Day…)', type: 'textarea', required: true, maxWords: 80, placeholder: 'Reference something from the program page — not generic interest.' },
        ],
      },
      {
        legend: 'Investment',
        full: true,
        fields: [
          {
            name: 'paymentPlan',
            label: 'Payment plan if accepted (₹79,999 · scholarships up to ₹10,000)',
            type: 'radio',
            required: true,
            span: 2,
            options: opts(
              { value: 'full', label: 'Pay in full' },
              { value: 'scholarship', label: 'Request scholarship (merit + need)' },
            ),
          },
        ],
      },
      {
        legend: 'Scholarship',
        full: true,
        showWhen: 'scholarship',
        fields: [
          { name: 'scholarshipCase', label: 'Scholarship case — why you, why now? (merit, need, impact)', type: 'textarea', required: true, maxWords: 200, span: 2 },
        ],
      },
      {
        legend: 'Verification',
        full: true,
        fields: [
          {
            name: 'batchGotcha',
            label: 'Type the batch you are applying for (anti-spam)',
            type: 'text',
            required: true,
            span: 2,
            placeholder: 'Batch 4',
            // Mirrors the drop's pattern; the server checks the same shape.
            pattern: /^(batch\s*)?4$/i,
            patternMessage: 'Enter Batch 4',
          },
          { name: 'consentWhatsapp', type: 'consent', required: true, span: 2, label: 'I agree to be contacted on WhatsApp/email about my application and cohort updates.' },
          { name: 'consentAccurate', type: 'consent', required: true, span: 2, label: 'I confirm this information is accurate to the best of my knowledge.' },
        ],
      },
    ],
  },

  {
    key: 'review',
    nav: 'Review & send',
    title: 'Review & submit',
    intro:
      'Check your summary. After submit, our team reviews within ~7 days and schedules your 15-min fit call if you’re shortlisted.',
    review: true,
    fieldsets: [],
  },
]

/** Every field on a step that is currently on screen, conditionals resolved. */
export function visibleFields(step, values) {
  return step.fieldsets
    .filter((fs) => !fs.showWhen || VISIBILITY[fs.showWhen](values))
    .flatMap((fs) => fs.fields)
}

export const countWords = (s) =>
  String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
