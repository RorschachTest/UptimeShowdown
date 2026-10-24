import type { ChapterEntry } from '../types'
import { v2chapter2 } from '../v2chapter2'

export const v2ch02: ChapterEntry = {
  id: 'v2-02',
  volume: 2,
  number: 2,
  title: 'Design nearby friends',
  topic: 'SDI Vol 2 · Nearby friends',
  play: { kind: 'interview', level: v2chapter2 },
  lesson: {
    summary: 'Push each friend’s moving position to the right people in real time, with a pub/sub channel per user.',
    cards: [
      {
        title: 'Why not the Yelp design',
        body: 'Places sit still, so an index of locations works. Friends move every 30 seconds and only matter to their own friends, so the problem is fan-out: delivering each update to the few dozen people who care.',
        visual: {
          kind: 'versus',
          caption: 'Same map, different problem.',
          sides: [
            { title: 'Nearby places', hue: 'teal', good: ['Static data', 'Index once, read many times'], bad: [] },
            { title: 'Nearby friends', hue: 'orange', good: ['Only your friends care about you'], bad: ['Positions change constantly', 'Every update must be pushed'] },
          ],
        },
      },
      {
        title: 'Channel per user',
        body: 'Each user has a pub/sub channel. When you go online, your WebSocket server subscribes to all your online friends’ channels. When you move, it publishes to yours, and every subscribed friend’s server pushes the update to them.',
        visual: {
          kind: 'steps',
          caption: 'One update, delivered to ~40 friends.',
          steps: [
            { title: 'Phone', text: 'sends lat, lng every 30 s', hue: 'blue' },
            { title: 'WebSocket server', text: 'saves it to the cache and history', hue: 'teal' },
            { title: 'Publish', text: 'to the user’s channel', hue: 'yellow' },
            { title: 'Friends', text: '~40 servers push it on; each app checks the distance', hue: 'green' },
          ],
        },
      },
      {
        title: 'Fan-out is the load',
        body: 'Ten thousand updates a second with 40 subscribers each is 400,000 deliveries a second. Pub/sub capacity is counted in deliveries, not in publishes.',
        visual: {
          kind: 'bars',
          caption: 'Messages per second at peak.',
          unit: '/s',
          rows: [
            { label: 'Updates published', value: 10000, hue: 'blue' },
            { label: 'Copies delivered', value: 400000, hue: 'red', note: '40 online friends each' },
          ],
        },
      },
      {
        title: 'Resizing a stateful cluster',
        body: 'Subscribers are attached to channels on specific servers. Place channels with consistent hashing so adding a server moves only ~1/N of them; those subscribers resubscribe and miss a few seconds of updates. Resize off-peak when you can.',
        visual: { kind: 'ringLab' },
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-02-q1',
        prompt: '10,000 location updates a second, each with 40 subscribed friends. How many deliveries a second?',
        options: [
          { id: '400k', label: '400,000', correct: true },
          { id: '10k', label: '10,000', correct: false },
          { id: '40', label: '40', correct: false },
        ],
        explain: 'Every update is copied to every subscriber.',
      },
      {
        kind: 'pick',
        id: 'v2-02-q2',
        prompt: 'Who decides whether a friend is close enough to show?',
        options: [
          { id: 'sub', label: 'The subscriber’s side, after it receives the update', correct: true },
          { id: 'pub', label: 'The publisher, before sending', correct: false },
          { id: 'db', label: 'The database, with a nightly job', correct: false },
        ],
        explain: 'Each friend has a different position; the receiving side compares distances.',
      },
      {
        kind: 'pick',
        id: 'v2-02-q3',
        prompt: 'Why place channels on a hash ring?',
        options: [
          { id: 'move', label: 'Resizing moves only ~1/N of channels', correct: true },
          { id: 'fast', label: 'Publishing is faster', correct: false },
          { id: 'filter', label: 'It filters by distance', correct: false },
        ],
        explain: 'Fewer moved channels means fewer subscribers missing updates.',
      },
    ],
  },
}
