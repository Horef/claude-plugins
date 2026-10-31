// `claude plugin test .` — draws the band on both surfaces at a wide and a
// narrow width with seeded figures, and checks segments drop in order.
import { test, expect, mock } from 'claude-code/testing'

const draw = async ($: any, surface: 'terminal' | 'desktop', bodyColumns: number, isWorking = false) => {
  const ui = await $.ui.mount({
    plugin: 'session-status-line', surface, component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  const texts = await ui.findAll({ type: 'Text' })
  await ui.unmount()
  return texts.map((t: any) => t.text).join('')
}

test('renders and drops segments when narrow', async ($, on) => {
  // Nothing sits beneath the plugin in a test: stand in for the engine.
  mock.clock(on, { now: Date.parse('2026-10-04T12:00:00Z') })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('turn.complete', ($, e) => ({ text: e.answer, usage: e.usage }))
  mock.store(on)
  // Compaction stand-in: a 'veto' instruction is refused, as a blocking PreCompact hook would.
  on('session.compact', ($, e) => (e.instructions === 'veto' ? { skip: 'blocked' } : { messages: [{ role: 'user', text: 'summary', toolUses: [] }] }) as any)
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: null, usage: null } as any
  })
  await $.session.measure({ context: { tokens: 184_000, window: 200_000, percent: 92 }, rateLimits: [
    { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-04T14:10:00Z' },
    { kind: 'seven_day', percentUsed: 81, resetsAt: '2026-10-07T16:00:00Z' },
  ], cost: { usd: 1.234 }, changed: ['context', 'cost'] })
  await $.turn.complete({
    answer: 'ok', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer',
    usage: { model: 'claude-sonnet-5-5', input_tokens: 2_000, cache_creation_input_tokens: 43_000, cache_read_input_tokens: 90_000, output_tokens: 1_200 },
  } as any)
  // One main-loop request at high effort.
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-sonnet-5-5', effort: 'high', messageCount: 1 }) as any) {}
  // Two real compactions; a precompute and a vetoed one must not count.
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] } as any)
  await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'hi', toolUses: [] }] } as any)
  await $.session.compact({ trigger: 'precompute', messages: [{ role: 'user', text: 'hi', toolUses: [] }] } as any)
  await $.session.compact({ trigger: 'manual', instructions: 'veto', messages: [{ role: 'user', text: 'hi', toolUses: [] }] } as any)
  for (const surface of ['terminal', 'desktop'] as const) {
    const wide = await draw($, surface, 200)
    console.log(surface, 'wide  :', wide)
    expect(wide).toContain('Sonnet 5.5 (H)')
    expect(wide).toContain('5h 24% ⟳2h10m')
    expect(wide).toContain('7d 81% ⟳3d4h ⚠21h')
    expect(wide).toContain('⏱1s')
    expect(wide).toContain('🗜2')
    expect(wide).toContain('92%')
    expect(wide).toContain('$1.23')
    expect(wide).toContain('→ /compact')
    expect(wide).toContain(surface === 'desktop' ? '●●●●●●' : '▰▰▰▰▰▰')
    // Too narrow for one line: splits into two instead of dropping the budget line.
    const two = await draw($, surface, 100)
    console.log(surface, 'two   :', two)
    expect(two).toContain('🗜2')
    expect(two).toContain('1 turn')
    expect(two).toContain('7d 81% ⟳3d4h')
    const narrow = await draw($, surface, 60, true)
    console.log(surface, 'narrow:', narrow)
    expect(narrow).toContain('⏳')
    expect(narrow).not.toContain('$1.23')
    expect(narrow).toContain('5h 24%')
  }
})
