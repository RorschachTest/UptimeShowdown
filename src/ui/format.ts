export type LoadStatus = 'idle' | 'ok' | 'warn' | 'bad'

/** Spec §9: green under 70% load, amber 70–100%, red when overloaded. */
export function loadStatus(load: number | undefined): LoadStatus {
  if (!load) return 'idle'
  if (load < 0.7) return 'ok'
  if (load <= 1) return 'warn'
  return 'bad'
}

export const statusColor: Record<LoadStatus, string> = {
  idle: 'var(--color-ink-faint)',
  ok: 'var(--color-ok)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
}

const whole = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })

export const fmtInt = (n: number) => whole.format(n)

export function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`
  return `${whole.format(ms)} ms`
}

export function fmtPct(fraction: number): string {
  // One decimal where it matters (99.4%), none when it would just be .0 (90%).
  const pct = Math.round(fraction * 1000) / 10
  return `${pct}%`
}

export function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
