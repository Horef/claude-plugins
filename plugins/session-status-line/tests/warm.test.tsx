// The cache warmer: off until asked; a fork of the main conversation once `everyMs` has passed since the last
// main-loop request that reached the cache (or the last warm), never before; nothing before a first request,
// after a lapse, a compaction, a /clear or on a 5-minute cache; retries only for passing errors; the cache
// countdown; the band's 🔥 and ⓘ controls. The test's hooks stand for the engine; `model.fork` and
// `turn.step` are answered here, no API call.
import { test, expect, mock } from 'claude-code/testing'
import { migrateWarm } from '../hooks/register'

const START = Date.parse('2026-11-21T20:00:00Z')
const MIN = 60_000
const usage = (read: number, wrote: number, extra: object = {}) =>
  ({ input_tokens: 12, output_tokens: 3, cache_read_input_tokens: read, cache_creation_input_tokens: wrote, ...extra })
const OK = { isAnswered: true, text: 'ok', usage: usage(480_000, 20) }
const FAIL = { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: usage(0, 0) }

const engine = (on: any, answer: (n: number) => any = () => OK) => {
  const clock = mock.clock(on, { now: START })
  const store = new Map<string, unknown>()
  const forks: string[] = []
  const fills: string[] = []
  const toasts: string[] = []
  const compacts: string[] = []
  // What the next main-loop request reports (a 1 h cache read and write by default).
  const step = { usage: usage(200_000, 5_000, { ephemeral_1h_input_tokens: 5_000, ephemeral_5m_input_tokens: 0 }) as any }
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($: any, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('session.measure', ($: any, e: any) => ({ changed: e.changed }))
  on('session.start', ($: any, e: any) => ({ sessionId: 'sess-w', cwd: e.cwd ?? '/proj' }) as any)
  on('session.end', () => ({ sessionId: 'sess-w' }) as any)
  on('session.id', () => ({ value: 'sess-w' }))
  // A plugin's own $.session.compact reaches here with its arguments as given; the engine adds trigger `plugin`.
  on('session.compact', ($: any, e: any) => { compacts.push(e.trigger ?? 'plugin'); return { messages: [{ role: 'user', text: 'summary', toolUses: [] }] } as any })
  on('command.register', () => ({ value: undefined }) as any)
  on('env.get', () => ({ value: undefined }))
  on('ui.toast', ($: any, e: any) => { toasts.push(String(e.text ?? e)); return { value: undefined } })
  on('classic.SessionStart', () => ({}))
  on('prompt.fill', ($: any, e: any) => { fills.push(e.text); return { isFilled: true } })
  on('turn.step', async function* (_$: any, e: any) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: step.usage ? 'end_turn' : null, usage: step.usage } as any
  })
  on('model.fork', ($: any, e: any) => {
    forks.push(e.prompt)
    return { value: answer(forks.length) }
  })
  return { clock, forks, fills, toasts, step, compacts }
}

/** One main-loop request, answered with what `step.usage` holds. */
const request = async ($: any) => {
  const st = $.turn.step({ turnId: 'turn-1', index: 0, model: 'claude-opus-5-5', messageCount: 4 } as any)
  for await (const _ of st) { /* no chunks */ }
  return st.result
}

const band = async ($: any, surface: 'terminal' | 'desktop' = 'terminal', bodyColumns = 220) => {
  const ui = await $.ui.mount({
    plugin: 'session-status-line', surface, component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  const text = ((await ui.findAll({ type: 'Text' })) as any[]).map(t => t.text).join('')
  return { ui, text }
}
const bandText = async ($: any) => {
  const { ui, text } = await band($)
  await ui.unmount()
  return text
}
const run = async ($: any, args: string) => (await $.command.run({ command: 'status-line', args } as any)).text as string

test('off by default: 🔥 and ⓘ on the band, no cache countdown before a request, nothing sent', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await clock.advance(3 * 60 * MIN)
  expect(forks.length).toBe(0)
  const text = await bandText($)
  expect(text).toContain('🔥')
  expect(text).toContain('ⓘ')
  expect(text).not.toContain('cache')
})

test('switched on before any message, it waits for the first one, then warms 50 minutes after it', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  expect(await run($, 'warm')).toContain('next warm after the next message')
  await clock.advance(2 * 60 * MIN)
  expect(forks.length).toBe(0)
  await request($)
  await clock.advance(45 * MIN)
  expect(forks.length).toBe(0)
  expect(await bandText($)).toMatch(/cache 1[45]m/)
  await clock.advance(6 * MIN)
  expect(forks.length).toBe(1)
  expect(forks[0]).toContain('cache keep-alive')
  const text = await bandText($)
  expect(text).toMatch(/cache (1h00m|59m|5\dm)/)
  expect(text).toContain('🔥1')
  expect(await run($, 'warm status')).toContain('cache served 480k tokens')
  await clock.advance(51 * MIN)
  expect(forks.length).toBe(2)
})

test('the countdown stays when the warmer is off; switched on after the cache lapsed, it waits for the next message', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await clock.advance(20 * MIN)
  expect(await bandText($)).toMatch(/cache 4\dm/)
  await clock.advance(50 * MIN)
  expect(await run($, 'warm status')).toContain('lapsed')
  expect(await run($, 'warm on')).toContain('after the next message (the cache has lapsed)')
  await clock.advance(2 * 60 * MIN)
  expect(forks.length).toBe(0)
})

test('a request with no response renews nothing; a 5-minute cache is reported and not warmed', async ($, on) => {
  const { clock, forks, step } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  step.usage = null
  await request($)
  expect(await run($, 'warm status')).toContain('nothing known cached')
  step.usage = usage(100_000, 2_000, { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 2_000 })
  await request($)
  expect(await run($, 'warm on')).toContain('5-minute cache')
  await clock.advance(60 * MIN)
  expect(forks.length).toBe(0)
})

test('"for" sets an end; past it the warmer switches itself off', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  expect(await run($, 'warm for 1h30m')).toContain('until')
  expect(await run($, 'warm for 2h')).toContain('until')
  await clock.advance(5 * 60 * MIN)
  expect(forks.length).toBe(2) // at ~50 and ~100 minutes
  expect(await run($, 'warm status')).toContain('Warmer off.')
})

test('"every" stays below the cache lifetime; "off" stops it', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  expect(await run($, 'warm every 1m')).toContain('Usage')
  expect(await run($, 'warm every 59m')).toContain('Usage')
  await run($, 'warm on')
  expect(await run($, 'warm every 3m')).toContain('3m after each request')
  await clock.advance(4 * MIN)
  expect(forks.length).toBe(1)
  expect(await run($, 'warm off')).toContain('Warmer off.')
  await clock.advance(30 * MIN)
  expect(forks.length).toBe(1)
})

test('a passing error is retried at the next minute tick, while the cache still lives', async ($, on) => {
  const { clock, forks } = engine(on, n => (n === 1 ? FAIL : OK))
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm')
  await clock.advance(50 * MIN)
  expect(forks.length).toBe(1)
  expect(await bandText($)).toContain(' !')
  await clock.advance(1 * MIN)
  expect(forks.length).toBe(2)
  expect(await run($, 'warm status')).toContain('cache served 480k')
})

test('once the cache has lapsed nothing more is sent until the next request', async ($, on) => {
  const { clock, forks } = engine(on, () => FAIL)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm')
  await clock.advance(61 * MIN)
  const tries = forks.length
  expect(tries).toBeGreaterThanOrEqual(9) // every minute from 50 to 59
  expect(tries).toBeLessThanOrEqual(10)
  await clock.advance(3 * 60 * MIN)
  expect(forks.length).toBe(tries)
  expect(await bandText($)).toContain('cache lapsed')
  expect(await run($, 'warm status')).toContain('after the next message (the cache has lapsed)')
})

test('a lasting error or a warm that finds the cache gone switches the warmer off', async ($, on) => {
  const { clock, forks, toasts } = engine(on, n => n === 1
    ? { isAnswered: false, reason: 'api-error', status: 401, error: 'authentication_failed', usage: usage(0, 0) }
    : { isAnswered: true, text: 'ok', usage: usage(0, 300_000) })
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm')
  await clock.advance(52 * MIN)
  expect(forks.length).toBe(1)
  expect(toasts.join(' ')).toContain('authentication_failed')
  expect(await run($, 'warm status')).toContain('Warmer off.')
  await request($)
  await run($, 'warm')
  await clock.advance(52 * MIN)
  expect(forks.length).toBe(2)
  expect(toasts.join(' ')).toContain('already gone')
  expect(await run($, 'warm status')).toContain('Warmer off.')
})

test('an empty reply that read the cache counts as a warm', async ($, on) => {
  const { clock, forks } = engine(on, () => ({ isAnswered: false, reason: 'empty-reply', usage: usage(480_000, 0) }))
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm')
  await clock.advance(53 * MIN)
  expect(forks.length).toBe(1)
  expect(await run($, 'warm status')).toContain('1 sent')
})

test('a compaction or /clear forgets the cache: the warmer waits for the next message; /clear switches it off', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm')
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] } as any)
  await clock.advance(70 * MIN)
  expect(forks.length).toBe(0)
  expect(await run($, 'warm status')).toContain('Warmer on')
  await $.session.end({ reason: 'clear' } as any)
  expect(await run($, 'warm status')).toContain('Warmer off.')
})

test('a resumed chat counts its cache from its last response', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 600, prompt_cache_likely_expired: false } as any)
  expect(await run($, 'warm status')).toMatch(/Cache: 50m left/)
  await $.classic.SessionStart({ source: 'resume', seconds_since_last_response: 7200, prompt_cache_likely_expired: true } as any)
  expect(await run($, 'warm status')).toContain('nothing known cached')
})

test('"warm now" warms once without switching the warmer on', async ($, on) => {
  const { forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  const said = await run($, 'warm now')
  expect(said).toContain('Warmed: the cache served 480k')
  expect(said).toContain('Warmer off.')
  expect(forks.length).toBe(1)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: 🔥 toggles; ⓘ opens the options row, whose buttons set the warmer`, async ($, on) => {
    const { fills } = engine(on)
    await $.session.start({ cwd: '/proj' } as any)
    let { ui, text } = await band($, surface)
    expect(text).not.toContain('Every')
    await ui.press({ key: 'warm' })
    await ui.unmount()
    expect(await run($, 'warm status')).toContain('Warmer on')
    ;({ ui } = await band($, surface))
    await ui.press({ key: 'warmInfo' })
    await ui.unmount()
    ;({ ui, text } = await band($, surface))
    expect(text).toContain('warmer on until')
    expect(text).toContain('Every')
    await ui.press({ key: 'w-inf' })
    await ui.press({ key: 'w-e30' })
    await ui.press({ key: 'w-until' })
    await ui.unmount()
    expect(fills).toEqual(['/status-line warm until '])
    const said = await run($, 'warm status')
    expect(said).toContain('until switched off')
    expect(said).toContain('30m after each request')
    ;({ ui } = await band($, surface))
    await ui.press({ key: 'w-off' })
    await ui.press({ key: 'w-close' })
    await ui.unmount()
    expect(await bandText($)).not.toContain('Every')
    expect(await run($, 'warm status')).toContain('Warmer off.')
  })
}

test('a chosen wait survives a reload; the default one follows the current default', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm on')
  expect(await run($, 'warm status')).toContain('50m (default) after each request')
  expect(await run($, 'warm every 55m')).toContain('55m after each request')
  await $.session.start({ cwd: '/proj' } as any) // a reload runs session.start again; $.state stays
  expect(await run($, 'warm status')).toContain('55m after each request')
  expect(await run($, 'warm every 50m')).toContain('50m (default) after each request')
  await run($, 'warm every 30m')
  expect(await run($, 'warm every default')).toContain('50m (default) after each request')
  await clock.advance(MIN)
})

test('state from before 0.10.2: an old default wait follows the current one, a chosen one stays', async () => {
  const old = { on: true, until: null, lastReqAt: null, lastWarmAt: null, retryAt: null, count: 0 }
  expect(migrateWarm({ ...old, everyMs: 55 * MIN })).toMatchObject({ everySet: false, everyMs: 50 * MIN })
  expect(migrateWarm({ ...old, everyMs: 50 * MIN })).toMatchObject({ everySet: false, everyMs: 50 * MIN })
  expect(migrateWarm({ ...old, everyMs: 30 * MIN })).toMatchObject({ everySet: true, everyMs: 30 * MIN })
  expect(migrateWarm({ ...old, everyMs: 40 * MIN, everySet: false }).everyMs).toBe(40 * MIN) // already migrated
})

test('moving to a shorter wait that is already overdue warms at the next tick', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm on')
  await run($, 'warm every 55m')
  await clock.advance(52 * MIN)
  expect(forks.length).toBe(0)
  await run($, 'warm every default')
  await clock.advance(MIN)
  expect(forks.length).toBe(1)
})

test("while it keeps the cache, Claude Code's idle compaction is declined; otherwise compactions run", async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  const msgs = [{ role: 'user', text: 'hi', toolUses: [] }]
  // Right after a request (a threshold compaction mid-turn): it runs, even with the warmer on.
  await run($, 'warm on')
  const busy = (await $.session.compact({ trigger: 'auto', messages: msgs } as any)) as any
  expect(busy.skip).toBeUndefined()
  await request($)
  await clock.advance(55 * MIN) // the warm went at 50 min; the engine compacts at about 55
  expect(forks.length).toBe(1)
  const idle = (await $.session.compact({ trigger: 'auto', messages: msgs } as any)) as any
  expect(idle.skip).toContain('cache warmer')
  expect(await run($, 'warm status')).toContain('left (1h cache, from the last warm')
  // The person's own /compact always runs.
  const manual = (await $.session.compact({ trigger: 'manual', messages: msgs } as any)) as any
  expect(manual.skip).toBeUndefined()
  // With the warmer off, the idle compaction runs as before.
  await request($)
  await run($, 'warm off')
  await clock.advance(55 * MIN)
  const off = (await $.session.compact({ trigger: 'auto', messages: msgs } as any)) as any
  expect(off.skip).toBeUndefined()
})

test('once the warmer stops, the declined idle compaction runs 5 minutes before the cache lapses, once', async ($, on) => {
  const { clock, compacts } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm on')
  const msgs = [{ role: 'user', text: 'hi', toolUses: [] }]
  await clock.advance(55 * MIN) // warm at 50
  await $.session.compact({ trigger: 'auto', messages: msgs } as any)
  await clock.advance(5 * MIN)
  await $.session.compact({ trigger: 'auto', messages: msgs } as any) // Claude Code trying again
  expect(await run($, 'warm status')).toContain('Idle compaction declined 2×')
  expect(compacts).toEqual([])
  const off = await run($, 'warm off')
  expect(off).not.toContain('compacts at') // the reply reads the state from before the switch
  expect(await run($, 'warm status')).toContain('The chat compacts at')
  await clock.advance(43 * MIN) // the cache lapses 110 min in (60 after the warm); compaction due at 105
  expect(compacts).toEqual([])
  await clock.advance(3 * MIN)
  expect(compacts).toEqual(['plugin'])
  await clock.advance(30 * MIN)
  expect(compacts).toEqual(['plugin'])
  expect(await run($, 'warm status')).toContain('nothing known cached')
  expect(await bandText($)).toContain('🗜1') // counted once
})

test('the end time stops the warmer and the owed compaction follows; a message first clears the debt', async ($, on) => {
  const { clock, compacts } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm for 1h')
  const msgs = [{ role: 'user', text: 'hi', toolUses: [] }]
  await clock.advance(55 * MIN)
  await $.session.compact({ trigger: 'auto', messages: msgs } as any)
  await clock.advance(52 * MIN) // end time at 60, cache until 110: compacts at 105
  expect(compacts).toEqual(['plugin'])
  // Second round: a message after the decline means Claude Code times from it again; nothing is owed.
  await request($)
  await run($, 'warm on')
  await clock.advance(55 * MIN)
  await $.session.compact({ trigger: 'auto', messages: msgs } as any)
  await request($)
  await run($, 'warm off')
  await clock.advance(120 * MIN)
  expect(compacts).toEqual(['plugin']) // the declined one never reached the engine; nothing more was owed
})

test("the options row's status wraps to the band's width between its parts, losing nothing", async ($, on) => {
  const { clock } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await request($)
  await run($, 'warm for 3h')
  await clock.advance(51 * MIN) // one warm sent
  const statusAt = async (cols: number) => {
    const { ui } = await band($, 'terminal', cols)
    if (!(await ui.findAll({ type: 'Text' }) as any[]).some(t => String(t.text).startsWith('Cache 59m left'))) await ui.press({ key: 'warmInfo' })
    const texts = ((await ui.findAll({ type: 'Text' })) as any[]).map(t => String(t.text))
    await ui.unmount()
    const first = texts.findIndex(t => t.startsWith('Cache 59m left'))
    return texts.slice(first, texts.indexOf('Warmer', first))
  }
  const parts = ['Cache 59m left of 1h cache', 'warmer on until', 'next warm in 49m', '1 sent, last served 480k']
  expect((await statusAt(220)).length).toBe(1)
  for (const cols of [100, 70, 45]) {
    const lines = await statusAt(cols)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(cols - 1)
    for (const part of parts) expect(lines.join(' · ')).toContain(part)
  }
  expect((await statusAt(45)).length).toBe(3) // the cache; on until · next warm; sent
})

test('help lists the options', async ($, on) => {
  const { clock } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  const said = await run($, 'warm help')
  for (const word of ['now', 'for 8h', 'until 07:30', 'every 50m']) expect(said).toContain(word)
  await clock.advance(MIN) // let the start's background budget reads settle before the test ends
})
