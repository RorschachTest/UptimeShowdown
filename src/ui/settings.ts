import type { Chapter, ComponentKind, NodeConfig, SettingId } from '../engine/types'

export const TYPE_COLORS: Record<string, string> = {
  page: 'var(--color-read)',
  write: 'var(--color-write)',
  ryw: 'var(--color-ryw)',
  static: 'var(--color-static)',
}

export interface Tradeoff {
  solves: string
  worsens: string
}

export const COMPONENT_INFO: Record<ComponentKind, Tradeoff & { blurb: string }> = {
  traffic: { blurb: 'Where your users come from.', solves: '', worsens: '' },
  allinone: {
    blurb: 'Web server, code and database on one machine.',
    solves: 'The cheapest, simplest way to start.',
    worsens: "One crash takes everything down, and it can't grow past one box.",
  },
  app: {
    blurb: 'Runs your code and builds pages.',
    solves: 'Add instances to handle more traffic.',
    worsens: 'Users only reach one instance unless a load balancer sits in front.',
  },
  lb: {
    blurb: 'One address in front of many web servers.',
    solves: 'Spreads traffic and routes around a crashed server.',
    worsens: 'Another hop and another bill. Pointless with only one server behind it.',
  },
  sqldb: {
    blurb: 'The durable home for users and posts.',
    solves: 'Data survives restarts. One source of truth.',
    worsens: 'About 1,000 reads/s and 200 writes/s per box, and every write hits the primary.',
  },
  cache: {
    blurb: 'Keeps hot data in memory, between your servers and the database.',
    solves: 'Answers most reads in about 1 ms and shields the database.',
    worsens: 'A second copy of the data that can be out of date.',
  },
  cdn: {
    blurb: 'Copies of images and scripts in data centres near your users.',
    solves: 'Static files load fast worldwide and never reach your servers.',
    worsens: 'Only helps static files. Dynamic requests pass straight through.',
  },
}

export interface OptionDef<V> extends Tradeoff {
  value: V
  label: string
}

export interface ChoiceSetting<F extends keyof NodeConfig = keyof NodeConfig> {
  field: F
  label: string
  kinds: ComponentKind[]
  /** Unlock gate; settings without one are available as soon as the component is. */
  gate?: SettingId
  options: OptionDef<NodeConfig[F]>[]
}

const tier: ChoiceSetting<'tier'> = {
  field: 'tier',
  label: 'Machine size',
  kinds: ['allinone', 'app', 'sqldb'],
  gate: 'tier',
  options: [
    { value: 0, label: 'S', solves: 'The cheapest box.', worsens: 'The least capacity.' },
    { value: 1, label: 'M', solves: '2× capacity with no code changes.', worsens: '2.2× the price.' },
    { value: 2, label: 'L', solves: '4× capacity.', worsens: '5× the price, and still one machine that can crash.' },
    { value: 3, label: 'XL', solves: '8× capacity.', worsens: '12× the price. This is the cost knee: scale out instead.' },
  ],
}

const readRouting: ChoiceSetting<'readRouting'> = {
  field: 'readRouting',
  label: 'Send reads to',
  kinds: ['sqldb'],
  gate: 'readRouting',
  options: [
    { value: 'primary', label: 'Primary', solves: 'Everyone sees the latest data.', worsens: 'Replicas sit idle; the primary takes every read.' },
    { value: 'replicas', label: 'Replicas', solves: 'Spreads all reads across the replicas.', worsens: "Replicas lag: people may not see the post they just wrote." },
    {
      value: 'ryw',
      label: 'Own writes → primary',
      solves: "Reads of a user's own posts stay on the primary; everything else uses replicas.",
      worsens: 'The primary still takes those reads plus every write.',
    },
  ],
}

const cacheSize: ChoiceSetting<'cacheSize'> = {
  field: 'cacheSize',
  label: 'Memory',
  kinds: ['cache'],
  options: [
    { value: 'S', label: 'S', solves: 'About 60% of reads answered. 10/min.', worsens: '40% of reads still reach the database.' },
    { value: 'M', label: 'M', solves: 'About 85% of reads answered. 20/min.', worsens: 'Costs twice as much as S.' },
    { value: 'L', label: 'L', solves: 'About 95% of reads answered: the hot set fits. 40/min.', worsens: 'Costs four times S.' },
  ],
}

const writeStrategy: ChoiceSetting<'writeStrategy'> = {
  field: 'writeStrategy',
  label: 'On write',
  kinds: ['cache'],
  options: [
    {
      value: 'aside',
      label: 'Cache-aside',
      solves: 'Simple; if the cache dies, reads just get slower.',
      worsens: "Can return an old copy right after a user's own write.",
    },
    { value: 'through', label: 'Write-through', solves: 'Writes update the cache too, so reads stay fresh.', worsens: 'Every write does extra work.' },
  ],
}

const cdnTtl: ChoiceSetting<'cdnTtl'> = {
  field: 'cdnTtl',
  label: 'Keep files for',
  kinds: ['cdn'],
  options: [
    { value: 'long', label: 'Long (versioned URLs)', solves: 'About 95% of files served at the edge.', worsens: 'Every changed file needs a new URL.' },
    { value: 'short', label: 'Short', solves: 'Changes show up within a minute.', worsens: 'Only about 70% hits; the rest travel to your servers.' },
  ],
}

export const CHOICE_SETTINGS: ChoiceSetting[] = [tier, readRouting, cacheSize, writeStrategy, cdnTtl] as ChoiceSetting[]

export const COUNT_INFO = {
  instances: {
    solves: 'Scale out: more servers share the load and survive one crashing.',
    worsens: 'Needs a load balancer in front. Each one costs 10/min (× size).',
  },
  replicas: {
    solves: 'Read-only copies of the database that take reads off the primary.',
    worsens: "They lag behind the primary. 30/min each (× size).",
  },
} satisfies Record<string, Tradeoff>

/** Stage index (0-based) where a setting unlocks, or null if it never does in this chapter. */
export function unlockStageOf(chapter: Chapter, setting: SettingId): number | null {
  const i = chapter.stages.findIndex((s) => s.unlocks.settings.includes(setting))
  return i < 0 ? null : i
}

export function isUnlocked(chapter: Chapter, setting: SettingId, stageIndex: number): boolean {
  const i = unlockStageOf(chapter, setting)
  return i !== null && i <= stageIndex
}

export function unlockedKinds(chapter: Chapter, stageIndex: number): ComponentKind[] {
  return chapter.stages.slice(0, stageIndex + 1).flatMap((s) => s.unlocks.kinds)
}
