import type { ChapterEntry } from '../types'
import { v2chapter10 } from '../v2chapter10'

export const v2ch10: ChapterEntry = {
  id: 'v2-10',
  volume: 2,
  number: 10,
  title: 'Design a real-time leaderboard',
  topic: 'SDI Vol 2 · Real-time gaming leaderboard',
  play: { kind: 'interview', level: v2chapter10 },
  lesson: {
    summary: 'Keep scores sorted in memory so top-10 and “my rank” stay instant, then shard by score when it outgrows one box.',
    cards: [
      {
        title: 'Why SQL struggles',
        body: 'A rank in SQL means ORDER BY score over every player, or counting everyone above you. Fine for thousands of players; for millions, every view sorts the world.',
        visual: { kind: 'bars', caption: 'Work to find one player’s rank among 25 million.', unit: 'steps', rows: [{ label: 'SQL ORDER BY', value: 25000000, hue: 'red', note: 'count or sort everyone above you' }, { label: 'Sorted set', value: 25, hue: 'green', note: 'about log₂(25M) skip-list hops' }] },
        solves: 'Familiar, durable, easy to start.',
        worsens: 'Each rank query scans millions of rows.',
      },
      {
        title: 'Sorted sets',
        body: 'A sorted set (as in Redis) keeps members ordered by score with a skip list plus a hash. Increment a score, get the top 10, or get a player’s rank, each in O(log n).',
        solves: 'Real-time updates and ranks for millions of players.',
        worsens: 'It lives in memory: you size it and protect it.',
        diagram: { nodes: [['u', 'traffic'], ['b', 'leaderboard']], wires: ['u>b'] },
      },
      {
        title: 'Keep a copy',
        body: 'In-memory data dies with its server. Run a replica with automatic failover, and persist snapshots so a full restart can recover the season.',
        solves: 'A dead node is a blip, not a lost season.',
        worsens: 'Twice the memory bill.',
      },
      {
        title: 'Shard by score range',
        body: 'When one box can’t hold everyone, split by score: shard 1 holds the top scores, shard 2 the next band, and so on. Top 10 reads only shard 1; a player’s rank is their rank in their shard plus the sizes of the shards above.',
        visual: { kind: 'steps', caption: 'A player’s global rank from score-range shards.', steps: [{ title: 'Top shard', text: 'scores 900+: 1,000 players', hue: 'purple' }, { title: 'Middle shard', text: 'scores 500–899: 4M players', hue: 'blue' }, { title: 'You', text: '#12,000 inside the middle shard', hue: 'orange' }, { title: 'Global rank', text: '1,000 + 12,000 = #13,000', hue: 'green' }] },
        solves: 'Top-10 and rank stay cheap as you add shards.',
        worsens: 'Low-score shards are crowded, and players move shards as they climb.',
      },
      {
        title: 'Why not hash shards',
        body: 'Hashing players spreads them evenly, but then the top 10 could be on any shard: every view must ask all shards and merge (scatter-gather). The cost of a read grows with the number of shards.',
        visual: { kind: 'versus', caption: 'How shards are split decides what a read costs.', sides: [{ title: 'By player hash', hue: 'red', good: ['Even writes'], bad: ['Top 10 asks every shard', 'Every rank asks every shard'] }, { title: 'By score range', hue: 'green', good: ['Top 10 reads one shard', 'Rank = one shard + counts above'], bad: ['Low-score shards are crowded'] }] },
        solves: 'Perfectly even writes.',
        worsens: 'Every read hits every shard.',
      },
    ],
    quiz: [
      {
        kind: 'pick',
        id: 'v2-10-q1',
        prompt: 'What is the cost of getting a player’s rank from a sorted set of n players?',
        options: [
          { id: 'log', label: 'O(log n)', correct: true },
          { id: 'n', label: 'O(n)', correct: false },
          { id: 'nlogn', label: 'O(n log n)', correct: false },
        ],
        explain: 'The skip list finds the member’s position in logarithmic time.',
      },
      {
        kind: 'pick',
        id: 'v2-10-q2',
        prompt: 'Scores are sharded by player hash over 8 shards. What does showing the top 10 take?',
        options: [
          { id: 'all', label: 'Asking all 8 shards for their top 10 and merging', correct: true },
          { id: 'one', label: 'Reading one shard', correct: false },
          { id: 'two', label: 'Reading two shards', correct: false },
        ],
        explain: 'With hashing, the best players can be on any shard.',
      },
      {
        kind: 'pick',
        id: 'v2-10-q3',
        prompt: 'With shards by score range, how do you get a player’s global rank?',
        options: [
          { id: 'sum', label: 'Their rank in their shard plus the player counts of all higher shards', correct: true },
          { id: 'all', label: 'Ask every shard', correct: false },
          { id: 'sort', label: 'Sort all players again', correct: false },
        ],
        explain: 'Every player in a higher shard outranks them, so the counts add up.',
      },
    ],
  },
}
