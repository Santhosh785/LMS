/** Transcribed from programs/complete-growth-marketing.html */
export const programs = [
  {
    title: 'Complete Growth Marketing Course',
    slug: 'complete-growth-marketing',
    eyebrow: 'Flagship Program',
    /*
     * The page's own headings and button labels, which used to be inline JSX in
     * ProgramDetail.jsx. Seeded with exactly the wording that shipped, so the
     * page is unchanged — but every line is now editable under Admin →
     * Programs → Page copy.
     */
    sectionCopy: [
      {
        key: 'outcomes',
        eyebrow: 'During & after the program',
        heading: 'What you build, learn, and leave with',
        subhead: 'Real campaigns. Real feedback. A portfolio you can defend.',
      },
      {
        key: 'comparison',
        eyebrow: 'Not a certificate factory',
        heading: 'Not another digital marketing course. A build sprint.',
        subhead: 'You show up. You ship. You leave with proof.',
      },
      {
        key: 'curriculum',
        eyebrow: 'Week-by-week',
        heading: 'Curriculum built like a real growth team',
        subhead: 'Validate → Acquire → Convert → Compound.',
      },
      { key: 'audience', eyebrow: 'Who it’s for', heading: 'Built for people ready to ship' },
      { key: 'admission', eyebrow: 'Selection', heading: 'How admission works' },
      { key: 'pricing', eyebrow: 'Investment' },
      { key: 'testimonials', heading: 'Learner stories' },
      { key: 'faqs', heading: 'Frequently asked questions' },
      {
        key: 'cta',
        heading: 'Stop watching growth. Start shipping it.',
        subhead: '12 weeks. Real campaigns. One portfolio that proves you can grow.',
      },
    ],
    ctas: [
      { key: 'heroApply', label: 'Apply Now', to: '/signup' },
      { key: 'heroCurriculum', label: 'See Curriculum', to: '#curriculum' },
      { key: 'pricingApply', label: 'Apply for Cohort', to: '/signup' },
      { key: 'pricingTalk', label: 'Talk to the Team', to: '/?mentor=1' },
      { key: 'finalApply', label: 'Apply Now', to: '/signup' },
      { key: 'finalSecondary', label: 'Or start with SEO Mastery', to: '/courses/seo-mastery' },
    ],
    phaseLabels: ['During the Program', 'After the Program'],
    description:
      'This is where aspiring marketers become operators. Learn SEO, ads, copy, funnels, and affiliate — then ship real campaigns in 12 weeks.',
    weeks: 12,
    meta: ['12 Weeks', 'Part-time', 'Live + Practice', 'Limited seats'],
    heroImage:
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=80',
    outcomes: [
      {
        title: 'A growth operator playbook',
        body: 'Channel selection, offers, creative tests, and measurement — in the order real campaigns run.',
        phase: 'During the Program',
      },
      {
        title: 'Ship live marketing systems',
        body: 'Run Meta/Google experiments, SEO pages, and a funnel with tracking — not mock decks.',
        phase: 'During the Program',
      },
      {
        title: '1:1 mentorship',
        body: 'Weekly reviews with growth mentors. Unblock creatives, CPA, and positioning fast.',
        phase: 'During the Program',
      },
      {
        title: 'Portfolio Demo Day',
        body: 'Present case studies. Get critique. Walk out hire-ready or client-ready.',
        phase: 'During the Program',
      },
      {
        title: '6-month growth roadmap',
        body: 'A personal plan: what to ship next, which channel to double down on, what metrics to hit.',
        phase: 'After the Program',
      },
      {
        title: 'Alumni community',
        body: 'Job referrals, freelance leads, and peers who speak the same growth language.',
        phase: 'After the Program',
      },
      {
        title: 'Template vault access',
        body: 'Ad frameworks, SEO briefs, funnel maps, and reporting sheets you’ll reuse for years.',
        phase: 'After the Program',
      },
      {
        title: 'Path to advanced tracks',
        body: 'Continue into specialized self-paced courses or live Yoda Class intensives.',
        phase: 'After the Program',
      },
    ],
    stats: [
      { value: '120+', label: 'Hours of learning & building' },
      { value: '8+', label: 'Live campaign projects' },
      { value: '1:1', label: 'Mentor reviews weekly' },
      { value: '6', label: 'Core growth skills covered' },
    ],
    comparison: {
      theirs: {
        title: 'What most programs teach',
        points: [
          '“Digital marketing” as a 40-slide deck',
          'SEO theory with no live site work',
          'Ads without budget discipline or creative testing',
          'Funnels as diagrams, never launched',
          'A certificate you can’t defend in an interview',
        ],
      },
      ours: {
        title: 'What this program makes you do',
        points: [
          'Run Meta & Google ads with CPA tracking',
          'Ship SEO pages and measure ranking → traffic',
          'Write copy that converts — hooks, offers, landing pages',
          'Launch a real funnel with WhatsApp / email follow-ups',
          'A portfolio case study you can present with confidence',
        ],
      },
    },
    curriculum: [
      {
        week: 'Weeks 1–2',
        title: 'Positioning, offers & research',
        points: [
          'Lock ICP, offer, and channel hypothesis',
          'Keyword + competitor teardown',
          'Creative swipe file and messaging angles',
        ],
        output: 'Offer one-pager + research sheet approved by mentor.',
      },
      {
        week: 'Weeks 3–5',
        title: 'SEO + content engines',
        points: [
          'Keyword map and on-page rewrites',
          'Publish / optimize pages that target intent',
          'Search Console + GA4 baseline',
        ],
        output: 'Live SEO assets + tracking dashboard.',
      },
      {
        week: 'Weeks 6–8',
        title: 'Paid acquisition & creative testing',
        points: [
          'Meta Ads structure, hooks, and scaling rules',
          'Google Ads search / PMax fundamentals',
          'Creative tests with clear kill/scale criteria',
        ],
        output: 'Campaign experiments with CPA / CTR learnings.',
      },
      {
        week: 'Weeks 9–10',
        title: 'Funnels, copy & retention loops',
        points: [
          'Landing page + WhatsApp / email sequences',
          'Affiliate / partnership distribution basics',
          'Conversion rate diagnostics',
        ],
        output: 'End-to-end funnel live with measurement.',
      },
      {
        week: 'Weeks 11–12',
        title: 'Portfolio, Demo Day & career sprint',
        points: [
          'Case study narrative + metrics story',
          'Mock interviews / client pitch practice',
          'Demo Day presentations + feedback',
        ],
        output: 'Portfolio-ready growth case study + next 6-month roadmap.',
      },
    ],
    audience: [
      {
        step: '01',
        title: 'The career switcher',
        body: 'You want a growth role but need proof — projects, language, and confidence — not another certificate.',
      },
      {
        step: '02',
        title: 'The employed builder',
        body: 'You have a job and limited hours. Part-time format. Learn by shipping on nights and weekends.',
      },
      {
        step: '03',
        title: 'The founder / freelancer',
        body: 'You need acquisition systems that pay back — ads, SEO, and funnels you can run without a big team.',
      },
    ],
    admission: [
      {
        title: 'Submit your application',
        body: 'Short form + why you want growth marketing. No entrance exam.',
      },
      {
        title: '15-min fit call',
        body: 'We check motivation and schedule fit. Usually within 5 days.',
      },
      { title: 'Admission decision', body: 'Within 7 days. Scholarships allocated early.' },
      { title: 'Onboarding kit', body: 'Templates, community access, and pre-work before Day 1.' },
      { title: 'Cohort begins', body: 'Weekly live sessions + weekday build sprints start.' },
    ],
    mentors: [
      { name: 'Aravinth R.', role: 'SEO & content systems', initials: 'AR' },
      { name: 'Sneha K.', role: 'Paid media', initials: 'SK' },
      { name: 'Vikram M.', role: 'Funnels & CRO', initials: 'VM' },
    ],
    testimonials: [
      {
        quote:
          'I thought I knew Facebook Ads until this course. It revealed strategies that turned my campaigns around.',
        author: 'Sowndarya',
        location: 'Chidambaram',
      },
      {
        quote:
          'Like uncovering the magic behind search engines. It turned me into an SEO operator, not just a viewer.',
        author: 'A. Thiyagarajan',
        location: 'Dindigul',
      },
      {
        quote:
          'Learning in my native language made the journey clear and enjoyable — my marketing game leveled up.',
        author: 'Anishmon A',
        location: 'Kanyakumari',
      },
    ],
    faqs: [
      {
        q: 'Who is this program for?',
        a: 'Career switchers, working professionals, freelancers, and founders who want to become growth operators — not passive course watchers.',
      },
      {
        q: 'How much time does it take per week?',
        a: 'About 10–12 hours: live sessions plus weekday building. Designed for people who are working or studying.',
      },
      {
        q: 'Do I need prior marketing experience?',
        a: 'No. We start with foundations and move into shipping. Curiosity and consistency matter more than a degree.',
      },
      {
        q: 'How is this different from self-paced courses?',
        a: 'Self-paced courses teach skills deeply. This program forces you to combine SEO, ads, copy, and funnels into live systems with mentors and Demo Day accountability.',
      },
      {
        q: 'Is the curriculum in native language?',
        a: 'Yes. Teaching is native-language first while tools and dashboards stay industry-standard (Meta, Google, Analytics).',
      },
    ],
    pricing: {
      amount: 49999,
      note: '12-week program · Scholarships up to ₹10,000 for high-merit applicants · EMI options available',
      benefits: [
        'Weekly live sessions + recorded library',
        '1:1 mentor reviews',
        'Templates, community, Demo Day',
      ],
    },
  },
]
