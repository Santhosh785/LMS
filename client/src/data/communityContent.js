/**
 * Page furniture from community/index.html that has no backing entity in the
 * original site — the featured challenge banner, the huddle countdown card and
 * the leaderboard rail. Kept as data so the components stay presentational.
 */

export const featuredChallenge = {
  label: 'Featured · Day 6 of 7',
  title: '7-Day Ads Sprint Day 6',
  body: 'Ship your retargeting angle today. Drop your creative brief in Challenge Submission and earn Seeds.',
  primaryCta: 'Open challenge',
  secondaryCta: 'Remind me',
}

export const huddle = {
  initials: 'GH',
  title: 'Growth Huddle',
  note: 'Weekly office hours with mentors',
  startsInSeconds: 14 * 60 + 32,
}

export const leaderboardRail = [
  { rank: 1, name: 'Neha Sharma', initials: 'NS', points: 12480 },
  { rank: 2, name: 'Rahul Kapoor', initials: 'RK', points: 9210 },
  { rank: 3, name: 'Ananya Mehta', initials: 'AM', points: 8640 },
  { rank: 4, name: 'Vikram Singh', initials: 'VS', points: 7105 },
  { rank: 5, name: 'Sana Desai', initials: 'SD', points: 6890 },
  { rank: 6, name: 'Jay Patel', initials: 'JR', points: 5420 },
  { rank: 7, name: 'Meera Krishnan', initials: 'MK', points: 4980 },
  { rank: 8, name: 'Aravinth R.', initials: 'AR', points: 4310 },
]
