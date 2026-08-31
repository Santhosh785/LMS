/** Transcribed from community/index.html — same groups, channels and order. */
export const channels = [
  { name: 'Inner Circle', slug: 'inner-circle', group: 'Yoda Class Cohort', order: 0 },
  { name: 'Introductions', slug: 'introductions', group: 'Yoda Class Cohort', order: 1 },

  { name: 'Intros', slug: 'intros', group: 'Growth Scholar Hub', order: 0 },
  { name: 'Announcements', slug: 'announcements', group: 'Growth Scholar Hub', order: 1 },
  { name: 'Wins', slug: 'wins', group: 'Growth Scholar Hub', order: 2 },
  { name: 'Peer Learning', slug: 'peer-learning', group: 'Growth Scholar Hub', order: 3 },
  {
    name: 'Challenge Submission',
    slug: 'challenge-submission',
    group: 'Growth Scholar Hub',
    order: 4,
  },

  { name: 'SEO Circle', slug: 'seo-circle', group: 'Group Chats', order: 0 },
  { name: 'Ads Lab', slug: 'ads-lab', group: 'Group Chats', order: 1 },
]

/** authorEmail is resolved to a real user at seed time. */
export const posts = [
  {
    channelSlug: 'announcements',
    authorEmail: 'team@growthscholar.in',
    body: 'Welcome to the new Community Hub. Introduce yourself in Intros, share wins, and earn Seeds for helpful replies.',
    pinned: true,
    likeCount: 24,
    commentCount: 6,
    minutesAgo: 90,
  },
  {
    channelSlug: 'wins',
    authorEmail: 'priya@email.com',
    body: 'Closed my first client retainership after the Ads Sprint — ₹45k/mo. Seeds well spent on peer feedback 🙌',
    likeCount: 41,
    commentCount: 12,
    minutesAgo: 170,
  },
  {
    channelSlug: 'challenge-submission',
    authorEmail: 'gokul@email.com',
    body: 'Day 6 retargeting angle: “you left the audit half-finished”. Testing static vs 9s UGC on the same hook. Brief in the thread.',
    likeCount: 18,
    commentCount: 4,
    minutesAgo: 260,
  },
  {
    channelSlug: 'peer-learning',
    authorEmail: 'anish@email.com',
    body: 'Anyone else seeing CPM drop after switching to broad + strong creative? Third week in a row for me.',
    likeCount: 12,
    commentCount: 9,
    minutesAgo: 400,
  },
  {
    channelSlug: 'intros',
    authorEmail: 'sowndarya@email.com',
    body: 'Hi all — Sowndarya from Chidambaram. Doing SEO Mastery in Tamil, currently on Module 3. Happy to swap keyword maps.',
    likeCount: 31,
    commentCount: 15,
    minutesAgo: 1400,
  },
]

/** The "Featured challenge" card in the centre column. */
export const featuredChallenge = {
  label: 'Featured · Day 6 of 7',
  title: '7-Day Ads Sprint Day 6',
  body: 'Ship your retargeting angle today. Drop your creative brief in Challenge Submission and earn Seeds.',
  primaryCta: 'Open challenge',
  secondaryCta: 'Remind me',
  day: 6,
  totalDays: 7,
}

/** The "Live soon" huddle card. */
export const huddle = {
  initials: 'GH',
  title: 'Growth Huddle',
  note: 'Weekly office hours with mentors',
  startsInSeconds: 14 * 60 + 32,
}

/** Community leaderboard rail (community/index.html). */
export const communityLeaderboard = [
  { rank: 1, name: 'Neha Sharma', initials: 'NS', points: 12480 },
  { rank: 2, name: 'Rahul Kapoor', initials: 'RK', points: 9210 },
  { rank: 3, name: 'Ananya Mehta', initials: 'AM', points: 8640 },
  { rank: 4, name: 'Vikram Singh', initials: 'VS', points: 7105 },
  { rank: 5, name: 'Sana Desai', initials: 'SD', points: 6890 },
  { rank: 6, name: 'Jay Patel', initials: 'JR', points: 5420 },
  { rank: 7, name: 'Meera Krishnan', initials: 'MK', points: 4980 },
  { rank: 8, name: 'Aravinth R.', initials: 'AR', points: 4310 },
]
