import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../../api/client.js'
import useDocumentTitle from '../../../hooks/useDocumentTitle.js'
import { Icon, Spinner, useNotices } from './wp.jsx'

/**
 * Tools → Import / Export.
 *
 * The export is a plain JSON file of every post; the import takes the same file
 * back. Posts are matched on slug, so re-importing an export updates the posts
 * it already knows instead of duplicating them — that is what makes the file
 * useful as a backup rather than only as a copy.
 */
export default function Tools() {
  useDocumentTitle('Tools | Growth Scholar Blog')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'import' ? 'import' : 'export'
  const notices = useNotices()
  const queryClient = useQueryClient()
  const fileInput = useRef(null)

  const [status, setStatus] = useState('')
  const [mode, setMode] = useState('overwrite')
  const [preview, setPreview] = useState(null)
  const [exporting, setExporting] = useState(false)

  const runImport = useMutation({
    mutationFn: async (payload) => (await api.post('/admin/blog/import', payload)).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] })
      queryClient.invalidateQueries({ queryKey: ['blog'] })
      setPreview(null)
      notices.notify(
        `Import finished — ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`,
      )
    },
    onError: (err) => notices.notify(apiError(err), 'error'),
  })

  const download = async () => {
    setExporting(true)
    try {
      const { data } = await api.get('/admin/blog/export', { params: status ? { status } : {} })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `growth-scholar-blog-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      notices.notify(`Exported ${data.count} post${data.count === 1 ? '' : 's'}.`)
    } catch (err) {
      notices.notify(apiError(err), 'error')
    } finally {
      setExporting(false)
    }
  }

  const readFile = async (file) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const posts = Array.isArray(parsed) ? parsed : parsed.posts
      if (!Array.isArray(posts) || !posts.length) throw new Error('No posts found in that file')
      setPreview({ name: file.name, posts })
    } catch (err) {
      notices.notify(`Could not read that file — ${err.message}`, 'error')
      setPreview(null)
    }
  }

  return (
    <div className="wp-wrap">
      <h1 className="wp-heading-inline">Tools</h1>
      <hr className="wp-hr" />
      {notices.node}

      <ul className="wp-subsubsub">
        {[
          ['export', 'Export'],
          ['import', 'Import'],
        ].map(([value, label]) => (
          <li key={value}>
            <button
              type="button"
              className={tab === value ? 'is-current' : ''}
              onClick={() => setSearchParams({ tab: value })}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'export' ? (
        <div className="wp-postbox" style={{ maxWidth: 780, marginTop: 16 }}>
          <div className="wp-postbox-header" style={{ cursor: 'default' }}>
            <h2 className="wp-postbox-title">Export</h2>
          </div>
          <div className="wp-postbox-body">
            <p style={{ marginTop: 0 }}>
              Download a JSON file with your posts, their blocks, taxonomy and SEO fields. Keep it as a backup, or
              import it into another Growth Scholar install.
            </p>
            <table className="wp-form-table">
              <tbody>
                <tr>
                  <th scope="row">Choose what to export</th>
                  <td>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input type="radio" checked={status === ''} onChange={() => setStatus('')} />
                      All posts (everything except the Trash)
                    </label>
                    {['Published', 'Draft', 'Scheduled'].map((value) => (
                      <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <input type="radio" checked={status === value} onChange={() => setStatus(value)} />
                        {value} posts only
                      </label>
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>
            <button type="button" className="wp-button wp-button-primary" onClick={download} disabled={exporting}>
              {exporting ? 'Preparing…' : 'Download Export File'}
            </button>
            {exporting && <Spinner />}
          </div>
        </div>
      ) : (
        <div className="wp-postbox" style={{ maxWidth: 780, marginTop: 16 }}>
          <div className="wp-postbox-header" style={{ cursor: 'default' }}>
            <h2 className="wp-postbox-title">Import</h2>
          </div>
          <div className="wp-postbox-body">
            <p style={{ marginTop: 0 }}>
              Upload a Growth Scholar export file. Posts are matched on their URL slug.
            </p>
            <div
              className="wp-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                readFile(event.dataTransfer.files?.[0])
              }}
            >
              <Icon name="upload" size={32} style={{ fill: '#8c8f94' }} />
              <p style={{ margin: 0 }}>Drop a .json export file here</p>
              <button type="button" className="wp-button" onClick={() => fileInput.current?.click()}>
                Choose File
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(event) => {
                  readFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </div>

            {preview && (
              <>
                <div className="wp-notice wp-notice-info" style={{ marginTop: 16 }}>
                  <p>
                    <strong>{preview.name}</strong> contains {preview.posts.length} post
                    {preview.posts.length === 1 ? '' : 's'}.
                  </p>
                </div>
                <table className="wp-form-table">
                  <tbody>
                    <tr>
                      <th scope="row">Existing posts</th>
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <input type="radio" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} />
                          Update a post when its slug already exists
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="radio" checked={mode === 'skip'} onChange={() => setMode('skip')} />
                          Skip it and keep what is here
                        </label>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <ul style={{ margin: '0 0 16px', maxHeight: 180, overflowY: 'auto', border: '1px solid #dcdcde' }}>
                  {preview.posts.slice(0, 50).map((post, index) => (
                    <li key={index} style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f1', fontSize: 13 }}>
                      <strong>{post.title || '(no title)'}</strong>{' '}
                      <span style={{ color: '#646970' }}>— {post.status || 'Draft'}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    className="wp-button wp-button-primary"
                    disabled={runImport.isPending}
                    onClick={() => runImport.mutate({ posts: preview.posts, mode })}
                  >
                    {runImport.isPending ? 'Importing…' : 'Run Importer'}
                  </button>
                  <button type="button" className="wp-button" onClick={() => setPreview(null)}>
                    Cancel
                  </button>
                  {runImport.isPending && <Spinner />}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
