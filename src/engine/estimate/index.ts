import type { EstimateAnswer, EstimateQuestion, EstimateStage } from '../types'
import { equation } from './kinds/equation'
import { order } from './kinds/order'
import { pick } from './kinds/pick'
import type { Grade } from './kinds/shared'

export { evaluate } from './kinds/equation'
export type { Grade } from './kinds/shared'
export * from './units'

/** Grade any question. Adding a kind = a new module in kinds/ plus one case here. */
export function gradeQuestion(q: EstimateQuestion, a: EstimateAnswer | undefined): Grade | null {
  if (!a || a.kind !== q.kind) return null
  switch (q.kind) {
    case 'pick':
      return pick.grade(q, a as Extract<EstimateAnswer, { kind: 'pick' }>)
    case 'order':
      return order.grade(q, a as Extract<EstimateAnswer, { kind: 'order' }>)
    case 'equation':
      return equation.grade(q, a as Extract<EstimateAnswer, { kind: 'equation' }>)
  }
}

/** Stage stars: the rounded-down average over its questions, once every question is checked. */
export function stageStars(stage: EstimateStage, grades: Record<string, Grade | undefined>): number | null {
  const all = stage.questions.map((q) => grades[q.id])
  if (all.some((g) => !g)) return null
  return Math.floor(all.reduce((s, g) => s + g!.stars, 0) / all.length)
}
