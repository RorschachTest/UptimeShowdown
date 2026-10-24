import { addFlow } from '../flows'
import { serveGeneric } from '../serve'
import type { Flows, TrieShard } from '../types'
import { defineComponent } from './shared'

const SHARD_LOOKUPS = 20_000
/** Without top-k cached at each node, a lookup walks the whole subtree under the prefix. */
const SUBTREE_WALK = 20
/** Updating the trie on every query locks nodes and steals capacity from lookups. */
const LIVE_UPDATE_SPEED = 0.4
/** Share of keystrokes the browser answers from its own cache (Cache-Control: 1 hour). */
const BROWSER_HITS = 0.35
/** Busiest shard over the average: first letters are very uneven ('s' vs 'x'). */
const SKEW: Record<TrieShard, number> = { letter: 2.5, map: 1.1 }

/** An in-memory trie of popular queries, answering "what completes this prefix?". */
export const trie = defineComponent({
  kind: 'trie',
  label: 'Trie Cache',
  blurb: 'An in-memory prefix tree of popular searches, returning the top suggestions for a prefix.',
  solves: 'Suggestions in a few milliseconds as people type.',
  worsens: 'Must be rebuilt as tastes change, and must be split when it outgrows one machine.',
  capacityRps: SHARD_LOOKUPS,
  baseLatencyMs: 3,
  costPerMin: 30,
  serves: ['suggest'],
  relays: false,
  bound: 'storage',
  count: {
    field: 'instances',
    label: 'Shards',
    min: 1,
    max: 12,
    scrollHint: 'Scroll to add or remove trie shards',
    solves: `Each shard answers about ${(SHARD_LOOKUPS / 1000).toFixed(0)}k lookups a second for its part of the alphabet.`,
    worsens: '30/min each.',
  },
  choices: [
    {
      field: 'trieTopK',
      label: 'Top 5 at each node',
      options: [
        { value: false, label: 'Compute', solves: 'A smaller trie.', worsens: 'Each lookup walks every word under the prefix: ~20× the work and slower.' },
        { value: true, label: 'Cached', solves: 'Each node stores its top 5 completions: a lookup is one read.', worsens: 'More memory, and the lists must be rebuilt.' },
      ],
    },
    {
      field: 'trieBuild',
      label: 'Updates',
      options: [
        { value: 'live', label: 'Every query', solves: 'Trending searches show up at once.', worsens: 'Each search updates up to a dozen nodes: lookups lose 60% of their capacity.' },
        { value: 'weekly', label: 'Weekly rebuild', solves: 'Workers rebuild the trie offline and swap it in: lookups get the whole machine.', worsens: 'New trends appear only after the next rebuild.' },
      ],
    },
    {
      field: 'trieShard',
      label: 'Split shards by',
      options: [
        { value: 'letter', label: 'First letter', solves: 'Simple: a–m here, n–z there.', worsens: 'Far more words start with “s” than with “x”: some shards are swamped.' },
        { value: 'map', label: 'Shard map', solves: 'Ranges chosen from past traffic so each shard gets an equal share.', worsens: 'A shard map to build and look up.' },
      ],
    },
    {
      field: 'trieBrowserCache',
      label: 'Browser caching',
      options: [
        { value: false, label: 'Off', solves: 'Every keystroke gets fresh suggestions.', worsens: 'Every keystroke reaches your servers.' },
        { value: true, label: '1 hour', solves: 'Browsers reuse suggestions for prefixes typed recently: about a third never reach you.', worsens: 'Suggestions can be up to an hour old.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${instances} shard${instances > 1 ? 's' : ''} · ${config.trieTopK ? 'top-5 cached' : 'walks subtrees'} · ${config.trieBuild === 'weekly' ? 'weekly rebuild' : 'live updates'}`,
  review: ({ instances, config }) => {
    const notes: string[] = []
    if (!config.trieTopK) notes.push('Without top-k cached in each node, every keystroke walks a whole subtree.')
    if (config.trieBuild === 'live') notes.push('Updating the trie on every search makes lookups fight writes.')
    if (instances > 1 && config.trieShard === 'letter') notes.push('Sharding by first letter overloads the shards for common letters.')
    return notes
  },
  serve: (node, ctx) => {
    const { trieTopK, trieBuild, trieShard, trieBrowserCache } = node.config
    // Browser-cached keystrokes are answered on the device: instant, and never reach the shards.
    const fromBrowser = trieBrowserCache ? BROWSER_HITS : 0
    const instant: Flows = {}
    const rest: Flows = {}
    for (const [k, p] of Object.entries(ctx.inflow)) {
      addFlow(instant, k, p.count * fromBrowser, p.latencyMs)
      addFlow(rest, k, p.count * (1 - fromBrowser), p.latencyMs)
    }
    const speed = (trieTopK ? 1 : 1 / SUBTREE_WALK) * (trieBuild === 'weekly' ? 1 : LIVE_UPDATE_SPEED) / (node.instances > 1 ? SKEW[trieShard] : 1)
    const res = serveGeneric(node, { ...ctx, inflow: rest, instances: ctx.instances * speed })
    const served: Flows = { ...res.served }
    for (const [k, p] of Object.entries(instant)) addFlow(served, k, p.count, p.latencyMs - res.latencyMs)
    return { ...res, served, latencyMs: res.latencyMs + (trieTopK ? 0 : 40) }
  },
})
