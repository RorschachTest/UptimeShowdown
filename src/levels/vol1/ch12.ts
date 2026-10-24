import { chapter12 } from '../chapter12'
import type { ChapterEntry } from '../types'

export const v1ch12: ChapterEntry = {
  id: 'v1-12',
  volume: 1,
  number: 12,
  title: 'Design a chat system',
  topic: 'SDI Vol 1 · Design a chat system',
  play: { kind: 'interview', level: chapter12 },
  lesson: {
    summary: 'Keep a live connection to everyone online, give every message an ordered ID, and survive a server taking thousands of connections down with it.',
    cards: [
      {
        title: 'How the server reaches you',
        body: 'The server needs to send you a message the moment it arrives. Polling asks over and over, mostly for nothing. Long polling holds a request open until something arrives. A WebSocket is one connection that stays open both ways.',
        visual: {
          kind: 'versus',
          caption: 'Three ways to get messages to the client.',
          sides: [
            { title: 'Polling', hue: 'red', good: ['Simple'], bad: ['Mostly empty requests', 'Up to one interval of delay'] },
            { title: 'Long polling', hue: 'orange', good: ['Less waste'], bad: ['Reconnects after every message', 'Hard to know who is online'] },
            { title: 'WebSocket', hue: 'green', good: ['Instant both ways', 'One connection per user'], bad: ['Stateful servers'] },
          ],
        },
      },
      {
        title: 'Stateful and stateless',
        body: 'Chat servers hold connections, so they are stateful: a user’s socket lives on one server. Everything else (login, history, profiles) is plain HTTP behind a load balancer. Service discovery hands each new user the least-loaded chat server.',
        diagram: {
          nodes: [['u', 'traffic'], ['ws', 'wsgateway'], ['g', 'idgen'], ['kv', 'kvstore'], ['lb', 'lb'], ['api', 'app']],
          wires: ['u>ws', 'ws>g', 'g>kv', 'u>lb', 'lb>api', 'api>kv'],
        },
      },
      {
        title: 'Ordered message IDs',
        body: 'Messages must show in the order they were sent and never twice. Give each message an ID that is unique and grows with time (Snowflake, or a per-chat counter), and store messages by chat, sorted by ID.',
        solves: 'Ordering and de-duplication for free.',
        worsens: 'An ID service on the hot path.',
      },
      {
        title: 'Reconnect storms',
        body: 'When a chat server dies, every user on it reconnects. If they all retry at once, the survivors spend their CPU on handshakes instead of messages. Clients should back off with random jitter so reconnects arrive spread out.',
        visual: {
          kind: 'bars',
          caption: '40,000 users reconnect after a crash: handshakes per second hitting the survivors.',
          unit: '/s',
          rows: [
            { label: 'All at once', value: 20000, hue: 'red', note: 'plus their retries' },
            { label: 'Jittered backoff', value: 2000, hue: 'green', note: 'spread over 20 s' },
          ],
        },
        solves: 'A crash is a blip instead of an outage.',
        worsens: 'Some users wait a few extra seconds.',
      },
      {
        title: 'Presence',
        body: 'Clients send a heartbeat every few seconds; if heartbeats stop, the user is shown offline. Friends learn about changes through a pub/sub channel, which only scales for modest friend lists.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-12-q1',
        prompt: 'Which lets the server push a message to the client the moment it arrives?',
        options: [
          { id: 'ws', label: 'WebSocket', correct: true },
          { id: 'poll', label: 'Polling every 5 seconds', correct: false },
          { id: 'rest', label: 'A REST endpoint', correct: false },
        ],
        explain: 'A WebSocket stays open in both directions.',
      },
      {
        kind: 'pick',
        id: 'v1-12-q2',
        prompt: 'A chat server with 40,000 users crashes. What should their apps do?',
        options: [
          { id: 'jitter', label: 'Reconnect after a short random delay', correct: true },
          { id: 'now', label: 'Reconnect immediately, retrying until it works', correct: false },
          { id: 'wait', label: 'Wait for the same server to come back', correct: false },
        ],
        explain: 'Jitter spreads the reconnects so the survivors aren’t flattened.',
      },
      {
        kind: 'pick',
        id: 'v1-12-q3',
        prompt: 'Why are chat servers called stateful?',
        options: [
          { id: 'conn', label: 'Each user’s live connection lives on one specific server', correct: true },
          { id: 'db', label: 'They store message history', correct: false },
          { id: 'cache', label: 'They cache profiles', correct: false },
        ],
        explain: 'That is why a crash disconnects everyone on it.',
      },
    ],
  },
}
