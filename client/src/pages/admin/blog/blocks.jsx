import { forwardRef, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client.js'
import { embedFrom } from '../../../lib/embed.js'
import { highlightMarkers } from '../../../lib/richText.jsx'
import { Icon } from './wp.jsx'

/**
 * The block library and the canvas editing UI for each block type.
 *
 * Mirrors Gutenberg's model: every block is a named type with an icon, a
 * category and its own inspector settings. What it deliberately does not mirror
 * is Gutenberg's storage — see models/BlogPost.js for why a block is a set of
 * named fields rather than serialised HTML.
 */

export const BLOCK_LIBRARY = [
  { name: 'p', title: 'Paragraph', icon: 'paragraph', category: 'text', keywords: 'text copy write', description: 'Start with the basic building block of all narrative.' },
  { name: 'h2', title: 'Heading', icon: 'heading', category: 'text', keywords: 'title subtitle h2', description: 'Introduce new sections and organise content to help readers.' },
  { name: 'h3', title: 'Subheading', icon: 'heading', category: 'text', keywords: 'title h3', description: 'A second-level heading inside a section.' },
  { name: 'h4', title: 'Small heading', icon: 'heading', category: 'text', keywords: 'title h4', description: 'A third-level heading for short groupings.' },
  { name: 'ul', title: 'List', icon: 'list', category: 'text', keywords: 'bullet points ul', description: 'Create a bulleted list.' },
  { name: 'ol', title: 'Numbered list', icon: 'listNumbered', category: 'text', keywords: 'ordered steps ol', description: 'Create a numbered list of steps.' },
  { name: 'quote', title: 'Quote', icon: 'quote', category: 'text', keywords: 'blockquote citation', description: 'Give quoted text visual emphasis.' },
  { name: 'code', title: 'Code', icon: 'code', category: 'text', keywords: 'snippet preformatted', description: 'Display code snippets that respect your spacing.' },
  { name: 'table', title: 'Table', icon: 'table', category: 'text', keywords: 'rows columns grid', description: 'Create structured content in rows and columns.' },
  { name: 'callout', title: 'Callout', icon: 'callout', category: 'design', keywords: 'notice highlight tip box', description: 'Highlight a takeaway with an optional checklist.' },
  { name: 'image', title: 'Image', icon: 'image', category: 'media', keywords: 'photo picture img media', description: 'Insert an image to make a visual statement.' },
  { name: 'embed', title: 'Embed', icon: 'embed', category: 'media', keywords: 'video youtube vimeo iframe', description: 'Embed a YouTube or Vimeo video.' },
  { name: 'separator', title: 'Separator', icon: 'separator', category: 'design', keywords: 'divider hr rule line', description: 'Create a break between ideas or sections.' },
  { name: 'button', title: 'Button', icon: 'button', category: 'design', keywords: 'link cta call to action', description: 'Prompt visitors to take action with a styled link.' },
]

export const BLOCK_CATEGORIES = [
  ['text', 'Text'],
  ['media', 'Media'],
  ['design', 'Design'],
]

/** WordPress's own names for the generated sizes. */
export const SIZE_LABELS = {
  thumbnail: 'Thumbnail',
  medium: 'Medium',
  medium_large: 'Medium Large',
  large: 'Large',
  full: 'Full Size',
}

const BY_NAME = Object.fromEntries(BLOCK_LIBRARY.map((block) => [block.name, block]))
export const blockMeta = (type) => BY_NAME[type] || BY_NAME.p

/** Blocks where Enter starts the next block instead of adding a line break. */
export const SPLITS_ON_ENTER = new Set(['p', 'h2', 'h3', 'h4'])
const LIST_TYPES = new Set(['ul', 'ol'])

export const newBlock = (type = 'p') => {
  const block = { type, text: '', items: [] }
  if (type === 'table') block.rows = [{ cells: ['', '', ''] }, { cells: ['', '', ''] }]
  if (type === 'button') block.style = 'fill'
  return block
}

export const linesToItems = (value) => value.split('\n').map((line) => line.trim()).filter(Boolean)

/* --------------------------- auto-growing textarea ------------------------ */

export const AutoTextarea = forwardRef(function AutoTextarea({ value, className, ...rest }, ref) {
  const inner = useRef(null)
  const resize = (node) => {
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }
  useEffect(() => resize(inner.current), [value])
  return (
    <textarea
      ref={(node) => {
        inner.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
        resize(node)
      }}
      rows={1}
      value={value}
      className={className}
      {...rest}
    />
  )
})

/**
 * A textarea with its inline formatting painted behind it.
 *
 * The <textarea> stays the single source of truth for the text and the caret —
 * it is simply transparent, with the highlighted copy drawn underneath in the
 * same box. That keeps selection, undo, spellcheck and IME behaving like a real
 * text field, which a contentEditable canvas would have had to reimplement.
 */
export const RichTextarea = forwardRef(function RichTextarea({ value, className, ...rest }, ref) {
  return (
    <div className="editor-rich">
      <div className={`${className} editor-rich-mirror`} aria-hidden="true">
        {highlightMarkers(value)}
        {'\n'}
      </div>
      <AutoTextarea ref={ref} value={value} className={`${className} editor-rich-input`} {...rest} />
    </div>
  )
})

/* -------------------------------- canvas ---------------------------------- */

/**
 * One block on the canvas.
 *
 * `onKeys` receives the raw key event so the editor owns Enter/Backspace
 * behaviour across blocks (splitting, merging, focus movement) in one place
 * rather than each block type re-implementing it.
 */
export function BlockEdit({ block, index, onChange, onKeys, inputRef, onOpenMedia, slashMenu }) {
  const patch = (fields) => onChange({ ...block, ...fields })
  const common = {
    ref: inputRef,
    onKeyDown: (event) => onKeys(event, index, block),
    onFocus: () => undefined,
  }

  switch (block.type) {
    case 'h2':
    case 'h3':
    case 'h4':
      return (
        <RichTextarea
          {...common}
          className={`editor-block-input is-${block.type}`}
          value={block.text || ''}
          placeholder={block.type === 'h2' ? 'Heading' : block.type === 'h3' ? 'Subheading' : 'Small heading'}
          onChange={(event) => patch({ text: event.target.value })}
        />
      )

    case 'ul':
    case 'ol':
      return (
        <div style={{ display: 'grid', gap: 6 }}>
          <RichTextarea
            {...common}
            className="editor-block-input"
            value={(block.items || []).join('\n')}
            placeholder={`Write a ${block.type === 'ul' ? 'list' : 'numbered list'} item, one per line…`}
            onChange={(event) => patch({ items: event.target.value.split('\n') })}
            onBlur={() => patch({ items: (block.items || []).map((item) => item.trim()).filter(Boolean) })}
          />
          <p className="editor-hint">Each line becomes one {block.type === 'ul' ? 'bullet' : 'numbered'} item.</p>
        </div>
      )

    case 'quote':
      return (
        <div className="editor-block-quote">
          <RichTextarea
            {...common}
            className="editor-block-input is-quote"
            value={block.text || ''}
            placeholder="Write quote…"
            onChange={(event) => patch({ text: event.target.value })}
          />
          <input
            className="editor-block-cite"
            value={block.citation || ''}
            placeholder="Add citation"
            onChange={(event) => patch({ citation: event.target.value })}
          />
        </div>
      )

    case 'callout':
      return (
        <div className="editor-block-callout">
          <RichTextarea
            {...common}
            className="editor-block-input"
            value={block.text || ''}
            placeholder="Callout heading…"
            onChange={(event) => patch({ text: event.target.value })}
          />
          <AutoTextarea
            className="editor-block-input"
            style={{ fontSize: 15, marginTop: 8 }}
            value={(block.items || []).join('\n')}
            placeholder="Optional checklist, one item per line…"
            onChange={(event) => patch({ items: event.target.value.split('\n') })}
            onBlur={() => patch({ items: (block.items || []).map((item) => item.trim()).filter(Boolean) })}
          />
        </div>
      )

    case 'code':
      return (
        <AutoTextarea
          {...common}
          className="editor-block-input is-code"
          value={block.text || ''}
          placeholder="Write code…"
          spellCheck={false}
          onChange={(event) => patch({ text: event.target.value })}
        />
      )

    case 'separator':
      return <hr className="editor-block-separator" />

    case 'image':
      return block.url ? (
        <figure className={`editor-block-figure ${block.align ? `editor-align-${block.align}` : ''}`}>
          <img src={block.url} alt={block.alt || ''} />
          <input
            className="editor-block-caption"
            value={block.caption || ''}
            placeholder="Add caption"
            onChange={(event) => patch({ caption: event.target.value })}
          />
        </figure>
      ) : (
        <div className="editor-block-placeholder">
          <Icon name="image" size={36} style={{ fill: '#1e1e1e' }} />
          <strong style={{ fontSize: 15 }}>Image</strong>
          <p className="editor-hint" style={{ margin: 0 }}>
            Upload an image or pick one from the Media Library.
          </p>
          <button type="button" className="wp-button wp-button-primary" onClick={() => onOpenMedia(index)}>
            Media Library
          </button>
        </div>
      )

    case 'embed': {
      const parsed = embedFrom(block.url)
      return parsed ? (
        <figure className="editor-block-figure">
          <div
            style={{
              width: '100%',
              padding: '24px 16px',
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'grid',
              justifyItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="embed" size={32} style={{ fill: '#1e1e1e' }} />
            <strong style={{ fontSize: 14 }}>{parsed.provider} video</strong>
            <span style={{ fontSize: 12, color: '#757575', wordBreak: 'break-all' }}>{block.url}</span>
            <button type="button" className="wp-button wp-button-small" onClick={() => patch({ url: '' })}>
              Replace
            </button>
          </div>
          <input
            className="editor-block-caption"
            value={block.caption || ''}
            placeholder="Add caption"
            onChange={(event) => patch({ caption: event.target.value })}
          />
        </figure>
      ) : (
        <div className="editor-block-placeholder">
          <Icon name="embed" size={36} style={{ fill: '#1e1e1e' }} />
          <strong style={{ fontSize: 15 }}>Embed</strong>
          <p className="editor-hint" style={{ margin: 0 }}>
            Paste a YouTube or Vimeo link to embed it.
          </p>
          <div style={{ display: 'flex', gap: 6, width: '100%', maxWidth: 380 }}>
            <input
              style={{ flex: 1, minHeight: 32, padding: '4px 8px', border: '1px solid #949494', borderRadius: 2 }}
              defaultValue={block.url || ''}
              placeholder="https://www.youtube.com/watch?v=…"
              onBlur={(event) => patch({ url: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && patch({ url: event.currentTarget.value })}
            />
            <button type="button" className="wp-button wp-button-primary">
              Embed
            </button>
          </div>
          {block.url && <p className="editor-hint" style={{ color: '#b32d2e' }}>That link is not a YouTube or Vimeo video.</p>}
        </div>
      )
    }

    case 'button':
      return (
        <div className={block.align ? `editor-align-${block.align}` : ''}>
          <span className={`editor-block-button ${block.style === 'outline' ? 'is-outline' : ''}`}>
            <input
              {...common}
              value={block.text || ''}
              placeholder="Add text…"
              onChange={(event) => patch({ text: event.target.value })}
              style={{
                border: 0,
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                outline: 0,
                textAlign: 'center',
                width: `${Math.max((block.text || 'Add text…').length, 8)}ch`,
              }}
            />
          </span>
        </div>
      )

    case 'table': {
      const rows = block.rows?.length ? block.rows : [{ cells: ['', ''] }]
      const setCell = (r, c, value) =>
        patch({
          rows: rows.map((row, ri) =>
            ri === r ? { cells: row.cells.map((cell, ci) => (ci === c ? value : cell)) } : row,
          ),
        })
      return (
        <table className="editor-block-table">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={r === 0 && block.header ? 'is-header' : ''}>
                {row.cells.map((cell, c) => (
                  <td key={c}>
                    <input
                      value={cell}
                      placeholder={r === 0 && block.header ? 'Header' : 'Cell'}
                      onChange={(event) => setCell(r, c, event.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    default:
      return (
        <div style={{ position: 'relative' }}>
          <RichTextarea
            {...common}
            className="editor-block-input"
            value={block.text || ''}
            placeholder="Type / to choose a block"
            onChange={(event) => patch({ text: event.target.value })}
          />
          {slashMenu}
        </div>
      )
  }
}

/**
 * Chooses which generated size of an image the block points at.
 *
 * The list comes from the attachment rather than from a fixed set of names,
 * because an image that was too small for a size never had that size rendered —
 * offering "Large" for a 600px upload would resolve to an upscaled blur. An
 * image placed before sizes existed simply shows nothing to choose.
 */
function ImageSizePicker({ block, onChange }) {
  const { data } = useQuery({
    queryKey: ['admin', 'media', 'item', block.mediaId],
    queryFn: async () => (await api.get(`/admin/media/${block.mediaId}`)).data,
    enabled: Boolean(block.mediaId),
    staleTime: 60_000,
  })

  if (!block.mediaId) return null
  const options = [
    ...(data?.sizes || []).map((size) => ({ ...size, label: SIZE_LABELS[size.name] || size.name })),
    ...(data ? [{ name: 'full', label: 'Full Size', url: data.url, width: data.width, height: data.height }] : []),
  ]
  if (options.length < 2) return null
  const current = options.find((option) => option.url === block.url)?.name || 'full'

  return (
    <label className="editor-field">
      <span>Image size</span>
      <select
        value={current}
        onChange={(event) => {
          const next = options.find((option) => option.name === event.target.value)
          if (next) onChange({ ...block, url: next.url, width: next.width, height: next.height })
        }}
      >
        {options.map((option) => (
          <option key={option.name} value={option.name}>
            {option.label} – {option.width} × {option.height}
          </option>
        ))}
      </select>
    </label>
  )
}

/* ------------------------------- inspector -------------------------------- */

/** The Block tab of the sidebar: settings for whichever block is selected. */
export function BlockSettings({ block, onChange, onOpenMedia, index }) {
  const meta = blockMeta(block.type)
  const patch = (fields) => onChange({ ...block, ...fields })
  const alignments = [
    ['left', 'alignLeft', 'Align left'],
    ['center', 'alignCenter', 'Align centre'],
    ['right', 'alignRight', 'Align right'],
  ]

  return (
    <>
      <div className="editor-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name={meta.icon} size={24} />
          <div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 13 }}>{meta.title}</p>
          </div>
        </div>
        <p className="editor-hint" style={{ marginTop: 8 }}>
          {meta.description}
        </p>
      </div>

      {['image', 'button'].includes(block.type) && (
        <div className="editor-panel">
          <p className="editor-panel-title" style={{ marginBottom: 10 }}>
            Alignment
          </p>
          <div style={{ display: 'flex', gap: 4 }}>
            {alignments.map(([value, icon, label]) => (
              <button
                key={value}
                type="button"
                className={`editor-icon-button ${block.align === value ? 'is-pressed' : ''}`}
                aria-label={label}
                onClick={() => patch({ align: block.align === value ? '' : value })}
              >
                <Icon name={icon} size={20} />
              </button>
            ))}
          </div>
        </div>
      )}

      {block.type === 'image' && (
        <div className="editor-panel">
          <div className="editor-panel-body" style={{ marginTop: 0 }}>
            <button type="button" className="wp-button" onClick={() => onOpenMedia(index)}>
              {block.url ? 'Replace image' : 'Select image'}
            </button>
            <ImageSizePicker block={block} onChange={onChange} />
            <label className="editor-field">
              <span>Alternative text</span>
              <textarea
                rows={3}
                value={block.alt || ''}
                onChange={(event) => patch({ alt: event.target.value })}
                placeholder="Describe the purpose of the image."
              />
            </label>
            <p className="editor-hint">Leave empty if the image is purely decorative.</p>
            <label className="editor-field">
              <span>Link to</span>
              <input type="url" value={block.href || ''} onChange={(event) => patch({ href: event.target.value })} />
            </label>
          </div>
        </div>
      )}

      {block.type === 'button' && (
        <div className="editor-panel">
          <div className="editor-panel-body" style={{ marginTop: 0 }}>
            <label className="editor-field">
              <span>Link</span>
              <input
                type="url"
                value={block.url || ''}
                placeholder="https://"
                onChange={(event) => patch({ url: event.target.value })}
              />
            </label>
            <label className="editor-field">
              <span>Style</span>
              <select value={block.style || 'fill'} onChange={(event) => patch({ style: event.target.value })}>
                <option value="fill">Fill</option>
                <option value="outline">Outline</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {block.type === 'code' && (
        <div className="editor-panel">
          <label className="editor-field">
            <span>Language</span>
            <input
              type="text"
              value={block.language || ''}
              placeholder="javascript"
              onChange={(event) => patch({ language: event.target.value })}
            />
          </label>
        </div>
      )}

      {block.type === 'table' && (
        <div className="editor-panel">
          <div className="editor-panel-body" style={{ marginTop: 0 }}>
            <div className="editor-row">
              <span>Header row</span>
              <button
                type="button"
                className={`editor-toggle ${block.header ? 'is-on' : ''}`}
                aria-pressed={Boolean(block.header)}
                onClick={() => patch({ header: !block.header })}
              >
                <span />
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <button
                type="button"
                className="wp-button wp-button-small"
                onClick={() =>
                  patch({ rows: [...(block.rows || []), { cells: Array(block.rows?.[0]?.cells.length || 3).fill('') }] })
                }
              >
                + Row
              </button>
              <button
                type="button"
                className="wp-button wp-button-small"
                onClick={() => patch({ rows: (block.rows || []).map((row) => ({ cells: [...row.cells, ''] })) })}
              >
                + Column
              </button>
              <button
                type="button"
                className="wp-button wp-button-small"
                disabled={(block.rows?.length || 0) <= 1}
                onClick={() => patch({ rows: (block.rows || []).slice(0, -1) })}
              >
                − Row
              </button>
              <button
                type="button"
                className="wp-button wp-button-small"
                disabled={(block.rows?.[0]?.cells.length || 0) <= 1}
                onClick={() => patch({ rows: (block.rows || []).map((row) => ({ cells: row.cells.slice(0, -1) })) })}
              >
                − Column
              </button>
            </div>
          </div>
        </div>
      )}

      {LIST_TYPES.has(block.type) && (
        <div className="editor-panel">
          <label className="editor-field">
            <span>Introduction</span>
            <textarea
              rows={2}
              value={block.text || ''}
              placeholder="Optional line above the list"
              onChange={(event) => patch({ text: event.target.value })}
            />
          </label>
        </div>
      )}

      {['embed'].includes(block.type) && (
        <div className="editor-panel">
          <label className="editor-field">
            <span>Video URL</span>
            <input type="url" value={block.url || ''} onChange={(event) => patch({ url: event.target.value })} />
          </label>
          <p className="editor-hint" style={{ marginTop: 8 }}>
            YouTube and Vimeo links are supported.
          </p>
        </div>
      )}
    </>
  )
}
