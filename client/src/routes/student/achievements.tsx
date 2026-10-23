import { privateMeta } from '../../lib/clientMeta'
import FeatureGate from '../../components/FeatureGate'
import Achievements from '../../pages/student/Achievements.jsx'

export const meta = privateMeta('Achievements | Growth Scholar')

export default function GatedAchievements() {
  return (
    <FeatureGate feature="gamification">
      <Achievements />
    </FeatureGate>
  )
}
