import { Outlet, useParams } from 'react-router-dom'
import { useAdminOne } from '../../api/admin.js'
import { Loading, StatusPill } from '../../components/ui/index.jsx'
import { PageHead, SubNavTabs } from '../../components/admin/index.jsx'
import { courseTabs } from '../../data/nav.js'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

/** Shell for the seven course tabs — it owns the header and the tab bar. */
export default function CourseEditor() {
  const { id } = useParams()
  const { data: course, isPending } = useAdminOne('courses', id)

  useDocumentTitle(
    course ? `${course.title} — Growth Scholar Admin` : 'Course — Growth Scholar Admin',
  )

  if (isPending) return <Loading />
  if (!course) return <p className="py-16 text-center text-muted-admin">Course not found.</p>

  return (
    <>
      <PageHead
        title={course.title}
        sub={course.durationLabel || `${course.hours} Hrs`}
        breadcrumb={[{ label: 'Courses', to: '/admin/courses' }, { label: course.title }]}
        actions={<StatusPill status={course.status} />}
      />
      <SubNavTabs tabs={courseTabs(id)} />
      <Outlet context={course} />
    </>
  )
}
