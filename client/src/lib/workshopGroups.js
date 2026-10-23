/**
 * How /workshops groups its cards: online workshops by language, offline ones
 * by city, in the original headings' order. Groups with no workshops are
 * dropped. Shared by the page and its `meta()`, so the ItemList JSON-LD lists
 * exactly the cards on screen, in the same order.
 */

export const DEFAULT_WORKSHOP_MODE = 'online'

/** `?mode=` → 'online' | 'offline'; anything unknown is the default. */
export const workshopMode = (value) => (value === 'offline' ? 'offline' : DEFAULT_WORKSHOP_MODE)

const SECTION_ORDER = {
  online: ['Tamil', 'English', 'Hindi'],
  offline: ['Chennai', 'Bangalore'],
}

/**
 * @param {string} mode
 * @param {Array<Record<string, any>>} items
 * @returns {Array<{ key: string, items: Array<Record<string, any>> }>}
 */
export function groupWorkshops(mode, items) {
  const m = workshopMode(mode)
  return SECTION_ORDER[m]
    .map((key) => ({
      key,
      items: (items || []).filter((w) => (m === 'online' ? w.language === key : w.venue === key)),
    }))
    .filter((g) => g.items.length)
}
