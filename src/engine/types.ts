// Core simulation types. Nothing in src/engine may import React, the DOM or UI libraries:
// the engine has to run unchanged on a Node server later (multiplayer, M5).

export type ComponentKind = 'traffic' | 'allinone' | 'app' | 'lb' | 'sqldb' | 'cache' | 'cdn' | 'ratelimit' | 'kvstore' | 'idgen' | 'geoindex' | 'leaderboard' | 'queue' | 'worker' | 'provider' | 'feed' | 'frontier' | 'downloader' | 'trie'

/** What a component can do for a request. A request type lists the ones it needs, in order. */
export type Capability = 'compute' | 'lookup' | 'write' | 'static' | 'id' | 'geo' | 'enqueue' | 'work' | 'deliver' | 'fanout' | 'feed' | 'suggest'

export type Tier = 0 | 1 | 2 | 3
export type ReadRouting = 'primary' | 'replicas' | 'ryw'
export type CacheSize = 'S' | 'M' | 'L'
export type WriteStrategy = 'aside' | 'through'
export type CdnTtl = 'long' | 'short'
export type RlAlgorithm = 'token' | 'leaky' | 'fixed' | 'slidingLog' | 'slidingCounter'
export type RlLimit = 'low' | 'medium' | 'high'
export type RlCounters = 'local' | 'shared'
export type CacheHashing = 'mod' | 'ring' | 'vnodes'
/** How many replicas must answer before a read or write counts as done. */
export type Quorum = 'one' | 'quorum' | 'all'
export type KvCopies = 1 | 3 | 5
export type KvConflict = 'lww' | 'vclock'
export type IdScheme = 'ticket' | 'multimaster' | 'uuid' | 'snowflake'
export type IdClock = 'trust' | 'wait'
export type GeoIndex = 'scan' | 'grid' | 'geohash' | 'quadtree'
export type BoardStore = 'sql' | 'zset'
export type BoardShard = 'hash' | 'score'
export type ProviderRetry = 'drop' | 'retry'
export type FanoutMode = 'write' | 'read' | 'hybrid'
export type TrieShard = 'letter' | 'map'
export type TrieBuild = 'live' | 'weekly'
export type WorkSample = 'all' | 'tenth'

/** Player settings. Every node carries all of them; each kind reads only its own. */
export interface NodeConfig {
  tier: Tier
  replicas: number
  readRouting: ReadRouting
  cacheSize: CacheSize
  writeStrategy: WriteStrategy
  cdnTtl: CdnTtl
  rlAlgorithm: RlAlgorithm
  rlLimit: RlLimit
  rlCounters: RlCounters
  cacheHashing: CacheHashing
  kvCopies: KvCopies
  kvWrite: Quorum
  kvRead: Quorum
  kvConflict: KvConflict
  idScheme: IdScheme
  idClock: IdClock
  geoIndex: GeoIndex
  geoNeighbours: boolean
  boardStore: BoardStore
  boardShard: BoardShard
  boardReplica: boolean
  providerRetry: ProviderRetry
  providerDedupe: boolean
  fanoutMode: FanoutMode
  crawlPolite: boolean
  crawlRobots: boolean
  crawlDepth: boolean
  dlDns: boolean
  dlDedupe: boolean
  trieTopK: boolean
  trieShard: TrieShard
  trieBuild: TrieBuild
  trieBrowserCache: boolean
  workSample: WorkSample
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
  /** Scrapers and bots: never count toward uptime or latency; tracked as bots served / stopped. */
  abusive?: boolean
  /** Peak ÷ average request rate of one client (bursty clients get rate-limited more easily). */
  burst?: number
  /** Share of these writes that race another write to the same key (two devices, two tabs). */
  conflicts?: number
  /** The user is answered once this step is done; later steps run in the background (lag, not latency; losses are violations). */
  asyncAfter?: Capability
  /** Followers who should see each of these posts (news-feed fanout). */
  fanout?: number
  /** The endpoint, shown on wires that carry it, e.g. 'GET /{code}'. */
  api?: string
  /** What a piece does for this request at each step, shown on the piece, e.g. { lookup: 'find the long URL' }. */
  does?: Partial<Record<Capability, string>>
}

export interface TrafficPoint {
  /** Game time in seconds. */
  t: number
  rps: number
}

/** Something that happens to a piece during a run. It targets the first node of `target` kind (topological order). */
export interface SimEvent {
  t: number
  /** crash: one instance down for durationS. nodeLeave / nodeJoin: a cluster member leaves or joins at t. */
  kind: 'crash' | 'nodeLeave' | 'nodeJoin' | 'partition' | 'clockSkew' | 'outage'
  target: ComponentKind
  durationS?: number
  /** partition: how many nodes are cut off (default 1). */
  count?: number
}

/** Kept for older level data; every event is a SimEvent. */
export type CrashEvent = SimEvent

export type SettingId = 'split' | 'tier' | 'replicas' | 'readRouting' | 'cacheNodes' | 'hashing' | 'sampling'

export interface Stage {
  id: string
  title: string
  story: string
  durationS: number
  traffic: TrafficPoint[]
  /** Share of traffic per request type id. */
  mix: Record<string, number>
  /** Distinct clients sending each request type (for per-client rate limits). */
  clients?: Record<string, number>
  /** What this stage newly unlocks (cumulative with earlier stages). */
  unlocks: { kinds: ComponentKind[]; settings: SettingId[] }
  events: SimEvent[]
  /** Size of the data a cache must hold to answer reads (GB). Unset: cache hit rate comes from its memory size alone. */
  workingSetGb?: number
  /** Max spend per minute for ★★. */
  budget: number
  /** Cost of the known-good design; ★★★ needs cost ≤ 1.5× this. */
  referenceCost: number
  goals: {
    uptime: number
    p95Ms: number
    maxStaleRate: number
    /** Max share of abusive requests that may get through and be served. */
    maxBotServedRate?: number
    /** Max share of real-user requests the rate limiter may reject. */
    maxThrottledRate?: number
    /** Max count of each correctness violation over the run (see Chapter.violationLabels). */
    maxViolations?: Record<string, number>
    /** Max p95 background lag (enqueue to done), ms. */
    maxLagMs?: number
  }
}

/** Level-specific structural rules: designs that break them are illegal, not just weak. */
export interface LevelRules {
  /** A piece of this kind must be on the board. */
  requires?: { kind: ComponentKind; min?: number; why: string }[]
  /** Every request of these types must pass through a piece of this kind (no bypass wires). */
  mustPassThrough?: { types: string[]; kind: ComponentKind; why: string }[]
  /** This kind may not be used in this level. */
  forbid?: { kind: ComponentKind; why: string }[]
}

export interface Chapter {
  id: string
  title: string
  requestTypes: RequestType[]
  stages: Stage[]
  seed: number
  rules?: LevelRules
  /** Human names for violation ids this chapter scores, e.g. { duplicateId: 'duplicate IDs' }. */
  violationLabels?: Record<string, string>
  /** Names for pieces by the job they end up doing: the first match wins. `when` = it handles only these request types. */
  names?: { kind: ComponentKind; name: string; when?: string[] }[]
  /** What each kind of store holds in this chapter, shown under it (e.g. 'urls: code → long URL'). */
  data?: Partial<Record<ComponentKind, string[]>>
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
  /** Per-component state carried between ticks (e.g. a cache's warmth, live cluster size). */
  state?: Record<string, number>
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
  /** Real-user requests rejected by a rate limiter. Included in errors. */
  throttled: number
  /** Abusive requests that were served (bad) or stopped anywhere (good). Not in success/errors. */
  botServed: number
  botStopped: number
  /** Correctness violations by id (duplicates, lost writes, …), counted per request. */
  violations: Record<string, number>
  latencyHist: number[]
  /** Background work finished (async request types), and how long it took end to end. */
  bgDone: number
  bgLatencyHist: number[]
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
  /** Nodes fed by a buffering piece (a queue): they can hold a long backlog. */
  buffered: Record<string, boolean>
  inEdges: Record<string, SimEdge[]>
  /** reach[nodeId][typeIndex][step]: can this node complete that request from that step? */
  reach: Record<string, boolean[][]>
  runtime: Record<string, NodeRuntime>
  nodeStats: Record<string, NodeTickStats>
  edgeRps: Record<string, number>
  /** Requests per second on each edge, split by request type index. */
  edgeTypes: Record<string, Record<number, number>>
  window: TickStats[]
  totals: TickStats
  rng: number
}

// ── Interview levels (Chapter 3 shell, reused by later problem chapters) ──

/** A hidden parameter of the problem, shown as "?" until a question reveals it. */
export type FactId = 'scale' | 'mix' | 'geography' | 'freshness' | 'failures' | 'latency' | 'abuse' | 'clients' | 'growth' | 'data' | 'conflicts' | 'ordering'

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
  /** Background shown before the questions: the situation, without giving away the hidden facts. */
  brief?: { points: string[]; diagram?: LessonCard['diagram'] }
}

// ── Estimate levels (Chapter 2) ──

/** Units as exponents of base units: views/user/day = { view: 1, user: -1, day: -1 }. */
export type UnitMap = Record<string, number>

export interface NumberCard {
  id: string
  /** What the card says, e.g. "10M daily users". */
  label: string
  value: number
  unit: UnitMap
}

export interface PickQuestion {
  kind: 'pick'
  id: string
  prompt: string
  options: { id: string; label: string; correct: boolean }[]
  explain: string
}

export interface OrderQuestion {
  kind: 'order'
  id: string
  prompt: string
  /** Sorted by `value`, smallest first, to grade. */
  items: { id: string; label: string; value: number }[]
  explain: string
}

export interface EquationQuestion {
  kind: 'equation'
  id: string
  prompt: string
  cards: NumberCard[]
  answer: number
  unit: UnitMap
  explain: string
}

export type EstimateQuestion = PickQuestion | OrderQuestion | EquationQuestion

/** One term in an equation strip: a card, multiplied or divided into the running result. */
export interface EquationStep {
  cardId: string
  op: 'mul' | 'div'
}

export type EstimateAnswer = { kind: 'pick'; optionId: string } | { kind: 'order'; ids: string[] } | { kind: 'equation'; steps: EquationStep[] }

export interface EstimateStage {
  id: string
  title: string
  story: string
  questions: EstimateQuestion[]
}

export interface EstimateLevel {
  id: string
  title: string
  stages: EstimateStage[]
}

// ── Lessons (the Learn step before every chapter's hands-on) ──

export interface LessonCard {
  title: string
  body: string
  /** What the idea or component buys you, and what it costs. */
  solves?: string
  worsens?: string
  /** A small read-only diagram: pieces and 'a>b' wires (optionally 'a>b|label'), laid out left to right. */
  diagram?: DiagramSpec
  /** A picture or a small hands-on lab that explains the idea. */
  visual?: LessonVisual
}

/** A design drawn read-only: pieces with optional name, step lines and data notes; wires 'a>b' or 'a>b|label'. */
export interface DiagramSpec {
  nodes: [id: string, kind: ComponentKind, info?: { name?: string; does?: string[]; data?: string[] }][]
  wires: string[]
}

/** Palette names for lesson pictures (mapped to theme colours by the UI). */
export type Hue = 'blue' | 'orange' | 'purple' | 'teal' | 'green' | 'red' | 'yellow' | 'grey'

/** Lesson pictures. Static kinds are plain data; lab kinds are small interactive explainers. */
export type LessonVisual =
  /** A number split into fields, e.g. a 64-bit ID. */
  | { kind: 'bits'; caption: string; fields: { label: string; bits: number; hue: Hue; note: string }[] }
  /** Horizontal bars comparing a few values. */
  | { kind: 'bars'; caption: string; unit: string; rows: { label: string; value: number; hue: Hue; note?: string }[] }
  /** A coloured left-to-right flow of steps. */
  | { kind: 'steps'; caption: string; steps: { title: string; text: string; hue: Hue }[] }
  /** Two or more side-by-side options with pros and cons. */
  | { kind: 'versus'; caption: string; sides: { title: string; hue: Hue; good: string[]; bad: string[] }[] }
  /** Labs: try the idea with buttons and see what happens. */
  | { kind: 'ringLab' }
  | { kind: 'quorumLab' }
  | { kind: 'bitPacker' }
  | { kind: 'clockLab' }

export interface Lesson {
  /** One line on what this chapter teaches. */
  summary: string
  cards: LessonCard[]
  /** Short check, graded with the estimation question kinds. */
  quiz: EstimateQuestion[]
}
