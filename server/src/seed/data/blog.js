/** Transcribed from blog/index.html (carousel + cards) and blog/seo-vs-sem.html (article). */

const seoVsSemBody = [
  {
    type: 'p',
    text: 'You’ve likely come across the debate around SEO vs SEM. SEO is the work you do to rank organically on Google without paying for ad placement, whereas SEM is a broader term that includes paid search advertising.',
  },
  {
    type: 'p',
    text: 'This guide breaks down the SEO vs SEM difference clearly — from how each works to when you should use one over the other. You’ll also find a direct comparison, real use cases, and answers to common questions.',
  },
  { type: 'h2', text: 'SEO vs SEM: The Core Difference You Need to Know' },
  {
    type: 'p',
    text: 'SEO stands for Search Engine Optimization. SEM stands for Search Engine Marketing.',
  },
  {
    type: 'p',
    text: 'SEO focuses on improving a website’s visibility in organic search results. You don’t pay Google directly for each click. Instead, you optimize content, improve technical health, and earn authority so Google chooses to show your pages.',
  },
  {
    type: 'p',
    text: 'SEM is a broader strategy that includes paid search advertising. Businesses bid on keywords and pay when users click their ads. This model is commonly known as PPC (Pay-Per-Click).',
  },
  {
    type: 'p',
    text: 'When someone searches “best project management tools,” the results fall into two buckets. The top few with a “Sponsored” label are SEM. The results below, without that label, are organic — the domain of SEO.',
  },
  {
    type: 'callout',
    text: 'Simplest memory hook:',
    items: ['SEO = Organic traffic', 'SEM = Paid traffic through search engines'],
  },
  {
    type: 'p',
    text: 'The biggest practical difference is speed. SEM can put you at the top within hours of launching a campaign. SEO often takes months of consistent work before meaningful traffic shows up.',
  },
  {
    type: 'p',
    text: 'That doesn’t make one better. It makes them useful for different situations.',
  },
  { type: 'h2', text: 'How SEO Works: Earning Your Spot in Search Results' },
  {
    type: 'p',
    text: 'SEO is a compounding system. You research what people search for, build pages that answer those searches better than the current results, keep the site technically healthy, and earn links that signal authority.',
  },
  {
    type: 'ul',
    items: [
      'Keyword and intent research — what people type and why',
      'On-page optimization — titles, structure, internal links',
      'Content systems — publishing and refreshing on a cadence',
      'Technical health — crawlability, speed, indexation',
      'Authority — ethical links and brand mentions',
    ],
  },
  { type: 'h2', text: 'How SEM Works: Paying for Visibility' },
  {
    type: 'p',
    text: 'With SEM you bid on keywords, write ads, and pay per click. Placement depends on your bid and your quality score — how relevant your ad and landing page are to the query.',
  },
  {
    type: 'p',
    text: 'The advantage is control and speed. You can be live this afternoon, and you can turn spend up or down as results come in. The cost is that visibility stops the moment the budget does.',
  },
  { type: 'h2', text: 'SEO and SEM Compared Across Performance Metrics' },
  {
    type: 'ul',
    items: [
      'Time to results — SEM: hours. SEO: months.',
      'Cost model — SEM: pay per click. SEO: invest in content and technical work.',
      'Durability — SEM stops with the budget. SEO compounds.',
      'Testing speed — SEM validates messaging fast; feed those learnings into SEO.',
    ],
  },
  { type: 'h2', text: 'SEO vs SEM vs PPC: Clearing Up the Confusion' },
  {
    type: 'p',
    text: 'PPC is a pricing model, not a channel. SEM is the umbrella term for marketing on search engines, and paid search within it is usually billed as PPC. SEO sits alongside as the organic half.',
  },
  { type: 'h2', text: 'When to Use SEO, SEM, or Both' },
  {
    type: 'ul',
    items: [
      'Launching a new offer and need signal this week → SEM.',
      'Building a durable acquisition channel → SEO.',
      'Have budget and time → both, with SEM funding the learning that SEO scales.',
    ],
  },
  { type: 'h2', text: 'Conclusion' },
  {
    type: 'p',
    text: 'Treat them as one system. Use paid search to learn which messages and keywords convert, then build organic pages around what already works. That is how growth teams compound results instead of renting traffic forever.',
  },
]

export const blogPosts = [
  // ------------------------------- featured -------------------------------
  {
    title: 'Best Growth Marketing Courses in 2026: How to Pick One That Ships Skills',
    slug: 'best-growth-marketing-courses-2026',
    category: 'Career',
    excerpt:
      'Not every “digital marketing” course builds operators. Here’s how to evaluate curriculum, practice load, mentorship, and outcomes — before you spend.',
    author: { name: 'Aravinth R.', avatar: 'AR', role: 'SEO & content systems' },
    publishedAt: new Date('2026-08-06'),
    readTime: '12 min read',
    featured: true,
    heroClass: 'feat-career',
    heroLabel: 'Career Advice',
    body: [
      {
        type: 'p',
        text: 'Most course pages sell outcomes. Very few show the work that produces them. Before you pay, look for four things: a sequenced curriculum, a practice load you can point at, mentorship with a named human, and graduates with artifacts.',
      },
      { type: 'h2', text: 'Curriculum: sequenced, not sampled' },
      {
        type: 'p',
        text: 'A good syllabus reads like a campaign runs — research, then acquisition, then conversion, then measurement. If the modules could be shuffled without harm, it is a playlist, not a program.',
      },
      { type: 'h2', text: 'Practice load' },
      {
        type: 'p',
        text: 'Ask what you will have built by the end. If the answer is “notes”, keep looking.',
      },
    ],
  },
  {
    title: 'SEO vs SEM: What’s the Difference and Which One Do You Need?',
    slug: 'seo-vs-sem',
    category: 'SEO',
    excerpt:
      'Organic vs paid search, clarified — with a direct comparison, when to use each, and how they work together in a real growth system.',
    author: { name: 'Growth Scholar', avatar: 'GS', role: 'Editorial' },
    publishedAt: new Date('2026-08-06'),
    readTime: '6 min read',
    featured: true,
    heroClass: 'feat-seo',
    heroLabel: 'SEO vs SEM',
    body: seoVsSemBody,
  },
  {
    title: 'Creative Testing Frameworks That Cut CPA Without Guesswork',
    slug: 'creative-testing-frameworks',
    category: 'Paid Media',
    excerpt:
      'A simple hook–angle–format loop you can run weekly — so your Meta spend teaches you something every cycle.',
    author: { name: 'Sneha K.', avatar: 'SK', role: 'Paid media' },
    publishedAt: new Date('2026-08-02'),
    readTime: '8 min read',
    featured: true,
    heroClass: 'feat-ads',
    heroLabel: 'Meta Ads Creative',
    body: [
      {
        type: 'p',
        text: 'Creative is the biggest lever in paid social, and the only one most teams test by vibes. A loop fixes that: change one variable per cycle, keep the rest fixed, and write down the kill or scale rule before you launch.',
      },
      { type: 'h2', text: 'The hook–angle–format loop' },
      {
        type: 'ul',
        items: [
          'Hook — the first three seconds',
          'Angle — the promise or objection you lead with',
          'Format — static, UGC, motion, carousel',
        ],
      },
      {
        type: 'p',
        text: 'Test hooks first: they move the most volume for the least production cost.',
      },
    ],
  },
  // ------------------------------ grid cards ------------------------------
  {
    title: 'How to Become a Growth Marketer in India (Without a Fancy Degree)',
    slug: 'become-a-growth-marketer-in-india',
    category: 'Career',
    excerpt:
      'The skills, the artifacts, and the order to build them in — from someone who hires for growth roles.',
    author: { name: 'Aravinth R.', avatar: 'AR' },
    publishedAt: new Date('2026-08-05'),
    readTime: '11 min read',
    heroClass: 'feat-career',
    heroLabel: 'Career Path',
    body: [
      {
        type: 'p',
        text: 'Nobody hiring for growth asks where you studied. They ask what you have run. Build the artifacts in this order and the interviews take care of themselves.',
      },
    ],
  },
  {
    title: 'Landing Page Copy Formula That Converts Cold Traffic',
    slug: 'landing-page-copy-formula',
    category: 'Copywriting',
    excerpt: 'Hook, promise, proof, objection, offer — in the order cold visitors actually read.',
    author: { name: 'Priya D.', avatar: 'PD' },
    publishedAt: new Date('2026-07-28'),
    readTime: '7 min read',
    heroClass: 'feat-copy',
    heroLabel: 'Copy',
    body: [
      {
        type: 'p',
        text: 'Cold traffic reads in a specific order. Match your page to that order and conversion rate moves before you touch design.',
      },
    ],
  },
  {
    title: 'Build a Lead Magnet Funnel in One Weekend',
    slug: 'lead-magnet-funnel-weekend',
    category: 'Funnels',
    excerpt:
      'Optin, thank-you, nurture, offer — the smallest funnel that still teaches you something.',
    author: { name: 'Vikram M.', avatar: 'VM' },
    publishedAt: new Date('2026-07-22'),
    readTime: '9 min read',
    heroClass: 'feat-funnel',
    heroLabel: 'Funnels',
    body: [
      {
        type: 'p',
        text: 'You do not need a builder subscription or a designer. You need one promise, one form, and a follow-up sequence that earns the next click.',
      },
    ],
  },
  {
    title: 'Affiliate Offer Selection: What to Promote First',
    slug: 'affiliate-offer-selection',
    category: 'Affiliate',
    excerpt: 'Commission is the last thing to check. Start with audience overlap and refund rates.',
    author: { name: 'Jai T.', avatar: 'JT' },
    publishedAt: new Date('2026-07-18'),
    readTime: '6 min read',
    heroClass: 'feat-funnel',
    heroLabel: 'Affiliate',
    body: [
      {
        type: 'p',
        text: 'The highest-paying offer in your niche is usually the worst first choice. Pick the one your audience already wants and where the product actually delivers.',
      },
    ],
  },
  {
    title: 'Test. Learn. Repeat: A Weekly Growth Operating Cadence',
    slug: 'weekly-growth-operating-cadence',
    category: 'Growth Strategy',
    excerpt: 'The meeting, the metric, and the one decision that should come out of each week.',
    author: { name: 'Growth Scholar', avatar: 'GS' },
    publishedAt: new Date('2026-07-14'),
    readTime: '10 min read',
    heroClass: 'feat-career',
    heroLabel: 'Growth',
    body: [
      {
        type: 'p',
        text: 'Growth is not a burst of ideas, it is a cadence. One metric, one hypothesis, one decision per week beats a quarterly brainstorm every time.',
      },
    ],
  },
  {
    title: '15 Keyword Research Moves That Actually Map to Intent',
    slug: 'keyword-research-moves',
    category: 'SEO',
    excerpt: 'Volume is a vanity filter. These are the moves that find pages worth building.',
    author: { name: 'Aravinth R.', avatar: 'AR' },
    publishedAt: new Date('2026-07-10'),
    readTime: '8 min read',
    heroClass: 'feat-seo',
    heroLabel: 'Keywords',
    body: [
      {
        type: 'p',
        text: 'Every keyword is a question with a job attached. Sort by the job — research, compare, buy — and the content plan writes itself.',
      },
    ],
  },
  {
    title: 'Search Ads Structure for Beginners: Campaigns That Scale Cleanly',
    slug: 'search-ads-structure-for-beginners',
    category: 'Paid Media',
    excerpt: 'How to name, group, and budget campaigns so month three is not a rebuild.',
    author: { name: 'Sneha K.', avatar: 'SK' },
    publishedAt: new Date('2026-07-05'),
    readTime: '9 min read',
    heroClass: 'feat-ads',
    heroLabel: 'Google Ads',
    body: [
      {
        type: 'p',
        text: 'Most beginner accounts are not badly optimized, they are badly organised. Structure first — optimisation gets easy after that.',
      },
    ],
  },
]

/** Category rail order from blog/index.html */
export const blogCategories = [
  'Latest Articles',
  'SEO',
  'Paid Media',
  'Copywriting',
  'Funnels',
  'Affiliate',
  'Career',
  'Growth Strategy',
]
