import { useGameStore } from '../store'
import { fmtMs, fmtPct } from './format'
import { TYPE_COLORS } from './settings'

function Stars({ n, label }: { n: number; label?: string }) {
  return (
    <span className="tracking-wider text-warn" aria-label={label ?? `${n} of 3 stars`}>
      {'★'.repeat(n)}
      <span className="text-ink-faint">{'★'.repeat(3 - n)}</span>
    </span>
  )
}

/** Current stage: story, goals, which request types the design can serve, and the result when done. */
export function StageBanner() {
  const chapter = useGameStore((s) => s.chapter)
  const stageIndex = useGameStore((s) => s.stageIndex)
  const best = useGameStore((s) => s.best)
  const result = useGameStore((s) => s.result)
  const reach = useGameStore((s) => s.sim.reach.traffic)
  const { goToStage, reset } = useGameStore.getState()
  const stage = chapter.stages[stageIndex]!
  // A stage is open once the previous one earned at least a star.
  const open = (i: number) => i === 0 || (best[i - 1] ?? 0) > 0
  const types = chapter.requestTypes.map((rt, t) => ({ rt, t })).filter(({ rt }) => (stage.mix[rt.id] ?? 0) > 0)
  const hasNext = stageIndex + 1 < chapter.stages.length

  return (
    <section className="flex flex-wrap items-start gap-x-6 gap-y-2 border-b-2 border-ink bg-piece px-5 py-2.5" aria-label="Stage">
      <nav className="flex items-center gap-1" aria-label="Stages">
        {chapter.stages.map((s, i) => (
          <button
            key={s.id}
            type="button"
            disabled={!open(i)}
            onClick={() => goToStage(i)}
            aria-current={i === stageIndex ? 'step' : undefined}
            title={open(i) ? s.title : 'Earn a star on the previous stage to open this one'}
            className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35 ${
              i === stageIndex ? 'border-ink bg-ink text-piece' : (best[i] ?? 0) > 0 ? 'border-ok text-ok' : 'border-ink/30'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <div className="min-w-64 flex-1">
        <h2 className="font-bold">
          Stage {stageIndex + 1} of {chapter.stages.length}: {stage.title}
        </h2>
        <p className="max-w-[65ch] text-sm text-ink-soft">{stage.story}</p>
        <p className="mt-1 text-xs text-ink-soft">
          Goals: uptime ≥ {fmtPct(stage.goals.uptime)}, p95 ≤ {fmtMs(stage.goals.p95Ms)}, budget {stage.budget}/min.
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5 self-center" aria-label="Request types">
        {types.map(({ rt, t }) => {
          const ok = reach?.[t]?.[0] === true
          return (
            <li
              key={rt.id}
              className={`flex items-center gap-1.5 rounded-full border-2 px-2 py-0.5 text-xs font-semibold ${ok ? 'border-ink/20' : 'border-bad text-bad'}`}
              title={ok ? 'Your design has a path that can serve these' : 'No path can serve these yet: they will fail'}
            >
              <span className="size-2 rounded-full" style={{ background: TYPE_COLORS[rt.id] }} aria-hidden="true" />
              {rt.label} {fmtPct(stage.mix[rt.id] ?? 0)}
              <span aria-label={ok ? 'served' : 'no path'}>{ok ? '✓' : '✗'}</span>
            </li>
          )
        })}
      </ul>

      {result && (
        <div className="flex items-center gap-3 self-center rounded-xl border-2 border-ink px-3 py-1.5" role="status">
          <div>
            <div className="text-lg leading-none">
              <Stars n={result.stars} />
            </div>
            <p className="mt-1 max-w-72 text-xs text-ink-soft">{result.missed[0] ?? 'Goals met, on budget, nothing wasted.'}</p>
          </div>
          <button type="button" onClick={reset} className="rounded-lg border-2 border-ink px-2.5 py-1 text-sm font-semibold hover:bg-board">
            Try again
          </button>
          {hasNext && (
            <button
              type="button"
              disabled={result.stars === 0}
              onClick={() => goToStage(stageIndex + 1)}
              className="piece bg-ink px-3 py-1 text-sm font-bold text-piece disabled:opacity-40"
            >
              Next stage
            </button>
          )}
        </div>
      )}
    </section>
  )
}
