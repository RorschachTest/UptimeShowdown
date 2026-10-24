import { serveGeneric } from '../serve'
import { defineComponent } from './shared'

/** Share of fetches that would hit a host it just hit, without per-host queues. */
const SAME_HOST = 0.05
/** Share of URLs that robots.txt asks crawlers to skip. */
const DISALLOWED = 0.02
/** Share of URLs that come from spider traps (endless generated links). */
const TRAPS = 0.03

/** The URL frontier: the crawler's to-do list, deciding what to fetch next and when. */
export const frontier = defineComponent({
  kind: 'frontier',
  label: 'URL Frontier',
  blurb: 'The crawler’s queue of URLs to fetch, with rules for what and when.',
  solves: 'Downloaders always have work; the crawl survives slowdowns.',
  worsens: 'Its rules decide whether you are a polite crawler or a banned one.',
  capacityRps: 100_000,
  baseLatencyMs: 2,
  costPerMin: 20,
  serves: ['enqueue'],
  buffers: true,
  bound: 'network',
  choices: [
    {
      field: 'crawlPolite',
      label: 'Per-host queues',
      options: [
        { value: false, label: 'Off', solves: 'Downloaders grab any URL: maximum speed.', worsens: 'Bursts of requests to one site get you blocked.' },
        { value: true, label: 'On', solves: 'One queue per host with a delay between fetches: polite.', worsens: 'Downloaders sometimes wait for a host: about 20% less throughput.' },
      ],
    },
    {
      field: 'crawlRobots',
      label: 'robots.txt',
      options: [
        { value: false, label: 'Ignore', solves: 'Nothing to fetch or cache.', worsens: 'Crawls pages sites asked you not to.' },
        { value: true, label: 'Respect', solves: 'Skips disallowed paths (cached per host).', worsens: 'A little extra work per host.' },
      ],
    },
    {
      field: 'crawlDepth',
      label: 'URL depth limit',
      options: [
        { value: false, label: 'None', solves: 'Follows every link.', worsens: 'Spider traps (endless calendars, session IDs) waste the crawl.' },
        { value: true, label: 'Limit', solves: 'Stops at a maximum depth and URL length.', worsens: 'May miss a few very deep pages.' },
      ],
    },
  ],
  summary: ({ config }) =>
    [config.crawlPolite ? 'polite' : 'impolite', config.crawlRobots ? 'robots.txt' : 'no robots.txt', config.crawlDepth ? 'depth limit' : 'no depth limit'].join(' · '),
  review: ({ config }) => {
    const notes: string[] = []
    if (!config.crawlPolite) notes.push('Without per-host queues, downloaders hammer the same site and get blocked.')
    if (!config.crawlRobots) notes.push('Ignoring robots.txt crawls pages sites have asked you not to.')
    if (!config.crawlDepth) notes.push('No depth limit: spider traps can swallow the crawl.')
    return notes
  },
  serve: (node, ctx) => {
    const res = serveGeneric(node, ctx)
    const n = Object.values(res.served).reduce((s, p) => s + p.count, 0)
    const v: Record<string, number> = {}
    if (!node.config.crawlPolite) v.impolite = n * SAME_HOST
    if (!node.config.crawlRobots) v.robots = n * DISALLOWED
    if (!node.config.crawlDepth) v.trapped = n * TRAPS
    return { ...res, violations: v }
  },
})
