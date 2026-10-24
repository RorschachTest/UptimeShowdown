import type { ChapterEntry } from './types'
import { v1ch01 } from './vol1/ch01'
import { v1ch02 } from './vol1/ch02'
import { v1ch03 } from './vol1/ch03'
import { v1ch04 } from './vol1/ch04'
import { v1ch05 } from './vol1/ch05'
import { v1ch06 } from './vol1/ch06'

export type { ChapterEntry, ChapterPlay } from './types'

/** The whole campaign, in book order. Adding a chapter = one file in vol1/ or vol2/ plus one line here. */
export const CHAPTERS: ChapterEntry[] = [v1ch01, v1ch02, v1ch03, v1ch04, v1ch05, v1ch06]

export function chapterById(id: string): ChapterEntry {
  const c = CHAPTERS.find((x) => x.id === id)
  if (!c) throw new Error(`Unknown chapter ${id}`)
  return c
}
