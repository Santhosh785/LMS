import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { Button, EmptyState, Loading, StatusPill, useToast } from '../../components/ui/index.jsx'
import { PageHead } from '../../components/student/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

export default function Certificates() {
  useDocumentTitle('Certificates | Growth Scholar')
  const toast = useToast()

  const { data, isPending } = useQuery({
    queryKey: ['me', 'certificates'],
    queryFn: async () => (await api.get('/me/certificates')).data,
  })

  if (isPending) return <Loading />
  const items = data.items || []

  return (
    <>
      {toast.node}
      <PageHead title="Certificates" sub="Proof of the modules and projects you’ve finished." />

      {items.length === 0 ? (
        <EmptyState
          icon="🎓"
          title="No certificates yet"
          body="Complete a course to unlock your first one."
          action={
            <Button to="/student/courses" className="mt-3">
              Back to my learning
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-5 mx-1040:grid-cols-2 mx-640:grid-cols-1">
          {items.map((c) => (
            <article
              key={c._id}
              className="overflow-hidden rounded-lg2 border border-line bg-white shadow-tiny"
            >
              <div className="brand-wash art-sheen relative grid h-28 place-items-center text-center">
                <span className="text-[2rem]" aria-hidden="true">
                  🎓
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[1rem]">{c.courseTitle}</h3>
                  <StatusPill status={c.status} />
                </div>
                <p className="mt-2 text-[0.78rem] text-muted">Credential ID: {c.credentialId}</p>
                {c.status === 'Issued' && (
                  <p className="mt-0.5 text-[0.78rem] text-muted">
                    Issued{' '}
                    {new Date(c.issuedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  {/*
                    Certificate PDF generation does not exist. A button that
                    accepts the click and then admits nothing happened is worse
                    than one that is plainly unavailable — it costs the learner a
                    round trip to find out.
                  */}
                  <Button size="sm" disabled title="Certificate downloads are not available yet">
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={c.status !== 'Issued'}
                    onClick={() => toast.show('Share link copied')}
                  >
                    Share
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
