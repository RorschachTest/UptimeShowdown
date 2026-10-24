import type { InterviewLevel, Stage } from '../engine/types'

const goals = {
  uptime: 0.99,
  p95Ms: 200,
  maxStaleRate: 0.001,
  maxLagMs: 10_000,
  maxViolations: { impolite: 0, robots: 0, trapped: 0, duplicatePages: 0, lostMessages: 0 },
}

const main: Stage = {
  id: 'crawl-main',
  title: 'The daily crawl',
  story: 'The scheduler feeds 1,000 URLs a second into the crawler. At 0:30 the DNS provider stops answering for 10 seconds.',
  durationS: 60,
  traffic: [{ t: 0, rps: 1000 }],
  mix: { write: 1 },
  unlocks: { kinds: ['frontier', 'downloader'], settings: [] },
  events: [{ t: 30, kind: 'outage', target: 'downloader', durationS: 10 }],
  budget: 80,
  referenceCost: 55,
  goals,
}

const curveball: Stage = {
  id: 'crawl-news',
  title: 'Fresh news, every hour',
  story: 'News sites must be re-crawled hourly: 3,000 URLs a second, and the DNS provider is down for 20 seconds this time.',
  durationS: 60,
  traffic: [{ t: 0, rps: 3000 }],
  mix: { write: 1 },
  unlocks: { kinds: [], settings: [] },
  events: [{ t: 25, kind: 'outage', target: 'downloader', durationS: 20 }],
  budget: 150,
  referenceCost: 105,
  goals,
}

/** Chapter 9, inspired by SDI Vol 1 "Design a web crawler". Scenario and numbers are ours. */
export const chapter9: InterviewLevel = {
  id: 'web-crawler',
  title: 'Design a web crawler',
  prompt: 'Design a crawler that downloads web pages for a search index: polite to websites, robust to the messy web, and fast.',
  questionBudget: 5,
  editBudget: 1,
  curveball: {
    title: 'Fresh news, every hour',
    story: 'Three times the URLs, and a longer DNS outage. You may change 1 piece.',
  },
  questions: [
    { id: 'scale', text: 'How many pages per second?', leverage: 'high', reveals: ['scale'], short: '1,000 URLs/s', answer: 'About 1,000 URLs a second, all day.' },
    { id: 'polite', text: 'How fast may we hit a single website?', leverage: 'high', reveals: ['abuse'], short: 'gently; obey robots.txt', answer: 'Gently: one request at a time per site with a pause between, and never where robots.txt says no.' },
    { id: 'dupes', text: 'Are many pages duplicates?', leverage: 'high', reveals: ['data'], short: '~30% duplicates', answer: 'About 30% of pages are copies of pages we already have. Don’t store them twice.' },
    { id: 'traps', text: 'Are there pages that never end?', leverage: 'high', reveals: ['conflicts'], short: 'yes: spider traps', answer: 'Yes: endless calendars and URLs with session IDs. Don’t get stuck in them.' },
    { id: 'failures', text: 'What fails along the way?', leverage: 'high', reveals: ['failures'], short: 'slow sites, DNS outages', answer: 'Sites are slow, and our DNS provider has short outages. The crawl must carry on.' },
    { id: 'growth', text: 'Will we crawl some sites more often?', leverage: 'high', reveals: ['growth'], short: 'news: hourly, 3×', answer: 'Yes: news sites hourly. That triples the rate.' },
    { id: 'content', text: 'Do we need images and video?', leverage: 'low', reveals: [], answer: 'HTML only.' },
    { id: 'keep', text: 'How long do we keep pages?', leverage: 'low', reveals: [], answer: 'Five years.' },
    { id: 'python', text: 'Should we write it in Python?', leverage: 'trap', reveals: [], answer: 'Language doesn’t change the design.' },
    { id: 'google', text: 'Can we just use Google’s results?', leverage: 'trap', reveals: [], answer: 'We are building the search engine.' },
  ],
  features: [
    { id: 'fetch', text: 'Download HTML pages', core: true },
    { id: 'polite', text: 'Be polite to websites', core: true },
    { id: 'dedupe', text: 'Skip duplicate content', core: true },
    { id: 'traps', text: 'Avoid spider traps', core: true },
    { id: 'js', text: 'Render JavaScript pages', core: false },
    { id: 'images', text: 'Crawl images and video', core: false },
    { id: 'rank', text: 'Rank pages', core: false },
  ],
  wrapUp: [
    {
      id: 'frontier',
      prompt: 'How does a URL frontier keep the crawler polite without slowing the whole crawl?',
      options: [
        { id: 'perhost', text: 'One queue per host, each downloader takes from a few host queues with a delay between fetches', correct: true },
        { id: 'global', text: 'One global delay between all fetches', correct: false },
        { id: 'random', text: 'Shuffle all URLs randomly', correct: false },
        { id: 'robots', text: 'Only crawl sites without a robots.txt', correct: false },
      ],
      explain: 'Mapping each host to its own queue means a site is fetched by one downloader at a time with a pause, while thousands of other hosts are crawled in parallel.',
    },
  ],
  chapter: {
    id: 'web-crawler',
    title: 'Design a web crawler',
    seed: 9,
    violationLabels: {
      impolite: 'requests hammered the same site',
      robots: 'pages fetched against robots.txt',
      trapped: 'fetches wasted in spider traps',
      duplicatePages: 'duplicate pages stored',
      lostMessages: 'URLs were dropped and never crawled',
    },
    rules: {
      requires: [
        { kind: 'frontier', why: 'A crawler needs a URL frontier to decide what to fetch next.' },
        { kind: 'downloader', why: 'Something has to download the pages.' },
      ],
    },
    requestTypes: [{ id: 'write', label: 'URL to crawl', needs: ['enqueue', 'work'], weight: 1, consistency: 'any', distanceMs: 0, asyncAfter: 'enqueue' }],
    stages: [main, curveball],
  },
}
