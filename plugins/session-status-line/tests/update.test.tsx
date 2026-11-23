// First-use help (`/status-line help`), the one-time welcome and the update check (0.14.0): the pure rules of
// hooks/update.ts, then the mod against a pretend store, manifest and prompt box. By default the test engine
// loads the mod from a checkout (a dev install); CLAUDE_PLUGINS_UPDATE_CHECK_FORCE=1 makes it act as a cache install.
import { test, expect, mock } from 'claude-code/testing'
import { UPDATING_URL, dueForCheck, installCommand, isDevInstall, isNewer, parseVersion, shouldAnnounce, updateRequest, versionOfManifest } from '../hooks/update'

const START = Date.parse('2026-11-23T08:00:00Z')
const HOUR = 3_600_000
const iso = (ms: number) => new Date(ms).toISOString()
const MANIFEST = 'https://raw.githubusercontent.com/Horef/claude-plugins/main/plugins/session-status-line/.claude-plugin/plugin.json'
const manifest = (version: string) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify({ name: 'session-status-line', version }) })

// ── hooks/update.ts ──
test('parseVersion takes plain releases only', () => {
  expect(parseVersion('0.30.0')).toEqual([0, 30, 0])
  expect(parseVersion('12.0.104')).toEqual([12, 0, 104])
  for (const bad of ['0.30.0-rc.1', 'v1.2.3', '1.2', '1.2.3.4', '', ' 1.2.3', '1.2.x', 'latest', undefined, 3]) expect(parseVersion(bad)).toBeUndefined()
})

test('isNewer is true only for a higher release, numerically', () => {
  expect(isNewer('0.14.0', '0.13.0')).toBe(true)
  expect(isNewer('0.30.0', '0.9.9')).toBe(true) // not a string comparison
  expect(isNewer('1.0.0', '0.99.99')).toBe(true)
  expect(isNewer('0.13.0', '0.13.0')).toBe(false)
  expect(isNewer('0.12.9', '0.13.0')).toBe(false)
  expect(isNewer('0.30.0-rc.1', '0.29.0')).toBe(false) // a pre-release is never "newer"
  expect(isNewer('0.30.0', 'dev')).toBe(false)
  expect(isNewer(undefined, '0.1.0')).toBe(false)
})

test('dueForCheck: at once without a check, 24 h after a good one, 6 h after a failed one', () => {
  const at = (h: number) => START + h * HOUR
  expect(dueForCheck(START, undefined)).toBe(true)
  expect(dueForCheck(START, {})).toBe(true)
  expect(dueForCheck(START, { lastCheck: 'garbage' })).toBe(true)
  const ok = { lastCheck: iso(START), lastOk: true }
  expect(dueForCheck(at(0), ok)).toBe(false) // the same session-start burst
  expect(dueForCheck(at(23.9), ok)).toBe(false)
  expect(dueForCheck(at(24), ok)).toBe(true)
  const failed = { lastCheck: iso(START), lastOk: false }
  expect(dueForCheck(at(5.9), failed)).toBe(false)
  expect(dueForCheck(at(6), failed)).toBe(true)
  expect(dueForCheck(START - 5_000, ok)).toBe(false) // written a moment ago by another chat
})

test('isDevInstall: only a folder under plugins/cache is an installed copy', () => {
  expect(isDevInstall('/Users/a/.claude/plugins/cache/horef-claude-plugins/session-status-line/0.13.0')).toBe(false)
  expect(isDevInstall('C:\\Users\\a\\.claude\\plugins\\cache\\horef-claude-plugins\\session-status-line\\0.13.0')).toBe(false)
  expect(isDevInstall('/Users/a/Programming/claude-plugins/plugins/session-status-line')).toBe(true)
  expect(isDevInstall('/work/plugin-dir')).toBe(true)
})

test('updateRequest and the install command say what to run', () => {
  const t = updateRequest('session-status-line')
  expect(t).toContain('claude plugin marketplace update horef-claude-plugins')
  expect(t).toContain('claude plugin update session-status-line@horef-claude-plugins')
  expect(t).toContain('/reload-plugins')
  expect(installCommand('session-status-line')).toBe('/plugin install session-status-line --marketplace Horef/claude-plugins')
})

test('a manifest counts only with a plain release version; announcing needs newer, undismissed, unannounced', () => {
  expect(versionOfManifest('{"version":"0.14.0"}')).toBe('0.14.0')
  expect(versionOfManifest('{"version":"0.14.0-rc.1"}')).toBeUndefined()
  expect(versionOfManifest('<html>rate limited</html>')).toBeUndefined()
  expect(shouldAnnounce({ latest: '0.14.0' }, '0.13.0')).toBe(true)
  expect(shouldAnnounce({ latest: '0.14.0', dismissed: '0.14.0' }, '0.13.0')).toBe(false)
  expect(shouldAnnounce({ latest: '0.15.0', dismissed: '0.14.0' }, '0.13.0')).toBe(true)
  expect(shouldAnnounce({ latest: '0.14.0', toasted: '0.14.0' }, '0.13.0')).toBe(false)
  expect(shouldAnnounce({ latest: '0.13.0' }, '0.13.0')).toBe(false)
  expect(shouldAnnounce({}, '0.13.0')).toBe(false)
})

// ── the mod ──
type Setup = { installed?: string; latest?: string; env?: Record<string, string>; store?: Record<string, unknown>; cache?: boolean }
const engine = (on: any, o: Setup = {}) => {
  const store = new Map<string, unknown>(Object.entries(o.store ?? {}))
  const toasts: string[] = []
  const fills: any[] = []
  const fetched: string[] = []
  const registered: any[] = []
  const env: Record<string, string> = { ...(o.cache === false ? {} : { CLAUDE_PLUGINS_UPDATE_CHECK_FORCE: '1' }), ...o.env }
  const clock = mock.clock(on, { now: START })
  const box = { open: true } // false: a dialog holds the keys
  const net = { latest: o.latest ?? '0.13.0' } // a version; 'down' answers 503; 'hang' never answers
  on('store.get', ($: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', ($: any, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('store.delete', ($: any, e: any) => { store.delete(e.key); return { value: undefined } })
  on('env.get', ($: any, e: any) => ({ value: env[e.name] }))
  on('fs.read', ($: any, e: any) => {
    if (String(e.path).endsWith('/.claude-plugin/plugin.json')) return { value: JSON.stringify({ name: 'session-status-line', version: o.installed ?? '0.13.0' }) }
    throw new Error(`ENOENT ${e.path}`)
  })
  on('http.fetch', async ($: any, e: any) => {
    if (e.url !== MANIFEST) return { value: { status: 404, ok: false, headers: {}, text: '' } }
    fetched.push(e.url)
    if (net.latest === 'hang') return new Promise(() => {})
    return { value: net.latest === 'down' ? { status: 503, ok: false, headers: {}, text: 'busy' } : manifest(net.latest) }
  })
  on('prompt.fill', ($: any, e: any) => { fills.push(e); return (box.open ? { isFilled: true, text: e.text } : { isFilled: false, text: '', refusal: 'dialog' }) as any })
  on('ui.toast', ($: any, e: any) => { toasts.push(e.text); return { value: undefined } })
  on('command.register', ($: any, e: any) => { registered.push(e); return { value: undefined } })
  on('session.measure', ($: any, e: any) => ({ changed: e.changed }))
  on('session.start', ($: any, e: any) => ({ sessionId: 'sess-u', cwd: e.cwd ?? '/proj' }) as any)
  on('session.end', () => ({ sessionId: 'sess-u' }) as any)
  on('session.id', () => ({ value: 'sess-u' }))
  on('classic.SessionStart', () => ({}))
  return { clock, store, toasts, fills, fetched, registered, net, box }
}
// The update check runs after session.start returns: a few ms on the pretend clock let it finish.
const start = async ($: any, clock: any) => {
  await $.session.start({ cwd: '/proj' } as any)
  await clock.advance(10)
}
const run = async ($: any, args: string) => (await $.command.run({ command: 'status-line', args } as any)).text as string
const stored = (store: Map<string, unknown>) => store.get('update') as any
const NEW14 = 'session-status-line 0.14.0 is available: /status-line update'
const NEW15 = 'session-status-line 0.15.0 is available: /status-line update'
const OLD = { layout: 'one' } // what an earlier version already stored

test('help: at most 12 plain lines with what it shows, the useful commands, the guide and update', async ($, on) => {
  const { registered, clock } = engine(on)
  await start($, clock)
  const text = await run($, 'help')
  expect(text.split('\n').length).toBeLessThanOrEqual(12)
  for (const part of ['/status-line auto | one | rows', '/status-line quotas on | off', '/status-line warm', '/status-line update', 'https://horef.github.io/claude-plugins/session-status-line.html', 'Version 0.13.0']) {
    expect(text).toContain(part)
  }
  expect(await run($, 'HELP')).toBe(text)
  expect(registered[0].description).toContain('help')
  expect(registered[0].description).toContain('update')
})

test('welcome: a fresh store gets one toast, once', async ($, on) => {
  const fresh = engine(on)
  const clock = fresh.clock
  await start($, clock)
  expect(fresh.toasts).toEqual(['Status line on. /status-line help for a 1-minute tour.'])
  expect(fresh.store.get('welcomed')).toBe(true)
  await start($, clock)
  expect(fresh.toasts.length).toBe(1)
})

test('welcome: nothing for a store an earlier version filled', async ($, on) => {
  const old = engine(on, { store: OLD })
  const clock = old.clock
  await start($, clock)
  expect(old.toasts).toEqual([])
  expect(old.store.has('welcomed')).toBe(false)
})

test('update check: a newer release gets one toast and is remembered; the next start asks nothing', async ($, on) => {
  const { clock, toasts, fetched, store } = engine(on, { latest: '0.14.0', store: OLD })
  await start($, clock)
  expect(fetched).toEqual([MANIFEST])
  expect(toasts).toEqual([NEW14])
  expect(stored(store)).toMatchObject({ latest: '0.14.0', lastOk: true, toasted: '0.14.0' })
  await start($, clock)
  expect(fetched.length).toBe(1) // within 24 h
  expect(toasts.length).toBe(1)
})

// The test moves the check's stamp back instead of advancing the clock: a day of pretend minutes runs the mod's
// minute timer 1440 times.
const ago = (store: Map<string, unknown>, ms: number) => store.set('update', { ...stored(store), lastCheck: iso(START - ms) })

test('update check: due again after 24 h; the same version is not announced twice, a later one is', async ($, on) => {
  const { clock, toasts, fetched, net, store } = engine(on, { latest: '0.14.0', store: OLD })
  await start($, clock)
  ago(store, 23 * HOUR)
  await start($, clock)
  expect(fetched.length).toBe(1)
  ago(store, 25 * HOUR)
  await start($, clock)
  expect(fetched.length).toBe(2)
  expect(toasts).toEqual([NEW14])
  net.latest = '0.15.0'
  ago(store, 25 * HOUR)
  await start($, clock)
  expect(toasts).toEqual([NEW14, NEW15])
})

test('update check: no newer release, no toast', async ($, on) => {
  const { clock, toasts, fetched } = engine(on, { latest: '0.13.0', store: OLD })
  await start($, clock)
  expect(fetched.length).toBe(1)
  expect(toasts).toEqual([])
})

test('update check: a failure is silent and backs off for 6 hours', async ($, on) => {
  const { clock, toasts, fetched, net, store } = engine(on, { latest: 'down', store: OLD })
  await start($, clock)
  expect(toasts).toEqual([])
  expect(stored(store)).toMatchObject({ lastOk: false })
  await start($, clock)
  expect(fetched.length).toBe(1)
  ago(store, 5.9 * HOUR)
  await start($, clock)
  expect(fetched.length).toBe(1)
  net.latest = '0.14.0'
  ago(store, 6.1 * HOUR)
  await start($, clock)
  expect(fetched.length).toBe(2)
  expect(toasts).toEqual([NEW14])
})

test('update check: a request that never answers is given up after 5 seconds, silently', async ($, on) => {
  const { clock, toasts, fetched, store } = engine(on, { latest: 'hang', store: OLD })
  await start($, clock)
  expect(fetched.length).toBe(1)
  expect(stored(store)).toMatchObject({ lastOk: false }) // stamped before the request: a hang backs off too
  const asked = run($, 'update')
  await clock.advance(5_100)
  expect(await asked).toContain('Could not read the latest version')
  expect(toasts).toEqual([])
})

test('update check: a dismissed version stays quiet, a later one is announced', async ($, on) => {
  const known = { lastCheck: iso(START - 48 * HOUR), lastOk: true, latest: '0.14.0', dismissed: '0.14.0' }
  const { clock, toasts, net, store } = engine(on, { latest: '0.14.0', store: { ...OLD, update: known } })
  await start($, clock)
  expect(toasts).toEqual([])
  net.latest = '0.15.0'
  await clock.advance(25 * HOUR)
  await start($, clock)
  expect(toasts).toEqual([NEW15])
  expect(stored(store).dismissed).toBe('0.14.0')
})

test('update check: off by the environment', async ($, on) => {
  const env = engine(on, { latest: '0.14.0', env: { CLAUDE_PLUGINS_NO_UPDATE_CHECK: '1' }, store: OLD })
  const clock = env.clock
  await start($, clock)
  expect(env.fetched).toEqual([])
  expect(env.toasts).toEqual([])
  expect(await run($, 'update-check')).toContain('off (CLAUDE_PLUGINS_NO_UPDATE_CHECK=1)')
})

test('update check: update-check off and on', async ($, on) => {
  const { clock, toasts, fetched, store } = engine(on, { latest: '0.14.0', store: OLD })
  await start($, clock)
  expect(await run($, 'update-check')).toContain('Daily update check: on')
  expect(await run($, 'update-check off')).toContain('off')
  expect(store.get('updateCheck')).toBe(false)
  await clock.advance(25 * HOUR)
  await start($, clock)
  expect(fetched.length).toBe(1) // not asked again
  expect(await run($, 'update-check on')).toContain('on')
  await start($, clock)
  expect(fetched.length).toBe(2)
  expect(toasts).toEqual([NEW14]) // the one from the first start; the same version is not announced again
})

test('update check: a checkout (dev install) never checks, toasts or offers an update', async ($, on) => {
  const dev = engine(on, { latest: '0.14.0', cache: false, store: OLD })
  const clock = dev.clock
  await start($, clock)
  expect(dev.fetched).toEqual([])
  expect(dev.toasts).toEqual([])
  expect(await run($, 'update')).toContain('does not update itself')
  expect(dev.fetched).toEqual([])
  expect(dev.fills).toEqual([])
})

test('/status-line update: checks now, fills the prompt with the request and gives the links', async ($, on) => {
  const { clock, fills, fetched, store } = engine(on, { latest: '0.14.0', env: { CLAUDE_PLUGINS_NO_UPDATE_CHECK: '1' }, store: OLD })
  await start($, clock)
  expect(fetched).toEqual([]) // the quiet check is off, a request by hand is not
  const text = await run($, 'update')
  expect(fetched.length).toBe(1)
  expect(text).toContain('0.13.0 is installed; the latest is 0.14.0')
  expect(text).toContain('press Enter')
  expect(text).toContain(UPDATING_URL)
  expect(text).toContain('https://github.com/Horef/claude-plugins/blob/main/plugins/session-status-line/CHANGELOG.md')
  expect(fills).toMatchObject([{ text: updateRequest('session-status-line'), mode: 'replace' }])
  expect(stored(store).latest).toBe('0.14.0')
})

test('/status-line update: without a prompt box the request is printed; up to date and offline say so', async ($, on) => {
  const e = engine(on, { latest: '0.14.0', store: OLD })
  const clock = e.clock
  e.box.open = false
  await start($, clock)
  expect(await run($, 'update')).toContain(updateRequest('session-status-line'))
  e.net.latest = '0.13.0'
  expect(await run($, 'update')).toContain('up to date')
  e.net.latest = 'down'
  const offline = await run($, 'update')
  expect(offline).toContain('Could not read the latest version')
  expect(offline).toContain(UPDATING_URL)
  expect(await run($, 'update later')).toContain('Usage')
})

test('/status-line update dismiss: stores the latest version as dismissed', async ($, on) => {
  const { clock, store } = engine(on, { latest: '0.14.0', env: { CLAUDE_PLUGINS_NO_UPDATE_CHECK: '1' }, store: OLD })
  await start($, clock)
  expect(await run($, 'update dismiss')).toContain('nothing to dismiss') // nothing known yet
  await run($, 'update')
  expect(await run($, 'update dismiss')).toContain('Dismissed 0.14.0')
  expect(stored(store).dismissed).toBe('0.14.0')
})

test('the installed version comes from plugin.json: debug and update report it', async ($, on) => {
  const { clock } = engine(on, { installed: '7.8.9', latest: '7.8.9', store: OLD })
  await start($, clock)
  expect(await run($, 'debug')).toContain('session-status-line 7.8.9')
  expect(await run($, 'update')).toContain('7.8.9 is installed; the latest is 7.8.9: up to date')
})
