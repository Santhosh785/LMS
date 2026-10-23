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
 *
 * `facets` is the catalogue's own `{ topics, languages }` (the facets lookup
 * the page loader ran). When given, the topic and language groups list exactly
 * those values — what public courses actually carry — less any whose term an
 * operator has hidden from the filters, rather than every published term.
 */

const TAXONOMY_GROUPS = [
  { key: 'topic', label: 'Topic', taxonomy: 'topic', facet: 'topics' },
  { key: 'category', label: 'Category', taxonomy: 'category' },
  { key: 'tag', label: 'Tag', taxonomy: 'tag' },
  { key: 'lang', label: 'Language', taxonomy: 'language', facet: 'languages' },
]

const option = (name) => ({ value: name, label: name })

export default function useFilterGroups(facets) {
  const { taxonomy } = useSiteConfig()

  return useMemo(() => {
    const fromTerms = TAXONOMY_GROUPS.map((group) => {
      const terms = taxonomy?.[group.taxonomy] || []
      const values = group.facet ? facets?.[group.facet] : null
      if (values) {
        const hidden = new Set(terms.filter((t) => !t.showInFilters).map((t) => t.name))
        return {
          key: group.key,
          label: group.label,
          options: values.filter((v) => !hidden.has(v)).map(option),
        }
      }
      return {
        key: group.key,
        label: group.label,
        options: terms
          .filter((term) => term.showInFilters)
          // The value is the term name because that is what the content documents
          // store and what the ?topic=SEO URL contract already carries.
          .map((term) => option(term.name)),
      }
    })

    // Original sidebar order: topic, language, rating, price, duration, type —
    // with category and tag slotted in beside topic.
    const byKey = Object.fromEntries(fromTerms.map((g) => [g.key, g]))
    return [byKey.topic, byKey.category, byKey.tag, byKey.lang, ...staticFilterGroups]
  }, [taxonomy, facets])
}
