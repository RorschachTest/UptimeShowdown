import type { UnitMap } from '../types'

/** Combine units: multiply adds exponents, divide subtracts them. Zero exponents disappear. */
export function combine(a: UnitMap, b: UnitMap, op: 'mul' | 'div'): UnitMap {
  const out: UnitMap = { ...a }
  for (const [u, e] of Object.entries(b)) {
    const next = (out[u] ?? 0) + (op === 'mul' ? e : -e)
    if (next === 0) delete out[u]
    else out[u] = next
  }
  return out
}

export function sameUnits(a: UnitMap, b: UnitMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every((k) => (a[k] ?? 0) === (b[k] ?? 0))
}

/** Plural names for units shown in a numerator; the rest print as-is. */
const PLURAL: Record<string, string> = { user: 'users', view: 'views', photo: 'photos', movie: 'movies', record: 'records', request: 'requests' }

/** Readable units: "views/s", "B/day", "users". Bytes print as B. */
export function formatUnits(u: UnitMap): string {
  const name = (k: string, plural: boolean) => (k === 'byte' ? 'B' : plural ? (PLURAL[k] ?? k) : k)
  const part = (entries: [string, number][], plural: boolean) =>
    entries.map(([k, e]) => name(k, plural) + (Math.abs(e) > 1 ? `^${Math.abs(e)}` : '')).join('·')
  const entries = Object.entries(u)
  const top = part(entries.filter(([, e]) => e > 0), true)
  const bottom = part(entries.filter(([, e]) => e < 0), false)
  if (!top && !bottom) return ''
  return bottom ? `${top || '1'}/${bottom}` : top
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 })
const plain = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
const BYTE_PREFIXES = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']

/** A value with its units, rounded the way a back-of-the-envelope answer would be. */
export function formatQuantity(value: number, u: UnitMap): string {
  const units = formatUnits(u)
  if (u.byte === 1) {
    // Storage is sold in base 10: 1 TB = 10^12 B.
    let i = 0
    let v = Math.abs(value)
    while (v >= 1000 && i < BYTE_PREFIXES.length - 1) {
      v /= 1000
      i++
    }
    const rest = units.replace(/^B/, '')
    return `${plain.format(Math.sign(value) * v)} ${BYTE_PREFIXES[i]}${rest}`
  }
  const num = Math.abs(value) >= 100_000 ? compact.format(value) : plain.format(value)
  return units ? `${num} ${units}` : num
}
