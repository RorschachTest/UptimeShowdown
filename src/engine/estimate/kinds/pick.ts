import type { EstimateAnswer, PickQuestion } from '../../types'
import type { QuestionKind } from './shared'

export const pick: QuestionKind<PickQuestion, Extract<EstimateAnswer, { kind: 'pick' }>> = {
  grade: (q, a) => {
    const chosen = q.options.find((o) => o.id === a.optionId)
    return chosen?.correct ? { stars: 3, message: 'Correct.' } : { stars: 0, message: `Not quite: it's ${q.options.find((o) => o.correct)?.label}.` }
  },
}
