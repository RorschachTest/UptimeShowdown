import { describe, expect, it } from 'vitest'
import { useGameStore } from './store'

describe('generic component actions', () => {
  it('expands a single server into a web server wired to a database, keeping incoming wires', () => {
    const s = useGameStore.getState()
    s.addComponent('allinone', { x: 300, y: 100 })
    const box = useGameStore.getState().nodes.find((n) => n.data.kind === 'allinone')!
    s.onConnect({ source: 'traffic', target: box.id, sourceHandle: null, targetHandle: null })

    s.expandNode(box.id, 0)

    const { nodes, edges } = useGameStore.getState()
    const web = nodes.find((n) => n.data.kind === 'app')!
    const db = nodes.find((n) => n.data.kind === 'sqldb')!
    expect(nodes.some((n) => n.id === box.id)).toBe(false)
    expect(edges.map((e) => `${e.source}>${e.target}`).sort()).toEqual([`${web.id}>${db.id}`, `traffic>${web.id}`].sort())
    expect(useGameStore.getState().sim.reach.traffic![0]![0]).toBe(true)
  })

  it('clamps scale-out counts to the component range', () => {
    const s = useGameStore.getState()
    s.addComponent('app', { x: 0, y: 0 })
    const id = useGameStore.getState().nodes.at(-1)!.id
    s.setCount(id, 99)
    expect(useGameStore.getState().nodes.at(-1)!.data.instances).toBe(20)
    s.setCount(id, 0)
    expect(useGameStore.getState().nodes.at(-1)!.data.instances).toBe(1)
  })
})
