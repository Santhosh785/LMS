import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useFeatures } from '../../context/SiteConfigContext.jsx'
import { apiError } from '../../api/client.js'
import {
  Button,
  ErrorNote,
  Panel,
  SelectField,
  TextField,
  useToast,
} from '../../components/ui/index.jsx'
import { PageHead } from '../../components/student/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

export default function Profile() {
  useDocumentTitle('Profile | Growth Scholar')
  const { user, updateProfile } = useAuth()
  const features = useFeatures()
  const toast = useToast()
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      await updateProfile({ ...data, weeklyGoalHours: Number(data.weeklyGoalHours) })
      toast.show('Profile saved ✓')
    } catch (err) {
      setError(apiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {toast.node}
      <PageHead title="Profile" sub="Your details and learning preferences." />

      <div className="grid grid-cols-[1fr_300px] gap-6 mx-1040:grid-cols-1">
        <Panel title="Personal details">
          <form onSubmit={onSubmit} className="grid gap-4">
            <TextField name="name" label="Full name" defaultValue={user?.name} required />
            <TextField
              label="Email"
              defaultValue={user?.email}
              disabled
              hint="Email changes are not supported yet"
            />
            <TextField name="phone" type="tel" label="Phone" defaultValue={user?.phone || ''} />
            <SelectField
              name="education"
              label="Educational qualification"
              defaultValue={user?.education || 'Graduate'}
              options={['Undergraduate', 'Graduate', 'Post Graduate', 'Diploma', 'Other']}
            />
            <SelectField
              name="currentProfile"
              label="Current profile"
              defaultValue={user?.currentProfile || 'Student'}
              options={['Career Switcher', 'Working Marketer', 'Student', 'Founder']}
            />
            <SelectField
              name="preferredLanguage"
              label="Preferred language"
              defaultValue={user?.preferredLanguage || 'Tamil'}
              options={['Tamil', 'English', 'Hindi', 'Telugu']}
            />
            <TextField
              name="weeklyGoalHours"
              type="number"
              min="1"
              max="40"
              label="Weekly goal (hours)"
              defaultValue={user?.weeklyGoalHours ?? 8}
            />
            <ErrorNote error={error} />
            <div>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Panel>

        <div className="grid content-start gap-4">
          <Panel title="Your account">
            <div className="text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand text-[1.2rem] font-bold text-white">
                {user?.avatarInitials}
              </span>
              <h3 className="mt-3 text-[1.05rem]">{user?.name}</h3>
              <p className="text-[0.85rem] text-muted">{user?.email}</p>
              <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 text-[0.75rem] font-semibold text-brand">
                {user?.role === 'admin' ? 'Creator' : 'Learner'}
              </p>
            </div>
          </Panel>

          <Panel title="Progress snapshot">
            <dl className="grid gap-2.5 text-[0.88rem]">
              {[
                // Seeds and streak are gamification figures nothing updates yet.
                features.gamification && ['Seeds', user?.seeds?.toLocaleString('en-IN')],
                features.gamification && ['Learning streak', `${user?.streakDays} days`],
                ['Hours this week', user?.hoursThisWeek],
              ]
                .filter(Boolean)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold text-brand-deep">{v}</dd>
                  </div>
                ))}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  )
}
