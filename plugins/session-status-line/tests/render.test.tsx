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

// Outside budgets: Kiro over its limit with overage, Copilot used up, Claude's
// 5h window full so its extra usage shows. The test's hooks stand for sqlite3,
// gh and the two HTTP services; no real call leaves the test.
const quotaEngine = (on: any, opts: { kiroStatus?: number; whoamiFails?: boolean; tokenExpired?: boolean } = {}) => {
  const now = Date.parse('2026-10-31T12:00:00Z')
  mock.clock(on, { now })
  mock.store(on)
  on('session.measure', ($: any, e: any) => ({ changed: e.changed }))
  on('env.get', ($: any, e: any) => ({ value: e.name === 'HOME' ? '/Users/test' : undefined }))
  on('session.authorize', () => ({ value: { handle: 'h1', kind: 'bearer' } }))
  const run = (e: any): any => {
    const [cmd, , , sql] = e.argv
    if (cmd === 'sqlite3' && String(sql).includes('auth_kv')) {
      const expires = new Date(now + (opts.tokenExpired ? -60_000 : 3_600_000)).toISOString()
      return { exitCode: 0, stdout: JSON.stringify({ access_token: 'tok', expires_at: expires }), stderr: '' }
    }
    if (cmd === 'sqlite3') return { exitCode: 0, stdout: JSON.stringify({ arn: 'arn:aws:codewhisperer:us-east-1:1:profile/X' }), stderr: '' }
    if (cmd === 'kiro-cli') return { exitCode: opts.whoamiFails ? 1 : 0, stdout: '', stderr: '' }
    if (cmd === 'gh') {
      return {
        exitCode: 0, stderr: '',
        stdout: JSON.stringify({
          quota_reset_date_utc: '2026-11-01T00:00:00.000Z',
          quota_snapshots: { premium_interactions: { entitlement: 30000, credits_used: 30000, remaining: 0, unlimited: false } },
        }),
      }
    }
    return { exitCode: 127, stdout: '', stderr: 'not found' }
  }
  on('process.run', ($: any, e: any) => ({ value: run(e) }))
  const fetch = (e: any): any => {
    if (e.url.includes('codewhisperer.us-east-1')) {
      if (e.init?.headers?.authorization !== 'Bearer tok') return { status: 400, ok: false, headers: {}, text: '' }
      const status = opts.kiroStatus ?? 200
      return {
        status, ok: status === 200, headers: {},
        text: JSON.stringify({
          nextDateReset: Date.parse('2026-11-01T00:00:00Z') / 1000,
          usageBreakdownList: [{ resourceType: 'CREDIT', currency: 'USD', currentUsageWithPrecision: 2059.35, usageLimitWithPrecision: 2000, overageCharges: 2.374 }],
        }),
      }
    }
    if (e.url === 'https://api.anthropic.com/api/oauth/usage' && e.init?.auth === 'h1') {
      return { status: 200, ok: true, headers: {}, text: JSON.stringify({ extra_usage: { is_enabled: true, monthly_limit: 5000, used_credits: 1240, currency: 'USD' } }) }
    }
    return { status: 404, ok: false, headers: {}, text: '' }
  }
  on('http.fetch', ($: any, e: any) => ({ value: fetch(e) }))
}

test('shows Kiro, Copilot and Claude extra usage', async ($, on) => {
  quotaEngine(on)
  await $.session.measure({ context: { tokens: 10_000, window: 200_000, percent: 5 }, rateLimits: [
    { kind: 'five_hour', percentUsed: 100, resetsAt: '2026-10-31T13:00:00Z' },
  ], changed: ['context'] } as any)
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  for (const surface of ['terminal', 'desktop'] as const) {
    const wide = await draw($, surface, 220)
    console.log(surface, 'quotas:', wide)
    expect(wide).toContain('Kiro 103% +$2.37 ⟳12h00m')
    expect(wide).toContain('Copilot 100% ⟳12h00m')
    expect(wide).toContain('extra $12.40/$50')
  }
  const off = await $.command.run({ command: 'status-line', args: 'quotas off' } as any)
  expect((off as any).text).toContain('off')
  expect(await draw($, 'terminal', 220)).not.toContain('Kiro')
})

test('a stale Kiro login asks to log in', async ($, on) => {
  quotaEngine(on, { tokenExpired: true, whoamiFails: true })
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  const line = await draw($, 'terminal', 220)
  expect(line).toContain('Kiro log in')
  expect(line).toContain('Copilot 100%')
  // No Claude window is full here, but credits were spent this month, so extra usage shows.
  expect(line).toContain('extra $12.40')
})

test('a rejected Kiro token also asks to log in', async ($, on) => {
  quotaEngine(on, { kiroStatus: 403 })
  await $.command.run({ command: 'status-line', args: 'quotas on' } as any)
  expect(await draw($, 'terminal', 220)).toContain('Kiro log in')
})
