/**
 * Small readers for the raw server HTML the SEO specs assert on. The specs
 * deliberately do not load a browser (a browser would run the client and could
 * hide a tag the server failed to send), so these read the response text.
 */

type Attrs = Record<string, string>

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

/** Attributes of one start tag, e.g. `<meta name="x" content="y"/>`. */
function attrsOf(tag: string): Attrs {
  const attrs: Attrs = {}
  for (const m of tag.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const name = m[1]
    if (name === '<meta' || name === '<link') continue
    attrs[name.toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

const startTags = (html: string, name: 'meta' | 'link' | 'input'): Attrs[] =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) =>
    attrsOf(m[0].slice(name.length + 1)),
  )

export const title = (html: string): string | undefined => {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return m ? decode(m[1]).trim() : undefined
}

/** `content` of the first `<meta name|property="…">`. */
export const meta = (html: string, key: string): string | undefined =>
  startTags(html, 'meta').find((a) => a.name === key || a.property === key)?.content

/** `href` of the first `<link rel="…">`. */
export const link = (html: string, rel: string): string | undefined =>
  startTags(html, 'link').find((a) => (a.rel ?? '').split(/\s+/).includes(rel))?.href

export const inputs = (html: string): Attrs[] => startTags(html, 'input')

type JsonObject = Record<string, unknown>

/** Every JSON-LD node on the page, with arrays and `@graph` flattened. */
export function jsonLd(html: string): JsonObject[] {
  const out: JsonObject[] = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (node && typeof node === 'object') {
      out.push(node as JsonObject)
      visit((node as JsonObject)['@graph'])
    }
  }
  for (const m of html.matchAll(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse(m[1]))
    } catch {
      throw new Error(`Invalid JSON-LD block in the server HTML: ${m[1].slice(0, 120)}…`)
    }
  }
  return out
}

/** The JSON-LD node of a given `@type`, if any. */
export const jsonLdOfType = (html: string, type: string): JsonObject | undefined =>
  jsonLd(html).find((n) => [n['@type']].flat().includes(type))

/** The `<body>` with scripts removed, so inline JSON cannot match a markup test. */
export const bodyMarkup = (html: string): string => {
  const body = /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html
  return body.replace(/<script[\s\S]*?<\/script>/gi, '')
}
