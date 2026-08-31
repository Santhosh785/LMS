import { validationResult } from 'express-validator'
import { HttpError } from './error.js'

export function validate(req, _res, next) {
  const result = validationResult(req)
  if (result.isEmpty()) return next()
  const details = Object.fromEntries(result.array().map((e) => [e.path, e.msg]))
  next(new HttpError(400, 'Validation failed', details))
}
