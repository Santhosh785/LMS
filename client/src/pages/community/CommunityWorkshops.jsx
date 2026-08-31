import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, EmptyState, Loading, useToast } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Completed' },
]

export default function CommunityWorkshops() {
  useDocumentTitle('Community Workshops | Growth Scholar')
  const [tab, setTab] = useState('upcoming')
  const [copied, setCopied] = useState(null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isPending } = useQuery({
    queryKey: ['live'],
    queryFn: async () => (await api.get('/live')).data,
  })

  const book = useMutation({
    mutationFn: async (id) => (await api.post(`/live/${id}/book`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live'] })
      toast.show('Seat booked ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  if (isPending) return <Loading />

  const booked = new Set(data.bookedIds)
  const items = data[tab] || []

  const copyLink = async (url, id) => {
    await navigator.clipboard.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 1400)
  }

  return (
    <div className="mx-auto max-w-shell">
      {toast.node}
      <h1 className="text-[clamp(1.4rem,2.4vw,1.8rem)]">Community workshops</h1>
      <p className="mt-1 text-[0.92rem] text-muted">
        Live sessions, office hours and teardowns with mentors.
      </p>

      <div className="my-6 flex rounded-full border border-line bg-white p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-[0.85rem] font-semibold transition-colors duration-200 ease-gs',
              tab === t.id ? 'bg-brand text-white' : 'text-muted hover:text-brand',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState icon="📅" title="Nothing here yet" body="New sessions are announced weekly." />
      ) : (
        <div className="grid grid-cols-3 gap-4 mx-1040:grid-cols-2 mx-640:grid-cols-1">
          {items.map((w) => (
            <article key={w._id} className="rounded-lg2 border border-line bg-white p-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-accent-mid">
                {w.kind}
              </p>
              <h3 className="mt-1 text-[1.02rem]">{w.title}</h3>
              <p className="mt-1.5 text-[0.82rem] text-muted">
                {new Date(w.startsAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}{' '}
                · {w.durationMins} min
              </p>
              <p className="mt-0.5 text-[0.82rem] text-muted">Host: {w.host}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {tab === 'upcoming' &&
                  (booked.has(String(w._id)) ? (
                    <Button size="sm" variant="outline" disabled>
                      Booked ✓
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => book.mutate(w._id)} disabled={book.isPending}>
                      Book
                    </Button>
                  ))}
                {w.joinUrl && (
                  <Button size="sm" variant="ghost" onClick={() => copyLink(w.joinUrl, w._id)}>
                    {copied === w._id ? 'Copied!' : 'Copy meeting link'}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
