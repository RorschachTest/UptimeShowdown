import { changedPieces } from '../../engine/interview'
import type { QuestionCard } from '../../engine/types'
import { PHASES } from '../../interviewSlice'
import { useGameStore } from '../../store'
import { toSimGraph } from '../graph'
import { FACT_LABELS } from './facts'

/** One chip per fact-revealing question: its short answer once asked, "?" until then. */
function FactChip({ question, asked }: { question: QuestionCard; asked: boolean }) {
  const label = FACT_LABELS[question.reveals[0]!]
  return (
    <li
      className={`rounded-full border-2 px-2 py-0.5 text-xs font-semibold ${asked ? 'border-ink/20' : 'border-dashed border-ink/30 text-ink-faint'}`}
      title={asked ? question.answer : `Not asked: ${question.text}`}
    >
      {label}: {asked ? (question.short ?? question.answer) : '?'}
    </li>
  )
}

/** Interview progress (Scope → Propose → Run → Deep dive → Wrap-up) and the current step's action. */
export function InterviewBar() {
  const iv = useGameStore((s) => s.interview)!
  const changes = useGameStore((s) => (s.interview?.snapshot ? changedPieces(s.interview.snapshot, toSimGraph(s.nodes, s.edges)) : 0))
  const { propose, startDeepDive, reviseDesign, goBackTo } = useGameStore.getState()
  const current = PHASES.findIndex((p) => p.id === iv.phase)
  const done = iv.phase === 'done'

  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-piece px-5 py-2.5" aria-label="Interview">
      <ol className="flex items-center gap-1 text-xs font-semibold" aria-label="Interview steps">
        {PHASES.map((p, i) => {
          const pill = `rounded-full border-2 px-2 py-0.5 ${
            p.id === iv.phase ? 'border-ink bg-ink text-piece' : i < current || done ? 'border-ok text-ok' : 'border-ink/20 text-ink-faint'
          }`
          // Earlier design steps can be revisited; the board comes along.
          const back = (p.id === 'scope' || p.id === 'propose') && (i < current || done) ? p.id : null
          return (
            <li key={p.id} aria-current={p.id === iv.phase ? 'step' : undefined}>
              {back ? (
                <button type="button" onClick={() => goBackTo(back)} className={`${pill} hover:bg-ok/10`} title={`Go back to ${p.label.toLowerCase()}, keeping your design`}>
                  {i + 1}. {p.label}
                </button>
              ) : (
                <span className={`block ${pill}`}>
                  {i + 1}. {p.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <div className="min-w-64 flex-1">
        {iv.phase === 'scope' && <p className="text-sm text-ink-soft">Ask your questions and cut the scope before drawing anything.</p>}
        {iv.phase === 'propose' && <p className="text-sm text-ink-soft">{iv.level.prompt} Build your design, then propose it to the interviewer.</p>}
        {iv.phase === 'run' && (
          <p className="text-sm text-ink-soft">
            {iv.runResult
              ? `${'★'.repeat(iv.runResult.stars) || 'No stars'}: ${iv.runResult.missed[0] ?? 'Goals met.'}`
              : 'Your design is live. Watch how it copes.'}
          </p>
        )}
        {iv.phase === 'deepdive' && (
          <p className="text-sm">
            <span className="font-bold">{iv.level.curveball.title}.</span> <span className="text-ink-soft">{iv.level.curveball.story}</span>
          </p>
        )}
        {(iv.phase === 'wrapup' || done) && <p className="text-sm text-ink-soft">Wrap up: talk through what you saw.</p>}
      </div>

      {iv.phase !== 'scope' && (
        <ul className="flex flex-wrap gap-1.5" aria-label="What you know">
          {iv.level.questions
            .filter((q) => q.reveals.length > 0)
            .map((q) => (
              <FactChip key={q.id} question={q} asked={iv.asked.includes(q.id)} />
            ))}
        </ul>
      )}

      {iv.phase === 'propose' && (
        <button type="button" onClick={propose} className="piece bg-ink px-3 py-1.5 text-sm font-bold text-piece">
          Propose design
        </button>
      )}
      {iv.phase === 'run' && iv.runResult && (
        <button type="button" onClick={reviseDesign} className="rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-semibold hover:bg-board">
          Revise design
        </button>
      )}
      {iv.phase === 'run' && iv.runResult && (
        <button type="button" disabled={iv.runResult.stars === 0} onClick={startDeepDive} className="piece bg-ink px-3 py-1.5 text-sm font-bold text-piece disabled:opacity-40" title={iv.runResult.stars === 0 ? 'Get at least one star first: revise your design and run it again' : undefined}>
          Face the curveball
        </button>
      )}
      {iv.phase === 'deepdive' && (
        <span className={`rounded-lg border-2 px-2.5 py-1 text-sm font-semibold ${changes > iv.level.editBudget ? 'border-bad text-bad' : 'border-ink/20'}`}>
          Changes {changes} / {iv.level.editBudget}
        </span>
      )}
    </section>
  )
}
