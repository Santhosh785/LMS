import { captureServerError } from '../config/observability.js'

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const notFound = (req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` })
}

// Wraps an async handler so rejected promises reach the error middleware.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

export const errorHandler = (err, req, res, _next) => {
  /*
   * Postgres constraint failures — what Mongoose's ValidationError, CastError
   * and duplicate-key 11000 used to cover. Drizzle wraps the driver error, so
   * the SQLSTATE is on `cause`. A CHECK on an
   * enum column or a NOT NULL is bad input (400), a unique index is a conflict
   * (409); neither is a server fault and neither should page anyone.
   */
  const pgCode = err?.cause?.code || err?.code
  if (['23514', '23502', '22P02', '22007', '22008', '23503'].includes(pgCode)) {
    return res.status(400).json({
      error: 'Validation failed',
      details: { [err.cause?.column || err.cause?.constraint || 'input']: err.cause?.message },
    })
  }
  if (pgCode === '23505') {
    return res.status(409).json({ error: 'Already exists', details: err.cause?.constraint })
  }

  const status = err.status || 500
  if (status >= 500) console.error(err)

  // Only 5xx reaches the tracker. A 401 on a mistyped password and a 404 on a
  // stale link are normal traffic; reporting them buries the one event that
  // matters under ten thousand that do not.
  captureServerError(err, req, status)

  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
  })
}
