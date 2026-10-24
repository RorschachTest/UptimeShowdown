import { useMemo } from 'react'
import { COMPONENTS, DEFAULT_CONFIG } from '../engine/components'
import { flowMap, pieceName, wireLabels, type FlowMap } from '../engine/flowmap'
import { initSim } from '../engine/simulator'
import type { Chapter, ComponentKind, DiagramSpec, Graph } from '../engine/types'
import { useGameStore } from '../store'

const STORES: ComponentKind[] = ['sqldb', 'kvstore', 'cache', 'leaderboard', 'allinone', 'trie', 'tsdb', 'blob']
const QUEUES: ComponentKind[] = ['queue', 'frontier', 'pubsub', 'broker']
const EXTERNAL: ComponentKind[] = ['provider']

/** Extra class for a piece's shape: drum for stores, pipe for queues, dashed for outside services. */
export function shapeClass(kind: ComponentKind): string {
  if (STORES.includes(kind)) return 'piece-store pt-4'
  if (QUEUES.includes(kind)) return 'piece-queue pr-9'
  if (EXTERNAL.includes(kind)) return 'piece-external'
  return ''
}

/** Lines shown on a piece: at most `max`, then "+N more". */
export function clip(lines: string[], max: number): string[] {
  return lines.length <= max ? lines : [...lines.slice(0, max - 1), `+${lines.length - max + 1} more`]
}

/** The board's flow map, recomputed only when the design, chapter or stage changes. */
export function useFlowMap(): FlowMap {
  const graph = useGameStore((s) => s.sim.graph)
  const chapter = useGameStore((s) => s.chapter)
  const stageIndex = useGameStore((s) => s.stageIndex)
  return useMemo(() => flowMap(initSim(graph, chapter, stageIndex)), [graph, chapter, stageIndex])
}

/** A design as a read-only diagram: names, step lines, data notes and endpoint labels from the chapter. */
export function designSpec(graph: Graph, chapter: Chapter, stageIndex = 0): DiagramSpec {
  const map = flowMap(initSim(graph, chapter, stageIndex), { allTypes: true })
  return {
    nodes: graph.nodes.map((n) => [
      n.id,
      n.kind,
      {
        name: n.kind === 'traffic' ? pieceName(n, undefined, chapter) : pieceName(n, map.pieces[n.id], chapter),
        does: map.pieces[n.id]?.does ?? [],
        data: chapter.data?.[n.kind],
      },
    ]),
    wires: graph.edges.map((e) => {
      const labels = wireLabels(map.wires[e.id], chapter)
      return labels.length ? `${e.source}>${e.target}|${labels.join(' · ')}` : `${e.source}>${e.target}`
    }),
  }
}

/** Fill in a hand-written lesson diagram from its chapter: names, step lines, data notes and wire labels it doesn't set itself. */
export function enrichSpec(spec: DiagramSpec, chapter: Chapter | undefined): DiagramSpec {
  if (!chapter) return spec
  const graph: Graph = {
    nodes: spec.nodes.map(([id, kind]) => ({ id, kind, instances: 1, config: DEFAULT_CONFIG })),
    edges: spec.wires.map((w) => {
      const [a, b] = w.split('|')[0]!.split('>') as [string, string]
      return { id: `${a}>${b}`, source: a, target: b }
    }),
  }
  const auto = designSpec(graph, chapter)
  return {
    nodes: spec.nodes.map(([id, kind, info], i) => [id, kind, { ...auto.nodes[i]![2], ...info }]),
    wires: spec.wires.map((w, i) => (w.includes('|') ? w : auto.wires[i]!)),
  }
}

export const kindLabel = (kind: ComponentKind) => COMPONENTS[kind].label
