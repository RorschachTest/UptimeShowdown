import { stageStars } from '../../engine/estimate'
import type { EstimateQuestion } from '../../engine/types'
import { useGameStore } from '../../store'
import { Equation, Order, Pick, type QuestionProps } from './questions'

/** One renderer per question kind; a new kind adds a component here. */
function QuestionBody(props: QuestionProps<EstimateQuestion>) {
  const q = props.question
  if (q.kind === 'pick') return <Pick {...props} question={q} />
  if (q.kind === 'order') return <Order {...props} question={q} />
  return <Equation {...props} question={q} />
}

function Stars({ n, size = 'text-base' }: { n: number; size?: string }) {
  return (
    <span className={`${size} tracking-wider text-warn`} aria-label={`${n} of 3 stars`}>
      {'★'.repeat(n)}
      <span className="text-ink-faint">{'★'.repeat(3 - n)}</span>
    </span>
  )
}

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

          {stage.questions.map((q, i) => {
            const grade = e.grades[q.id]
            const answer = e.answers[q.id]
            return (
              <section key={q.id} className="piece px-5 py-4" aria-label={`Question ${i + 1}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{q.prompt}</h3>
                  {grade && <Stars n={grade.stars} />}
                </div>
                <div className="mt-3">
                  <QuestionBody question={q} answer={answer} locked={!!grade} onAnswer={(a) => setAnswer(q.id, a)} />
                </div>
                {grade ? (
                  <div className="mt-3 rounded-lg bg-board px-3 py-2 text-sm">
                    <p className={`font-semibold ${grade.stars > 0 ? 'text-ok' : 'text-bad'}`}>{grade.message}</p>
                    <p className="mt-1 text-ink-soft">{q.explain}</p>
                    <button type="button" onClick={() => retryQuestion(q.id)} className="mt-2 rounded-lg border-2 border-ink px-2.5 py-1 text-xs font-semibold hover:bg-piece">
                      Try again
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!answer}
                    onClick={() => checkAnswer(q.id)}
                    className="piece mt-3 bg-ink px-3 py-1.5 text-sm font-bold text-piece disabled:opacity-40"
                  >
                    Check
                  </button>
                )}
              </section>
            )
          })}

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
