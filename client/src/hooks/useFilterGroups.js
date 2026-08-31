import { useMemo } from 'react'
import { useSiteConfig } from '../context/SiteConfigContext.jsx'
import { staticFilterGroups } from '../data/nav.js'

/**
 * The catalogue's filter sidebar, assembled from the published taxonomy.
 *
 * Topic, category, tag and language come from the Term registry, so an operator
 * adds, renames, reorders or hides one in admin and the sidebar follows. Price,
 * rating, duration and course type are still fixed sets — they are schema enums
 * and computed ranges rather than terms, and moving them is TAX-6.
 *
 * The taxonomy-backed groups are always returned, even before the config has
 * loaded and even when empty. The catalogue derives its selection state by
 * mapping over these keys, so a group appearing late would drop that facet out
 * of the URL on the first render; a group with no options simply renders
 * nothing.
 */

const TAXONOMY_GROUPS = [
  { key: 'topic', label: 'Topic', taxonomy: 'topic' },
  { key: 'category', label: 'Category', taxonomy: 'category' },
  { key: 'tag', label: 'Tag', taxonomy: 'tag' },
  { key: 'lang', label: 'Language', taxonomy: 'language' },
]

export default function useFilterGroups() {
  const { taxonomy } = useSiteConfig()

  return useMemo(() => {
    const fromTerms = TAXONOMY_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      options: (taxonomy?.[group.taxonomy] || [])
        .filter((term) => term.showInFilters)
        // The value is the term name because that is what the content documents
        // store and what the ?topic=SEO URL contract already carries.
        .map((term) => ({ value: term.name, label: term.name })),
    }))

    // Original sidebar order: topic, language, rating, price, duration, type —
    // with category and tag slotted in beside topic.
    const byKey = Object.fromEntries(fromTerms.map((g) => [g.key, g]))
    return [byKey.topic, byKey.category, byKey.tag, byKey.lang, ...staticFilterGroups]
  }, [taxonomy])
}
