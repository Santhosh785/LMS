/** Transcribed from the admin tables — same rows, amounts and statuses. */

export const customers = [
  {
    name: 'Sowndarya',
    email: 'sowndarya@email.com',
    product: 'SEO Mastery',
    joinedAt: new Date('2026-08-07'),
    status: 'Active',
  },
  {
    name: 'Thiyagarajan',
    email: 'thiyagu@email.com',
    product: 'Complete Growth Marketing',
    joinedAt: new Date('2026-08-06'),
    status: 'Active',
  },
  {
    name: 'Anishmon A',
    email: 'anish@email.com',
    product: 'Meta Ads Foundations',
    joinedAt: new Date('2026-08-05'),
    status: 'Active',
  },
  {
    name: 'Gokul',
    email: 'gokul@email.com',
    product: 'Ads Power Combo',
    joinedAt: new Date('2026-08-04'),
    status: 'Active',
  },
  {
    name: 'Priya M',
    email: 'priya@email.com',
    product: 'Free Starter',
    joinedAt: new Date('2026-08-02'),
    status: 'Trial',
  },
]

export const transactions = [
  {
    date: new Date('2026-08-07'),
    customerName: 'Sowndarya',
    amount: 2499,
    contact: 'sowndarya@email.com',
    product: 'SEO Mastery',
    quantity: 1,
    cycle: 'ONETIME',
    status: 'SUCCESS',
    invoiceNo: 'GS-2026-0141',
  },
  {
    date: new Date('2026-08-06'),
    customerName: 'Thiyagarajan',
    amount: 49999,
    contact: 'thiyagu@email.com',
    product: 'Complete Growth Marketing',
    quantity: 1,
    cycle: 'ONETIME',
    status: 'SUCCESS',
    invoiceNo: 'GS-2026-0140',
  },
  {
    date: new Date('2026-08-05'),
    customerName: 'Anishmon A',
    amount: 2999,
    contact: 'anish@email.com',
    product: 'Meta Ads Foundations',
    quantity: 1,
    cycle: 'ONETIME',
    status: 'SUCCESS',
    invoiceNo: 'GS-2026-0139',
  },
  {
    date: new Date('2026-08-04'),
    customerName: 'Gokul',
    amount: 4999,
    contact: 'gokul@email.com',
    product: 'Ads Power Combo',
    quantity: 1,
    cycle: 'ONETIME',
    status: 'SUCCESS',
    invoiceNo: 'GS-2026-0138',
  },
  {
    date: new Date('2026-08-03'),
    customerName: 'Kavya R',
    amount: 1999,
    contact: 'kavya@email.com',
    product: 'Social Advertising',
    quantity: 1,
    cycle: 'SUBSCRIPTION',
    status: 'SUCCESS',
    invoiceNo: 'GS-2026-0137',
  },
  {
    date: new Date('2026-08-02'),
    customerName: 'Ravi K',
    amount: 2499,
    contact: 'ravi@email.com',
    product: 'PPC Essentials',
    quantity: 1,
    cycle: 'ONETIME',
    status: 'SUCCESS',
    invoiceNo: 'GS-2026-0136',
  },
]

/** Dashboard cards on admin/index.html — kept so the KPI row matches the original. */
export const dashboardCards = [
  { label: 'Today so far', value: '₹ 42,480', sub: '3 payments', delta: '+24%' },
  { label: 'Yesterday', value: '₹ 1,18,200', sub: '8 payments', delta: '+18%' },
  { label: 'Last 7 Days', value: '₹ 5,62,900', sub: '42 payments', delta: '-8%' },
  { label: 'This Month', value: '₹ 18,45,600', sub: '133 payments', delta: '+32%' },
]

export const overviewCards = [
  { key: 'V', value: '1,286', label: 'Visitors · +28% vs last month' },
  { key: 'L', value: '412', label: 'Leads · 32% conversion' },
  { key: 'S', value: '155', label: 'Site Signups · +15%' },
  { key: 'E', value: '78', label: 'Course Enrollments · +19%' },
]

export const salesBreakdown = {
  total: '₹ 18,45,600',
  rows: [
    { label: 'One-Time', value: '₹ 11,20,400' },
    { label: 'Subscriptions', value: '₹ 5,48,200' },
    { label: 'Others', value: '₹ 1,77,000' },
  ],
}

export const funnels = [
  {
    name: 'Growth Marketer Lead Magnet',
    slug: 'lead-magnet',
    template: 'Lead Magnet',
    status: 'Live',
    leadCount: 18,
    domain: 'growthscholar.in',
    steps: [
      {
        name: 'Optin Page',
        order: 0,
        url: 'growthscholar.in/f/lead-magnet',
        uniqueVisitors: 72,
        totalViews: 123,
        conversionPct: 41.67,
      },
      {
        name: 'Thank You Page',
        order: 1,
        url: 'growthscholar.in/f/lead-magnet/thanks',
        uniqueVisitors: 30,
        totalViews: 38,
        conversionPct: 0,
      },
    ],
    automationRules: [
      { trigger: 'On optin', action: 'Send email sequence', delay: 'Immediate', enabled: true },
      { trigger: 'On purchase', action: 'Add tag', delay: 'Immediate', enabled: true },
    ],
  },
  {
    name: 'SEO Free Trial Funnel',
    slug: 'seo-free-trial',
    template: 'Video Series',
    status: 'Live',
    leadCount: 423,
    domain: 'growthscholar.in',
    steps: [
      {
        name: 'Video 1 — Why SEO compounds',
        order: 0,
        url: 'growthscholar.in/f/seo/v1',
        uniqueVisitors: 980,
        totalViews: 1420,
        conversionPct: 38.2,
      },
      {
        name: 'Video 2 — Keyword systems',
        order: 1,
        url: 'growthscholar.in/f/seo/v2',
        uniqueVisitors: 374,
        totalViews: 512,
        conversionPct: 29.4,
      },
      {
        name: 'Offer Page',
        order: 2,
        url: 'growthscholar.in/f/seo/offer',
        uniqueVisitors: 110,
        totalViews: 148,
        conversionPct: 12.7,
      },
    ],
  },
]

export const funnelLeads = [
  {
    name: 'Priya S',
    email: 'priya@email.com',
    phone: '+91 98•••21',
    sourceStep: 'Optin',
    date: new Date('2026-08-07'),
    status: 'New',
  },
  {
    name: 'Rahul M',
    email: 'rahul@email.com',
    phone: '+91 90•••44',
    sourceStep: 'Optin',
    date: new Date('2026-08-06'),
    status: 'Nurture',
  },
  {
    name: 'Ananya I',
    email: 'ananya@email.com',
    phone: '+91 97•••11',
    sourceStep: 'Offer',
    date: new Date('2026-08-05'),
    status: 'Purchased',
  },
  {
    name: 'Vikram M',
    email: 'vikram@email.com',
    phone: '+91 96•••88',
    sourceStep: 'Optin',
    date: new Date('2026-08-04'),
    status: 'Unsubscribed',
  },
]

export const emailLists = [
  { name: 'All learners', contactCount: 1248 },
  { name: 'SEO Mastery buyers', contactCount: 248 },
  { name: 'Workshop registrants', contactCount: 612 },
  { name: 'CGM Cohort Aug', contactCount: 86 },
  { name: 'Newsletter', contactCount: 3420 },
]

export const emailContacts = [
  {
    name: 'Priya Sharma',
    email: 'priya@email.com',
    lists: ['All learners', 'SEO Mastery buyers'],
    status: 'Subscribed',
    joinedAt: new Date('2026-01-12'),
  },
  {
    name: 'Rahul Menon',
    email: 'rahul@email.com',
    lists: ['Newsletter'],
    status: 'Subscribed',
    joinedAt: new Date('2026-03-03'),
  },
  {
    name: 'Ananya Iyer',
    email: 'ananya@email.com',
    lists: ['Workshop registrants'],
    status: 'Subscribed',
    joinedAt: new Date('2026-07-18'),
  },
  {
    name: 'Karthik S',
    email: 'karthik@email.com',
    lists: ['All learners'],
    status: 'Unsubscribed',
    joinedAt: new Date('2026-02-02'),
  },
]

export const broadcasts = [
  {
    subject: 'Growth Scholar Newsletter — Aug 2026',
    sendToListName: 'Newsletter',
    status: 'sent',
    sentAt: new Date('2026-08-04T09:30:00Z'),
    stats: { delivered: 2100, opened: 840, clicked: 12 },
    body: 'This month: the SEO vs SEM guide, a new Tamil workshop, and Demo Day highlights.',
  },
  {
    subject: 'SEO Mastery — Launch Sequence #3',
    sendToListName: 'SEO Mastery buyers',
    status: 'sent',
    sentAt: new Date('2026-07-28T04:30:00Z'),
    stats: { delivered: 1400, opened: 510, clicked: 9 },
    body: 'Module 3 is where most learners stall. Here is the on-page checklist that unblocks it.',
  },
  {
    subject: 'Complete Growth Marketing — Cohort Reminder',
    sendToListName: 'CGM Cohort Aug',
    status: 'sent',
    sentAt: new Date('2026-07-20T12:30:00Z'),
    stats: { delivered: 980, opened: 410, clicked: 18 },
    body: 'Cohort starts Monday. Onboarding kit, community invite and pre-work inside.',
  },
]

export const liveBookings = [
  {
    topic: '1:1 Growth Mentorship Call',
    type: 'Single Session',
    when: new Date('2026-08-12T11:30:00Z'),
    timeZone: 'Asia/Kolkata',
    maxRegistrants: 1,
    duration: '30 Minutes',
    theme: 'Brand Green',
    description: 'Map your next skill path with a growth mentor.',
    bookedCount: 1,
  },
  {
    topic: 'Portfolio Review — Weekly',
    type: 'Recurring Session',
    when: new Date('2026-08-14T13:00:00Z'),
    timeZone: 'Asia/Kolkata',
    maxRegistrants: 6,
    duration: '45 Minutes',
    theme: 'Ocean',
    description: 'Bring a case study, leave with edits.',
    bookedCount: 4,
  },
]

export const liveClasses = [
  {
    title: 'SEO Mastery Live Workshop',
    startsAt: new Date('2026-08-14T13:30:00Z'),
    durationMins: 180,
    host: 'Aravinth R.',
    kind: 'Workshop',
    joinUrl: 'https://zoom.us/j/000000001',
  },
  {
    title: 'Yoda Class — Funnel Lab',
    startsAt: new Date('2026-08-18T14:30:00Z'),
    durationMins: 90,
    host: 'Vikram M.',
    kind: 'Cohort live',
    joinUrl: 'https://zoom.us/j/000000002',
  },
  {
    title: 'Meta Ads Creative Clinic',
    startsAt: new Date('2026-08-09T13:30:00Z'),
    durationMins: 60,
    host: 'Sneha K.',
    kind: 'Live',
    joinUrl: 'https://zoom.us/j/000000003',
  },
  {
    title: 'SEO Content Sprints',
    startsAt: new Date('2026-08-12T13:00:00Z'),
    durationMins: 45,
    host: 'Aravinth R.',
    kind: 'Live',
    joinUrl: 'https://zoom.us/j/000000004',
  },
  {
    title: 'Landing Page Teardown',
    startsAt: new Date('2026-08-15T14:30:00Z'),
    durationMins: 75,
    host: 'Priya D.',
    kind: 'Live',
    joinUrl: 'https://zoom.us/j/000000005',
  },
  {
    title: 'Email Flows that Convert',
    startsAt: new Date('2026-08-18T13:30:00Z'),
    durationMins: 60,
    host: 'Growth Scholar',
    kind: 'Live',
    joinUrl: 'https://zoom.us/j/000000006',
  },
]

export const practiceItems = [
  {
    title: 'Keyword intent sorting drill',
    type: 'Drill',
    difficulty: 'Beginner',
    questionCount: 15,
    minutes: 12,
    description: 'Sort 15 queries into informational, commercial and transactional.',
  },
  {
    title: 'Meta Ads creative teardown',
    type: 'Challenge',
    difficulty: 'Intermediate',
    questionCount: 8,
    minutes: 20,
    description: 'Diagnose why four ads underperformed and propose the next test.',
  },
  {
    title: 'Landing page copy rewrite',
    type: 'Assignment',
    difficulty: 'Intermediate',
    questionCount: 5,
    minutes: 30,
    description: 'Rewrite a cold-traffic hero section using the hook–promise–proof order.',
  },
  {
    title: 'Funnel metrics quiz',
    type: 'Quiz',
    difficulty: 'Beginner',
    questionCount: 12,
    minutes: 10,
    description: 'CPA, CVR, AOV, LTV — read the dashboard and answer.',
  },
]
