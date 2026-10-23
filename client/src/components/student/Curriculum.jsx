import { cn } from '../ui/index.jsx'
import { formatTotal, isPlayablePreview, lessonLength, toSeconds } from './curriculum.js'

/**
 * The "Course content" list, shared by the course player (enrolled: checkboxes,
 * every lesson playable) and the public course page (preview: lessons locked
 * except the free previews). One list so the two pages cannot drift apart.
 */

const TYPE_ICON = { Video: '▶', Quiz: '?', PDF: '▤', 'E-book': '▤', Text: '▤', Live: '●' }

/**
 * @param {'player'|'preview'} mode
 * @param {Set<string>} [completed]   player only
 * @param {(lesson, done) => void} [onToggleDone]  player only
 * @param {(lesson) => void} onSelect  receives the lesson with `sectionId` set
 */
export default function CurriculumList({
  course,
  mode = 'player',
  completed = new Set(),
  activeId,
  openSections,
  onToggleSection,
  onSelect,
  onToggleDone,
  busy,
}) {
  const isPlayer = mode === 'player'
  // Lesson numbers run across the whole course, counted from the data rather
  // than from what is rendered — a collapsed section must not renumber the rest.
  const firstNumber = course.sections.reduce(
    (acc, s, i) => [...acc, i === 0 ? 1 : acc[i - 1] + course.sections[i - 1].lessons.length],
    [],
  )

  return (
    <div>
      {course.sections.map((section, si) => {
        const open = openSections[String(section._id)]
        const done = section.lessons.filter((l) => completed.has(String(l._id))).length
        const total = formatTotal(section.lessons.reduce((t, l) => t + toSeconds(l.duration), 0))
        const count = section.lessons.length
        return (
          <div key={section._id} className="border-b border-line-solid">
            <button
              type="button"
              aria-expanded={!!open}
              onClick={() => onToggleSection(section._id)}
              className="flex w-full items-start justify-between gap-3 bg-surface-mist px-4 py-3.5 text-left transition-colors duration-200 ease-gs hover:bg-surface"
            >
              <span>
                <span className="block text-[0.92rem] font-bold leading-snug text-brand-deep">
                  Section {si + 1}: {section.name}
                </span>
                <span className="mt-1 block text-[0.75rem] text-muted">
                  {isPlayer
                    ? `${done} / ${count}`
                    : `${count} ${count === 1 ? 'lesson' : 'lessons'}`}
                  {total && ` | ${total}`}
                </span>
              </span>
              <span
                className={cn(
                  'mt-0.5 shrink-0 text-muted transition-transform duration-200',
                  open && 'rotate-180',
                )}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>

            {open && (
              <ul>
                {section.lessons.map((l, li) => {
                  const number = firstNumber[si] + li
                  const id = String(l._id)
                  const isDone = completed.has(id)
                  const active = id === activeId
                  const lesson = { ...l, sectionId: section._id, sectionName: section.name }
                  const preview = !isPlayer && isPlayablePreview(l)
                  const selectable = isPlayer || preview

                  const label = (
                    <>
                      <span
                        className={cn(
                          'block text-[0.86rem] leading-snug',
                          active ? 'font-semibold text-brand' : 'text-ink',
                        )}
                      >
                        {number}. {l.name}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[0.74rem] text-muted">
                        <span aria-hidden="true">{TYPE_ICON[l.contentType] || '▤'}</span>
                        {lessonLength(l.duration) || l.contentType}
                        {preview && (
                          <span className="ml-auto font-semibold text-brand underline underline-offset-2">
                            Preview
                          </span>
                        )}
                      </span>
                    </>
                  )

                  return (
                    <li
                      key={l._id}
                      className={cn(
                        'flex gap-3 px-4 py-3 transition-colors duration-200 ease-gs',
                        active ? 'bg-accent-soft' : selectable && 'hover:bg-surface',
                      )}
                    >
                      {isPlayer ? (
                        // A real checkbox: keyboard and screen readers get
                        // "mark complete" without opening the lesson.
                        <input
                          type="checkbox"
                          checked={isDone}
                          disabled={busy}
                          onChange={() => onToggleDone(lesson, !isDone)}
                          aria-label={`Mark "${l.name}" as ${isDone ? 'not complete' : 'complete'}`}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
                        />
                      ) : (
                        <span
                          className="mt-0.5 w-4 shrink-0 text-center text-[0.8rem] text-muted"
                          aria-label={preview ? 'Free preview' : 'Locked'}
                          role="img"
                        >
                          {preview ? '▶' : '🔒'}
                        </span>
                      )}
                      {selectable ? (
                        <button
                          type="button"
                          onClick={() => onSelect(lesson)}
                          aria-current={active ? 'true' : undefined}
                          className="min-w-0 flex-1 text-left"
                        >
                          {label}
                        </button>
                      ) : (
                        <div className="min-w-0 flex-1">{label}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
