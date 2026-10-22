import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react'
import { useCallback, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { COMPONENTS } from '../engine/components'
import type { ComponentKind } from '../engine/types'
import { useGameStore } from '../store'
import { FlowEdge } from './edges/FlowEdge'
import { wouldCreateCycle } from './graph'
import { BinIcon } from './icons'
import { ComponentNode } from './nodes/ComponentNode'
import { TrafficNode } from './nodes/TrafficNode'
import { DRAG_MIME } from './Palette'

const nodeTypes: NodeTypes = { traffic: TrafficNode, component: ComponentNode }
const edgeTypes: EdgeTypes = { flow: FlowEdge }
const defaultEdgeOptions = { type: 'flow', markerEnd: { type: MarkerType.ArrowClosed, color: '#1d2733' } }

/** Half a piece, so a dropped piece lands centred on the cursor. */
const DROP_OFFSET = { x: 96, y: 45 }

function isComponentKind(value: string): value is ComponentKind {
  return value in COMPONENTS && value !== 'traffic'
}

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addComponent, removeNode, removeEdge } = useGameStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      addComponent: s.addComponent,
      removeNode: s.removeNode,
      removeEdge: s.removeEdge,
    })),
  )
  const { screenToFlowPosition } = useReactFlow()
  const binRef = useRef<HTMLDivElement>(null)
  const [overBin, setOverBin] = useState(false)

  const pointerOverBin = (e: MouseEvent | TouchEvent | React.MouseEvent) => {
    const r = binRef.current?.getBoundingClientRect()
    const p = 'touches' in e ? e.changedTouches[0] : e
    return !!r && !!p && p.clientX >= r.left && p.clientX <= r.right && p.clientY >= r.top && p.clientY <= r.bottom
  }

  const isValidConnection = useCallback((c: Connection | Edge) => {
    const { nodes, edges } = useGameStore.getState()
    if (nodes.find((n) => n.id === c.target)?.data.kind === 'traffic') return false
    if (edges.some((e) => e.source === c.source && e.target === c.target)) return false
    return !wouldCreateCycle(edges, c.source, c.target)
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const kind = e.dataTransfer.getData(DRAG_MIME)
    if (!isComponentKind(kind)) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addComponent(kind, { x: p.x - DROP_OFFSET.x, y: p.y - DROP_OFFSET.y })
  }

  const onlySource = nodes.length === 1

  return (
    <div className="relative h-full flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        // Mouse only: no keyboard deletion or key-modified selection.
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        onNodeDrag={(e, node) => setOverBin(node.deletable !== false && pointerOverBin(e))}
        onNodeDragStop={(e, node) => {
          if (node.deletable !== false && pointerOverBin(e)) removeNode(node.id)
          setOverBin(false)
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault()
          removeEdge(edge.id)
        }}
        onNodeContextMenu={(e) => e.preventDefault()}
        onPaneContextMenu={(e) => e.preventDefault()}
        defaultViewport={{ x: 80, y: 60, zoom: 1 }}
        minZoom={0.3}
        maxZoom={1.6}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={2} color="var(--color-board-dot)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {onlySource && (
        <div className="pointer-events-none absolute top-6 left-1/2 max-w-sm -translate-x-1/2 rounded-xl border-2 border-dashed border-ink-faint bg-panel/90 px-4 py-3 text-center text-sm text-ink-soft">
          Drag an App Server and a SQL Database onto the board, then wire Users → App Server → SQL Database and press
          Play.
        </div>
      )}

      <div
        ref={binRef}
        className={`absolute bottom-4 left-4 flex size-16 items-center justify-center rounded-xl border-2 transition-colors ${
          overBin ? 'border-bad bg-bad text-piece' : 'border-dashed border-ink-faint bg-panel/80 text-ink-soft'
        }`}
        title="Drag a piece here to remove it"
      >
        <BinIcon className="size-7" />
      </div>
    </div>
  )
}
