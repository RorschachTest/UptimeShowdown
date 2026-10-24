import type { ComponentKind, Hue } from '../../engine/types'

export const HUE: Record<Hue, string> = {
  blue: 'var(--color-read)',
  orange: 'var(--color-write)',
  purple: 'var(--color-ryw)',
  teal: 'var(--color-static)',
  green: 'var(--color-ok)',
  red: 'var(--color-bad)',
  yellow: 'var(--color-warn)',
  grey: 'var(--color-ink-soft)',
}

/** A light wash of a hue, for backgrounds. */
export const tint = (hue: Hue, pct = 14) => `color-mix(in srgb, ${HUE[hue]} ${pct}%, white)`

/** Card accents cycle through these so a lesson reads as a colourful sequence. */
export const CARD_HUES: Hue[] = ['blue', 'orange', 'purple', 'teal', 'green']

/** Colour family per kind of piece in lesson diagrams. */
export const KIND_HUE: Record<ComponentKind, Hue> = {
  traffic: 'grey',
  allinone: 'grey',
  app: 'orange',
  lb: 'blue',
  ratelimit: 'red',
  cache: 'teal',
  cdn: 'teal',
  sqldb: 'purple',
  kvstore: 'purple',
  leaderboard: 'purple',
  idgen: 'green',
  geoindex: 'green',
  feed: 'green',
  queue: 'yellow',
  worker: 'yellow',
  provider: 'red',
  frontier: 'yellow',
  downloader: 'orange',
  trie: 'teal',
  tsdb: 'purple',
  wsgateway: 'blue',
  pubsub: 'yellow',
  blob: 'purple',
}
