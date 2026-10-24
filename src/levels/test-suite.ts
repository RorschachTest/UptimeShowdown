import { judgeRun } from '../engine/judge'
import { checkDesign, isBlocked } from '../engine/rules'
import type { StageResult } from '../engine/scoring'
import { initSim, TICKS_PER_SEC } from '../engine/simulator'
import { graph, run, type N } from '../engine/test-helpers'
import type { Chapter } from '../engine/types'

export { graph, type N } from '../engine/test-helpers'

/** Play a whole stage exactly as the game judges it: rules, then simulation, then the judge. */
export function playJudged(chapter: Chapter, stage: number, nodes: N[], wires: string[]): StageResult {
  const g = graph(nodes, wires)
  const s = run(initSim(g, chapter, stage), chapter.stages[stage]!.durationS * TICKS_PER_SEC)
  return judgeRun(s, { issues: checkDesign(g, chapter, stage), edited: false })
}

/** Blocking rule texts for a design (empty = legal). */
export function blockers(chapter: Chapter, stage: number, nodes: N[], wires: string[]): string[] {
  return checkDesign(graph(nodes, wires), chapter, stage)
    .filter((i) => i.severity === 'block')
    .map((i) => i.text)
}

export function isLegal(chapter: Chapter, stage: number, nodes: N[], wires: string[]): boolean {
  return !isBlocked(checkDesign(graph(nodes, wires), chapter, stage))
}
