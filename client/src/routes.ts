import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

/**
 * The route table — the old App.jsx tree, minus the legacy .html redirects,
 * which Express now serves (middleware/legacyRedirect.js). Order matters where
 * a static path shares a prefix with a :param route: the static one comes
 * first so it is not swallowed.
 *
 * Feature-flagged subtrees (email, funnels, gamification, the student
 * achievements page) are declared unconditionally; their route modules render
 * the not-found page while the flag is off (components/FeatureGate.tsx).
 *
 * Generated together with the modules under routes/ — edit both when a route
 * is added.
 */
export default [
  layout('routes/public/layout.tsx', [
    index('routes/public/home.ts'),
    route('about', 'routes/public/about.ts'),
    route('courses', 'routes/public/courses.ts'),
    route('courses/category', 'routes/public/course-category.ts'),
    route('courses/:slug', 'routes/public/course-detail.ts'),
    // Declared before the :slug route so they are not swallowed by it.
    route('programs/apply', 'routes/public/apply.ts'),
    route('programs/fit-call', 'routes/public/fit-call.ts'),
    route('programs/:slug', 'routes/public/program-detail.ts'),
    route('workshops', 'routes/public/workshops.ts'),
    route('workshops/:slug', 'routes/public/workshop-detail.ts'),
    route('resources/playbooks', 'routes/public/playbooks.ts'),
    route('resources/playbooks/:slug', 'routes/public/playbook-detail.ts'),
    route('resources/claude-skills', 'routes/public/claude-skills.ts'),
    route('resources/claude-skills/:slug', 'routes/public/skill-detail.ts'),
    route('blog', 'routes/public/blog.ts'),
    route('blog/:slug', 'routes/public/blog-post.ts'),
    route('login', 'routes/public/login.ts'),
    route('signup', 'routes/public/signup.ts'),
    // Both halves of the same token: forgotten password, and the first
    // password for an account created by the UPI approval flow.
    route('forgot-password', 'routes/public/forgot-password.ts'),
    route('reset-password', 'routes/public/reset-password.ts'),
    // Public on purpose: an account wall in front of the money loses sales,
    // and the admin approval creates the account. Client-only — see the module.
    route('checkout/:slug', 'routes/public/checkout.tsx'),
    // Legal and policy pages — required before a payment gateway can go live.
    route('privacy', 'routes/public/privacy.ts'),
    route('terms', 'routes/public/terms.ts'),
    route('refund', 'routes/public/refund.ts'),
    route('delivery', 'routes/public/delivery.ts'),
    route('contact', 'routes/public/contact.ts'),
    route('*', 'routes/public/not-found.ts'),
  ]),

  // The course player is full-screen, Udemy-style — outside the dashboard
  // shell so the video gets the width. Same URL as before.
  route('student/courses/:slug', 'routes/student/course-player.tsx'),
  route('student', 'routes/student/layout.tsx', [
    index('routes/student/dashboard.ts'),
    route('courses', 'routes/student/courses.ts'),
    route('live', 'routes/student/live.ts'),
    route('practice', 'routes/student/practice.ts'),
    route('certificates', 'routes/student/certificates.ts'),
    route('achievements', 'routes/student/achievements.tsx'),
    route('profile', 'routes/student/profile.ts'),
  ]),

  route('community', 'routes/community/layout.tsx', [
    index('routes/community/feed.ts'),
    route('workshops', 'routes/community/workshops.ts'),
    route(':slug', 'routes/community/channel.ts'),
  ]),

  route('admin', 'routes/admin/layout.tsx', [
    index('routes/admin/dashboard.ts'),

    route('courses', 'routes/admin/courses.ts'),
    route('courses/:id', 'routes/admin/course-editor.ts', [
      index('routes/admin/course-editor-index.ts'),
      route('information', 'routes/admin/course-information.ts'),
      route('curriculum', 'routes/admin/course-curriculum.ts'),
      route('pages', 'routes/admin/course-pages.ts'),
      route('pricing', 'routes/admin/course-pricing.ts'),
      route('drip', 'routes/admin/course-drip.ts'),
      route('automation', 'routes/admin/course-automation.ts'),
      route('students', 'routes/admin/course-students.ts'),
    ]),

    route('customers', 'routes/admin/customers.ts'),
    route('transactions', 'routes/admin/transactions.ts'),

    route('email', 'routes/admin/email/layout.tsx', [
      index('routes/admin/email/index.ts'),
      route('broadcasts', 'routes/admin/email/broadcasts.ts'),
      route('broadcasts/create', 'routes/admin/email/broadcast-create.ts'),
      route('lists', 'routes/admin/email/lists.ts'),
      route('contacts', 'routes/admin/email/contacts.ts'),
    ]),

    route('funnels', 'routes/admin/funnels/layout.tsx', [
      index('routes/admin/funnels/list.ts'),
      route('create', 'routes/admin/funnels/create.ts'),
      route('leads', 'routes/admin/funnels/leads.ts'),
      route(':id', 'routes/admin/funnels/editor.ts', [
        index('routes/admin/funnels/editor-index.ts'),
        route('overview', 'routes/admin/funnels/overview.ts'),
        route('details', 'routes/admin/funnels/details.ts'),
        route('steps', 'routes/admin/funnels/steps.ts'),
        // The same screen as /admin/funnels/leads, scoped to one funnel by the :id param.
        route('leads', 'routes/admin/funnels/editor-leads.ts'),
        route('automation', 'routes/admin/funnels/automation.ts'),
      ]),
    ]),

    route('live', 'routes/admin/live/layout.tsx', [
      index('routes/admin/live/index.ts'),
      route('calendar', 'routes/admin/live/calendar.ts'),
      route('bookings', 'routes/admin/live/bookings.ts'),
      route('bookings/create', 'routes/admin/live/booking-create.ts'),
      route('class', 'routes/admin/live/class.ts'),
      route('create', 'routes/admin/live/create.ts'),
      route('stream', 'routes/admin/live/stream.ts'),
    ]),

    route('gamification', 'routes/admin/gamification/layout.tsx', [
      index('routes/admin/gamification/index.ts'),
      route('points', 'routes/admin/gamification/points.ts'),
      route('badges', 'routes/admin/gamification/badges.ts'),
      route('leaderboard', 'routes/admin/gamification/leaderboard.ts'),
      route('settings', 'routes/admin/gamification/settings.ts'),
    ]),

    route('community', 'routes/admin/community.ts'),
    route('settings', 'routes/admin/settings.ts'),
    route('taxonomy', 'routes/admin/taxonomy.ts'),
    route('programs', 'routes/admin/programs.ts'),
    route('resources', 'routes/admin/resources.ts'),
    route('applications', 'routes/admin/applications.ts'),
    route('fit-calls', 'routes/admin/fit-calls.ts'),
    route('leads', 'routes/admin/leads.ts'),
    route('workshops', 'routes/admin/workshops.ts'),
    route('users', 'routes/admin/users.ts'),
    route('integrations', 'routes/admin/integrations.ts'),

    // The blog is a self-contained WordPress-style workspace — see
    // pages/admin/blog/WpAdmin.jsx for why it owns its own chrome.
    route('blog', 'routes/admin/blog/layout.ts', [
      index('routes/admin/blog/posts.ts'),
      route('dashboard', 'routes/admin/blog/dashboard.ts'),
      route('new', 'routes/admin/blog/post-new.ts'),
      route('post/:id', 'routes/admin/blog/post-edit.ts'),
      route('categories', 'routes/admin/blog/categories.tsx'),
      route('tags', 'routes/admin/blog/tags.tsx'),
      route('media', 'routes/admin/blog/media.ts'),
      route('media/new', 'routes/admin/blog/media-new.ts'),
      route('comments', 'routes/admin/blog/comments.ts'),
      route('tools', 'routes/admin/blog/tools.ts'),
    ]),
  ]),
] satisfies RouteConfig
