import { chapter1 } from './chapter1'
import { chapter3 } from './chapter3'

/** Playable levels, in menu order. Ladder levels are staged chapters; interview levels use the Chapter 3 shell. */
export const LEVELS = [
  { id: 'ch1', short: 'Ch 1', title: chapter1.title, kind: 'ladder', chapter: chapter1 },
  { id: 'ch3', short: 'Ch 3', title: chapter3.title, kind: 'interview', level: chapter3 },
] as const

export type LevelId = (typeof LEVELS)[number]['id']
