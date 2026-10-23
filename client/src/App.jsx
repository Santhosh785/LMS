import { lazy, Suspense, useEffect } from 'react'
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
import About from './pages/public/About.jsx'
import Apply from './pages/public/Apply.jsx'
import FitCall from './pages/public/FitCall.jsx'
import Playbooks from './pages/public/Playbooks.jsx'
import PlaybookDetail from './pages/public/PlaybookDetail.jsx'
import ClaudeSkills from './pages/public/ClaudeSkills.jsx'
import SkillDetail from './pages/public/SkillDetail.jsx'
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

/*
 * Everything below is behind a login, so it is split out of the main bundle and
 * fetched the first time someone opens it. Public pages stay in the main bundle
 * because they are what first-time visitors (mostly on mobile) land on.
 * Navigations run in a transition (see main.jsx), so the current page stays on
 * screen while a chunk loads instead of flashing the fallback.
 */
const lazyNamed = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })))

/* --------------------------------- student -------------------------------- */
const Dashboard = lazy(() => import('./pages/student/Dashboard.jsx'))
const MyCourses = lazy(() => import('./pages/student/MyCourses.jsx'))
const CoursePlayer = lazy(() => import('./pages/student/CoursePlayer.jsx'))
const StudentLive = lazy(() => import('./pages/student/Live.jsx'))
const Practice = lazy(() => import('./pages/student/Practice.jsx'))
const Certificates = lazy(() => import('./pages/student/Certificates.jsx'))
const Achievements = lazy(() => import('./pages/student/Achievements.jsx'))
const Profile = lazy(() => import('./pages/student/Profile.jsx'))

/* -------------------------------- community ------------------------------- */
const Feed = lazy(() => import('./pages/community/Feed.jsx'))
const Channel = lazy(() => import('./pages/community/Channel.jsx'))
const CommunityWorkshops = lazy(() => import('./pages/community/CommunityWorkshops.jsx'))

/* ---------------------------------- admin --------------------------------- */
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const AdminCourses = lazy(() => import('./pages/admin/Courses.jsx'))
const CourseEditor = lazy(() => import('./pages/admin/CourseEditor.jsx'))
const CourseAutomation = lazyNamed(() => import('./pages/admin/courseTabs.jsx'), 'CourseAutomation')
const CourseCurriculum = lazyNamed(() => import('./pages/admin/courseTabs.jsx'), 'CourseCurriculum')
const CourseDrip = lazyNamed(() => import('./pages/admin/courseTabs.jsx'), 'CourseDrip')
const CourseInformation = lazyNamed(
  () => import('./pages/admin/courseTabs.jsx'),
  'CourseInformation',
)
const CoursePages = lazyNamed(() => import('./pages/admin/courseTabs.jsx'), 'CoursePages')
const CoursePricing = lazyNamed(() => import('./pages/admin/courseTabs.jsx'), 'CoursePricing')
const CourseStudents = lazyNamed(() => import('./pages/admin/courseTabs.jsx'), 'CourseStudents')
const AdminCustomers = lazy(() => import('./pages/admin/Customers.jsx'))
const AdminTransactions = lazy(() => import('./pages/admin/Transactions.jsx'))
const BroadcastCreate = lazyNamed(() => import('./pages/admin/email.jsx'), 'BroadcastCreate')
const Broadcasts = lazyNamed(() => import('./pages/admin/email.jsx'), 'Broadcasts')
const EmailContacts = lazyNamed(() => import('./pages/admin/email.jsx'), 'EmailContacts')
const EmailLists = lazyNamed(() => import('./pages/admin/email.jsx'), 'EmailLists')
const FunnelAutomation = lazyNamed(() => import('./pages/admin/funnels.jsx'), 'FunnelAutomation')
const FunnelCreate = lazyNamed(() => import('./pages/admin/funnels.jsx'), 'FunnelCreate')
const FunnelDetails = lazyNamed(() => import('./pages/admin/funnels.jsx'), 'FunnelDetails')
const FunnelEditor = lazyNamed(() => import('./pages/admin/funnels.jsx'), 'FunnelEditor')
const FunnelLeads = lazyNamed(() => import('./pages/admin/funnels.jsx'), 'FunnelLeads')
const FunnelOverview = lazyNamed(() => import('./pages/admin/funnels.jsx'), 'FunnelOverview')
const FunnelSteps = lazyNamed(() => import('./pages/admin/funnels.jsx'), 'FunnelSteps')
const FunnelsList = lazyNamed(() => import('./pages/admin/funnels.jsx'), 'FunnelsList')
const LiveBookingCreate = lazyNamed(() => import('./pages/admin/live.jsx'), 'LiveBookingCreate')
const LiveBookings = lazyNamed(() => import('./pages/admin/live.jsx'), 'LiveBookings')
const LiveCalendar = lazyNamed(() => import('./pages/admin/live.jsx'), 'LiveCalendar')
const LiveClassCreate = lazyNamed(() => import('./pages/admin/live.jsx'), 'LiveClassCreate')
const LiveClassList = lazyNamed(() => import('./pages/admin/live.jsx'), 'LiveClassList')
const LiveStream = lazyNamed(() => import('./pages/admin/live.jsx'), 'LiveStream')
const GamificationBadges = lazyNamed(
  () => import('./pages/admin/gamification.jsx'),
  'GamificationBadges',
)
const GamificationLeaderboard = lazyNamed(
  () => import('./pages/admin/gamification.jsx'),
  'GamificationLeaderboard',
)
const GamificationPoints = lazyNamed(
  () => import('./pages/admin/gamification.jsx'),
  'GamificationPoints',
)
const GamificationSettings = lazyNamed(
  () => import('./pages/admin/gamification.jsx'),
  'GamificationSettings',
)
const AdminCommunity = lazy(() => import('./pages/admin/Community.jsx'))
const AdminSettings = lazy(() => import('./pages/admin/Settings.jsx'))
const AdminTaxonomy = lazy(() => import('./pages/admin/Taxonomy.jsx'))
const AdminPrograms = lazy(() => import('./pages/admin/Programs.jsx'))
const AdminLeads = lazy(() => import('./pages/admin/Leads.jsx'))
const AdminApplications = lazy(() => import('./pages/admin/Applications.jsx'))
const AdminResources = lazy(() => import('./pages/admin/Resources.jsx'))
const AdminFitCalls = lazy(() => import('./pages/admin/FitCalls.jsx'))
const AdminWorkshops = lazy(() => import('./pages/admin/Workshops.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'))
const AdminIntegrations = lazy(() => import('./pages/admin/Integrations.jsx'))

/* The blog is a self-contained WordPress-style workspace — see
   pages/admin/blog/WpAdmin.jsx for why it owns its own chrome. */
const WpAdmin = lazy(() => import('./pages/admin/blog/WpAdmin.jsx'))
const WpDashboard = lazy(() => import('./pages/admin/blog/Dashboard.jsx'))
const WpPosts = lazy(() => import('./pages/admin/blog/Posts.jsx'))
const WpPostEditor = lazy(() => import('./pages/admin/blog/PostEditor.jsx'))
const WpTerms = lazy(() => import('./pages/admin/blog/Terms.jsx'))
const WpMediaLibrary = lazyNamed(() => import('./pages/admin/blog/Media.jsx'), 'MediaLibrary')
const WpMediaUpload = lazyNamed(() => import('./pages/admin/blog/Media.jsx'), 'MediaUpload')
const WpComments = lazy(() => import('./pages/admin/blog/Comments.jsx'))
const WpTools = lazy(() => import('./pages/admin/blog/Tools.jsx'))

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

/** Shown only on a cold load straight into a lazily loaded page. */
function RouteFallback() {
  return <div className="min-h-[60vh]" aria-busy="true" />
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
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}

            {/* ------------------------------ public ------------------------------ */}
            <Route element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="courses" element={<Courses />} />
              <Route path="courses/category" element={<CourseCategory />} />
              <Route path="courses/:slug" element={<CourseDetail />} />
              {/* Declared before the :slug route so they are not swallowed by it. */}
              <Route path="programs/apply" element={<Apply />} />
              <Route path="programs/fit-call" element={<FitCall />} />
              <Route path="programs/:slug" element={<ProgramDetail />} />
              <Route path="workshops" element={<Workshops />} />
              <Route path="workshops/:slug" element={<WorkshopDetail />} />
              <Route path="resources/playbooks" element={<Playbooks />} />
              <Route path="resources/playbooks/:slug" element={<PlaybookDetail />} />
              <Route path="resources/claude-skills" element={<ClaudeSkills />} />
              <Route path="resources/claude-skills/:slug" element={<SkillDetail />} />
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
              <Route path="resources" element={<AdminResources />} />
              <Route path="applications" element={<AdminApplications />} />
              <Route path="fit-calls" element={<AdminFitCalls />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="workshops" element={<AdminWorkshops />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="integrations" element={<AdminIntegrations />} />
              <Route path="blog" element={<WpAdmin />}>
                <Route index element={<WpPosts />} />
                <Route path="dashboard" element={<WpDashboard />} />
                <Route path="new" element={<WpPostEditor />} />
                <Route path="post/:id" element={<WpPostEditor />} />
                <Route
                  path="categories"
                  element={
                    <WpTerms
                      taxonomy="blog-category"
                      title="Categories"
                      singular="Category"
                      help="Categories group posts by subject and drive the blog's category rail. A post carries one."
                    />
                  }
                />
                <Route
                  path="tags"
                  element={
                    <WpTerms
                      taxonomy="tag"
                      title="Tags"
                      singular="Tag"
                      help="Tags are free-form keywords. A post can carry as many as it needs."
                    />
                  }
                />
                <Route path="media" element={<WpMediaLibrary />} />
                <Route path="media/new" element={<WpMediaUpload />} />
                <Route path="comments" element={<WpComments />} />
                <Route path="tools" element={<WpTools />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </RouteBoundary>
    </>
  )
}
