import type { EstimateAnswer, OrderQuestion } from '../../types'
import type { QuestionKind } from './shared'

export const order: QuestionKind<OrderQuestion, Extract<EstimateAnswer, { kind: 'order' }>> = {
  grade: (q, a) => {
    const expected = [...q.items].sort((x, y) => x.value - y.value).map((i) => i.id)
    if (a.ids.length < expected.length) return { stars: 0, message: 'Place every item first.' }
    const inPlace = expected.filter((id, i) => a.ids[i] === id).length
    if (inPlace === expected.length) return { stars: 3, message: 'Exactly right.' }
    if (inPlace >= expected.length - 2) return { stars: 1, message: `Close: ${inPlace} of ${expected.length} in the right place.` }
    return { stars: 0, message: `${inPlace} of ${expected.length} in the right place.` }
  },
}
