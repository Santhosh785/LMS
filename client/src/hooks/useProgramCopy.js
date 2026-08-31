import { useMemo } from 'react'
import { DEFAULT_CTAS, DEFAULT_PHASE_LABELS, DEFAULT_SECTION_COPY } from '../data/programCopy.js'

/**
 * Resolves a program's editable page copy, falling back to the shipped wording.
 *
 * Returns `copy(key)` for a section's eyebrow/heading/subhead and `cta(key)`
 * for a button. A field an operator left blank falls back rather than rendering
 * empty, so clearing a box never leaves a hole in the page.
 */
export default function useProgramCopy(program) {
  return useMemo(() => {
    const bySection = Object.fromEntries((program?.sectionCopy || []).map((s) => [s.key, s]))
    const byCta = Object.fromEntries((program?.ctas || []).map((c) => [c.key, c]))

    const copy = (key) => {
      const base = DEFAULT_SECTION_COPY[key] || {}
      const override = bySection[key] || {}
      return {
        eyebrow: override.eyebrow || base.eyebrow || '',
        heading: override.heading || base.heading || '',
        subhead: override.subhead || base.subhead || '',
      }
    }

    const cta = (key) => {
      const base = DEFAULT_CTAS[key] || {}
      const override = byCta[key] || {}
      return { label: override.label || base.label || '', to: override.to || base.to || '' }
    }

    const phaseLabels = program?.phaseLabels?.length ? program.phaseLabels : DEFAULT_PHASE_LABELS

    return { copy, cta, phaseLabels }
  }, [program])
}
