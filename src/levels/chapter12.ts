import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 200, maxStaleRate: 0.001, maxViolations: { duplicateId: 0, unordered: 0, tooLong: 0 } }

const main: Stage = {
  id: 'chat-main',
  title: 'An evening of chat',
  story: '400,000 people online, sending 5,000 messages a second and loading 2,000 conversation histories. A WebSocket server crashes at 0:25.',
  durationS: 60,
  traffic: [{ t: 0, rps: 5000 }, { t: 10, rps: 7000 }],
  mix: { write: 5 / 7, page: 2 / 7 },
  connections: 400_000,
  unlocks: { kinds: ['wsgateway', 'idgen', 'kvstore', 'lb', 'app'], settings: ['tier'] },
  events: [{ t: 25, kind: 'crash', target: 'wsgateway', durationS: 20 }],
  budget: 440,
  referenceCost: 330,
  goals,
}

const curveball: Stage = {
  id: 'chat-newyear',
  title: 'Midnight on New Year’s Eve',
  story: 'Everyone is online and wishing everyone a happy new year: 800,000 connections and 15,000 messages a second. A server still crashes at 0:25.',
  durationS: 60,
  traffic: [{ t: 0, rps: 9000 }, { t: 10, rps: 17000 }],
  mix: { write: 15 / 17, page: 2 / 17 },
  connections: 800_000,
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 25, kind: 'crash', target: 'wsgateway', durationS: 20 }],
  budget: 840,
  referenceCost: 630,
  goals,
}

/** Chapter 12, inspired by SDI Vol 1 "Design a chat system". Scenario and numbers are ours. */
export const chapter12: InterviewLevel = {
  id: 'chat',
  title: 'Design a chat system',
  prompt: 'Design a chat app for one-to-one and small group chats: messages arrive instantly, history is kept forever.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'Midnight on New Year’s Eve',
    story: 'Twice the people online and three times the messages. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many people are online at once?', leverage: 'high', reveals: ['scale', 'mix'], short: '400,000 online; 5,000 msgs/s', answer: 'About 400,000 at peak. Together they send 5,000 messages and load 2,000 histories a second.' },
    { id: 'realtime', text: 'How fast must a message arrive?', leverage: 'high', reveals: ['latency'], short: 'instantly; p95 ≤ 200 ms', answer: 'It should feel instant: under 200 ms at p95.' },
    { id: 'order', text: 'Must messages stay in order?', leverage: 'high', reveals: ['ordering'], short: 'yes: sortable unique IDs', answer: 'Yes. Within a chat they must appear in the order they were sent, and never twice.' },
    { id: 'failures', text: 'What if a chat server dies?', leverage: 'high', reveals: ['failures'], short: 'its users reconnect elsewhere', answer: 'All the people connected to it drop and reconnect to the other servers.' },
    { id: 'history', text: 'How long do we keep messages?', leverage: 'high', reveals: ['data'], short: 'forever', answer: 'Forever. People scroll back years.' },
    { id: 'growth', text: 'Any big peaks?', leverage: 'high', reveals: ['growth'], short: 'New Year: 2× online, 3× messages', answer: 'New Year’s Eve: twice as many online, three times the messages.' },
    { id: 'media', text: 'Can people send photos?', leverage: 'low', reveals: [], answer: 'Later. Text only for now.' },
    { id: 'e2e', text: 'Do we need end-to-end encryption?', leverage: 'low', reveals: [], answer: 'Not in this version.' },
    { id: 'xmpp', text: 'Should we use XMPP?', leverage: 'trap', reveals: [], answer: 'Protocol choice comes later. How do messages reach someone instantly?' },
    { id: 'poll', text: 'Can the app just poll every second?', leverage: 'trap', reveals: [], answer: '400,000 polls a second, almost all empty? No.' },
  ],
  features: [
    { id: 'send', text: 'Send and receive messages instantly', core: true },
    { id: 'history', text: 'Keep and load chat history', core: true },
    { id: 'order', text: 'Messages in order, never duplicated', core: true },
    { id: 'groups', text: 'Small group chats', core: true },
    { id: 'presence', text: 'Online indicators', core: false },
    { id: 'media', text: 'Photos and video', core: false },
    { id: 'push', text: 'Push notifications when offline', core: false },
  ],
  wrapUp: [
    {
      id: 'ws',
      prompt: 'Why WebSockets for sending and receiving messages?',
      options: [
        { id: 'both', text: 'One long-lived connection lets the server push messages the moment they arrive', correct: true },
        { id: 'cheap', text: 'They need no servers', correct: false },
        { id: 'store', text: 'They store history', correct: false },
        { id: 'http', text: 'They are faster than any HTTP request', correct: false },
      ],
      explain: 'Polling wastes requests and adds delay; long polling holds requests open awkwardly. A WebSocket stays open both ways, so the server pushes messages instantly. The price is state: each connection lives on one server.',
    },
  ],
  brief: {
    points: [
      'A chat app: people keep a WebSocket open while the app is running; messages go over it in both directions.',
      'Every message gets a unique, time-ordered ID and is stored forever in a message store.',
      'Opening a conversation loads its history over plain HTTP.',
    ],
    diagram: {
      nodes: [['u', 'traffic'], ['ws', 'wsgateway'], ['g', 'idgen'], ['kv', 'kvstore'], ['lb', 'lb'], ['api', 'app']],
      wires: ['u>ws', 'ws>g', 'g>kv', 'u>lb', 'lb>api', 'api>kv'],
    },
  },
  chapter: {
    id: 'chat',
    title: 'Design a chat system',
    seed: 12,
    violationLabels: { duplicateId: 'messages got duplicate IDs', unordered: 'messages out of order', tooLong: 'message IDs too long' },
    rules: {
      requires: [{ kind: 'wsgateway', why: 'Messages must be pushed instantly: people need a live WebSocket connection.' }],
    },
    names: [
      { kind: 'traffic', name: 'Chat apps' },
      { kind: 'wsgateway', name: 'Chat servers' },
      { kind: 'idgen', name: 'Message IDs' },
      { kind: 'kvstore', name: 'Message store' },
      { kind: 'lb', name: 'Load balancer' },
      { kind: 'app', name: 'History API' },
    ],
    data: { kvstore: ['channelId → messages by ID'], wsgateway: ['userId → open socket'] },
    requestTypes: [
      { id: 'write', label: 'Message', api: 'ws: send(msg)', does: { push: 'receive and push to recipients', id: 'next message ID', write: 'store the message' }, needs: ['push', 'id', 'write'], weight: 1, consistency: 'any', distanceMs: 0 },
      { id: 'page', label: 'Load history', api: 'GET /chats/{id}/messages', does: { compute: 'page through the chat', lookup: 'read messages by ID' }, needs: ['compute', 'lookup'], weight: 1, consistency: 'any', distanceMs: 0 },
    ],
    stages: [main, curveball],
  },
}
