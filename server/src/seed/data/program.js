/**
 * Transcribed from the 2026 redesign's programs/complete-growth-marketing.html.
 *
 * The redesign rebuilt this page around a shared AI-native Common Core and two
 * post-Week-6 tracks, so most of the copy below is new. `outcomes`, `mentors`
 * and `testimonials` are kept from the previous build: the redesigned page does
 * not render them, but they are real content and dropping them from the seed
 * would delete it from every environment on the next run.
 */
export const programs = [
  {
    title: 'Complete Growth Marketing Course',
    slug: 'complete-growth-marketing',
    /** The hero kicker above the H1. */
    eyebrow: 'Complete Growth Marketing',
    /*
     * Every heading, eyebrow and subhead on the page, addressed by key and
     * editable under Admin → Programs → Page copy. Anything omitted falls back
     * to the wording in client/src/data/programCopy.js.
     */
    sectionCopy: [
      {
        key: 'hero',
        heading: 'Flagship LIVE Cohort',
        subhead:
          'The small-batch programme where you ship AI-native growth — not slides. From Common Core to a live milestone in 12–14 weeks.',
      },
      {
        key: 'why',
        heading: 'The Why behind the program',
      },
      { key: 'audience', heading: 'Who is this programme for?' },
      {
        key: 'structure',
        eyebrow: 'How the cohort works',
        heading: 'Same Common Core first — then your track',
        subhead:
          'Everyone builds the AI-native fundamentals (Weeks 1–6). After that you split: owners learn to direct growth and evaluate hires; freelancers learn to sell, deliver, and run a live client mandate.',
      },
      {
        key: 'comparison',
        eyebrow: 'Not “digital marketing + one AI slide”',
        heading: 'The 2026 playbook — built live on real data',
        subhead:
          'We mention the old manual method for context, then you build the AI-run version in session.',
      },
      {
        key: 'curriculum',
        eyebrow: 'Weeks 1–6 · Common Core',
        heading: 'AI-native fundamentals every graduate shares',
        subhead:
          '“Build the AI-native operating system every Growth Scholar graduate runs on — before we ever ask what business they run.”',
      },
      {
        key: 'tracks',
        eyebrow: 'After Week 6',
        heading: 'Choose your track',
        subhead: 'Pick the path that matches how you’ll use the Common Core after graduation.',
      },
      {
        key: 'tools',
        eyebrow: 'Stack you’ll touch',
        heading: 'Recommended tools (taught in context)',
        subhead: 'Not a tool dump — you use these while building outputs above.',
      },
      { key: 'admission', eyebrow: 'Selection', heading: 'How admission works' },
      { key: 'pricing', heading: 'What your fee is actually funding' },
      { key: 'faqs', eyebrow: 'FAQ', heading: 'Frequently asked questions' },
      {
        key: 'cta',
        eyebrow: 'Growth Scholar',
        heading: 'Stop watching growth. Start shipping it.',
        subhead:
          'Common Core + your track. One live milestone that proves you can grow in the AI era.',
      },
    ],
    /** Every apply button goes to the application; the fit call to its form. */
    ctas: [
      { key: 'heroApply', label: 'Apply for Batch 4', to: '/programs/apply' },
      { key: 'heroPricing', label: 'See pricing', to: '#apply' },
      { key: 'pricingApply', label: 'Apply for Batch 4', to: '/programs/apply' },
      { key: 'pricingFitCall', label: 'Book fit call', to: '/programs/fit-call' },
      { key: 'finalApply', label: 'Apply for this batch', to: '/programs/apply' },
      { key: 'finalSecondary', label: 'Try a free workshop first', to: '/workshops/seo-mastery' },
      { key: 'stickyApply', label: 'Apply now', to: '/programs/apply' },
    ],
    phaseLabels: ['During the Program', 'After the Program'],
    description:
      'The small-batch programme where you ship AI-native growth — not slides. A shared 42-hour Common Core, then an owner or freelancer track, finishing on a live milestone.',
    weeks: 14,
    meta: ['12–14 weeks', '10 seats / batch', 'LIVE + offline masterclass', 'SEO · AEO · GEO'],
    heroImage:
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=80',

    batchNote: 'Batch 4 open · 10 seats per batch',
    trustBar: [
      { value: '42 hrs', label: 'AI-native Common Core' },
      { value: '78–92 hrs', label: 'total by track' },
      { value: 'SEO + AEO + GEO', label: 'in one module' },
      { value: '1', label: 'live milestone project' },
    ],
    why: {
      paragraphs: [
        'Marketing changed twice in three years — AI answers, paid platforms, and search all moved. The premium now goes to operators who can run an AI-native stack, not people still doing everything by hand.',
        'Real learning happens by doing. Learn fast, ship live, get mentor feedback — so you leave with sites, ads, automations, and a milestone you can defend to a client, employer, or board.',
      ],
      brochureLabel: 'Download brochure',
      brochureUrl:
        'https://docs.google.com/document/d/11HNQxsgwHKkDLEEcm2mB6-tQKr_BN7IHNkr-dTPLI5E/export?format=pdf',
      image: '/assets/flagship/why.jpg',
      imageAlt: 'Small business owner in a café — growth marketing for real operators',
    },
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
      { value: '42', label: 'Hours Common Core (shared)' },
      { value: '2', label: 'Outcome tracks after Week 6' },
      { value: '1', label: 'Live milestone — not mock homework' },
      { value: '10', label: 'Seats per batch' },
    ],
    structure: {
      columns: ['Stage', 'Business owners', 'Freshers & freelancers'],
      rows: [
        // One value against three columns is drawn as a spanning cell — the
        // Common Core is identical for both tracks.
        { stage: 'Common Core', values: ['Weeks 1–6 · 42 hours'] },
        { stage: 'Track modules', values: ['Weeks 7–10 · 26 hours', 'Weeks 7–11 · 34 hours'] },
        { stage: 'Live milestone', values: ['Weeks 11–12 · 10 hours', 'Weeks 12–14 · 16 hours'] },
        {
          stage: 'Total',
          values: ['12 weeks · 78 hours', '14 weeks · 92 hours'],
          isTotal: true,
        },
      ],
    },
    comparison: {
      theirs: {
        title: 'What broke (and what most courses still teach)',
        points: [
          'Search-only funnels while buyers ask ChatGPT first',
          'SEO without AEO / AI Overviews / citation tracking',
          'Ten ad variants written by hand with no test framework',
          'Websites that take months — and still look like templates',
          'Reporting that stops at screenshots, not decisions',
        ],
      },
      ours: {
        title: 'What you build in this cohort',
        points: [
          'ICP, offer, and channel bet — founder-grade positioning brief',
          'Live site + GBP, content engine, SEO + AEO + GEO stack',
          'Meta & Google campaigns with AI creative variants + tracking',
          'Automations (Zapier/n8n, WhatsApp) + AI reporting narratives',
          'Track milestone: 90-day board plan or 30 days of real client delivery',
        ],
      },
    },
    curriculum: [
      {
        week: 'Week 1',
        title: 'Positioning, mindset & the AI-era money map',
        points: [
          'ICP, offer, and one 90-day channel bet — mentor sign-off',
          'How marketers get paid in 2026: salary, retainers, projects, rev-share',
          'AI-fluent vs AI-aware — and a living portfolio doc from day one',
        ],
        output: 'One-page positioning brief (ICP, offer, channel bet).',
      },
      {
        week: 'Weeks 1–2',
        title: 'Consumer & market intelligence, run by AI agents',
        points: [
          'AI personas stress-tested against real customer language',
          'Journey maps with an “AI touchpoint” stage — not just Google',
          'Always-on competitor / market-temperature monitoring',
        ],
        output: 'AI-built persona deck + live competitor teardown sheet.',
      },
      {
        week: 'Weeks 2–3',
        title: 'Build a digital presence in days, not months',
        points: [
          'AI website brief → brand-ready site (not a generic template dump)',
          'Logo, brand kit, and platform-sized creatives',
          'Google Business Profile + local SEO, AI-audited before publish',
        ],
        output: 'Live AI-built website + optimized GBP.',
      },
      {
        week: 'Weeks 3–4',
        title: 'AI-native copywriting & the content engine',
        points: [
          'AIDA, PAS, headline craft — then AI at scale with a brand-voice prompt',
          'One message → five formats in a single sitting',
          'AI-edited Reels: captions, B-roll, voice — repeatable format',
        ],
        output: '30-day content calendar + five published, human-edited assets.',
      },
      {
        week: 'Weeks 4–5',
        title: 'SEO + AEO + GEO — one discipline, not three',
        points: [
          'Technical, on-page, and off-page SEO — done properly, once',
          'AEO: schema, FAQ structure, AI Overview targeting',
          'GEO: citation mechanics across ChatGPT, Perplexity, Gemini, Claude — tracked',
        ],
        output: 'Live SEO assets + AI-citation tracking dashboard you built.',
      },
      {
        week: 'Weeks 5–6',
        title: 'Paid media with AI co-pilots',
        points: [
          'Meta & Google: structure, launch checklist, pixel + UTMs verified',
          'AI ad copy & creative variants with structured A/B tests',
          'Conversion tracking + AI-flagged performance anomalies',
        ],
        output: 'Live ad campaign with variants + conversion tracking.',
      },
      {
        week: 'Week 6',
        title: 'Automation, agentic workflows & AI reporting',
        points: [
          'Zapier/n8n: lead → WhatsApp + CRM automations you monitor',
          'Vibecoding: plain-English spec → working micro-tool in class',
          'GA4 / ads data → client-ready narrative via reusable AI template',
        ],
        output: 'One live automation + self-writing report template.',
      },
    ],
    tracks: [
      {
        tag: 'Track A · 12 weeks total',
        title: 'Business owners (all sectors)',
        variant: 'owner',
        goal: 'Leave able to direct your growth engine and evaluate anyone you hire — not necessarily push every button yourself.',
        modules: [
          { code: 'A1', body: 'Your business as the case study — re-apply Weeks 1–6 to your numbers' },
          { code: 'A2', body: 'Build vs buy vs direct — brief, hire, spot AI-native talent' },
          { code: 'A3', body: 'Venture & compliance basics — GST, invoicing, vendor red flags' },
          { code: 'A4', body: 'ROI, attribution & budget allocation — where the next rupee goes' },
          { code: 'A5', body: 'Live board pitch prep — defend the plan under questioning' },
        ],
        milestone:
          'Milestone (Weeks 11–12): 90-day AI-run growth plan for your business — presented like a board pitch, not an assignment.',
      },
      {
        tag: 'Track B · 14 weeks total',
        title: 'Freshers & freelancers',
        variant: 'freelancer',
        goal: 'Leave able to sell, deliver, and retain — the business of freelancing on top of execution skill.',
        modules: [
          { code: 'B1', body: 'Sales & ethical persuasion — RASNA, CRM, AI discovery prep' },
          { code: 'B2', body: 'Personal brand & authority — LinkedIn/IG with AI content systems' },
          { code: 'B3', body: 'Proposals, pricing & retention — AI reporting as a retention lever' },
          { code: 'B4', body: 'Live agency floor — real ad budget or SEO/GEO mandate for a real SMB' },
        ],
        milestone:
          'Milestone (Weeks 12–14): client-ready proposal + first 30 days of real delivery — portfolio case study included.',
      },
    ],
    toolGroups: [
      {
        title: 'Research & strategy',
        items: ['ChatGPT / Claude · Perplexity', 'Exploding Topics / Glimpse'],
      },
      {
        title: 'Design & website',
        items: ['Canva AI · Looka / Ideogram', 'Framer / 10Web / WordPress + AI builder'],
      },
      { title: 'Copy & content', items: ['ChatGPT / Claude · CapCut AI', 'HeyGen · ElevenLabs'] },
      {
        title: 'SEO, AEO & GEO',
        items: [
          'Search Console · GA4 · Ahrefs or Semrush',
          'Schema generators · AI citation trackers',
        ],
      },
      {
        title: 'Paid media',
        items: ['Meta Ads Manager · Google Ads', 'AdCreative.ai · PMax / Advantage+'],
      },
      {
        title: 'Automation & reporting',
        items: ['Zapier or n8n · Gallabox (WhatsApp)', 'Looker Studio · AI narrative templates'],
      },
    ],
    audience: [
      {
        step: '01',
        title: 'Business owners',
        body: 'For founders and operators who want an AI-run growth engine on their own P&L — and a 90-day plan they can present, not guess.',
        image: '/assets/flagship/who-01.jpg',
        imageAlt: 'Professionals reviewing growth charts and campaign data together',
      },
      {
        step: '02',
        title: 'Freshers & freelancers',
        body: 'For career switchers who need proof — sales discipline, live client delivery, and a portfolio case study before they charge retainers.',
        image: '/assets/flagship/who-02.jpg',
        imageAlt: 'Entrepreneur planning at a desk in a boutique studio',
      },
      {
        step: '03',
        title: 'Ambitious builders',
        body: 'For marketers tired of certificates who want SEO + AEO + GEO, paid media, and automations running on real businesses — with weekly accountability.',
        image: '/assets/flagship/who-03.jpg',
        imageAlt: 'Retail business owner managing sales at the counter',
      },
    ],
    admission: [
      {
        title: 'Submit your application',
        body: 'Detailed intake — motivation, schedule, background. No entrance exam.',
      },
      {
        title: '15-min fit call',
        body: 'Book a slot — we check motivation and schedule fit. Usually within 5 days.',
      },
      { title: 'Admission decision', body: 'Within 7 days. Scholarships allocated early.' },
      { title: 'Onboarding kit', body: 'Templates, community access, and pre-work before Day 1.' },
      {
        title: 'Track assignment',
        body: 'After Common Core, confirm Track A (owner) or Track B (freelancer) with your mentor.',
      },
      {
        title: 'Cohort continues',
        body: 'Live builds through your milestone presentation or client delivery.',
      },
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
        q: 'How is the program structured?',
        a: 'Everyone completes the same 42-hour Common Core (Weeks 1–6): positioning, AI market intel, site/GBP, content engine, SEO+AEO+GEO, paid media, automation & reporting. Then you enter Track A (business owners, 12 weeks total) or Track B (freshers & freelancers, 14 weeks total) and finish with a live milestone project.',
      },
      {
        q: 'Which track should I choose?',
        a: 'Track A if you run a business and need to direct growth, hire vendors, and present a 90-day plan to stakeholders. Track B if you’re building a freelance or job-ready portfolio with sales, pricing, and real client delivery on the line.',
      },
      {
        q: 'What is SEO + AEO + GEO?',
        a: 'Classic SEO plus Answer Engine Optimization (Featured Snippets, AI Overviews, schema) and Generative Engine Optimization (getting cited in ChatGPT, Perplexity, Gemini, Claude) — with tracking, not guesswork.',
      },
      {
        q: 'How much time per week?',
        a: 'Plan for roughly 10–14 hours depending on track and milestone phase: live builds, mentor reviews, and shipping outputs on your business or client mandate.',
      },
      {
        q: 'Do I need prior marketing or AI experience?',
        a: 'No — we teach the 2026 workflow from first principles. You do need consistency, a laptop, and willingness to publish live work (sites, ads, automations) during the cohort.',
      },
      {
        q: 'How is this different from self-paced courses?',
        a: 'Self-paced courses teach topics. This cohort chains them into one AI-native operating system, mentor sign-offs, and a final milestone that’s either a board pitch or real client delivery — that’s what makes the certificate defensible.',
      },
    ],
    pricing: {
      amount: 79999,
      currency: 'INR',
      taxNote: '/– (inc. tax)',
      scholarship: 'flat ₹10,000 scholarship for high-performing applicants',
      duration: 'For 12–14 week Flagship programme',
      status: 'Batch 4 open · 10 seats remaining',
      slots: '10 seats per cohort',
      note: 'No payment until you’re accepted',
      benefits: [
        'Weekly live sessions + recorded library',
        '1:1 mentor reviews',
        'Templates, community, Demo Day',
      ],
      funding: [
        {
          title: '42-hour AI-native Common Core',
          body: 'Shared Weeks 1–6 — positioning through automation & reporting, built live.',
        },
        {
          title: 'Track modules + live milestone',
          body: 'Owner board plan or freelancer client delivery — not mock homework.',
        },
        {
          title: 'Weekly 1:1 mentor reviews',
          body: 'Direct feedback on your campaigns, copy, and stack from operators.',
        },
        {
          title: 'Offline masterclass intensives',
          body: 'In-person builds and knowledge-sharing with your micro-cohort.',
        },
        {
          title: 'Tooling & template vault',
          body: 'Workflows for SEO/AEO/GEO, ads, WhatsApp automations, and AI reporting.',
        },
        {
          title: 'Alumni community access',
          body: 'Peers, referrals, and continued playbooks after graduation.',
        },
      ],
    },
  },
]
