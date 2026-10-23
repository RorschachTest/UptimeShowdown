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

describe('interview flow controls', () => {
  it('lets the player un-ask a question and start the scope over', () => {
    const s = useGameStore.getState()
    s.openLevel('ch3')
    s.ask('scale')
    s.ask('kafka')
    s.ask('kafka')
    expect(useGameStore.getState().interview!.asked).toEqual(['scale'])
    s.toggleFeature('upload')
    s.restartScope()
    expect(useGameStore.getState().interview).toMatchObject({ asked: [], inScope: [] })
  })

  it('goes back to Propose with the board intact when the main run is reset', () => {
    const s = useGameStore.getState()
    s.openLevel('ch3')
    s.finishScope()
    s.addComponent('app', { x: 0, y: 0 })
    s.startRun()
    useGameStore.getState().advance(600)
    expect(useGameStore.getState().interview!.runResult).not.toBeNull()
    useGameStore.getState().reset()
    const after = useGameStore.getState()
    expect(after.interview).toMatchObject({ phase: 'propose', runResult: null })
    expect(after.sim.tick).toBe(0)
    expect(after.nodes.some((n) => n.data.kind === 'app')).toBe(true)
  })
})

describe('going back', () => {
  it('returns from the deep dive to scope with the design kept and later results cleared', () => {
    const s = useGameStore.getState()
    s.openLevel('ch3')
    s.ask('scale')
    s.finishScope()
    s.addComponent('app', { x: 0, y: 0 })
    s.startRun()
    useGameStore.getState().advance(600)
    useGameStore.getState().startDeepDive()
    useGameStore.getState().goBackTo('scope')
    const after = useGameStore.getState()
    expect(after.interview).toMatchObject({ phase: 'scope', asked: ['scale'], runResult: null, deepResult: null, snapshot: null })
    expect(after.stageIndex).toBe(0)
    expect(after.nodes.some((n) => n.data.kind === 'app')).toBe(true)
  })
})
