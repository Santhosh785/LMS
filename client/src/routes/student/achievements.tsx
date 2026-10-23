import FeatureGate from '../../components/FeatureGate'
import Achievements from '../../pages/student/Achievements.jsx'

export default function GatedAchievements() {
  return (
    <FeatureGate feature="gamification">
      <Achievements />
    </FeatureGate>
  )
}
