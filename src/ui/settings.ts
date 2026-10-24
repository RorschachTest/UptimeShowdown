import type { Chapter, ComponentKind, SettingId } from '../engine/types'

export const TYPE_COLORS: Record<string, string> = {
  page: 'var(--color-read)',
  write: 'var(--color-write)',
  ryw: 'var(--color-ryw)',
  static: 'var(--color-static)',
  scrape: 'var(--color-bad)',
  celeb: 'var(--color-ryw)',
  inbound: 'var(--color-static)',
}

/** Stage index (0-based) where a setting unlocks, or null if it never does in this chapter. */
export function unlockStageOf(chapter: Chapter, setting: SettingId): number | null {
  const i = chapter.stages.findIndex((s) => s.unlocks.settings.includes(setting))
  return i < 0 ? null : i
}

/** Settings without a gate are always open; gated ones open at their unlock stage. */
export function isUnlocked(chapter: Chapter, setting: SettingId | undefined, stageIndex: number): boolean {
  if (setting === undefined) return true
  const i = unlockStageOf(chapter, setting)
  return i !== null && i <= stageIndex
}

export function unlockedKinds(chapter: Chapter, stageIndex: number): ComponentKind[] {
  return chapter.stages.slice(0, stageIndex + 1).flatMap((s) => s.unlocks.kinds)
}
