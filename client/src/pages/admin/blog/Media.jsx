import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../../api/client.js'
import useDocumentTitle from '../../../hooks/useDocumentTitle.js'
import { SIZE_LABELS } from './blocks.jsx'
import {
  ConfirmDialog,
  fileSize,
  fmtDate,
  Icon,
  Pagination,
  RowActions,
  Spinner,
  useNotices,
  useScreenOption,
  WpModal,
} from './wp.jsx'

/**
 * Media → Library and Media → Add New Media File.
 *
 * Both of WordPress's view modes are here: the grid, whose tiles open the
 * Attachment Details dialog, and the list table with hover row actions. The
 * upload screen is the same dropzone the media frame uses, on its own page.
 */

export function MediaLibrary() {
  useDocumentTitle('Media Library | Growth Scholar Blog')
  const queryClient = useQueryClient()
  const notices = useNotices()
  const fileInput = useRef(null)

  const [mode, setMode] = useScreenOption('media-mode', 'grid')
  const [perPage, setPerPage] = useScreenOption('media-per-page', 40)
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [page, setPage] = useState(1)
  const [details, setDetails] = useState(null)
  const [selected, setSelected] = useState([])
  const [dragging, setDragging] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const params = { ...(search ? { q: search } : {}), ...(month ? { m: month } : {}), page, perPage }
  const library = useQuery({
    queryKey: ['admin', 'media', params],
    queryFn: async () => (await api.get('/admin/media', { params })).data,
    placeholderData: (previous) => previous,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
  const fail = (err) => notices.notify(apiError(err), 'error')

  const upload = useMutation({
    mutationFn: async (files) => {
      const form = new FormData()
      for (const file of files) form.append('files', file)
      return (await api.post('/admin/media', form)).data
    },
    onSuccess: (result) => {
      refresh()
      const count = result.items?.length || 1
      notices.notify(`${count} file${count === 1 ? '' : 's'} uploaded.`)
    },
    onError: fail,
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
      refresh()
      setDetails(media)
      notices.notify('Attachment updated.')
    },
    onError: fail,
  })
  const migrate = useMutation({
    mutationFn: async () => (await api.post('/admin/media/migrate', { limit: 25 })).data,
    onSuccess: (result) => {
      refresh()
      const parts = [`${result.moved} file${result.moved === 1 ? '' : 's'} moved to Bunny`]
      if (result.missing) parts.push(`${result.missing} had no file left on disk`)
      if (result.remaining) parts.push(`${result.remaining} still to go — run it again`)
      notices.notify(`${parts.join('. ')}.`, result.failures?.length ? 'warning' : 'success')
      if (result.failures?.length) notices.notify(result.failures[0], 'error')
    },
    onError: fail,
  })

  const regenerate = useMutation({
    mutationFn: async () => (await api.post('/admin/media/regenerate', { limit: 25 })).data,
    onSuccess: (result) => {
      refresh()
      const parts = [`${result.rebuilt} image${result.rebuilt === 1 ? '' : 's'} resized`]
      if (result.skipped) parts.push(`${result.skipped} too small or unreadable`)
      if (result.remaining) parts.push(`${result.remaining} still to go — run it again`)
      notices.notify(`${parts.join('. ')}.`, result.failures?.length ? 'warning' : 'success')
      if (result.failures?.length) notices.notify(result.failures[0], 'error')
    },
    onError: fail,
  })

  const bulkDelete = useMutation({
    mutationFn: async (ids) => (await api.post('/admin/media/bulk', { ids, action: 'delete' })).data,
    onSuccess: (result) => {
      refresh()
      setSelected([])
      setDetails(null)
      notices.notify(`${result.affected} item${result.affected === 1 ? '' : 's'} permanently deleted.`)
    },
    onError: fail,
  })

  const items = library.data?.items || []
  const take = (files) => {
    const list = Array.from(files || []).slice(0, 20)
    if (list.length) upload.mutate(list)
  }
  const askDelete = (ids, label) =>
    setConfirm({
      title: 'Delete permanently',
      message: `${label} will be permanently deleted. Any post using it keeps a broken link. Continue?`,
      confirmLabel: 'Delete permanently',
      destructive: true,
      onConfirm: () => bulkDelete.mutate(ids),
    })

  return (
    <div
      className="wp-wrap"
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
      <div className="wp-heading-row">
        <h1 className="wp-heading-inline">Media Library</h1>
        <button type="button" className="wp-button wp-page-title-action" onClick={() => fileInput.current?.click()}>
          Add New Media File
        </button>
      </div>
      <hr className="wp-hr" />
      {notices.node}
      {dragging && (
        <div className="wp-notice wp-notice-info">
          <p>Drop files anywhere on this screen to upload them.</p>
        </div>
      )}
      <StorageNotice
        storage={library.data?.storage}
        migrating={migrate.isPending}
        onMigrate={() => migrate.mutate()}
      />
      <SizesNotice
        storage={library.data?.storage}
        running={regenerate.isPending}
        onRun={() => regenerate.mutate()}
      />

      <div className="wp-tablenav">
        <div className="wp-alignleft">
          <div style={{ display: 'flex', gap: 2, marginRight: 6 }}>
            <button
              type="button"
              className="wp-button"
              aria-pressed={mode === 'grid'}
              style={mode === 'grid' ? { background: '#f0f0f1', borderColor: '#0a4b78' } : undefined}
              aria-label="Grid view"
              onClick={() => setMode('grid')}
            >
              <Icon name="grid" size={16} />
            </button>
            <button
              type="button"
              className="wp-button"
              aria-pressed={mode === 'list'}
              style={mode === 'list' ? { background: '#f0f0f1', borderColor: '#0a4b78' } : undefined}
              aria-label="List view"
              onClick={() => setMode('list')}
            >
              <Icon name="rows" size={16} />
            </button>
          </div>
          <select
            aria-label="Filter by date"
            value={month}
            onChange={(event) => {
              setPage(1)
              setMonth(event.target.value)
            }}
          >
            <option value="">All dates</option>
            {(library.data?.months || []).map((entry) => (
              <option key={entry.key} value={entry.key}>
                {`${entry.key.slice(0, 4)}/${entry.key.slice(4)}`} ({entry.count})
              </option>
            ))}
          </select>
          {selected.length > 0 && (
            <button
              type="button"
              className="wp-button"
              style={{ borderColor: '#b32d2e', color: '#b32d2e' }}
              onClick={() => askDelete(selected, `${selected.length} item(s)`)}
            >
              Delete permanently ({selected.length})
            </button>
          )}
          {(library.isFetching || upload.isPending) && <Spinner label={upload.isPending ? 'Uploading…' : undefined} />}
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
          <input
            type="search"
            value={search}
            placeholder="Search media items…"
            aria-label="Search media"
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            style={{ width: 220 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="wp-screen-reader-text">Items per page</span>
            <select value={perPage} onChange={(event) => setPerPage(Number(event.target.value))} aria-label="Items per page">
              {[20, 40, 80, 120].map((value) => (
                <option key={value} value={value}>
                  {value} / page
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {library.isPending ? (
        <p className="wp-no-items">
          <Spinner label="Loading media…" />
        </p>
      ) : !items.length ? (
        <div className="wp-dropzone">
          <Icon name="media" size={36} style={{ fill: '#8c8f94' }} />
          <h2 style={{ fontSize: 18, fontWeight: 400 }}>No media items found</h2>
          <button type="button" className="wp-button wp-button-primary" onClick={() => fileInput.current?.click()}>
            Select Files
          </button>
        </div>
      ) : mode === 'grid' ? (
        <div className="wp-media-grid">
          {items.map((media) => (
            <button key={media._id} type="button" className="wp-attachment" onClick={() => setDetails(media)}>
              <img src={media.url} alt={media.altText || media.originalName} loading="lazy" />
              <span className="wp-attachment-filename">{media.title || media.originalName}</span>
            </button>
          ))}
        </div>
      ) : (
        <table className="wp-list-table striped">
          <thead>
            <tr>
              <td className="check-column">
                <input
                  type="checkbox"
                  aria-label="Select all media"
                  checked={selected.length === items.length && items.length > 0}
                  onChange={() => setSelected(selected.length === items.length ? [] : items.map((m) => m._id))}
                />
              </td>
              <th scope="col" className="column-thumbnail" style={{ width: 80 }}>
                <span className="wp-screen-reader-text">Thumbnail</span>
              </th>
              <th scope="col" className="column-title">
                File
              </th>
              <th scope="col" className="column-author">
                Uploaded by
              </th>
              <th scope="col">Size</th>
              <th scope="col" className="column-author">
                Dimensions
              </th>
              <th scope="col" className="column-author">
                Stored
              </th>
              <th scope="col" className="column-date">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((media) => (
              <tr key={media._id}>
                <th scope="row" className="check-column">
                  <input
                    type="checkbox"
                    aria-label={`Select ${media.originalName}`}
                    checked={selected.includes(media._id)}
                    onChange={() =>
                      setSelected((rows) =>
                        rows.includes(media._id) ? rows.filter((row) => row !== media._id) : [...rows, media._id],
                      )
                    }
                  />
                </th>
                <td className="column-thumbnail">
                  <img
                    src={media.url}
                    alt=""
                    style={{ width: 60, height: 60, objectFit: 'cover', background: '#f0f0f1' }}
                    loading="lazy"
                  />
                </td>
                <td className="column-title">
                  <strong>
                    <button type="button" className="row-title" onClick={() => setDetails(media)}>
                      {media.title || media.originalName}
                    </button>
                  </strong>
                  <p style={{ margin: '2px 0 0', color: '#646970', fontSize: 13 }}>{media.originalName}</p>
                  <RowActions
                    actions={[
                      { label: 'Edit', onClick: () => setDetails(media) },
                      {
                        label: 'Delete permanently',
                        destructive: true,
                        onClick: () => askDelete([media._id], `“${media.originalName}”`),
                      },
                      { label: 'View', href: media.url, external: true },
                    ]}
                  />
                </td>
                <td className="column-author">{media.uploadedBy}</td>
                <td>{fileSize(media.size)}</td>
                <td className="column-author" style={{ color: '#646970' }}>
                  {media.width ? `${media.width} × ${media.height}` : '—'}
                  {media.sizes?.length > 0 && (
                    <span style={{ display: 'block', fontSize: 12 }}>
                      +{media.sizes.length} size{media.sizes.length === 1 ? '' : 's'}
                    </span>
                  )}
                </td>
                <td className="column-author" style={{ color: '#646970' }}>
                  {media.storage === 'bunny' ? 'Bunny CDN' : 'This server'}
                </td>
                <td className="column-date">{fmtDate(media.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="wp-tablenav">
        <Pagination
          page={library.data?.page || 1}
          pages={library.data?.pages || 1}
          total={library.data?.total || 0}
          onPage={setPage}
          noun="item"
        />
      </div>

      <AttachmentDetails
        media={details}
        onChange={setDetails}
        onClose={() => setDetails(null)}
        onSave={() => saveDetails.mutate(details)}
        saving={saveDetails.isPending}
        onDelete={() => askDelete([details._id], `“${details.originalName}”`)}
      />

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

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

/**
 * Says where new uploads land, and offers to move the stragglers.
 *
 * Switching an install to Bunny only redirects *new* uploads — everything
 * already on the server's disk stays there, and the next redeploy is what
 * turns that into missing images. So when both are true at once, the fix is
 * offered right here rather than left to be discovered later.
 */
function StorageNotice({ storage, migrating, onMigrate }) {
  if (!storage) return null
  const onBunny = storage.backend === 'bunny'

  if (onBunny && storage.local > 0) {
    return (
      <div className="wp-notice wp-notice-warning">
        <p>
          New uploads go to Bunny Storage, but <strong>{storage.local}</strong> earlier file
          {storage.local === 1 ? ' is' : 's are'} still on this server&rsquo;s disk, where a redeploy
          can remove {storage.local === 1 ? 'it' : 'them'}.{' '}
          <button
            type="button"
            className="wp-button wp-button-small"
            style={{ marginLeft: 6 }}
            onClick={onMigrate}
            disabled={migrating}
          >
            {migrating ? 'Moving…' : 'Move them to Bunny'}
          </button>
          {migrating && <Spinner />}
        </p>
      </div>
    )
  }

  if (!onBunny) {
    const missing = storage.missing || []
    // Some of it filled in is the confusing case: uploads keep going to disk
    // and the screen would otherwise read as though nothing had been set.
    const partial = missing.length > 0 && missing.length < 3
    return (
      <div className={`wp-notice wp-notice-${partial ? 'warning' : 'info'}`}>
        <p>
          Images are being stored on this server&rsquo;s own disk.{' '}
          {partial ? (
            <>
              Bunny Storage is half configured — still missing the{' '}
              {missing.map((field, index) => (
                <span key={field}>
                  {index > 0 && (index === missing.length - 1 ? ' and the ' : ', the ')}
                  <strong>{field}</strong>
                </span>
              ))}
              . Finish it under <Link to="/admin/integrations">Integrations</Link>.
            </>
          ) : (
            <>
              Add a Bunny Storage zone under <Link to="/admin/integrations">Integrations</Link> to
              serve them from the CDN instead and survive a redeploy.
            </>
          )}
        </p>
      </div>
    )
  }
  return null
}

/**
 * Offers to build the derivative sizes for images uploaded before they existed.
 *
 * Without this, an older image has only its original and the editor's Size
 * dropdown has nothing to offer for it — which reads as the feature being
 * broken rather than as the image predating it.
 */
function SizesNotice({ storage, running, onRun }) {
  if (!storage?.withoutSizes) return null
  return (
    <div className="wp-notice wp-notice-info">
      <p>
        <strong>{storage.withoutSizes}</strong> image
        {storage.withoutSizes === 1 ? ' has' : 's have'} no resized versions yet, so only the full
        size can be chosen in the editor.{' '}
        <button
          type="button"
          className="wp-button wp-button-small"
          style={{ marginLeft: 6 }}
          onClick={onRun}
          disabled={running}
        >
          {running ? 'Resizing…' : 'Generate sizes'}
        </button>
        {running && <Spinner />}
      </p>
    </div>
  )
}

function AttachmentDetails({ media, onChange, onClose, onSave, saving, onDelete }) {
  if (!media) return null
  return (
    <WpModal
      open
      title="Attachment Details"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="wp-button-link wp-button-link-delete" style={{ marginRight: 'auto' }} onClick={onDelete}>
            Delete permanently
          </button>
          <button type="button" className="wp-button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="wp-button wp-button-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <div className="wp-media-frame-body">
        <div style={{ padding: 16, display: 'grid', placeItems: 'center', background: '#f0f0f1' }}>
          <img src={media.url} alt={media.altText || ''} style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }} />
        </div>
        <aside className="wp-media-sidebar">
          <div className="wp-attachment-details" style={{ paddingTop: 16 }}>
            <p style={{ margin: 0, wordBreak: 'break-all' }}>
              <strong style={{ color: '#1d2327' }}>{media.originalName}</strong>
              <br />
              Uploaded {fmtDate(media.createdAt)} by {media.uploadedBy}
              <br />
              {fileSize(media.size)} · {media.mimeType}
              {media.width > 0 && (
                <>
                  <br />
                  {media.width} × {media.height} pixels
                </>
              )}
            </p>
            {media.sizes?.length > 0 && (
              <div>
                <strong style={{ color: '#1d2327' }}>Generated sizes</strong>
                <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
                  {media.sizes.map((variant) => (
                    <li key={variant.name} style={{ padding: '2px 0' }}>
                      <a href={variant.url} target="_blank" rel="noreferrer">
                        {SIZE_LABELS[variant.name] || variant.name}
                      </a>{' '}
                      — {variant.width} × {variant.height} · {fileSize(variant.size)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {[
              ['title', 'Title', 'input'],
              ['altText', 'Alt Text', 'textarea'],
              ['caption', 'Caption', 'textarea'],
              ['description', 'Description', 'textarea'],
            ].map(([key, label, kind]) => (
              <label key={key}>
                {label}
                {kind === 'input' ? (
                  <input type="text" value={media[key] || ''} onChange={(event) => onChange({ ...media, [key]: event.target.value })} />
                ) : (
                  <textarea
                    rows={key === 'altText' ? 2 : 3}
                    value={media[key] || ''}
                    onChange={(event) => onChange({ ...media, [key]: event.target.value })}
                  />
                )}
              </label>
            ))}
            <label>
              File URL
              <input type="text" readOnly value={media.url} onFocus={(event) => event.target.select()} />
            </label>
            <button
              type="button"
              className="wp-button wp-button-small"
              onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${media.url}`)}
            >
              Copy URL to clipboard
            </button>
          </div>
        </aside>
      </div>
    </WpModal>
  )
}

/* ------------------------------ upload screen ----------------------------- */

export function MediaUpload() {
  useDocumentTitle('Upload New Media | Growth Scholar Blog')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const notices = useNotices()
  const fileInput = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [done, setDone] = useState([])

  const upload = useMutation({
    mutationFn: async (files) => {
      const form = new FormData()
      for (const file of files) form.append('files', file)
      return (await api.post('/admin/media', form)).data
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'media'] })
      const uploaded = result.items || [result]
      setDone((rows) => [...uploaded, ...rows])
      notices.notify(`${uploaded.length} file${uploaded.length === 1 ? '' : 's'} uploaded.`)
    },
    onError: (err) => notices.notify(apiError(err), 'error'),
  })

  const take = (files) => {
    const list = Array.from(files || []).slice(0, 20)
    if (list.length) upload.mutate(list)
  }

  return (
    <div className="wp-wrap">
      <div className="wp-heading-row">
        <h1 className="wp-heading-inline">Upload New Media</h1>
        <Link to="/admin/blog/media" className="wp-button wp-page-title-action">
          Media Library
        </Link>
      </div>
      <hr className="wp-hr" />
      {notices.node}

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
        <Icon name="upload" size={40} style={{ fill: '#8c8f94' }} />
        <h2 style={{ fontSize: 22, fontWeight: 400 }}>Drop files to upload</h2>
        <p style={{ color: '#646970', margin: 0 }}>or</p>
        <button type="button" className="wp-button wp-button-large" onClick={() => fileInput.current?.click()}>
          Select Files
        </button>
        <p style={{ color: '#646970', fontSize: 12, margin: 0 }}>
          Maximum upload file size: 10 MB. JPG, PNG, WebP, GIF and AVIF are accepted.
        </p>
        {upload.isPending && <Spinner label="Uploading…" />}
      </div>

      {done.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '24px 0 10px' }}>Uploaded in this session</h2>
          <div className="wp-media-grid">
            {done.map((media) => (
              <button
                key={media._id}
                type="button"
                className="wp-attachment"
                onClick={() => navigate('/admin/blog/media')}
                title="Open in the Media Library"
              >
                <img src={media.url} alt={media.altText || media.originalName} />
                <span className="wp-attachment-filename">{media.originalName}</span>
              </button>
            ))}
          </div>
        </>
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
    </div>
  )
}
