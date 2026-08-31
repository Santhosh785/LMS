import { Link } from 'react-router-dom'
import { cn } from '../ui/index.jsx'
import CoverArt from '../CoverArt.jsx'

export function PageHead({ title, sub, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[clamp(1.4rem,2.4vw,1.8rem)]">{title}</h1>
        {sub && <p className="mt-1 text-[0.92rem] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatTile({ label, value, sub }) {
  return (
    <div className="rounded-lg2 border border-line bg-white p-5 shadow-tiny">
      <p className="text-[0.8rem] text-muted">{label}</p>
      <strong className="mt-1 block text-[1.7rem] leading-none text-brand-deep">{value}</strong>
      {sub && <p className="mt-1.5 text-[0.78rem] text-muted">{sub}</p>}
    </div>
  )
}

export function ProgressBar({ value, className }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-mist', className)}>
      <div
        className="h-full rounded-full bg-accent transition-all duration-300 ease-gs"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

export function CourseProgressCard({ enrollment }) {
  const course = enrollment.courseId
  if (!course) return null
  return (
    <article
      data-st-course={course.title}
      className="overflow-hidden rounded-lg2 border border-line bg-white shadow-tiny transition-transform duration-200 ease-gs hover:-translate-y-1"
    >
      <CoverArt
        image={course.image}
        imageAlt={course.imageAlt}
        gradientClass={course.thumbClass}
        label={course.mediaLabel || course.title}
        labelClass="text-[0.95rem]"
        className="h-24 px-3"
        sizes="280px"
      />
      <div className="p-4">
        <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-accent-mid">
          {course.kind}
        </p>
        <h3 className="mt-1 text-[0.98rem]">{course.title}</h3>
        <p className="mt-1 text-[0.78rem] text-muted">Self-paced · {course.hours} hrs</p>
        <ProgressBar value={enrollment.progressPct} className="mt-3" />
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[0.8rem] font-semibold text-brand">{enrollment.progressPct}%</span>
          <Link
            to={`/student/courses/${course.slug}`}
            className="text-[0.82rem] font-semibold text-brand hover:underline"
          >
            {enrollment.progressPct > 0 ? 'Resume' : 'Start'}
          </Link>
        </div>
      </div>
    </article>
  )
}

export function EventCard({ event }) {
  const date = new Date(event.startsAt)
  return (
    <div className="flex gap-3 rounded-lg2 border border-line bg-white p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md2 bg-accent-soft text-center leading-tight">
        <span className="text-[1rem] font-black text-brand">{date.getDate()}</span>
        <span className="text-[0.6rem] font-bold uppercase text-brand">
          {date.toLocaleString('en-IN', { month: 'short' })}
        </span>
      </div>
      <div className="min-w-0">
        <h4 className="truncate text-[0.92rem]">{event.title}</h4>
        <p className="mt-0.5 text-[0.78rem] text-muted">
          {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ·{' '}
          {event.durationMins} min · {event.kind}
        </p>
      </div>
    </div>
  )
}
