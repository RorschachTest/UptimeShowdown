import { useState } from 'react'
import type { Hue } from '../../../engine/types'
import { HUE } from '../hues'
import { Figure } from '../Visual'

type Scheme = 'mod' | 'ring' | 'vnodes'
const KEYS = 60
const VNODES = 50
const NODE_HUES: Hue[] = ['blue', 'orange', 'purple', 'teal', 'green', 'red', 'yellow', 'grey']

/** Deterministic, well-mixed position in [0, 1) for a seed (32-bit integer hash). */
const hash = (seed: number) => {
  let h = Math.imul(seed, 0x9e3779b1) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return h / 4294967296
}
const keyPos = (k: number) => hash(k + 1)
const keyInt = (k: number) => Math.floor(hash(k + 5000) * 1_000_000)

function points(scheme: Scheme, n: number): { pos: number; node: number }[] {
  const per = scheme === 'vnodes' ? VNODES : 1
  const pts: { pos: number; node: number }[] = []
  for (let j = 0; j < n; j++)
    for (let v = 0; v < per; v++)
      pts.push({
        pos: scheme === 'mod' ? j / n : hash(100_000 + j * 1009 + v * 7),
        node: j,
      })
  return pts.sort((a, b) => a.pos - b.pos)
}

function owners(scheme: Scheme, n: number): number[] {
  if (scheme === 'mod') return Array.from({ length: KEYS }, (_, k) => keyInt(k) % n)
  const pts = points(scheme, n)
  // A key belongs to the first node point clockwise from it.
  return Array.from({ length: KEYS }, (_, k) => (pts.find((p) => p.pos >= keyPos(k)) ?? pts[0]!).node)
}

const xy = (pos: number, r: number) => [130 + r * Math.sin(pos * 2 * Math.PI), 130 - r * Math.cos(pos * 2 * Math.PI)] as const

/** Hash-ring lab: add or remove a node and watch which keys have to move under each scheme. */
export function RingLab() {
  const [scheme, setScheme] = useState<Scheme>('mod')
  const [n, setN] = useState(4)
  const [prev, setPrev] = useState<number | null>(null)
  const now = owners(scheme, n)
  const before = prev === null ? now : owners(scheme, prev)
  const moved = now.filter((o, k) => o !== before[k]).length
  const counts = Array.from({ length: n }, (_, j) => now.filter((o) => o === j).length)
  const biggest = Math.max(...counts)
  const change = (d: number) => {
    const next = Math.min(8, Math.max(2, n + d))
    if (next === n) return
    setPrev(n)
    setN(next)
  }
  const pick = (s: Scheme) => {
    setScheme(s)
    setPrev(null)
  }
  const pts = points(scheme, n)

  return (
    <Figure
      lab
      caption="Each dot is a key, coloured by the cache node that holds it. Add or remove a node: keys ringed in red had to move, and every one of them is a cache miss that lands on the database."
    >
      <div className="flex flex-wrap items-center gap-5">
        <svg viewBox="0 0 260 260" className="size-64 shrink-0" role="img" aria-label={`${n} nodes, ${moved} of ${KEYS} keys moved`}>
          <circle cx="130" cy="130" r="100" fill="none" stroke="var(--color-ink)" strokeOpacity="0.2" strokeWidth="10" />
          {pts.map((p, i) => {
            const [x, y] = xy(p.pos, 100)
            return scheme === 'vnodes' ? (
              <circle key={i} cx={x} cy={y} r="3" fill={HUE[NODE_HUES[p.node]!]} />
            ) : (
              <g key={i}>
                <circle cx={x} cy={y} r="11" fill={HUE[NODE_HUES[p.node]!]} stroke="var(--color-ink)" strokeWidth="2" />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">
                  {p.node + 1}
                </text>
              </g>
            )
          })}
          {now.map((o, k) => {
            // Two rows of keys so neighbours don't overlap.
            const [x, y] = xy(keyPos(k), k % 2 ? 64 : 80)
            const wasMoved = o !== before[k]
            return (
              <g key={k}>
                {wasMoved && <circle cx={x} cy={y} r="6.5" fill="none" stroke="var(--color-bad)" strokeWidth="2" />}
                <circle cx={x} cy={y} r="3.5" fill={HUE[NODE_HUES[o]!]} />
              </g>
            )
          })}
          <text x="130" y="126" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--color-ink)">
            {n}
          </text>
          <text x="130" y="144" textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)">
            cache nodes
          </text>
        </svg>

        <div className="flex min-w-56 flex-1 flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Scheme">
            {(
              [
                ['mod', 'key mod N'],
                ['ring', 'Hash ring'],
                ['vnodes', 'Ring + vnodes'],
              ] as const
            ).map(([s, label]) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scheme === s}
                onClick={() => pick(s)}
                className={`rounded-lg border-2 px-2.5 py-1 font-semibold ${scheme === s ? 'border-ink bg-ink text-piece' : 'border-ink/25 bg-piece hover:border-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => change(-1)} className="rounded-lg border-2 border-ink bg-piece px-3 py-1 font-semibold hover:bg-board">
              − Lose a node
            </button>
            <button type="button" onClick={() => change(1)} className="rounded-lg border-2 border-ink bg-piece px-3 py-1 font-semibold hover:bg-board">
              + Add a node
            </button>
          </div>
          <p className={`rounded-lg px-3 py-2 font-semibold ${prev === null ? 'bg-board' : moved > KEYS / 2 ? 'bg-bad/15 text-bad' : 'bg-ok/15 text-ok'}`}>
            {prev === null
              ? 'Add or remove a node to see what moves.'
              : `${prev} → ${n} nodes: ${moved} of ${KEYS} keys moved (${Math.round((moved / KEYS) * 100)}%).`}
          </p>
          <p className="rounded-lg bg-board px-3 py-2">
            Busiest node holds <b>{Math.round((biggest / KEYS) * 100)}%</b> of keys; a fair share is {Math.round(100 / n)}%.
          </p>
        </div>
      </div>
    </Figure>
  )
}
