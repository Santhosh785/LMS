import { Router } from 'express'
import { and, asc, count, desc, eq, getTableColumns, gte, ilike, lte, or } from 'drizzle-orm'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { db, withMongoId } from '../db/index.js'
import { coerce, isUuid } from '../db/coerce.js'

/**
 * Standard list/create/read/update/delete router for the admin tables.
 * Every admin resource behaves the same way, so the shape lives in one place
 * and each resource only declares what makes it different.
 *
 * @param {import('drizzle-orm/pg-core').PgTable} table
 * @param {object} [opts]
 * @param {string}   [opts.name]          for error messages ("Course not found")
 * @param {string[]} [opts.searchFields]  columns the table's search box matches
 * @param {object}   [opts.sort]          default sort, Mongo-style: { createdAt: -1 }
 * @param {string}   [opts.dateField]     column the from/to filter applies to
 * @param {(req) => object} [opts.baseFilter]  column equalities, e.g. scoped by parent id
 * @param {(rows) => Promise<object[]>} [opts.hydrate]  rows → response documents
 *        (replaces Mongoose `populate` and nested-document assembly)
 * @param {object}   [opts.repo]          full override of create/update for tables whose
 *        document spans child tables: { create(body), update(id, body) } → document
 * @param {(body) => object} [opts.toValues]  body → column values (default: coerce)
 */
export function crudRouter(table, opts = {}) {
  const {
    name = 'Record',
    searchFields = [],
    sort = { createdAt: -1 },
    baseFilter,
    hydrate = async (rows) => withMongoId(rows),
    repo,
    toValues = (body) => coerce(table, body),
  } = opts
  const columns = getTableColumns(table)
  const router = Router({ mergeParams: true })

  const scope = (req) => {
    const base = baseFilter ? baseFilter(req) : {}
    return Object.entries(base).map(([k, v]) => eq(columns[k], v))
  }

  const buildWhere = (req) => {
    const clauses = scope(req)
    const q = req.query.q?.trim()
    if (q && searchFields.length) {
      // ILIKE with the pattern characters escaped — the Mongo version escaped
      // the regex for the same reason: a search box is not a query language.
      const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      clauses.push(or(...searchFields.map((f) => ilike(columns[f], pattern))))
    }
    if (req.query.status && columns.status) clauses.push(eq(columns.status, req.query.status))
    const dateColumn = columns[opts.dateField || 'createdAt']
    if (dateColumn && req.query.from) clauses.push(gte(dateColumn, new Date(req.query.from)))
    if (dateColumn && req.query.to) {
      clauses.push(lte(dateColumn, new Date(`${req.query.to}T23:59:59.999Z`)))
    }
    return clauses.length ? and(...clauses) : undefined
  }

  const orderBy = (req) => {
    const spec = req.query.sort
      ? { [req.query.sort.replace(/^-/, '')]: req.query.sort.startsWith('-') ? -1 : 1 }
      : sort
    return Object.entries(spec)
      .filter(([k]) => columns[k])
      .map(([k, dir]) => (dir < 0 ? desc(columns[k]) : asc(columns[k])))
  }

  const findOne = async (req) => {
    if (!isUuid(req.params.id)) return null
    const [row] = await db
      .select()
      .from(table)
      .where(and(eq(columns.id, req.params.id), ...scope(req)))
    return row ? (await hydrate([row]))[0] : null
  }

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const where = buildWhere(req)
      const limit = Math.min(Number(req.query.limit) || 50, 200)
      const offset = Number(req.query.skip) || 0

      const [rows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(table)
          .where(where)
          .orderBy(...orderBy(req))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(table).where(where),
      ])
      res.json({ items: await hydrate(rows), total })
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const body = { ...req.body, ...(baseFilter ? baseFilter(req) : {}) }
      if (repo?.create) return res.status(201).json(await repo.create(body))
      const [row] = await db.insert(table).values(toValues(body)).returning()
      res.status(201).json((await hydrate([row]))[0])
    }),
  )

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await findOne(req)
      if (!doc) throw new HttpError(404, `${name} not found`)
      res.json(doc)
    }),
  )

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      if (!isUuid(req.params.id)) throw new HttpError(404, `${name} not found`)
      if (repo?.update) {
        // Scope first: a parent-scoped resource must not update across parents.
        if (baseFilter && !(await findOne(req))) throw new HttpError(404, `${name} not found`)
        const doc = await repo.update(req.params.id, req.body)
        if (!doc) throw new HttpError(404, `${name} not found`)
        return res.json(doc)
      }
      const values = toValues(req.body)
      const where = and(eq(columns.id, req.params.id), ...scope(req))
      const [row] = Object.keys(values).length
        ? await db.update(table).set(values).where(where).returning()
        : await db.select().from(table).where(where)
      if (!row) throw new HttpError(404, `${name} not found`)
      res.json((await hydrate([row]))[0])
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      if (!isUuid(req.params.id)) throw new HttpError(404, `${name} not found`)
      const [row] = await db
        .delete(table)
        .where(and(eq(columns.id, req.params.id), ...scope(req)))
        .returning({ id: columns.id })
      if (!row) throw new HttpError(404, `${name} not found`)
      res.json({ ok: true })
    }),
  )

  return router
}
