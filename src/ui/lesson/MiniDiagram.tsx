import { Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { COMPONENTS } from '../../engine/components'
import type { ComponentKind, LessonCard } from '../../engine/types'
import { ComponentIcon } from '../icons'

type DiagramNodeData = { kind: ComponentKind }

/** A piece as it looks on the board, without load or controls. */
function DiagramNode({ data }: NodeProps<Node<DiagramNodeData>>) {
  const dark = data.kind === 'traffic'
  return (
    <div className={`piece flex w-36 items-center gap-2 px-2.5 py-2 text-sm font-semibold ${dark ? 'bg-ink text-piece' : ''}`}>
      <ComponentIcon kind={data.kind} className="size-4 shrink-0" />
      {COMPONENTS[data.kind].label}
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}

const nodeTypes = { piece: DiagramNode }
const COLUMN = 190
const ROW = 70

/** Lay pieces out left to right by their longest distance from the start. */
function layout(spec: NonNullable<LessonCard['diagram']>) {
  const wires = spec.wires.map((w) => w.split('>') as [string, string])
  const depth: Record<string, number> = {}
  for (const [id] of spec.nodes) depth[id] = 0
  for (let pass = 0; pass < spec.nodes.length; pass++) for (const [a, b] of wires) depth[b] = Math.max(depth[b] ?? 0, (depth[a] ?? 0) + 1)
  const perColumn: Record<number, string[]> = {}
  for (const [id] of spec.nodes) (perColumn[depth[id]!] ??= []).push(id)
  const nodes: Node<DiagramNodeData>[] = spec.nodes.map(([id, kind]) => {
    const col = perColumn[depth[id]!]!
    return { id, type: 'piece', data: { kind }, position: { x: depth[id]! * COLUMN, y: (col.indexOf(id) - (col.length - 1) / 2) * ROW } }
  })
  const edges: Edge[] = wires.map(([a, b]) => ({ id: `${a}>${b}`, source: a, target: b, markerEnd: { type: MarkerType.ArrowClosed, color: '#1d2733' } }))
  return { nodes, edges }
}

/** A small, non-interactive diagram for lessons. */
export function MiniDiagram({ spec }: { spec: NonNullable<LessonCard['diagram']> }) {
  const { nodes, edges } = layout(spec)
  return (
    <div className="h-44 w-full overflow-hidden rounded-xl border-2 border-ink/15 bg-board" aria-label="Diagram">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
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
