import { SideNavLayout } from '../../../components/admin/index.jsx'
import { liveSideNav } from '../../../data/nav.js'

export default function LiveSection() {
  return <SideNavLayout items={liveSideNav} title="Live" />
}
