import { chapter13 } from '../chapter13'
import type { ChapterEntry } from '../types'

export const v1ch13: ChapterEntry = {
  id: 'v1-13',
  volume: 1,
  number: 13,
  title: 'Design search autocomplete',
  topic: 'SDI Vol 1 · Design a search autocomplete system',
  play: { kind: 'interview', level: chapter13 },
  lesson: {
    summary: 'Answer every keystroke from an in-memory trie, and rebuild it offline from the search logs.',
    cards: [
      {
        title: 'Two systems',
        body: 'A query path answers each keystroke from a trie in memory. A data path collects finished searches, counts them, and rebuilds the trie every week. They never wait on each other.',
        solves: 'Keystrokes stay fast while popularity is computed in the background.',
        worsens: 'New trends appear only after the next rebuild.',
        diagram: { nodes: [['u', 'traffic'], ['t', 'trie'], ['q', 'queue'], ['w', 'worker']], wires: ['u>t', 'u>q', 'q>w'] },
      },
      {
        title: 'The trie',
        body: 'A trie stores searches letter by letter: “be”, then “bee”, “beer”, “best”. The node for a prefix holds everything that starts with it.',
        visual: {
          kind: 'steps',
          caption: 'Walking a trie for the prefix “bes”.',
          steps: [
            { title: 'Root', text: 'every search', hue: 'grey' },
            { title: 'b', text: 'beer, best, bet…', hue: 'blue' },
            { title: 'be', text: 'beer, best, bet', hue: 'teal' },
            { title: 'bes', text: 'best, best buy, bestie', hue: 'green' },
          ],
        },
        solves: 'Prefix lookups follow a few links.',
        worsens: 'Finding the most popular under a busy prefix still means searching a big subtree.',
      },
      {
        title: 'Cache the top 5 at each node',
        body: 'Store the 5 most popular completions in every node. A keystroke then reads one node and returns its list: no subtree walk.',
        visual: {
          kind: 'bars',
          caption: 'Work per keystroke for a busy prefix.',
          unit: 'nodes read',
          rows: [
            { label: 'Walk the subtree', value: 20, hue: 'red', note: 'every word under “be”' },
            { label: 'Top 5 cached', value: 1, hue: 'green', note: 'the answer is already in the node' },
          ],
        },
        solves: 'Constant-time lookups.',
        worsens: 'More memory, and the lists must be rebuilt.',
      },
      {
        title: 'Gather data cheaply',
        body: 'Every search goes into a log queue; aggregators count queries and feed the weekly rebuild. Counting a 1-in-10 sample gives the same ranking for a tenth of the work.',
        visual: {
          kind: 'versus',
          caption: 'How to keep the trie current.',
          sides: [
            { title: 'Update on every search', hue: 'red', good: ['Trends show at once'], bad: ['Writes fight reads on the trie', 'Needs far more servers'] },
            { title: 'Weekly rebuild', hue: 'green', good: ['Lookups get the whole machine', 'Sampled logs are cheap'], bad: ['Trends appear next week'] },
          ],
        },
      },
      {
        title: 'Shard and cache',
        body: 'When the trie outgrows one machine, split it by prefix ranges. First letters are very uneven, so use a shard map built from past traffic. Let browsers cache suggestions for an hour so repeat prefixes never reach you.',
        visual: {
          kind: 'bars',
          caption: 'Share of searches starting with a letter (illustrative).',
          unit: '%',
          rows: [
            { label: 's', value: 11, hue: 'red' },
            { label: 'c', value: 9, hue: 'orange' },
            { label: 'x', value: 0.2, hue: 'green' },
          ],
        },
        solves: 'Even load per shard, less traffic overall.',
        worsens: 'A shard map to maintain.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v1-13-q1',
        prompt: 'What makes each keystroke a single read?',
        options: [
          { id: 'topk', label: 'Caching the top 5 completions in every trie node', correct: true },
          { id: 'shard', label: 'Sharding by first letter', correct: false },
          { id: 'sample', label: 'Sampling the logs', correct: false },
        ],
        explain: 'The answer for a prefix is stored at its node.',
      },
      {
        kind: 'pick',
        id: 'v1-13-q2',
        prompt: 'Why not shard the trie by first letter?',
        options: [
          { id: 'skew', label: 'Far more searches start with some letters than others: those shards overload', correct: true },
          { id: 'slow', label: 'Lookups become slower', correct: false },
          { id: 'mem', label: 'It uses more memory', correct: false },
        ],
        explain: 'Use a shard map built from historical traffic instead.',
      },
      {
        kind: 'pick',
        id: 'v1-13-q3',
        prompt: 'Suggestions may be a week old. How should the trie be updated?',
        options: [
          { id: 'weekly', label: 'Rebuild offline from aggregated logs and swap it in', correct: true },
          { id: 'live', label: 'Update it on every search', correct: false },
          { id: 'never', label: 'Never: build it once', correct: false },
        ],
        explain: 'Offline rebuilds keep writes away from the read path.',
      },
    ],
  },
}
