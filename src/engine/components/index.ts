import type { Capability, ComponentKind, NodeConfig, SimNode } from '../types'
import { allinone } from './allinone'
import { app } from './app'
import { cache } from './cache'
import { cdn } from './cdn'
import { downloader } from './downloader'
import { feed } from './feed'
import { frontier } from './frontier'
import { geoindex } from './geoindex'
import { idgen } from './idgen'
import { kvstore } from './kvstore'
import { lb } from './lb'
import { leaderboard } from './leaderboard'
import { provider } from './provider'
import { queue } from './queue'
import { ratelimit } from './ratelimit'
import { defineComponent, type ComponentDef, type CountSetting } from './shared'
import { sqldb } from './sqldb'
import { trie } from './trie'
import { worker } from './worker'

export * from './shared'

const traffic = defineComponent({
  kind: 'traffic',
  label: 'Users',
  blurb: 'Where your users come from.',
  solves: '',
  worsens: '',
  capacityRps: Infinity,
  baseLatencyMs: 0,
  costPerMin: 0,
  serves: [],
  cost: () => 0,
})

/** The catalogue. Adding a component = one new file here; the UI renders it from its definition. */
export const COMPONENTS: Record<ComponentKind, ComponentDef> = { traffic, allinone, app, lb, sqldb, cache, cdn, ratelimit, kvstore, idgen, geoindex, leaderboard, queue, worker, provider, feed, frontier, downloader, trie }

export const DEFAULT_CONFIG: NodeConfig = {
  tier: 0,
  replicas: 0,
  readRouting: 'primary',
  cacheSize: 'M',
  writeStrategy: 'aside',
  cdnTtl: 'long',
  rlAlgorithm: 'token',
  rlLimit: 'medium',
  rlCounters: 'local',
  cacheHashing: 'mod',
  kvCopies: 1,
  kvWrite: 'one',
  kvRead: 'one',
  kvConflict: 'lww',
  idScheme: 'ticket',
  idClock: 'trust',
  geoIndex: 'scan',
  geoNeighbours: false,
  boardStore: 'sql',
  boardShard: 'hash',
  boardReplica: false,
  providerRetry: 'drop',
  providerDedupe: false,
  fanoutMode: 'write',
  crawlPolite: false,
  crawlRobots: false,
  crawlDepth: false,
  dlDns: false,
  dlDedupe: false,
  trieTopK: false,
  trieShard: 'letter',
  trieBuild: 'live',
  trieBrowserCache: false,
  workSample: 'all',
}

export function serves(kind: ComponentKind, cap: Capability | undefined): boolean {
  return cap !== undefined && COMPONENTS[kind].serves.includes(cap)
}

export const hitRate = (node: SimNode) => COMPONENTS[node.kind].hitRate?.(node.config) ?? 0

export const nodeCostPerMin = (node: SimNode) => COMPONENTS[node.kind].cost(node)

export function getCount(node: Pick<SimNode, 'instances' | 'config'>, field: CountSetting['field']): number {
  return field === 'instances' ? node.instances : node.config.replicas
}
