import { useState } from 'react'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  useLoaderData,
  useMatches,
  useRouteLoaderData,
} from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toMetaDescriptors } from '@gs/seo'

import type { Route } from './+types/root'
import { AuthProvider } from './context/AuthContext.jsx'
import { SiteConfigProvider } from './context/SiteConfigContext.jsx'
import RouteErrorView from './components/RouteErrorView'

import './index.css'
// Redesign stylesheets, vendored verbatim from the client's static drop. They
// load after index.css so their page-scoped rules win over Tailwind utilities
// of equal specificity. See styles/redesign/README.md.
// Order mirrors the drop's own cascade: base.css @imports site-enhance.css
// first, then styles.css, then the per-page sheet. shared.css carries the
// slices of base.css/styles.css that are not chrome.
import './styles/redesign/site-enhance.css'
import './styles/redesign/shared.css'
import './styles/redesign/home-lemlist.css'
import './styles/redesign/about.css'
import './styles/redesign/program.css'
import './styles/redesign/program-apply.css'
import './styles/redesign/explore.css'
import './styles/redesign/category.css'
import './styles/redesign/course.css'
import './styles/redesign/workshops.css'
import './styles/redesign/workshop-landing.css'
import './styles/redesign/blog.css'
import './styles/redesign/resources.css'
import './styles/redesign/overrides.css'

// Carried over from the deleted index.html: the same font source as the
// original static site, and the bundled favicon (admin settings may swap it
// at runtime — see SiteConfigProvider).
export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/logo.png' },
  {
    rel: 'stylesheet',
    href: 'https://api.fontshare.com/v2/css?f[]=satoshi@400;500;700;900&display=swap',
  },
]

/**
 * Runs on the server for document requests only. The SEO result is the same
 * `resolveSeo` the Express stopgap used, so a crawler sees one answer for a
 * URL whichever rendered it; its `status` (404 for an unknown slug) becomes
 * the document's status code. A resolver failure must not take the page down:
 * the document still renders, with a generic head for that request.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url)
  let seo = null
  try {
    seo = await context.seo.resolve(url.pathname, url.searchParams)
  } catch (err) {
    console.error(`[seo] resolve failed for ${url.pathname}:`, err)
  }
  const payload = { siteConfig: context.siteConfig, user: context.user, seo, nonce: context.nonce }
  return seo?.status && seo.status !== 200 ? data(payload, { status: seo.status }) : payload
}

/**
 * Document requests only: a client-side navigation never re-fetches this
 * loader, so the SEO head stays whatever the first document carried (the pages
 * set their own titles through useDocumentTitle, as before).
 */
export function shouldRevalidate() {
  return false
}

export const meta: Route.MetaFunction = ({ data }) =>
  data?.seo
    ? toMetaDescriptors(data.seo)
    : [{ title: data?.siteConfig?.branding?.brandName || 'Growth Scholar' }]

/**
 * The document. The body carries the page scope class the stylesheets key on
 * (`.home-lm`, `.course-page--convert`, …) from the matched routes' `handle`,
 * so the server HTML is already styled; the pages' useBodyClass calls add the
 * same names on the client and are idempotent with it.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const root = useRouteLoaderData<typeof loader>('root')
  // Production only, like the CSP: the development policy allows inline
  // scripts outright and carries no nonce, and a nonce attribute the browser
  // then hides (it reads back as "") would only trip hydration on React
  // Router's dev-only critical-CSS <style>.
  const nonce = import.meta.env.PROD ? root?.nonce : undefined
  const matches = useMatches()
  const bodyClass = Array.from(
    new Set(
      matches.flatMap((m) => {
        const handle = m.handle as { bodyClass?: string } | undefined
        return handle?.bodyClass?.split(' ').filter(Boolean) ?? []
      }),
    ),
  ).join(' ')

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links nonce={nonce} />
      </head>
      <body className={bodyClass || undefined}>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  )
}

export default function Root() {
  const { siteConfig, user } = useLoaderData<typeof loader>()
  // Per render tree, never at module level: a module-level client would be
  // shared by every request the server renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, staleTime: 30_000, retry: 1 },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SiteConfigProvider initialConfig={siteConfig}>
        <AuthProvider initialUser={user}>
          <Outlet />
        </AuthProvider>
      </SiteConfigProvider>
    </QueryClientProvider>
  )
}

/**
 * The last resort, outside every provider: a failure in the root loader or in
 * the providers themselves. A 404 response renders the not-found page;
 * anything else the shared failure UI.
 */
export function ErrorBoundary() {
  return <RouteErrorView scope="root" />
}
