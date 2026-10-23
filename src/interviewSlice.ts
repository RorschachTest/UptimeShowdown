import { bottleneckQuestion, reviewDesign, type ReviewNote } from './engine/interview'
import type { StageResult } from './engine/scoring'
import type { Graph, InterviewLevel, WrapUpQuestion } from './engine/types'
import type { GameStore } from './store'
import { toSimGraph } from './ui/graph'

export type Phase = 'scope' | 'propose' | 'run' | 'deepdive' | 'wrapup' | 'done'

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'scope', label: 'Scope' },
  { id: 'propose', label: 'Propose' },
  { id: 'run', label: 'Run' },
  { id: 'deepdive', label: 'Deep dive' },
  { id: 'wrapup', label: 'Wrap-up' },
]

export interface InterviewState {
  level: InterviewLevel
  phase: Phase
  asked: string[]
  inScope: string[]
  /** Interviewer notes while the review panel is open. */
  review: ReviewNote[] | null
  runResult: StageResult | null
  deepResult: StageResult | null
  /** The design as it stood when the curveball started; deep-dive changes are counted against it. */
  snapshot: Graph | null
  /** Highest load per node during the current run. */
  peaks: Record<string, number>
  wrapQuestions: WrapUpQuestion[]
  answers: Record<string, string>
}

export function freshInterview(level: InterviewLevel): InterviewState {
  return {
    level,
    phase: 'scope',
    asked: [],
    inScope: [],
    review: null,
    runResult: null,
    deepResult: null,
    snapshot: null,
    peaks: {},
    wrapQuestions: [],
    answers: {},
  }
}

/** Phase transition when a run ends: the main run waits for the curveball; the deep dive moves to wrap-up. */
export function afterRun(iv: InterviewState, result: StageResult, graph: Graph): InterviewState {
  if (iv.phase === 'run') return { ...iv, runResult: result }
  if (iv.phase === 'deepdive')
    return { ...iv, deepResult: result, phase: 'wrapup', wrapQuestions: [bottleneckQuestion(graph, iv.peaks), ...iv.level.wrapUp] }
  return iv
}

export interface InterviewSlice {
  interview: InterviewState | null
  /** Ask a question, or un-ask it while still scoping (the question is refunded). */
  ask: (questionId: string) => void
  toggleFeature: (featureId: string) => void
  /** Clear every question and scope choice. */
  restartScope: () => void
  finishScope: () => void
  /** Open the interviewer's review of the current design. */
  propose: () => void
  closeReview: () => void
  /** Accept the review and run the main stage. */
  startRun: () => void
  /** Back to Propose after a run, keeping the board, to change the design and run again. */
  reviseDesign: () => void
  /** Return to an earlier step (Scope or Propose) with the board intact; later results are cleared. */
  goBackTo: (phase: 'scope' | 'propose') => void
  startDeepDive: () => void
  answer: (questionId: string, optionId: string) => void
  finishWrapUp: () => void
}

type Set = (partial: Partial<GameStore>) => void
type Get = () => GameStore

export function createInterviewSlice(set: Set, get: Get): InterviewSlice {
  const update = (patch: Partial<InterviewState>) => {
    const iv = get().interview
    if (iv) set({ interview: { ...iv, ...patch } })
  }
  const graphNow = () => toSimGraph(get().nodes, get().edges)

  return {
    interview: null,

    ask: (id) => {
      const iv = get().interview
      if (!iv || iv.phase !== 'scope') return
      if (iv.asked.includes(id)) return update({ asked: iv.asked.filter((q) => q !== id) })
      if (iv.asked.length < iv.level.questionBudget) update({ asked: [...iv.asked, id] })
    },

    toggleFeature: (id) => {
      const iv = get().interview
      if (!iv) return
      update({ inScope: iv.inScope.includes(id) ? iv.inScope.filter((f) => f !== id) : [...iv.inScope, id] })
    },

    restartScope: () => update({ asked: [], inScope: [] }),

    finishScope: () => update({ phase: 'propose' }),

    propose: () => {
      const iv = get().interview
      if (iv) update({ review: reviewDesign(get().sim, iv.level, iv.asked) })
    },

    closeReview: () => update({ review: null }),

    startRun: () => {
      get().goToStage(0)
      update({ review: null, phase: 'run', peaks: {}, runResult: null })
      set({ running: true })
    },

    reviseDesign: () => get().goBackTo('propose'),

    goBackTo: (phase) => {
      get().goToStage(0)
      update({ phase, review: null, runResult: null, deepResult: null, snapshot: null, peaks: {}, wrapQuestions: [], answers: {} })
    },

    startDeepDive: () => {
      get().goToStage(1)
      update({ phase: 'deepdive', snapshot: graphNow(), peaks: {}, deepResult: null })
    },

    answer: (qid, optionId) => {
      const iv = get().interview
      if (iv && !(qid in iv.answers)) update({ answers: { ...iv.answers, [qid]: optionId } })
    },

    finishWrapUp: () => update({ phase: 'done' }),
  }
}
