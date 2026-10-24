import type { Chapter } from '../engine/types'
import type { ChapterEntry } from './types'
import { v1ch01 } from './vol1/ch01'
import { v1ch02 } from './vol1/ch02'
import { v1ch03 } from './vol1/ch03'
import { v1ch04 } from './vol1/ch04'
import { v1ch05 } from './vol1/ch05'
import { v1ch06 } from './vol1/ch06'
import { v1ch07 } from './vol1/ch07'
import { v1ch08 } from './vol1/ch08'
import { v1ch09 } from './vol1/ch09'
import { v1ch10 } from './vol1/ch10'
import { v1ch11 } from './vol1/ch11'
import { v1ch13 } from './vol1/ch13'
import { v2ch01 } from './vol2/ch01'
import { v2ch05 } from './vol2/ch05'
import { v2ch10 } from './vol2/ch10'

export type { ChapterEntry, ChapterPlay } from './types'

/** The whole campaign, in book order. Adding a chapter = one file in vol1/ or vol2/ plus one line here. */
export const CHAPTERS: ChapterEntry[] = [v1ch01, v1ch02, v1ch03, v1ch04, v1ch05, v1ch06, v1ch07, v1ch08, v1ch09, v1ch10, v1ch11, v1ch13, v2ch01, v2ch05, v2ch10]

/** The simulated chapter behind a chapter's Play step, if it has a board. */
export function boardChapter(entry: ChapterEntry): Chapter | undefined {
  if (entry.play.kind === 'ladder') return entry.play.chapter
  if (entry.play.kind === 'interview') return entry.play.level.chapter
  return undefined
}

export function chapterById(id: string): ChapterEntry {
  const c = CHAPTERS.find((x) => x.id === id)
  if (!c) throw new Error(`Unknown chapter ${id}`)
  return c
}
