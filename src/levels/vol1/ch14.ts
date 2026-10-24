import { chapter14 } from '../chapter14'
import type { ChapterEntry } from '../types'

export const v1ch14: ChapterEntry = {
  id: 'v1-14',
  volume: 1,
  number: 14,
  title: 'Design a video platform',
  topic: 'SDI Vol 1 · Design YouTube',
  play: { kind: 'interview', level: chapter14 },
  lesson: {
    summary: 'Video is bytes: push the watching to a CDN, the converting to a queue of workers, and keep every video safe for less than three copies.',
    cards: [
      {
        title: 'Two flows',
        body: 'Watching streams chunks from the nearest CDN edge; only misses reach our storage. Uploading stores the original, queues a transcode job, and workers write every format to transcoded storage.',
        diagram: {
          nodes: [['u', 'traffic'], ['cdn', 'cdn'], ['tr', 'blob'], ['lb', 'lb'], ['api', 'app'], ['orig', 'blob'], ['q', 'queue'], ['w', 'worker']],
          wires: ['u>cdn', 'cdn>tr', 'u>lb', 'lb>api', 'api>orig', 'orig>q', 'q>w', 'w>tr'],
        },
      },
      {
        title: 'Streaming is bandwidth',
        body: '20,000 two-megabyte chunks a second is 40 GB/s. A storage node moves about 1.25 GB/s. A CDN that answers 95% of chunks at the edge leaves our storage 2 GB/s.',
        visual: {
          kind: 'bars',
          caption: 'Bytes our own storage must send per second.',
          unit: 'GB/s',
          rows: [
            { label: 'No CDN', value: 40, hue: 'red', note: '32 nodes just for network' },
            { label: 'CDN, short TTL (70%)', value: 12, hue: 'orange' },
            { label: 'CDN, long TTL (95%)', value: 2, hue: 'green' },
          ],
        },
      },
      {
        title: 'Transcoding pipeline',
        body: 'Every upload is split into chunks, and each chunk is converted into several resolutions and codecs. That is slow, parallel work: queue the jobs and let a pool of workers drain them; add workers when uploads spike.',
        visual: {
          kind: 'steps',
          caption: 'From upload to playable.',
          steps: [
            { title: 'Upload', text: 'chunks land in original storage', hue: 'blue' },
            { title: 'Queue', text: 'one job per chunk', hue: 'yellow' },
            { title: 'Transcode', text: '1080p, 720p, 480p… in parallel', hue: 'orange' },
            { title: 'Publish', text: 'formats saved; the CDN fetches on demand', hue: 'green' },
          ],
        },
      },
      {
        title: 'Keeping video safe',
        body: 'Disks fail every day at this scale. One copy loses videos. Three copies are safe but triple the disk. Erasure coding stores data plus parity pieces: it survives several failures for about 1.5× the disk.',
        visual: {
          kind: 'bars',
          caption: 'Disk needed to store 300 TB safely.',
          unit: 'TB',
          rows: [
            { label: 'One copy (unsafe)', value: 300, hue: 'red' },
            { label: 'Erasure coding', value: 450, hue: 'green' },
            { label: 'Three copies', value: 900, hue: 'orange' },
          ],
        },
      },
      {
        title: 'Saving cost',
        body: 'Most views go to a few popular videos. Serve those from the CDN and the long tail from our own servers; encode rarely watched videos on demand; keep regional content in its region.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-14-q1',
        prompt: '20,000 chunks of 2 MB a second, 95% served by the CDN. What does our storage send?',
        options: [
          { id: '2', label: 'About 2 GB/s', correct: true },
          { id: '40', label: 'About 40 GB/s', correct: false },
          { id: '0', label: 'Nothing', correct: false },
        ],
        explain: '5% of 40 GB/s is 2 GB/s: the misses.',
      },
      {
        kind: 'pick',
        id: 'v1-14-q2',
        prompt: 'Which keeps videos safe for the least disk?',
        options: [
          { id: 'ec', label: 'Erasure coding', correct: true },
          { id: 'rep', label: 'Three copies', correct: false },
          { id: 'one', label: 'One copy', correct: false },
        ],
        explain: 'Parity pieces give the same protection as copies for about half the space.',
      },
      {
        kind: 'pick',
        id: 'v1-14-q3',
        prompt: 'Uploads double during a festival. What has to grow?',
        options: [
          { id: 'workers', label: 'The transcoding workers', correct: true },
          { id: 'cdn', label: 'The CDN', correct: false },
          { id: 'lb', label: 'The load balancer', correct: false },
        ],
        explain: 'Transcoding is the heavy, per-upload work; the queue absorbs bursts while workers catch up.',
      },
    ],
  },
}
