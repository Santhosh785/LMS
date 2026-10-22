import { Router } from 'express'
import { asyncHandler } from '../../middleware/error.js'
import { and, count, desc, eq, gte, lt, sql, sum } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import {
  broadcasts,
  courses,
  customers,
  enrollments,
  funnelLeads,
  leads,
  transactions,
  users,
} from '../../db/schema/index.js'
import { txnDoc } from '../../db/repos/transactions.js'

const router = Router()

const inr = (n) => Math.round(n || 0)

const tally = async (table, where) => {
  const [{ n }] = await db.select({ n: count() }).from(table).where(where)
  return n
}

const paid = eq(transactions.status, 'SUCCESS')

/** Sum of SUCCESS amounts matching `where` — Mongo's $group/$sum. */
const revenue = async (where) => {
  const [{ total }] = await db
    .select({ total: sum(transactions.amount).mapWith(Number) })
    .from(transactions)
    .where(and(paid, where))
  return total || 0
}

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
      totalRevenue,
      monthRevenueTotal,
      recentTransactions,
      recentBroadcasts,
    ] = await Promise.all([
      tally(courses),
      tally(courses, eq(courses.status, 'Published')),
      tally(customers),
      tally(enrollments),
      tally(funnelLeads),
      revenue(),
      revenue(gte(transactions.date, monthStart)),
      db.select().from(transactions).orderBy(desc(transactions.date)).limit(6),
      db
        .select()
        .from(broadcasts)
        .where(eq(broadcasts.status, 'sent'))
        .orderBy(desc(broadcasts.sentAt))
        .limit(4),
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
      breakdownRows,
      monthPayments,
      prevRevenueTotal,
      convertedLeads,
      signupsThisMonth,
      signupsPrevMonth,
      userCount,
    ] = await Promise.all([
      db
        .select({ cycle: transactions.cycle, total: sum(transactions.amount).mapWith(Number) })
        .from(transactions)
        .where(paid)
        .groupBy(transactions.cycle),
      tally(transactions, and(paid, gte(transactions.date, monthStart))),
      revenue(and(gte(transactions.date, prevMonthStart), lt(transactions.date, monthStart))),
      tally(leads, eq(leads.status, 'Converted')),
      tally(users, gte(users.createdAt, monthStart)),
      tally(users, and(gte(users.createdAt, prevMonthStart), lt(users.createdAt, monthStart))),
      tally(users),
    ])

    const mentorLeads = await tally(leads)
    const byCycle = Object.fromEntries(breakdownRows.map((r) => [r.cycle || 'ONETIME', r.total]))
    const monthRevenue = inr(monthRevenueTotal)
    const prevRevenue = inr(prevRevenueTotal)

    /** Percent change, or null when there is no prior figure to compare to. */
    const delta = (current, previous) =>
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : null

    // 12-month revenue series for the hand-drawn SVG chart on the dashboard.
    // Months in UTC, as Mongo's $year/$month bucketed them.
    const month = sql`date_trunc('month', ${transactions.date} at time zone 'UTC')`
    const seriesRows = await db
      .select({
        y: sql`extract(year from ${month})`.mapWith(Number),
        m: sql`extract(month from ${month})`.mapWith(Number),
        total: sum(transactions.amount).mapWith(Number),
      })
      .from(transactions)
      .where(paid)
      .groupBy(month)
      .orderBy(month)
      .limit(12)

    res.json({
      kpis: {
        revenue: inr(totalRevenue),
        monthRevenue: inr(monthRevenueTotal),
        customers: customerCount,
        enrollments: enrollmentCount,
        courses: courseCount,
        published: publishedCount,
        leads: leadCount,
      },
      series: seriesRows.map((s) => ({
        label: `${String(s.m).padStart(2, '0')}/${s.y}`,
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
        leadConversionPct:
          mentorLeads > 0 ? Math.round((convertedLeads / mentorLeads) * 100) : null,
        signups: userCount,
        signupsDeltaPct: delta(signupsThisMonth, signupsPrevMonth),
      },
      recentTransactions: recentTransactions.map(txnDoc),
      recentBroadcasts: withMongoId(recentBroadcasts),
    })
  }),
)

export default router
