import { addFlow, parseKey, TICKS_PER_SEC } from '../flows'
import type { FanoutMode, Flows } from '../types'
import { BUFFER_TICKS, defineComponent } from './shared'

/** Feed-cache operations per second, per server. */
const SERVER_OPS = 200_000
/** Accounts a typical user follows (a pull-on-read feed fetches all of them). */
const FOLLOWEES = 100
/** Celebrities a typical user follows (hybrid feeds pull just these on read). */
const CELEBS_FOLLOWED = 5
/** Accounts with more followers than this count as celebrities in a hybrid feed. */
const CELEB_FOLLOWERS = 1_000_000

const MODES: Record<FanoutMode, string> = { write: 'fanout on write', read: 'fanout on read', hybrid: 'hybrid fanout' }

/** Cost of one request, in feed-cache operations, under a fanout strategy. */
export function feedCost(mode: FanoutMode, need: 'fanout' | 'feed', followers: number): number {
  if (need === 'feed') return mode === 'write' ? 1 : mode === 'read' ? FOLLOWEES : 1 + CELEBS_FOLLOWED
  if (mode === 'read') return 1
  if (mode === 'hybrid' && followers > CELEB_FOLLOWERS) return 1
  return followers
}

/** Builds each user's news feed: pushes new posts into followers' feeds, or pulls them when a feed is read. */
export const feed = defineComponent({
  kind: 'feed',
  label: 'News Feed Service',
  blurb: 'Keeps a ready-made feed per user in a cache, and serves it.',
  solves: 'Opening the app shows a feed in milliseconds.',
  worsens: 'Every post may have to be copied into thousands of feeds.',
  capacityRps: SERVER_OPS,
  baseLatencyMs: 5,
  costPerMin: 20,
  serves: ['fanout', 'feed'],
  relays: false,
  needsRouter: true,
  bound: 'storage',
  count: {
    field: 'instances',
    label: 'Servers',
    min: 1,
    max: 20,
    scrollHint: 'Scroll to add or remove feed servers',
    solves: `Each server does about ${(SERVER_OPS / 1000).toFixed(0)}k feed-cache operations a second.`,
    worsens: '20/min each. Needs a load balancer in front for reads.',
  },
  choices: [
    {
      field: 'fanoutMode',
      label: 'Fanout',
      options: [
        { value: 'write', label: 'On write (push)', solves: 'Feeds are ready before anyone asks: reads are one cache hit.', worsens: 'A post by someone with 20 million followers means 20 million writes.' },
        { value: 'read', label: 'On read (pull)', solves: 'Posting is one write, whoever posts.', worsens: `Every feed open fetches posts from all ~${FOLLOWEES} people you follow: slow reads.` },
        { value: 'hybrid', label: 'Hybrid', solves: 'Push for normal users; pull only the few celebrities each user follows.', worsens: 'Two code paths to build and keep right.' },
      ],
    },
  ],
  summary: ({ instances, config }) => `${MODES[config.fanoutMode]} · ${instances} server${instances > 1 ? 's' : ''}`,
  review: ({ config }) =>
    config.fanoutMode === 'read' ? [`Pull on read makes every feed open fetch from ~${FOLLOWEES} accounts.`] : [],
  serve: (node, { instances, inflow, backlog, chapter, buffered }) => {
    const mode = node.config.fanoutMode
    const cap = (SERVER_OPS * instances) / TICKS_PER_SEC
    const all: Flows = {}
    for (const [k, p] of Object.entries(backlog)) addFlow(all, k, p.count, p.latencyMs)
    for (const [k, p] of Object.entries(inflow)) addFlow(all, k, p.count, p.latencyMs)

    const costOf = (k: string) => {
      const [t, step] = parseKey(k)
      const rt = chapter.requestTypes[t]!
      return feedCost(mode, rt.needs[step] === 'feed' ? 'feed' : 'fanout', rt.fanout ?? 1)
    }
    // Reads are served first: the user is waiting. Fanout work gets what's left and waits in the queue.
    let left = cap
    const served: Flows = {}
    const queue: Flows = {}
    const dropped: Record<number, number> = {}
    let readWork = 0
    let allWork = 0
    const entries = Object.entries(all).sort(([a], [b]) => Number(costOf(a) > costOf(b)) - Number(costOf(b) > costOf(a)))
    for (const [k, p] of entries) {
      const [t, step] = parseKey(k)
      const isRead = chapter.requestTypes[t]!.needs[step] === 'feed'
      const unit = costOf(k)
      const work = p.count * unit
      allWork += work
      if (isRead) readWork += work
      const ok = Math.min(p.count, left / unit)
      left -= ok * unit
      addFlow(served, k, ok, p.latencyMs)
      const rest = p.count - ok
      if (rest <= 0) continue
      // Fanout waits up to a minute of capacity when a queue feeds it; reads that can't be served fail.
      if (!isRead && buffered && rest * unit <= cap * BUFFER_TICKS) addFlow(queue, k, rest, p.latencyMs + 100)
      else dropped[t] = (dropped[t] ?? 0) + rest
    }
    const load = allWork / cap
    const readFetches = mode === 'read' ? FOLLOWEES : mode === 'hybrid' ? 1 + CELEBS_FOLLOWED : 1
    const latencyMs = 5 + readFetches * 0.8 + 5 * Math.min(readWork / cap, 2) ** 4
    return { served, queue, dropped, load, latencyMs, stale: 0 }
  },
})
