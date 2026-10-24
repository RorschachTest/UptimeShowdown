import type { Chapter, EstimateLevel, InterviewLevel, Lesson } from '../engine/types'

/** What the Play step of a chapter is. */
export type ChapterPlay =
  | { kind: 'ladder'; chapter: Chapter }
  | { kind: 'estimate'; level: EstimateLevel }
  | { kind: 'interview'; level: InterviewLevel }
  | { kind: 'review' }

/** One chapter of the campaign: a lesson, then something to play. */
export interface ChapterEntry {
  id: string
  volume: 1 | 2
  number: number
  title: string
  /** The book topic it's inspired by (we cite topics only; content is ours). */
  topic: string
  lesson: Lesson
  play: ChapterPlay
}
