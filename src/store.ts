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
import { COMPONENTS } from './engine/components'
import { initSim, step, withGraph } from './engine/simulator'
import type { ComponentKind, Level, SimState } from './engine/types'
import { level1 } from './levels/level1'
import { toSimGraph, type GameNode } from './ui/graph'

export type Speed = 1 | 2 | 4

interface GameStore {
  level: Level
  nodes: GameNode[]
  edges: Edge[]
  sim: SimState
  running: boolean
  speed: Speed

  onNodesChange: (changes: NodeChange<GameNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addComponent: (kind: ComponentKind, position: XYPosition) => void
  removeNode: (id: string) => void
  removeEdge: (id: string) => void
  scaleNode: (id: string, delta: number) => void

  /** Run `ticks` simulation steps and publish the result once. */
  advance: (ticks: number) => void
  setRunning: (running: boolean) => void
  setSpeed: (speed: Speed) => void
  reset: () => void
}

const startNodes: GameNode[] = [
  {
    id: 'traffic',
    type: 'traffic',
    position: { x: 0, y: 160 },
    data: { kind: 'traffic', instances: 1 },
    deletable: false,
  },
]

let nextId = 1

export const useGameStore = create<GameStore>()((set, get) => {
  /** Apply a graph edit and hand the new topology to the running sim. */
  const commit = (nodes: GameNode[], edges: Edge[]) =>
    set({ nodes, edges, sim: withGraph(get().sim, toSimGraph(nodes, edges)) })

  return {
    level: level1,
    nodes: startNodes,
    edges: [],
    sim: initSim(toSimGraph(startNodes, []), level1),
    running: false,
    speed: 1,

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
        data: { kind, instances: COMPONENTS[kind].minInstances },
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

    scaleNode: (id, delta) => {
      const nodes = get().nodes.map((n) => {
        if (n.id !== id) return n
        const spec = COMPONENTS[n.data.kind]
        const instances = Math.min(spec.maxInstances, Math.max(spec.minInstances, n.data.instances + delta))
        return instances === n.data.instances ? n : { ...n, data: { ...n.data, instances } }
      })
      commit(nodes, get().edges)
    },

    advance: (ticks) => {
      let sim = get().sim
      for (let i = 0; i < ticks; i++) sim = step(sim)
      set({ sim })
    },

    setRunning: (running) => set({ running }),
    setSpeed: (speed) => set({ speed }),
    reset: () => {
      const { nodes, edges, level } = get()
      set({ running: false, sim: initSim(toSimGraph(nodes, edges), level) })
    },
  }
})
