import { CHAPTERS, type ChapterEntry } from '../../levels'
import { useGameStore } from '../../store'
import { Stars } from '../estimate/QuestionCard'

const KIND_LABEL: Record<ChapterEntry['play']['kind'], string> = {
  ladder: 'Staged build',
  estimate: 'Estimation desk',
  interview: 'Design interview',
  review: 'Review',
}

function ChapterCard({ entry }: { entry: ChapterEntry }) {
  const progress = useGameStore((s) => s.progress[entry.id])
  const openChapter = useGameStore((s) => s.openChapter)
  return (
    <li className="piece flex flex-col px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-ink-soft">Chapter {entry.number}</span>
        <Stars n={progress?.stars ?? 0} size="text-sm" />
      </div>
      <h3 className="mt-0.5 leading-snug font-bold">{entry.title}</h3>
      <p className="mt-1 flex-1 text-xs text-ink-soft">{entry.lesson.summary}</p>
      <p className="mt-2 text-xs text-ink-faint">
        {KIND_LABEL[entry.play.kind]}
        {progress?.learned && <span className="ml-1.5 font-semibold text-ok">· Learned ✓</span>}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => openChapter(entry.id, 'lesson')} className="flex-1 rounded-lg border-2 border-ink py-1 text-sm font-semibold hover:bg-board">
          Learn
        </button>
        <button type="button" onClick={() => openChapter(entry.id, 'play')} className="piece flex-1 bg-ink py-1 text-sm font-bold text-piece">
          Play
        </button>
      </div>
    </li>
  )
}

/** Chapter select: both volumes, with stars and lesson status per chapter. */
export function Campaign() {
  const progress = useGameStore((s) => s.progress)
  const earned = CHAPTERS.reduce((s, c) => s + (progress[c.id]?.stars ?? 0), 0)
  return (
    <div className="flex-1 overflow-y-auto bg-board p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Uptime Showdown</h1>
            <p className="mt-1 max-w-[65ch] text-ink-soft">
              Learn a system-design idea, then build it and watch real traffic hit it. Every chapter is a lesson and a hands-on.
            </p>
          </div>
          <p className="text-sm font-semibold">
            {earned} of {CHAPTERS.length * 3} stars
          </p>
        </header>
        {([1, 2] as const).map((vol) => {
          const chapters = CHAPTERS.filter((c) => c.volume === vol)
          if (chapters.length === 0) return null
          return (
            <section key={vol} className="mt-8" aria-label={`Volume ${vol}`}>
              <h2 className="text-xl font-bold">Volume {vol}</h2>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {chapters.map((c) => (
                  <ChapterCard key={c.id} entry={c} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
