import { Router } from 'express'
import { asyncHandler } from '../../middleware/error.js'
import {
  Course,
  Customer,
  Transaction,
  Enrollment,
  FunnelLead,
  Broadcast,
} from '../../models/index.js'

const router = Router()

const inr = (n) => Math.round(n || 0)

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

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
      recentTransactions,
      recentBroadcasts,
    })
  }),
)

export default router
