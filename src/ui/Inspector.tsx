import { COMPONENTS, MAX_REPLICAS, nodeCostPerMin } from '../engine/components'
import { useGameStore } from '../store'
import { fmtMs, loadStatus, statusColor } from './format'
import type { GameNode } from './graph'
import { ComponentIcon } from './icons'
import { CHOICE_SETTINGS, COMPONENT_INFO, COUNT_INFO, isUnlocked, unlockStageOf, type ChoiceSetting, type Tradeoff } from './settings'

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

function Locked({ stage }: { stage: number | null }) {
  return <p className="mt-1 text-xs text-ink-faint">{stage === null ? 'Not available in this chapter' : `Unlocks in stage ${stage + 1}`}</p>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink/10 pt-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Choice({ node, setting }: { node: GameNode; setting: ChoiceSetting }) {
  const chapter = useGameStore((s) => s.chapter)
  const stageIndex = useGameStore((s) => s.stageIndex)
  const updateConfig = useGameStore((s) => s.updateConfig)
  const locked = setting.gate !== undefined && !isUnlocked(chapter, setting.gate, stageIndex)
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
            disabled={locked}
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
      {locked ? <Locked stage={setting.gate ? unlockStageOf(chapter, setting.gate) : null} /> : selected && <TradeoffCard {...selected} />}
    </Section>
  )
}

function Count({ label, value, min, max, onChange, info, locked, lockStage }: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  info: Tradeoff
  locked?: boolean
  lockStage?: number | null
}) {
  const btn = 'size-7 rounded-md border-2 border-ink bg-piece font-bold hover:bg-board disabled:opacity-30'
  return (
    <Section title={label}>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" className={btn} disabled={locked || value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}>
          −
        </button>
        <span className="w-8 text-center text-lg font-bold">{value}</span>
        <button type="button" className={btn} disabled={locked || value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}>
          +
        </button>
        <span className="text-xs text-ink-faint">or scroll over the piece</span>
      </div>
      {locked ? <Locked stage={lockStage ?? null} /> : <TradeoffCard {...info} />}
    </Section>
  )
}

/** Settings drawer for the selected piece. Every option shows what it solves and what it worsens. */
export function Inspector() {
  const node = useGameStore((s) => s.nodes.find((n) => n.selected && n.data.kind !== 'traffic'))
  const stats = useGameStore((s) => (node ? s.sim.nodeStats[node.id] : undefined))
  const chapter = useGameStore((s) => s.chapter)
  const stageIndex = useGameStore((s) => s.stageIndex)
  const { deselect, scaleNode, updateConfig, splitNode } = useGameStore.getState()
  if (!node) return null

  const { kind } = node.data
  const info = COMPONENT_INFO[kind]
  const status = stats?.down ? 'bad' : loadStatus(stats?.load)
  const cost = nodeCostPerMin({ id: node.id, kind, instances: node.data.instances, config: node.data.config })

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l-2 border-ink bg-panel p-4" aria-label={`${COMPONENTS[kind].label} settings`}>
      <header className="flex items-start gap-2">
        <span style={{ color: statusColor[status] }} className="mt-0.5">
          <ComponentIcon kind={kind} />
        </span>
        <div className="flex-1">
          <h2 className="text-lg leading-tight font-bold">{COMPONENTS[kind].label}</h2>
          <p className="text-sm text-ink-soft">{info.blurb}</p>
        </div>
        <button type="button" onClick={deselect} className="rounded-md px-1.5 text-xl leading-none text-ink-soft hover:bg-board" aria-label="Close settings">
          ×
        </button>
      </header>
      <TradeoffCard solves={info.solves} worsens={info.worsens} />

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

      {kind === 'allinone' && (
        <Section title="Split tiers">
          {isUnlocked(chapter, 'split', stageIndex) ? (
            <>
              <button
                type="button"
                onClick={() => splitNode(node.id)}
                className="piece mt-1.5 w-full bg-ink py-1.5 text-sm font-bold text-piece active:translate-x-px active:translate-y-px"
              >
                Split into web server + database
              </button>
              <TradeoffCard solves="Web and data scale on their own, on separate machines." worsens="A network hop between them, and the database is now its own single point of failure." />
            </>
          ) : (
            <Locked stage={unlockStageOf(chapter, 'split')} />
          )}
        </Section>
      )}

      {kind === 'app' && (
        <Count label="Instances" value={node.data.instances} min={1} max={COMPONENTS.app.maxInstances} onChange={(v) => scaleNode(node.id, v - node.data.instances)} info={COUNT_INFO.instances} />
      )}
      {kind === 'sqldb' && (
        <Count
          label="Read replicas"
          value={node.data.config.replicas}
          min={0}
          max={MAX_REPLICAS}
          onChange={(v) => updateConfig(node.id, { replicas: v })}
          info={COUNT_INFO.replicas}
          locked={!isUnlocked(chapter, 'replicas', stageIndex)}
          lockStage={unlockStageOf(chapter, 'replicas')}
        />
      )}
      {CHOICE_SETTINGS.filter((s) => s.kinds.includes(kind)).map((s) => (
        <Choice key={s.field} node={node} setting={s} />
      ))}
    </aside>
  )
}
