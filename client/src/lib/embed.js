/**
 * Parses an embed URL into a provider and an id.
 *
 * The block stores whatever the editor pasted, but nothing ever reaches an
 * iframe `src` except a URL this function rebuilt from a matched id — so a
 * pasted `javascript:` or an arbitrary third-party frame cannot be embedded,
 * only the two providers below.
 */
const PROVIDERS = [
  {
    name: 'YouTube',
    test: /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/,
    src: (id) => `https://www.youtube-nocookie.com/embed/${id}`,
    thumb: (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  },
  {
    name: 'Vimeo',
    test: /vimeo\.com\/(?:video\/)?(\d{6,12})/,
    src: (id) => `https://player.vimeo.com/video/${id}`,
    thumb: () => '',
  },
]

export function embedFrom(url) {
  const value = String(url || '').trim()
  for (const provider of PROVIDERS) {
    const match = provider.test.exec(value)
    if (match) {
      return { provider: provider.name, id: match[1], src: provider.src(match[1]), thumb: provider.thumb(match[1]) }
    }
  }
  return null
}

export const EMBED_PROVIDERS = PROVIDERS.map((provider) => provider.name)
