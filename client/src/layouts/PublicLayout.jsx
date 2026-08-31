import { Outlet } from 'react-router-dom'
import SiteHeader from '../components/public/SiteHeader.jsx'
import SiteFooter from '../components/public/SiteFooter.jsx'
import MentorPopup from '../components/public/MentorPopup.jsx'

export default function PublicLayout() {
  return (
    <>
      <SiteHeader />
      <main className="pt-header">
        <Outlet />
      </main>
      <SiteFooter />
      <MentorPopup />
    </>
  )
}
