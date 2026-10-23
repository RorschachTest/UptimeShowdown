import { changedPieces, interviewReport, scopeScore } from '../../engine/interview'
import { useGameStore } from '../../store'
import { toSimGraph } from '../graph'

function Card({ title, children, label }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex items-start justify-center overflow-y-auto bg-ink/25 p-6" role="dialog" aria-modal="true" aria-label={label}>
      <div className="piece w-full max-w-xl px-5 py-4">
        <h2 className="text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

const btn = 'rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-semibold hover:bg-board'
const primary = 'piece bg-ink px-3 py-1.5 text-sm font-bold text-piece active:translate-x-px active:translate-y-px'

function Review() {
  const notes = useGameStore((s) => s.interview!.review!)
  const { closeReview, startRun } = useGameStore.getState()
  return (
    <Card title="The interviewer looks at your design" label="Interviewer review">
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {notes.map((n) => (
          <li key={n.text} className="flex gap-2">
            <span className={n.tone === 'ok' ? 'text-ok' : 'text-warn'} aria-hidden="true">
              {n.tone === 'ok' ? '✓' : '!'}
            </span>
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={closeReview} className={btn}>
          Revise design
        </button>
        <button type="button" onClick={startRun} className={primary}>
          Run it
        </button>
      </div>
    </Card>
  )
}

function WrapUp() {
  const iv = useGameStore((s) => s.interview!)
  const { answer, finishWrapUp } = useGameStore.getState()
  const allAnswered = iv.wrapQuestions.every((q) => q.id in iv.answers)
  return (
    <Card title="Wrap-up" label="Wrap-up questions">
      <p className="mt-1 text-sm text-ink-soft">Answer from what you saw in your own runs.</p>
      {iv.wrapQuestions.map((q) => {
        const picked = iv.answers[q.id]
        return (
          <section key={q.id} className="mt-4">
            <h3 className="font-semibold">{q.prompt}</h3>
            <div className="mt-2 flex flex-col gap-1.5">
              {q.options.map((o) => {
                const shown = picked !== undefined
                const tone = !shown ? '' : o.correct ? 'border-ok text-ok' : o.id === picked ? 'border-bad text-bad' : 'opacity-50'
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={shown}
                    onClick={() => answer(q.id, o.id)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-left text-sm font-semibold ${shown ? tone : 'border-ink/25 hover:border-ink'}`}
                  >
                    {o.text}
                    {shown && o.correct && ' ✓'}
                  </button>
                )
              })}
            </div>
            {picked !== undefined && <p className="mt-2 text-sm text-ink-soft">{q.explain}</p>}
          </section>
        )
      })}
      <div className="mt-4 flex justify-end">
        <button type="button" disabled={!allAnswered} onClick={finishWrapUp} className={`${primary} disabled:opacity-40`}>
          See your report card
        </button>
      </div>
    </Card>
  )
}

function ReportCard() {
  const iv = useGameStore((s) => s.interview!)
  const nodes = useGameStore((s) => s.nodes)
  const edges = useGameStore((s) => s.edges)
  const levelId = useGameStore((s) => s.levelId)
  const openLevel = useGameStore((s) => s.openLevel)
  const graph = toSimGraph(nodes, edges)
  const report = interviewReport({
    scope: scopeScore(iv.level, iv.asked, iv.inScope),
    run: iv.runResult!,
    deep: iv.deepResult!,
    changes: iv.snapshot ? changedPieces(iv.snapshot, graph) : 0,
    editBudget: iv.level.editBudget,
    wrapUpCorrect: iv.wrapQuestions.filter((q) => q.options.find((o) => o.id === iv.answers[q.id])?.correct).length,
    wrapUpTotal: iv.wrapQuestions.length,
  })
  return (
    <Card title="Report card" label="Report card">
      <p className="mt-1 text-3xl tracking-wider text-warn" aria-label={`${report.stars} of 3 stars`}>
        {'★'.repeat(report.stars)}
        <span className="text-ink-faint">{'★'.repeat(3 - report.stars)}</span>
      </p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {report.lines.map((l) => (
          <li key={l.step} className="grid grid-cols-[auto_6rem_1fr] gap-2">
            <span className={l.ok ? 'text-ok' : 'text-bad'} aria-label={l.ok ? 'passed' : 'missed'}>
              {l.ok ? '✓' : '✗'}
            </span>
            <span className="font-semibold">{l.step}</span>
            <span className="text-ink-soft">{l.detail}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => openLevel('ch1')} className={btn}>
          Back to Chapter 1
        </button>
        <button type="button" onClick={() => openLevel(levelId)} className={primary}>
          Try again
        </button>
      </div>
    </Card>
  )
}

/** Whichever interview dialog the current step needs, over the board. */
export function InterviewOverlay() {
  const phase = useGameStore((s) => s.interview?.phase)
  const reviewing = useGameStore((s) => s.interview?.review != null)
  if (reviewing) return <Review />
  if (phase === 'wrapup') return <WrapUp />
  if (phase === 'done') return <ReportCard />
  return null
}
