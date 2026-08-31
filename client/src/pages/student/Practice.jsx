import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { Button, EmptyState, Loading, StatusPill, useToast } from '../../components/ui/index.jsx'
import { PageHead } from '../../components/student/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

export default function Practice() {
  useDocumentTitle('Practice | Growth Scholar')
  const toast = useToast()

  const { data, isPending } = useQuery({
    queryKey: ['me', 'practice'],
    queryFn: async () => (await api.get('/me/practice')).data,
  })

  if (isPending) return <Loading />
  const items = data.items || []

  return (
    <>
      {toast.node}
      <PageHead
        title="Practice"
        sub="Drills, challenges and quizzes that turn lessons into skills."
      />

      {items.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No practice items yet"
          body="They unlock as you move through your courses."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <article
              key={item._id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg2 border border-line bg-white p-5 shadow-tiny"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[1rem]">{item.title}</h3>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-1 text-[0.85rem] text-muted">{item.description}</p>
                <p className="mt-1.5 flex flex-wrap gap-x-4 text-[0.78rem] text-muted">
                  <span>{item.type}</span>
                  <span>{item.difficulty}</span>
                  <span>{item.questionCount} questions</span>
                  <span>~{item.minutes} min</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                {item.score != null && (
                  <span className="text-[0.9rem] font-bold text-brand">{item.score}%</span>
                )}
                <Button
                  size="sm"
                  variant={item.status === 'Completed' ? 'outline' : 'primary'}
                  onClick={() => toast.show('Practice runner is not part of this build')}
                >
                  {item.status === 'Completed'
                    ? 'Review'
                    : item.status === 'In progress'
                      ? 'Resume'
                      : 'Start'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
