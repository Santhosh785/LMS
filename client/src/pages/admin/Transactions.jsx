import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { useAdminMutation, downloadCsv } from '../../api/admin.js'
import { Button, Modal, StatusPill, TextField, useToast } from '../../components/ui/index.jsx'
import { DataTable, KpiRow, PageHead, StatCard } from '../../components/admin/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const fmt = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/**
 * The reconciliation screen. It gets checked several times a day while manual
 * UPI is the sales channel, so pending payments sort to the top and every field
 * needed to match a claim against a bank statement — UTR, amount, contact,
 * course — is on the row rather than behind a click.
 */
export default function AdminTransactions() {
  useDocumentTitle('Transactions — Growth Scholar Admin')
  const toast = useToast()
  const [rejecting, setRejecting] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [refunding, setRefunding] = useState(null)

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'transactions', 'queue'],
    queryFn: async () => (await api.get('/admin/transactions/queue')).data,
  })

  const approve = useAdminMutation('transactions', {
    method: 'post',
    path: (p) => `${p.id}/approve`,
    onDone: (res) => {
      setConfirming(null)
      toast.show(res.message || 'Approved ✓')
    },
  })

  const reject = useAdminMutation('transactions', {
    method: 'post',
    path: (p) => `${p.id}/reject`,
    onDone: (res) => {
      setRejecting(null)
      toast.show(res.message || 'Marked as failed')
    },
  })

  const refund = useAdminMutation('transactions', {
    method: 'post',
    path: (p) => `${p.id}/refund`,
    onDone: (res) => {
      setRefunding(null)
      toast.show(res.message || 'Refunded ✓')
    },
  })

  const rows = data?.items || []
  const pendingCount = data?.pendingCount || 0
  const total = rows.filter((r) => r.status === 'SUCCESS').reduce((s, r) => s + r.amount, 0)
  const pendingValue = rows.filter((r) => r.status === 'PENDING').reduce((s, r) => s + r.amount, 0)
  const refunded = rows.reduce((s, r) => s + (r.refundedAmount || 0), 0)

  return (
    <>
      {toast.node}
      <PageHead
        title="Sales"
        sub="Payments awaiting verification, and settled transactions"
        actions={
          <Button
            variant="outline"
            onClick={() => downloadCsv('transactions/export', 'transactions.csv')}
          >
            Export
          </Button>
        }
      />

      <KpiRow cols={3}>
        <StatCard
          label="Awaiting verification"
          value={String(pendingCount)}
          sub={
            pendingCount
              ? `${inr(pendingValue)} claimed — check the bank statement`
              : 'Queue is clear'
          }
        />
        <StatCard
          label="Total earnings"
          value={inr(total)}
          sub={`${rows.length} transactions shown`}
        />
        <StatCard label="Refunded" value={inr(refunded)} sub="Across all transactions" />
      </KpiRow>

      <DataTable
        loading={isPending}
        rows={rows}
        pageSize={15}
        searchPlaceholder="Search by customer, contact, product or UTR…"
        empty="No transactions yet."
        columns={[
          { key: 'date', label: 'Date', value: (r) => r.date, render: (r) => fmt(r.date) },
          {
            key: 'customerName',
            label: 'Buyer',
            render: (r) => (
              <div>
                <div className="font-medium text-ink">{r.customerName || r.buyer?.name || '—'}</div>
                <div className="text-[0.75rem] text-muted-admin">{r.contact || r.buyer?.email}</div>
                {r.buyer?.phone && (
                  <div className="text-[0.75rem] text-muted-admin">{r.buyer.phone}</div>
                )}
              </div>
            ),
          },
          { key: 'product', label: 'Course', render: (r) => r.product || r.courseSlug || '—' },
          { key: 'amount', label: 'Amount', value: (r) => r.amount, render: (r) => inr(r.amount) },
          {
            key: 'utr',
            label: 'UPI ref (UTR)',
            render: (r) =>
              r.utr ? (
                <span className="font-mono text-[0.78rem] text-ink">{r.utr}</span>
              ) : (
                <span className="text-[0.78rem] text-muted-admin">—</span>
              ),
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => (
              <div>
                <StatusPill status={r.status} />
                {r.status === 'FAILED' && r.failureReason && (
                  <div className="mt-1 max-w-[16rem] text-[0.72rem] text-muted-admin">
                    {r.failureReason}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (r) =>
              r.status === 'PENDING' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(r)}
                    className="text-[0.8rem] font-semibold text-brand hover:underline"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(r)}
                    className="text-[0.8rem] font-semibold text-muted-admin hover:text-danger-admin hover:underline"
                  >
                    Reject
                  </button>
                </div>
              ) : r.status === 'REFUNDED' ? (
                <span className="text-[0.8rem] text-muted-admin">Refunded</span>
              ) : r.status === 'SUCCESS' && r.razorpayPaymentId ? (
                /* Live only for gateway payments: the server calls Razorpay
                   first and records only what the gateway confirms. */
                <button
                  type="button"
                  onClick={() => setRefunding(r)}
                  className="text-[0.8rem] font-semibold text-danger-admin hover:underline"
                >
                  Refund
                </button>
              ) : r.status === 'SUCCESS' ? (
                /*
                 * Manual UPI money never went through Razorpay, so there is no
                 * API to call. Writing `refundedAmount` here — which is all this
                 * button ever did — would mark a customer refunded while their
                 * cash stayed in the account.
                 */
                <button
                  type="button"
                  disabled
                  title="Paid by manual UPI — send the money back from your UPI app or bank, not from here"
                  className="cursor-not-allowed text-[0.8rem] font-semibold text-muted-admin/60"
                >
                  Refund
                </button>
              ) : null,
          },
        ]}
      />

      {/* ------------------------------ approve ----------------------------- */}
      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="Approve this payment?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              disabled={approve.isPending}
              onClick={() =>
                approve.mutate(
                  { id: confirming._id },
                  { onError: (err) => toast.show(apiError(err)) },
                )
              }
            >
              {approve.isPending ? 'Approving…' : 'Approve and grant access'}
            </Button>
          </>
        }
      >
        <p className="text-[0.9rem] leading-relaxed text-muted-admin">
          Confirm <strong className="text-ink">{inr(confirming?.amount)}</strong> from{' '}
          <strong className="text-ink">{confirming?.customerName}</strong> actually landed in the
          bank account, matching UTR{' '}
          <strong className="font-mono text-ink">{confirming?.utr}</strong>.
        </p>
        <p className="mt-3 text-[0.85rem] text-muted-admin">
          Approving opens <strong className="text-ink">{confirming?.product}</strong>, creates the
          buyer&rsquo;s account if they do not have one, and emails them.
        </p>
      </Modal>

      {/* ------------------------------- reject ----------------------------- */}
      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject this payment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button form="reject-form" type="submit" variant="danger" disabled={reject.isPending}>
              {reject.isPending ? 'Saving…' : 'Mark as failed'}
            </Button>
          </>
        }
      >
        <form
          id="reject-form"
          onSubmit={(e) => {
            e.preventDefault()
            const reason = new FormData(e.currentTarget).get('reason')
            reject.mutate(
              { id: rejecting._id, body: { reason } },
              { onError: (err) => toast.show(apiError(err)) },
            )
          }}
        >
          <p className="mb-4 text-[0.9rem] text-muted-admin">
            {rejecting?.customerName} · {rejecting?.product} · {inr(rejecting?.amount)} · UTR{' '}
            <span className="font-mono">{rejecting?.utr}</span>
          </p>
          <TextField
            name="reason"
            label="Reason"
            hint="Stored on the transaction so the queue stays honest"
            placeholder="No matching credit in the bank statement"
            required
          />
        </form>
      </Modal>

      {/* ------------------------------- refund ----------------------------- */}
      <Modal
        open={!!refunding}
        onClose={() => setRefunding(null)}
        title="Refund through Razorpay"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefunding(null)}>
              Cancel
            </Button>
            <Button form="refund-form" type="submit" variant="danger" disabled={refund.isPending}>
              {refund.isPending ? 'Refunding…' : 'Refund'}
            </Button>
          </>
        }
      >
        <form
          id="refund-form"
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            refund.mutate(
              {
                id: refunding._id,
                body: { amount: Number(form.get('amount')), reason: form.get('reason') },
              },
              { onError: (err) => toast.show(apiError(err)) },
            )
          }}
          className="grid gap-4"
        >
          <p className="text-[0.9rem] text-muted-admin">
            {refunding?.customerName} · {refunding?.product} · {inr(refunding?.amount)}
            {refunding?.refundedAmount
              ? ` · ${inr(refunding.refundedAmount)} already refunded`
              : ''}
          </p>
          <TextField
            name="amount"
            type="number"
            min="1"
            step="0.01"
            max={refunding ? refunding.amount - (refunding.refundedAmount || 0) : undefined}
            label="Refund amount (₹)"
            hint="A full refund also revokes the buyer's access to the course."
            defaultValue={refunding ? refunding.amount - (refunding.refundedAmount || 0) : 0}
            required
          />
          <TextField
            name="reason"
            label="Reason"
            placeholder="Requested by the customer"
            required
          />
        </form>
      </Modal>
    </>
  )
}
