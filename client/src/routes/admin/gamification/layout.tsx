import { SideNavLayout } from '../../../components/admin/index.jsx'
import { gamificationSideNav } from '../../../data/nav.js'
import FeatureGate from '../../../components/FeatureGate'

export default function GamificationSection() {
  return (
    <FeatureGate feature="gamification">
      <SideNavLayout items={gamificationSideNav} title="Gamification" />
    </FeatureGate>
  )
}
