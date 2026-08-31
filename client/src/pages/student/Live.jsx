import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Button, cn, EmptyState, Loading, useToast } from '../../components/ui/index.jsx'
import { PageHead } from '../../components/student/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Completed' },
  { id: 'oneOnOne', label: '1:1 Bookings' },
]

const fmt = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export default function Live() {
  useDocumentTitle('Live & Workshops | Growth Scholar')
  const [tab, setTab] = useState('upcoming')
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
  const items = tab === 'oneOnOne' ? data.oneOnOne : data[tab]

  return (
    <>
      {toast.node}
      <PageHead title="Live & Workshops" sub="Book a seat, join the room, catch the replay." />

      <div className="mb-6 flex rounded-full border border-line bg-white p-1" role="tablist">
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
        <EmptyState
          icon="🔴"
          title="Nothing here yet"
          body="New sessions are announced every week."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4 mx-1040:grid-cols-2 mx-640:grid-cols-1">
          {items.map((item) => (
            <article
              key={item._id}
              className="rounded-lg2 border border-line bg-white p-5 shadow-tiny"
            >
              <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-accent-mid">
                {item.kind || item.type}
              </p>
              <h3 className="mt-1 text-[1.02rem]">{item.title || item.topic}</h3>
              <p className="mt-1.5 text-[0.82rem] text-muted">
                {fmt(item.startsAt || item.when)} ·{' '}
                {item.durationMins ? `${item.durationMins} min` : item.duration}
              </p>
              {item.host && <p className="mt-0.5 text-[0.82rem] text-muted">Host: {item.host}</p>}

              <div className="mt-4 flex flex-wrap gap-2">
                {tab === 'upcoming' &&
                  (booked.has(String(item._id)) ? (
                    <>
                      <Button size="sm" variant="outline" disabled>
                        Booked ✓
                      </Button>
                      {item.joinUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          href={item.joinUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Join room
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => book.mutate(item._id)}
                      disabled={book.isPending}
                    >
                      Book my seat
                    </Button>
                  ))}
                {tab === 'past' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.show('Replay coming soon')}
                  >
                    Watch replay
                  </Button>
                )}
                {tab === 'oneOnOne' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.show('Request sent to the mentor team')}
                  >
                    Request a slot
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
