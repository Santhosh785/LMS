import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

/** Turns an axios error into the message the server sent, for form-level display. */
export function apiError(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong'
}

export function apiFieldErrors(err) {
  return err?.response?.data?.details || {}
}
