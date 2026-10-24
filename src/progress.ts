/** Per-player progress, kept in this browser only. Storage can be missing or blocked, so every access is guarded. */
export interface ChapterProgress {
  stars: number
  learned: boolean
}

const KEY = 'uptime-showdown:progress:v1'

export function loadProgress(): Record<string, ChapterProgress> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, ChapterProgress>) : {}
  } catch {
    return {}
  }
}

export function saveProgress(p: Record<string, ChapterProgress>) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p))
  } catch {
    // Private mode or blocked storage: progress just won't persist.
  }
}
