import { SideNavLayout } from '../../../components/admin/index.jsx'
import { funnelsSideNav } from '../../../data/nav.js'
import FeatureGate from '../../../components/FeatureGate'

export default function FunnelsSection() {
  return (
    <FeatureGate feature="funnels">
      <SideNavLayout items={funnelsSideNav} title="Funnels" />
    </FeatureGate>
  )
}
