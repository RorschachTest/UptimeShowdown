import { addFlow, parseKey } from '../flows'
import { serveGeneric } from '../serve'
import type { Flows } from '../types'
import { defineComponent } from './shared'

/** Pages per second per downloader with a DNS cache; without one, every fetch waits on a DNS lookup. */
const PAGES = 500
const DNS_SLOWDOWN = 0.5
const POLITE_SLOWDOWN = 0.8
const DEDUPE_SLOWDOWN = 0.9
/** Share of fetched pages whose content is already stored (mirrors, copies). */
const DUPLICATE_CONTENT = 0.3
const DNS_CACHE_COST = 5

/** HTML downloaders: fetch pages, parse them and store new content. */
export const downloader = defineComponent({
  kind: 'downloader',
  label: 'HTML Downloaders',
  blurb: 'Fetch pages from the web, parse them, and store what is new.',
  solves: 'Add downloaders to crawl faster.',
  worsens: 'Each one costs money, and the web is slow and unreliable.',
  capacityRps: PAGES,
  baseLatencyMs: 300,
  costPerMin: 10,
  serves: ['work'],
  relays: false,
  count: {
    field: 'instances',
    label: 'Downloaders',
    min: 1,
    max: 40,
    scrollHint: 'Scroll to add or remove downloaders',
    solves: `Up to ${PAGES} pages a second each, with a DNS cache.`,
    worsens: '10/min each.',
  },
  choices: [
    {
      field: 'dlDns',
      label: 'DNS cache',
      options: [
        { value: false, label: 'None', solves: 'Nothing to run.', worsens: 'Every fetch waits on a DNS lookup: half the throughput, and a DNS outage stops the crawl.' },
        { value: true, label: 'Local cache', solves: 'Hostnames resolve from memory: twice the throughput, and DNS hiccups are absorbed.', worsens: `${DNS_CACHE_COST}/min.` },
      ],
    },
    {
      field: 'dlDedupe',
      label: 'Content seen?',
      options: [
        { value: false, label: 'Store everything', solves: 'No extra check.', worsens: 'About 30% of pages are copies of pages you already have.' },
        { value: true, label: 'Hash and skip', solves: 'Compare a content hash and skip pages already stored.', worsens: 'About 10% slower per page.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${instances} × ${Math.round(PAGES * (config.dlDns ? 1 : DNS_SLOWDOWN))} pages/s · ${config.dlDedupe ? 'dedupe' : 'no dedupe'}`,
  cost: ({ instances, config }) => 10 * instances + (config.dlDns ? DNS_CACHE_COST : 0),
  serve: (node, ctx) => {
    const dnsDown = ctx.active.some((e) => e.kind === 'outage')
    if (dnsDown && !node.config.dlDns) {
      // No DNS cache during a DNS outage: nothing can be fetched; work waits in the frontier's backlog.
      const queue: Flows = {}
      for (const [k, p] of [...Object.entries(ctx.backlog), ...Object.entries(ctx.inflow)]) addFlow(queue, k, p.count, p.latencyMs + 100)
      const dropped: Record<number, number> = {}
      if (!ctx.buffered) for (const [k, p] of Object.entries(queue)) dropped[parseKey(k)[0]] = (dropped[parseKey(k)[0]] ?? 0) + p.count
      return { served: {}, queue: ctx.buffered ? queue : {}, dropped, load: 0, latencyMs: 0, stale: 0 }
    }
    // Per-host politeness in the frontier makes downloaders wait on slow hosts now and then.
    const polite = ctx.parents.some((p) => p.kind === 'frontier' && p.config.crawlPolite)
    const speed = (node.config.dlDns ? 1 : DNS_SLOWDOWN) * (node.config.dlDedupe ? DEDUPE_SLOWDOWN : 1) * (polite ? POLITE_SLOWDOWN : 1)
    const res = serveGeneric(node, { ...ctx, instances: ctx.instances * speed })
    const n = Object.values(res.served).reduce((s, p) => s + p.count, 0)
    return { ...res, violations: node.config.dlDedupe ? undefined : { duplicatePages: n * DUPLICATE_CONTENT } }
  },
})
