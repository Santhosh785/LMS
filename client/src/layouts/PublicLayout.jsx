import { Outlet } from 'react-router'
import SiteHeader from '../components/public/SiteHeader.jsx'
import SiteFooter from '../components/public/SiteFooter.jsx'

/**
 * @param {{ children?: import('react').ReactNode }} props `children` replace
 *   the outlet — the route's ErrorBoundary renders the failure UI inside the
 *   same chrome, so a broken page keeps the header and footer.
 */
export default function PublicLayout({ children }) {
  return (
    <>
      <SiteHeader />
      <main className="pt-header">{children ?? <Outlet />}</main>
      <SiteFooter />
    </>
  )
}
