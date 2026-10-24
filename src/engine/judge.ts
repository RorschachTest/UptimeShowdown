import type { RuleIssue } from './rules'
import { stageResult, type StageResult } from './scoring'
import type { SimState } from './types'

export interface RunIntegrity {
  /** Rule check of the design that ran. */
  issues: RuleIssue[]
  /** The design was changed while the run was in progress. */
  edited: boolean
}

/**
 * The one place stars are decided: goals, budget and leanness (stageResult), but never for an illegal
 * design or a run whose design changed part-way through.
 */
export function judgeRun(state: SimState, integrity: RunIntegrity): StageResult {
  const base = stageResult(state)
  const blocked = integrity.issues.filter((i) => i.severity === 'block')
  if (blocked.length > 0) return { ...base, stars: 0, missed: [`Illegal design: ${blocked[0]!.text}`, ...base.missed] }
  if (integrity.edited)
    return { ...base, stars: 0, missed: ['You changed the design during the run, so it can’t earn stars. Reset and run it cleanly.', ...base.missed] }
  return base
}
