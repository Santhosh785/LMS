import { getTableColumns } from 'drizzle-orm'

/**
 * Request body → column values for one table.
 *
 * Mongoose did three things silently that admin routes relied on: it dropped
 * fields the schema did not declare, cast ISO strings to Dates and numeric
 * strings to Numbers, and treated an empty form field as "unset". Drizzle does
 * none of them — an unknown key is ignored, but a date string reaches a
 * timestamp column and throws, and `''` reaches a uuid column and fails the
 * cast. This restores the casting, column by column, from the table definition.
 *
 * Identity and bookkeeping columns are never writable from a request: a body
 * carrying `id`, `_id`, `legacyId` or the timestamps is a client echoing back a
 * row it was sent, not an instruction to rewrite history.
 */
const NEVER_WRITABLE = new Set(['id', '_id', 'legacyId', 'createdAt', 'updatedAt'])

function castValue(column, value) {
  if (value === undefined) return undefined
  const type = column.columnType

  if (value === null || (value === '' && type !== 'PgText')) {
    return column.notNull ? undefined : null
  }

  switch (type) {
    case 'PgTimestamp': {
      const date = value instanceof Date ? value : new Date(value)
      return Number.isNaN(date.getTime()) ? undefined : date
    }
    case 'PgInteger':
    case 'PgBigInt53':
    case 'PgDoublePrecision':
    case 'PgNumericNumber':
    case 'PgNumeric': {
      const n = Number(value)
      return Number.isFinite(n) ? n : undefined
    }
    case 'PgBoolean':
      return value === true || value === 'true' || value === 1 || value === '1'
    case 'PgArray':
      if (Array.isArray(value)) return value
      return typeof value === 'string'
        ? value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined
    case 'PgUUID':
      // A populated reference sent back whole ({ _id, name }) means its id.
      if (typeof value === 'object') return value._id ?? value.id ?? null
      return String(value)
    default:
      return value
  }
}

/**
 * @param {import('drizzle-orm/pg-core').PgTable} table
 * @param {object} body
 * @param {{ allow?: string[] }} [opts]  restrict to these keys (per-tab saves)
 */
export function coerce(table, body = {}, { allow } = {}) {
  const columns = getTableColumns(table)
  const out = {}
  for (const [key, value] of Object.entries(body || {})) {
    if (NEVER_WRITABLE.has(key)) continue
    if (allow && !allow.includes(key)) continue
    const column = columns[key]
    if (!column) continue
    const cast = castValue(column, value)
    if (cast !== undefined) out[key] = cast
  }
  return out
}

/** True when `value` can be compared against a uuid column without a cast error. */
export const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
