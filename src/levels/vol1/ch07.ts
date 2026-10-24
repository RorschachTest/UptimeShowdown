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
        visual: { kind: 'bars', caption: 'One auto-increment counter is a single machine with a ceiling.', unit: 'IDs/s', rows: [{ label: 'Needed at peak', value: 12000, hue: 'red' }, { label: 'One ticket server', value: 1500, hue: 'orange', note: 'and it takes every checkout down when it dies' }] },
        solves: 'Simple, unique, ordered, 64-bit.',
        worsens: 'A single point of failure and a throughput ceiling.',
        diagram: { nodes: [['u', 'traffic'], ['g', 'idgen']], wires: ['u>g'] },
      },
      {
        title: 'Multi-master, step k',
        body: 'k database servers each increment by k from a different start (1, 3, 5… and 2, 4, 6…). Throughput scales, but IDs from different servers interleave out of time order, and adding a server changes k for everyone.',
        visual: { kind: 'steps', caption: 'Unique, but not in time order: server B’s 4 was created after server A’s 5.', steps: [{ title: 'Server A (k=2)', text: 'issues 1, 3, 5, 7…', hue: 'blue' }, { title: 'Server B (k=2)', text: 'issues 2, 4, 6, 8…', hue: 'orange' }, { title: 'Real order', text: '1, 3, 5, 2, 7, 4…', hue: 'red' }] },
        solves: 'More throughput, still 64-bit and unique.',
        worsens: 'Not sortable by time; resizing is painful.',
      },
      {
        title: 'UUIDs',
        body: 'Any machine can generate a 128-bit random UUID with no coordination; collisions are vanishingly unlikely.',
        visual: { kind: 'bits', caption: 'A random (version 4) UUID: 128 bits, twice what a BIGINT column holds.', fields: [{ label: 'random', bits: 122, hue: 'teal', note: 'chance of a collision is negligible' }, { label: 'version + variant', bits: 6, hue: 'grey', note: 'says “random UUID”' }] },
        solves: 'No coordination, scales freely.',
        worsens: '128 bits, not numeric, not sortable by time.',
      },
      {
        title: 'Snowflake',
        body: 'Instead of asking anyone for a number, each server builds its own 64-bit ID from three parts: the current millisecond, its own machine number and a counter for IDs made in that same millisecond. The timestamp comes first, so newer IDs are bigger and sort by time. Two servers can never collide because their machine numbers differ, and one server never repeats because the counter separates IDs within a millisecond.',
        visual: { kind: 'bits', caption: 'Twitter’s Snowflake layout: 64 bits that sort by creation time.', fields: [{ label: 'sign', bits: 1, hue: 'grey', note: 'always 0, so IDs stay positive' }, { label: 'timestamp', bits: 41, hue: 'blue', note: 'ms since a custom epoch: about 69 years' }, { label: 'machine ID', bits: 10, hue: 'purple', note: 'up to 1,024 generators, set at deploy time' }, { label: 'sequence', bits: 12, hue: 'orange', note: 'counts 0–4,095 within one millisecond' }] },
        solves: 'Unique, 64-bit, time-sortable, no coordination, 4,096 IDs/ms per machine.',
        worsens: 'Depends on clocks and on unique machine IDs.',
      },
      {
        title: 'Try the split',
        body: 'Those 63 usable bits are a budget. Every bit you give the timestamp doubles how long the scheme lasts; every bit for the machine doubles how many servers you can run; every bit for the sequence doubles IDs per millisecond. Move the sliders until all three needs are met.',
        visual: { kind: 'bitPacker' },
      },
      {
        title: 'Clocks go wrong',
        body: 'Servers keep time with NTP, which sometimes corrects a fast clock by stepping it backwards. A Snowflake server that trusts its clock would then reuse milliseconds it already used, restart the sequence at 0, and hand out IDs it has handed out before. The fix: remember the last millisecond used, and if the clock reads earlier, wait until it passes it.',
        visual: { kind: 'clockLab' },
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
