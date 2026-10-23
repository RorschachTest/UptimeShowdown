import { DEFAULT_CONFIG } from './components'
import { step } from './simulator'
import type { ComponentKind, Graph, NodeConfig, SimState } from './types'

export type N = [id: string, kind: ComponentKind, instances?: number, config?: Partial<NodeConfig>]

/** Test graph: nodes plus wires written as 'a>b'. */
export function graph(nodes: N[], wires: string[]): Graph {
  return {
    nodes: nodes.map(([id, kind, instances = 1, config = {}]) => ({ id, kind, instances, config: { ...DEFAULT_CONFIG, ...config } })),
    edges: wires.map((w) => {
      const [source, target] = w.split('>') as [string, string]
      return { id: w, source, target }
    }),
  }
}

export function run(state: SimState, ticks: number): SimState {
  for (let i = 0; i < ticks; i++) state = step(state)
  return state
}
