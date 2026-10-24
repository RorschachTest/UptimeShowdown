import { gradeQuestion, stageStars, type Grade } from './engine/estimate'
import type { EstimateAnswer, EstimateLevel } from './engine/types'
import type { GameStore } from './store'

export interface EstimateState {
  level: EstimateLevel
  stageIndex: number
  answers: Record<string, EstimateAnswer>
  /** Set when a question is checked; cleared when its answer changes. */
  grades: Record<string, Grade>
  /** Best stars per stage. */
  best: number[]
}

export function freshEstimate(level: EstimateLevel): EstimateState {
  return { level, stageIndex: 0, answers: {}, grades: {}, best: level.stages.map(() => 0) }
}

export interface EstimateSlice {
  estimate: EstimateState | null
  setAnswer: (questionId: string, answer: EstimateAnswer) => void
  checkAnswer: (questionId: string) => void
  retryQuestion: (questionId: string) => void
  goToEstimateStage: (index: number) => void
}

type Set = (partial: Partial<GameStore>) => void
type Get = () => GameStore

export function createEstimateSlice(set: Set, get: Get): EstimateSlice {
  const update = (fn: (e: EstimateState) => Partial<EstimateState>) => {
    const e = get().estimate
    if (e) set({ estimate: { ...e, ...fn(e) } })
  }
  const dropKey = <T,>(rec: Record<string, T>, key: string) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key))

  return {
    estimate: null,

    setAnswer: (qid, answer) => update((e) => ({ answers: { ...e.answers, [qid]: answer }, grades: dropKey(e.grades, qid) })),

    checkAnswer: (qid) =>
      update((e) => {
        const stage = e.level.stages[e.stageIndex]!
        const q = stage.questions.find((x) => x.id === qid)
        const grade = q && gradeQuestion(q, e.answers[qid])
        if (!grade) return {}
        const grades = { ...e.grades, [qid]: grade }
        const stars = stageStars(stage, grades)
        const best = stars === null ? e.best : e.best.map((b, i) => (i === e.stageIndex ? Math.max(b, stars) : b))
        if (stars !== null) get().recordStars(get().chapterId, Math.floor(best.reduce((s, b) => s + b, 0) / best.length))
        return { grades, best }
      }),

    retryQuestion: (qid) => update((e) => ({ answers: dropKey(e.answers, qid), grades: dropKey(e.grades, qid) })),

    goToEstimateStage: (index) => update(() => ({ stageIndex: index })),
  }
}
