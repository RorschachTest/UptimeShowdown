import { gradeQuestion, type Grade } from './engine/estimate'
import type { EstimateAnswer } from './engine/types'
import { chapterById } from './levels'
import type { GameStore } from './store'

export interface LessonState {
  card: number
  answers: Record<string, EstimateAnswer>
  grades: Record<string, Grade>
}

export const freshLesson = (): LessonState => ({ card: 0, answers: {}, grades: {} })

export interface LessonSlice {
  lesson: LessonState
  setLessonCard: (index: number) => void
  setLessonAnswer: (questionId: string, answer: EstimateAnswer) => void
  checkLessonAnswer: (questionId: string) => void
  retryLessonQuestion: (questionId: string) => void
}

type Set = (partial: Partial<GameStore>) => void
type Get = () => GameStore

/** The Learn step: concept cards, then a short quiz graded with the estimation question kinds. */
export function createLessonSlice(set: Set, get: Get): LessonSlice {
  const update = (patch: Partial<LessonState>) => set({ lesson: { ...get().lesson, ...patch } })
  const without = <T,>(rec: Record<string, T>, key: string) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== key))

  return {
    lesson: freshLesson(),
    setLessonCard: (card) => update({ card }),
    setLessonAnswer: (qid, answer) => update({ answers: { ...get().lesson.answers, [qid]: answer }, grades: without(get().lesson.grades, qid) }),
    checkLessonAnswer: (qid) => {
      const { lesson, chapterId } = get()
      const quiz = chapterById(chapterId).lesson.quiz
      const q = quiz.find((x) => x.id === qid)
      const grade = q && gradeQuestion(q, lesson.answers[qid])
      if (!grade) return
      const grades = { ...lesson.grades, [qid]: grade }
      update({ grades })
      // The lesson counts as learned once every quiz question is right.
      if (quiz.every((x) => (grades[x.id]?.stars ?? 0) > 0)) get().markLearned(chapterId)
    },
    retryLessonQuestion: (qid) => update({ answers: without(get().lesson.answers, qid), grades: without(get().lesson.grades, qid) }),
  }
}
