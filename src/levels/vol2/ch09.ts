import type { ChapterEntry } from '../types'
import { v2chapter9 } from '../v2chapter9'

export const v2ch09: ChapterEntry = {
  id: 'v2-09',
  volume: 2,
  number: 9,
  title: 'Design object storage',
  topic: 'SDI Vol 2 · S3-like object storage',
  play: { kind: 'interview', level: v2chapter9 },
  lesson: {
    summary: 'Separate metadata from bytes, spread the bytes over many disks, and buy durability with parity instead of copies.',
    cards: [
      {
        title: 'Metadata and data',
        body: 'An object store is two systems. A metadata store maps bucket and key to where the object lives. Data nodes hold the bytes, written once and never changed. The API service ties them together.',
        diagram: {
          nodes: [['u', 'traffic'], ['lb', 'lb'], ['api', 'app'], ['meta', 'kvstore'], ['data', 'blob']],
          wires: ['u>lb', 'lb>api', 'api>meta', 'meta>data'],
        },
      },
      {
        title: 'Immutable objects',
        body: 'Objects are written once and replaced, never edited in place. That makes caching, replication and erasure coding simple: a piece never changes after it is written.',
        solves: 'Simple, safe storage at huge scale.',
        worsens: 'Small edits mean rewriting the object.',
      },
      {
        title: 'Copies or parity',
        body: 'Three copies survive two failures for 3× the disk. Erasure coding splits an object into 8 data pieces plus 4 parity pieces across 12 nodes: any 8 rebuild it, so it survives 4 failures for 1.5× the disk.',
        visual: {
          kind: 'bits',
          caption: 'One object, erasure-coded 8 + 4 across 12 nodes.',
          unit: 'piece',
          fields: [
            { label: 'data pieces', bits: 8, hue: 'blue', note: 'the object, split in 8' },
            { label: 'parity pieces', bits: 4, hue: 'orange', note: 'computed from the data; any 8 of 12 rebuild it' },
          ],
        },
      },
      {
        title: 'Disk is the bill',
        body: 'Storage only grows. Whatever overhead you choose, you pay it on every byte, forever, and it doubles as the data does.',
        visual: {
          kind: 'bars',
          caption: 'Disk needed for 1 PB of objects.',
          unit: 'PB',
          rows: [
            { label: 'One copy (unsafe)', value: 1, hue: 'red' },
            { label: 'Erasure 8 + 4', value: 1.5, hue: 'green' },
            { label: 'Three copies', value: 3, hue: 'orange' },
          ],
        },
      },
      {
        title: 'Big uploads',
        body: 'Multi-gigabyte objects are uploaded in parts (multipart upload): each part is sent and retried on its own, then the parts are stitched together. Small objects can be packed into larger files on disk to save space and metadata.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-09-q1',
        prompt: 'With erasure coding 8 + 4, how much disk does 1 PB need?',
        options: [
          { id: '1.5', label: '1.5 PB', correct: true },
          { id: '3', label: '3 PB', correct: false },
          { id: '1', label: '1 PB', correct: false },
        ],
        explain: '12 pieces for every 8 pieces of data: 1.5×.',
      },
      {
        kind: 'pick',
        id: 'v2-09-q2',
        prompt: 'Where does a GET first look?',
        options: [
          { id: 'meta', label: 'The metadata store, to find which nodes hold the pieces', correct: true },
          { id: 'all', label: 'Every data node', correct: false },
          { id: 'cdn', label: 'A CDN', correct: false },
        ],
        explain: 'Metadata maps bucket and key to the object’s placement.',
      },
      {
        kind: 'pick',
        id: 'v2-09-q3',
        prompt: 'Why are objects immutable?',
        options: [
          { id: 'simple', label: 'Pieces never change after writing, which keeps replication and parity simple', correct: true },
          { id: 'fast', label: 'Edits are too slow', correct: false },
          { id: 'cheap', label: 'Mutable objects cost more to read', correct: false },
        ],
        explain: 'Write once, read many is what makes the design scale.',
      },
    ],
  },
}
