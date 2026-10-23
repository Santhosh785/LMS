import * as blog from './blog.js'
import * as community from './community.js'
import * as content from './content.js'
import * as courses from './courses.js'
import * as crm from './crm.js'
import * as customers from './customers.js'
import * as email from './email.js'
import * as enrollments from './enrollments.js'
import * as programs from './programs.js'
import * as settings from './settings.js'
import * as transactions from './transactions.js'
import * as users from './users.js'
import * as workshops from './workshops.js'

/**
 * The repository set, one namespace per module, as the React Router load
 * context hands it to route loaders (`context.repos.courses.findPublicBySlug`).
 * The modules themselves are unchanged; this is only the one object that
 * gathers them so a loader does not reach into the server tree by path.
 */
export const repos = Object.freeze({
  blog,
  community,
  content,
  courses,
  crm,
  customers,
  email,
  enrollments,
  programs,
  settings,
  transactions,
  users,
  workshops,
})
