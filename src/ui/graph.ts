import type { Edge, Node } from '@xyflow/react'
import type { ComponentKind, Graph, NodeConfig } from '../engine/types'

export type GameNodeData = { kind: ComponentKind; instances: number; config: NodeConfig }
export type GameNode = Node<GameNodeData>

/** React Flow state → the engine's plain graph (positions and UI flags stay behind). */
export function toSimGraph(nodes: GameNode[], edges: Edge[]): Graph {
  return {
    nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, instances: n.data.instances, config: n.data.config })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  }
}

/** True if a wire source → target would close a loop (target already reaches source). */
export function wouldCreateCycle(edges: Edge[], source: string, target: string): boolean {
  if (source === target) return true
  const stack = [target]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const id = stack.pop()!
    if (id === source) return true
    if (seen.has(id)) continue
    seen.add(id)
    for (const e of edges) if (e.source === id) stack.push(e.target)
  }
  return false
}
