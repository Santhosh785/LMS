import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client.js'
import { cn, Field } from '../ui/index.jsx'

/**
 * Applies terms of one taxonomy to a piece of content.
 *
 * Reads the admin term list rather than the public config, so terms an operator
 * has drafted or hidden are still assignable — hiding a tag from the site is
 * not the same as retiring it from the editor.
 *
 * Values are term **names**, matching what the content documents store. See
 * server/src/models/Term.js for why names rather than ids.
 */
export default function TermPicker({
  taxonomy,
  label,
  hint,
  value = [],
  onChange,
  single = false,
}) {
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'taxonomy', taxonomy],
    queryFn: async () => (await api.get('/admin/taxonomy', { params: { taxonomy } })).data,
  })

  const terms = data?.items || []
  const selected = single ? [value].filter(Boolean) : value

  const toggle = (name) => {
    if (single) return onChange(selected.includes(name) ? '' : name)
    return onChange(
      selected.includes(name) ? selected.filter((v) => v !== name) : [...selected, name],
    )
  }

  return (
    <Field label={label} hint={hint}>
      {isPending ? (
        <p className="text-[0.85rem] text-muted">Loading…</p>
      ) : terms.length === 0 ? (
        <p className="text-[0.85rem] text-muted">
          No terms yet — add them under Taxonomy, then come back.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {terms.map((term) => {
            const on = selected.includes(term.name)
            return (
              <button
                key={term._id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(term.name)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[0.82rem] font-medium transition-colors duration-200',
                  on
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-white text-muted hover:border-brand hover:text-brand',
                )}
              >
                {term.icon ? `${term.icon} ` : ''}
                {term.name}
                {/* A tag that drives a homepage rail is worth flagging here —
                    applying it publishes the course to the front page. */}
                {term.showAsRail && <span className="ml-1 opacity-70">★</span>}
              </button>
            )
          })}
        </div>
      )}
    </Field>
  )
}
