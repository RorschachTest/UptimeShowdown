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
import { afterRun, createInterviewSlice, freshInterview, type InterviewSlice } from './interviewSlice'
import { LEVELS, type LevelId } from './levels'
import { chapter1 } from './levels/chapter1'
import { toSimGraph, type GameNode } from './ui/graph'

export type Speed = 1 | 2 | 4

export interface GameStore extends InterviewSlice {
  levelId: LevelId
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
  /** Set the piece's scale-out count (instances or replicas), clamped to its component's range. */
  setCount: (id: string, value: number) => void
  updateConfig: (id: string, patch: Partial<NodeConfig>) => void
  /** Run one of the piece's expand actions: replace it with a wired chain of new pieces. */
  expandNode: (id: string, actionIndex: number) => void
  deselect: () => void

  /** Run `ticks` simulation steps, publish once, and score the stage when its time is up. */
  advance: (ticks: number) => void
  setRunning: (running: boolean) => void
  setSpeed: (speed: Speed) => void
  /** Restart the current stage with the current design. */
  reset: () => void
  goToStage: (index: number) => void
  /** Switch to another level with a fresh board. */
  openLevel: (id: LevelId) => void
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
    ...createInterviewSlice(set, get),
    levelId: 'ch1',
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

    setCount: (id, value) =>
      patchNode(id, (n) => {
        const setting = COMPONENTS[n.data.kind].count
        if (!setting) return n
        const v = Math.min(setting.max, Math.max(setting.min, value))
        return setting.field === 'instances'
          ? { ...n, data: { ...n.data, instances: v } }
          : { ...n, data: { ...n.data, config: { ...n.data.config, replicas: v } } }
      }),

    updateConfig: (id, patch) => patchNode(id, (n) => ({ ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } })),

    expandNode: (id, actionIndex) => {
      const { nodes, edges } = get()
      const box = nodes.find((n) => n.id === id)
      const action = box && COMPONENTS[box.data.kind].actions[actionIndex]
      if (!box || !action) return
      const parts: GameNode[] = action.into.map((p, i) => ({
        id: `${p.kind}-${nextId++}`,
        type: 'component',
        position: { x: box.position.x + p.dx, y: box.position.y + p.dy },
        data: { kind: p.kind, instances: 1, config: DEFAULT_CONFIG },
        selected: i === 0,
      }))
      const first = parts[0]!.id
      // Wires into or out of the old piece attach to the first new one; the new pieces are chained.
      let next = edges.map((e) => ({ ...e, source: e.source === id ? first : e.source, target: e.target === id ? first : e.target }))
      for (let i = 1; i < parts.length; i++) {
        next = addEdge({ source: parts[i - 1]!.id, target: parts[i]!.id, sourceHandle: null, targetHandle: null, type: 'flow' }, next)
      }
      commit([...nodes.filter((n) => n.id !== id), ...parts], next)
    },

    deselect: () => set({ nodes: get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)) }),

    advance: (ticks) => {
      let sim = get().sim
      let interview = get().interview
      // Interview runs record each piece's peak load for the wrap-up question.
      const peaks = interview ? { ...interview.peaks } : null
      for (let i = 0; i < ticks && !stageFinished(sim); i++) {
        sim = step(sim)
        if (peaks) for (const [id, s] of Object.entries(sim.nodeStats)) peaks[id] = Math.max(peaks[id] ?? 0, s.load)
      }
      if (interview && peaks) interview = { ...interview, peaks }
      if (!stageFinished(sim)) return set({ sim, interview })
      const result = stageResult(sim)
      if (interview) return set({ sim, running: false, result, interview: afterRun(interview, result, sim.graph) })
      const best = get().best.map((b, i) => (i === get().stageIndex ? Math.max(b, result.stars) : b))
      set({ sim, running: false, result, best })
    },

    setRunning: (running) => set({ running }),
    setSpeed: (speed) => set({ speed }),
    reset: () => set({ running: false, result: null, sim: freshSim(get().stageIndex) }),
    goToStage: (index) => set({ stageIndex: index, running: false, result: null, sim: freshSim(index) }),

    openLevel: (id) => {
      const entry = LEVELS.find((l) => l.id === id)!
      const chapter = entry.kind === 'ladder' ? entry.chapter : entry.level.chapter
      set({
        levelId: id,
        chapter,
        stageIndex: 0,
        best: chapter.stages.map(() => 0),
        nodes: startNodes,
        edges: [],
        sim: initSim(toSimGraph(startNodes, []), chapter, 0),
        running: false,
        result: null,
        interview: entry.kind === 'interview' ? freshInterview(entry.level) : null,
      })
    },
  }
})
