import { COMPONENTS, serves } from './components'
import { currentStage, stepsDone, validEdges } from './simulator'
import type { Capability, Chapter, SimNode, SimState } from './types'

/** What a piece does by default for a capability, when a request type doesn't say. */
const DOES: Record<Capability, string> = {
  compute: 'runs the request',
  lookup: 'reads the data',
  write: 'saves the data',
  static: 'serves files',
  id: 'issues unique IDs',
  geo: 'finds places nearby',
  enqueue: 'queues the work',
  work: 'processes jobs',
  deliver: 'delivers messages',
  fanout: 'fans posts out to feeds',
  feed: 'serves ready feeds',
  suggest: 'suggests completions',
}

export interface PieceFlow {
  /** Request types that reach this piece (indices into chapter.requestTypes). */
  types: number[]
  /** Request types it actually serves a step for. */
  handles: number[]
  /** One line per distinct thing it does, in the order requests meet them. */
  does: string[]
}

export interface FlowMap {
  pieces: Record<string, PieceFlow>
  /** Request types each wire carries. */
  wires: Record<string, number[]>
}

/**
 * Where each request type goes in a design, without simulating load: the same routing rules as the
 * simulator, walked once per (piece, type, step). Used to label the board so it reads like a design doc.
 */
export function flowMap(state: SimState, opts: { allTypes?: boolean } = {}): FlowMap {
  const { chapter, graph } = state
  const stage = currentStage(state)
  const byId = new Map<string, SimNode>(graph.nodes.map((n) => [n.id, n]))
  const pieces: Record<string, PieceFlow> = {}
  const wires: Record<string, number[]> = {}
  const seen = new Set<string>()
  const piece = (id: string) => (pieces[id] ??= { types: [], handles: [], does: [] })
  const addOnce = <T>(list: T[], v: T) => list.includes(v) || list.push(v)

  const route = (from: string, t: number, step: number) => {
    for (const e of validEdges(state, byId, from, t, step)) {
      addOnce((wires[e.id] ??= []), t)
      visit(e.target, t, step)
    }
  }
  const visit = (id: string, t: number, step: number) => {
    const key = `${id}:${t}:${step}`
    if (seen.has(key)) return
    seen.add(key)
    const node = byId.get(id)!
    const rt = chapter.requestTypes[t]!
    const p = piece(id)
    addOnce(p.types, t)
    const did = (cap: Capability) => {
      addOnce(p.handles, t)
      addOnce(p.does, rt.does?.[cap] ?? DOES[cap])
    }
    const need = rt.needs[step]!
    if (COMPONENTS[node.kind].partial && serves(node.kind, need)) {
      did(need)
      if (step + 1 < rt.needs.length) route(id, t, step + 1)
      route(id, t, step)
      return
    }
    const next = stepsDone(node.kind, rt.needs, step)
    for (let s = step; s < next; s++) did(rt.needs[s]!)
    if (next === step && COMPONENTS[node.kind].does) addOnce(p.does, COMPONENTS[node.kind].does!)
    if (next < rt.needs.length) route(id, t, next)
  }

  for (const users of graph.nodes.filter((n) => n.kind === 'traffic')) {
    chapter.requestTypes.forEach((rt, t) => {
      const inPlay = opts.allTypes ? state.chapter.stages.some((s) => (s.mix[rt.id] ?? 0) > 0) : (stage.mix[rt.id] ?? 0) > 0
      if (inPlay) route(users.id, t, 0)
    })
  }
  return { pieces, wires }
}

/** A piece's name for the job it does in this design (chapter names first, then the component's label). */
export function pieceName(node: Pick<SimNode, 'kind'>, flow: PieceFlow | undefined, chapter: Chapter): string {
  const handled = (flow?.handles.length ? flow.handles : (flow?.types ?? [])).map((t) => chapter.requestTypes[t]!.id)
  for (const n of chapter.names ?? []) {
    if (n.kind !== node.kind) continue
    if (!n.when || (handled.length > 0 && handled.every((id) => n.when!.includes(id)))) return n.name
  }
  return COMPONENTS[node.kind].label
}

/** Labels for a wire: each type's endpoint (or its name), in chapter order. */
export function wireLabels(types: number[] | undefined, chapter: Chapter): string[] {
  return [...(types ?? [])].sort((a, b) => a - b).map((t) => chapter.requestTypes[t]!.api ?? chapter.requestTypes[t]!.label)
}
