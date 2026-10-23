import { useLoaderData } from 'react-router'
import useProgramCopy from '../../hooks/useProgramCopy.js'

/**
 * /programs/:slug — the program's FAQ, and nothing else (see the note in the
 * component). Styled by the vendored styles/redesign/program.css.
 *
 * Server-rendered: the program arrives as loader data (routes/public/
 * program-detail.ts) and the head comes from the route's `meta`; an unknown
 * slug never reaches this component — the loader answers it with a 404.
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
  const { program } = useLoaderData()

  // Section headings and button labels are editable per program; anything the
  // operator left blank falls back to the wording the page shipped with.
  const { copy } = useProgramCopy(program)

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
