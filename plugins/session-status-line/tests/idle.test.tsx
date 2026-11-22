// The options that hold for every chat (0.13.0): "Every chat" switches each chat's warmer on by itself, and
// "Idle compaction" (off by default) has the mod compact a quiet chat before its cache lapses, in place of
// Claude Code's own, which a Team or Enterprise account's sec-default plugin keeps every mod from declining
// (it sends session.compact past them). There a compaction is noticed by the context's drop in
// session.measure. The test's hooks stand for the engine; no API call.
import { test, expect, mock } from 'claude-code/testing'

const START = Date.parse('2026-11-22T08:00:00Z')
const MIN = 60_000
const usage = (read: number, wrote: number, extra: object = {}) =>
  ({ input_tokens: 12, output_tokens: 3, cache_read_input_tokens: read, cache_creation_input_tokens: wrote, ...extra })
const OK = { isAnswered: true, text: 'ok', usage: usage(480_000, 20) }

const engine = (on: any, store = new Map<string, unknown>()) => {
  const clock = mock.clock(on, { now: START })
  const forks: string[] = []
  const compacts: string[] = []
  const cc = { idleCompaction: false as boolean | undefined } // Claude Code's own setting, as the person set it
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($: any, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('settings.read', () => ({ value: cc.idleCompaction === undefined ? {} : { idleCompaction: cc.idleCompaction } }) as any)
  on('session.measure', ($: any, e: any) => ({ changed: e.changed }))
  on('session.start', ($: any, e: any) => ({ sessionId: 'sess-i', cwd: e.cwd ?? '/proj' }) as any)
  on('session.end', () => ({ sessionId: 'sess-i' }) as any)
  on('session.id', () => ({ value: 'sess-i' }))
  on('session.compact', ($: any, e: any) => {
    compacts.push(e.trigger ?? 'plugin')
    return { messages: [{ role: 'user', text: 'summary', toolUses: [] }] } as any
  })
  on('command.register', () => ({ value: undefined }) as any)
  on('env.get', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('classic.SessionStart', () => ({}))
  on('turn.step', async function* (_$: any, e: any) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn',
      usage: usage(200_000, 5_000, { ephemeral_1h_input_tokens: 5_000, ephemeral_5m_input_tokens: 0 }) } as any
  })
  on('model.fork', ($: any, e: any) => { forks.push(e.prompt); return { value: OK } })
  return { clock, forks, compacts, store, cc }
}

const measure = ($: any, tokens: number) =>
  $.session.measure({ context: { tokens, window: 1_000_000, percent: Math.round(tokens / 10_000) }, rateLimits: [], changed: ['context'] } as any)
const request = async ($: any) => {
  const st = $.turn.step({ turnId: 'turn-1', index: 0, model: 'claude-opus-5-5', messageCount: 4 } as any)
  for await (const _ of st) { /* no chunks */ }
}
const run = async ($: any, args: string) => (await $.command.run({ command: 'status-line', args } as any)).text as string
const mount = ($: any) => $.ui.mount({
  plugin: 'session-status-line', surface: 'terminal', component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 220, scroll: { offset: 0, bodyRows: 11 }, view: {} },
})
const bandText = async ($: any) => {
  const ui = await mount($)
  const text = ((await ui.findAll({ type: 'Text' })) as any[]).map(t => t.text).join('')
  await ui.unmount()
  return text
}

test('idle compaction is off by default: a large quiet chat is never compacted by the mod', async ($, on) => {
  const { clock, compacts } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await measure($, 300_000)
  await request($)
  await clock.advance(120 * MIN)
  expect(compacts).toEqual([])
  expect(await run($, 'warm status')).toContain('Idle compaction off')
})

test('idle compaction on: a quiet chat of 200k tokens or more compacts 5 minutes before its cache lapses, once', async ($, on) => {
  const { clock, compacts } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  expect(await run($, 'warm idle-compact on')).toContain('Idle compaction on')
  await measure($, 300_000)
  await request($)
  expect(await run($, 'warm status')).toContain('The chat compacts at')
  await clock.advance(54 * MIN)
  expect(compacts).toEqual([])
  await clock.advance(2 * MIN)
  expect(compacts).toEqual(['plugin'])
  await measure($, 40_000) // the summary: no second count for the drop that follows the mod's own compaction
  await clock.advance(60 * MIN)
  expect(compacts).toEqual(['plugin'])
  expect(await bandText($)).toContain('🗜1')
  // A small chat is left alone; a message after the compaction starts a new quiet stretch.
  await request($)
  await clock.advance(70 * MIN)
  expect(compacts).toEqual(['plugin'])
})

test('with the warmer on, the idle compaction waits until it stops; the option off cancels it', async ($, on) => {
  const { clock, compacts, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await run($, 'warm idle-compact on')
  await measure($, 300_000)
  await request($)
  await run($, 'warm on')
  await clock.advance(120 * MIN)
  expect(forks.length).toBe(2) // at 50 and 100
  expect(compacts).toEqual([])
  await run($, 'warm off') // at 120; the cache from the warm at 100 lapses at 160: compacts at 155
  await clock.advance(30 * MIN)
  expect(compacts).toEqual([])
  await clock.advance(10 * MIN)
  expect(compacts).toEqual(['plugin'])
  // Second round with the option switched off before the warmer stops: nothing is compacted.
  await measure($, 300_000)
  await request($)
  await run($, 'warm idle-compact off')
  await clock.advance(120 * MIN)
  expect(compacts).toEqual(['plugin'])
})

test('a compaction the session.compact hook never hears is noticed by the context shrinking', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await clock.advance(3 * MIN) // past the start's calm, where a smaller context is a resumed chat, not a compaction
  await measure($, 250_000)
  await request($)
  await run($, 'warm on')
  await measure($, 60_000) // Claude Code compacted, its session.compact sent past the mods
  expect(await bandText($)).toContain('🗜1')
  expect(await run($, 'warm status')).toContain('nothing known cached')
  await clock.advance(70 * MIN)
  expect(forks.length).toBe(0) // the old cache is gone: nothing to warm until the next message
  await measure($, 55_000) // a small change is no compaction
  expect(await bandText($)).toContain('🗜1')
})

test('"Every chat" switches each chat\'s warmer on; switched off in a chat it stays off there', async ($, on) => {
  const { clock, forks, store } = engine(on)
  store.set('warmEveryChat', true) // set from another chat
  await $.session.start({ cwd: '/proj' } as any)
  expect(await run($, 'warm status')).toContain('Warmer on for every chat')
  await request($)
  await clock.advance(51 * MIN)
  expect(forks.length).toBe(1)
  await run($, 'warm off')
  await clock.advance(5 * MIN)
  expect(await run($, 'warm status')).toContain('Warmer off.')
  await request($)
  await clock.advance(MIN)
  expect(await run($, 'warm status')).toContain('Warmer off.')
  // A new chat (/clear) starts with it on again.
  await $.session.end({ reason: 'clear' } as any)
  expect(await run($, 'warm status')).toContain('Warmer on for every chat')
  // Switched off from any chat: the warmers it switched on go off within a minute; one switched on by hand stays.
  store.set('warmEveryChat', false)
  await clock.advance(MIN)
  expect(await run($, 'warm status')).toContain('Warmer off.')
})

test('an "Every chat" warmer rests 12 hours after the last message', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await run($, 'warm every-chat on')
  await request($)
  await clock.advance(12 * 60 * MIN)
  const sent = forks.length
  expect(sent).toBeGreaterThanOrEqual(13)
  await clock.advance(3 * 60 * MIN)
  expect(forks.length).toBe(sent)
  expect(await run($, 'warm status')).toContain('resting')
  await request($) // a message wakes it
  await clock.advance(51 * MIN)
  expect(forks.length).toBe(sent + 1)
})

test("the options row's third row sets both options and warns while Claude Code's own idle compaction is on", async ($, on) => {
  const { cc, store } = engine(on)
  cc.idleCompaction = undefined // never set: Claude Code's default, on
  await $.session.start({ cwd: '/proj' } as any)
  let ui = await mount($)
  await ui.press({ key: 'warmInfo' })
  await ui.unmount()
  ui = await mount($)
  let text = ((await ui.findAll({ type: 'Text' })) as any[]).map(t => t.text).join('')
  expect(text).toContain('Every chat')
  expect(text).toContain('Idle compaction')
  expect(text).toContain("Claude Code's own is on")
  await ui.press({ key: 'w-auto-on' })
  await ui.press({ key: 'w-idle-on' })
  await ui.unmount()
  expect(store.get('warmEveryChat')).toBe(true)
  expect(store.get('idleCompact')).toBe(true)
  expect(await run($, 'warm status')).toContain('settings.json')
  cc.idleCompaction = false
  await run($, 'warm every-chat off')
  text = await bandText($)
  expect(text).not.toContain("Claude Code's own is on")
  expect(store.get('warmEveryChat')).toBe(false)
  expect(await run($, 'warm status')).not.toContain('settings.json')
})
