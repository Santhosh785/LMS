import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../../api/client.js'
import useDocumentTitle from '../../../hooks/useDocumentTitle.js'
import { insertLink, plainText, toggleMarker } from '../../../lib/richText.jsx'
import {
  AutoTextarea,
  BLOCK_CATEGORIES,
  BLOCK_LIBRARY,
  BlockEdit,
  BlockSettings,
  blockMeta,
  linesToItems,
  newBlock,
  SPLITS_ON_ENTER,
} from './blocks.jsx'
import MediaFrame from './MediaFrame.jsx'
import { ConfirmDialog, fmtDateTime, Icon, Spinner, toLocalInput, useDismissable, WpModal } from './wp.jsx'
import '../../../styles/wp-admin.css'
import '../../../styles/wp-editor.css'

/**
 * The block editor.
 *
 * Gutenberg's shape, in full: a block inserter, slash commands, a floating
 * block toolbar with inline formatting, a document list view, a two-tab
 * inspector, the pre-publish and post-publish panels, autosave, undo/redo and
 * the keyboard shortcuts an editor's hands already know.
 */

const EMPTY_POST = () => ({
  title: '',
  slug: '',
  excerpt: '',
  category: '',
  categories: [],
  tags: [],
  body: [newBlock('p')],
  status: 'Draft',
  visibility: 'Public',
  password: '',
  publishedAt: new Date().toISOString(),
  readTime: '',
  featured: false,
  allowComments: false,
  image: '',
  imageAlt: '',
  heroClass: 'feat-seo',
  heroLabel: '',
  seo: { metaTitle: '', metaDescription: '', canonicalUrl: '', ogImage: '', focusKeyword: '', noIndex: false },
  revisions: [],
})

const SHORTCUTS = [
  ['Ctrl/⌘ + S', 'Save the post'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Shift + Z', 'Redo'],
  ['Ctrl/⌘ + B', 'Bold the selected text'],
  ['Ctrl/⌘ + I', 'Italicise the selected text'],
  ['Ctrl/⌘ + K', 'Turn the selected text into a link'],
  ['Ctrl/⌘ + Shift + ,', 'Show or hide the settings sidebar'],
  ['/', 'Change an empty paragraph into another block'],
  ['Enter', 'Start a new block'],
  ['Backspace', 'Remove an empty block'],
  ['Escape', 'Clear the block selection'],
]

const isEmptyBlock = (block) =>
  !String(block.text || '').trim() &&
  !(block.items || []).join('').trim() &&
  !block.url &&
  !['separator', 'table'].includes(block.type)

const mainField = (type) => (type === 'ul' || type === 'ol' ? 'items' : 'text')

/**
 * The wall clock as state.
 *
 * "Is this post scheduled?" depends on the current time, which is an external
 * value — reading it during render would make the component non-idempotent, so
 * it is subscribed to here and ticks once a minute.
 */
function useNow() {
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export default function PostEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [post, setPost] = useState(EMPTY_POST)
  const [selected, setSelected] = useState(null)
  const [sidebar, setSidebar] = useState('post')
  const [leftPanel, setLeftPanel] = useState('')
  const [device, setDevice] = useState('desktop')
  const [publishPanel, setPublishPanel] = useState('')
  const [menu, setMenu] = useState('')
  const [mediaFor, setMediaFor] = useState(null)
  const [snackbars, setSnackbars] = useState([])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [slashIndex, setSlashIndex] = useState(0)

  const inputs = useRef({})
  const stamp = useRef(0)
  const [history, setHistory] = useState({ past: [], future: [] })
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const now = useNow()

  const loaded = useQuery({
    queryKey: ['admin', 'blog', 'post', id],
    queryFn: async () => (await api.get(`/admin/blog/${id}`)).data,
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (!loaded.data) return
    const next = {
      ...EMPTY_POST(),
      ...loaded.data,
      body: loaded.data.body?.length ? loaded.data.body : [newBlock('p')],
      seo: { ...EMPTY_POST().seo, ...(loaded.data.seo || {}) },
    }
    setPost(next)
    setSavedSnapshot(JSON.stringify(next))
  }, [loaded.data])

  useDocumentTitle(`${post.title || 'Add New Post'} | Growth Scholar Blog`)

  const snack = useCallback((message, action) => {
    const key = Math.random().toString(36).slice(2)
    setSnackbars((rows) => [...rows, { key, message, action }])
    setTimeout(() => setSnackbars((rows) => rows.filter((row) => row.key !== key)), 5000)
  }, [])

  /* ------------------------------- history ------------------------------- */

  /**
   * Every change goes through `commit` so undo has something to go back to.
   * Consecutive keystrokes coalesce into one history entry — otherwise a single
   * Ctrl+Z would rub out one character rather than the edit the writer made.
   */
  const commit = useCallback(
    (updater, { coalesce = false } = {}) => {
      const at = Date.now()
      if (!coalesce || at - stamp.current > 900) {
        setHistory((current) => ({ past: [...current.past, post].slice(-60), future: [] }))
        stamp.current = at
      }
      setPost((current) => (typeof updater === 'function' ? updater(current) : updater))
    },
    [post],
  )

  const undo = useCallback(() => {
    const previous = history.past.at(-1)
    if (!previous) return
    setHistory({ past: history.past.slice(0, -1), future: [post, ...history.future].slice(0, 60) })
    setPost(previous)
    stamp.current = 0
  }, [history, post])

  const redo = useCallback(() => {
    const next = history.future[0]
    if (!next) return
    setHistory({ past: [...history.past, post].slice(-60), future: history.future.slice(1) })
    setPost(next)
    stamp.current = 0
  }, [history, post])

  /* -------------------------------- saving -------------------------------- */

  const snapshot = JSON.stringify(post)
  const dirty = snapshot !== savedSnapshot
  const [savedAt, setSavedAt] = useState(null)

  const save = useMutation({
    mutationFn: async ({ patch = {}, autosave = false }) => {
      const payload = { ...post, ...patch }
      if (payload._id) {
        return (await api.put(`/admin/blog/${payload._id}`, payload, { params: autosave ? { autosave: true } : {} })).data
      }
      return (await api.post('/admin/blog', payload)).data
    },
    onSuccess: (saved, variables) => {
      const next = { ...EMPTY_POST(), ...saved, body: saved.body?.length ? saved.body : [newBlock('p')], seo: { ...EMPTY_POST().seo, ...(saved.seo || {}) } }
      setPost(next)
      setSavedSnapshot(JSON.stringify(next))
      setSavedAt(new Date())
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] })
      queryClient.invalidateQueries({ queryKey: ['blog'] })
      if (!id) navigate(`/admin/blog/post/${saved._id}`, { replace: true })
      if (variables.autosave) return
      if (variables.published) setPublishPanel('published')
      else snack(saved.status === 'Published' ? 'Post updated.' : 'Draft saved.')
    },
    onError: (err) => snack(apiError(err)),
  })

  // WordPress autosaves a post it already knows about; an unsaved new post
  // stays in the browser until the writer decides to keep it.
  const autosave = save.mutate
  useEffect(() => {
    if (!post._id || !dirty) return undefined
    const timer = setTimeout(() => autosave({ autosave: true }), 8000)
    return () => clearTimeout(timer)
  }, [snapshot, dirty, post._id, autosave])

  /* -------------------------------- blocks -------------------------------- */

  const body = useMemo(() => post.body || [], [post.body])
  const setField = (key, value) => commit((current) => ({ ...current, [key]: value }), { coalesce: true })
  const setSeo = (key, value) =>
    commit((current) => ({ ...current, seo: { ...current.seo, [key]: value } }), { coalesce: true })

  const updateBlock = (index, next) =>
    commit(
      (current) => ({ ...current, body: current.body.map((block, i) => (i === index ? next : block)) }),
      { coalesce: true },
    )

  const focusBlock = (index) => {
    setSelected(index)
    requestAnimationFrame(() => {
      const node = inputs.current[index]
      if (node) {
        node.focus()
        const end = node.value?.length ?? 0
        node.setSelectionRange?.(end, end)
      }
    })
  }

  const insertBlock = (block, at = body.length) => {
    commit((current) => {
      const next = [...current.body]
      next.splice(at, 0, block)
      return { ...current, body: next }
    })
    focusBlock(at)
    setSidebar((value) => (value === 'block' ? 'block' : value))
  }

  const removeBlock = (index) => {
    commit((current) => {
      const next = current.body.filter((_, i) => i !== index)
      return { ...current, body: next.length ? next : [newBlock('p')] }
    })
    setSelected(null)
  }

  const moveBlock = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= body.length) return
    commit((current) => {
      const next = [...current.body]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...current, body: next }
    })
    setSelected(target)
  }

  const transform = (index, type) => {
    const block = body[index]
    const next = { ...newBlock(type), text: block.text || '', items: block.items || [] }
    if (type === 'ul' || type === 'ol') {
      next.items = block.items?.length ? block.items : linesToItems(block.text || '')
      next.text = ''
    }
    if (mainField(type) === 'text' && !next.text && block.items?.length) next.text = block.items.join('\n')
    updateBlock(index, next)
    focusBlock(index)
  }

  /* ------------------------------ slash menu ------------------------------ */

  const slashQuery =
    selected !== null && body[selected]?.type === 'p' && (body[selected].text || '').startsWith('/')
      ? body[selected].text.slice(1).toLowerCase()
      : null
  const slashMatches = useMemo(
    () =>
      slashQuery === null
        ? []
        : BLOCK_LIBRARY.filter(
            (block) =>
              !slashQuery ||
              block.title.toLowerCase().includes(slashQuery) ||
              block.keywords.includes(slashQuery),
          ).slice(0, 8),
    [slashQuery],
  )
  useEffect(() => setSlashIndex(0), [slashQuery])

  const runSlash = (type) => {
    updateBlock(selected, newBlock(type))
    focusBlock(selected)
  }

  /* ----------------------------- formatting ------------------------------- */

  const applyFormat = (marker, url) => {
    if (selected === null) return
    const node = inputs.current[selected]
    if (!node || typeof node.selectionStart !== 'number') return
    const block = body[selected]
    const result = url
      ? insertLink(node.value, node.selectionStart, node.selectionEnd, url)
      : toggleMarker(node.value, node.selectionStart, node.selectionEnd, marker)
    if (!result) return
    const field = mainField(block.type)
    updateBlock(selected, {
      ...block,
      ...(field === 'items' ? { items: result.value.split('\n') } : { text: result.value }),
    })
    requestAnimationFrame(() => {
      node.focus()
      node.setSelectionRange(result.start, result.end)
    })
  }

  const promptLink = () => {
    const url = window.prompt('Enter a URL')
    if (url) applyFormat(null, url)
  }

  /* ------------------------------- keyboard ------------------------------- */

  const onKeys = (event, index, block) => {
    if (slashQuery !== null && slashMatches.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        return setSlashIndex((value) => (value + 1) % slashMatches.length)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        return setSlashIndex((value) => (value - 1 + slashMatches.length) % slashMatches.length)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        return runSlash(slashMatches[slashIndex].name)
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        return updateBlock(index, { ...block, text: '' })
      }
    }
    if (event.key === 'Enter' && !event.shiftKey && SPLITS_ON_ENTER.has(block.type)) {
      event.preventDefault()
      return insertBlock(newBlock('p'), index + 1)
    }
    if (event.key === 'Backspace' && isEmptyBlock(block) && body.length > 1) {
      event.preventDefault()
      removeBlock(index)
      return focusBlock(Math.max(0, index - 1))
    }
    if (event.key === 'ArrowUp' && event.target.selectionStart === 0 && index > 0) {
      event.preventDefault()
      return focusBlock(index - 1)
    }
    if (
      event.key === 'ArrowDown' &&
      event.target.selectionStart === (event.target.value?.length ?? 0) &&
      index < body.length - 1
    ) {
      event.preventDefault()
      return focusBlock(index + 1)
    }
    return undefined
  }

  useEffect(() => {
    const onKey = (event) => {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        save.mutate({})
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        redo()
      } else if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        applyFormat('bold')
      } else if (mod && event.key.toLowerCase() === 'i') {
        event.preventDefault()
        applyFormat('italic')
      } else if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        promptLink()
      } else if (mod && event.shiftKey && event.key === ',') {
        event.preventDefault()
        setSidebar((value) => (value ? '' : 'post'))
      } else if (event.key === 'Escape' && !shortcutsOpen) {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* -------------------------------- derived ------------------------------- */

  const words = useMemo(
    () =>
      body.reduce((total, block) => {
        const text = [plainText(block.text), ...(block.items || []).map(plainText)].join(' ')
        return total + text.trim().split(/\s+/).filter(Boolean).length
      }, 0),
    [body],
  )
  const headings = body.filter((block) => ['h2', 'h3', 'h4'].includes(block.type)).length
  const published = post.status === 'Published'
  const scheduled = new Date(post.publishedAt).getTime() > now
  const selectedBlock = selected !== null ? body[selected] : null
  const canFormat = selectedBlock && !['separator', 'image', 'embed', 'table'].includes(selectedBlock.type)

  const publishNow = () =>
    save.mutate({ patch: { status: 'Published' }, published: true })

  return (
    <div className="wp-editor">
      <header className="editor-header">
        <div className="editor-header-group">
          <button
            type="button"
            className="editor-icon-button"
            aria-label="Back to posts"
            onClick={() =>
              dirty
                ? setConfirm({
                    title: 'Leave the editor?',
                    message: 'This post has unsaved changes. Leave without saving them?',
                    confirmLabel: 'Leave',
                    onConfirm: () => navigate('/admin/blog'),
                  })
                : navigate('/admin/blog')
            }
          >
            <Icon name="arrowLeft" size={24} />
          </button>
          <button
            type="button"
            className={`editor-icon-button editor-inserter-toggle ${leftPanel === 'inserter' ? 'is-open' : ''}`}
            aria-label="Toggle block inserter"
            aria-expanded={leftPanel === 'inserter'}
            onClick={() => setLeftPanel(leftPanel === 'inserter' ? '' : 'inserter')}
          >
            <Icon name="plus" size={24} />
          </button>
          <button
            type="button"
            className="editor-icon-button"
            aria-label="Undo"
            disabled={!history.past.length}
            onClick={undo}
          >
            <Icon name="undo" size={24} />
          </button>
          <button
            type="button"
            className="editor-icon-button"
            aria-label="Redo"
            disabled={!history.future.length}
            onClick={redo}
          >
            <Icon name="redo" size={24} />
          </button>
          <button
            type="button"
            className={`editor-icon-button ${leftPanel === 'listview' ? 'is-pressed' : ''}`}
            aria-label="Document overview"
            aria-expanded={leftPanel === 'listview'}
            onClick={() => setLeftPanel(leftPanel === 'listview' ? '' : 'listview')}
          >
            <Icon name="listView" size={24} />
          </button>
        </div>

        <button type="button" className="editor-document-bar" onClick={() => setSidebar('post')}>
          <Icon name="post" size={16} />
          <span className="title">{post.title || 'No title'}</span>
          <span className="kind">· Post</span>
        </button>

        <div className="editor-header-right">
          {save.isPending ? (
            <span className="editor-saved-note">
              <Spinner /> Saving…
            </span>
          ) : dirty ? (
            <button type="button" className="editor-text-button" onClick={() => save.mutate({})}>
              {post._id ? 'Save draft' : 'Save draft'}
            </button>
          ) : (
            <span className="editor-saved-note">
              <Icon name="check" size={16} /> Saved
            </span>
          )}

          <Dropdown
            id="preview"
            open={menu === 'preview'}
            onToggle={() => setMenu(menu === 'preview' ? '' : 'preview')}
            label={<Icon name="visibility" size={24} />}
            ariaLabel="Preview"
            buttonClass="editor-icon-button"
          >
            {(close) => (
              <>
                <div className="editor-dropdown-heading">Preview</div>
                {[
                  ['desktop', 'Desktop'],
                  ['tablet', 'Tablet'],
                  ['mobile', 'Mobile'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={device === value ? 'is-selected' : ''}
                    onClick={() => {
                      setDevice(value)
                      close()
                    }}
                  >
                    {label}
                  </button>
                ))}
                <hr />
                <button
                  type="button"
                  disabled={!post.slug}
                  onClick={() => {
                    close()
                    window.open(`/blog/${post.slug}`, '_blank', 'noopener')
                  }}
                >
                  Preview in new tab
                </button>
              </>
            )}
          </Dropdown>

          <button
            type="button"
            className="editor-primary-button"
            disabled={save.isPending}
            onClick={() => (published ? save.mutate({}) : setPublishPanel('pre'))}
          >
            {published ? 'Update' : scheduled ? 'Schedule…' : 'Publish'}
          </button>

          <button
            type="button"
            className={`editor-icon-button ${sidebar ? 'is-pressed' : ''}`}
            aria-label="Settings"
            aria-expanded={Boolean(sidebar)}
            onClick={() => setSidebar(sidebar ? '' : 'post')}
          >
            <Icon name="sidebar" size={24} />
          </button>

          <Dropdown
            id="more"
            open={menu === 'more'}
            onToggle={() => setMenu(menu === 'more' ? '' : 'more')}
            label={<Icon name="more" size={24} />}
            ariaLabel="Options"
            buttonClass="editor-icon-button"
          >
            {(close) => (
              <>
                <div className="editor-dropdown-heading">View</div>
                <button
                  type="button"
                  className={sidebar ? 'is-selected' : ''}
                  onClick={() => {
                    setSidebar(sidebar ? '' : 'post')
                    close()
                  }}
                >
                  Settings <span className="shortcut">⌘⇧,</span>
                </button>
                <button
                  type="button"
                  className={leftPanel === 'listview' ? 'is-selected' : ''}
                  onClick={() => {
                    setLeftPanel(leftPanel === 'listview' ? '' : 'listview')
                    close()
                  }}
                >
                  Document overview
                </button>
                <hr />
                <div className="editor-dropdown-heading">Tools</div>
                <button
                  type="button"
                  onClick={() => {
                    setShortcutsOpen(true)
                    close()
                  }}
                >
                  Keyboard shortcuts
                </button>
                <button
                  type="button"
                  disabled={!post.slug}
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/blog/${post.slug}`)
                    snack('Post link copied to the clipboard.')
                    close()
                  }}
                >
                  Copy link
                </button>
                <hr />
                <button
                  type="button"
                  disabled={!post._id}
                  style={{ color: '#b32d2e' }}
                  onClick={() => {
                    close()
                    setConfirm({
                      title: 'Move to Trash',
                      message: `Move “${post.title || 'this post'}” to the Trash? You can restore it from the Trash view.`,
                      confirmLabel: 'Move to Trash',
                      destructive: true,
                      onConfirm: async () => {
                        await api.post(`/admin/blog/${post._id}/trash`)
                        queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] })
                        navigate('/admin/blog')
                      },
                    })
                  }}
                >
                  Move to Trash
                </button>
              </>
            )}
          </Dropdown>
        </div>
      </header>

      <div className="editor-body">
        {leftPanel === 'inserter' && <Inserter onInsert={(type) => insertBlock(newBlock(type), selected === null ? body.length : selected + 1)} />}
        {leftPanel === 'listview' && (
          <ListView
            body={body}
            selected={selected}
            words={words}
            headings={headings}
            onSelect={focusBlock}
            onMove={moveBlock}
          />
        )}

        <main className={`editor-canvas is-${device}`}>
          <div className="editor-canvas-frame">
            <div className="editor-content">
              <AutoTextarea
                className="editor-post-title"
                value={post.title || ''}
                placeholder="Add title"
                aria-label="Add title"
                onChange={(event) => setField('title', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    focusBlock(0)
                  }
                }}
              />

              <div className="editor-blocks">
                {body.map((block, index) => (
                  <section
                    key={index}
                    className={`editor-block ${selected === index ? 'is-selected' : ''}`}
                    onMouseDown={() => {
                      setSelected(index)
                      if (sidebar) setSidebar('block')
                    }}
                  >
                    {selected === index && (
                      <>
                        <div className="editor-block-movers">
                          <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => moveBlock(index, -1)}>
                            <Icon name="arrowUp" size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            disabled={index === body.length - 1}
                            onClick={() => moveBlock(index, 1)}
                          >
                            <Icon name="arrowDown" size={16} />
                          </button>
                        </div>
                        <BlockToolbar
                          block={block}
                          index={index}
                          canFormat={canFormat}
                          onTransform={(type) => transform(index, type)}
                          onFormat={applyFormat}
                          onLink={promptLink}
                          onDuplicate={() => insertBlock({ ...block }, index + 1)}
                          onInsertAfter={() => insertBlock(newBlock('p'), index + 1)}
                          onRemove={() => removeBlock(index)}
                        />
                      </>
                    )}
                    <BlockEdit
                      block={block}
                      index={index}
                      onChange={(next) => updateBlock(index, next)}
                      onKeys={onKeys}
                      inputRef={(node) => {
                        inputs.current[index] = node
                      }}
                      onOpenMedia={(target) => setMediaFor(target)}
                      slashMenu={
                        selected === index && slashQuery !== null && slashMatches.length ? (
                          <div className="editor-slash-menu">
                            {slashMatches.map((match, matchIndex) => (
                              <button
                                key={match.name}
                                type="button"
                                className={`editor-slash-item ${matchIndex === slashIndex ? 'is-active' : ''}`}
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  runSlash(match.name)
                                }}
                              >
                                <Icon name={match.icon} size={24} />
                                <span>
                                  {match.title}
                                  <span className="desc" style={{ display: 'block' }}>
                                    {match.category}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null
                      }
                    />
                  </section>
                ))}

                <button
                  type="button"
                  className="editor-block-appender"
                  onClick={() => insertBlock(newBlock('p'), body.length)}
                >
                  <span className="plus">+</span>
                  {body.length ? 'Add block' : 'Type / to choose a block'}
                </button>
              </div>
            </div>
          </div>
        </main>

        {publishPanel ? (
          <PublishPanel
            mode={publishPanel}
            post={post}
            saving={save.isPending}
            now={now}
            onClose={() => setPublishPanel('')}
            onPublish={publishNow}
            onField={setField}
            onSnack={snack}
          />
        ) : (
          sidebar && (
            <aside className="editor-sidebar">
              <div className="editor-sidebar-tabs">
                <button
                  type="button"
                  className={`editor-sidebar-tab ${sidebar === 'post' ? 'is-active' : ''}`}
                  onClick={() => setSidebar('post')}
                >
                  Post
                </button>
                <button
                  type="button"
                  className={`editor-sidebar-tab ${sidebar === 'block' ? 'is-active' : ''}`}
                  onClick={() => setSidebar('block')}
                >
                  Block
                </button>
              </div>
              {sidebar === 'block' ? (
                selectedBlock ? (
                  <BlockSettings
                    block={selectedBlock}
                    index={selected}
                    onChange={(next) => updateBlock(selected, next)}
                    onOpenMedia={(target) => setMediaFor(target)}
                  />
                ) : (
                  <div className="editor-panel">
                    <p className="editor-hint">No block selected. Click a block in the canvas to edit its settings.</p>
                  </div>
                )
              ) : (
                <PostSettings
                  post={post}
                  words={words}
                  now={now}
                  onField={setField}
                  onSeo={setSeo}
                  onOpenMedia={() => setMediaFor('featured')}
                  onTrash={() =>
                    setConfirm({
                      title: 'Move to Trash',
                      message: 'Move this post to the Trash?',
                      confirmLabel: 'Move to Trash',
                      destructive: true,
                      onConfirm: async () => {
                        await api.post(`/admin/blog/${post._id}/trash`)
                        queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] })
                        navigate('/admin/blog')
                      },
                    })
                  }
                  onRestore={async (revisionId) => {
                    const { data } = await api.post(`/admin/blog/${post._id}/revisions/${revisionId}/restore`)
                    const restored = { ...EMPTY_POST(), ...data }
                    setPost(restored)
                    setSavedSnapshot(JSON.stringify(restored))
                    snack('Revision restored.')
                  }}
                />
              )}
            </aside>
          )
        )}
      </div>

      <footer className="editor-footer">
        <span className="crumb">Post</span>
        {selectedBlock && (
          <>
            <Icon name="chevronRight" size={14} />
            <span className="crumb">{blockMeta(selectedBlock.type).title}</span>
          </>
        )}
        <span style={{ marginLeft: 'auto' }}>
          {words} word{words === 1 ? '' : 's'}
          {savedAt ? ` · saved ${fmtDateTime(savedAt).split(' at ')[1]}` : ''}
        </span>
      </footer>

      {snackbars.length > 0 && (
        <div className="editor-snackbars">
          {snackbars.map((row) => (
            <div key={row.key} className="editor-snackbar">
              <span>{row.message}</span>
              {row.action}
            </div>
          ))}
        </div>
      )}

      <MediaFrame
        open={mediaFor !== null}
        title={mediaFor === 'featured' ? 'Featured image' : 'Select or Upload Media'}
        buttonLabel={mediaFor === 'featured' ? 'Set featured image' : 'Insert into post'}
        onClose={() => setMediaFor(null)}
        onSelect={(media) => {
          if (mediaFor === 'featured') {
            commit((current) => ({
              ...current,
              image: media.url,
              imageMediaId: media._id,
              imageWidth: media.width,
              imageHeight: media.height,
              imageAlt: current.imageAlt || media.altText || '',
              seo: { ...current.seo, ogImage: current.seo?.ogImage || media.url },
            }))
          } else if (typeof mediaFor === 'number') {
            // "Large" is WordPress's default insert size; anything smaller than
            // that never had a large rendered, so it falls back to the original.
            const chosen = (media.sizes || []).find((size) => size.name === 'large') || {
              url: media.url,
              width: media.width,
              height: media.height,
            }
            updateBlock(mediaFor, {
              ...body[mediaFor],
              type: 'image',
              url: chosen.url,
              mediaId: media._id,
              width: chosen.width,
              height: chosen.height,
              alt: media.altText || '',
              caption: media.caption || '',
            })
          }
          setMediaFor(null)
        }}
      />

      <WpModal open={shortcutsOpen} title="Keyboard shortcuts" onClose={() => setShortcutsOpen(false)} small>
        <table className="wp-form-table">
          <tbody>
            {SHORTCUTS.map(([keys, what]) => (
              <tr key={keys}>
                <th style={{ width: 170 }}>
                  <kbd style={{ background: '#f0f0f1', padding: '2px 6px', borderRadius: 3 }}>{keys}</kbd>
                </th>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WpModal>

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

/* -------------------------------- dropdown -------------------------------- */

function Dropdown({ open, onToggle, label, ariaLabel, buttonClass, children }) {
  const ref = useDismissable(() => open && onToggle())
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button type="button" className={buttonClass} aria-label={ariaLabel} aria-expanded={open} onClick={onToggle}>
        {label}
      </button>
      {open && <div className="editor-dropdown">{children(onToggle)}</div>}
    </div>
  )
}

/* -------------------------------- inserter -------------------------------- */

function Inserter({ onInsert }) {
  const [query, setQuery] = useState('')
  const matches = BLOCK_LIBRARY.filter(
    (block) =>
      !query ||
      block.title.toLowerCase().includes(query.toLowerCase()) ||
      block.keywords.includes(query.toLowerCase()),
  )
  return (
    <aside className="editor-inserter-panel">
      <input
        className="editor-inserter-search"
        type="search"
        value={query}
        placeholder="Search"
        aria-label="Search for blocks"
        onChange={(event) => setQuery(event.target.value)}
      />
      {BLOCK_CATEGORIES.map(([key, label]) => {
        const blocks = matches.filter((block) => block.category === key)
        if (!blocks.length) return null
        return (
          <div key={key}>
            <p className="editor-inserter-category">{label}</p>
            <div className="editor-inserter-grid">
              {blocks.map((block) => (
                <button
                  key={block.name}
                  type="button"
                  className="editor-inserter-item"
                  title={block.description}
                  onClick={() => onInsert(block.name)}
                >
                  <Icon name={block.icon} size={24} />
                  {block.title}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {!matches.length && <p className="editor-hint" style={{ marginTop: 20 }}>No blocks found.</p>}
    </aside>
  )
}

/* -------------------------------- list view ------------------------------- */

function ListView({ body, selected, words, headings, onSelect, onMove }) {
  const [tab, setTab] = useState('list')
  return (
    <aside className="editor-listview">
      <div className="editor-sidebar-tabs" style={{ marginBottom: 8 }}>
        <button type="button" className={`editor-sidebar-tab ${tab === 'list' ? 'is-active' : ''}`} onClick={() => setTab('list')}>
          List View
        </button>
        <button type="button" className={`editor-sidebar-tab ${tab === 'outline' ? 'is-active' : ''}`} onClick={() => setTab('outline')}>
          Outline
        </button>
      </div>
      {tab === 'list' ? (
        body.map((block, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              className={`editor-listview-row ${selected === index ? 'is-selected' : ''}`}
              onClick={() => onSelect(index)}
            >
              <Icon name={blockMeta(block.type).icon} size={24} />
              <span className="label">
                {plainText(block.text) || block.items?.[0] || block.caption || blockMeta(block.type).title}
              </span>
            </button>
            <button type="button" className="editor-icon-button" style={{ width: 24, height: 24 }} aria-label="Move up" onClick={() => onMove(index, -1)}>
              <Icon name="arrowUp" size={14} />
            </button>
            <button type="button" className="editor-icon-button" style={{ width: 24, height: 24 }} aria-label="Move down" onClick={() => onMove(index, 1)}>
              <Icon name="arrowDown" size={14} />
            </button>
          </div>
        ))
      ) : (
        <div style={{ padding: 8, display: 'grid', gap: 10 }}>
          <div className="editor-stat-row">
            <span>Words</span>
            <span>{words}</span>
          </div>
          <div className="editor-stat-row">
            <span>Headings</span>
            <span>{headings}</span>
          </div>
          <div className="editor-stat-row">
            <span>Blocks</span>
            <span>{body.length}</span>
          </div>
          <div className="editor-stat-row">
            <span>Time to read</span>
            <span>{Math.max(1, Math.ceil(words / 220))} min</span>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid #e0e0e0' }} />
          {body
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => ['h2', 'h3', 'h4'].includes(block.type))
            .map(({ block, index }) => (
              <button
                key={index}
                type="button"
                className="editor-listview-row"
                style={{ paddingLeft: block.type === 'h2' ? 8 : block.type === 'h3' ? 20 : 32 }}
                onClick={() => onSelect(index)}
              >
                <span className="label">{plainText(block.text) || `(empty ${block.type})`}</span>
              </button>
            ))}
        </div>
      )}
    </aside>
  )
}

/* ----------------------------- block toolbar ------------------------------ */

function BlockToolbar({ block, canFormat, onTransform, onFormat, onLink, onDuplicate, onInsertAfter, onRemove }) {
  const [open, setOpen] = useState('')
  const ref = useDismissable(() => setOpen(''))
  const meta = blockMeta(block.type)

  return (
    <div className="editor-block-toolbar" ref={ref} onMouseDown={(event) => event.stopPropagation()} role="toolbar" aria-label="Block tools">
      <div style={{ position: 'relative' }}>
        <button type="button" aria-label={`Change block type; currently ${meta.title}`} onClick={() => setOpen(open === 'type' ? '' : 'type')}>
          <Icon name={meta.icon} size={24} />
        </button>
        {open === 'type' && (
          <div className="editor-dropdown" style={{ left: 0, right: 'auto', minWidth: 200 }}>
            <div className="editor-dropdown-heading">Transform to</div>
            {BLOCK_LIBRARY.filter((entry) => entry.category === 'text' || entry.name === block.type).map((entry) => (
              <button
                key={entry.name}
                type="button"
                className={entry.name === block.type ? 'is-selected' : ''}
                onClick={() => {
                  onTransform(entry.name)
                  setOpen('')
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={entry.icon} size={20} />
                  {entry.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {canFormat && (
        <>
          <span className="sep" />
          <button type="button" aria-label="Bold" style={{ fontWeight: 700 }} onClick={() => onFormat('bold')}>
            B
          </button>
          <button type="button" aria-label="Italic" style={{ fontStyle: 'italic', fontFamily: 'Georgia, serif' }} onClick={() => onFormat('italic')}>
            I
          </button>
          <button type="button" aria-label="Strikethrough" style={{ textDecoration: 'line-through' }} onClick={() => onFormat('strike')}>
            S
          </button>
          <button type="button" aria-label="Inline code" style={{ fontFamily: 'monospace' }} onClick={() => onFormat('code')}>
            {'</>'}
          </button>
          <button type="button" aria-label="Link" onClick={onLink}>
            <Icon name="external" size={20} />
          </button>
        </>
      )}

      <span className="sep" />
      <div style={{ position: 'relative' }}>
        <button type="button" aria-label="More options" onClick={() => setOpen(open === 'more' ? '' : 'more')}>
          <Icon name="more" size={24} />
        </button>
        {open === 'more' && (
          <div className="editor-dropdown" style={{ left: 0, right: 'auto' }}>
            <button
              type="button"
              onClick={() => {
                onDuplicate()
                setOpen('')
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                onInsertAfter()
                setOpen('')
              }}
            >
              Insert after
            </button>
            <hr />
            <button
              type="button"
              style={{ color: '#b32d2e' }}
              onClick={() => {
                onRemove()
                setOpen('')
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------ post settings ----------------------------- */

function PostSettings({ post, words, now, onField, onSeo, onOpenMedia, onTrash, onRestore }) {
  const categories = useQuery({
    queryKey: ['admin', 'taxonomy', 'blog-category'],
    queryFn: async () => (await api.get('/admin/taxonomy', { params: { taxonomy: 'blog-category' } })).data,
  })
  const tags = useQuery({
    queryKey: ['admin', 'taxonomy', 'tag'],
    queryFn: async () => (await api.get('/admin/taxonomy', { params: { taxonomy: 'tag' } })).data,
  })
  const [tagDraft, setTagDraft] = useState('')
  const scheduled = new Date(post.publishedAt).getTime() > now

  const addTag = (value) => {
    const tag = value.trim()
    if (tag && !(post.tags || []).includes(tag)) onField('tags', [...(post.tags || []), tag])
    setTagDraft('')
  }

  return (
    <>
      <Panel title="Summary" defaultOpen>
        <div className="editor-row">
          <span>Status</span>
          <select
            value={post.status}
            onChange={(event) => onField('status', event.target.value)}
            style={{ border: 0, color: '#3858e9', background: 'none', cursor: 'pointer' }}
          >
            <option>Draft</option>
            <option>Pending</option>
            <option>Published</option>
            <option>Archived</option>
          </select>
        </div>
        <div className="editor-row">
          <span>Visibility</span>
          <select
            value={post.visibility || 'Public'}
            onChange={(event) => onField('visibility', event.target.value)}
            style={{ border: 0, color: '#3858e9', background: 'none', cursor: 'pointer' }}
          >
            <option>Public</option>
            <option>Private</option>
            <option value="Password">Password protected</option>
          </select>
        </div>
        {post.visibility === 'Password' && (
          <label className="editor-field">
            <span>Password</span>
            <input type="text" value={post.password || ''} onChange={(event) => onField('password', event.target.value)} />
          </label>
        )}
        <label className="editor-field">
          <span>{scheduled ? 'Publish on' : 'Published'}</span>
          <input
            type="datetime-local"
            value={toLocalInput(post.publishedAt)}
            onChange={(event) => onField('publishedAt', event.target.value ? new Date(event.target.value).toISOString() : null)}
          />
        </label>
        {scheduled && <p className="editor-hint">This post goes live automatically at the time above.</p>}
        <label className="editor-field">
          <span>URL</span>
          <input type="text" value={post.slug || ''} onChange={(event) => onField('slug', event.target.value)} />
        </label>
        <p className="editor-hint">/blog/{post.slug || 'post-url'}</p>
        <label className="editor-field">
          <span>Read time</span>
          <input
            type="text"
            value={post.readTime || ''}
            placeholder={`${Math.max(1, Math.ceil(words / 220))} min read`}
            onChange={(event) => onField('readTime', event.target.value)}
          />
        </label>
        <div className="editor-row">
          <span>Sticky (featured)</span>
          <button
            type="button"
            className={`editor-toggle ${post.featured ? 'is-on' : ''}`}
            aria-pressed={Boolean(post.featured)}
            onClick={() => onField('featured', !post.featured)}
          >
            <span />
          </button>
        </div>
        {post._id && (
          <button type="button" className="wp-button-link wp-button-link-delete" style={{ textAlign: 'left' }} onClick={onTrash}>
            Move to trash
          </button>
        )}
      </Panel>

      <Panel title="Featured image">
        {post.image ? (
          <>
            <button type="button" className="editor-featured-image" onClick={onOpenMedia}>
              <img src={post.image} alt={post.imageAlt || ''} />
            </button>
            <CoverSizeHint mediaId={post.imageMediaId} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="wp-button wp-button-small" onClick={onOpenMedia}>
                Replace
              </button>
              <button type="button" className="wp-button-link wp-button-link-delete" onClick={() => onField('image', '')}>
                Remove
              </button>
            </div>
            <label className="editor-field">
              <span>Alt text</span>
              <input type="text" value={post.imageAlt || ''} onChange={(event) => onField('imageAlt', event.target.value)} />
            </label>
          </>
        ) : (
          <>
            <button type="button" className="wp-button" onClick={onOpenMedia}>
              Set featured image
            </button>
            <p className="editor-hint">Without one, the article uses its gradient cover.</p>
            <label className="editor-field">
              <span>Cover label</span>
              <input type="text" value={post.heroLabel || ''} onChange={(event) => onField('heroLabel', event.target.value)} />
            </label>
          </>
        )}
      </Panel>

      <Panel title="Excerpt">
        <textarea
          rows={4}
          className="editor-field"
          style={{ width: '100%', border: '1px solid #949494', borderRadius: 2, padding: 6, fontFamily: 'inherit', fontSize: 13 }}
          value={post.excerpt || ''}
          placeholder="Write an excerpt (optional)"
          onChange={(event) => onField('excerpt', event.target.value)}
        />
        <p className="editor-hint">Shown on blog cards and in search results.</p>
      </Panel>

      <Panel title="Discussion">
        <div className="editor-row">
          <span>Allow comments</span>
          <button
            type="button"
            className={`editor-toggle ${post.allowComments ? 'is-on' : ''}`}
            aria-pressed={Boolean(post.allowComments)}
            onClick={() => onField('allowComments', !post.allowComments)}
          >
            <span />
          </button>
        </div>
        <p className="editor-hint">New comments wait for approval on the Comments screen.</p>
      </Panel>

      <Panel title="Categories">
        <div className="editor-checklist">
          {(categories.data?.items || []).map((term) => (
            <label key={term._id}>
              <input
                type="radio"
                name="primary-category"
                checked={post.category === term.name}
                onChange={() => onField('category', term.name)}
              />
              {term.name}
            </label>
          ))}
          {!categories.data?.items?.length && <p className="editor-hint">No categories yet — add one on the Categories screen.</p>}
        </div>
      </Panel>

      <Panel title="Tags">
        <div className="editor-token-list">
          {(post.tags || []).map((tag) => (
            <span key={tag} className="editor-token">
              {tag}
              <button type="button" aria-label={`Remove ${tag}`} onClick={() => onField('tags', post.tags.filter((t) => t !== tag))}>
                ×
              </button>
            </span>
          ))}
          <input
            className="editor-token-input"
            list="editor-tag-options"
            value={tagDraft}
            placeholder="Add a tag"
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addTag(tagDraft)
              }
            }}
            onBlur={() => tagDraft && addTag(tagDraft)}
          />
          <datalist id="editor-tag-options">
            {(tags.data?.items || []).map((term) => (
              <option key={term._id} value={term.name} />
            ))}
          </datalist>
        </div>
        <p className="editor-hint">Separate tags with Enter or a comma.</p>
      </Panel>

      <Panel title="SEO">
        <label className="editor-field">
          <span>Focus keyword</span>
          <input type="text" value={post.seo?.focusKeyword || ''} onChange={(event) => onSeo('focusKeyword', event.target.value)} />
        </label>
        <label className="editor-field">
          <span>SEO title</span>
          <input type="text" value={post.seo?.metaTitle || ''} onChange={(event) => onSeo('metaTitle', event.target.value)} />
        </label>
        <label className="editor-field">
          <span>Meta description</span>
          <textarea rows={3} value={post.seo?.metaDescription || ''} onChange={(event) => onSeo('metaDescription', event.target.value)} />
        </label>
        <p className="editor-hint">{(post.seo?.metaDescription || '').length}/160 characters</p>
        <label className="editor-field">
          <span>Canonical URL</span>
          <input type="url" value={post.seo?.canonicalUrl || ''} onChange={(event) => onSeo('canonicalUrl', event.target.value)} />
        </label>
        <div className="editor-row">
          <span>Discourage search engines</span>
          <button
            type="button"
            className={`editor-toggle ${post.seo?.noIndex ? 'is-on' : ''}`}
            aria-pressed={Boolean(post.seo?.noIndex)}
            onClick={() => onSeo('noIndex', !post.seo?.noIndex)}
          >
            <span />
          </button>
        </div>
      </Panel>

      {post.revisions?.length > 0 && (
        <Panel title={`Revisions (${post.revisions.length})`} defaultOpen={false}>
          {post.revisions.slice(0, 10).map((revision) => (
            <div key={revision._id} className="editor-row">
              <span style={{ fontSize: 12 }}>
                {fmtDateTime(revision.savedAt)}
                <br />
                <span style={{ color: '#757575' }}>
                  {revision.savedBy}
                  {revision.autosave ? ' · autosave' : ''}
                </span>
              </span>
              <button type="button" className="editor-row-button" style={{ color: '#3858e9' }} onClick={() => onRestore(revision._id)}>
                Restore
              </button>
            </div>
          ))}
        </Panel>
      )}
    </>
  )
}

/**
 * Warns when the chosen cover is too small for the slot it has to fill.
 *
 * The article hero spans the content column — around 1200px on a desktop — so a
 * 200px-wide image has to be blown up six times to cover it. The page now shows
 * such an image at its true size rather than stretching it, but the real fix is
 * a bigger source, and the only place to say so is before it is published.
 */
const COVER_TARGET_WIDTH = 1200

function CoverSizeHint({ mediaId }) {
  const { data } = useQuery({
    queryKey: ['admin', 'media', 'item', mediaId],
    queryFn: async () => (await api.get(`/admin/media/${mediaId}`)).data,
    enabled: Boolean(mediaId),
    staleTime: 60_000,
  })
  if (!data?.width) return null

  const small = data.width < COVER_TARGET_WIDTH
  return (
    <p className="editor-hint" style={small ? { color: '#b32d2e' } : undefined}>
      {data.width} × {data.height} pixels.
      {small
        ? ` Covers are shown up to about ${COVER_TARGET_WIDTH}px wide, so this one is displayed at its own size rather than stretched. Upload a wider image to fill the banner.`
        : ' Wide enough for the article banner.'}
    </p>
  )
}

function Panel({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="editor-panel">
      <button type="button" className="editor-panel-title" aria-expanded={open} onClick={() => setOpen(!open)}>
        {title}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={20} />
      </button>
      {open && <div className="editor-panel-body">{children}</div>}
    </div>
  )
}

/* ----------------------------- publish panels ----------------------------- */

function PublishPanel({ mode, post, saving, now, onClose, onPublish, onField, onSnack }) {
  const scheduled = new Date(post.publishedAt).getTime() > now
  if (mode === 'published') {
    const url = `${window.location.origin}/blog/${post.slug}`
    return (
      <aside className="editor-publish-panel">
        <button type="button" className="editor-icon-button" style={{ marginLeft: 'auto' }} aria-label="Close panel" onClick={onClose}>
          <Icon name="close" size={24} />
        </button>
        <h3>{scheduled ? 'Post scheduled.' : 'Post published.'} 🎉</h3>
        <p className="editor-hint">
          {scheduled
            ? `It goes live on ${fmtDateTime(post.publishedAt)}.`
            : 'Your post is now live. What would you like to do next?'}
        </p>
        <div className="editor-field" style={{ marginTop: 16 }}>
          <span>Post address</span>
          <div className="editor-copy-row">
            <input type="text" readOnly value={url} onFocus={(event) => event.target.select()} />
            <button
              type="button"
              className="wp-button"
              onClick={() => {
                navigator.clipboard?.writeText(url)
                onSnack('Post link copied to the clipboard.')
              }}
            >
              Copy
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <a className="wp-button wp-button-primary" href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
            View Post
          </a>
          <button type="button" className="wp-button" onClick={onClose}>
            Keep editing
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="editor-publish-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Are you ready to publish?</h3>
        <button type="button" className="editor-icon-button" aria-label="Close panel" onClick={onClose}>
          <Icon name="close" size={24} />
        </button>
      </div>
      <p className="editor-hint" style={{ marginTop: 8 }}>
        Double-check your settings before publishing.
      </p>

      <div className="editor-panel" style={{ border: 0, padding: '16px 0 0' }}>
        <div className="editor-row">
          <span>Visibility</span>
          <select
            value={post.visibility || 'Public'}
            onChange={(event) => onField('visibility', event.target.value)}
            style={{ border: 0, color: '#3858e9', background: 'none', cursor: 'pointer' }}
          >
            <option>Public</option>
            <option>Private</option>
            <option value="Password">Password protected</option>
          </select>
        </div>
        <label className="editor-field" style={{ marginTop: 12 }}>
          <span>Publish</span>
          <input
            type="datetime-local"
            value={toLocalInput(post.publishedAt)}
            onChange={(event) => onField('publishedAt', event.target.value ? new Date(event.target.value).toISOString() : null)}
          />
        </label>
        <div className="editor-row" style={{ marginTop: 12 }}>
          <span>Category</span>
          <span style={{ color: '#757575' }}>{post.category || 'Uncategorised'}</span>
        </div>
        <div className="editor-row" style={{ marginTop: 8 }}>
          <span>Tags</span>
          <span style={{ color: '#757575' }}>{post.tags?.length || 0}</span>
        </div>
      </div>

      {!post.title && (
        <div className="wp-notice wp-notice-warning" style={{ margin: '16px 0 0' }}>
          <p>This post has no title. It will be listed as “(no title)”.</p>
        </div>
      )}
      {!post.excerpt && (
        <div className="wp-notice wp-notice-info" style={{ margin: '12px 0 0' }}>
          <p>No excerpt yet — blog cards will fall back to the first paragraph.</p>
        </div>
      )}

      <button
        type="button"
        className="editor-primary-button"
        style={{ width: '100%', marginTop: 20, padding: '10px' }}
        disabled={saving}
        onClick={onPublish}
      >
        {saving ? 'Publishing…' : scheduled ? 'Schedule' : 'Publish'}
      </button>
    </aside>
  )
}
