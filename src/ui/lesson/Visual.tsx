import type { LessonVisual } from '../../engine/types'
import { HUE, tint } from './hues'
import { BitPacker } from './labs/BitPacker'
import { ClockLab } from './labs/ClockLab'
import { QuorumLab } from './labs/QuorumLab'
import { RingLab } from './labs/RingLab'

/** Frame shared by every lesson picture: a caption and a light panel. */
export function Figure({ caption, lab, children }: { caption: string; lab?: boolean; children: React.ReactNode }) {
  return (
    <figure className="rounded-xl border-2 border-ink/15 bg-panel p-4">
      {lab && <p className="mb-1 text-xs font-bold tracking-wide text-ryw uppercase">Try it</p>}
      {children}
      <figcaption className="mt-3 text-sm text-ink-soft">{caption}</figcaption>
    </figure>
  )
}

function Bits({ v }: { v: Extract<LessonVisual, { kind: 'bits' }> }) {
  const total = v.fields.reduce((s, f) => s + f.bits, 0)
  return (
    <Figure caption={v.caption}>
      <div
        className="flex h-12 overflow-hidden rounded-lg border-2 border-ink"
        role="img"
        aria-label={v.fields.map((f) => `${f.label}: ${f.bits} bits`).join(', ')}
      >
        {v.fields.map((f) => (
          <div
            key={f.label}
            className="flex min-w-8 flex-col items-center justify-center border-r-2 border-ink text-xs font-bold text-white last:border-r-0"
            style={{
              width: `${(f.bits / total) * 100}%`,
              background: HUE[f.hue],
            }}
          >
            <span>{f.bits}</span>
          </div>
        ))}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {v.fields.map((f) => (
          <li key={f.label} className="rounded-lg px-3 py-2 text-sm" style={{ background: tint(f.hue) }}>
            <span className="font-bold" style={{ color: HUE[f.hue] }}>
              {f.label} · {f.bits} {v.unit ?? 'bit'}
              {f.bits > 1 ? 's' : ''}
            </span>
            <span className="block text-ink">{f.note}</span>
          </li>
        ))}
      </ul>
    </Figure>
  )
}

function Bars({ v }: { v: Extract<LessonVisual, { kind: 'bars' }> }) {
  const values = v.rows.map((r) => r.value)
  const max = Math.max(...values)
  const min = Math.max(Math.min(...values.filter((x) => x > 0)), 1e-9)
  const log = max / min > 100
  const width = (x: number) => (log ? (Math.log10(x / min + 1) / Math.log10(max / min + 1)) * 100 : (x / max) * 100)
  return (
    <Figure caption={`${v.caption}${log ? ' (log scale)' : ''}`}>
      <ul className="flex flex-col gap-2.5">
        {v.rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[9rem_1fr] items-center gap-3 text-sm">
            <span className="font-semibold">{r.label}</span>
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="h-5 rounded-md"
                  style={{
                    width: `${Math.max(width(r.value), 2)}%`,
                    background: HUE[r.hue],
                  }}
                />
                <span className="shrink-0 font-bold tabular-nums">
                  {r.value.toLocaleString('en-US')} {v.unit}
                </span>
              </div>
              {r.note && <p className="mt-0.5 text-xs text-ink-soft">{r.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Figure>
  )
}

function Steps({ v }: { v: Extract<LessonVisual, { kind: 'steps' }> }) {
  return (
    <Figure caption={v.caption}>
      <ol className="flex flex-wrap items-stretch gap-2">
        {v.steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-2">
            <div className="w-40 rounded-lg border-2 px-3 py-2 text-sm" style={{ borderColor: HUE[s.hue], background: tint(s.hue) }}>
              <span className="flex items-center gap-1.5 font-bold" style={{ color: HUE[s.hue] }}>
                <span className="grid size-5 place-items-center rounded-full text-xs text-white" style={{ background: HUE[s.hue] }}>
                  {i + 1}
                </span>
                {s.title}
              </span>
              <span className="mt-1 block leading-snug">{s.text}</span>
            </div>
            {i < v.steps.length - 1 && (
              <span className="text-xl font-bold text-ink-faint" aria-hidden="true">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </Figure>
  )
}

function Versus({ v }: { v: Extract<LessonVisual, { kind: 'versus' }> }) {
  return (
    <Figure caption={v.caption}>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${v.sides.length}, minmax(0, 1fr))`,
        }}
      >
        {v.sides.map((s) => (
          <section key={s.title} className="overflow-hidden rounded-lg border-2" style={{ borderColor: HUE[s.hue] }}>
            <h4 className="px-3 py-1.5 text-sm font-bold text-white" style={{ background: HUE[s.hue] }}>
              {s.title}
            </h4>
            <ul className="flex flex-col gap-1 px-3 py-2 text-sm" style={{ background: tint(s.hue, 8) }}>
              {s.good.map((g) => (
                <li key={g}>
                  <span className="font-bold text-ok">✓</span> {g}
                </li>
              ))}
              {s.bad.map((b) => (
                <li key={b}>
                  <span className="font-bold text-bad">✗</span> {b}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Figure>
  )
}

/** Renders a lesson picture or lab from its data. */
export function Visual({ visual }: { visual: LessonVisual }) {
  switch (visual.kind) {
    case 'bits':
      return <Bits v={visual} />
    case 'bars':
      return <Bars v={visual} />
    case 'steps':
      return <Steps v={visual} />
    case 'versus':
      return <Versus v={visual} />
    case 'ringLab':
      return <RingLab />
    case 'quorumLab':
      return <QuorumLab />
    case 'bitPacker':
      return <BitPacker />
    case 'clockLab':
      return <ClockLab />
  }
}
