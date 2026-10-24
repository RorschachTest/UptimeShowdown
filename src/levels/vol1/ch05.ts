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
        body: 'When the data players read all day is bigger than one machine’s memory, or one machine can’t take the traffic, you split it across several cache nodes. Each node holds a slice of the keys. The hard part is not the split itself but agreeing, on every game server, which node holds which key, and keeping that agreement stable when nodes come and go.',
        visual: { kind: 'bars', caption: 'The hot data is bigger than the biggest cache box, so it has to be split across several.', unit: 'GB', rows: [{ label: 'Hot profiles', value: 120, hue: 'red', note: 'what players read all day' }, { label: 'One L cache node', value: 64, hue: 'teal', note: 'the biggest box we can buy' }, { label: 'Nine S nodes', value: 144, hue: 'green', note: 'enough together, with room to lose one' }] },
        solves: 'More memory and throughput than any single box.',
        worsens: 'Clients need a rule for finding the right node.',
        diagram: { nodes: [['u', 'traffic'], ['c', 'cache'], ['db', 'sqldb']], wires: ['u>c', 'c>db'] },
      },
      {
        title: 'Key mod N breaks on change',
        body: 'The obvious rule is node = hash(key) mod N. It spreads keys evenly, but when N changes almost every key maps to a different node. Every one of those reads misses at once and lands on the database: a cache stampede.',
        visual: { kind: 'steps', caption: 'The same key lands on a different node as soon as N changes. With mod N that happens to almost every key.', steps: [{ title: 'Hash the key', text: 'hash(player_42) = 1,234', hue: 'blue' }, { title: '4 nodes', text: '1,234 mod 4 = 2 → node 2', hue: 'teal' }, { title: 'Add a 5th', text: '1,234 mod 5 = 4 → node 4', hue: 'orange' }, { title: 'Miss!', text: 'Node 4 has never seen this key: read it from the database', hue: 'red' }] },
        solves: 'Trivial to write and perfectly even.',
        worsens: 'Adding or losing one node moves nearly all keys.',
      },
      {
        title: 'The hash ring',
        body: 'Picture the whole hash range bent into a circle. Hash each cache node to a point on it, and hash each key too. A key belongs to the first node you meet walking clockwise. When a node joins, it only takes the keys between it and the node before it; when one leaves, only its keys move to the next node. Try it: compare key mod N with the ring below.',
        visual: { kind: 'ringLab' },
        solves: 'Changing the cluster moves only about 1/N of the keys.',
        worsens: 'With few nodes the arcs are uneven: one node can own far more than its share.',
      },
      {
        title: 'Virtual nodes',
        body: 'Give every real node many points on the ring (virtual nodes). The arcs average out, so each node owns close to an even share, and a departing node’s keys spread over many neighbours instead of one.',
        visual: { kind: 'bars', caption: 'Share of keys on the busiest of 4 nodes. Fair is 25%. One random point per node leaves big gaps; many points per node even it out.', unit: '%', rows: [{ label: 'Plain ring', value: 57, hue: 'orange', note: 'one point per node: arcs are uneven' }, { label: 'Ring + vnodes', value: 27, hue: 'green', note: 'about 100 points per node' }, { label: 'Fair share', value: 25, hue: 'grey' }] },
        solves: 'Even shares, and the load of a lost node is spread out.',
        worsens: 'A bigger ring table that every client keeps.',
      },
      {
        title: 'Leave room to lose a node',
        body: 'When a node dies its keys go to the others. Size the cluster so the survivors still hold the hot data, and the database can absorb one node’s worth of misses while they warm up.',
        visual: { kind: 'steps', caption: 'Plan for N + 1: the cluster minus its biggest node must still hold the hot data.', steps: [{ title: 'Size it', text: '9 × 16 GB = 144 GB for 120 GB of hot data', hue: 'blue' }, { title: 'A node dies', text: '8 × 16 GB = 128 GB: still fits', hue: 'orange' }, { title: 'Its keys miss', text: 'About 1/9 of reads go to the database while they reload', hue: 'yellow' }, { title: 'Warm again', text: 'In seconds the survivors hold everything', hue: 'green' }] },
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
