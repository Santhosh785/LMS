import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { cn, Loading, Panel, StatusPill } from '../../components/ui/index.jsx'
import { ChartSvg, DataTable, KpiRow, PageHead, StatCard } from '../../components/admin/index.jsx'
import { useFeatures, visibleNav } from '../../context/SiteConfigContext.jsx'

const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`

// `feature` marks a card that links into a flagged module — it disappears with
// the module rather than pointing at a route that no longer resolves.
const QUICK_CARDS = [
  {
    icon: '💬',
    title: 'Communities',
    body: 'Channels, feed, peer learning',
    to: '/admin/community',
  },
  {
    icon: '🌱',
    title: 'Gamification',
    body: 'Seeds, badges, leaderboard',
    to: '/admin/gamification/points',
    feature: 'gamification',
  },
  { icon: '👥', title: 'Customers', body: 'Import CSV, enroll students', to: '/admin/customers' },
  { icon: '₹', title: 'Sales', body: 'Transactions & refunds', to: '/admin/transactions' },
  { icon: '🔴', title: 'Live', body: 'Bookings & workshops', to: '/admin/live/calendar' },
  {
    icon: '↘',
    title: 'Funnels',
    body: 'Landing pages & steps',
    to: '/admin/funnels',
    feature: 'funnels',
  },
  { icon: '⚙', title: 'Site', body: 'Branding & platform settings', to: '/admin/settings' },
]

export default function AdminDashboard() {
  const features = useFeatures()

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get('/admin/stats')).data,
  })

  if (isPending) return <Loading />

  const {
    kpis,
    series,
    recentTransactions,
    recentBroadcasts,
    salesBreakdown,
    thisMonth,
    overview,
  } = data

  /** `null` when there is no prior period to compare against — no delta shown. */
  const pct = (v) => (typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v}%` : undefined)

  return (
    <>
      <PageHead title="Dashboard" sub="Revenue, learners and pipeline at a glance." />

      <KpiRow>
        <StatCard label="Total revenue" value={inr(kpis.revenue)} sub="All successful payments" />
        {/*
          The deltas here used to be the literals "+32%", "+18%" and "+19%",
          carried over from the static mock. Only the revenue one can actually
          be computed — month against previous month — so the other two are
          gone rather than left reading as measured.
        */}
        <StatCard
          label="This month"
          value={inr(thisMonth?.revenue ?? kpis.monthRevenue)}
          sub={`${thisMonth?.payments ?? 0} payments`}
          delta={pct(thisMonth?.deltaPct)}
        />
        <StatCard label="Customers" value={kpis.customers} sub="Students & buyers" />
        <StatCard
          label="Enrollments"
          value={kpis.enrollments}
          sub={`${kpis.courses} courses · ${kpis.published} published`}
        />
      </KpiRow>

      <div className="mb-6 grid grid-cols-[1.4fr_0.8fr] gap-5 mx-1100:grid-cols-1">
        <Panel title="Revenue overview">
          <ChartSvg series={series} />
        </Panel>

        <Panel title="Pipeline">
          <div className="grid gap-3">
            {[
              // Funnel leads only exist in seed data while the funnels module
              // has no public pages to capture them, so the row travels with it.
              features.funnels && { key: 'L', value: kpis.leads, label: 'Funnel leads captured' },
              { key: 'E', value: kpis.enrollments, label: 'Course enrollments' },
              { key: 'C', value: kpis.customers, label: 'Paying customers' },
              { key: 'P', value: kpis.published, label: 'Published courses' },
            ]
              .filter(Boolean)
              .map((row) => (
                <div key={row.key} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.8rem] font-bold text-brand">
                    {row.key}
                  </span>
                  <div>
                    <strong className="text-[1.05rem] text-brand-deep">{row.value}</strong>
                    <p className="text-[0.78rem] text-muted-admin">{row.label}</p>
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      </div>

      {/*
        Two panels the 2026 redesign added. The drop's Overview also led with a
        visitor count; nothing here measures traffic, so that tile is omitted
        rather than invented.
      */}
      <div className="mb-6 grid grid-cols-2 gap-5 mx-960:grid-cols-1">
        <Panel title="Sales breakdown">
          <p className="text-[1.6rem] font-bold leading-none text-brand-deep">
            {inr(salesBreakdown?.total)}
          </p>
          <ul className="mt-4 grid gap-2">
            {[
              ['One-time', salesBreakdown?.oneTime, 'bg-brand'],
              ['Subscriptions', salesBreakdown?.subscription, 'bg-accent'],
            ].map(([label, value, dot]) => (
              <li key={label} className="flex items-center justify-between text-[0.88rem]">
                <span className="flex items-center gap-2 text-muted-admin">
                  <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
                  {label}
                </span>
                <span className="font-semibold text-ink">{inr(value)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Overview">
          <div className="grid gap-3">
            {[
              {
                key: 'L',
                value: overview?.leads ?? 0,
                label:
                  overview?.leadConversionPct !== null && overview?.leadConversionPct !== undefined
                    ? `Leads · ${overview.leadConversionPct}% converted`
                    : 'Leads captured',
              },
              {
                key: 'S',
                value: overview?.signups ?? 0,
                label: `Site signups${
                  overview?.signupsDeltaPct !== null && overview?.signupsDeltaPct !== undefined
                    ? ` · ${pct(overview.signupsDeltaPct)} this month`
                    : ''
                }`,
              },
            ].map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md2 bg-surface-mist text-[0.85rem] font-bold text-brand">
                  {s.key}
                </span>
                <div>
                  <strong className="block text-[1.05rem] leading-none text-brand-deep">
                    {s.value}
                  </strong>
                  <span className="text-[0.78rem] text-muted-admin">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Recent orders keeps the full width once the broadcast panel is hidden. */}
      <div
        className={cn(
          'mb-6 grid gap-5 mx-1100:grid-cols-1',
          features.email ? 'grid-cols-[1.4fr_0.8fr]' : 'grid-cols-1',
        )}
      >
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[1.05rem]">Recent orders</h2>
            <Link
              to="/admin/transactions"
              className="text-[0.82rem] font-semibold text-brand hover:underline"
            >
              View all
            </Link>
          </div>
          <DataTable
            searchable={false}
            pageSize={6}
            rows={recentTransactions}
            columns={[
              { key: 'customerName', label: 'Student' },
              { key: 'product', label: 'Product' },
              { key: 'amount', label: 'Price', render: (r) => inr(r.amount) },
              { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
              {
                key: 'date',
                label: 'Date',
                render: (r) =>
                  new Date(r.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }),
              },
            ]}
          />
        </div>

        {/* Broadcasts report delivery for mail that was never sent — hidden with the module. */}
        {features.email && (
          <Panel title="Recent broadcasts">
            <div className="grid gap-3">
              {recentBroadcasts.length === 0 ? (
                <p className="text-[0.85rem] text-muted-admin">Nothing sent yet.</p>
              ) : (
                recentBroadcasts.map((b) => (
                  <div
                    key={b._id}
                    className="border-b border-line-admin pb-3 last:border-0 last:pb-0"
                  >
                    <h4 className="text-[0.9rem]">{b.subject}</h4>
                    <p className="mt-0.5 text-[0.75rem] text-muted-admin">
                      Sent on{' '}
                      {new Date(b.sentAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    <p className="mt-1 flex gap-3 text-[0.75rem] text-muted-admin">
                      <span>D {b.stats?.delivered}</span>
                      <span>O {b.stats?.opened}</span>
                      <span>C {b.stats?.clicked}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        )}
      </div>

      <h2 className="mb-3 text-[1.05rem]">Jump to</h2>
      <div className="grid grid-cols-4 gap-4 mx-1100:grid-cols-2 mx-640:grid-cols-1">
        {visibleNav(QUICK_CARDS, features).map((c) => (
          <Link
            key={c.title}
            to={c.to}
            className="rounded-lg2 border border-line-admin bg-white p-5 shadow-admin transition-transform duration-200 ease-gs hover:-translate-y-1"
          >
            <span className="text-[1.3rem]" aria-hidden="true">
              {c.icon}
            </span>
            <h3 className="mt-2 text-[1rem]">{c.title}</h3>
            <p className="mt-1 text-[0.82rem] text-muted-admin">{c.body}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
