/**
 * The Resources section, transcribed from the 2026 redesign drop's
 * resources/playbooks/*.html and resources/claude-skills/skill/*.html.
 *
 * Extracted mechanically from the delivered HTML rather than retyped, so the
 * copy on the live site is the copy the client wrote.  preserves the
 * sequence the index pages listed them in.
 */
export const playbooks = [
  {
    slug: 'meta-creative-testing-loop-by-sneha-k',
    title: 'The Meta Creative Testing Loop Playbook, by Sneha K.',
    heroClass: 'pb-hero-meta',
    deck: 'A paid media mentor’s weekly hook → angle → format system — built for Tamil & English markets and small teams without a dedicated creative studio.',
    achievement: {
      heading: 'Proudest achievement',
      body: '32% CPA drop in 6 weeks for a D2C cohort — same budget, 2.1× more purchase events after killing vanity hooks.',
    },
    sections: [
      {
        id: 'about-sneha',
        heading: 'About Sneha',
        body: [
          'Sneha runs paid social for Indian D2C and local service brands. She mentors Growth Scholar workshops and Flagship paid-media sprints.',
          'This playbook is the same loop she assigns when a account is stuck on one “winning” creative that’s slowly fatiguing.',
        ],
      },
      {
        id: 'about-context',
        heading: 'About the context',
        body: [
          'Most learners know how to boost a post — fewer know how to run a disciplined test cadence when CPMs swing and creative dies in 10 days.',
          'Growth Scholar’s gap track treats Meta as a learning system: every week your ads should teach you something, even when ROAS is flat.',
        ],
      },
      {
        id: 'who-she-is',
        heading: 'Who she is',
        body: [
          'Former in-house performance marketer, now freelancer + mentor. Specializes in cold-traffic offers for Tamil Nadu and Karnataka D2C.',
          'She doesn’t chase viral reels — she chases repeatable hooks tied to offer clarity.',
          'If you only change the image and not the hook, you’re not testing — you’re decorating.',
        ],
      },
      {
        id: 'the-market',
        heading: 'The market',
        body: [
          'Primary: ₹5L–₹50L/month Meta spend, single-product or narrow SKU D2C, founder still approving copy.',
          'Secondary: lead-gen (clinics, edtech) where Tamil/English ad variants matter for trust.',
        ],
      },
      {
        id: 'the-motion',
        heading: 'The testing motion',
        body: [
          'Three lanes each week: new hooks (pain/proof/offer), new angles (audience slice or objection), new formats (static vs UGC vs carousel).',
          'Never more than one variable change per ad set when learning — except intentional format tests with matched hooks.',
        ],
      },
      {
        id: 'icp',
        heading: 'ICP & offer fit',
        body: [
          'Works best when the offer is one clear outcome (trial box, consult, workshop seat) and landing page matches the hook.',
          'Weak fit: multi-SKU catalog stores with no hero product — fix offer before scaling tests.',
        ],
      },
      {
        id: 'stack',
        heading: 'Stack',
        body: [
          'Testing matrix in Sheets: hook ID, angle, format, spend, CPA, thumb-stop proxy (3-sec views if available).',
          'Claude skill for 10×3 hook batches; Canva templates for Tamil headline safe zones.',
        ],
      },
      {
        id: 'the-sequence',
        heading: 'The sequence',
        body: [
          'Monday: pull last week’s winners/losers, retire fatigued assets (frequency > 2.5 on cold).',
          'Tuesday–Wednesday: launch 3–6 new variants in CBO or dedicated test campaign.',
          'Thursday: kill bottom 50% by spend with no signal.',
          'Friday: document winner hypothesis in one sentence for next week’s angle batch.',
        ],
      },
      {
        id: 'numbers',
        heading: 'The numbers',
        body: [
          '→ 3–6 new creatives per week per core ad set',
          '→ Target: 15–25% CPA improvement within 4 weeks or change offer/LP',
          '→ Minimum ₹3k–₹5k per variant before judging (market dependent)',
        ],
      },
      {
        id: 'how-the-week',
        heading: 'How the week is structured',
        body: [
          'Morning: check delivery and rejections. Midday: creative production block. Afternoon: naming conventions + matrix update.',
          'Sneha asks mentees: ‘What did we learn?’ not ‘What’s our ROAS?’ until learning volume is high enough.',
        ],
      },
    ],
    tools:
      'Meta Ads Manager, Google Sheets testing matrix, Canva, Claude (creative angles skill), Motion or CapCut for variants',
    relatedSkill: {
      label: 'Meta creative angle generator',
      slug: 'meta-creative-angle-generator',
    },
    cta: {
      heading: 'A pipeline full of qualified leads starts here.',
      body: 'Practice this playbook in workshops — or ship it live in Flagship with mentors who review your work every week.',
    },
    visualClass: 'pb-v-meta',
    tag: 'Meta Ads',
    cardTitle: 'Creative testing loop that cut CPA 32%',
    initials: 'SK',
    authorName: 'Sneha K.',
    authorRole: 'Paid media mentor',
    summary:
      'Hook → angle → format matrix you can run weekly on Advantage+ campaigns, with Tamil & English ad copy examples.',
    order: 0,
  },
  {
    slug: 'intent-map-seo-sprint-by-aravinth-r',
    title: 'The Intent-Map SEO Sprint Playbook, by Aravinth R.',
    heroClass: 'pb-hero-seo',
    deck: 'From SERP scrape to shipped briefs — the 14-day sprint Flagship batch-3 used to publish 12 URLs with measurable clicks.',
    achievement: {
      heading: 'Proudest achievement',
      body: '12 URLs shipped in 14 days with batch-3 — 4 pages hit page-one within 90 days on mid-tail intent terms.',
    },
    sections: [
      {
        id: 'about-aravinth',
        heading: 'About Aravinth',
        body: [
          'Aravinth leads SEO curriculum and mentor reviews for Growth Scholar. He built this sprint for operators who know keywords but stall at brief quality.',
        ],
      },
      {
        id: 'about-growth-scholar',
        heading: 'About Growth Scholar SEO ops',
        body: [
          'We teach intent-first SEO in native languages — briefs must work for Tamil and English publishing pipelines, not just translated blogs.',
        ],
      },
      {
        id: 'who-he-is',
        heading: 'Who he is',
        body: [
          'Consultant for Indian SaaS and edtech; obsessed with SERP layout changes and AI overview extractability.',
        ],
      },
      {
        id: 'the-market',
        heading: 'The market',
        body: [
          'Freelancers serving local businesses, in-house marketers with 10–50 priority URLs, Flagship learners shipping their first cluster.',
        ],
      },
      {
        id: 'the-motion',
        heading: 'The sprint motion',
        body: [
          'Week 1: map 20–40 keywords to intent buckets. Week 2: briefs + publish schedule. No writing until intent labels are agreed.',
        ],
      },
      {
        id: 'icp',
        heading: 'ICP & keywords',
        body: [
          'Focus on commercial and informational mid-tail where you can win with depth — avoid head terms unless you have authority.',
        ],
      },
      {
        id: 'stack',
        heading: 'Stack',
        body: [
          'Export top-10 SERP per keyword; Claude skill outputs H2 skeleton + Tamil title variants; brief template includes FAQ block for schema.',
        ],
      },
      {
        id: 'the-sequence',
        heading: 'The 14-day sequence',
        body: [
          'Days 1–3: keyword list + intent tags. Days 4–7: SERP scrape batch. Days 8–10: briefs. Days 11–14: publish first 4–6 pages.',
        ],
      },
      {
        id: 'numbers',
        heading: 'The numbers',
        body: [
          '→ 12 briefs in 14 days (team of 1–2)',
          '→ 4–6 pages live by day 14',
          '→ Review GSC impressions at day 45, not day 5',
        ],
      },
      {
        id: 'how-the-day',
        heading: 'How the day is structured',
        body: [
          'AM: GSC + one SERP deep dive. PM: brief writing + internal link plan. Friday: mentor rubric self-score.',
        ],
      },
    ],
    tools:
      'Ahrefs or Ubersuggest, Google Search Console, Claude (intent map skill), Notion or Sheets brief template',
    relatedSkill: {
      label: 'Intent map from SERP scrape',
      slug: 'intent-map-from-serp',
    },
    cta: {
      heading: 'A pipeline full of qualified leads starts here.',
      body: 'Practice this playbook in workshops — or ship it live in Flagship with mentors who review your work every week.',
    },
    visualClass: 'pb-v-seo',
    tag: 'SEO',
    cardTitle: 'Intent-map SEO sprint (14 days)',
    initials: 'AR',
    authorName: 'Aravinth R.',
    authorRole: 'SEO lead',
    summary:
      'From SERP scrape to page briefs — the same workflow Flagship batch-3 used to ship 12 URLs with measurable clicks.',
    order: 1,
  },
  {
    slug: 'offer-landing-whatsapp-by-vikram-m',
    title: 'The Offer → Landing → WhatsApp Playbook, by Vikram M.',
    heroClass: 'pb-hero-funnel',
    deck: 'Traffic → lead magnet → WhatsApp nurture → call — with Tamil voice-note scripts and a one-page measurement sheet.',
    achievement: {
      heading: 'Proudest achievement',
      body: 'Pilot funnel for a coaching brand: 41% show-up rate to discovery calls vs 22% with email-only nurture.',
    },
    sections: [
      {
        id: 'about-vikram',
        heading: 'About Vikram',
        body: [
          'Vikram coaches funnel implementation in Growth Scholar workshops and Flagship offline masterclasses.',
        ],
      },
      {
        id: 'about-the-funnel',
        heading: 'About this funnel type',
        body: [
          'Built for high-trust local and regional offers where WhatsApp is the default follow-up channel — not a CRM afterthought.',
        ],
      },
      {
        id: 'who-he-is',
        heading: 'Who he is',
        body: [
          'Former performance lead for edtech admissions; now builds funnels for Tamil-first offers.',
        ],
      },
      {
        id: 'the-market',
        heading: 'The market',
        body: ['Coaching, clinics, real estate advisors, high-ticket services ₹15k+ ticket.'],
      },
      {
        id: 'the-motion',
        heading: 'The funnel motion',
        body: [
          'Cold or warm traffic → single CTA landing → immediate WhatsApp opt-in → 3-touch nurture → calendar link.',
        ],
      },
      {
        id: 'icp',
        heading: 'ICP & offer',
        body: [
          'One outcome, one deadline, proof above the fold. If offer needs 3 paragraphs to explain, fix offer first.',
        ],
      },
      {
        id: 'stack',
        heading: 'Stack',
        body: [
          'LP with one form field + phone; automated WhatsApp welcome within 5 minutes; voice note on day 2.',
        ],
      },
      {
        id: 'the-sequence',
        heading: 'Message sequence',
        body: [
          'T+0: confirm + what happens next. T+1: voice note (Tamil or English). T+3: objection FAQ. T+5: calendar + break-up.',
        ],
      },
      {
        id: 'numbers',
        heading: 'The numbers',
        body: [
          '→ Target 35%+ call show rate from qualified WhatsApp leads',
          '→ Reply within 15 minutes on inbound',
          '→ 3–5% LP conversion cold traffic baseline',
        ],
      },
      {
        id: 'how-the-week',
        heading: 'Launch week structure',
        body: [
          'Mon: LP live. Tue–Thu: traffic test ₹2k/day. Fri: read metrics sheet, adjust hook on LP hero only.',
        ],
      },
    ],
    tools:
      'Landing page builder, Meta lead ads or forms, WhatsApp Business, Sheets tracker, Claude WhatsApp skill',
    relatedSkill: {
      label: 'WhatsApp follow-up sequences',
      slug: 'whatsapp-follow-up-sequences',
    },
    cta: {
      heading: 'A pipeline full of qualified leads starts here.',
      body: 'Practice this playbook in workshops — or ship it live in Flagship with mentors who review your work every week.',
    },
    visualClass: 'pb-v-funnel',
    tag: 'Funnels',
    cardTitle: 'Offer → landing → WhatsApp follow-up',
    initials: 'VM',
    authorName: 'Vikram M.',
    authorRole: 'Funnel coach',
    summary:
      'Local business funnel used in offline masterclass — includes Tamil voice-note scripts and measurement sheet.',
    order: 2,
  },
  {
    slug: 'flagship-accountability-cadence',
    title: 'The Flagship 10-Seat Batch Accountability Playbook',
    heroClass: 'pb-hero-flagship',
    deck: 'How mentors run 2–3 month LIVE implementation — weekly builds, review rubric, and offline masterclass agenda for cohorts of 10.',
    achievement: {
      heading: 'Proudest achievement',
      body: 'Batch size capped at 10 so every learner gets ship-ready reviews — focused, not auditorium Q&A.',
    },
    sections: [
      {
        id: 'about-flagship',
        heading: 'About Flagship',
        body: [
          'Complete Growth Marketing is Growth Scholar’s LIVE Flagship — offline masterclass plus weekly implementation, not passive video.',
        ],
      },
      {
        id: 'about-growth-scholar',
        heading: 'About Growth Scholar',
        body: [
          'Native-language upskilling for marketers who finished generic courses and need updated playbooks plus accountability.',
        ],
      },
      {
        id: 'who-its-for',
        heading: 'Who it’s for',
        body: [
          'Founders and operators ready to ship SEO, ads, and funnel assets with mentor eyes on real work.',
        ],
      },
      {
        id: 'the-market',
        heading: 'Why batches of 10',
        body: [
          'Large cohorts create hiding. Ten seats keeps presentation, peer pressure, and deep review — without losing peer diversity.',
        ],
      },
      {
        id: 'the-motion',
        heading: 'The cadence',
        body: [
          'Weekly build deadline → rubric review → redo list → masterclass deep dive on one system (SEO week, ads week, etc.).',
        ],
      },
      {
        id: 'icp',
        heading: 'Learner ICP',
        body: [
          'Already running client or business marketing; needs structure and feedback, not definitions.',
        ],
      },
      {
        id: 'stack',
        heading: 'Stack',
        body: [
          'Shared Notion, recorded Loom critiques, in-person masterclass for simulation drills.',
        ],
      },
      {
        id: 'the-sequence',
        heading: '12-week arc',
        body: [
          'Foundation audit → one channel focus per month → capstone campaign live before cohort ends.',
        ],
      },
      {
        id: 'numbers',
        heading: 'Expectations',
        body: [
          '→ 6–8 hours/week minimum',
          '→ 1 shippable asset weekly',
          '→ 2–3 months to completion',
        ],
      },
      {
        id: 'how-the-week',
        heading: 'Weekly rhythm',
        body: ['Mon: plan. Wed: async submit. Sat: masterclass or group review. Sun: redo buffer.'],
      },
    ],
    tools:
      'Notion cohort space, Zoom + offline venue, Loom feedback, Sheets rubric, WhatsApp batch channel',
    relatedSkill: {
      label: 'Funnel wireframe from offer',
      slug: 'funnel-wireframe-from-offer',
    },
    cta: {
      heading: 'A pipeline full of qualified leads starts here.',
      body: 'Practice this playbook in workshops — or ship it live in Flagship with mentors who review your work every week.',
    },
    visualClass: 'pb-v-flagship',
    tag: 'Flagship LIVE',
    cardTitle: '10-seat batch accountability cadence',
    initials: 'GS',
    authorName: 'Growth Scholar',
    authorRole: 'Complete GM',
    summary:
      'How mentors run 2–3 month LIVE implementation — weekly builds, review rubric, and offline masterclass agenda.',
    order: 3,
  },
  {
    slug: 'native-language-ad-angles-by-priya-d',
    title: 'The Native-Language Ad Angles Playbook, by Priya D.',
    heroClass: 'pb-hero-copy',
    deck: 'Swipe file of Tamil-first hooks for cold traffic — paired with English variants for split tests without losing cultural nuance.',
    achievement: {
      heading: 'Proudest achievement',
      body: 'Tamil hook beat English control by 18% CTR on three consecutive workshop promos.',
    },
    sections: [
      {
        id: 'about-priya',
        heading: 'About Priya',
        body: [
          'Priya mentors copy and creative direction for regional campaigns across Growth Scholar workshops.',
        ],
      },
      {
        id: 'about-native',
        heading: 'About native-first copy',
        body: [
          'Translation-last English ads underperform in Tamil markets — intent and trust live in idiom, not literal swap.',
        ],
      },
      {
        id: 'who-she-is',
        heading: 'Who she is',
        body: [
          'Copy lead for Tamil Nadu edtech and wellness brands; bilingual reviewer for Hindi pilots.',
        ],
      },
      {
        id: 'the-market',
        heading: 'The market',
        body: [
          'Regional offers, founder-led brands, political/sensitive categories needing soft tone.',
        ],
      },
      {
        id: 'the-motion',
        heading: 'The angle motion',
        body: [
          'Write Tamil hook first → extract claim → English variant for test → LP matches primary language of ad.',
        ],
      },
      {
        id: 'icp',
        heading: 'ICP & voice',
        body: [
          'Audience 25–45, mobile-first, WhatsApp-native; avoid corporate English in Tamil body copy.',
        ],
      },
      {
        id: 'stack',
        heading: 'Stack',
        body: ['Hook library tagged by pain/proof/offer; 15-min native review gate before spend.'],
      },
      {
        id: 'the-sequence',
        heading: 'Hook workflow',
        body: [
          'Brainstorm 10 Tamil hooks → narrow to 3 → English pairs → 1 UGC script per winner.',
        ],
      },
      {
        id: 'numbers',
        heading: 'The numbers',
        body: [
          '→ 3 hooks minimum per launch',
          '→ 18%+ CTR lift target when native beats English',
          '→ 1 reviewer, 15 minutes, non-negotiable',
        ],
      },
      {
        id: 'how-the-week',
        heading: 'Campaign week',
        body: ['Mon hooks. Tue review. Wed creative. Thu launch. Fri kill losers.'],
      },
    ],
    tools:
      'Meta Ads, Claude landing page skill, Sheets hook library, native speaker review (15 min/campaign)',
    relatedSkill: {
      label: 'Landing page section writer',
      slug: 'landing-page-section-writer',
    },
    cta: {
      heading: 'A pipeline full of qualified leads starts here.',
      body: 'Practice this playbook in workshops — or ship it live in Flagship with mentors who review your work every week.',
    },
    visualClass: 'pb-v-copy',
    tag: 'Copy',
    cardTitle: 'Native-language ad angles that convert',
    initials: 'PD',
    authorName: 'Priya D.',
    authorRole: 'Copy mentor',
    summary:
      'Swipe file of Tamil-first hooks for cold traffic — paired with English variants for A/B tests.',
    order: 4,
  },
  {
    slug: 'weekly-growth-metrics-by-jai-t',
    title: 'The Weekly Growth Metrics Review Playbook, by Jai T.',
    heroClass: 'pb-hero-analytics',
    deck: 'One dashboard, five decisions — the template from gap courses to stop reporting vanity metrics to clients and teams.',
    achievement: {
      heading: 'Proudest achievement',
      body: 'Freelancers in cohort cut client reporting time from 3 hours to 35 minutes with the same decision quality.',
    },
    sections: [
      {
        id: 'about-jai',
        heading: 'About Jai',
        body: [
          'Jai teaches analytics in gap courses — focused on decisions, not chart decoration.',
        ],
      },
      {
        id: 'about-the-review',
        heading: 'About the review',
        body: [
          'Weekly rhythm beats monthly panic. This playbook forces five explicit decisions per week.',
        ],
      },
      {
        id: 'who-he-is',
        heading: 'Who he is',
        body: ['Ex-agency analytics lead; now freelance for D2C and lead-gen accounts.'],
      },
      {
        id: 'the-market',
        heading: 'The market',
        body: ['Freelancers with 3–8 retainer clients; in-house solo marketers.'],
      },
      {
        id: 'the-motion',
        heading: 'The review motion',
        body: ['Pull deltas → name hypothesis → pick three actions → one thing to stop doing.'],
      },
      {
        id: 'icp',
        heading: 'ICP & metrics',
        body: [
          'Track CPA/CPL, MER or blended ROAS, landing CVR, email/WA reply rate — skip vanity reach alone.',
        ],
      },
      {
        id: 'stack',
        heading: 'Stack',
        body: ['Single Looker or Sheet tab; Claude narrative for client email draft.'],
      },
      {
        id: 'the-sequence',
        heading: '30-minute agenda',
        body: ['0–5: data pull. 5–15: delta review. 15–25: decisions. 25–30: client/team message.'],
      },
      {
        id: 'numbers',
        heading: 'The numbers',
        body: [
          '→ 5 decisions max',
          '→ 30 minutes timer',
          '→ 3 prioritized actions exported to task list',
        ],
      },
      {
        id: 'how-the-week',
        heading: 'Where it sits in the week',
        body: ['Same slot every week — Monday for media buyers, Friday for SEO-heavy accounts.'],
      },
    ],
    tools: 'GA4, Meta Ads, Google Ads, Looker Studio or Sheets, Claude weekly narrative skill',
    relatedSkill: {
      label: 'Weekly metrics narrative',
      slug: 'weekly-metrics-narrative',
    },
    cta: {
      heading: 'A pipeline full of qualified leads starts here.',
      body: 'Practice this playbook in workshops — or ship it live in Flagship with mentors who review your work every week.',
    },
    visualClass: 'pb-v-analytics',
    tag: 'Analytics',
    cardTitle: 'Weekly growth metrics review (30 min)',
    initials: 'JT',
    authorName: 'Jai T.',
    authorRole: 'Analytics',
    summary:
      'One dashboard, five decisions — template used in gap courses to stop reporting vanity metrics.',
    order: 5,
  },
]

export const claudeSkills = [
  {
    slug: 'intent-map-from-serp',
    title: 'Intent Map From SERP Scrape',
    tagline: 'Turn top-10 SERP results into bilingual content briefs with clear intent labels.',
    about:
      'Feeds Claude a keyword and competitor URLs (or pasted SERP snippets) and returns structured briefs: primary intent, subtopics, H2 outline, and Tamil + English title variants aligned to how Indian audiences search.',
    features: [
      {
        title: 'Intent classification',
        body: 'Labels each result as informational, commercial, or transactional with evidence from titles and snippets.',
      },
      {
        title: 'Outline generator',
        body: 'Produces H2/H3 skeletons you can paste into Notion or your CMS.',
      },
      {
        title: 'Bilingual titles',
        body: 'Suggests Tamil and English headline options without awkward literal translation.',
      },
      {
        title: 'Gap callouts',
        body: 'Flags topics competitors cover that your draft misses.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'seo',
    icon: '🔍',
    badge: 'SEO',
    cardTitle: 'Intent map from SERP scrape',
    summary: 'Turn top-10 results into content briefs with Tamil & English outline variants.',
    order: 0,
  },
  {
    slug: 'on-page-seo-audit-checklist',
    title: 'On-Page SEO Audit Checklist',
    tagline: 'Structured pass/fail report for titles, schema, and internal links.',
    about:
      'Walks any URL or pasted HTML through a consistent on-page checklist — metadata, headings, internal links, image alt text, and basic schema — and outputs prioritized fixes for freelancers and in-house teams.',
    features: [
      {
        title: 'Scored sections',
        body: 'Title, meta, H1, content depth, links, and media each get a status.',
      },
      {
        title: 'Schema hints',
        body: 'Recommends FAQ, Article, or Product schema when content type matches.',
      },
      {
        title: 'Internal link map',
        body: 'Lists orphan risks and suggests anchor text for hub pages.',
      },
      {
        title: 'Export-ready',
        body: 'Markdown table you can send to clients or devs.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'seo',
    icon: '📄',
    badge: 'SEO',
    cardTitle: 'On-page SEO audit checklist',
    summary: 'Structured pass/fail report for titles, schema, and internal links.',
    order: 1,
  },
  {
    slug: 'meta-creative-angle-generator',
    title: 'Meta Creative Angle Generator',
    tagline: 'Ten hooks × three formats from one offer document.',
    about:
      'Takes your offer, audience, and proof points and generates a testing matrix: hooks, angles, and format notes (static, carousel, UGC-style) so media buyers can launch variants without staring at a blank doc.',
    features: [
      {
        title: 'Hook library',
        body: 'Pain, proof, curiosity, and offer-led hooks with platform-safe length.',
      },
      {
        title: 'Format pairing',
        body: 'Matches each hook to static, video script, or carousel frame ideas.',
      },
      {
        title: 'Audience variants',
        body: 'Founder, freelancer, and fresher tones for Indian markets.',
      },
      {
        title: 'Test plan',
        body: 'Suggests which pairs to run first based on funnel stage.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'ads',
    icon: '📣',
    badge: 'Ads',
    cardTitle: 'Meta creative angle generator',
    summary: '10 hooks × 3 formats from one offer doc — ready for testing matrix.',
    order: 2,
  },
  {
    slug: 'google-ads-rsa-expander',
    title: 'Google Ads RSA Expander',
    tagline: 'Headline and description permutations for one keyword theme.',
    about:
      'Builds RSA asset sets constrained to a single keyword theme — no mixed intents — with pinning guidance and character-count validation so uploads pass first review.',
    features: [
      {
        title: 'Theme lock',
        body: 'Keeps every headline aligned to one intent cluster.',
      },
      {
        title: 'Character guard',
        body: 'Flags over-limit assets before export.',
      },
      {
        title: 'Pin suggestions',
        body: 'Recommends H1/H2 pins when brand or offer must show.',
      },
      {
        title: 'Negative prompts',
        body: 'Reminds what not to say for policy-sensitive categories.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'ads',
    icon: '🎯',
    badge: 'Ads',
    cardTitle: 'Google Ads RSA expander',
    summary: 'Headline/description permutations aligned to single keyword theme.',
    order: 3,
  },
  {
    slug: 'landing-page-section-writer',
    title: 'Landing Page Section Writer',
    tagline: 'Hero, proof, offer stack, and FAQ — bilingual for Tamil markets.',
    about:
      'Generates section-by-section copy for high-converting landing pages: hero, social proof, offer stack, objection handling, and FAQ — with optional Tamil parallel blocks for regional campaigns.',
    features: [
      {
        title: 'Section templates',
        body: 'Follows proven LP flow instead of one long blob of text.',
      },
      {
        title: 'Proof placeholders',
        body: 'Marks where logos, numbers, or testimonials must go.',
      },
      {
        title: 'Bilingual blocks',
        body: 'English primary with Tamil companion paragraphs where requested.',
      },
      {
        title: 'CTA consistency',
        body: 'Single primary action repeated with varied microcopy.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'copy',
    icon: '✍️',
    badge: 'Copy',
    cardTitle: 'Landing page section writer',
    summary: 'Hero, proof, offer stack, FAQ — bilingual output for Tamil markets.',
    order: 4,
  },
  {
    slug: 'linkedin-dm-sequence',
    title: 'LinkedIn DM Sequence',
    tagline: 'Two-message sequence after a connection is accepted.',
    about:
      "Generates a 2-message LinkedIn sequence calibrated for the platform's conversational context and character limits — no meeting ask in Message 1, value-based opening, and a natural meeting ask in Message 2.",
    features: [
      {
        title: 'Platform calibration',
        body: 'Respects LinkedIn tone, length, and cultural norms.',
      },
      {
        title: 'No meeting ask in M1',
        body: 'Follows relationship-first sequencing logic.',
      },
      {
        title: '60/80 word limits',
        body: 'Message 1 under 60 words, Message 2 under 80.',
      },
      {
        title: 'Quality gate',
        body: 'Six checks for jargon, flattery, em dashes, and length.',
      },
      {
        title: 'Connection note option',
        body: 'Guidance on whether to include a connection note.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'copy',
    icon: '💼',
    badge: 'Copy',
    cardTitle: 'LinkedIn DM sequence',
    summary: '2-message sequence after a connection — value first, meeting ask second.',
    order: 5,
  },
  {
    slug: 'whatsapp-follow-up-sequences',
    title: 'WhatsApp Follow-Up Sequences',
    tagline: 'Post-lead nurture scripts matched to funnel stage.',
    about:
      'Drafts short WhatsApp messages for confirm, nurture, and re-activation — tuned for how leads actually reply on mobile in India, with Tamil/English/Hindi tone options.',
    features: [
      {
        title: 'Stage-aware',
        body: 'Different scripts for new lead, no-show, and warm replay.',
      },
      {
        title: 'Reply-friendly length',
        body: 'Messages that fit one phone screen without walls of text.',
      },
      {
        title: 'Language toggle',
        body: 'English, Tamil, or Hinglish variants on request.',
      },
      {
        title: 'Compliance nudge',
        body: 'Reminds opt-in context where promos apply.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'copy',
    icon: '💬',
    badge: 'Copy',
    cardTitle: 'WhatsApp follow-up sequences',
    summary: 'Post-lead nurture scripts that match your funnel stage.',
    order: 6,
  },
  {
    slug: 'funnel-wireframe-from-offer',
    title: 'Funnel Wireframe From Offer',
    tagline: 'Map traffic → lead magnet → call → close with measurement points.',
    about:
      'Turns an offer one-pager into a funnel wireframe: traffic sources, lead magnet, email/WhatsApp touches, sales call, and KPIs at each step — ready for workshop or Flagship implementation.',
    features: [
      {
        title: 'Stage diagram',
        body: 'ASCII-friendly flow you can paste into slides.',
      },
      {
        title: 'Metric hooks',
        body: 'Suggests what to track at each transition.',
      },
      {
        title: 'Asset list',
        body: 'LP, ads, emails, and scripts needed per stage.',
      },
      {
        title: 'Gap warnings',
        body: 'Flags missing proof or follow-up if close rate will suffer.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'funnel',
    icon: '🧩',
    badge: 'Funnel',
    cardTitle: 'Funnel wireframe from offer',
    summary: 'Map traffic → lead magnet → call → close with measurement points.',
    order: 7,
  },
  {
    slug: 'workshop-registration-email-kit',
    title: 'Workshop Registration Email Kit',
    tagline: 'Confirm, remind, replay — templates for live workshop funnels.',
    about:
      'Produces a complete email set for live workshops: registration confirm, calendar reminder, day-of join link, no-show replay, and post-workshop offer — with subject line variants.',
    features: [
      {
        title: 'Timing labels',
        body: 'T-7, T-1, T-0, and +1 day send guidance.',
      },
      {
        title: 'Subject variants',
        body: 'Three subjects per email for quick A/B.',
      },
      {
        title: 'Replay CTA',
        body: 'Dedicated no-show path without guilt-heavy copy.',
      },
      {
        title: 'Offer bridge',
        body: 'Soft pitch to Flagship or self-paced course after replay.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'funnel',
    icon: '📊',
    badge: 'Funnel',
    cardTitle: 'Workshop registration email kit',
    summary: 'Confirm, remind, replay — templates for live workshop funnels.',
    order: 8,
  },
  {
    slug: 'weekly-metrics-narrative',
    title: 'Weekly Metrics Narrative',
    tagline: 'Explain CPA, CTR, and cohort shifts in plain language for clients.',
    about:
      'Ingests a weekly metrics dump (CSV paste or bullet list) and writes a client-safe narrative: what moved, likely why, and recommended next tests — without jargon walls.',
    features: [
      {
        title: 'Delta focus',
        body: 'Highlights week-over-week changes that matter.',
      },
      {
        title: 'Hypothesis language',
        body: 'Separates facts from educated guesses.',
      },
      {
        title: 'Action list',
        body: 'Three prioritized next steps for the account.',
      },
      {
        title: 'Client tone',
        body: 'Professional, concise, no blame framing.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'analytics',
    icon: '📈',
    badge: 'Analytics',
    cardTitle: 'Weekly metrics narrative',
    summary: 'Explain CPA, CTR, and cohort shifts in plain language for clients.',
    order: 9,
  },
  {
    slug: 'ai-traffic-content-analyzer',
    title: 'AI Traffic Content Analyzer',
    tagline: 'Score pages for AI overview visibility and extractability.',
    about:
      'Scores URLs or pasted articles for extractability: answer boxes, tables, definitions, and FAQ blocks — aligned with how AI systems cite sources. Pairs with our blog research on AI traffic.',
    features: [
      {
        title: 'Extractability score',
        body: '0–100 with section-level notes.',
      },
      {
        title: 'Answer box prompts',
        body: 'Suggested 40-word summaries per H2.',
      },
      {
        title: 'Format gaps',
        body: 'Calls out missing tables, FAQs, or definitions.',
      },
      {
        title: 'Next publish list',
        body: 'Top three edits to ship this week.',
      },
    ],
    worksWith: 'Claude',
    readiness: 'Ready',
    category: 'analytics',
    icon: '🤖',
    badge: 'AI',
    cardTitle: 'AI traffic content analyzer',
    summary: 'Score pages for AI overview visibility — pairs with our AI traffic blog.',
    order: 10,
  },
]
