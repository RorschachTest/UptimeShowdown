import { chapter15 } from '../chapter15'
import type { ChapterEntry } from '../types'

export const v1ch15: ChapterEntry = {
  id: 'v1-15',
  volume: 1,
  number: 15,
  title: 'Design a file sync service',
  topic: 'SDI Vol 1 · Design Google Drive',
  play: { kind: 'interview', level: chapter15 },
  lesson: {
    summary: 'Move as few bytes as possible, keep every block safe, and never show a device an older version than you saved.',
    cards: [
      {
        title: 'Blocks and metadata',
        body: 'File contents are split into blocks that live in object storage. A metadata database records each file’s path, version and list of blocks. Syncing a folder only reads metadata; bytes move only when a block is new.',
        diagram: {
          nodes: [['u', 'traffic'], ['lb', 'lb'], ['bs', 'blocksrv'], ['blob', 'blob'], ['api', 'app'], ['db', 'sqldb']],
          wires: ['u>lb', 'lb>bs', 'bs>blob', 'lb>api', 'api>db'],
        },
      },
      {
        title: 'Delta sync',
        body: 'Hash every 4 MB block. When a file changes, upload only the blocks whose hash changed. Identical blocks across files and users are stored once.',
        visual: {
          kind: 'bars',
          caption: 'Bytes uploaded when you fix a typo in a 10 MB file.',
          unit: 'MB',
          rows: [
            { label: 'Whole file', value: 10, hue: 'red' },
            { label: 'Changed block', value: 1, hue: 'green', note: 'about a tenth' },
            { label: '+ compression', value: 0.6, hue: 'teal' },
          ],
        },
        solves: 'Far less bandwidth and storage I/O.',
        worsens: 'Block hashing and tracking.',
      },
      {
        title: 'Strong consistency for metadata',
        body: 'If your laptop lists a folder from a lagging replica or a stale cache, it can show the old version and even overwrite the new one. Read file versions from the primary (or invalidate caches on every write).',
        visual: {
          kind: 'steps',
          caption: 'A stale listing in action.',
          steps: [
            { title: 'Phone', text: 'saves report.docx v8', hue: 'blue' },
            { title: 'Replica', text: 'still says v7 (lag)', hue: 'yellow' },
            { title: 'Laptop', text: 'opens v7 and edits it', hue: 'red' },
            { title: 'Conflict', text: 'someone’s changes are lost', hue: 'red' },
          ],
        },
      },
      {
        title: 'Notifying other devices',
        body: 'Devices keep a long-polling connection to a notification service. When a file changes, the service answers the poll and the device pulls the new metadata and only the blocks it lacks.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-15-q1',
        prompt: 'You change one paragraph of a 10 MB document. What should be uploaded?',
        options: [
          { id: 'block', label: 'Only the changed block(s)', correct: true },
          { id: 'file', label: 'The whole file', correct: false },
          { id: 'none', label: 'Nothing until you close it', correct: false },
        ],
        explain: 'Delta sync compares block hashes and sends the new ones.',
      },
      {
        kind: 'pick',
        id: 'v1-15-q2',
        prompt: 'Why read file versions from the primary database?',
        options: [
          { id: 'fresh', label: 'A lagging replica could show an older version and cause lost edits', correct: true },
          { id: 'fast', label: 'The primary is faster', correct: false },
          { id: 'cheap', label: 'Replicas cost more', correct: false },
        ],
        explain: 'File sync needs strong consistency for metadata.',
      },
      {
        kind: 'pick',
        id: 'v1-15-q3',
        prompt: 'What does compression trade?',
        options: [
          { id: 'cpu', label: 'More CPU on the block servers for fewer bytes moved and stored', correct: true },
          { id: 'safe', label: 'Durability for speed', correct: false },
          { id: 'fresh', label: 'Freshness for cost', correct: false },
        ],
        explain: 'It shrinks blocks before they travel or land in storage.',
      },
    ],
  },
}
