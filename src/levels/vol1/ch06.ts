import { chapter6 } from '../chapter6'
import type { ChapterEntry } from '../types'

export const v1ch06: ChapterEntry = {
  id: 'v1-06',
  volume: 1,
  number: 6,
  title: 'Design a key-value store',
  topic: 'SDI Vol 1 · Design a key-value store',
  play: { kind: 'interview', level: chapter6 },
  lesson: {
    summary: 'Spread keys over many nodes, keep several copies, and choose how many must answer.',
    cards: [
      {
        title: 'Partition and replicate',
        body: 'Keys are spread over nodes with consistent hashing. Each key is copied to the next N nodes on the ring, so losing one node doesn’t lose data.',
        solves: 'Grows by adding nodes; copies survive failures.',
        worsens: 'Copies can disagree, and every write is done N times.',
        diagram: { nodes: [['u', 'traffic'], ['kv', 'kvstore']], wires: ['u>kv'] },
      },
      {
        title: 'CAP: pick during a split',
        body: 'When the network splits, a store must either refuse some requests to stay consistent (CP) or keep answering and reconcile later (AP). A shopping cart picks availability: never refuse an add.',
        solves: 'A clear rule for what breaks when the network does.',
        worsens: 'You can’t have both perfect consistency and full availability during a partition.',
      },
      {
        title: 'Quorums: N, W, R',
        body: 'A write waits for W of the N copies, a read for R. When R + W > N, every read overlaps the latest write. W = R = 2 with N = 3 also keeps working if one copy is unreachable.',
        solves: 'Tune consistency, latency and availability per use case.',
        worsens: 'Waiting for more copies is slower; waiting for all fails when any one is down.',
      },
      {
        title: 'Conflicts and vector clocks',
        body: 'Two writes to the same key at once can both succeed on different copies. Last-write-wins keeps one and drops the other. Vector clocks detect the conflict and hand both versions to the app to merge (for a cart: keep both items).',
        solves: 'No silently lost writes.',
        worsens: 'Bigger values and a merge step in the app.',
      },
      {
        title: 'Healing',
        body: 'Hinted handoff lets a neighbour hold writes for a node that is briefly down. Anti-entropy with Merkle trees compares copies cheaply and repairs what drifted. Gossip spreads who is alive.',
        solves: 'Copies converge again after failures.',
        worsens: 'More background traffic and moving parts.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-06-q1',
        prompt: 'N = 3. Which setting guarantees a read sees the latest successful write?',
        options: [
          { id: 'w2r2', label: 'W = 2, R = 2', correct: true },
          { id: 'w1r1', label: 'W = 1, R = 1', correct: false },
          { id: 'w1r2', label: 'W = 1, R = 2', correct: false },
        ],
        explain: 'R + W must be more than N so the read and write sets share at least one copy.',
      },
      {
        kind: 'pick',
        id: 'v1-06-q2',
        prompt: 'N = 3, W = 3. One copy’s node is cut off. What happens to writes for its keys?',
        options: [
          { id: 'fail', label: 'They fail until it comes back', correct: true },
          { id: 'ok', label: 'They succeed on the other two', correct: false },
          { id: 'slow', label: 'They succeed, just slower', correct: false },
        ],
        explain: 'Waiting for all three means one unreachable copy blocks the write. W = 2 would succeed.',
      },
      {
        kind: 'pick',
        id: 'v1-06-q3',
        prompt: 'A phone and a laptop add different items to the same cart at the same moment. Which keeps both?',
        options: [
          { id: 'vc', label: 'Vector clocks + merge in the app', correct: true },
          { id: 'lww', label: 'Last write wins', correct: false },
          { id: 'quorum', label: 'A bigger write quorum', correct: false },
        ],
        explain: 'Quorums don’t order concurrent writes. Vector clocks notice they’re concurrent so the app can merge them.',
      },
      {
        kind: 'pick',
        id: 'v1-06-q4',
        prompt: 'How many copies do you need for quorum reads and writes to survive two nodes failing at once?',
        options: [
          { id: '5', label: 'N = 5 (quorum 3)', correct: true },
          { id: '3', label: 'N = 3 (quorum 2)', correct: false },
          { id: '4', label: 'N = 4 (quorum 3)', correct: false },
        ],
        explain: 'A quorum of 3 out of 5 still has 3 copies left after losing 2. With N = 3, losing 2 leaves only 1.',
      },
    ],
  },
}
