import { stageStars } from '../../engine/estimate'
import { useGameStore } from '../../store'
import { QuestionCard, Stars } from './QuestionCard'

/** Chapter 2: stages of estimation questions, answered with the mouse and graded by order of magnitude. */
export function EstimateDesk() {
  const e = useGameStore((s) => s.estimate)!
  const { setAnswer, checkAnswer, retryQuestion, goToEstimateStage } = useGameStore.getState()
  const stage = e.level.stages[e.stageIndex]!
  const stars = stageStars(stage, e.grades)
  const open = (i: number) => i === 0 || (e.best[i - 1] ?? 0) > 0
  const hasNext = e.stageIndex + 1 < e.level.stages.length

  return (
    <div className="flex min-h-0 flex-1">
      <nav className="w-60 shrink-0 overflow-y-auto border-r-2 border-ink bg-panel p-4" aria-label="Stages">
        <h2 className="text-lg font-bold">{e.level.title}</h2>
        <ol className="mt-3 flex flex-col gap-1.5">
          {e.level.stages.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={!open(i)}
                aria-current={i === e.stageIndex ? 'step' : undefined}
                onClick={() => goToEstimateStage(i)}
                title={open(i) ? undefined : 'Earn a star on the previous stage first'}
                className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-1.5 text-left text-sm font-semibold disabled:opacity-40 ${
                  i === e.stageIndex ? 'border-ink bg-ink text-piece' : 'border-ink/15 hover:border-ink'
                }`}
              >
                {i + 1}. {s.title}
                {(e.best[i] ?? 0) > 0 && <Stars n={e.best[i]!} size="text-xs" />}
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs leading-snug text-ink-soft">
          Round hard and keep the units. An answer within 2× is the right order of magnitude, and that is what decides a design.
        </p>
      </nav>

      <div className="flex-1 overflow-y-auto bg-board p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <header>
            <h2 className="text-2xl font-bold">
              {e.stageIndex + 1}. {stage.title}
            </h2>
            <p className="mt-1 max-w-[65ch] text-ink-soft">{stage.story}</p>
          </header>

          {stage.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              index={i}
              question={q}
              answer={e.answers[q.id]}
              grade={e.grades[q.id]}
              onAnswer={(a) => setAnswer(q.id, a)}
              onCheck={() => checkAnswer(q.id)}
              onRetry={() => retryQuestion(q.id)}
            />
          ))}

          {stars !== null && (
            <section className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-piece px-5 py-3" role="status">
              <div>
                <Stars n={stars} size="text-2xl" />
                <p className="text-sm text-ink-soft">{stars > 0 ? 'Stage complete.' : 'Get at least one star to open the next stage. Try again on any question.'}</p>
              </div>
              {hasNext && (
                <button type="button" disabled={stars === 0} onClick={() => goToEstimateStage(e.stageIndex + 1)} className="piece bg-ink px-3 py-1.5 font-bold text-piece disabled:opacity-40">
                  Next stage
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
