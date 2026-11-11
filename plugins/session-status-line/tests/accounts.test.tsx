// Other Claude accounts (readings files), Codex budgets and the Kiro data path. The test's hooks stand
// for the file system, the shell and the HTTP services: no real file, process or request is touched.
import { test, expect, mock } from 'claude-code/testing'

const NOW = Date.parse('2026-11-11T10:00:00Z')

const draw = async ($: any, bodyColumns = 400) => {
  const ui = await $.ui.mount({
    plugin: 'session-status-line', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 9 }, view: {} },
  })
  const texts = await ui.findAll({ type: 'Text' })
  await ui.unmount()
  return texts.map((t: any) => t.text).join('')
}

type Opts = {
  env?: Record<string, string>
  files?: Record<string, string>
  secrets?: Record<string, string> // `security` answers by service name
  http?: (e: any) => any
  run?: (argv: string[]) => any
}

/** A memory file system plus a shell that knows realpath, mkdir, mv, rm, security and tail|grep. */
const engine = (on: any, opts: Opts = {}) => {
  const files: Record<string, string> = { ...opts.files }
  const writes: string[] = []
  const fetched: any[] = []
  const env: Record<string, string> = { HOME: '/Users/test', ...opts.env }
  mock.clock(on, { now: NOW })
  mock.store(on)
  on('session.measure', ($: any, e: any) => ({ changed: e.changed }))
  on('env.get', ($: any, e: any) => ({ value: env[e.name] }))
  const kids = (dir: string) => {
    const seen = new Map<string, string>()
    for (const p of Object.keys(files)) {
      if (!p.startsWith(`${dir}/`)) continue
      const rest = p.slice(dir.length + 1).split('/')
      seen.set(rest[0], rest.length > 1 ? 'dir' : 'file')
    }
    return [...seen].map(([name, kind]) => ({ name, kind }))
  }
  on('fs.exists', ($: any, e: any) => ({ value: e.path in files || kids(e.path).length > 0 }))
  on('fs.read', ($: any, e: any) => {
    if (!(e.path in files)) throw new Error(`ENOENT ${e.path}`)
    return { value: files[e.path] }
  })
  on('fs.write', ($: any, e: any) => {
    files[e.path] = String(e.content ?? e.data ?? e.text)
    writes.push(e.path)
    return { value: undefined }
  })
  on('fs.list', ($: any, e: any) => {
    const k = kids(e.path)
    if (!k.length) throw new Error(`ENOENT ${e.path}`)
    return { value: k }
  })
  on('process.run', ($: any, e: any) => {
    const [cmd, ...args] = e.argv
    const custom = opts.run?.(e.argv)
    if (custom) return { value: custom }
    const ok = (stdout = '') => ({ value: { exitCode: 0, stdout, stderr: '' } })
    if (cmd === 'sh' && args[1]?.startsWith('cd ')) return ok(`${args[3]}\n`)
    if (cmd === 'sh' && args[1]?.startsWith('tail')) {
      const f = files[args[3]] ?? ''
      return ok(f.split('\n').filter(l => l.includes('rate_limits')).slice(-1).join('\n'))
    }
    if (cmd === 'mkdir') return ok()
    if (cmd === 'mv') {
      files[args[2]] = files[args[1]]
      delete files[args[1]]
      return ok()
    }
    if (cmd === 'rm') return ok()
    if (cmd === 'security') {
      const secret = opts.secrets?.[args[args.indexOf('-s') + 1]]
      return secret ? ok(secret) : { value: { exitCode: 44, stdout: '', stderr: 'not found' } }
    }
    return { value: { exitCode: 127, stdout: '', stderr: 'not found' } }
  })
  on('http.fetch', ($: any, e: any) => {
    fetched.push(e)
    return { value: opts.http?.(e) ?? { status: 404, ok: false, headers: {}, text: '' } }
  })
  return { files, writes, fetched, env }
}

const measure = ($: any, five = 21, week = 30) =>
  $.session.measure({
    context: { tokens: 10_000, window: 200_000, percent: 5 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: five, resetsAt: '2026-11-11T13:00:00Z' },
      { kind: 'seven_day', percentUsed: week, resetsAt: '2026-11-15T09:00:00Z' },
    ],
    changed: ['context'],
  } as any)

const other = (over: any = {}) =>
  JSON.stringify({
    version: 1, key: 'abcd1234', config_dir: '/Users/test/.claude-work', label: 'work', at: '2026-11-11T09:30:00Z',
    five_hour: { percent: 21, resets_at: '2026-11-11T13:00:00Z' },
    seven_day: { percent: 30, resets_at: '2026-11-15T09:00:00Z' },
    ...over,
  })

const DIR = '/Users/test/.config/claude-accounts'

test('writes this account\'s readings under its key, at most once a minute', async ($, on) => {
  const m = engine(on, { env: { CLAUDE_CONFIG_DIR: '/Users/test/.claude-uni/' } })
  await measure($)
  // sha256("/Users/test/.claude-uni")[:8]: the trailing slash is not part of the key.
  const file = `${DIR}/f028c80d.json`
  expect(m.writes).toHaveLength(1)
  const body = JSON.parse(m.files[file])
  expect(body).toMatchObject({
    version: 1, key: 'f028c80d', config_dir: '/Users/test/.claude-uni', label: 'uni', at: '2026-11-11T10:00:00Z',
    five_hour: { percent: 21, resets_at: '2026-11-11T13:00:00Z' }, seven_day: { percent: 30 },
  })
  expect(Object.keys(m.files).filter(p => p.endsWith('.tmp'))).toHaveLength(0)
  await measure($, 40, 31)
  expect(m.writes).toHaveLength(1)
})

test('the default config dir is key "default", labelled main; XDG_CONFIG_HOME moves the file', async ($, on) => {
  const m = engine(on, { env: { XDG_CONFIG_HOME: '/xdg' } })
  await measure($)
  expect(JSON.parse(m.files['/xdg/claude-accounts/default.json'])).toMatchObject({ key: 'default', label: 'main' })
})

test('shows another account as a budget with the reset of its binding window; hides it when there is none', async ($, on) => {
  const m = engine(on, { env: { CLAUDE_CONFIG_DIR: '/Users/test/.claude-uni' } })
  await measure($)
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  expect(await draw($)).not.toContain('work')
  m.files[`${DIR}/abcd1234.json`] = other()
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  const line = await draw($)
  console.log('accounts:', line)
  expect(line).toContain('work 5h 21% 7d 30% ⟳3d23h')
  // Its own file is never shown as "another" account.
  expect(line).not.toContain('uni')
})

test('a window past its reset counts as 0%; an unreadable file is skipped', async ($, on) => {
  const m = engine(on, {
    env: { CLAUDE_CONFIG_DIR: '/Users/test/.claude-uni' },
    files: {
      [`${DIR}/abcd1234.json`]: other({ five_hour: { percent: 99, resets_at: '2026-11-11T09:00:00Z' } }),
      [`${DIR}/ffff0000.json`]: '{not json',
    },
  })
  await measure($)
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  expect(await draw($)).toContain('work 5h 0% 7d 30%')
  expect(Object.keys(m.files)).toContain(`${DIR}/ffff0000.json`)
})

test('/status-line account-label names this account in its file', async ($, on) => {
  const m = engine(on, { env: { CLAUDE_CONFIG_DIR: '/Users/test/.claude-uni' } })
  await measure($)
  const r = await $.command.run({ command: 'status-line', args: 'account-label Uni Team' } as any)
  expect((r as any).text).toContain('"Uni Team"')
  expect(JSON.parse(m.files[`${DIR}/f028c80d.json`]).label).toBe('Uni Team')
  const back = await $.command.run({ command: 'status-line', args: 'account-label reset' } as any)
  expect((back as any).text).toContain('"uni"')
})

test('live read refreshes an old reading with an unexpired token and never shows the token', async ($, on) => {
  const creds = (expiresAt: number) => JSON.stringify({ claudeAiOauth: { accessToken: 'secret-token', expiresAt } })
  const http = (e: any) =>
    e.url === 'https://api.anthropic.com/api/oauth/usage' && e.init?.headers?.authorization === 'Bearer secret-token'
      ? { status: 200, ok: true, headers: {}, text: JSON.stringify({ five_hour: { utilization: 55, resets_at: '2026-11-11T12:00:00Z' }, seven_day: { utilization: 40, resets_at: '2026-11-14T09:00:00Z' } }) }
      : { status: 401, ok: false, headers: {}, text: '' }
  const old = other({ at: '2026-11-11T07:00:00Z' })
  {
    const m = engine(on, {
      env: { CLAUDE_CONFIG_DIR: '/Users/test/.claude-uni' }, files: { [`${DIR}/abcd1234.json`]: old },
      secrets: { 'Claude Code-credentials-abcd1234': creds(NOW + 3_600_000) }, http,
    })
    await measure($)
    await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
    const line = await draw($)
    expect(line).toContain('work 5h 55% 7d 40% ⟳2h00m')
    expect(line).not.toContain('secret-token')
    expect(JSON.stringify(m.files)).not.toContain('secret-token')
  }
})

test('an expired token or "live off" keeps the saved reading', async ($, on) => {
  const expired = JSON.stringify({ claudeAiOauth: { accessToken: 'secret-token', expiresAt: NOW - 1000 } })
  const m = engine(on, {
    env: { CLAUDE_CONFIG_DIR: '/Users/test/.claude-uni' }, files: { [`${DIR}/abcd1234.json`]: other({ at: '2026-11-11T07:00:00Z' }) },
    secrets: { 'Claude Code-credentials-abcd1234': expired },
  })
  await measure($)
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  expect(await draw($)).toContain('work 5h 21% 7d 30%')
  expect(m.fetched.filter(f => String(f.url).includes('anthropic'))).toHaveLength(0)
  const off = await $.command.run({ command: 'status-line', args: 'live off' } as any)
  expect((off as any).text).toContain('off')
})

const codexLive = (over: any = {}) => ({
  status: 200, ok: true, headers: {},
  text: JSON.stringify({
    plan_type: 'plus',
    rate_limit: {
      primary_window: { used_percent: 4, limit_window_seconds: 18000, reset_at: NOW / 1000 + 3600 },
      secondary_window: { used_percent: 1, limit_window_seconds: 604800, reset_at: NOW / 1000 + 86400 },
    },
    ...over,
  }),
})

test('Codex 5h and 7d from the live endpoint, honouring CODEX_HOME', async ($, on) => {
  const m = engine(on, {
    env: { CODEX_HOME: '/cx' },
    files: { '/cx/auth.json': JSON.stringify({ tokens: { access_token: 'cx-token', account_id: 'acc-1' } }) },
    http: e => (e.url === 'https://chatgpt.com/backend-api/wham/usage' && e.init?.headers?.authorization === 'Bearer cx-token' && e.init?.headers?.['chatgpt-account-id'] === 'acc-1' ? codexLive() : undefined),
  })
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  const line = await draw($)
  console.log('codex:', line)
  expect(line).toContain('Codex 5h 4% 7d 1% ⟳1h00m')
  expect(line).not.toContain('cx-token')
  expect(m.fetched).toHaveLength(1)
})

test('Codex falls back to the newest session rollout, shown with its own window lengths', async ($, on) => {
  const rollout = JSON.stringify({
    timestamp: '2026-11-11T09:59:00Z',
    payload: { rate_limits: { primary: { used_percent: 12.4, window_minutes: 43200, resets_at: NOW / 1000 + 86400 }, secondary: null } },
  })
  engine(on, {
    files: {
      '/Users/test/.codex/auth.json': JSON.stringify({ tokens: { access_token: 'cx-token' } }),
      '/Users/test/.codex/sessions/2026/11/10/rollout-2026-11-10T08-00-00-aaa.jsonl': 'old',
      '/Users/test/.codex/sessions/2026/11/11/rollout-2026-11-11T09-00-00-bbb.jsonl': `{"type":"x"}\n${rollout}\n`,
    },
  }) // the HTTP service answers 404: fallback
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  expect(await draw($)).toContain('Codex 30d 12% ⟳1d0h')
})

test('no Codex and no other account: nothing new is shown', async ($, on) => {
  engine(on)
  await measure($)
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  const line = await draw($)
  expect(line).not.toContain('Codex')
  expect(line).not.toContain('5h 0%')
})

test('Kiro reads the XDG data dir when the macOS one is absent', async ($, on) => {
  const dbs: string[] = []
  engine(on, {
    env: { XDG_DATA_HOME: '/xdata' },
    run: argv => (argv[0] === 'sqlite3' ? (dbs.push(argv[2]), { exitCode: 1, stdout: '', stderr: '' }) : undefined),
  })
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  expect(dbs[0]).toBe('/xdata/kiro-cli/data.sqlite3')
})
