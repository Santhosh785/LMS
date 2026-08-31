import { useMemo } from 'react'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'

/**
 * Resolves a navigation tree against admin settings.
 *
 * Two things happen here. Entries carrying a `menuKey` are dropped when that
 * settings toggle is off — the five switches under Settings → Menu wrote to a
 * document nothing read, so hiding "Workshops" changed nothing on the site.
 * And a branch marked `termsFrom` has its links generated from the taxonomy, so
 * the Courses dropdown lists the topics an operator flagged rather than nine
 * hardcoded ones.
 */

/** Terms are linked by name because that is what the ?topic= contract carries. */
const termLink = (term) => ({
  label: term.name,
  to: `/courses/category?topic=${encodeURIComponent(term.name)}`,
})

export default function useSiteNav(items) {
  const { menu, taxonomy } = useSiteConfig()

  return useMemo(() => {
    const allowed = (entry) => !entry.menuKey || menu[entry.menuKey] !== false

    return items.filter(allowed).map((item) => {
      // Header entries carry their children under `menu`, footer columns under
      // `links`; both are resolved the same way.
      const childKey = item.menu ? 'menu' : item.links ? 'links' : null
      if (!childKey) return item

      const generated = item.termsFrom
        ? (taxonomy?.[item.termsFrom] || []).filter((t) => t.showInMenu).map(termLink)
        : []

      return { ...item, [childKey]: [...item[childKey].filter(allowed), ...generated] }
    })
  }, [items, menu, taxonomy])
}
