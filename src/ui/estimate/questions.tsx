import { evaluate, formatQuantity, formatUnits } from '../../engine/estimate'
import type { EquationQuestion, EquationStep, EstimateAnswer, EstimateQuestion, OrderQuestion, PickQuestion } from '../../engine/types'

/** Props every question component gets. `locked` once checked, until the player tries again. */
export interface QuestionProps<Q extends EstimateQuestion> {
  question: Q
  answer: EstimateAnswer | undefined
  locked: boolean
  onAnswer: (a: EstimateAnswer) => void
}

const chip = 'rounded-lg border-2 px-3 py-1.5 text-sm font-semibold text-left disabled:cursor-default'

export function Pick({ question, answer, locked, onAnswer }: QuestionProps<PickQuestion>) {
  const chosen = answer?.kind === 'pick' ? answer.optionId : null
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={question.prompt}>
      {question.options.map((o) => {
        const on = o.id === chosen
        const reveal = locked ? (o.correct ? 'border-ok text-ok' : on ? 'border-bad text-bad' : 'opacity-50 border-ink/20') : ''
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={locked}
            onClick={() => onAnswer({ kind: 'pick', optionId: o.id })}
            className={`${chip} ${locked ? reveal : on ? 'border-ink bg-ink text-piece' : 'border-ink/25 bg-piece hover:border-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Order({ question, answer, locked, onAnswer }: QuestionProps<OrderQuestion>) {
  const ids = answer?.kind === 'order' ? answer.ids : []
  const toggle = (id: string) => onAnswer({ kind: 'order', ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
  const sorted = [...question.items].sort((a, b) => a.value - b.value).map((i) => i.id)
  return (
    <div>
      <p className="mb-2 text-xs text-ink-soft">Click them in order. Click a numbered one to take it back.</p>
      <ul className="flex flex-wrap gap-2">
        {question.items.map((item) => {
          const pos = ids.indexOf(item.id)
          const right = locked && sorted[pos] === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={locked}
                aria-pressed={pos >= 0}
                onClick={() => toggle(item.id)}
                className={`${chip} flex items-center gap-2 ${
                  locked ? (right ? 'border-ok' : 'border-bad') : pos >= 0 ? 'border-ink bg-piece' : 'border-dashed border-ink/30 bg-panel hover:border-ink'
                }`}
              >
                <span className={`flex size-6 items-center justify-center rounded-full text-xs ${pos >= 0 ? 'bg-ink text-piece' : 'bg-board text-ink-faint'}`}>
                  {pos >= 0 ? pos + 1 : '·'}
                </span>
                {item.label}
                {locked && <span className="text-xs font-normal text-ink-soft">(#{sorted.indexOf(item.id) + 1})</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Equation({ question, answer, locked, onAnswer }: QuestionProps<EquationQuestion>) {
  const steps: EquationStep[] = answer?.kind === 'equation' ? answer.steps : []
  const set = (next: EquationStep[]) => onAnswer({ kind: 'equation', steps: next })
  const used = new Set(steps.map((s) => s.cardId))
  const result = evaluate(question, steps)
  const cardOf = (id: string) => question.cards.find((c) => c.id === id)!

  return (
    <div className="flex flex-col gap-3">
      {/* The strip: card, operator chip, card, … = running result with units. */}
      <div className="flex min-h-14 flex-wrap items-center gap-1.5 rounded-xl border-2 border-dashed border-ink/25 bg-panel p-2" aria-label="Your calculation">
        {steps.length === 0 && <span className="px-1 text-sm text-ink-faint">Click cards below to build the calculation.</span>}
        {steps.map((s, i) => (
          <span key={s.cardId} className="flex items-center gap-1.5">
            {i > 0 && (
              <button
                type="button"
                disabled={locked}
                onClick={() => set(steps.map((x, j) => (j === i ? { ...x, op: x.op === 'mul' ? 'div' : 'mul' } : x)))}
                className="size-8 rounded-full border-2 border-ink bg-piece text-lg leading-none font-bold hover:bg-board"
                aria-label={`${s.op === 'mul' ? 'Multiply' : 'Divide'} by ${cardOf(s.cardId).label}; click to switch`}
              >
                {s.op === 'mul' ? '×' : '÷'}
              </button>
            )}
            <button
              type="button"
              disabled={locked}
              onClick={() => set(steps.filter((x) => x.cardId !== s.cardId))}
              className="piece px-2.5 py-1 text-sm font-semibold"
              title="Click to remove"
            >
              {cardOf(s.cardId).label}
            </button>
          </span>
        ))}
        {result && (
          <span className="ml-1 text-sm font-bold whitespace-nowrap">
            = {formatQuantity(result.value, result.unit)}
          </span>
        )}
      </div>
      <p className="text-xs text-ink-soft">
        Answer in <span className="font-semibold text-ink">{formatUnits(question.unit)}</span>. Click × / ÷ to switch it.
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Number cards">
        {question.cards.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={locked || used.has(c.id)}
              onClick={() => set([...steps, { cardId: c.id, op: 'mul' }])}
              className={`${chip} border-ink/25 bg-piece hover:border-ink disabled:opacity-35`}
            >
              {c.label}
              <span className="block text-xs font-normal text-ink-soft">{formatUnits(c.unit) || 'no units'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
