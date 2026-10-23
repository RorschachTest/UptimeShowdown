import { chapter1 } from './chapter1'
import { chapter2 } from './chapter2'
import { chapter3 } from './chapter3'
import { chapter4 } from './chapter4'

/** Playable levels, in menu order: ladder (staged builds), estimate (question desk), interview (the Chapter 3 shell). */
export const LEVELS = [
  { id: 'ch1', short: 'Ch 1', title: chapter1.title, kind: 'ladder', chapter: chapter1 },
  { id: 'ch2', short: 'Ch 2', title: chapter2.title, kind: 'estimate', level: chapter2 },
  { id: 'ch3', short: 'Ch 3', title: chapter3.title, kind: 'interview', level: chapter3 },
  { id: 'ch4', short: 'Ch 4', title: chapter4.title, kind: 'interview', level: chapter4 },
] as const

export type LevelId = (typeof LEVELS)[number]['id']
