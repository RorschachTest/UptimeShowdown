import type { Capability, Chapter, ComponentKind, Flows, NodeConfig, SettingId, SimNode, Tier } from '../types'

export interface Tradeoff {
  solves: string
  worsens: string
}

export interface OptionDef<V> extends Tradeoff {
  value: V
  label: string
}

export type ChoiceField = 'tier' | 'readRouting' | 'cacheSize' | 'writeStrategy' | 'cdnTtl'

/** A pick-one setting, rendered as segmented buttons. */
export interface ChoiceSetting<F extends ChoiceField = ChoiceField> {
  field: F
  label: string
  /** Unlock gate; without one the setting is available as soon as the component is. */
  gate?: SettingId
  options: OptionDef<NodeConfig[F]>[]
}

/** A scale-out count, set with − / + or by scrolling over the piece. */
export interface CountSetting extends Tradeoff {
  field: 'instances' | 'replicas'
  label: string
  min: number
  max: number
  gate?: SettingId
  scrollHint: string
}

/** Replace this piece with a chain of new pieces (incoming wires go to the first). */
export interface ExpandAction extends Tradeoff {
  gate: SettingId
  label: string
  into: { kind: ComponentKind; dx: number; dy: number }[]
}

/** Which resource this piece represents when it's the bottleneck. */
export type Bottleneck = 'compute' | 'storage' | 'network'

/** Outcome of serving one tick of inflow (plus backlog) at a node. */
export interface Served {
  served: Flows
  queue: Flows
  dropped: number
  load: number
  latencyMs: number
  stale: number
}

export interface ServeContext {
  instances: number
  inflow: Flows
  backlog: Flows
  chapter: Chapter
}

/** Everything about one kind of piece: mechanics, settings, copy. The UI renders it generically. */
export interface ComponentDef extends Tradeoff {
  kind: ComponentKind
  label: string
  blurb: string
  /** Capacity units per second, per instance, at the smallest size. */
  capacityRps: number
  baseLatencyMs: number
  /** Per instance at the smallest size. */
  costPerMin: number
  /** Utilisation the node can push through; above it work queues or drops. */
  maxUtil: number
  /** Backlog limit as a multiple of one tick's capacity. 0 = no queue. */
  queueTicks: number
  serves: Capability[]
  /** Serves its capability only for a hit fraction; misses continue downstream. */
  partial: boolean
  /** Sits at the network edge: gets only what it serves when another path exists. */
  edge: boolean
  /** Has a machine-size (tier) setting that scales capacity and cost. */
  tiered: boolean
  bound: Bottleneck
  choices: ChoiceSetting[]
  count?: CountSetting
  actions: ExpandAction[]
  /** One-line capacity summary shown on the piece. */
  summary: (node: SimNode) => string
  cost: (node: SimNode) => number
  hitRate?: (config: NodeConfig) => number
  /** Custom serving model; components without one use the generic capacity pool. */
  serve?: (node: SimNode, ctx: ServeContext) => Served
}

/** Vertical scaling: capacity doubles per size, cost rises faster (the "cost knee"). */
export const TIER_CAPACITY = [1, 2, 4, 8] as const
export const TIER_COST = [1, 2.2, 5, 12] as const
export const TIER_LABELS = ['S', 'M', 'L', 'XL'] as const

export const tierMult = (def: ComponentDef, tier: Tier) => (def.tiered ? TIER_CAPACITY[tier] : 1)

/** Machine size, shared by every tiered component. */
export const tierSetting: ChoiceSetting<'tier'> = {
  field: 'tier',
  label: 'Machine size',
  gate: 'tier',
  options: [
    { value: 0, label: 'S', solves: 'The cheapest box.', worsens: 'The least capacity.' },
    { value: 1, label: 'M', solves: '2× capacity with no code changes.', worsens: '2.2× the price.' },
    { value: 2, label: 'L', solves: '4× capacity.', worsens: '5× the price, and still one machine that can crash.' },
    { value: 3, label: 'XL', solves: '8× capacity.', worsens: '12× the price. This is the cost knee: scale out instead.' },
  ],
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US')

type Defaults = 'maxUtil' | 'queueTicks' | 'partial' | 'edge' | 'tiered' | 'bound' | 'choices' | 'actions' | 'summary' | 'cost'

/** Fill in the common defaults so each component file only states what's special about it. */
export function defineComponent(def: Omit<ComponentDef, Defaults> & Partial<Pick<ComponentDef, Defaults>>): ComponentDef {
  const full: ComponentDef = {
    maxUtil: 1,
    queueTicks: 0,
    partial: false,
    edge: false,
    tiered: false,
    bound: 'compute',
    choices: [],
    actions: [],
    summary: (n) => `${fmtInt(full.capacityRps * n.instances * tierMult(full, n.config.tier))} rps capacity`,
    cost: (n) => Math.round(full.costPerMin * n.instances * (full.tiered ? TIER_COST[n.config.tier] : 1)),
    ...def,
  }
  return full
}
