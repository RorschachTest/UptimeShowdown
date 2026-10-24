import { chapter5 } from '../chapter5'
import type { ChapterEntry } from '../types'

export const v1ch05: ChapterEntry = {
  id: 'v1-05',
  volume: 1,
  number: 5,
  title: 'Design consistent hashing',
  topic: 'SDI Vol 1 · Design consistent hashing',
  play: { kind: 'interview', level: chapter5 },
  lesson: {
    summary: 'Spread keys across a changing set of servers so that adding or losing one moves as few keys as possible.',
    cards: [
      {
        title: 'Why split the data',
        body: 'When the hot data is bigger than one machine’s memory, or one machine can’t take the traffic, you split it across several nodes. Every client must agree which node holds each key.',
        solves: 'More memory and throughput than any single box.',
        worsens: 'Clients need a rule for finding the right node.',
        diagram: { nodes: [['u', 'traffic'], ['c', 'cache'], ['db', 'sqldb']], wires: ['u>c', 'c>db'] },
      },
      {
        title: 'Key mod N breaks on change',
        body: 'The obvious rule is node = hash(key) mod N. It spreads keys evenly, but when N changes almost every key maps to a different node. Every one of those reads misses at once and lands on the database: a cache stampede.',
        solves: 'Trivial to write and perfectly even.',
        worsens: 'Adding or losing one node moves nearly all keys.',
      },
      {
        title: 'The hash ring',
        body: 'Hash both nodes and keys onto the same circle. A key belongs to the first node clockwise from it. When a node joins or leaves, only the keys on its arc move, about 1/N of them.',
        solves: 'Changing the cluster moves only about 1/N of the keys.',
        worsens: 'With few nodes the arcs are uneven: one node can own far more than its share.',
      },
      {
        title: 'Virtual nodes',
        body: 'Give every real node many points on the ring (virtual nodes). The arcs average out, so each node owns close to an even share, and a departing node’s keys spread over many neighbours instead of one.',
        solves: 'Even shares, and the load of a lost node is spread out.',
        worsens: 'A bigger ring table that every client keeps.',
      },
      {
        title: 'Leave room to lose a node',
        body: 'When a node dies its keys go to the others. Size the cluster so the survivors still hold the hot data, and the database can absorb one node’s worth of misses while they warm up.',
        solves: 'A lost node is a blip, not an outage.',
        worsens: 'You pay for spare capacity you hope not to use.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-05-q1',
        prompt: 'A cache uses node = hash(key) mod 4. A fifth node is added. Roughly what share of keys move?',
        options: [
          { id: 'most', label: 'About 80%', correct: true },
          { id: 'fifth', label: 'About 20%', correct: false },
          { id: 'none', label: 'None', correct: false },
        ],
        explain: 'A key stays only if hash mod 4 equals hash mod 5, which is about 1 in 5. The rest move.',
      },
      {
        kind: 'pick',
        id: 'v1-05-q2',
        prompt: 'On a hash ring of 8 nodes, one node dies. Which keys move?',
        options: [
          { id: 'its', label: 'Only the keys it owned, to the next node clockwise', correct: true },
          { id: 'all', label: 'Every key is rehashed', correct: false },
          { id: 'half', label: 'Half of every node’s keys', correct: false },
        ],
        explain: 'Each key belongs to the first node clockwise. Only keys on the dead node’s arc get a new owner.',
      },
      {
        kind: 'pick',
        id: 'v1-05-q3',
        prompt: 'Why add virtual nodes?',
        options: [
          { id: 'even', label: 'To even out how many keys each node owns', correct: true },
          { id: 'copies', label: 'To keep two copies of every key', correct: false },
          { id: 'fast', label: 'To make each lookup faster', correct: false },
        ],
        explain: 'Many points per node average out the arc lengths. Copies are replication, a separate choice.',
      },
      {
        kind: 'pick',
        id: 'v1-05-q4',
        prompt: '120 GB of hot data, 16 GB cache nodes, and the cluster must still hold it all after losing one node. How many nodes?',
        options: [
          { id: '8', label: '8', correct: false },
          { id: '9', label: '9', correct: true },
          { id: '15', label: '15', correct: false },
        ],
        explain: '8 nodes hold 128 GB, but after a loss only 112. With 9, the 8 survivors still hold 128 GB.',
      },
    ],
  },
}
