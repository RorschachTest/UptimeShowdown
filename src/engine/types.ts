// Core simulation types. Nothing in src/engine may import React, the DOM or UI libraries:
// the engine has to run unchanged on a Node server later (multiplayer, M5).

export type ComponentKind = 'traffic' | 'allinone' | 'app' | 'lb' | 'sqldb' | 'cache' | 'cdn'

/** What a component can do for a request. A request type lists the ones it needs, in order. */
export type Capability = 'compute' | 'lookup' | 'write' | 'static'

export type Tier = 0 | 1 | 2 | 3
export type ReadRouting = 'primary' | 'replicas' | 'ryw'
export type CacheSize = 'S' | 'M' | 'L'
export type WriteStrategy = 'aside' | 'through'
export type CdnTtl = 'long' | 'short'

/** Player settings. Every node carries all of them; each kind reads only its own. */
export interface NodeConfig {
  tier: Tier
  replicas: number
  readRouting: ReadRouting
  cacheSize: CacheSize
  writeStrategy: WriteStrategy
  cdnTtl: CdnTtl
}

export interface SimNode {
  id: string
  kind: ComponentKind
  instances: number
  config: NodeConfig
}

export interface SimEdge {
  id: string
  source: string
  target: string
}

export interface Graph {
  nodes: SimNode[]
  edges: SimEdge[]
}

export interface RequestType {
  id: string
  label: string
  needs: Capability[]
  /** Capacity units one request costs on generic nodes (static files are heavier). */
  weight: number
  /** 'ryw' = the user must see their own latest write; stale answers are violations. */
  consistency: 'any' | 'ryw'
  /** Extra latency when not served from the edge (CDN), e.g. users on another continent. */
  distanceMs: number
}

export interface TrafficPoint {
  /** Game time in seconds. */
  t: number
  rps: number
}

export interface CrashEvent {
  t: number
  durationS: number
  kind: 'crash'
  /** The first node of this kind (in topological order) loses one instance. */
  target: ComponentKind
}

export type SettingId = 'split' | 'tier' | 'replicas' | 'readRouting'

export interface Stage {
  id: string
  title: string
  story: string
  durationS: number
  traffic: TrafficPoint[]
  /** Share of traffic per request type id. */
  mix: Record<string, number>
  /** What this stage newly unlocks (cumulative with earlier stages). */
  unlocks: { kinds: ComponentKind[]; settings: SettingId[] }
  events: CrashEvent[]
  /** Max spend per minute for ★★. */
  budget: number
  /** Cost of the known-good design; ★★★ needs cost ≤ 1.5× this. */
  referenceCost: number
  goals: { uptime: number; p95Ms: number; maxStaleRate: number }
}

export interface Chapter {
  id: string
  title: string
  requestTypes: RequestType[]
  stages: Stage[]
  seed: number
}

/** A batch of requests of one type at one step of its needs, with their average latency so far. */
export interface Packet {
  count: number
  latencyMs: number
}

/** Packets keyed by `${typeIndex}:${step}`. */
export type Flows = Record<string, Packet>

export interface NodeRuntime {
  queue: Flows
}

/** What a node did in the last tick, for the HUD, node colouring and diagnosis. */
export interface NodeTickStats {
  /** Incoming demand as a fraction of nominal capacity (1 = exactly at capacity). */
  load: number
  processedRps: number
  droppedRps: number
  queued: number
  latencyMs: number
  down: boolean
  /** Share of this node's work that was static files (for network-bound diagnosis). */
  staticShare: number
  /** Cache/CDN hit rate, when the node is one. */
  hitRate?: number
}

/** Aggregate outcome of one tick (or a sum of ticks). */
export interface TickStats {
  emitted: number
  success: number
  /** Dropped, down, or dead-ended. */
  errors: number
  /** Requests that reached a node with nowhere valid to go next. Included in errors. */
  deadEnds: number
  /** Successful 'ryw' requests answered with stale data. */
  stale: number
  latencyHist: number[]
}

export interface SimState {
  tick: number
  graph: Graph
  chapter: Chapter
  stageIndex: number
  /** Node ids in topological order. Nodes on a cycle are left out and never simulated. */
  order: string[]
  outEdges: Record<string, SimEdge[]>
  /** Nodes with a load balancer in front: only these can use more than one instance. */
  lbFed: Record<string, boolean>
  /** reach[nodeId][typeIndex][step]: can this node complete that request from that step? */
  reach: Record<string, boolean[][]>
  runtime: Record<string, NodeRuntime>
  nodeStats: Record<string, NodeTickStats>
  edgeRps: Record<string, number>
  window: TickStats[]
  totals: TickStats
  rng: number
}

// ── Interview levels (Chapter 3 shell, reused by later problem chapters) ──

/** A hidden parameter of the problem, shown as "?" until a question reveals it. */
export type FactId = 'scale' | 'mix' | 'geography' | 'freshness' | 'failures' | 'latency'

export interface QuestionCard {
  id: string
  text: string
  /** high = moves the architecture; low = harmless but wasted; trap = trivia or a solution posing as a question. */
  leverage: 'high' | 'low' | 'trap'
  answer: string
  reveals: FactId[]
  /** Short form of the answer, shown as a fact chip once revealed. */
  short?: string
}

export interface FeatureCard {
  id: string
  text: string
  core: boolean
}

export interface WrapUpOption {
  id: string
  text: string
  correct: boolean
}

export interface WrapUpQuestion {
  id: string
  prompt: string
  options: WrapUpOption[]
  explain: string
}

export interface InterviewLevel {
  id: string
  title: string
  prompt: string
  questionBudget: number
  questions: QuestionCard[]
  features: FeatureCard[]
  /** Request types plus exactly two stages: [main run, curveball]. */
  chapter: Chapter
  curveball: { title: string; story: string }
  /** Max pieces the player may change during the deep dive. */
  editBudget: number
  /** Level-defined wrap-up questions (the bottleneck question is generated from the run). */
  wrapUp: WrapUpQuestion[]
}
