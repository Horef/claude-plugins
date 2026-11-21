// The cache warmer: off until asked, a fork of the main conversation once `everyMs` has passed since the
// last request or warm, never before, an end time that switches it off, the band's button, and a failed
// warm retried later. The test's hooks stand for the engine; `model.fork` is answered here, no API call.
import { test, expect, mock } from 'claude-code/testing'

const START = Date.parse('2026-11-21T20:00:00Z')
const MIN = 60_000

const engine = (on: any, answer: (n: number) => any = () => ({
  isAnswered: true, text: 'ok', usage: { input_tokens: 12, output_tokens: 1, cache_read_input_tokens: 480_000, cache_creation_input_tokens: 20 },
})) => {
  const clock = mock.clock(on, { now: START })
  const store = new Map<string, unknown>()
  const forks: string[] = []
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($: any, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('session.measure', ($: any, e: any) => ({ changed: e.changed }))
  on('session.start', ($: any, e: any) => ({ sessionId: 'sess-w', cwd: e.cwd ?? '/proj' }) as any)
  on('session.end', () => ({ sessionId: 'sess-w' }) as any)
  on('session.id', () => ({ value: 'sess-w' }))
  on('command.register', () => ({ value: undefined }) as any)
  on('env.get', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }) as any)
  on('model.fork', ($: any, e: any) => {
    forks.push(e.prompt)
    return { value: answer(forks.length) }
  })
  return { clock, forks }
}

const band = async ($: any) => {
  const ui = await $.ui.mount({
    plugin: 'session-status-line', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 220, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  const text = ((await ui.findAll({ type: 'Text' })) as any[]).map(t => t.text).join('')
  return { ui, text }
}
const run = async ($: any, args: string) => (await $.command.run({ command: 'status-line', args } as any)).text as string

test('off by default: the band shows a dim button and nothing is sent', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  await clock.advance(3 * 60 * MIN)
  expect(forks.length).toBe(0)
  const { ui, text } = await band($)
  expect(text).toContain('🔥')
  await ui.unmount()
})

test('on: one warm once the interval has passed, none before, and the countdown restarts', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  const said = await run($, 'warm')
  expect(said).toContain('Cache warmer on')
  await clock.advance(50 * MIN)
  expect(forks.length).toBe(0)
  await clock.advance(7 * MIN)
  expect(forks.length).toBe(1)
  expect(forks[0]).toContain('cache keep-alive')
  const { ui, text } = await band($)
  expect(text).toMatch(/🔥5\dm/)
  await ui.unmount()
  expect(await run($, 'warm status')).toContain('cache served 480k tokens')
  await clock.advance(56 * MIN)
  expect(forks.length).toBe(2)
})

test('"for" sets an end; past it the warmer switches itself off', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  expect(await run($, 'warm for 2h')).toContain('until')
  await clock.advance(5 * 60 * MIN)
  expect(forks.length).toBe(2) // at ~55 and ~110 minutes
  expect(await run($, 'warm status')).toBe('Cache warmer off.')
})

test('"every" takes minutes within bounds; "off" stops it', async ($, on) => {
  const { clock, forks } = engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  expect(await run($, 'warm every 1m')).toContain('Usage')
  await run($, 'warm on')
  expect(await run($, 'warm every 3m')).toContain('every 3m')
  await clock.advance(4 * MIN)
  expect(forks.length).toBe(1)
  expect(await run($, 'warm off')).toBe('Cache warmer off.')
  await clock.advance(30 * MIN)
  expect(forks.length).toBe(1)
})

test('the band button switches it on and off', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/proj' } as any)
  let { ui } = await band($)
  await ui.press({ key: 'warm' })
  await ui.unmount()
  expect(await run($, 'warm status')).toContain('Cache warmer on')
  ;({ ui } = await band($))
  await ui.press({ key: 'warm' })
  await ui.unmount()
  expect(await run($, 'warm status')).toBe('Cache warmer off.')
})

test('a failed warm is retried after five minutes and marked on the band', async ($, on) => {
  const { clock, forks } = engine(on, n => n === 1
    ? { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded_error' }
    : { isAnswered: true, text: 'ok', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 } })
  await $.session.start({ cwd: '/proj' } as any)
  await run($, 'warm')
  await clock.advance(56 * MIN)
  expect(forks.length).toBe(1)
  const { ui, text } = await band($)
  expect(text).toContain(' !')
  await ui.unmount()
  await clock.advance(3 * MIN)
  expect(forks.length).toBe(1)
  await clock.advance(3 * MIN)
  expect(forks.length).toBe(2)
})

test('nothing to fork (no request yet) waits instead of retrying every minute', async ($, on) => {
  const { clock, forks } = engine(on, () => ({ isAnswered: false, reason: 'nothing-to-fork' }))
  await $.session.start({ cwd: '/proj' } as any)
  await run($, 'warm')
  await clock.advance(60 * MIN)
  expect(forks.length).toBe(1)
  await clock.advance(120 * MIN)
  expect(forks.length).toBe(1)
  expect(await run($, 'warm status')).toContain('after the next request')
})
