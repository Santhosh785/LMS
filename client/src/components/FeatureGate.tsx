import type { ReactNode } from 'react'
import { useRouteLoaderData } from 'react-router'
import type { loader as rootLoader } from '../root'
import { useFeatures } from '../context/SiteConfigContext.jsx'
import NotFound from '../pages/public/NotFound.jsx'

type Feature = 'funnels' | 'email' | 'gamification'

/**
 * The static route table cannot depend on runtime flags, so a feature-flagged
 * subtree is declared unconditionally and its layout route renders this
 * instead: the not-found page while the flag is off, exactly what a deep link
 * got when the flagged <Route> was left out of the tree. The flags come from
 * the root loader (the server's site config); the context is the fallback for
 * a render without loader data.
 */
export default function FeatureGate({
  feature,
  children,
}: {
  feature: Feature
  children: ReactNode
}) {
  const root = useRouteLoaderData<typeof rootLoader>('root')
  const fromContext = useFeatures()
  const enabled = root?.siteConfig?.features?.[feature] ?? fromContext[feature]
  if (!enabled) return <NotFound />
  return <>{children}</>
}
