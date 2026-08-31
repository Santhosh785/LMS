import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { Button, EmptyState, Loading, cn } from '../../components/ui/index.jsx'
import { CourseProgressCard, PageHead } from '../../components/student/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'notstarted', label: 'Not started' },
]

export default function MyCourses() {
  useDocumentTitle('My Learning | Growth Scholar')
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [tab, setTab] = useState('all')

  const { data, isPending } = useQuery({
    queryKey: ['me', 'enrollments'],
    queryFn: async () => (await api.get('/me/enrollments')).data,
  })

  const items = (data?.items || [])
    .filter((e) => {
      if (tab === 'active') return e.status === 'Active'
      if (tab === 'completed') return e.status === 'Completed'
      if (tab === 'notstarted') return e.status === 'Not started'
      return true
    })
    // client-side title filter, same as the old data-st-filter search
    .filter(
      (e) => !query.trim() || e.courseId?.title?.toLowerCase().includes(query.trim().toLowerCase()),
    )

  return (
    <>
      <PageHead title="My Learning" sub="Every course you’re enrolled in, with progress." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-line bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
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
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by course name…"
          aria-label="Filter courses"
          className="ml-auto w-64 rounded-full border border-line bg-white px-4 py-2 text-[0.88rem] outline-none focus:border-brand mx-640:ml-0 mx-640:w-full"
        />
      </div>

      {isPending ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon="📚"
          title="Nothing here yet"
          body="Enroll in a course to see it on this page."
          action={
            <Button to="/courses" className="mt-3">
              Browse catalog
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-4 gap-4 mx-1100:grid-cols-3 mx-960:grid-cols-2 mx-560:grid-cols-1">
          {items.map((e) => (
            <CourseProgressCard key={e._id} enrollment={e} />
          ))}
        </div>
      )}
    </>
  )
}
