import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client.js'

/** Small wrappers so each admin page is a few lines instead of a fetch block. */

export function useAdminList(resource, params = {}, options = {}) {
  return useQuery({
    queryKey: ['admin', resource, params],
    queryFn: async () => (await api.get(`/admin/${resource}`, { params })).data,
    ...options,
  })
}

export function useAdminOne(resource, id, options = {}) {
  return useQuery({
    queryKey: ['admin', resource, id],
    queryFn: async () => (await api.get(`/admin/${resource}/${id}`)).data,
    enabled: !!id,
    ...options,
  })
}

/**
 * Invalidates the whole resource subtree so lists refetch after any write.
 *
 * `path` may be a function of the payload, for endpoints addressed by row id —
 * e.g. `path: (p) => `${p.id}/approve``. Without that the hook could only ever
 * call one fixed URL per component.
 */
export function useAdminMutation(resource, { method = 'post', path = '', onDone } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const suffix = typeof path === 'function' ? path(payload) : path
      const url = `/admin/${resource}${suffix ? `/${suffix}` : ''}`
      const res = await api[method](url, payload?.body ?? payload)
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      onDone?.(data)
    },
  })
}

export function useAdminSave(resource) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }) => {
      const res = id
        ? await api.put(`/admin/${resource}/${id}`, body)
        : await api.post(`/admin/${resource}`, body)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useAdminDelete(resource) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/${resource}/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

/** Triggers a CSV download from an export endpoint. */
export async function downloadCsv(path, filename) {
  const res = await api.get(`/admin/${path}`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
