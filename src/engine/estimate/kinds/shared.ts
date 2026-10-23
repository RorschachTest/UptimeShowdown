import type { EstimateAnswer, EstimateQuestion } from '../../types'

export interface Grade {
  stars: 0 | 1 | 2 | 3
  message: string
}

/** One question kind: how to grade an answer to it. Each kind lives in its own module. */
export interface QuestionKind<Q extends EstimateQuestion, A extends EstimateAnswer> {
  grade: (question: Q, answer: A) => Grade
}
