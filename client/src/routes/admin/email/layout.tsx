import { SideNavLayout } from '../../../components/admin/index.jsx'
import { emailSideNav } from '../../../data/nav.js'
import FeatureGate from '../../../components/FeatureGate'

export default function EmailSection() {
  return (
    <FeatureGate feature="email">
      <SideNavLayout items={emailSideNav} title="Email" />
    </FeatureGate>
  )
}
