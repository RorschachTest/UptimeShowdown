import { chapter3 } from '../chapter3'
import type { ChapterEntry } from '../types'

export const v1ch03: ChapterEntry = {
  id: 'v1-03',
  volume: 1,
  number: 3,
  title: 'The interview framework',
  topic: 'SDI Vol 1 · A framework for system design interviews',
  play: { kind: 'interview', level: chapter3 },
  lesson: {
    summary: 'Scope, propose, deep dive, wrap up. Every later chapter is played this way.',
    cards: [
      {
        title: '1. Scope before you draw',
        body: 'A vague prompt hides the numbers that shape the design. Ask the few questions that change the architecture: who uses it, how much traffic, what is read vs written, how fresh data must be, what happens when things fail.',
        visual: { kind: 'steps', caption: 'The four steps of a design interview, and what each produces.', steps: [{ title: 'Scope', text: 'questions → facts and a feature list', hue: 'blue' }, { title: 'Propose', text: 'a high-level design, agreed', hue: 'orange' }, { title: 'Deep dive', text: 'the hard parts, under a curveball', hue: 'purple' }, { title: 'Wrap up', text: 'bottlenecks and what’s next', hue: 'green' }] },
        solves: 'You design for the real problem, not a remembered one.',
        worsens: 'Time: you only get a few questions, so choose them well.',
      },
      {
        title: 'Spot the traps',
        body: 'Trivia ("what colour is the button?") and solutions posing as questions ("should we use Kafka?") waste your questions. State the need; let the design earn the tool.',
      },
      {
        title: '2. Propose and get buy-in',
        body: 'Sketch the high-level design and check it with the interviewer before going deep. A single point of failure or an unserved request is cheaper to fix now than later.',
      },
      {
        title: '3. Deep dive when things change',
        body: 'The interviewer changes a constraint: traffic ×10, a celebrity, a region outage. Adapt the part that broke with a few targeted changes instead of rebuilding everything.',
      },
      {
        title: '4. Wrap up',
        body: 'Name the bottleneck you saw and what you would change next. Treat the design as a hypothesis that holds until a constraint moves.',
      },
    ],
    quiz: [
      {
        kind: 'order',
        id: 'v1-03-q1',
        prompt: 'Put the four steps in order.',
        items: [
          { id: 'scope', label: 'Scope the problem', value: 1 },
          { id: 'propose', label: 'Propose a high-level design', value: 2 },
          { id: 'deep', label: 'Deep dive', value: 3 },
          { id: 'wrap', label: 'Wrap up', value: 4 },
        ],
        explain: 'Clarify, propose, go deep, then summarise what you would revisit.',
      },
      {
        kind: 'pick',
        id: 'v1-03-q2',
        prompt: 'Which question moves the architecture the most?',
        options: [
          { id: 'ratio', label: 'What is the read:write ratio?', correct: true },
          { id: 'lang', label: 'Which programming language?', correct: false },
          { id: 'redis', label: 'Should we use Redis?', correct: false },
        ],
        explain: 'A read-heavy system invites caches and replicas; a write-heavy one invites queues and sharding. The others decide nothing structural.',
      },
    ],
  },
}
