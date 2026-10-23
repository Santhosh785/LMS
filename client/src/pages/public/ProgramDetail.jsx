import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import { Loading } from '../../components/ui/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'
import useBodyClass from '../../hooks/useBodyClass.js'
import useProgramCopy from '../../hooks/useProgramCopy.js'

/**
 * /programs/:slug — the program's FAQ, and nothing else (see the note in the
 * component). Styled by the vendored styles/redesign/program.css.
 */

/** <details>/<summary>, as the drop's .faq-block expects; the first is open. */
function Faq({ q, a, defaultOpen }) {
  return (
    <details open={defaultOpen}>
      <summary>{q}</summary>
      <p>{a}</p>
    </details>
  )
}

export default function ProgramDetail() {
  const { slug } = useParams()
  const {
    data: program,
    isPending,
    error,
  } = useQuery({
    queryKey: ['program', slug],
    queryFn: async () => (await api.get(`/programs/${slug}`)).data,
  })

  useDocumentTitle(program ? `${program.title} | Growth Scholar` : 'Program | Growth Scholar')
  useBodyClass('gs-redesign prog-page')

  // Section headings and button labels are editable per program; anything the
  // operator left blank falls back to the wording the page shipped with.
  // Resolved before the early returns below, so the hook order never varies.
  const { copy } = useProgramCopy(program)

  if (isPending) return <Loading />
  if (error) {
    return (
      <div className="px-5 py-20 text-center">
        <h1 className="text-[1.5rem]">Program not found</h1>
        <p className="mt-2 text-muted">{apiError(error)}</p>
        <Link to="/" className="mt-4 inline-block font-semibold text-brand hover:underline">
          ← Back home
        </Link>
      </div>
    )
  }

  /*
   * The program page is FAQ-only by the owner's decision (2026-10-23): the
   * hero, curriculum, admission, pricing and CTA sections were removed. The
   * program's other fields are still editable in admin but no longer shown.
   */
  return (
    <div className="prog-page">
      {/* The first section pads past the fixed header itself — see overrides.css. */}
      <section className="prog-section" style={{ paddingTop: 'calc(var(--header-h) + 3rem)' }}>
        <div className="wrap">
          <p className="eyebrow">{copy('faqs').eyebrow}</p>
          <h2>{copy('faqs').heading}</h2>
          <div className="faq-block" style={{ marginTop: '1.25rem' }}>
            {program.faqs?.map((f, i) => (
              <Faq key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
