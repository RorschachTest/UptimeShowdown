import type { ComponentKind, Flow } from './types'

export interface ComponentSpec {
  kind: ComponentKind
  label: string
  /** Per instance, per class. Utilisation is the sum over classes of demand / capacity. */
  capacityRps: Flow
  baseLatencyMs: number
  /** Per instance. */
  costPerMin: number
  /** Utilisation the node can actually push through; demand above it waits in the queue or drops. */
  maxUtil: number
  /** Backlog limit as a multiple of one tick's capacity. 0 = no queue, excess drops at once. */
  queueTicks: number
  minInstances: number
  maxInstances: number
  failureMode: string
}

export const COMPONENTS: Record<ComponentKind, ComponentSpec> = {
  traffic: {
    kind: 'traffic',
    label: 'Traffic Source',
    capacityRps: { read: Infinity, write: Infinity },
    baseLatencyMs: 0,
    costPerMin: 0,
    maxUtil: 1,
    queueTicks: 0,
    minInstances: 1,
    maxInstances: 1,
    failureMode: 'Emits the level traffic. Requests with nowhere to go are errors.',
  },
  app: {
    kind: 'app',
    label: 'App Server',
    capacityRps: { read: 500, write: 500 },
    baseLatencyMs: 20,
    costPerMin: 10,
    maxUtil: 1,
    queueTicks: 2,
    minInstances: 1,
    maxInstances: 20,
    failureMode: 'Queues up to 2× capacity, then drops.',
  },
  sqldb: {
    kind: 'sqldb',
    label: 'SQL Database',
    capacityRps: { read: 1000, write: 200 },
    baseLatencyMs: 10,
    costPerMin: 40,
    maxUtil: 1.2,
    queueTicks: 0,
    minInstances: 1,
    maxInstances: 1,
    failureMode: 'Latency climbs sharply above 80% load; drops above 120%.',
  },
}

export function costPerMin(kind: ComponentKind, instances: number): number {
  return COMPONENTS[kind].costPerMin * instances
}
