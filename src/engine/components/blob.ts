import { addFlow, parseKey, TICKS_PER_SEC } from '../flows'
import type { BlobDurability, Flows } from '../types'
import { defineComponent, fmtInt } from './shared'

/** Disk per node (GB) and network per node (MB/s). */
const NODE_GB = 100_000
const NODE_MBPS = 1_250
const NODE_COST = 20
/** Disk used per GB stored. Erasure coding (e.g. 8 data + 4 parity) survives as many failures as 3 copies. */
const OVERHEAD: Record<BlobDurability, number> = { single: 1, replicas: 3, erasure: 1.5 }
/** Erasure-coded reads gather pieces from several nodes; while a node is down they also rebuild missing pieces. */
const ERASURE_MS = 15
const DEGRADED_READ = 1.5
const DEFAULT_MB = 0.01
/** An edit usually changes one block of a file; compression shrinks typical documents by ~40%. */
const DELTA_SHARE = 0.1
const COMPRESSED = 0.6

/** Object storage: big immutable files (videos, photos, tiles, file blocks), limited by disk and bandwidth. */
export const blob = defineComponent({
  kind: 'blob',
  label: 'Object Storage',
  blurb: 'Stores files of any size as objects, spread over many disks (like S3).',
  solves: 'Practically unlimited, cheap storage for big files.',
  worsens: 'Moving bytes is limited by bandwidth, and every copy costs disk.',
  capacityRps: NODE_MBPS,
  baseLatencyMs: 20,
  costPerMin: NODE_COST,
  serves: ['blob', 'static'],
  bound: 'storage',
  count: {
    field: 'instances',
    label: 'Data nodes',
    min: 1,
    max: 40,
    scrollHint: 'Scroll to add or remove data nodes',
    solves: `Each adds ${fmtInt(NODE_GB / 1000)} TB of disk and ${fmtInt(NODE_MBPS)} MB/s of bandwidth.`,
    worsens: `${NODE_COST}/min each.`,
  },
  choices: [
    {
      field: 'blobDurability',
      label: 'Durability',
      options: [
        { value: 'single', label: 'One copy', solves: 'The cheapest: every byte stored once.', worsens: 'A dead disk or node loses its objects for good.' },
        { value: 'replicas', label: '3 copies', solves: 'Survives losing two nodes; reads from any copy.', worsens: 'Three times the disk.' },
        { value: 'erasure', label: 'Erasure coding', solves: 'Data + parity pieces: survives several failures for 1.5× the disk.', worsens: 'Reads gather pieces (slower), and rebuild while a node is down.' },
      ],
    },
  ],
  summary: ({ instances, config }) =>
    `${instances} node${instances > 1 ? 's' : ''} · ${fmtInt((instances * NODE_GB) / 1000 / OVERHEAD[config.blobDurability])} TB usable · ${fmtInt(instances * NODE_MBPS)} MB/s`,
  review: ({ config }) => (config.blobDurability === 'single' ? ['One copy of each object: a failed disk loses data permanently.'] : []),
  serve: (node, { instances, inflow, chapter, stage, fired, active, parents }) => {
    const d = node.config.blobDurability
    const degraded = d === 'erasure' && active.some((e) => e.kind === 'crash') ? DEGRADED_READ : 1
    const isWrite = (k: string) => chapter.requestTypes[parseKey(k)[0]]!.bytes === 'in'
    // Block servers upstream shrink what reaches us: only changed blocks on upload, compressed both ways.
    const blocks = parents.find((p) => p.kind === 'blocksrv')?.config
    const bytesOf = (k: string) =>
      (isWrite(k) && blocks?.blockDelta ? DELTA_SHARE : 1) * (blocks?.blockCompress ? COMPRESSED : 1)
    // Disk: the stored data times the durability overhead must fit; new writes fail when it doesn't.
    const ws = stage.workingSetGb ?? 0
    const fits = ws > 0 ? Math.min(1, (instances * NODE_GB) / (ws * OVERHEAD[d])) : 1
    let mb = 0
    for (const [k, p] of Object.entries(inflow)) mb += p.count * (chapter.requestTypes[parseKey(k)[0]]!.sizeMb ?? DEFAULT_MB) * bytesOf(k) * (isWrite(k) ? 1 : degraded)
    const cap = (NODE_MBPS * instances) / TICKS_PER_SEC
    const load = mb / cap
    const scale = load > 1 ? 1 / load : 1
    const served: Flows = {}
    const dropped: Record<number, number> = {}
    for (const [k, p] of Object.entries(inflow)) {
      const t = parseKey(k)[0]
      const ok = p.count * scale * (isWrite(k) ? fits : 1)
      addFlow(served, k, ok, p.latencyMs)
      dropped[t] = (dropped[t] ?? 0) + p.count - ok
    }
    const lost = d === 'single' ? fired.filter((e) => e.kind === 'crash').length : 0
    return {
      served,
      queue: {},
      dropped,
      load: Math.max(load, ws > 0 ? (ws * OVERHEAD[d]) / (instances * NODE_GB) : 0),
      latencyMs: 20 * (1 + Math.min(load, 2) ** 4) + (d === 'erasure' ? ERASURE_MS : 0),
      stale: 0,
      violations: lost > 0 ? { lostObjects: lost } : undefined,
    }
  },
})
