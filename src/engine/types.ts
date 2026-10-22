// Core simulation types. Nothing in src/engine may import React, the DOM or UI libraries:
// the engine has to run unchanged on a Node server later (multiplayer, M5).

export type ComponentKind = 'traffic' | 'app' | 'sqldb'

export type TrafficClass = 'read' | 'write'

/** Request counts (or a per-class value such as latency) split by traffic class. */
export interface Flow {
  read: number
  write: number
}

export type EdgeMode = 'sync' | 'async'

export interface SimNode {
  id: string
  kind: ComponentKind
  instances: number
}

export interface SimEdge {
  id: string
  source: string
  target: string
  mode: EdgeMode
}

export interface Graph {
  nodes: SimNode[]
  edges: SimEdge[]
}

export interface TrafficPoint {
  /** Game time in seconds. */
  t: number
  rps: number
}

export interface Level {
  id: string
  title: string
  description: string
  /** Max spend per minute of game time. */
  budget: number
  traffic: TrafficPoint[]
  mix: Flow
  goals: { uptime: number; p95Ms: number }
  seed: number
}

/** Requests that live between ticks inside a node (its backlog). */
export interface NodeRuntime {
  queue: Flow
  /** Average upstream latency (ms) of the queued requests, per class. */
  queueLatency: Flow
}

/** What a node did in the last tick, for the HUD and node colouring. */
export interface NodeTickStats {
  /** Incoming demand as a fraction of nominal capacity (1 = exactly at capacity). */
  load: number
  processedRps: number
  droppedRps: number
  queued: number
  /** Latency this node adds, ms. */
  latencyMs: number
}

/** Aggregate outcome of one tick (or a sum of ticks). */
export interface TickStats {
  emitted: number
  success: number
  errors: number
  /** Successful requests per latency bucket, see LATENCY_BUCKETS in scoring.ts. */
  latencyHist: number[]
}

export interface SimState {
  tick: number
  graph: Graph
  level: Level
  /** Node ids in topological order. Nodes on a cycle are left out and never simulated. */
  order: string[]
  outEdges: Record<string, SimEdge[]>
  runtime: Record<string, NodeRuntime>
  nodeStats: Record<string, NodeTickStats>
  /** Requests per second carried by each edge in the last tick. */
  edgeRps: Record<string, number>
  /** Most recent ticks, newest last, capped at WINDOW_TICKS. */
  window: TickStats[]
  totals: TickStats
  rng: number
}
