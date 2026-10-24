import { chapter7 } from '../chapter7'
import type { ChapterEntry } from '../types'

export const v1ch07: ChapterEntry = {
  id: 'v1-07',
  volume: 1,
  number: 7,
  title: 'Design a unique ID generator',
  topic: 'SDI Vol 1 · Design a unique ID generator in distributed systems',
  play: { kind: 'interview', level: chapter7 },
  lesson: {
    summary: 'Hand out unique, sortable 64-bit IDs from many machines without a central bottleneck.',
    cards: [
      {
        title: 'Why not the database counter',
        body: 'One auto-increment counter (a ticket server) is unique and in order, but it’s one machine: it caps throughput and takes every checkout down when it dies. Run two and both count from 1.',
        solves: 'Simple, unique, ordered, 64-bit.',
        worsens: 'A single point of failure and a throughput ceiling.',
        diagram: { nodes: [['u', 'traffic'], ['g', 'idgen']], wires: ['u>g'] },
      },
      {
        title: 'Multi-master, step k',
        body: 'k database servers each increment by k from a different start (1, 3, 5… and 2, 4, 6…). Throughput scales, but IDs from different servers interleave out of time order, and adding a server changes k for everyone.',
        solves: 'More throughput, still 64-bit and unique.',
        worsens: 'Not sortable by time; resizing is painful.',
      },
      {
        title: 'UUIDs',
        body: 'Any machine can generate a 128-bit random UUID with no coordination; collisions are vanishingly unlikely.',
        solves: 'No coordination, scales freely.',
        worsens: '128 bits, not numeric, not sortable by time.',
      },
      {
        title: 'Snowflake',
        body: 'Pack a 64-bit number: 1 sign bit, 41 bits of milliseconds since a custom epoch, 10 bits of machine ID, 12 bits of sequence within the millisecond. Each machine generates on its own; IDs sort by time.',
        solves: 'Unique, 64-bit, time-sortable, no coordination, 4,096 IDs/ms per machine.',
        worsens: 'Depends on clocks and on unique machine IDs.',
      },
      {
        title: 'Clocks go wrong',
        body: 'NTP can step a clock backwards. A Snowflake server that keeps issuing would reuse old timestamps and could repeat IDs. Remember the last timestamp and wait until the clock passes it.',
        solves: 'No duplicates even when clocks jump back.',
        worsens: 'A brief stall during the jump.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-07-q1',
        prompt: 'IDs must be 64-bit numbers sortable by time, from many servers. Which scheme fits?',
        options: [
          { id: 'snow', label: 'Snowflake', correct: true },
          { id: 'uuid', label: 'UUID', correct: false },
          { id: 'mm', label: 'Multi-master with step k', correct: false },
        ],
        explain: 'UUIDs are 128-bit and unordered; multi-master isn’t time-ordered across servers.',
      },
      {
        kind: 'pick',
        id: 'v1-07-q2',
        prompt: 'With a 12-bit sequence, how many IDs can one Snowflake machine issue per millisecond?',
        options: [
          { id: '4096', label: '4,096', correct: true },
          { id: '1024', label: '1,024', correct: false },
          { id: '12', label: '12', correct: false },
        ],
        explain: '2^12 = 4,096. The 10-bit machine ID is what allows 1,024 machines.',
      },
      {
        kind: 'pick',
        id: 'v1-07-q3',
        prompt: 'A Snowflake server’s clock jumps back 5 ms. What should it do?',
        options: [
          { id: 'wait', label: 'Wait until the clock passes the last timestamp it used', correct: true },
          { id: 'go', label: 'Keep issuing with the new time', correct: false },
          { id: 'reset', label: 'Reset the sequence to 0 and keep going', correct: false },
        ],
        explain: 'Issuing with an old timestamp can repeat an ID it already gave out.',
      },
    ],
  },
}
