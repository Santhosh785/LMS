import { Router } from 'express'
import { asyncHandler } from '../../middleware/error.js'
import {
  Course,
  Customer,
  Transaction,
  Enrollment,
  FunnelLead,
  Broadcast,
  Lead,
  User,
} from '../../models/index.js'

const router = Router()

const inr = (n) => Math.round(n || 0)

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [
      courseCount,
      publishedCount,
      customerCount,
      enrollmentCount,
      leadCount,
      revenueAgg,
      monthRevenueAgg,
      recentTransactions,
      recentBroadcasts,
    ] = await Promise.all([
      Course.countDocuments(),
      Course.countDocuments({ status: 'Published' }),
      Customer.countDocuments(),
      Enrollment.countDocuments(),
      FunnelLead.countDocuments(),
      Transaction.aggregate([
        { $match: { status: 'SUCCESS' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { status: 'SUCCESS', date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.find().sort({ date: -1 }).limit(6).lean(),
      Broadcast.find({ status: 'sent' }).sort({ sentAt: -1 }).limit(4).lean(),
    ])

    /**
     * The panels the 2026 redesign added to this dashboard.
     *
     * The drop's Overview panel led with "1,286 Visitors · +28%". Nothing in
     * this application counts visitors — there is no analytics integration —
     * so that tile is left out rather than filled with a number that would
     * read as measured. Leads and signups are real counts and are kept.
     */
    const [
      breakdownAgg,
      monthPayments,
      prevMonthAgg,
      convertedLeads,
      signupsThisMonth,
      signupsPrevMonth,
      userCount,
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { status: 'SUCCESS' } },
        { $group: { _id: '$cycle', total: { $sum: '$amount' } } },
      ]),
      Transaction.countDocuments({ status: 'SUCCESS', date: { $gte: monthStart } }),
      Transaction.aggregate([
        { $match: { status: 'SUCCESS', date: { $gte: prevMonthStart, $lt: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Lead.countDocuments({ status: 'Converted' }),
      User.countDocuments({ createdAt: { $gte: monthStart } }),
      User.countDocuments({ createdAt: { $gte: prevMonthStart, $lt: monthStart } }),
      User.countDocuments(),
    ])

    const mentorLeads = await Lead.countDocuments()
    const byCycle = Object.fromEntries(breakdownAgg.map((r) => [r._id || 'ONETIME', r.total]))
    const monthRevenue = inr(monthRevenueAgg[0]?.total)
    const prevRevenue = inr(prevMonthAgg[0]?.total)

    /** Percent change, or null when there is no prior figure to compare to. */
    const delta = (current, previous) =>
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : null

    // 12-month revenue series for the hand-drawn SVG chart on the dashboard
    const seriesAgg = await Transaction.aggregate([
      { $match: { status: 'SUCCESS' } },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' } },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
      { $limit: 12 },
    ])

    res.json({
      kpis: {
        revenue: inr(revenueAgg[0]?.total),
        monthRevenue: inr(monthRevenueAgg[0]?.total),
        customers: customerCount,
        enrollments: enrollmentCount,
        courses: courseCount,
        published: publishedCount,
        leads: leadCount,
      },
      series: seriesAgg.map((s) => ({
        label: `${String(s._id.m).padStart(2, '0')}/${s._id.y}`,
        value: inr(s.total),
      })),
      salesBreakdown: {
        total: inr(byCycle.ONETIME) + inr(byCycle.SUBSCRIPTION),
        oneTime: inr(byCycle.ONETIME),
        subscription: inr(byCycle.SUBSCRIPTION),
      },
      thisMonth: {
        revenue: monthRevenue,
        payments: monthPayments,
        deltaPct: delta(monthRevenue, prevRevenue),
      },
      overview: {
        leads: mentorLeads,
        leadConversionPct: mentorLeads > 0 ? Math.round((convertedLeads / mentorLeads) * 100) : null,
        signups: userCount,
        signupsDeltaPct: delta(signupsThisMonth, signupsPrevMonth),
      },
      recentTransactions,
      recentBroadcasts,
    })
  }),
)

export default router
