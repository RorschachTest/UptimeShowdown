import { parseKey } from '../flows'
import { serveGeneric } from '../serve'
import type { WsAssign, WsReconnect } from '../types'
import { defineComponent, fmtInt } from './shared'

/** Live connections one server can hold (memory, file descriptors). */
const CONNS = 50_000
/** Messages per second per server. */
const MSGS = 20_000
/** A reconnect costs this many message-units of work (TLS handshake, auth, restoring the session and unread messages). */
const HANDSHAKE = 20
/** Seconds a reconnect wave lasts: everyone at once (and retrying), or spread out with jittered backoff. */
const STORM_S: Record<WsReconnect, number> = { immediate: 2, jitter: 20 }
/** Random placement leaves the fullest server with this much more than its share. */
const SKEW: Record<WsAssign, number> = { random: 1.25, leastConn: 1.02 }

/** Servers that hold users' WebSocket connections and push messages to them. */
export const wsgateway = defineComponent({
  kind: 'wsgateway',
  label: 'WebSocket Servers',
  blurb: 'Hold a live connection to every online user, so messages can be pushed to them instantly.',
  solves: 'Real-time delivery in both directions, without polling.',
  worsens: 'Stateful: every connection lives on one server, and a crashed server drops all of them at once.',
  capacityRps: MSGS,
  baseLatencyMs: 5,
  costPerMin: 15,
  serves: ['push'],
  bound: 'network',
  count: {
    field: 'instances',
    label: 'Servers',
    min: 1,
    max: 30,
    scrollHint: 'Scroll to add or remove WebSocket servers',
    solves: `Each holds about ${fmtInt(CONNS)} connections and ${fmtInt(MSGS)} messages a second.`,
    worsens: '15/min each.',
  },
  choices: [
    {
      field: 'wsAssign',
      label: 'Assign users by',
      options: [
        { value: 'random', label: 'Random server', solves: 'No coordination.', worsens: 'Some servers end up much fuller than others.' },
        { value: 'leastConn', label: 'Service discovery', solves: 'A registry (like ZooKeeper) hands each user the least-loaded server.', worsens: 'One more system to run.' },
      ],
    },
    {
      field: 'wsReconnect',
      label: 'When a server dies, clients',
      options: [
        { value: 'immediate', label: 'Reconnect at once', solves: 'Back online as fast as possible.', worsens: 'Tens of thousands of handshakes hit the survivors in the same second: a reconnect storm.' },
        { value: 'jitter', label: 'Back off with jitter', solves: 'Each client waits a random few seconds: the reconnects trickle in.', worsens: 'Some users are offline for a few extra seconds.' },
      ],
    },
  ],
  summary: ({ instances }) => `${instances} server${instances > 1 ? 's' : ''} · ${fmtInt(instances * CONNS)} connections`,
  review: ({ config }) => {
    const notes: string[] = []
    if (config.wsReconnect === 'immediate') notes.push('Clients that reconnect at once will hammer the surviving servers when one dies.')
    if (config.wsAssign === 'random') notes.push('Random placement leaves some WebSocket servers much fuller than others.')
    return notes
  },
  serve: (node, ctx) => {
    const { wsAssign, wsReconnect } = node.config
    const live = ctx.instances
    const conns = ctx.stage.connections ?? 0
    // A server crash sends its users back to the others, as handshakes spread over the storm window.
    let stormUntil = ctx.state?.stormUntil ?? -1
    let stormRate = ctx.state?.stormRate ?? 0
    if (ctx.fired.some((e) => e.kind === 'crash')) {
      stormRate = (conns / node.instances) * HANDSHAKE / STORM_S[wsReconnect]
      stormUntil = ctx.seconds + STORM_S[wsReconnect]
    }
    const storm = ctx.seconds < stormUntil ? stormRate : 0
    // Capacity left for messages after the reconnect work this second.
    const msgShare = Math.max(0, 1 - storm / (MSGS * live))
    // Users who can't get a connection at all (the fullest server is full) can't send.
    const fullest = (conns / live) * (live > 1 ? SKEW[wsAssign] : 1)
    const connected = fullest > CONNS ? CONNS / fullest : 1
    const res = serveGeneric(node, { ...ctx, instances: Math.max(live * msgShare, 1e-6) })
    // Scale what was served by the share of users who are connected.
    if (connected < 1) {
      for (const [k, p] of Object.entries(res.served)) {
        const lost = p.count * (1 - connected)
        p.count -= lost
        const t = parseKey(k)[0]
        res.dropped[t] = (res.dropped[t] ?? 0) + lost
      }
    }
    return { ...res, load: Math.max(res.load, fullest / CONNS), state: { stormUntil, stormRate } }
  },
})
