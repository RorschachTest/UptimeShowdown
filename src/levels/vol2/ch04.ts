import type { ChapterEntry } from '../types'
import { v2chapter4 } from '../v2chapter4'

export const v2ch04: ChapterEntry = {
  id: 'v2-04',
  volume: 2,
  number: 4,
  title: 'Design a message queue',
  topic: 'SDI Vol 2 · Distributed message queue',
  play: { kind: 'interview', level: v2chapter4 },
  lesson: {
    summary: 'Partitioned, replicated logs: choose how long producers wait and when consumers commit, and you choose what can be lost or repeated.',
    cards: [
      {
        title: 'Topics, partitions, logs',
        body: 'A topic is split into partitions; each partition is an append-only log on a broker. Messages with the same key go to the same partition, so they stay in order. Consumers in a group split the partitions between them.',
        diagram: { nodes: [['u', 'traffic'], ['b', 'broker'], ['w', 'worker']], wires: ['u>b', 'b>w'] },
      },
      {
        title: 'Replication',
        body: 'Each partition has a leader and followers on other brokers. Followers copy the leader’s log; the ones that keep up are the in-sync replicas. If the leader dies, an in-sync follower takes over.',
        visual: {
          kind: 'steps',
          caption: 'One partition, replication factor 3.',
          steps: [
            { title: 'Producer', text: 'writes to the leader', hue: 'blue' },
            { title: 'Leader', text: 'appends to its log', hue: 'purple' },
            { title: 'Followers', text: 'copy the new entries', hue: 'teal' },
            { title: 'Leader dies', text: 'an in-sync follower takes over', hue: 'green' },
          ],
        },
      },
      {
        title: 'Producer acks',
        body: 'How long a producer waits decides what a crash can lose.',
        visual: {
          kind: 'versus',
          caption: 'acks=0, 1 and all.',
          sides: [
            { title: 'acks=0', hue: 'red', good: ['Fastest'], bad: ['Buffered messages vanish'] },
            { title: 'acks=1', hue: 'orange', good: ['Fast'], bad: ['The leader’s unreplicated tail can vanish'] },
            { title: 'acks=all', hue: 'green', good: ['Acknowledged = safe'], bad: ['Slower'] },
          ],
        },
      },
      {
        title: 'Delivery semantics',
        body: 'Consumers record their position (offset). Commit before processing and a crash skips messages (at-most-once). Commit after and a crash repeats them (at-least-once). Exactly-once needs at-least-once plus idempotent processing.',
        visual: {
          kind: 'versus',
          caption: 'When to commit the offset.',
          sides: [
            { title: 'Commit, then process', hue: 'red', good: ['Never twice'], bad: ['Crash = lost batch'] },
            { title: 'Process, then commit', hue: 'green', good: ['Never lost'], bad: ['Crash = batch repeated'] },
          ],
        },
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-04-q1',
        prompt: 'How do you keep all events for one order in order?',
        options: [
          { id: 'key', label: 'Use the order ID as the key, so they share a partition', correct: true },
          { id: 'one', label: 'Use a single partition for everything', correct: false },
          { id: 'time', label: 'Sort them on the consumer', correct: false },
        ],
        explain: 'Order is guaranteed within a partition; a key always maps to the same one.',
      },
      {
        kind: 'pick',
        id: 'v2-04-q2',
        prompt: 'A consumer crashes mid-batch and it committed after processing. What happens?',
        options: [
          { id: 'repeat', label: 'The batch is processed again by another consumer', correct: true },
          { id: 'lost', label: 'The batch is lost', correct: false },
          { id: 'stall', label: 'The partition stops for good', correct: false },
        ],
        explain: 'At-least-once: the uncommitted batch is re-read.',
      },
      {
        kind: 'pick',
        id: 'v2-04-q3',
        prompt: 'Which setting makes an acknowledged message survive its leader dying?',
        options: [
          { id: 'all', label: 'acks=all with replicas', correct: true },
          { id: 'one', label: 'acks=1', correct: false },
          { id: 'zero', label: 'acks=0', correct: false },
        ],
        explain: 'Every in-sync replica already has it.',
      },
    ],
  },
}
