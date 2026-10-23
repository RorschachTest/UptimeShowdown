import { useGameStore } from '../../store'
import { FACT_LABELS } from './facts'

const VERDICT = {
  high: { text: 'Useful', className: 'text-ok' },
  low: { text: "Didn't change the design", className: 'text-ink-soft' },
  trap: { text: 'Wasted question', className: 'text-bad' },
} as const

/** Step 1: ask a few questions (each high-value one reveals a hidden fact), then cut the scope. */
export function ScopePanel() {
  const iv = useGameStore((s) => s.interview)!
  const { ask, toggleFeature, finishScope, restartScope } = useGameStore.getState()
  const left = iv.level.questionBudget - iv.asked.length

  return (
    <div className="flex-1 overflow-y-auto bg-board p-6">
      <div className="mx-auto max-w-5xl">
        <section className="piece px-5 py-4">
          <p className="text-sm text-ink-soft">The interviewer says:</p>
          <h2 className="mt-1 text-2xl leading-snug font-bold">{iv.level.prompt}</h2>
          <p className="mt-2 max-w-[70ch] text-sm text-ink-soft">
            Don't draw anything yet. Ask the questions that would change your design. You only get {iv.level.questionBudget}; click an
            asked question to take it back.
          </p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section aria-label="Questions">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-bold">Ask questions</h3>
              <span className={`text-sm font-semibold ${left === 0 ? 'text-bad' : 'text-ink-soft'}`}>
                {left} of {iv.level.questionBudget} left
              </span>
            </div>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {iv.level.questions.map((q) => {
                const asked = iv.asked.includes(q.id)
                const verdict = VERDICT[q.leverage]
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      disabled={!asked && left === 0}
                      onClick={() => ask(q.id)}
                      aria-pressed={asked}
                      className={`h-full w-full rounded-xl border-2 px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40 ${
                        asked ? 'border-ink bg-piece' : 'border-dashed border-ink/30 bg-panel hover:border-ink'
                      }`}
                    >
                      <span className="font-semibold">{q.text}</span>
                      {asked && (
                        <>
                          <span className="mt-1.5 block text-ink-soft">{q.answer}</span>
                          <span className={`mt-1.5 block text-xs font-semibold ${verdict.className}`}>
                            {verdict.text}
                            {q.reveals.length > 0 && `: revealed ${q.reveals.map((f) => FACT_LABELS[f].toLowerCase()).join(', ')}`}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-label="Scope">
            <h3 className="text-lg font-bold">What will you build?</h3>
            <p className="mt-0.5 text-sm text-ink-soft">Keep the core. Everything else is out of scope for now.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {iv.level.features.map((f) => {
                const on = iv.inScope.includes(f.id)
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleFeature(f.id)}
                      className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-sm font-semibold ${
                        on ? 'border-ink bg-ink text-piece' : 'border-ink/25 bg-piece hover:border-ink'
                      }`}
                    >
                      {f.text}
                      <span className="text-xs opacity-80">{on ? 'In scope' : 'Out'}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={restartScope}
                disabled={iv.asked.length === 0 && iv.inScope.length === 0}
                className="rounded-lg border-2 border-ink px-3 py-2 text-sm font-semibold hover:bg-board disabled:opacity-40"
              >
                Start over
              </button>
              <button type="button" onClick={finishScope} className="piece flex-1 bg-ink py-2 font-bold text-piece active:translate-x-px active:translate-y-px">
                Start designing
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
