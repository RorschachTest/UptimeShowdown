import type { EquationQuestion, EquationStep, EstimateAnswer, UnitMap } from '../../types'
import { combine, formatQuantity, formatUnits, sameUnits } from '../units'
import type { QuestionKind } from './shared'

export interface Evaluated {
  value: number
  unit: UnitMap
}

/** Run the strip left to right. The first card is the starting value whatever its operator says. */
export function evaluate(q: EquationQuestion, steps: EquationStep[]): Evaluated | null {
  let acc: Evaluated | null = null
  for (const s of steps) {
    const card = q.cards.find((c) => c.id === s.cardId)
    if (!card) continue
    acc = acc
      ? { value: s.op === 'mul' ? acc.value * card.value : acc.value / card.value, unit: combine(acc.unit, card.unit, s.op) }
      : { value: card.value, unit: card.unit }
  }
  return acc
}

export const equation: QuestionKind<EquationQuestion, Extract<EstimateAnswer, { kind: 'equation' }>> = {
  grade: (q, a) => {
    const got = evaluate(q, a.steps)
    if (!got) return { stars: 0, message: 'Build a chain of cards first.' }
    if (!sameUnits(got.unit, q.unit))
      return { stars: 0, message: `Your units are ${formatUnits(got.unit) || 'none'}, but the question asks for ${formatUnits(q.unit)}.` }
    const ratio = Math.max(got.value / q.answer, q.answer / got.value)
    const answer = formatQuantity(q.answer, q.unit)
    if (ratio <= 1.05) return { stars: 3, message: `Spot on: about ${answer}.` }
    if (ratio <= 1.25) return { stars: 2, message: `Close. The answer is about ${answer}.` }
    if (ratio <= 2) return { stars: 1, message: `Right order of magnitude. The answer is about ${answer}.` }
    return { stars: 0, message: `Off by about ${Math.round(ratio)}×. The answer is about ${answer}.` }
  },
}
