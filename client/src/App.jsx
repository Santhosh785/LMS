import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import PublicLayout from './layouts/PublicLayout.jsx'
import StudentLayout from './layouts/StudentLayout.jsx'
import CommunityLayout from './layouts/CommunityLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { SideNavLayout } from './components/admin/index.jsx'
import { emailSideNav, funnelsSideNav, gamificationSideNav, liveSideNav } from './data/nav.js'
import { useFeatures } from './context/SiteConfigContext.jsx'

/* --------------------------------- public --------------------------------- */
import Home from './pages/public/Home.jsx'
import Courses from './pages/public/Courses.jsx'
import CourseCategory from './pages/public/CourseCategory.jsx'
import CourseDetail from './pages/public/CourseDetail.jsx'
import ProgramDetail from './pages/public/ProgramDetail.jsx'
import Workshops from './pages/public/Workshops.jsx'
import WorkshopDetail from './pages/public/WorkshopDetail.jsx'
import Blog from './pages/public/Blog.jsx'
import BlogPost from './pages/public/BlogPost.jsx'
import Login from './pages/public/Login.jsx'
import Signup from './pages/public/Signup.jsx'
import ForgotPassword from './pages/public/ForgotPassword.jsx'
import ResetPassword from './pages/public/ResetPassword.jsx'
import Checkout from './pages/public/Checkout.jsx'
import Privacy from './pages/public/Privacy.jsx'
import Terms from './pages/public/Terms.jsx'
import Refund from './pages/public/Refund.jsx'
import Delivery from './pages/public/Delivery.jsx'
import Contact from './pages/public/Contact.jsx'

/* --------------------------------- student -------------------------------- */
import Dashboard from './pages/student/Dashboard.jsx'
import MyCourses from './pages/student/MyCourses.jsx'
import CoursePlayer from './pages/student/CoursePlayer.jsx'
import StudentLive from './pages/student/Live.jsx'
import Practice from './pages/student/Practice.jsx'
import Certificates from './pages/student/Certificates.jsx'
import Achievements from './pages/student/Achievements.jsx'
import Profile from './pages/student/Profile.jsx'

/* -------------------------------- community ------------------------------- */
import Feed from './pages/community/Feed.jsx'
import Channel from './pages/community/Channel.jsx'
import CommunityWorkshops from './pages/community/CommunityWorkshops.jsx'

/* ---------------------------------- admin --------------------------------- */
import AdminDashboard from './pages/admin/Dashboard.jsx'
import AdminCourses from './pages/admin/Courses.jsx'
import CourseEditor from './pages/admin/CourseEditor.jsx'
import {
  CourseAutomation,
  CourseCurriculum,
  CourseDrip,
  CourseInformation,
  CoursePages,
  CoursePricing,
  CourseStudents,
} from './pages/admin/courseTabs.jsx'
import AdminCustomers from './pages/admin/Customers.jsx'
import AdminTransactions from './pages/admin/Transactions.jsx'
import { BroadcastCreate, Broadcasts, EmailContacts, EmailLists } from './pages/admin/email.jsx'
import {
  FunnelAutomation,
  FunnelCreate,
  FunnelDetails,
  FunnelEditor,
  FunnelLeads,
  FunnelOverview,
  FunnelSteps,
  FunnelsList,
} from './pages/admin/funnels.jsx'
import {
  LiveBookingCreate,
  LiveBookings,
  LiveCalendar,
  LiveClassCreate,
  LiveClassList,
  LiveStream,
} from './pages/admin/live.jsx'
import {
  GamificationBadges,
  GamificationLeaderboard,
  GamificationPoints,
  GamificationSettings,
} from './pages/admin/gamification.jsx'
import AdminCommunity from './pages/admin/Community.jsx'
import AdminSettings from './pages/admin/Settings.jsx'
import AdminTaxonomy from './pages/admin/Taxonomy.jsx'
import AdminPrograms from './pages/admin/Programs.jsx'
import AdminLeads from './pages/admin/Leads.jsx'
import AdminWorkshops from './pages/admin/Workshops.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import AdminIntegrations from './pages/admin/Integrations.jsx'

/**
 * The static site used .html URLs. Anything already bookmarked or linked from
 * outside is mapped onto the new route so old links don't 404.
 */
const LEGACY_REDIRECTS = {
  '/index.html': '/',
  '/courses/index.html': '/courses',
  '/courses/marketing.html': '/courses/category',
  '/courses/seo.html': '/courses/seo-mastery',
  '/programs/complete-growth-marketing.html': '/programs/complete-growth-marketing',
  '/workshops/index.html': '/workshops',
  '/workshops/seo-mastery.html': '/workshops/seo-mastery-live-tamil',
  '/blog/index.html': '/blog',
  '/blog/seo-vs-sem.html': '/blog/seo-vs-sem',
  '/community/index.html': '/community',
  '/community/channel.html': '/community/announcements',
  '/community/workshops.html': '/community/workshops',
  '/student/index.html': '/student',
  '/student/courses.html': '/student/courses',
  '/student/course.html': '/student/courses/seo-mastery',
  '/student/live.html': '/student/live',
  '/student/practice.html': '/student/practice',
  '/student/certificates.html': '/student/certificates',
  '/student/achievements.html': '/student/achievements',
  '/student/profile.html': '/student/profile',
  '/admin/index.html': '/admin',
  '/admin/courses.html': '/admin/courses',
  '/admin/customers.html': '/admin/customers',
  '/admin/transactions.html': '/admin/transactions',
  '/admin/email.html': '/admin/email/broadcasts',
  '/admin/email-lists.html': '/admin/email/lists',
  '/admin/email-contacts.html': '/admin/email/contacts',
  '/admin/email-broadcast-create.html': '/admin/email/broadcasts/create',
  '/admin/funnels.html': '/admin/funnels',
  '/admin/funnel-create.html': '/admin/funnels/create',
  '/admin/funnel-leads.html': '/admin/funnels/leads',
  '/admin/community.html': '/admin/community',
  '/admin/settings.html': '/admin/settings',
  '/admin/live.html': '/admin/live/calendar',
  '/admin/live-bookings.html': '/admin/live/bookings',
  '/admin/live-booking-create.html': '/admin/live/bookings/create',
  '/admin/live-create.html': '/admin/live/create',
  '/admin/live-class.html': '/admin/live/class',
  '/admin/live-stream.html': '/admin/live/stream',
  '/admin/gamification-points.html': '/admin/gamification/points',
  '/admin/gamification-badges.html': '/admin/gamification/badges',
  '/admin/gamification-leaderboard.html': '/admin/gamification/leaderboard',
  '/admin/gamification-settings.html': '/admin/gamification/settings',
}

function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5 text-center">
      <div>
        <h1 className="text-[2rem]">Page not found</h1>
        <p className="mt-2 text-muted">The page you’re after has moved or never existed.</p>
        <a href="/" className="mt-5 inline-block font-semibold text-brand hover:underline">
          ← Back home
        </a>
      </div>
    </div>
  )
}

/**
 * Boundary around the route outlet, so one broken page does not take down
 * navigation the way the root boundary would.
 *
 * Keyed on the pathname, which is the part that is easy to get wrong: without
 * it, a boundary that has caught an error holds that error forever and every
 * subsequent navigation renders the same failure page. Changing the key
 * remounts the boundary, clearing it as soon as the visitor goes somewhere else.
 */
function RouteBoundary({ children }) {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary key={pathname} scope="route">
      {children}
    </ErrorBoundary>
  )
}

/** Scrolls to the top on navigation, and honours #anchor links. */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    window.scrollTo({ top: 0 })
  }, [pathname, hash])
  return null
}

export default function App() {
  /**
   * Flags for the modules whose UI is built but whose behaviour is not. A
   * flagged <Route> is left out of the tree entirely while its flag is off, so
   * a deep link falls through to the catch-all and renders "Page not found"
   * instead of a page full of invented numbers. The API 404s independently —
   * see server/src/middleware/features.js.
   */
  const features = useFeatures()

  return (
    <>
      <ScrollToTop />
      <RouteBoundary>
        <Routes>
          {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}

          {/* ------------------------------ public ------------------------------ */}
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/category" element={<CourseCategory />} />
            <Route path="courses/:slug" element={<CourseDetail />} />
            <Route path="programs/:slug" element={<ProgramDetail />} />
            <Route path="workshops" element={<Workshops />} />
            <Route path="workshops/:slug" element={<WorkshopDetail />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            {/* Both halves of the same token: forgotten password, and the first
              password for an account created by the UPI approval flow. */}
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            {/* Public on purpose: an account wall in front of the money loses
              sales, and the admin approval creates the account. */}
            <Route path="checkout/:slug" element={<Checkout />} />
            {/* Legal and policy pages — required before a payment gateway can go live. */}
            <Route path="privacy" element={<Privacy />} />
            <Route path="terms" element={<Terms />} />
            <Route path="refund" element={<Refund />} />
            <Route path="delivery" element={<Delivery />} />
            <Route path="contact" element={<Contact />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* ------------------------------ student ----------------------------- */}
          <Route
            path="student"
            element={
              <ProtectedRoute>
                <StudentLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="courses" element={<MyCourses />} />
            <Route path="courses/:slug" element={<CoursePlayer />} />
            <Route path="live" element={<StudentLive />} />
            <Route path="practice" element={<Practice />} />
            <Route path="certificates" element={<Certificates />} />
            {features.gamification && <Route path="achievements" element={<Achievements />} />}
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* ----------------------------- community ---------------------------- */}
          <Route
            path="community"
            element={
              <ProtectedRoute>
                <CommunityLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Feed />} />
            <Route path="workshops" element={<CommunityWorkshops />} />
            <Route path=":slug" element={<Channel />} />
          </Route>

          {/* ------------------------------- admin ------------------------------ */}
          <Route
            path="admin"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />

            <Route path="courses" element={<AdminCourses />} />
            <Route path="courses/:id" element={<CourseEditor />}>
              <Route index element={<Navigate to="information" replace />} />
              <Route path="information" element={<CourseInformation />} />
              <Route path="curriculum" element={<CourseCurriculum />} />
              <Route path="pages" element={<CoursePages />} />
              <Route path="pricing" element={<CoursePricing />} />
              <Route path="drip" element={<CourseDrip />} />
              <Route path="automation" element={<CourseAutomation />} />
              <Route path="students" element={<CourseStudents />} />
            </Route>

            <Route path="customers" element={<AdminCustomers />} />
            <Route path="transactions" element={<AdminTransactions />} />

            {features.email && (
              <Route path="email" element={<SideNavLayout items={emailSideNav} title="Email" />}>
                <Route index element={<Navigate to="broadcasts" replace />} />
                <Route path="broadcasts" element={<Broadcasts />} />
                <Route path="broadcasts/create" element={<BroadcastCreate />} />
                <Route path="lists" element={<EmailLists />} />
                <Route path="contacts" element={<EmailContacts />} />
              </Route>
            )}

            {features.funnels && (
              <Route
                path="funnels"
                element={<SideNavLayout items={funnelsSideNav} title="Funnels" />}
              >
                <Route index element={<FunnelsList />} />
                <Route path="create" element={<FunnelCreate />} />
                <Route path="leads" element={<FunnelLeads />} />
                <Route path=":id" element={<FunnelEditor />}>
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<FunnelOverview />} />
                  <Route path="details" element={<FunnelDetails />} />
                  <Route path="steps" element={<FunnelSteps />} />
                  <Route path="leads" element={<FunnelLeads />} />
                  <Route path="automation" element={<FunnelAutomation />} />
                </Route>
              </Route>
            )}

            <Route path="live" element={<SideNavLayout items={liveSideNav} title="Live" />}>
              <Route index element={<Navigate to="calendar" replace />} />
              <Route path="calendar" element={<LiveCalendar />} />
              <Route path="bookings" element={<LiveBookings />} />
              <Route path="bookings/create" element={<LiveBookingCreate />} />
              <Route path="class" element={<LiveClassList />} />
              <Route path="create" element={<LiveClassCreate />} />
              <Route path="stream" element={<LiveStream />} />
            </Route>

            {features.gamification && (
              <Route
                path="gamification"
                element={<SideNavLayout items={gamificationSideNav} title="Gamification" />}
              >
                <Route index element={<Navigate to="points" replace />} />
                <Route path="points" element={<GamificationPoints />} />
                <Route path="badges" element={<GamificationBadges />} />
                <Route path="leaderboard" element={<GamificationLeaderboard />} />
                <Route path="settings" element={<GamificationSettings />} />
              </Route>
            )}

            <Route path="community" element={<AdminCommunity />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="taxonomy" element={<AdminTaxonomy />} />
            <Route path="programs" element={<AdminPrograms />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="workshops" element={<AdminWorkshops />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="integrations" element={<AdminIntegrations />} />
          </Route>
        </Routes>
      </RouteBoundary>
    </>
  )
}
