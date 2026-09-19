import { Fragment } from 'react'

/**
 * A deliberately tiny inline-formatting grammar, shared by the block editor's
 * toolbar and the public article renderer.
 *
 * WordPress stores rich text as HTML. We cannot: the article body is written by
 * an admin and rendered on a public marketing page, so round-tripping HTML would
 * mean either trusting the editor completely or shipping a sanitiser. Instead the
 * editor writes markers into ordinary text and this module turns them into React
 * elements — there is no path from stored content to raw HTML at all.
 *
 *   **bold**      *italic*      ~~strikethrough~~      `code`      [label](url)
 *
 * Anything that is not one of those is text. A malformed marker stays visible
 * rather than swallowing the rest of the paragraph.
 */

export const MARKERS = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  code: ['`', '`'],
}

// Ordered so the two-character markers win over the one-character ones.
const TOKEN =
  /(\*\*[^*]+?\*\*)|(~~[^~]+?~~)|(`[^`]+?`)|(\*[^*\n]+?\*)|(\[[^\]\n]+?\]\([^)\s]+?\))/

/**
 * Only http(s) and same-origin links survive. `javascript:` and `data:` URLs are
 * the reason this check exists — without it the link syntax would be an XSS hole
 * dressed up as a convenience.
 */
export function safeHref(raw) {
  const url = String(raw || '').trim()
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url
  if (url.startsWith('/') && !url.startsWith('//')) return url
  if (url.startsWith('#')) return url
  return null
}

/** Parses one string into React nodes. Recurses so `**bold [link](/x)**` works. */
export function renderRich(input, key = 'r') {
  const text = String(input ?? '')
  if (!text) return null

  const nodes = []
  let rest = text
  let index = 0

  while (rest) {
    const match = TOKEN.exec(rest)
    if (!match) {
      nodes.push(rest)
      break
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    const token = match[0]
    const id = `${key}-${(index += 1)}`

    if (token.startsWith('**')) {
      nodes.push(<strong key={id}>{renderRich(token.slice(2, -2), id)}</strong>)
    } else if (token.startsWith('~~')) {
      nodes.push(<s key={id}>{renderRich(token.slice(2, -2), id)}</s>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={id} className="rounded bg-surface-mist px-1.5 py-0.5 font-mono text-[0.88em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const split = token.indexOf('](')
      const label = token.slice(1, split)
      const href = safeHref(token.slice(split + 2, -1))
      nodes.push(
        href ? (
          <a
            key={id}
            href={href}
            {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            className="font-medium text-brand underline underline-offset-2 hover:text-accent-mid"
          >
            {renderRich(label, id)}
          </a>
        ) : (
          <Fragment key={id}>{label}</Fragment>
        ),
      )
    } else {
      nodes.push(<em key={id}>{renderRich(token.slice(1, -1), id)}</em>)
    }
    rest = rest.slice(match.index + token.length)
  }

  return nodes
}

/**
 * The same grammar, rendered for the editor canvas rather than the article.
 *
 * Every character of the input survives into the output — the markers are only
 * dimmed, never removed, and emphasis is drawn with `-webkit-text-stroke`
 * rather than a heavier weight. Both are deliberate: this output is painted
 * underneath a transparent <textarea>, so anything that changed the number of
 * characters or the advance width of a glyph would drift the caret away from
 * the text the writer can see.
 */
export function highlightMarkers(input) {
  const text = String(input ?? '')
  const nodes = []
  let rest = text
  let index = 0

  const dim = (chars, key) => (
    <span key={key} className="rich-marker">
      {chars}
    </span>
  )

  while (rest) {
    const match = TOKEN.exec(rest)
    if (!match) {
      nodes.push(rest)
      break
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    const token = match[0]
    const id = `h${(index += 1)}`

    if (token.startsWith('**') || token.startsWith('~~')) {
      const mark = token.slice(0, 2)
      nodes.push(
        <span key={id} className={token.startsWith('**') ? 'rich-strong' : 'rich-strike'}>
          {dim(mark, `${id}a`)}
          {token.slice(2, -2)}
          {dim(mark, `${id}b`)}
        </span>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <span key={id} className="rich-code">
          {dim('`', `${id}a`)}
          {token.slice(1, -1)}
          {dim('`', `${id}b`)}
        </span>,
      )
    } else if (token.startsWith('[')) {
      const split = token.indexOf('](')
      nodes.push(
        <span key={id}>
          {dim('[', `${id}a`)}
          <span className="rich-link">{token.slice(1, split)}</span>
          {dim(token.slice(split, token.length), `${id}b`)}
        </span>,
      )
    } else {
      nodes.push(
        <span key={id} className="rich-em">
          {dim('*', `${id}a`)}
          {token.slice(1, -1)}
          {dim('*', `${id}b`)}
        </span>,
      )
    }
    rest = rest.slice(match.index + token.length)
  }

  return nodes
}

/** Strips the markers, for excerpts, meta descriptions and word counts. */
export function plainText(input) {
  return String(input ?? '')
    .replace(/\[([^\]\n]+?)\]\([^)\s]+?\)/g, '$1')
    .replace(/(\*\*|~~|`|\*)/g, '')
}

/**
 * Wraps (or unwraps) the current selection of a textarea, the way a word
 * processor's bold button behaves. Returns the next value plus where the
 * caret should land, leaving the DOM write to the caller.
 */
export function toggleMarker(value, start, end, marker) {
  const [open, close] = MARKERS[marker] || []
  if (!open) return null
  const before = value.slice(0, start)
  const selected = value.slice(start, end)
  const after = value.slice(end)

  if (selected.startsWith(open) && selected.endsWith(close) && selected.length > open.length + close.length) {
    const inner = selected.slice(open.length, -close.length)
    return { value: before + inner + after, start, end: start + inner.length }
  }
  if (before.endsWith(open) && after.startsWith(close)) {
    return {
      value: before.slice(0, -open.length) + selected + after.slice(close.length),
      start: start - open.length,
      end: end - open.length,
    }
  }
  const placeholder = selected || 'text'
  return {
    value: `${before}${open}${placeholder}${close}${after}`,
    start: start + open.length,
    end: start + open.length + placeholder.length,
  }
}

/** Inserts a `[label](url)` link around the selection. */
export function insertLink(value, start, end, url) {
  const label = value.slice(start, end) || url
  const next = `${value.slice(0, start)}[${label}](${url})${value.slice(end)}`
  return { value: next, start: start + 1, end: start + 1 + label.length }
}
