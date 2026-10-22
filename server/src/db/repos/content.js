import { getTableColumns } from 'drizzle-orm'

/**
 * Partial selects by name — the Mongo `.select('a b c')` / `.select('-body')`.
 * Content rows carry large jsonb columns (bodies, landing copy, revisions), and
 * a card list should not drag those over the wire just to render a title.
 */
export function pickColumns(table, keys) {
  const columns = getTableColumns(table)
  const list = Array.isArray(keys) ? keys : keys.split(/\s+/).filter(Boolean)
  // `id` always comes along: every response document needs it for `_id`.
  return Object.fromEntries(['id', ...list].filter((k) => columns[k]).map((k) => [k, columns[k]]))
}

export function omitColumns(table, excluded) {
  const columns = getTableColumns(table)
  return Object.fromEntries(Object.entries(columns).filter(([k]) => !excluded.includes(k)))
}
