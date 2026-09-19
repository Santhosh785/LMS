import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../../api/client.js'
import { fileSize, fmtDate, Icon, Spinner, WpModal } from './wp.jsx'

/**
 * WordPress's "Select or Upload Media" frame.
 *
 * One component serves every picker in the workspace — the featured image, the
 * image block and the Open Graph image — because in WordPress they are all the
 * same modal, and an editor who has learnt it once should not meet a second,
 * slightly different one.
 */
export default function MediaFrame({ open, title = 'Select or Upload Media', buttonLabel = 'Select', onClose, onSelect }) {
  const queryClient = useQueryClient()
  const fileInput = useRef(null)
  const [tab, setTab] = useState('library')
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [selected, setSelected] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const library = useQuery({
    queryKey: ['admin', 'media', { q: search, m: month }],
    queryFn: async () =>
      (await api.get('/admin/media', { params: { ...(search ? { q: search } : {}), ...(month ? { m: month } : {}) } })).data,
    enabled: open,
  })

  const upload = useMutation({
    mutationFn: async (files) => {
      const form = new FormData()
      for (const file of files) form.append('files', file)
      return (await api.post('/admin/media', form)).data
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
      setSelected(result.items ? result.items[0] : result)
      setTab('library')
      setError('')
    },
    onError: (err) => setError(apiError(err)),
  })

  const saveDetails = useMutation({
    mutationFn: async (media) =>
      (
        await api.put(`/admin/media/${media._id}`, {
          title: media.title,
          altText: media.altText,
          caption: media.caption,
          description: media.description,
        })
      ).data,
    onSuccess: (media) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
      setSelected(media)
    },
    onError: (err) => setError(apiError(err)),
  })

  const remove = useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/media/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
      setSelected(null)
    },
    onError: (err) => setError(apiError(err)),
  })

  const take = (files) => {
    const list = Array.from(files || []).slice(0, 20)
    if (list.length) upload.mutate(list)
  }

  return (
    <WpModal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <span style={{ marginRight: 'auto', color: '#646970' }}>
            {selected ? `1 item selected` : 'No items selected'}
          </span>
          <button type="button" className="wp-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="wp-button wp-button-primary"
            disabled={!selected}
            onClick={() => {
              onSelect(selected)
              onClose()
            }}
          >
            {buttonLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #ddd', marginBottom: 12 }}>
        {[
          ['upload', 'Upload files'],
          ['library', 'Media Library'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className="wp-button-link"
            style={{
              padding: '8px 14px',
              fontSize: 14,
              color: tab === value ? '#1d2327' : '#2271b1',
              fontWeight: tab === value ? 600 : 400,
              boxShadow: tab === value ? 'inset 0 -3px 0 0 #2271b1' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="wp-notice wp-notice-error">
          <p>{error}</p>
        </div>
      )}

      {tab === 'upload' ? (
        <div
          className={`wp-dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            take(event.dataTransfer.files)
          }}
        >
          <Icon name="upload" size={36} style={{ fill: '#8c8f94' }} />
          <h2 style={{ fontSize: 20, fontWeight: 400 }}>Drop files to upload</h2>
          <p style={{ color: '#646970', margin: 0 }}>or</p>
          <button type="button" className="wp-button wp-button-large" onClick={() => fileInput.current?.click()}>
            Select Files
          </button>
          <p style={{ color: '#646970', fontSize: 12, margin: 0 }}>
            JPG, PNG, WebP, GIF or AVIF — maximum 10 MB per file, 20 files at a time.
          </p>
          {upload.isPending && <Spinner label="Uploading…" />}
        </div>
      ) : (
        <div className="wp-media-frame-body">
          <div className="wp-media-frame-content">
            <div className="wp-media-toolbar">
              <select value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Filter by date">
                <option value="">All dates</option>
                {(library.data?.months || []).map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {`${entry.key.slice(0, 4)}/${entry.key.slice(4)}`}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={search}
                placeholder="Search media items…"
                aria-label="Search media"
                onChange={(event) => setSearch(event.target.value)}
                style={{ marginLeft: 'auto', width: 220 }}
              />
            </div>
            {library.isPending ? (
              <div className="wp-no-items">
                <Spinner label="Loading media…" />
              </div>
            ) : library.data?.items?.length ? (
              <div className="wp-media-grid" style={{ border: 0, padding: 0 }}>
                {library.data.items.map((media) => (
                  <button
                    key={media._id}
                    type="button"
                    className={`wp-attachment ${selected?._id === media._id ? 'is-selected' : ''}`}
                    onClick={() => setSelected(media)}
                    onDoubleClick={() => {
                      onSelect(media)
                      onClose()
                    }}
                    aria-pressed={selected?._id === media._id}
                  >
                    <img src={media.url} alt={media.altText || media.originalName} loading="lazy" />
                    {selected?._id === media._id && (
                      <span className="wp-attachment-check">
                        <Icon name="check" size={14} style={{ fill: '#fff' }} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="wp-no-items">No media items found. Upload an image to begin.</p>
            )}
          </div>

          <aside className="wp-media-sidebar">
            <h2 style={{ fontSize: 14, fontWeight: 600, padding: '12px 0', borderBottom: '1px solid #ddd' }}>
              Attachment Details
            </h2>
            {selected ? (
              <div className="wp-attachment-details" style={{ paddingTop: 12 }}>
                <img src={selected.url} alt="" style={{ maxHeight: 120, objectFit: 'contain', background: '#fff' }} />
                <p style={{ margin: 0, wordBreak: 'break-all' }}>
                  <strong style={{ color: '#1d2327' }}>{selected.originalName}</strong>
                  <br />
                  {fmtDate(selected.createdAt)}
                  <br />
                  {fileSize(selected.size)} · {selected.mimeType}
                  {selected.width > 0 && (
                    <>
                      <br />
                      {selected.width} × {selected.height} pixels
                    </>
                  )}
                  {selected.sizes?.length > 0 && (
                    <>
                      <br />
                      {selected.sizes.length} generated size{selected.sizes.length === 1 ? '' : 's'}
                    </>
                  )}
                </p>
                <label>
                  Title
                  <input
                    type="text"
                    value={selected.title || ''}
                    onChange={(event) => setSelected({ ...selected, title: event.target.value })}
                  />
                </label>
                <label>
                  Alt Text
                  <input
                    type="text"
                    value={selected.altText || ''}
                    onChange={(event) => setSelected({ ...selected, altText: event.target.value })}
                  />
                </label>
                <label>
                  Caption
                  <textarea
                    rows={2}
                    value={selected.caption || ''}
                    onChange={(event) => setSelected({ ...selected, caption: event.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={2}
                    value={selected.description || ''}
                    onChange={(event) => setSelected({ ...selected, description: event.target.value })}
                  />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 16 }}>
                  <button
                    type="button"
                    className="wp-button wp-button-small"
                    onClick={() => saveDetails.mutate(selected)}
                    disabled={saveDetails.isPending}
                  >
                    {saveDetails.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="wp-button-link wp-button-link-delete"
                    onClick={() => remove.mutate(selected._id)}
                  >
                    Delete permanently
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ color: '#646970', fontSize: 13 }}>Select an item to see its details.</p>
            )}
          </aside>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        style={{ display: 'none' }}
        onChange={(event) => {
          take(event.target.files)
          event.target.value = ''
        }}
      />
    </WpModal>
  )
}
