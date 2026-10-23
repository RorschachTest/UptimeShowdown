import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import { create } from 'zustand'
import { COMPONENTS, DEFAULT_CONFIG } from './engine/components'
import { stageResult, type StageResult } from './engine/scoring'
import { initSim, stageFinished, step, withGraph } from './engine/simulator'
import type { Chapter, ComponentKind, NodeConfig, SimState } from './engine/types'
import { chapter1 } from './levels/chapter1'
import { toSimGraph, type GameNode } from './ui/graph'

export type Speed = 1 | 2 | 4

interface GameStore {
  chapter: Chapter
  stageIndex: number
  /** Best stars per stage so far. */
  best: number[]
  nodes: GameNode[]
  edges: Edge[]
  sim: SimState
  running: boolean
  speed: Speed
  /** Set when the current stage's run finishes. */
  result: StageResult | null

  onNodesChange: (changes: NodeChange<GameNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addComponent: (kind: ComponentKind, position: XYPosition) => void
  removeNode: (id: string) => void
  removeEdge: (id: string) => void
  scaleNode: (id: string, delta: number) => void
  updateConfig: (id: string, patch: Partial<NodeConfig>) => void
  /** Replace a single server with a web server wired to a SQL database. */
  splitNode: (id: string) => void
  deselect: () => void

  /** Run `ticks` simulation steps, publish once, and score the stage when its time is up. */
  advance: (ticks: number) => void
  setRunning: (running: boolean) => void
  setSpeed: (speed: Speed) => void
  /** Restart the current stage with the current design. */
  reset: () => void
  goToStage: (index: number) => void
}

const startNodes: GameNode[] = [
  {
    id: 'traffic',
    type: 'traffic',
    position: { x: 0, y: 160 },
    data: { kind: 'traffic', instances: 1, config: DEFAULT_CONFIG },
    deletable: false,
  },
]

let nextId = 1

export const useGameStore = create<GameStore>()((set, get) => {
  /** Apply a graph edit and hand the new topology to the running sim. */
  const commit = (nodes: GameNode[], edges: Edge[]) =>
    set({ nodes, edges, sim: withGraph(get().sim, toSimGraph(nodes, edges)) })

  const patchNode = (id: string, fn: (n: GameNode) => GameNode) => commit(get().nodes.map((n) => (n.id === id ? fn(n) : n)), get().edges)

  const freshSim = (stageIndex: number) => initSim(toSimGraph(get().nodes, get().edges), get().chapter, stageIndex)

  return {
    chapter: chapter1,
    stageIndex: 0,
    best: chapter1.stages.map(() => 0),
    nodes: startNodes,
    edges: [],
    sim: initSim(toSimGraph(startNodes, []), chapter1, 0),
    running: false,
    speed: 1,
    result: null,

    onNodesChange: (changes) => {
      const nodes = applyNodeChanges(changes, get().nodes)
      // Moving, selecting and measuring nodes doesn't change the simulation.
      const structural = changes.some((c) => c.type === 'add' || c.type === 'remove' || c.type === 'replace')
      if (structural) commit(nodes, get().edges)
      else set({ nodes })
    },

    onEdgesChange: (changes) => {
      const edges = applyEdgeChanges(changes, get().edges)
      const structural = changes.some((c) => c.type !== 'select')
      if (structural) commit(get().nodes, edges)
      else set({ edges })
    },

    onConnect: (connection) => commit(get().nodes, addEdge({ ...connection, type: 'flow' }, get().edges)),

    addComponent: (kind, position) => {
      const node: GameNode = {
        id: `${kind}-${nextId++}`,
        type: 'component',
        position,
        data: { kind, instances: 1, config: DEFAULT_CONFIG },
      }
      commit([...get().nodes, node], get().edges)
    },

    removeNode: (id) => {
      const { nodes, edges } = get()
      if (nodes.find((n) => n.id === id)?.deletable === false) return
      commit(
        nodes.filter((n) => n.id !== id),
        edges.filter((e) => e.source !== id && e.target !== id),
      )
    },

    removeEdge: (id) => commit(get().nodes, get().edges.filter((e) => e.id !== id)),

    scaleNode: (id, delta) =>
      patchNode(id, (n) => {
        const instances = Math.min(COMPONENTS[n.data.kind].maxInstances, Math.max(1, n.data.instances + delta))
        return instances === n.data.instances ? n : { ...n, data: { ...n.data, instances } }
      }),

    updateConfig: (id, patch) => patchNode(id, (n) => ({ ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } })),

    splitNode: (id) => {
      const { nodes, edges } = get()
      const box = nodes.find((n) => n.id === id)
      if (!box || box.data.kind !== 'allinone') return
      const web: GameNode = {
        id: `app-${nextId++}`,
        type: 'component',
        position: box.position,
        data: { kind: 'app', instances: 1, config: DEFAULT_CONFIG },
        selected: true,
      }
      const db: GameNode = {
        id: `sqldb-${nextId++}`,
        type: 'component',
        position: { x: box.position.x + 40, y: box.position.y + 170 },
        data: { kind: 'sqldb', instances: 1, config: DEFAULT_CONFIG },
      }
      const rewired = edges.map((e) => ({
        ...e,
        source: e.source === id ? web.id : e.source,
        target: e.target === id ? web.id : e.target,
      }))
      commit(
        [...nodes.filter((n) => n.id !== id), web, db],
        addEdge({ source: web.id, target: db.id, sourceHandle: null, targetHandle: null, type: 'flow' }, rewired),
      )
    },

    deselect: () => set({ nodes: get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)) }),

    advance: (ticks) => {
      let sim = get().sim
      for (let i = 0; i < ticks && !stageFinished(sim); i++) sim = step(sim)
      if (!stageFinished(sim)) return set({ sim })
      const result = stageResult(sim)
      const best = get().best.map((b, i) => (i === get().stageIndex ? Math.max(b, result.stars) : b))
      set({ sim, running: false, result, best })
    },

    setRunning: (running) => set({ running }),
    setSpeed: (speed) => set({ speed }),
    reset: () => set({ running: false, result: null, sim: freshSim(get().stageIndex) }),
    goToStage: (index) => set({ stageIndex: index, running: false, result: null, sim: freshSim(index) }),
  }
})
