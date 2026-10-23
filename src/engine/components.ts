import type { CacheSize, Capability, CdnTtl, ComponentKind, NodeConfig, SimNode } from './types'

export interface ComponentSpec {
  kind: ComponentKind
  label: string
  /** Capacity units per second, per instance, at tier S. SQL DB uses DB_READ_RPS/DB_WRITE_RPS instead. */
  capacityRps: number
  baseLatencyMs: number
  /** Per instance at tier S. */
  costPerMin: number
  /** Utilisation the node can push through; above it work queues or drops. */
  maxUtil: number
  /** Backlog limit as a multiple of one tick's capacity. 0 = no queue. */
  queueTicks: number
  serves: Capability[]
  /** Serves its capability only for a hit fraction (cache, CDN); misses continue downstream. */
  partial: boolean
  maxInstances: number
  tiered: boolean
}

const base = { maxUtil: 1, queueTicks: 0, partial: false, maxInstances: 1, tiered: false }

export const COMPONENTS: Record<ComponentKind, ComponentSpec> = {
  traffic: { ...base, kind: 'traffic', label: 'Users', capacityRps: Infinity, baseLatencyMs: 0, costPerMin: 0, serves: [] },
  allinone: {
    ...base,
    kind: 'allinone',
    label: 'Single Server',
    capacityRps: 300,
    baseLatencyMs: 30,
    costPerMin: 20,
    queueTicks: 2,
    serves: ['compute', 'lookup', 'write', 'static'],
    maxInstances: 1,
    tiered: true,
  },
  app: {
    ...base,
    kind: 'app',
    label: 'Web Server',
    capacityRps: 500,
    baseLatencyMs: 20,
    costPerMin: 10,
    queueTicks: 2,
    serves: ['compute', 'static'],
    maxInstances: 20,
    tiered: true,
  },
  lb: { ...base, kind: 'lb', label: 'Load Balancer', capacityRps: 20_000, baseLatencyMs: 2, costPerMin: 15, serves: [] },
  sqldb: {
    ...base,
    kind: 'sqldb',
    label: 'SQL Database',
    capacityRps: 0,
    baseLatencyMs: 10,
    costPerMin: 40,
    maxUtil: 1.2,
    serves: ['lookup', 'write'],
    tiered: true,
  },
  cache: { ...base, kind: 'cache', label: 'Cache', capacityRps: 50_000, baseLatencyMs: 1, costPerMin: 0, serves: ['lookup'], partial: true },
  cdn: { ...base, kind: 'cdn', label: 'CDN', capacityRps: 100_000, baseLatencyMs: 5, costPerMin: 25, serves: ['static'], partial: true },
}

/** Vertical scaling: capacity doubles per tier, cost rises faster (the "cost knee"). */
export const TIER_CAPACITY = [1, 2, 4, 8] as const
export const TIER_COST = [1, 2.2, 5, 12] as const
export const TIER_LABELS = ['S', 'M', 'L', 'XL'] as const

export const DB_READ_RPS = 1000
export const DB_WRITE_RPS = 200
export const REPLICA_COST = 30
export const MAX_REPLICAS = 5

export const CACHE_SIZES: Record<CacheSize, { hitRate: number; cost: number }> = {
  S: { hitRate: 0.6, cost: 10 },
  M: { hitRate: 0.85, cost: 20 },
  L: { hitRate: 0.95, cost: 40 },
}

export const CDN_HIT_RATE: Record<CdnTtl, number> = { long: 0.95, short: 0.7 }

export const DEFAULT_CONFIG: NodeConfig = {
  tier: 0,
  replicas: 0,
  readRouting: 'primary',
  cacheSize: 'M',
  writeStrategy: 'aside',
  cdnTtl: 'long',
}

export function serves(kind: ComponentKind, cap: Capability | undefined): boolean {
  return cap !== undefined && COMPONENTS[kind].serves.includes(cap)
}

export function hitRate(node: SimNode): number {
  if (node.kind === 'cache') return CACHE_SIZES[node.config.cacheSize].hitRate
  if (node.kind === 'cdn') return CDN_HIT_RATE[node.config.cdnTtl]
  return 0
}

export function nodeCostPerMin(node: SimNode): number {
  const spec = COMPONENTS[node.kind]
  const tierCost = spec.tiered ? TIER_COST[node.config.tier] : 1
  if (node.kind === 'cache') return CACHE_SIZES[node.config.cacheSize].cost
  if (node.kind === 'sqldb') return Math.round((spec.costPerMin + node.config.replicas * REPLICA_COST) * tierCost)
  return Math.round(spec.costPerMin * node.instances * tierCost)
}
