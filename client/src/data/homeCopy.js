/**
 * Homepage furniture, transcribed from the 2026 redesign's index.html.
 *
 * Only the marketing copy lives here. The course and workshop grids are filled
 * from the catalogue API at runtime — the static build hard-coded six of each,
 * which would have meant the front page advertising courses that were unpublished,
 * renamed or deleted. Everything that is genuinely editorial is here so it can be
 * changed without touching Home.jsx.
 */

export const hero = {
  badge: 'Growth Scholar · Live implementation',
  titleLines: ['The growth marketing programme', 'where you build real campaigns & funnels'],
  lede: 'Close the gap between knowing marketing and growing a business — ship campaigns, funnels, and measurement that move leads, revenue, and confidence, not just watchlists and certificates.',
  languages: [
    { label: 'த Tamil', muted: false },
    { label: 'Launching now · more languages later', muted: true },
  ],
  note: 'Pick any course in the library · Flagship: 10 seats per batch · 2–3 months',
}

/** The .lm-product tab strip under the hero. `visual` is the gradient class. */
export const productTabs = [
  {
    id: 'selfpaced',
    tab: 'Self-paced library',
    chrome: 'Growth Scholar · Courses',
    title: 'Go to the section. Pick your course.',
    body: 'Foundation courses set the base in your language. Gap courses close what generic trainings miss — new SEO, ads, funnel, and analytics moves you can use this quarter.',
    chips: ['Foundation', 'Gap / updated', 'Native language'],
    link: { label: 'Open course library →', to: '/courses/category' },
    visualLabel: 'Self-paced course library',
  },
  {
    id: 'foundation',
    tab: 'Foundation courses',
    chrome: 'Foundation track',
    title: 'Strong base, native language',
    body: 'For learners who want clarity on core marketing — without ₹40K “what is what” modules. Self-paced, learn on your schedule.',
    link: { label: 'Browse courses →', to: '/courses' },
    visualLabel: 'Foundation courses',
  },
  {
    id: 'gap',
    tab: 'Gap courses',
    chrome: 'Gap courses',
    title: 'Updated strategies, not recycled slides',
    body: 'Short, focused self-paced courses on what changed — Advantage+ workflows, search intent maps, offer funnels, measurement that founders actually use.',
    link: { label: 'Explore gap courses →', to: '/courses/category' },
    visualLabel: 'Gap courses',
  },
  {
    id: 'flagship',
    tab: 'Flagship LIVE',
    chrome: 'Complete Growth Marketing · LIVE',
    title: '100% LIVE · You implement in session',
    body: 'Only 10 learners per batch. Plan for 2–3 months of builds, reviews, and offline masterclass meetups — sharing knowledge in person.',
    link: { label: 'View Flagship Program →', to: '/programs/complete-growth-marketing' },
    visualLabel: 'Flagship LIVE program',
  },
  {
    id: 'workshops',
    tab: 'Workshops',
    chrome: 'Workshops',
    title: 'Live labs before you commit to Flagship',
    body: 'SEO, Meta, Google Ads, and copy sprints — live in Tamil, plus offline city sessions. Register and show up ready to execute.',
    link: { label: 'See all workshops →', to: '/workshops' },
    visualLabel: 'Live workshops',
  },
]

export const audienceLinks = [
  { label: 'Freelancers', to: '/courses/category' },
  { label: 'Professionals', to: '/courses/category' },
  { label: 'Business owners', to: '/courses/category' },
  { label: 'Self-paced learners', to: '/#self-paced' },
  { label: 'Ready for LIVE implementation', to: '/#flagship' },
]

export const nativeBand = {
  eyebrow: 'Launch language',
  heading: 'Tamil-first growth marketing — depth without English-only friction',
  body: 'We’re launching in த Tamil first: foundation, gap courses, workshops, and Flagship LIVE. More languages will follow as cohorts scale.',
  card: {
    icon: 'த',
    title: 'Tamil',
    body: 'Foundation, gap courses, live workshops & Flagship — available now',
  },
}

export const flagship = {
  eyebrow: 'Flagship program',
  heading: 'Complete Growth Marketing — fully LIVE, built to implement',
  body: 'This is not another video library. You join live sessions, ship campaigns and assets in real time, and leave with work you can show clients or your boss — in a focused batch of ten with real mentor review.',
  badges: ['100% LIVE', '10 seats / batch', '2–3 months', 'Offline masterclass'],
  cards: [
    {
      title: 'Implement in every session',
      body: 'SEO, ads, funnels, and offers — you build on your business (or a practice brand) while mentors watch and correct.',
    },
    {
      title: 'Only 10 seats per batch',
      body: 'Small enough for honest feedback, deep doubt clearance, and accountability — not a 200-person webinar.',
    },
    {
      title: '2–3 month commitment',
      body: 'Enough runway to launch, measure, and iterate — the way real growth work happens, not a weekend certificate.',
    },
    {
      title: 'Offline masterclass',
      body: 'Meet in person, share campaigns and mistakes openly, and learn from peers in your city cohort.',
    },
    {
      title: 'Updated strategies',
      body: 'Playbooks for today’s Meta, Google, SEO, and funnels — the gap generic institute courses never cover.',
    },
    {
      title: 'From self-paced to operator',
      body: 'Many learners start with gap courses, then join Flagship when they’re ready to go all-in on execution.',
    },
  ],
}

export const journey = {
  heading: 'The journey: your 2–3 month Flagship path',
  body: 'Four phases from audit to in-person masterclass — for learners who already know the basics and want to ship.',
  steps: [
    {
      title: 'Diagnose',
      phase: 'Weeks 1–2',
      body: 'Audit your marketing, pick one growth bet, and set baselines — offers, channels, and numbers you’ll improve.',
    },
    {
      title: 'Build LIVE',
      phase: 'Weeks 3–6',
      body: 'LIVE implementation sprints: landing pages, ad sets, SEO fixes, and funnel steps — shipped in session, not homework alone.',
    },
    {
      title: 'Run & iterate',
      phase: 'Weeks 7–10',
      body: 'Launch campaigns, read data, and apply updated strategies with mentor reviews until results move.',
    },
    {
      title: 'Masterclass & scale',
      phase: 'Weeks 11–12+',
      body: 'Offline masterclass — share wins, fix blind spots in person, and leave with a 90-day scale plan.',
    },
  ],
}

export const selfPacedHead = {
  eyebrow: 'Self-paced library',
  heading: 'Foundation & gap courses — pick what you need',
  body: 'Enter the library, choose your track, and learn in Tamil. Gap courses focus on updated strategies after the basics.',
}

export const workshopsHead = {
  heading: 'Upcoming workshops',
  body: 'Live online and offline sessions — register, show up, and practice updated tactics before or alongside Flagship.',
}

export const proofHeading = 'Built for learners who’ve outgrown “intro” courses'

/**
 * Each figure is a claim made to a buyer, so each has to be true. "1,000+
 * learners since 2021" is the owner's own copy, repeated on the About page; the
 * other three restate Flagship's published terms. Nothing here is derived from
 * data the app holds, which is why it is copy and not a computed stat.
 */
export const proof = [
  { value: '1,000+', label: 'Learners since 2021' },
  { value: '10', label: 'Seats per Flagship batch' },
  { value: '2–3 mo', label: 'Flagship duration' },
  { value: 'Gap-first', label: 'Updated self-paced tracks' },
]

export const reviews = [
  {
    title: '“Finally past beginner content”',
    body: 'I’d done two digital marketing courses already. Growth Scholar’s gap track in Tamil was the first time someone taught what changed on Meta this year.',
    author: 'Sowndarya · Chidambaram',
  },
  {
    title: '“LIVE batch of ten still feels real”',
    body: 'Not a webinar — we actually built campaigns live. Small enough for mentor review, big enough for peers. Offline masterclass helped me fix blind spots.',
    author: 'A. Thiyagarajan · Dindigul',
  },
  {
    title: '“Self-paced, then Flagship”',
    body: 'Started with foundation courses in Tamil, joined Flagship when I was ready to implement for my clients.',
    author: 'Anishmon A · Kanyakumari',
  },
]

export const resourceTeasers = [
  {
    icon: '📘',
    title: 'Playbooks',
    body: 'Step-by-step growth workflows from mentors and Flagship cohorts.',
    link: 'Explore playbooks →',
    to: '/resources/playbooks',
  },
  {
    icon: '✦',
    title: 'Claude Skills',
    body: 'Reusable AI skills for SEO, ads, copy, and analytics.',
    link: 'Browse skills →',
    to: '/resources/claude-skills',
    id: 'claude-skills',
  },
  {
    icon: '✎',
    title: 'Blog',
    body: 'Marketing insights, AI, and career guides — WebFX-style hub.',
    link: 'Read the blog →',
    to: '/blog',
  },
]

export const finalCta = {
  heading: 'Pick a self-paced course — or apply for Flagship LIVE.',
  body: 'Foundation & gap courses in the library · Workshops when you want live practice · 10 seats per Flagship batch.',
}
