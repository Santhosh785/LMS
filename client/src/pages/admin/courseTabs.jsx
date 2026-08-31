import { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import {
  Button,
  cn,
  EmptyState,
  Loading,
  Panel,
  SelectField,
  StatusPill,
  TextAreaField,
  TextField,
  Toggle,
  useToast,
} from '../../components/ui/index.jsx'
import { DataTable, TypeCard } from '../../components/admin/index.jsx'
import VideoUploader, { VideoStatusChip } from '../../components/admin/VideoUploader.jsx'
import TermPicker from '../../components/admin/TermPicker.jsx'

const LESSON_TYPES = [
  'Video',
  'Audio',
  'E-book',
  'PDF',
  'Text',
  'Downloads',
  'Quiz',
  'Survey',
  'Assignment',
  'Live',
  'Custom Code',
  'SCORM/HTML',
]

/** PUTs one tab's slice of the course document. */
function useSaveTab(tab) {
  const { id } = useParams()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body) => (await api.put(`/admin/courses/${id}/${tab}`, body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] }),
  })
}

/* ------------------------------ Information ------------------------------- */
export function CourseInformation() {
  const course = useOutletContext()
  const save = useSaveTab('settings')
  const toast = useToast()
  const [drm, setDrm] = useState(!!course.drmEnabled)
  // Taxonomy lives outside the FormData because chips are not form controls.
  const [topic, setTopic] = useState(course.topic || '')
  const [categories, setCategories] = useState(course.categories || [])
  const [tags, setTags] = useState(course.tags || [])
  // Controlled so the preview below the field updates as it is typed.
  const [image, setImage] = useState(course.image || '')

  const onSubmit = (e) => {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget))
    save.mutate(
      {
        ...form,
        languages: form.languages
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        topic,
        categories,
        tags,
        image,
        drmEnabled: drm,
      },
      { onSuccess: () => toast.show('Saved ✓'), onError: (err) => toast.show(apiError(err)) },
    )
  }

  return (
    <>
      {toast.node}
      <form onSubmit={onSubmit} className="grid grid-cols-[1.4fr_0.8fr] gap-5 mx-1100:grid-cols-1">
        <Panel title="Course information">
          <div className="grid gap-4">
            <TextField name="title" label="Title" defaultValue={course.title} required />
            <TextField
              name="slug"
              label="URL slug"
              defaultValue={course.slug}
              required
              hint="Used in /courses/<slug>"
            />
            <TextAreaField
              name="summary"
              label="Short description"
              defaultValue={course.summary || ''}
              rows={3}
            />
            <TermPicker
              taxonomy="topic"
              label="Topic"
              single
              value={topic}
              onChange={setTopic}
              hint="The catalogue's primary filter. Managed under Taxonomy."
            />
            <TermPicker
              taxonomy="category"
              label="Categories"
              value={categories}
              onChange={setCategories}
            />
            <TermPicker
              taxonomy="tag"
              label="Tags"
              value={tags}
              onChange={setTags}
              hint="★ marks a tag that publishes this course to a homepage rail."
            />
            <TextField
              name="languages"
              label="Languages"
              defaultValue={course.languages?.join(', ')}
              hint="Comma separated"
            />
            <TextField
              name="durationLabel"
              label="Duration label"
              defaultValue={course.durationLabel || ''}
            />
            {/*
              Optional. The design ships with a coloured block and the title
              drawn over it; an image replaces that block wherever the course
              appears. A URL that fails to load falls back to the block rather
              than showing a broken image on a sales page.
            */}
            <TextField
              name="image"
              label="Cover image URL"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              hint="1200 × 675 (16:9) works everywhere. Leave blank to keep the colour block."
            />
            {image && (
              <div className="flex items-start gap-3">
                <img
                  src={image}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.dataset.broken = 'true'
                  }}
                  className="h-20 w-32 shrink-0 rounded-md2 border border-line object-cover data-[broken=true]:hidden"
                />
                <div className="text-[0.8rem] text-muted">
                  <p>
                    Preview. If nothing appears here the URL is not reachable, and the site will
                    show the colour block instead.
                  </p>
                  <p className="mt-1">
                    Catalogue cards and thumbnails crop to a shorter band, so keep the subject
                    centred and away from the edges.
                  </p>
                </div>
              </div>
            )}
            <TextField
              name="imageAlt"
              label="Image description"
              defaultValue={course.imageAlt || ''}
              hint="Read aloud by screen readers, and shown if the image fails."
            />
          </div>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel title="Publishing">
            <div className="grid gap-4">
              <SelectField
                name="status"
                label="Status"
                defaultValue={course.status}
                options={['Published', 'Draft']}
              />
              <SelectField
                name="visibility"
                label="Visibility"
                defaultValue={course.visibility}
                options={['Public', 'Hidden']}
              />
              <div className="flex items-center justify-between">
                <span className="text-[0.85rem] font-semibold text-brand-deep">Enable DRM</span>
                <Toggle checked={drm} onChange={setDrm} label="Enable DRM" />
              </div>
            </div>
          </Panel>

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </>
  )
}

/* ------------------------------- Curriculum ------------------------------- */
export function CourseCurriculum() {
  const course = useOutletContext()
  const { id } = useParams()
  const save = useSaveTab('curriculum')
  const toast = useToast()
  const [sections, setSections] = useState(course.sections || [])
  const [selected, setSelected] = useState({ s: 0, l: 0 })

  useEffect(() => setSections(course.sections || []), [course.sections])

  const lesson = sections[selected.s]?.lessons?.[selected.l]

  const patchLesson = (patch) => {
    setSections((prev) =>
      prev.map((sec, si) =>
        si !== selected.s
          ? sec
          : {
              ...sec,
              lessons: sec.lessons.map((l, li) => (li === selected.l ? { ...l, ...patch } : l)),
            },
      ),
    )
  }

  const addSection = () =>
    setSections((prev) => [
      ...prev,
      { name: `New module ${prev.length + 1}`, order: prev.length, lessons: [] },
    ])

  const addLesson = (si) =>
    setSections((prev) =>
      prev.map((sec, i) =>
        i !== si
          ? sec
          : {
              ...sec,
              lessons: [
                ...sec.lessons,
                {
                  name: 'New lesson',
                  contentType: 'Video',
                  duration: '00:00',
                  order: sec.lessons.length,
                },
              ],
            },
      ),
    )

  const removeLesson = (si, li) =>
    setSections((prev) =>
      prev.map((sec, i) =>
        i !== si ? sec : { ...sec, lessons: sec.lessons.filter((_, x) => x !== li) },
      ),
    )

  return (
    <>
      {toast.node}
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" onClick={addSection}>
          + Add module
        </Button>
        <Button
          disabled={save.isPending}
          onClick={() =>
            save.mutate({ sections }, { onSuccess: () => toast.show('Curriculum saved ✓') })
          }
        >
          {save.isPending ? 'Saving…' : 'Save curriculum'}
        </Button>
      </div>

      <div className="grid grid-cols-[340px_1fr] gap-5 mx-1100:grid-cols-1">
        <aside className="max-h-[70vh] overflow-y-auto rounded-lg2 border border-line-admin bg-white shadow-admin">
          {sections.map((section, si) => (
            <div key={section._id || si} className="border-b border-line-admin last:border-0">
              <div className="flex items-center gap-2 px-4 py-3">
                <input
                  value={section.name}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((s, i) => (i === si ? { ...s, name: e.target.value } : s)),
                    )
                  }
                  aria-label="Module name"
                  className="w-full border-0 bg-transparent text-[0.88rem] font-semibold text-brand-deep outline-none"
                />
                <button
                  type="button"
                  onClick={() => addLesson(si)}
                  aria-label="Add lesson"
                  className="shrink-0 text-muted-admin hover:text-brand"
                >
                  ＋
                </button>
              </div>
              <ul>
                {section.lessons.map((l, li) => (
                  <li key={l._id || li}>
                    <button
                      type="button"
                      onClick={() => setSelected({ s: si, l: li })}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2 text-left text-[0.84rem]',
                        selected.s === si && selected.l === li
                          ? 'bg-accent-soft font-semibold text-brand'
                          : 'text-muted-admin hover:bg-surface-admin/60',
                      )}
                    >
                      <span className="flex-1 truncate">{l.name}</span>
                      {l.contentType === 'Video' && <VideoStatusChip lesson={l} />}
                      <span className="shrink-0 text-[0.72rem]">{l.contentType}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeLesson(si, li)
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && removeLesson(si, li)}
                        className="shrink-0 text-danger-admin"
                      >
                        🗑
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        <Panel title="Lesson editor">
          {!lesson ? (
            <EmptyState
              icon="🎬"
              title="Pick a lesson"
              body="Select a lesson on the left to edit it."
            />
          ) : (
            <div className="grid gap-4">
              <TextField
                id="lesson-name"
                label="Lesson name"
                value={lesson.name}
                onChange={(e) => patchLesson({ name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4 mx-640:grid-cols-1">
                <SelectField
                  label="Content type"
                  value={lesson.contentType}
                  onChange={(e) => patchLesson({ contentType: e.target.value })}
                  options={LESSON_TYPES}
                />
                <TextField
                  label="Duration"
                  value={lesson.duration || ''}
                  onChange={(e) => patchLesson({ duration: e.target.value })}
                />
              </div>
              {/*
                The upload goes browser → Bunny directly (task 22); the server
                only presigns it and tracks encoding status. The manual GUID
                field survives under "Advanced" for videos uploaded straight in
                the Bunny dashboard, along with the legacy URL nothing serves.
              */}
              {lesson.contentType === 'Video' && (
                <VideoUploader courseId={id} lesson={lesson} onPatch={patchLesson} />
              )}
              <details className="rounded-lg2 border border-line-admin bg-surface-admin/40 px-4 py-3">
                <summary className="cursor-pointer text-[0.82rem] font-semibold text-muted-admin">
                  Advanced — attach by ID
                </summary>
                <div className="grid gap-4 pt-4">
                  <TextField
                    label="Bunny Video ID"
                    placeholder="e.g. a1b2c3d4-1111-2222-3333-444455556666"
                    hint="The video's GUID in Bunny Stream — only for videos uploaded in the Bunny dashboard. Required before a course can be published."
                    value={lesson.bunnyVideoId || ''}
                    onChange={(e) => patchLesson({ bunnyVideoId: e.target.value.trim() })}
                  />
                  <TextField
                    label="Video URL (legacy)"
                    hint="Not served to students — kept for older lessons only."
                    value={lesson.videoUrl || ''}
                    onChange={(e) => patchLesson({ videoUrl: e.target.value })}
                  />
                </div>
              </details>

              <div className="grid gap-3 rounded-lg2 bg-surface-admin/60 p-4">
                {[
                  ['isFreePreview', 'Free preview'],
                  ['isDraft', 'Draft'],
                  ['isCompulsory', 'Compulsory'],
                  ['enableDiscussion', 'Enable discussion'],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[0.85rem] text-muted-admin">{label}</span>
                    <Toggle
                      checked={!!lesson[key]}
                      onChange={(v) => patchLesson({ [key]: v })}
                      label={label}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}

/* ---------------------------------- Pages --------------------------------- */
export function CoursePages() {
  const course = useOutletContext()
  const save = useSaveTab('pages')
  const toast = useToast()

  const onSubmit = (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget))
    const lines = (v) =>
      v
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    save.mutate(
      {
        overview: lines(f.overview),
        tools: lines(f.tools),
        careers: lines(f.careers),
        whoShouldEnroll: { intro: f.whoIntro, points: lines(f.whoPoints) },
      },
      { onSuccess: () => toast.show('Landing page saved ✓') },
    )
  }

  return (
    <>
      {toast.node}
      <form onSubmit={onSubmit} className="grid gap-5">
        <Panel title="Landing page content" bodyClass="grid gap-4 p-5">
          <TextAreaField
            name="overview"
            label="Overview paragraphs"
            rows={6}
            defaultValue={course.overview?.join('\n')}
            hint="One paragraph per line"
          />
          <TextAreaField
            name="tools"
            label="Tools practised"
            rows={4}
            defaultValue={course.tools?.join('\n')}
            hint="One per line"
          />
          <TextAreaField
            name="careers"
            label="Career outcomes"
            rows={4}
            defaultValue={course.careers?.join('\n')}
            hint="One per line"
          />
          <TextAreaField
            name="whoIntro"
            label="Who should enroll — intro"
            rows={3}
            defaultValue={course.whoShouldEnroll?.intro || ''}
          />
          <TextAreaField
            name="whoPoints"
            label="Who should enroll — bullets"
            rows={4}
            defaultValue={course.whoShouldEnroll?.points?.join('\n')}
            hint="One per line"
          />
        </Panel>
        <div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save page'}
          </Button>
        </div>
      </form>
    </>
  )
}

/* --------------------------------- Pricing -------------------------------- */
export function CoursePricing() {
  const course = useOutletContext()
  const save = useSaveTab('pricing')
  const toast = useToast()
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState('one-time')
  const [plans, setPlans] = useState(course.pricingPlans || [])
  // The paid/free flag. The tab saved `amount` but never this, so a course
  // could show ₹0 and still be classified paid — invisible on the homepage's
  // Free Courses tab. The server reconciles the two either way.
  const [priceKind, setPriceKind] = useState(course.price || 'paid')

  const addPlan = (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget))
    setPlans((p) => [
      ...p,
      {
        name: f.name,
        price: Number(f.price),
        compareAtPrice: Number(f.compareAtPrice) || undefined,
        access: f.access,
      },
    ])
    setStep(1)
    toast.show('Plan added — remember to save')
  }

  return (
    <>
      {toast.node}
      <div className="grid grid-cols-[1.2fr_1fr] gap-5 mx-1100:grid-cols-1">
        <Panel
          title="Pricing plans"
          actions={
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  {
                    pricingPlans: plans,
                    price: priceKind,
                    amount: priceKind === 'free' ? 0 : (plans[0]?.price ?? course.amount),
                    strikeAmount: plans[0]?.compareAtPrice,
                  },
                  { onSuccess: () => toast.show('Pricing saved ✓') },
                )
              }
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          }
        >
          <div className="mb-4">
            <SelectField
              label="This course is"
              value={priceKind}
              onChange={(e) => setPriceKind(e.target.value)}
              options={[
                { value: 'paid', label: 'Paid' },
                { value: 'free', label: 'Free' },
              ]}
              hint="Drives the Free / Paid tabs on the homepage and the catalogue filter."
            />
          </div>

          {plans.length === 0 ? (
            <EmptyState
              icon="₹"
              title="No plans yet"
              body="Add a plan on the right to start selling."
            />
          ) : (
            <div className="grid gap-3">
              {plans.map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  className="flex items-center justify-between rounded-lg2 border border-line-admin p-4"
                >
                  <div>
                    <h4 className="text-[0.95rem]">{p.name}</h4>
                    <p className="mt-0.5 text-[0.8rem] text-muted-admin">{p.access}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[1.05rem] font-bold text-brand-deep">
                      ₹{p.price?.toLocaleString('en-IN')}
                    </span>
                    {p.compareAtPrice ? (
                      <span className="text-[0.85rem] text-muted-admin line-through">
                        ₹{p.compareAtPrice.toLocaleString('en-IN')}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setPlans((prev) => prev.filter((_, x) => x !== i))}
                      className="text-danger-admin"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={`Add a plan — step ${step} of 2`}>
          {step === 1 ? (
            <>
              <div className="grid gap-3">
                {[
                  {
                    id: 'one-time',
                    title: 'One-time payment',
                    body: 'Learner pays once for access.',
                    icon: '💳',
                  },
                  {
                    id: 'subscription',
                    title: 'Subscription',
                    body: 'Recurring monthly or yearly billing.',
                    icon: '🔁',
                  },
                  { id: 'free', title: 'Free', body: 'Open access, no payment step.', icon: '🎁' },
                ].map((t) => (
                  <TypeCard
                    key={t.id}
                    selected={kind === t.id}
                    onSelect={() => setKind(t.id)}
                    {...t}
                  />
                ))}
              </div>
              <Button className="mt-4" onClick={() => setStep(2)}>
                Next →
              </Button>
            </>
          ) : (
            <form onSubmit={addPlan} className="grid gap-4">
              <TextField
                name="name"
                label="Plan name"
                defaultValue={kind === 'free' ? 'Free access' : 'Lifetime access'}
                required
              />
              <TextField
                name="price"
                type="number"
                min="0"
                label="Price (₹)"
                defaultValue={kind === 'free' ? 0 : course.amount || 0}
                required
              />
              <TextField
                name="compareAtPrice"
                type="number"
                min="0"
                label="Compare-at price (₹)"
                defaultValue={course.strikeAmount || ''}
              />
              <SelectField
                name="access"
                label="Access"
                defaultValue="Lifetime"
                options={['Lifetime', '12 months', '6 months']}
              />
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                  ← Previous
                </Button>
                <Button type="submit">Add plan</Button>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </>
  )
}

/* ---------------------------------- Drip ---------------------------------- */
export function CourseDrip() {
  const course = useOutletContext()
  const save = useSaveTab('drip')
  const toast = useToast()
  const [enabled, setEnabled] = useState(!!course.dripEnabled)
  const [rules, setRules] = useState(
    course.dripSchedule?.length
      ? course.dripSchedule
      : (course.sections || []).map((s, i) => ({
          sectionId: s._id,
          sectionName: s.name,
          releaseType: i === 0 ? 'Immediately on enroll' : 'After previous complete or',
          delayDays: i === 0 ? 0 : 7,
        })),
  )

  return (
    <>
      {toast.node}
      {!enabled ? (
        <EmptyState
          icon="💧"
          title="Drip is off"
          body="Release modules on a schedule instead of all at once."
          action={
            <Button
              className="mt-3"
              onClick={() => {
                setEnabled(true)
                toast.show('Drip enabled — set your schedule below')
              }}
            >
              Enable drip schedule
            </Button>
          }
        />
      ) : (
        <Panel
          title="Drip schedule"
          actions={
            <div className="flex items-center gap-3">
              <Toggle checked={enabled} onChange={setEnabled} label="Drip enabled" />
              <Button
                size="sm"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate(
                    { dripEnabled: enabled, dripSchedule: rules },
                    { onSuccess: () => toast.show('Drip saved ✓') },
                  )
                }
              >
                Save
              </Button>
            </div>
          }
        >
          <div className="grid gap-3">
            {rules.map((r, i) => (
              <div
                key={r.sectionId || i}
                className="grid grid-cols-[1fr_220px_140px] items-end gap-3 rounded-lg2 border border-line-admin p-4 mx-960:grid-cols-1"
              >
                <div>
                  <p className="text-[0.75rem] uppercase tracking-wide text-muted-admin">
                    Module {i + 1}
                  </p>
                  <h4 className="text-[0.95rem]">{r.sectionName}</h4>
                </div>
                <SelectField
                  label="Release"
                  value={r.releaseType}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((x, xi) => (xi === i ? { ...x, releaseType: e.target.value } : x)),
                    )
                  }
                  options={['Immediately on enroll', 'After previous complete or']}
                />
                <TextField
                  label="Delay (days)"
                  type="number"
                  min="0"
                  value={r.delayDays}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((x, xi) =>
                        xi === i ? { ...x, delayDays: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  )
}

/* -------------------------------- Automation ------------------------------ */
export function CourseAutomation() {
  const course = useOutletContext()
  const save = useSaveTab('automation')
  const toast = useToast()
  const [rules, setRules] = useState(course.automationRules || [])

  const patch = (i, p) => setRules((prev) => prev.map((r, x) => (x === i ? { ...r, ...p } : r)))

  return (
    <>
      {toast.node}
      <Panel
        title="Automation rules"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setRules((p) => [
                  ...p,
                  {
                    trigger: 'OnEnroll',
                    action: 'Send email sequence',
                    delay: 'Immediate',
                    enabled: true,
                  },
                ])
              }
            >
              + Add rule
            </Button>
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  { automationRules: rules },
                  { onSuccess: () => toast.show('Automation saved ✓') },
                )
              }
            >
              Save
            </Button>
          </div>
        }
      >
        {rules.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="No automation yet"
            body="Trigger emails, tags or webhooks when learners hit a milestone."
          />
        ) : (
          <div className="grid gap-3">
            {rules.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_160px_auto_auto] items-end gap-3 rounded-lg2 border border-line-admin p-4 mx-960:grid-cols-1"
              >
                <SelectField
                  label="When"
                  value={r.trigger}
                  onChange={(e) => patch(i, { trigger: e.target.value })}
                  options={['OnEnroll', 'OnLessonComplete', 'OnCourseComplete']}
                />
                <SelectField
                  label="Then"
                  value={r.action}
                  onChange={(e) => patch(i, { action: e.target.value })}
                  options={['Send email sequence', 'Add tag', 'Webhook']}
                />
                <TextField
                  label="Delay"
                  value={r.delay}
                  onChange={(e) => patch(i, { delay: e.target.value })}
                />
                <div className="pb-2">
                  <Toggle
                    checked={!!r.enabled}
                    onChange={(v) => patch(i, { enabled: v })}
                    label="Rule enabled"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRules((p) => p.filter((_, x) => x !== i))}
                  className="pb-2 text-danger-admin"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}

/* --------------------------------- Students ------------------------------- */
export function CourseStudents() {
  const { id } = useParams()
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'courses', id, 'students'],
    queryFn: async () => (await api.get(`/admin/courses/${id}/students`)).data,
  })

  if (isPending) return <Loading />

  return (
    <DataTable
      rows={data.items}
      rowKey={(r) => r.id}
      searchPlaceholder="Search students…"
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        {
          key: 'progress',
          label: 'Progress',
          render: (r) => (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-mist">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${r.progress}%` }}
                />
              </div>
              <span className="text-[0.8rem]">{r.progress}%</span>
            </div>
          ),
        },
        {
          key: 'lastActive',
          label: 'Last active',
          render: (r) =>
            r.lastActive
              ? new Date(r.lastActive).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                })
              : 'Never',
        },
        { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
      ]}
      empty={
        <EmptyState
          icon="👥"
          title="No students yet"
          body="They appear here as soon as someone enrolls."
        />
      }
    />
  )
}
