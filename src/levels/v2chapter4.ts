import type { InterviewLevel, Stage } from '../engine/types'

const goals = { uptime: 0.99, p95Ms: 50, maxStaleRate: 0.001, maxLagMs: 10_000, maxViolations: { lostMessages: 0 } }

const main: Stage = {
  id: 'mq-main',
  title: 'A busy afternoon',
  story: 'Producers write 100,000 order events a second. A broker dies at 0:20 for 10 seconds, and a consumer crashes at 0:40.',
  durationS: 60,
  traffic: [{ t: 0, rps: 80000 }, { t: 10, rps: 100000 }],
  mix: { write: 1 },
  unlocks: { kinds: ['broker', 'worker'], settings: [] },
  events: [
    { t: 20, kind: 'crash', target: 'broker', durationS: 10 },
    { t: 40, kind: 'crash', target: 'worker', durationS: 10 },
  ],
  budget: 260,
  referenceCost: 190,
  goals,
}

const curveball: Stage = {
  id: 'mq-sale',
  title: 'Flash sale',
  story: 'Twice the events: 200,000 a second, with the same broker and consumer failures.',
  durationS: 60,
  traffic: [{ t: 0, rps: 150000 }, { t: 10, rps: 200000 }],
  mix: { write: 1 },
  unlocks: { kinds: [], settings: [] },
  events: [
    { t: 20, kind: 'crash', target: 'broker', durationS: 10 },
    { t: 40, kind: 'crash', target: 'worker', durationS: 10 },
  ],
  budget: 500,
  referenceCost: 370,
  goals,
}

/** Volume 2 Chapter 4, inspired by SDI Vol 2 "Distributed message queue". Scenario and numbers are ours. */
export const v2chapter4: InterviewLevel = {
  id: 'message-queue',
  title: 'Design a message queue',
  prompt: 'Design a distributed message queue like Kafka: producers write events, consumer groups read them, and nothing is lost when machines fail.',
  questionBudget: 5,
  editBudget: 2,
  curveball: {
    title: 'Flash sale',
    story: 'Twice the events, the same failures. You may change at most 2 pieces.',
  },
  questions: [
    { id: 'scale', text: 'How many messages per second?', leverage: 'high', reveals: ['scale'], short: '100,000 events/s', answer: 'About 100,000 order events a second at peak.' },
    { id: 'loss', text: 'Can we ever lose a message?', leverage: 'high', reveals: ['failures'], short: 'never; brokers and consumers crash', answer: 'Never: these are orders. Brokers and consumers both crash from time to time.' },
    { id: 'dupes', text: 'Can a consumer see a message twice?', leverage: 'high', reveals: ['conflicts'], short: 'yes, consumers are idempotent', answer: 'Yes, our consumers are idempotent. Losing one is the problem, not repeating one.' },
    { id: 'latency', text: 'How fast must producers get an ack?', leverage: 'high', reveals: ['latency'], short: 'p95 ≤ 50 ms', answer: 'Under 50 ms at p95.' },
    { id: 'lag', text: 'How far may consumers fall behind?', leverage: 'high', reveals: ['freshness'], short: '≤ 10 s', answer: 'No more than about 10 seconds.' },
    { id: 'growth', text: 'Any peaks?', leverage: 'high', reveals: ['growth'], short: 'sales: 2×', answer: 'Flash sales double the traffic.' },
    { id: 'retention', text: 'How long do we keep messages?', leverage: 'low', reveals: [], answer: 'Two weeks.' },
    { id: 'size', text: 'How big is a message?', leverage: 'low', reveals: [], answer: 'About 1 KB.' },
    { id: 'rabbit', text: 'Why not RabbitMQ?', leverage: 'trap', reveals: [], answer: 'Design ours; tell me what you’d need from any queue.' },
    { id: 'exactly', text: 'Can we guarantee exactly-once everywhere?', leverage: 'trap', reveals: [], answer: 'Not end to end without idempotent consumers. What do you actually need?' },
  ],
  features: [
    { id: 'produce', text: 'Producers write messages', core: true },
    { id: 'consume', text: 'Consumer groups read them', core: true },
    { id: 'durable', text: 'Never lose a message', core: true },
    { id: 'order', text: 'Order within a partition', core: true },
    { id: 'delay', text: 'Delayed messages', core: false },
    { id: 'schedule', text: 'Scheduled messages', core: false },
    { id: 'filter', text: 'Server-side filtering', core: false },
  ],
  wrapUp: [
    {
      id: 'acks',
      prompt: 'Which producer setting guarantees an acknowledged message survives a broker crash?',
      options: [
        { id: 'all', text: 'acks=all with replication factor 3', correct: true },
        { id: 'one', text: 'acks=1 with replication factor 3', correct: false },
        { id: 'zero', text: 'acks=0 with replication factor 3', correct: false },
        { id: 'rf1', text: 'acks=all with replication factor 1', correct: false },
      ],
      explain: 'acks=all waits until every in-sync replica has the message, so losing the leader loses nothing. acks=1 can lose the tail the followers hadn’t copied yet; with one replica, there is nothing to fail over to.',
    },
  ],
  brief: {
    points: [
      'Producers (the order services) write events to a topic split into partitions.',
      'Brokers store each partition as an append-only log, replicated across brokers.',
      'A consumer group of workers reads the partitions and commits how far it got (its offset).',
    ],
    diagram: { nodes: [['u', 'traffic'], ['b', 'broker'], ['w', 'worker']], wires: ['u>b', 'b>w'] },
  },
  chapter: {
    id: 'message-queue',
    title: 'Design a message queue',
    seed: 104,
    violationLabels: { lostMessages: 'messages were lost', processedTwice: 'messages were processed twice' },
    rules: {
      requires: [{ kind: 'broker', why: 'This chapter is about the brokers themselves.' }],
    },
    names: [
      { kind: 'traffic', name: 'Producers' },
      { kind: 'broker', name: 'Broker cluster' },
      { kind: 'worker', name: 'Consumer group' },
    ],
    data: { broker: ['topic → partitions → append-only log'], worker: ['group → committed offsets'] },
    requestTypes: [
      { id: 'write', label: 'Event', api: 'produce(topic, key, value)', does: { enqueue: 'append to the partition log', work: 'consume and process' }, needs: ['enqueue', 'work'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue', workCost: 0.05 },
    ],
    stages: [main, curveball],
  },
}
