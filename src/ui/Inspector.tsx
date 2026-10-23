import {
  COMPONENTS,
  getCount,
  nodeCostPerMin,
  type ChoiceSetting,
  type CountSetting,
  type ExpandAction,
  type Tradeoff,
} from '../engine/components'
import type { SettingId } from '../engine/types'
import { useGameStore } from '../store'
import { fmtMs, loadStatus, statusColor } from './format'
import type { GameNode } from './graph'
import { ComponentIcon } from './icons'
import { isUnlocked, unlockStageOf } from './settings'

function TradeoffCard({ solves, worsens }: Tradeoff) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-lg bg-board px-2.5 py-2 text-xs leading-snug">
      <dt className="font-semibold text-ok">Solves</dt>
      <dd>{solves}</dd>
      <dt className="font-semibold text-bad">Worsens</dt>
      <dd>{worsens}</dd>
    </dl>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/10 pt-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

/** Gate state for a setting: open, or the stage that opens it. */
function useGate(gate: SettingId | undefined) {
  const chapter = useGameStore((s) => s.chapter)
  const stageIndex = useGameStore((s) => s.stageIndex)
  const open = isUnlocked(chapter, gate, stageIndex)
  const at = gate ? unlockStageOf(chapter, gate) : null
  const note = open ? null : (
    <p className="mt-1 text-xs text-ink-faint">{at === null ? 'Not available in this chapter' : `Unlocks in stage ${at + 1}`}</p>
  )
  return { open, note }
}

function Choice({ node, setting }: { node: GameNode; setting: ChoiceSetting }) {
  const updateConfig = useGameStore((s) => s.updateConfig)
  const { open, note } = useGate(setting.gate)
  const current = node.data.config[setting.field]
  const selected = setting.options.find((o) => o.value === current)

  return (
    <Section title={setting.label}>
      <div className="mt-1.5 flex flex-wrap gap-1" role="radiogroup" aria-label={setting.label}>
        {setting.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === current}
            disabled={!open}
            title={`Solves: ${o.solves}\nWorsens: ${o.worsens}`}
            onClick={() => updateConfig(node.id, { [setting.field]: o.value })}
            className={`rounded-md border-2 px-2 py-0.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
              o.value === current ? 'border-ink bg-ink text-piece' : 'border-ink/25 bg-piece hover:border-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {note ?? (selected && <TradeoffCard {...selected} />)}
    </Section>
  )
}

function Count({ node, setting }: { node: GameNode; setting: CountSetting }) {
  const setCount = useGameStore((s) => s.setCount)
  const { open, note } = useGate(setting.gate)
  const value = getCount(node.data, setting.field)
  const btn = 'size-7 rounded-md border-2 border-ink bg-piece font-bold hover:bg-board disabled:opacity-30'
  return (
    <Section title={setting.label}>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" className={btn} disabled={!open || value <= setting.min} onClick={() => setCount(node.id, value - 1)} aria-label={`Fewer ${setting.label.toLowerCase()}`}>
          −
        </button>
        <span className="w-8 text-center text-lg font-bold">{value}</span>
        <button type="button" className={btn} disabled={!open || value >= setting.max} onClick={() => setCount(node.id, value + 1)} aria-label={`More ${setting.label.toLowerCase()}`}>
          +
        </button>
        <span className="text-xs text-ink-faint">or scroll over the piece</span>
      </div>
      {note ?? <TradeoffCard {...setting} />}
    </Section>
  )
}

function Action({ node, action, index }: { node: GameNode; action: ExpandAction; index: number }) {
  const expandNode = useGameStore((s) => s.expandNode)
  const { note } = useGate(action.gate)
  return (
    <Section title={action.label}>
      {note ?? (
        <>
          <button
            type="button"
            onClick={() => expandNode(node.id, index)}
            className="piece mt-1.5 w-full bg-ink py-1.5 text-sm font-bold text-piece active:translate-x-px active:translate-y-px"
          >
            {action.label}
          </button>
          <TradeoffCard {...action} />
        </>
      )}
    </Section>
  )
}

/** Settings drawer for the selected piece, rendered entirely from its component definition. */
export function Inspector() {
  const node = useGameStore((s) => s.nodes.find((n) => n.selected && n.data.kind !== 'traffic'))
  const stats = useGameStore((s) => (node ? s.sim.nodeStats[node.id] : undefined))
  const deselect = useGameStore((s) => s.deselect)
  if (!node) return null

  const def = COMPONENTS[node.data.kind]
  const status = stats?.down ? 'bad' : loadStatus(stats?.load)
  const cost = nodeCostPerMin({ id: node.id, ...node.data })

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l-2 border-ink bg-panel p-4" aria-label={`${def.label} settings`}>
      <header className="flex items-start gap-2">
        <span style={{ color: statusColor[status] }} className="mt-0.5">
          <ComponentIcon kind={def.kind} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg leading-tight font-bold">{def.label}</h2>
          <p className="text-sm text-ink-soft">{def.blurb}</p>
        </div>
        <button type="button" onClick={deselect} className="rounded-md px-1.5 text-xl leading-none text-ink-soft hover:bg-board" aria-label="Close settings">
          ×
        </button>
      </header>
      <TradeoffCard solves={def.solves} worsens={def.worsens} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-ink-soft">Load</div>
          <div className="font-bold" style={{ color: statusColor[status] }}>
            {stats?.down ? 'Down' : `${Math.round((stats?.load ?? 0) * 100)}%`}
          </div>
        </div>
        <div>
          <div className="text-xs text-ink-soft">Latency</div>
          <div className="font-bold">{stats ? fmtMs(stats.latencyMs) : '–'}</div>
        </div>
        <div>
          <div className="text-xs text-ink-soft">Cost</div>
          <div className="font-bold">{cost}/min</div>
        </div>
      </div>

      {def.actions.map((a, i) => (
        <Action key={a.label} node={node} action={a} index={i} />
      ))}
      {def.count && <Count node={node} setting={def.count} />}
      {def.choices.map((c) => (
        <Choice key={c.field} node={node} setting={c} />
      ))}
    </aside>
  )
}
