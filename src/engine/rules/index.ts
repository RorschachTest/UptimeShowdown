import { COMPONENTS, DEFAULT_CONFIG, getCount } from '../components'
import { initSim, step } from '../simulator'
import type { Chapter, ComponentKind, Graph, LevelRules, SimState } from '../types'

/** A problem with a design. `block` issues stop the design from running or earning stars. */
export interface RuleIssue {
  severity: 'block' | 'warn'
  text: string
  nodeId?: string
}

/** Ticks of probe traffic used to find pieces no request ever reaches. */
const PROBE_TICKS = 3

export const isBlocked = (issues: RuleIssue[]) => issues.some((i) => i.severity === 'block')

/** Can every request of these types still complete if all pieces of `kind` were removed? Then it can bypass them. */
function canBypass(graph: Graph, chapter: Chapter, stageIndex: number, typeIds: string[], kind: ComponentKind): string[] {
  const without: Graph = {
    nodes: graph.nodes.filter((n) => n.kind !== kind),
    edges: graph.edges.filter((e) => !graph.nodes.some((n) => n.kind === kind && (n.id === e.source || n.id === e.target))),
  }
  const s = initSim(without, chapter, stageIndex)
  const users = without.nodes.find((n) => n.kind === 'traffic')
  if (!users) return []
  return chapter.requestTypes.filter((rt, t) => typeIds.includes(rt.id) && s.reach[users.id]?.[t]?.[0] === true).map((rt) => rt.label)
}

/** Every structural rule, global and level-specific. The simulation must never run a design that breaks a `block` rule. */
export function checkDesign(graph: Graph, chapter: Chapter, stageIndex: number): RuleIssue[] {
  const issues: RuleIssue[] = []
  const block = (text: string, nodeId?: string) => issues.push({ severity: 'block', text, nodeId })
  const stage = chapter.stages[stageIndex]!
  const state: SimState = initSim(graph, chapter, stageIndex)
  const users = graph.nodes.find((n) => n.kind === 'traffic')

  // 1. Every real request type in this stage needs a complete path.
  chapter.requestTypes.forEach((rt, t) => {
    if (rt.abusive || (stage.mix[rt.id] ?? 0) <= 0) return
    if (!users || state.reach[users.id]?.[t]?.[0] !== true) block(`Nothing in your design can serve "${rt.label}" yet.`)
  })

  // 2. No dead pieces: probe a few ticks of real traffic and flag pieces nothing ever reaches.
  let probe = state
  for (let i = 0; i < PROBE_TICKS; i++) probe = step(probe)
  for (const node of graph.nodes) {
    if (node.kind === 'traffic') continue
    const s = probe.nodeStats[node.id]
    if (!s || (s.processedRps <= 0 && s.droppedRps <= 0 && !s.down))
      block(`The ${COMPONENTS[node.kind].label} isn't on any request's path. Wire it in or remove it.`, node.id)
  }

  // 3. Only pieces and settings this stage has unlocked (the palette enforces it; this keeps crafted boards honest).
  const unlocked = chapter.stages.slice(0, stageIndex + 1)
  const kinds = new Set(unlocked.flatMap((s) => s.unlocks.kinds))
  const settings = new Set(unlocked.flatMap((s) => s.unlocks.settings))
  for (const node of graph.nodes) {
    if (node.kind === 'traffic') continue
    const def = COMPONENTS[node.kind]
    if (!kinds.has(node.kind)) {
      block(`The ${def.label} isn't available in this stage.`, node.id)
      continue
    }
    for (const c of def.choices)
      if (c.gate && !settings.has(c.gate) && node.config[c.field] !== DEFAULT_CONFIG[c.field])
        block(`${def.label}: "${c.label}" isn't unlocked yet.`, node.id)
    const count = def.count
    if (count?.gate && !settings.has(count.gate) && getCount(node, count.field) !== count.min)
      block(`${def.label}: "${count.label}" isn't unlocked yet.`, node.id)
  }

  // 4. Placement rules declared by each component.
  for (const node of graph.nodes) {
    const parents = graph.edges.filter((e) => e.target === node.id).map((e) => graph.nodes.find((n) => n.id === e.source)!.kind)
    const children = graph.edges.filter((e) => e.source === node.id).map((e) => graph.nodes.find((n) => n.id === e.target)!.kind)
    const problem = COMPONENTS[node.kind].placement?.({ parents, children })
    if (problem) block(problem, node.id)
  }

  // 5. Level rules.
  const rules: LevelRules = chapter.rules ?? {}
  for (const r of rules.requires ?? []) {
    const have = graph.nodes.filter((n) => n.kind === r.kind).length
    if (have < (r.min ?? 1)) block(r.why)
  }
  for (const r of rules.forbid ?? []) if (graph.nodes.some((n) => n.kind === r.kind)) block(r.why)
  for (const r of rules.mustPassThrough ?? []) {
    if (!graph.nodes.some((n) => n.kind === r.kind)) continue // reported by `requires`
    const leaks = canBypass(graph, chapter, stageIndex, r.types, r.kind)
    if (leaks.length > 0) block(`${r.why} Right now ${leaks.join(', ')} can go around it.`)
  }

  return issues
}
