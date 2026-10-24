import type { Grade } from '../../engine/estimate'
import type { EstimateAnswer, EstimateQuestion } from '../../engine/types'
import { Equation, Order, Pick, type QuestionProps } from './questions'

/** One renderer per question kind; a new kind adds a component here. */
function QuestionBody(props: QuestionProps<EstimateQuestion>) {
  const q = props.question
  if (q.kind === 'pick') return <Pick {...props} question={q} />
  if (q.kind === 'order') return <Order {...props} question={q} />
  return <Equation {...props} question={q} />
}

export function Stars({ n, size = 'text-base' }: { n: number; size?: string }) {
  return (
    <span className={`${size} tracking-wider text-warn`} aria-label={`${n} of 3 stars`}>
      {'★'.repeat(n)}
      <span className="text-ink-faint">{'★'.repeat(3 - n)}</span>
    </span>
  )
}

/** A question with Check / Try again and the graded explanation. Shared by the estimation desk and lesson quizzes. */
export function QuestionCard(props: {
  index: number
  question: EstimateQuestion
  answer: EstimateAnswer | undefined
  grade: Grade | undefined
  onAnswer: (a: EstimateAnswer) => void
  onCheck: () => void
  onRetry: () => void
}) {
  const { index, question: q, answer, grade, onAnswer, onCheck, onRetry } = props
  return (
    <section className="piece px-5 py-4" aria-label={`Question ${index + 1}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{q.prompt}</h3>
        {grade && <Stars n={grade.stars} />}
      </div>
      <div className="mt-3">
        <QuestionBody question={q} answer={answer} locked={!!grade} onAnswer={onAnswer} />
      </div>
      {grade ? (
        <div className="mt-3 rounded-lg bg-board px-3 py-2 text-sm">
          <p className={`font-semibold ${grade.stars > 0 ? 'text-ok' : 'text-bad'}`}>{grade.message}</p>
          <p className="mt-1 text-ink-soft">{q.explain}</p>
          <button type="button" onClick={onRetry} className="mt-2 rounded-lg border-2 border-ink px-2.5 py-1 text-xs font-semibold hover:bg-piece">
            Try again
          </button>
        </div>
      ) : (
        <button type="button" disabled={!answer} onClick={onCheck} className="piece mt-3 bg-ink px-3 py-1.5 text-sm font-bold text-piece disabled:opacity-40">
          Check
        </button>
      )}
    </section>
  )
}
