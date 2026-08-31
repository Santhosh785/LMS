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
  if (err?.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: Object.fromEntries(Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])),
    })
  }

  // duplicate key
  if (err?.code === 11000) {
    return res.status(409).json({
      error: 'Already exists',
      details: err.keyValue,
    })
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path}: ${err.value}` })
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
