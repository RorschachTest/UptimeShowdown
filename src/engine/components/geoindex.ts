import { parseKey } from '../flows'
import { serveGeneric } from '../serve'
import type { GeoIndex } from '../types'
import { defineComponent, fmtInt } from './shared'

/** Seconds a quadtree server spends rebuilding its tree after a restart, before it can serve. */
const QUADTREE_REBUILD_S = 20
/** Share of searches that sit near a cell edge: without the neighbouring cells they miss nearby places. */
const EDGE_SHARE = 0.3

/** Searches/s per server; `skew`: busiest server's share over the average (dense cities pile into few cells). */
const INDEXES: Record<GeoIndex, { name: string; rps: number; skew: number; latencyMs: number; cells: boolean; cost: number }> = {
  scan: { name: '2D range scan', rps: 300, skew: 1, latencyMs: 60, cells: false, cost: 20 },
  grid: { name: 'even grid', rps: 3000, skew: 3, latencyMs: 4, cells: true, cost: 20 },
  geohash: { name: 'geohash', rps: 3000, skew: 1.2, latencyMs: 4, cells: true, cost: 20 },
  quadtree: { name: 'quadtree', rps: 3000, skew: 1, latencyMs: 4, cells: false, cost: 30 },
}
/** Searching the 8 neighbouring cells too costs this much more work. */
const NEIGHBOUR_WORK = 1.5

/** The location-based service: finds places near a point using a geospatial index. */
export const geoindex = defineComponent({
  kind: 'geoindex',
  label: 'Geo Index',
  blurb: 'Answers “what is near me?” from an in-memory geospatial index.',
  solves: 'Turns a 2D search into fast lookups of a few cells.',
  worsens: 'The index must be built and kept up to date as places change.',
  capacityRps: 3000,
  baseLatencyMs: 4,
  costPerMin: 20,
  serves: ['geo'],
  relays: false,
  needsRouter: true,
  count: {
    field: 'instances',
    label: 'Servers',
    min: 1,
    max: 12,
    scrollHint: 'Scroll to add or remove index servers',
    solves: 'Every server holds the whole index, so they share searches and survive crashes.',
    worsens: 'Needs a load balancer in front. Each one costs its index’s price.',
  },
  choices: [
    {
      field: 'geoIndex',
      label: 'Index',
      options: [
        { value: 'scan', label: '2D scan', solves: 'No index to build: filter by latitude and longitude ranges.', worsens: 'Each search intersects two huge ranges: about 300/s per server, 60 ms each.' },
        { value: 'grid', label: 'Even grid', solves: 'Fixed cells: a search reads one cell.', worsens: 'A city cell holds thousands of places and the ocean holds none: hot servers.' },
        { value: 'geohash', label: 'Geohash', solves: 'A short string per cell; nearby places share a prefix. Easy to store and cache.', worsens: 'Places just across a cell edge have a different prefix.' },
        { value: 'quadtree', label: 'Quadtree', solves: 'Splits busy areas into smaller cells: even load wherever people are.', worsens: 'Built in memory on startup: a restarted server is out for a while. 30/min each.' },
      ],
    },
    {
      field: 'geoNeighbours',
      label: 'Cells searched',
      options: [
        { value: false, label: 'Own cell', solves: 'One cell per search: the least work.', worsens: 'Misses places just across the cell edge.' },
        { value: true, label: '+ 8 neighbours', solves: 'Finds everything within the radius, even across edges.', worsens: 'About 50% more work per search.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${INDEXES[config.geoIndex].name} · ${fmtInt(INDEXES[config.geoIndex].rps * instances)} searches/s`,
  cost: ({ instances, config }) => INDEXES[config.geoIndex].cost * instances,
  review: ({ config }) => {
    const ix = INDEXES[config.geoIndex]
    const notes: string[] = []
    if (ix.cells && !config.geoNeighbours) notes.push('Searching only the user’s own cell misses places just across the edge.')
    if (config.geoIndex === 'grid') notes.push('An even grid puts a whole city in a few cells: those servers run hot.')
    return notes
  },
  serve: (node, ctx) => {
    const ix = INDEXES[node.config.geoIndex]
    // A quadtree server that crashed is still rebuilding its tree for a while after it comes back.
    const rebuilding =
      node.config.geoIndex === 'quadtree'
        ? ctx.stage.events.filter(
            (e) => e.kind === 'crash' && e.target === node.kind && ctx.seconds >= e.t + (e.durationS ?? 0) && ctx.seconds < e.t + (e.durationS ?? 0) + QUADTREE_REBUILD_S,
          ).length
        : 0
    const work = ix.cells && node.config.geoNeighbours ? NEIGHBOUR_WORK : 1
    const up = Math.max(0, ctx.instances - rebuilding)
    const instances = (up * ix.rps) / (geoindex.capacityRps * ix.skew * work)
    if (instances <= 0) {
      const dropped: Record<number, number> = {}
      for (const [k, p] of Object.entries(ctx.inflow)) {
        const t = parseKey(k)[0]
        dropped[t] = (dropped[t] ?? 0) + p.count
      }
      return { served: {}, queue: {}, dropped, load: 1, latencyMs: 0, stale: 0 }
    }
    const base = serveGeneric(node, { ...ctx, instances })
    const searched = Object.values(base.served).reduce((s, p) => s + p.count, 0)
    const missed = ix.cells && !node.config.geoNeighbours ? searched * EDGE_SHARE : 0
    return { ...base, latencyMs: base.latencyMs - geoindex.baseLatencyMs + ix.latencyMs, violations: missed > 0 ? { missedNearby: missed } : undefined }
  },
})
