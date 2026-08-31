import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'

/**
 * Server-driven site configuration (GET /api/config).
 *
 * Branding, menu visibility, support contacts, feature flags and the published
 * taxonomy all arrive here at runtime rather than being compiled in, so editing
 * a setting or a category in admin changes the live site with no rebuild.
 *
 * Before this existed the settings screen wrote twenty fields that nothing ever
 * read: the header rendered a hardcoded brand name and `/logo.png`, and the
 * catalogue's filter sidebar was a hardcoded array.
 */

/** Nothing is on until the server says so, so the pre-config render is the safe one. */
const ALL_OFF = { funnels: false, email: false, gamification: false }

/*
 * Menus default to visible, unlike feature flags. A flag guards a module that
 * is not finished, so the safe pre-load state is hidden; a menu toggle hides a
 * finished section an operator chose to withhold, and defaulting those to
 * hidden would render an empty header on every cold load.
 */
const DEFAULTS = {
  features: ALL_OFF,
  branding: {
    brandName: 'Growth Scholar',
    productName: 'Growth Scholar Learn',
    logoUrl: '/logo.png',
    faviconUrl: '/logo.png',
    accentColor: '#3ecf8e',
  },
  menu: {
    showWorkshops: true,
    showCourses: true,
    showCommunity: true,
    showBlog: true,
    showPractice: true,
  },
  help: { supportEmail: '', salesEmail: '', helpCenterUrl: '', hours: '' },
  taxonomy: {},
  loaded: false,
}

const SiteConfigContext = createContext(DEFAULTS)

export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS)

  useEffect(() => {
    let cancelled = false
    api
      .get('/config')
      .then((res) => {
        if (cancelled) return
        const data = res.data || {}
        setConfig({
          // A module that cannot be confirmed enabled stays hidden.
          features: { ...ALL_OFF, ...(data.features || {}) },
          branding: { ...DEFAULTS.branding, ...(data.branding || {}) },
          menu: { ...DEFAULTS.menu, ...(data.menu || {}) },
          help: { ...DEFAULTS.help, ...(data.help || {}) },
          taxonomy: data.taxonomy || {},
          loaded: true,
        })
      })
      .catch(() => !cancelled && setConfig({ ...DEFAULTS, loaded: true }))
    return () => {
      cancelled = true
    }
  }, [])

  // The favicon and the accent are document-level, so they are applied here
  // rather than by whichever component happens to render first.
  useEffect(() => {
    if (!config.loaded) return
    const { faviconUrl, accentColor } = config.branding
    if (faviconUrl) {
      const link = document.querySelector("link[rel='icon']") || document.createElement('link')
      link.rel = 'icon'
      link.href = faviconUrl
      if (!link.parentNode) document.head.appendChild(link)
    }
    if (accentColor) document.documentElement.style.setProperty('--gs-accent', accentColor)
  }, [config.loaded, config.branding])

  return <SiteConfigContext.Provider value={config}>{children}</SiteConfigContext.Provider>
}

export function useSiteConfig() {
  return useContext(SiteConfigContext)
}

export function useFeatures() {
  return useContext(SiteConfigContext).features
}

export function useBranding() {
  return useContext(SiteConfigContext).branding
}

export function useMenuVisibility() {
  return useContext(SiteConfigContext).menu
}

export function useHelp() {
  return useContext(SiteConfigContext).help
}

/**
 * Published terms of one taxonomy, ordered as the operator arranged them.
 * `surface` narrows to the terms flagged for a particular place — the filter
 * sidebar, the header menu, or the card badges.
 */
export function useTerms(taxonomy, surface) {
  const { taxonomy: all } = useContext(SiteConfigContext)
  return useMemo(() => {
    const terms = all?.[taxonomy] || []
    if (!surface) return terms
    const flag = { filters: 'showInFilters', menu: 'showInMenu', cards: 'showOnCards' }[surface]
    return flag ? terms.filter((t) => t[flag]) : terms
  }, [all, taxonomy, surface])
}

/** Drops the nav entries whose module is switched off. See adminNav/studentNav. */
export function visibleNav(items, features) {
  return items.filter((item) => !item.feature || features[item.feature])
}
