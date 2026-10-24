import { chapter9 } from '../chapter9'
import type { ChapterEntry } from '../types'

export const v1ch09: ChapterEntry = {
  id: 'v1-09',
  volume: 1,
  number: 9,
  title: 'Design a web crawler',
  topic: 'SDI Vol 1 · Design a web crawler',
  play: { kind: 'interview', level: chapter9 },
  lesson: {
    summary: 'Fetch the web fast without abusing it: a frontier decides what and when, downloaders do the fetching.',
    cards: [
      {
        title: 'The loop',
        body: 'Seed URLs go into the URL frontier. Downloaders fetch pages, parse them, skip content already seen, extract links, filter them and add new URLs back to the frontier.',
        visual: { kind: 'steps', caption: 'A crawler is a loop: every page it fetches feeds new URLs back into the frontier.', steps: [{ title: 'Frontier', text: 'pick the next URL', hue: 'yellow' }, { title: 'Download', text: 'resolve DNS, fetch HTML', hue: 'orange' }, { title: 'Seen?', text: 'skip content we already have', hue: 'purple' }, { title: 'Extract', text: 'pull out links, filter them', hue: 'blue' }, { title: 'Back', text: 'new URLs join the frontier', hue: 'green' }] },
        solves: 'A pipeline that keeps going on its own.',
        worsens: 'Every stage must cope with a messy, hostile web.',
        diagram: { nodes: [['u', 'traffic'], ['f', 'frontier'], ['d', 'downloader']], wires: ['u>f', 'f>d'] },
      },
      {
        title: 'Politeness',
        body: 'Sending many requests to one site at once looks like an attack and gets you blocked. Map each host to its own queue and let a downloader fetch from a host only after a pause.',
        visual: { kind: 'versus', caption: 'Same downloaders, different manners.', sides: [{ title: 'One big queue', hue: 'red', good: ['Maximum speed'], bad: ['Ten downloaders hit the same site at once', 'You get blocked'] }, { title: 'One queue per host', hue: 'green', good: ['Each site sees one request at a time, with a pause', 'Thousands of sites crawled in parallel'], bad: ['Downloaders sometimes wait'] }] },
        solves: 'Sites tolerate you; you don’t get banned.',
        worsens: 'Downloaders sometimes wait on a host.',
      },
      {
        title: 'Priority and freshness',
        body: 'Not all pages matter equally. Front queues order URLs by priority (PageRank, traffic, update rate); back queues enforce politeness. Re-crawl pages that change often more often.',
        solves: 'Important and fast-changing pages stay fresh.',
        worsens: 'More moving parts in the frontier.',
      },
      {
        title: 'Robustness',
        body: 'Cache DNS answers: lookups are slow and the resolver has outages. Respect robots.txt. Limit URL depth and length to escape spider traps. Hash content to skip duplicate pages.',
        visual: { kind: 'bars', caption: 'Pages per second per downloader.', unit: 'pages/s', rows: [{ label: 'DNS cache', value: 500, hue: 'green' }, { label: 'No DNS cache', value: 250, hue: 'orange', note: 'every fetch waits on a lookup, and a DNS outage stops the crawl' }] },
        solves: 'Speed, good manners and less wasted work.',
        worsens: 'Each check is a little extra work per page.',
      },
      {
        title: 'Scale out',
        body: 'Run many downloaders in parallel, close to the hosts they crawl, and keep most of the frontier on disk with in-memory buffers for the head and tail.',
        solves: 'Billions of pages a month.',
        worsens: 'Coordination and storage costs.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-09-q1',
        prompt: 'What keeps a crawler from overloading one website?',
        options: [
          { id: 'perhost', label: 'One queue per host, with a delay between fetches to it', correct: true },
          { id: 'dns', label: 'A DNS cache', correct: false },
          { id: 'hash', label: 'Content hashing', correct: false },
        ],
        explain: 'Per-host queues mean only one downloader fetches from a site at a time, with pauses.',
      },
      {
        kind: 'pick',
        id: 'v1-09-q2',
        prompt: 'About 30% of fetched pages are copies. How do you avoid storing them?',
        options: [
          { id: 'hash', label: 'Compare a hash of the content with hashes already stored', correct: true },
          { id: 'url', label: 'Compare URLs', correct: false },
          { id: 'robots', label: 'Respect robots.txt', correct: false },
        ],
        explain: 'Copies live at different URLs; their content hashes match.',
      },
      {
        kind: 'pick',
        id: 'v1-09-q3',
        prompt: 'A calendar page links to “next month” forever. What protects the crawler?',
        options: [
          { id: 'depth', label: 'A maximum URL depth and length', correct: true },
          { id: 'cache', label: 'A bigger DNS cache', correct: false },
          { id: 'more', label: 'More downloaders', correct: false },
        ],
        explain: 'That’s a spider trap: cap depth and length so it can’t generate endless work.',
      },
    ],
  },
}
