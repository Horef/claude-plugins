// Behaviours the judged cases (evals/cases.md) rely on: the compaction counter's rules and its restore
// after a resume, a saved layout loading at the start of a chat, and the colours' contrast. The test's
// hooks stand for the engine; no real chat, file or network is involved.
import { test, expect, mock } from 'claude-code/testing'

const nodes = async ($: any, bodyColumns: number) => {
  const ui = await $.ui.mount({
    plugin: 'session-status-line', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  const texts = await ui.findAll({ type: 'Text' })
  await ui.unmount()
  return texts as any[]
}
const draw = async ($: any, bodyColumns = 200) => (await nodes($, bodyColumns)).map(t => t.text).join('')

const engine = (on: any) => {
  mock.clock(on, { now: Date.parse('2026-11-15T10:00:00Z') })
  const store = new Map<string, unknown>()
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($: any, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('session.measure', ($: any, e: any) => ({ changed: e.changed }))
  on('session.start', ($: any, e: any) => ({ sessionId: 'sess-abc', cwd: e.cwd ?? '/proj' }) as any)
  on('session.end', () => ({ sessionId: 'sess-abc' }) as any)
  on('session.id', () => ({ value: 'sess-abc' }))
  on('command.register', () => ({ value: undefined }) as any)
  on('env.get', ($: any, e: any) => ({ value: e.name === 'HOME' ? '/Users/test' : undefined }))
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }) as any)
  return store
}

const compact = ($: any, extra: any = {}) =>
  $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }], ...extra } as any)

test('a subagent\'s compaction is not counted, and a resumed chat gets its count back', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  expect(await draw($)).toContain('🗜0')
  await compact($)
  await compact($, { agentId: 'sub-1' })
  expect(await draw($)).toContain('🗜1')
  await compact($)
  expect(await draw($)).toContain('🗜2')
  // /clear stands in for a fresh process: totals go back to zero, the store keeps the count per session id.
  await $.session.end({ reason: 'clear' } as any)
  expect(await draw($)).toContain('🗜0')
  await $.session.start({ cwd: '/proj' } as any)
  expect(await draw($)).toContain('🗜2')
})

test('a layout saved by an earlier chat is loaded when a chat starts', async ($, on) => {
  const store = engine(on)
  await $.session.measure({ context: { tokens: 296_000, window: 1_000_000, percent: 30 }, rateLimits: [
    { kind: 'five_hour', percentUsed: 21, resetsAt: '2026-11-15T14:00:00Z' },
    { kind: 'seven_day', percentUsed: 30, resetsAt: '2026-11-19T09:00:00Z' },
  ], cost: { usd: 3.21 }, changed: ['context', 'cost'] } as any)
  await $.command.run({ command: 'status-line', args: 'auto' } as any)
  const rowsOf = async (cols: number) => {
    const ui = await $.ui.mount({
      plugin: 'session-status-line', surface: 'terminal', component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: cols, scroll: { offset: 0, bodyRows: 9 }, view: {} },
    })
    const rows = (await ui.findAll({ type: 'Box' })).filter((b: any) => b.props?.flexDirection === 'row').length
    await ui.unmount()
    return rows
  }
  expect(await rowsOf(60)).toBeGreaterThan(1) // auto: too narrow for one line, so rows
  store.set('layout', 'one') // what an earlier chat saved with `/status-line one`
  await $.session.start({ cwd: '/proj' } as any)
  expect(await rowsOf(60)).toBe(1)
  store.set('layout', 'two') // old name of `rows`
  await $.session.start({ cwd: '/proj' } as any)
  expect(await rowsOf(60)).toBeGreaterThan(1)
})

// README "Colour means fill only" and the CONFIG comment promise at least 3:1 on white, off-white and dark.
// Normal-size text would need 4.5:1, which no single colour reaches on both the off-white and the dark.
test('every colour drawn keeps 3:1 contrast on white, off-white and dark backgrounds', async ($, on) => {
  engine(on)
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const seen = new Set<string>()
  for (const percent of [30, 60, 80, 95]) {
    await $.session.measure({ context: { tokens: percent * 1000, window: 100_000, percent }, rateLimits: [
      { kind: 'five_hour', percentUsed: percent, resetsAt: '2026-11-15T14:00:00Z' },
    ], changed: ['context'] } as any)
    for (const t of await nodes($, 200)) if (t.props?.color) seen.add(t.props.color)
  }
  expect(seen.size).toBeGreaterThanOrEqual(4) // green, gold, orange, red
  for (const color of seen) {
    for (const bg of ['#ffffff', '#f5f0e6', '#1e1e1e']) {
      expect([color, bg, ratio(color, bg) >= 3]).toEqual([color, bg, true])
    }
  }
})
