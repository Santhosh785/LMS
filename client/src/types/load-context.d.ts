import type { SeoMeta } from '@gs/seo'

/**
 * What Express hands every loader through `getLoadContext` — see
 * server/src/middleware/reactRouter.js. The server has no exported types for
 * these shapes, so they are described structurally here, from the objects the
 * server actually builds: `publicUser()` in routes/auth.routes.js and
 * `getSiteConfig()` in services/siteConfig.js.
 */

/** The user shape GET /api/auth/me returns — the same serialiser. */
export interface PublicUser {
  id: string
  name: string
  email: string
  role: 'student' | 'admin' | (string & {})
  avatarInitials?: string | null
  phone?: string | null
  education?: string | null
  currentProfile?: string | null
  preferredLanguage?: string | null
  streakDays?: number | null
  hoursThisWeek?: number | null
  seeds?: number | null
  weeklyGoalHours?: number | null
}

export interface SiteFeatures {
  funnels: boolean
  email: boolean
  gamification: boolean
}

/** The GET /api/config payload. */
export interface SiteConfig {
  features: SiteFeatures
  branding: {
    brandName: string
    productName: string
    logoUrl: string
    faviconUrl: string
    accentColor: string
  }
  menu: {
    showWorkshops: boolean
    showCourses: boolean
    showCommunity: boolean
    showBlog: boolean
    showPractice: boolean
  }
  help: {
    supportEmail: string
    salesEmail: string
    helpCenterUrl: string
    hours: string
  }
  taxonomy: Record<string, Array<Record<string, unknown>>>
}

/** The repository modules under server/src/db/repos, keyed by module name. */
export type Repos = Record<string, Record<string, (...args: never[]) => unknown>>

export type SeoData = SeoMeta

declare module 'react-router' {
  interface AppLoadContext {
    repos: Repos
    user: PublicUser | null
    siteConfig: SiteConfig
    /** `resolveSeo` from server/src/services/seo.js — it reads the database, hence async. */
    seo: { resolve(pathname: string, searchParams: URLSearchParams): Promise<SeoData> }
    nonce: string
  }
}

declare module 'growth-scholar-server/src/config/observability.js' {
  export function captureServerError(
    err: unknown,
    req?: { method?: string; originalUrl?: string } | null,
    status?: number,
  ): void
}
