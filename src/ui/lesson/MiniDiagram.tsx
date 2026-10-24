import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { COMPONENTS } from '../../engine/components'
import type { Chapter, ComponentKind, DiagramSpec } from '../../engine/types'
import { clip, enrichSpec, shapeClass } from '../design'
import { ComponentIcon } from '../icons'
import { HUE, KIND_HUE, tint } from './hues'

type DiagramNodeData = { kind: ComponentKind; name?: string; does?: string[]; data?: string[]; vertical?: boolean }

/** A piece as it reads in a design doc: its name, what it does, and what it holds. */
function DiagramNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  const dark = data.kind === 'traffic'
  const hue = KIND_HUE[data.kind]
  const label = COMPONENTS[data.kind].label
  const name = data.name ?? label
  return (
    <div className="w-44">
      <div
        className={`piece relative px-2.5 py-2 text-sm ${dark ? 'bg-ink text-piece' : shapeClass(data.kind)}`}
        style={dark ? undefined : { background: tint(hue, 18) }}
      >
        <div className="flex items-center gap-2 font-semibold">
          <span style={{ color: dark ? undefined : HUE[hue] }}>
            <ComponentIcon kind={data.kind} className="size-4 shrink-0" />
          </span>
          <span className="flex flex-col leading-tight">
            {name !== label && !dark && <span className="text-[9px] tracking-wide text-ink-faint uppercase">{label}</span>}
            {name}
          </span>
        </div>
        {data.does && data.does.length > 0 && (
          <ul className="mt-1 flex flex-col text-[11px] leading-snug">
            {clip(data.does, 3).map((d) => (
              <li key={d}>▸ {d}</li>
            ))}
          </ul>
        )}
      </div>
      {data.data && (
        <div className="mx-2 rounded-b-lg border-2 border-t-0 border-dashed border-ink/40 bg-panel px-2 py-0.5 text-[10px] text-ink-soft">
          {data.data.map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
      )}
      <Handle type="target" position={data.vertical ? Position.Top : Position.Left} isConnectable={false} />
      <Handle type="source" position={data.vertical ? Position.Bottom : Position.Right} isConnectable={false} />
    </div>
  )
}

/** A wire with its endpoints stacked as chips under the middle, like on the board. */
function LabeledEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }: EdgeProps<Edge<{ labels: string[] }>>) {
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      {data && data.labels.length > 0 && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute flex flex-col items-center gap-0.5"
            style={{ transform: `translate(-50%, 0) translate(${x}px, ${y + 4}px)` }}
          >
            {data.labels.map((l) => (
              <span key={l} className="rounded border border-ink/25 bg-piece px-1 font-mono text-[10px] font-semibold whitespace-nowrap">
                {l}
              </span>
            ))}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes = { piece: DiagramNode }
const edgeTypes = { labeled: LabeledEdge }
const COLUMN = 290
const ROW = 170
/** Deeper designs are drawn top to bottom so text stays full size in a narrow card. */
const VERTICAL_FROM = 4
const LAYER = 150
const SIDE = 220

/** Lay pieces out left to right by their longest distance from the start. */
function layout(spec: DiagramSpec) {
  const wires = spec.wires.map((w) => {
    const [ends, label] = w.split('|') as [string, string | undefined]
    const [a, b] = ends.split('>') as [string, string]
    return { a, b, label }
  })
  const depth: Record<string, number> = {}
  for (const [id] of spec.nodes) depth[id] = 0
  for (let pass = 0; pass < spec.nodes.length; pass++) for (const { a, b } of wires) depth[b] = Math.max(depth[b] ?? 0, (depth[a] ?? 0) + 1)
  const perColumn: Record<number, string[]> = {}
  for (const [id] of spec.nodes) (perColumn[depth[id]!] ??= []).push(id)
  const layers = Math.max(...Object.values(depth)) + 1
  const vertical = layers >= VERTICAL_FROM
  const nodes: Node<DiagramNodeData>[] = spec.nodes.map(([id, kind, info]) => {
    const col = perColumn[depth[id]!]!
    const across = col.indexOf(id) - (col.length - 1) / 2
    const position = vertical ? { x: across * SIDE, y: depth[id]! * LAYER } : { x: depth[id]! * COLUMN, y: across * ROW }
    return { id, type: 'piece', data: { kind, ...info, vertical }, position }
  })
  const edges: Edge[] = wires.map(({ a, b, label }) => ({
    id: `${a}>${b}`,
    source: a,
    target: b,
    type: 'labeled',
    data: { labels: label ? label.split(' · ') : [] },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#1d2733' },
  }))
  return { nodes, edges, layers, vertical }
}

/** A small, non-interactive design diagram. With a chapter, pieces and wires are named from it. */
export function MiniDiagram({ spec, chapter, tall }: { spec: DiagramSpec; chapter?: Chapter; tall?: boolean }) {
  const { nodes, edges, layers, vertical } = layout(enrichSpec(spec, chapter))
  const height = vertical ? layers * 165 + 20 : tall ? 384 : 256
  return (
    <div className="w-full overflow-hidden rounded-xl border-2 border-ink/15 bg-board" style={{ height }} aria-label="Diagram">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        />
      </ReactFlowProvider>
    </div>
  )
}
