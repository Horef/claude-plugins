// Engine tests for model-router: planning, routing, costs, reruns, skill routing, rule delivery, all surfaces.
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const PLAN = 'mcp__model-router__plan'
const PANE = {
  plugin: 'model-router',
  component: 'Pane',
  requestId: 'model-router',
  props: {
    title: 'Model router',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 80 },
    view: {},
  },
} as const

const lastRow = (rows: { appended: () => readonly unknown[] }) =>
  JSON.stringify(rows.appended().at(-1) ?? '')

type Call = { tool: string; model?: string; effort?: string; prompt?: string }

test('plans, routes, prices, reruns and routes skills', async ($, on) => {
  const calls: Call[] = []
  const prompts: { text: string; context?: readonly string[] }[] = []
  const statuses: (string | undefined)[] = []
  const store = new Map<string, unknown>([['settings', { skills: { 'scientific-figures': 'standard' } }]])

  on('command.register', () => ({ value: { command: 'router' } }))
  on('tool.register', () => ({ value: { tool: PLAN } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', (_, e) => ({ value: store.get((e as { key: string }).key) }))
  on('store.set', (_, e) => {
    store.set((e as { key: string }).key, (e as { value: unknown }).value)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => {
    prompts.push(e as { text: string; context?: readonly string[] })
    return { text: (e as { text: string }).text }
  })
  on('ui.status', (_, e) => {
    statuses.push((e as { text?: string }).text)
    return { value: undefined }
  })
  on('agent.list', () => ({ value: [{ id: 'a1', description: '[u1] list files', type: 'Explore', status: 'completed' }] }))
  on('turn.complete', (_, e) => ({ text: (e as { answer: string }).answer }))
  const usageFor: Record<string, unknown> = {}
  on('turn.step', async function* (_, e) {
    const x = e as { turnId: string; index: number }
    return { turnId: x.turnId, index: x.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: usageFor[x.turnId] ?? null } as never
  })
  const step = async (turnId: string, usage: unknown, agentId?: string) => {
    usageFor[turnId] = usage
    const st = $.turn.step({ turnId, index: 0, model: 'x', messageCount: 1, ...(agentId ? { agentId } : {}) } as never)
    for await (const _ of st) void _
    return st.result
  }
  const composed: string[][] = []
  const rows = mock.session(on)
  on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' as const }] }))
  on('tool.call', (_, e) => {
    calls.push(e as Call)
    return { result: { agentId: 'a1' } }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(statuses.at(-1)).toContain('Router on')
  expect(statuses.at(-1)).toContain('next message')

  // The rules reach the main model's system prompt, and the status line says so.
  const prompt = await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['desktop'], tools: [PLAN, 'Agent'], outputStyle: null, traits: [] } as never)
  composed.push(prompt.sections.map(x => x.id))
  expect(composed.at(-1)).toContain('model-router:policy')
  expect(statuses.at(-1)).toContain('next message')
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('# Model routing')
  await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['desktop'], tools: [PLAN, 'Agent'], outputStyle: null, traits: [] } as never)
  expect(statuses.at(-1)).toContain('rules sent to opus')

  // Settings: open them, turn on auto-approve and Always plan from the pane.
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'auto' })
  await pane.press({ key: 'always' })
  await pane.press({ key: 'open-pane' })
  await pane.unmount()
  expect(store.get('autoApprove')).toBe(true)
  expect(store.get('alwaysPlan')).toBe(true)
  expect((store.get('settings') as { openPane: boolean }).openPane).toBe(true)

  const planned = await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'u1', title: 'List files', tier: 'light', where: 'agent' },
      { id: 'u2', title: 'Check marketplace', tier: 'standard', where: 'here' },
    ],
  } as never)
  expect(String(planned.result)).toContain('auto-approved')

  // A tagged delegation runs on its tier; an untagged one passes untouched.
  await $.tool.call({ tool: 'Agent', description: '[u1] list files', prompt: 'go' })
  expect(calls.at(-1)?.model).toBe('haiku')
  expect(calls.at(-1)?.effort).toBe('low')
  expect(calls.at(-1)?.prompt).toBe('go')
  await $.tool.call({ tool: 'Agent', description: 'other', prompt: 'go' })
  expect(calls.at(-1)?.model).toBe(undefined)

  // The main chat runs on Opus; the subagent's responses are priced at Haiku and compared.
  await step('t0', { model: 'claude-opus-5-5', input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 50000, output_tokens: 500 })
  await step('t1', { model: 'claude-haiku-5-5', input_tokens: 2, cache_creation_input_tokens: 4000, cache_read_input_tokens: 37000, output_tokens: 1000 }, 'a1')

  // Live: before the subagent finishes, the plan, chat and all-time numbers already moved together.
  const live = store.get('lifetime') as { agentCost: number; steps: number; mainCost: number }
  expect(live.agentCost).toBeGreaterThan(0)
  expect(live.mainCost).toBeGreaterThan(0)
  expect(live.steps).toBe(0)
  expect(statuses.at(-1)).toContain('saved')
  const mid = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const planSaved = (await mid.find({ type: 'Text', text: /of the total$/ }))?.text
  await mid.press({ key: 'cost-view:chat' })
  expect((await mid.find({ type: 'Text', text: /of the total$/ }))?.text).toBe(planSaved)
  await mid.press({ key: 'cost-view:plan' })
  await mid.unmount()

  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a1' } as never)
  expect(statuses.at(-1)).toContain('1/2 done')
  expect(statuses.at(-1)).toContain('saved')
  expect((store.get('history') as unknown[]).length).toBe(1)
  const life = store.get('lifetime') as { steps: number; plans: number; agentCost: number; mainEquivalent: number; byTier: { light: number } }
  expect(life.plans).toBe(1)
  expect(life.steps).toBe(1)
  expect(life.byTier.light).toBe(1)
  expect(life.mainEquivalent).toBeGreaterThan(life.agentCost)

  // The start-up-heavy note reaches the model with the next plan call.
  const after = await $.tool.call({ tool: PLAN, done: ['u2'] } as never)
  expect(String(after.result)).toContain('mostly subagent start-up cost')

  // The card shows cost and savings, and offers the next rung.
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /saved ≈/ }))?.text).toContain('saved')
  expect((await ui.find({ type: 'Text', text: /^Done in this chat, on opus/ }))?.text).toContain('only picks a model')
  await ui.press({ key: 'cost-view:all' })
  expect((await ui.find({ type: 'Text', text: /delegated steps in 1 plans/ }))?.text).toContain('light 1')
  await ui.press({ key: 'cost-view:chat' })
  expect((await ui.find({ type: 'Text', text: /^Since this chat was opened/ }))?.text).toContain('1 delegated steps')
  await ui.press({ key: 'cost-view:plan' })
  await ui.press({ key: 'rerun:u1' })
  await ui.unmount()
  expect(prompts.at(-1)?.text).toContain('haiku/medium')
  await $.tool.call({ tool: 'Agent', description: '[u1] list files', prompt: 'go' })
  expect(calls.at(-1)?.effort).toBe('medium')
  expect((store.get('history') as { rerun: boolean }[])[0]?.rerun).toBe(true)

  // A mapped skill is sent to a subagent on its tier.
  const skill = await $.tool.call({ tool: 'Skill', skill: 'scientific-figures' })
  expect(String(skill.deny ?? '')).toContain('[skill:scientific-figures]')
  await $.tool.call({ tool: 'Agent', description: '[skill:scientific-figures] draw', prompt: 'use the skill' })
  expect(calls.at(-1)?.model).toBe('sonnet')

  // The scope note joins briefs only for a tier that has it on.
  const set = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await set.press({ key: 'set-scope:light' })
  await set.unmount()
  await $.tool.call({ tool: 'Agent', description: '[u1] list files', prompt: 'go' })
  expect(calls.at(-1)?.prompt).toContain('Scope:')

  // Always plan adds a hidden reminder at the start of each main turn.
  await $.turn.start({ text: 'do the thing', turnId: 'tA' })
  expect(lastRow(rows)).toContain('Always plan')
  expect(lastRow(rows)).not.toContain('# Model routing')  // already in the chat

  // Mobile has no pickers: the tier is a button that cycles.
  const phone = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await phone.press({ key: 'tier:u1' })
  await phone.unmount()

  // A narrow pane with settings open still draws every control, Done included.
  const narrow = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 28 }, surface: 'terminal' } as never)
  expect((await narrow.find({ type: 'Button', key: 'settings-done' } as never))).toBeTruthy()
  // The terminal draws no Select (its list opens inline and shifts the row): pickers
  // are buttons that cycle to the next option on Enter.
  expect(await narrow.find({ type: 'Select' } as never)).toBeFalsy()
  const tierBtn = await narrow.find({ type: 'Button', key: 'set-model:light' } as never)
  expect(String((tierBtn as any)?.text ?? JSON.stringify(tierBtn))).toContain('⇄')
  await narrow.press({ key: 'set-model:light' })
  await narrow.unmount()

  // The whole pane, settings open, draws on every surface.
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const any = await $.ui.mount({ ...PANE, surface })
    expect((await any.find({ type: 'Text', text: /^Model router$/ }))?.text).toBe('Model router')
    expect((await any.find({ type: 'Text', text: /runs ·/ }))?.text).toContain('reruns')
    await any.unmount()
  }
})

test('in the desktop app the rules are written into the chat, and return with the plan after a summary', async ($, on) => {
  const statuses: (string | undefined)[] = []
  const store = new Map<string, unknown>([['autoApprove', true]])
  const SDK = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['desktop'], tools: [PLAN, 'Agent'], outputStyle: null, traits: ['sdk-preset'] }
  const summaryMsg = { role: 'user' as const, text: 'summary', toolUses: [] }

  on('command.register', () => ({ value: { command: 'router' } }))
  on('tool.register', () => ({ value: { tool: PLAN } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', (_, e) => ({ value: store.get((e as { key: string }).key) }))
  on('store.set', (_, e) => {
    store.set((e as { key: string }).key, (e as { value: unknown }).value)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.status', (_, e) => {
    statuses.push((e as { text?: string }).text)
    return { value: undefined }
  })
  const rows = mock.session(on)
  on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' as const }] }))
  on('session.compact', () => ({ messages: [summaryMsg] }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  // The preset's prompt gets no section, and the status line does not claim the rules arrived.
  const first = await $.prompt.compose(SDK as never)
  expect(first.sections.map(x => x.id)).not.toContain('model-router:policy')
  expect(statuses.at(-1)).toContain('next message')

  // The next main turn writes them into the chat once; then the status line says so.
  await $.turn.start({ text: 'hello', turnId: 't1' })
  expect(lastRow(rows)).toContain('# Model routing')
  await $.prompt.compose(SDK as never)
  expect(statuses.at(-1)).toContain('rules sent to opus')
  const count = rows.appended().length
  await $.turn.start({ text: 'again', turnId: 't2' })
  expect(rows.appended().length).toBe(count)

  // A subagent's turn gets nothing.
  await $.turn.start({ text: 'sub', turnId: 't3', agentId: 'a9' })
  expect(rows.appended().length).toBe(count)

  // After a summary of the main chat, the rules and the plan come back together.
  await $.tool.call({ tool: PLAN, steps: [{ id: 'p1', title: 'Read papers', tier: 'light', where: 'agent' }] } as never)
  await $.session.compact({ trigger: 'manual', messages: [summaryMsg, { ...summaryMsg, text: 'old' }] } as never)
  await $.turn.start({ text: 'continue', turnId: 't4' })
  const row = lastRow(rows)
  expect(row).toContain('# Model routing')
  expect(row).toContain('conversation was summarized')
  expect(row).toContain('[p1] Read papers')
  const after = rows.appended().length
  await $.turn.start({ text: 'and on', turnId: 't5' })
  expect(rows.appended().length).toBe(after)

  // The status check reports what the router sees.
  const status = await $.tool.call({ tool: PLAN, status: true } as never)
  expect(String(status.result)).toContain('"via":"message"')
  expect(String(status.result)).toContain('"inChat":true')
})

// --- Helpers (other subscriptions) and plan reuse -------------------------------------

type Registered = { inputSchema?: { properties?: { steps?: { items?: { properties?: { where?: { enum?: string[] } } } } } } }

/** The engine mocks the tests below share; `init` is what the store holds when the chat starts. */
const boot = async (
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  init: [string, unknown][],
  agents: { id: string; description: string }[] = [],
) => {
  const store = new Map<string, unknown>([['autoApprove', true], ...init])
  const registered: Registered[] = []
  const calls: Call[] = []
  const usageFor: Record<string, unknown> = {}
  // The effort each request went out with, after the plugin's hooks.
  const sent: (string | number | undefined)[] = []

  on('command.register', () => ({ value: { command: 'router' } }))
  on('tool.register', (_, e) => {
    registered.push(e as Registered)
    return { value: { tool: PLAN } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', (_, e) => ({ value: store.get((e as { key: string }).key) }))
  on('store.set', (_, e) => {
    store.set((e as { key: string }).key, (e as { value: unknown }).value)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }))
  on('turn.complete', (_, e) => ({ text: (e as { answer: string }).answer }))
  on('agent.list', () => ({ value: agents.map(a => ({ ...a, type: 'general-purpose', status: 'running' })) }))
  on('turn.step', async function* (_, e) {
    const x = e as { turnId: string; index: number; effort?: string | number }
    sent.push(x.effort)
    return { turnId: x.turnId, index: x.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: usageFor[x.turnId] ?? null } as never
  })
  const rows = mock.session(on)
  on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' as const }] }))
  on('tool.call', (_, e) => {
    calls.push(e as Call)
    return { result: { agentId: 'a1' } }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  // Without agentId the usage is the main chat's own.
  const step = async (turnId: string, usage: unknown, agentId?: string, effort?: string) => {
    usageFor[turnId] = usage
    const st = $.turn.step({ turnId, index: 0, model: 'x', messageCount: 1, ...(agentId ? { agentId } : {}), ...(effort ? { effort } : {}) } as never)
    for await (const _ of st) void _
    return st.result
  }

  return { store, registered, calls, rows, step, sent }
}

const wheres = (r: Registered | undefined) => r?.inputSchema?.properties?.steps?.items?.properties?.where?.enum

test('with helpers off the rules and the plan tool are those of 0.9.3, and a helper step becomes an agent step', async ($, on) => {
  const { registered, rows } = await boot($, on, [])

  expect(wheres(registered.at(-1))).toEqual(['agent', 'here'])
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('# Model routing')
  expect(lastRow(rows).toLowerCase()).not.toContain('helper')
  expect(lastRow(rows)).not.toContain('herdr-delegate')

  const planned = await $.tool.call({
    tool: PLAN,
    steps: [{ id: 'h1', title: 'Survey the field', tier: 'deep', where: 'helper' }],
  } as never)
  expect(String(planned.result)).toContain('[h1] Survey the field: deep, opus/high, planned')
  expect(String(planned.result)).not.toContain('helper')
})

test('with helpers on the rules name the skill and the tier orders, and a helper step keeps its place', async ($, on) => {
  // Settings stored by an older version have no `helpers` key beyond what the user set.
  const { registered, rows } = await boot($, on, [['settings', { helpers: { enabled: true } }]])

  expect(wheres(registered.at(-1))).toEqual(['agent', 'here', 'helper'])
  await $.turn.start({ text: 'first', turnId: 't0' })
  const rules = lastRow(rows)
  expect(rules).toContain('runs a step on an agent from another subscription')
  expect(rules).toContain('herdr-delegate')
  expect(rules).toContain('kiro-light,copilot-light,agy-light')
  expect(rules).toContain('kiro-standard,copilot-standard,agy-standard')
  expect(rules).toContain('kiro-deep,copilot-deep,agy-deep')
  expect(rules).toContain('over ~15 tool calls')
  expect(rules).toContain('If no helper is usable')

  const planned = await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'h1', title: 'Survey the field', tier: 'deep', where: 'helper' },
      { id: 'l1', title: 'List files', tier: 'light', where: 'agent' },
    ],
  } as never)
  expect(String(planned.result)).toContain('[h1] Survey the field: deep, helper (kiro-deep → copilot-deep → agy-deep), planned')
  expect(String(planned.result)).toContain('[l1] List files: light, haiku/low, planned')
})

test('with helpers set to all steps the rules say so, and the pane switches helpers off', async ($, on) => {
  const { store, rows } = await boot($, on, [['settings', { helpers: { enabled: true, use: 'all', skill: 'my-delegate' } }]])
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('my-delegate')
  expect(lastRow(rows)).toContain('every self-contained step')
  expect(lastRow(rows)).not.toContain('over ~15 tool calls')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'helpers' })
  await pane.unmount()
  expect((store.get('settings') as { helpers: { enabled: boolean; use: string } }).helpers.enabled).toBe(false)
  expect((store.get('settings') as { helpers: { use: string } }).helpers.use).toBe('all')
})

test('Copilot Fusion is off by default and, when picked in the pane, goes before the pinned Copilot helper', async ($, on) => {
  const { store, rows } = await boot($, on, [['settings', { helpers: { enabled: true } }]])
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).not.toContain('fusion')

  // In the terminal the picker cycles: off → Max for deep → High + Max.
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'helpers-fusion' })
  expect((store.get('settings') as { helpers: { fusion: string } }).helpers.fusion).toBe('deep')
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(lastRow(rows)).toContain('deep: kiro-deep,copilot-fusion-max,copilot-deep,agy-deep')
  expect(lastRow(rows)).toContain('standard: kiro-standard,copilot-standard,agy-standard')

  await pane.press({ key: 'helpers-fusion' })
  await pane.unmount()
  expect((store.get('settings') as { helpers: { fusion: string } }).helpers.fusion).toBe('both')
  await $.turn.start({ text: 'third', turnId: 't2' })
  expect(lastRow(rows)).toContain('standard: kiro-standard,copilot-fusion-high,copilot-standard,agy-standard')

  const planned = await $.tool.call({
    tool: PLAN,
    steps: [{ id: 'h1', title: 'Refactor the parser', tier: 'deep', where: 'helper' }],
  } as never)
  expect(String(planned.result)).toContain('helper (kiro-deep → copilot-fusion-max → copilot-deep → agy-deep)')
})

test('ids reused after a finished plan start the new plan as planned', async ($, on) => {
  const { store } = await boot($, on, [])
  const steps = [
    { id: 's1', title: 'Read', tier: 'light', where: 'here' },
    { id: 's2', title: 'Write', tier: 'standard', where: 'here' },
  ]

  await $.tool.call({ tool: PLAN, steps } as never)
  const finished = await $.tool.call({ tool: PLAN, done: ['s1', 's2'] } as never)
  expect(String(finished.result)).toContain('[s1] Read: light, here, done')

  const again = await $.tool.call({ tool: PLAN, steps } as never)
  expect(String(again.result)).toContain('[s1] Read: light, here, planned')
  expect(String(again.result)).toContain('[s2] Write: standard, here, planned')
  expect(String(again.result)).not.toContain(', done')
  expect((store.get('lifetime') as { plans: number }).plans).toBe(2)

  // A revision of an unfinished plan still keeps its steps' edits.
  await $.tool.call({ tool: PLAN, done: ['s1'] } as never)
  const revised = await $.tool.call({ tool: PLAN, steps } as never)
  expect(String(revised.result)).toContain('[s1] Read: light, here, done')
  expect((store.get('lifetime') as { plans: number }).plans).toBe(2)
})

test('helper steps add no agent cost or steps; one run through the Agent tool becomes a subagent step', async ($, on) => {
  const { store, calls, step } = await boot(
    $,
    on,
    [['settings', { helpers: { enabled: true } }]],
    [
      { id: 'x1', description: '[h2] survey' },
      { id: 'x2', description: '[h1] list files' },
    ],
  )
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'h1', title: 'List files', tier: 'light', where: 'helper' },
      { id: 'h2', title: 'Survey', tier: 'deep', where: 'helper' },
    ],
  } as never)
  const usage = { model: 'claude-haiku-5-5', input_tokens: 2, cache_creation_input_tokens: 4000, cache_read_input_tokens: 37000, output_tokens: 1000 }

  // A subagent's tokens on a step still planned as a helper are not counted.
  await step('t1', usage, 'x1')
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'x1' } as never)
  const none = store.get('lifetime') as { agentCost: number; steps: number; byTier: { deep: number } }
  expect(none.agentCost).toBe(0)
  expect(none.steps).toBe(0)
  expect(none.byTier.deep).toBe(0)

  // Marking a helper step done through the plan tool counts nothing either.
  await $.tool.call({ tool: PLAN, done: ['h2'] } as never)
  expect((store.get('lifetime') as { steps: number }).steps).toBe(0)

  // The fallback: the main chat runs h1 with the Agent tool. It is a subagent step from then on.
  await $.tool.call({ tool: 'Agent', description: '[h1] list files', prompt: 'go' })
  expect(calls.at(-1)?.model).toBe('haiku')
  await step('t2', usage, 'x2')
  const some = store.get('lifetime') as { agentCost: number }
  expect(some.agentCost).toBeGreaterThan(0)
  const text = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(text.result)).toContain('[h1] List files: light, haiku/low, running')
  expect(String(text.result)).toContain('[h2] Survey: deep, helper (kiro-deep → copilot-deep → agy-deep), done')
})

test('minimal view: steps and their pickers only, no explanatory text; kept across chats', async ($, on) => {
  const { store } = await boot($, on, [])
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 's1', title: 'Read', tier: 'light', where: 'here' },
      { id: 's2', title: 'Write', tier: 'standard', where: 'agent' },
    ],
  } as never)
  const text = (re: RegExp) => ({ type: 'Text', text: re }) as never
  const TERMINAL = { ...PANE, surface: 'terminal' } as never

  // Full view first: the explanation under a here step, and the switch row's help.
  const full = await $.ui.mount(TERMINAL)
  expect(await full.find(text(/Runs in this chat on/))).toBeTruthy()
  await full.press({ key: 'settings' })
  expect(await full.find(text(/Plan before any message/))).toBeTruthy()
  expect(await full.find(text(/^ BEHAVIOUR $/))).toBeTruthy()
  await full.unmount()

  // The header button turns Minimal on and remembers it.
  const pane = await $.ui.mount(TERMINAL)
  await pane.press({ key: 'minimal' })
  expect((store.get('settings') as { compact: boolean }).compact).toBe(true)
  expect(await pane.find(text(/Runs in this chat on/))).toBeFalsy()
  expect(await pane.find(text(/Plan before any message/))).toBeFalsy()
  expect(await pane.find({ type: 'Button', key: 'where:s1' } as never)).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'effort:s2' } as never)).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'settings-done' } as never)).toBeTruthy()
  // Still editable: a picker cycles. A here step's tier is a label, not a picker.
  await pane.press({ key: 'tier:s2' })
  expect(await pane.find({ type: 'Button', key: 'tier:s1' } as never)).toBeFalsy()
  await pane.unmount()
  await $.tool.call({ tool: PLAN, done: [] } as never)
})

test('a chat that starts with the minimal view stored draws it', async ($, on) => {
  await boot($, on, [['settings', { compact: true }]])
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'Read', tier: 'light', where: 'here' }] } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await pane.find({ type: 'Text', text: /Runs in this chat on/ } as never)).toBeFalsy()
  expect(await pane.find({ type: 'Button', key: 'where:s1' } as never)).toBeTruthy()
  await pane.unmount()
})

test('a here step is a rating: the rule says so, and one rated above this chat is flagged', async ($, on) => {
  const { step } = await boot($, on, [])
  const rule = await $.prompt.compose({ model: 'claude-sonnet-5-5', promptModel: 'claude-sonnet-5-5', surfaces: ['desktop'], tools: [PLAN, 'Agent'], outputStyle: null, traits: [] } as never)
  expect(JSON.stringify(rule)).toContain('which no tier can change')

  // This chat runs on Sonnet.
  await step('m1', { model: 'claude-sonnet-5-5', input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 50 })
  const res = await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 's1', title: 'Design the schema', tier: 'deep', where: 'here' },
      { id: 's2', title: 'Rename files', tier: 'light', where: 'here' },
      { id: 's3', title: 'Survey', tier: 'deep', where: 'agent' },
    ],
  } as never)
  // The planner hears about the deep step only; the light one and the subagent step are fine.
  expect(String(res.result)).toContain('[s1] Design the schema: deep, here (rated for opus, this chat runs sonnet: consider a subagent), planned')
  expect(String(res.result)).toContain('[s2] Rename files: light, here, planned')
  expect(String(res.result)).toContain('[s3] Survey: deep, opus/high, planned')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find({ type: 'Text', text: /^Rated deep \(opus\), but this chat runs on sonnet/ } as never)).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^Rated light/ } as never)).toBeFalsy()
  await pane.unmount()

  // A here step's tier is a plain label, not a picker; a subagent step keeps its picker.
  const tty = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await tty.find({ type: 'Button', key: 'tier:s1' } as never)).toBeFalsy()
  expect(await tty.find({ type: 'Text', text: /^rated deep$/ } as never)).toBeTruthy()
  expect((await tty.find({ type: 'Button', key: 'tier:s3' } as never))?.text).not.toContain('rated')
  // Sent to a subagent, the step gets its tier picker back.
  await tty.press({ key: 'where:s1' })
  expect(await tty.find({ type: 'Button', key: 'tier:s1' } as never)).toBeTruthy()
  await tty.unmount()
})

// --- Here-step effort (0.14.0, opt-in experiment) ---------------------------------

const props = (r: unknown) => (r as { inputSchema?: { properties?: Record<string, unknown> } } | undefined)?.inputSchema?.properties ?? {}
const opusUse = (context: number, cacheWrite = 0) => ({
  model: 'claude-opus-5-5',
  input_tokens: 10,
  cache_creation_input_tokens: cacheWrite,
  cache_read_input_tokens: context - cacheWrite,
  output_tokens: 100,
})

test('here-step effort is off by default: no start field, no rule, effort untouched', async ($, on) => {
  const { registered, rows, step, sent } = await boot($, on, [])
  expect(props(registered.at(-1)).start).toBeUndefined()
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).not.toContain('start: [')
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'List', tier: 'light', where: 'here' }] } as never)
  await step('m1', opusUse(10_000), undefined, 'high')
  expect(sent.at(-1)).toBe('high')
})

test('here-step effort on: a started step runs at its tier\'s level, lower or higher than the chat\'s, only while the chat is small', async ($, on) => {
  const { store, registered, rows, step, sent } = await boot($, on, [['settings', { hereEffort: { enabled: true, maxContext: 40_000 } }]])
  expect(props(registered.at(-1)).start).toBeTruthy()
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('start: [')

  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 's1', title: 'List files', tier: 'light', where: 'here' },
      { id: 's2', title: 'Decide', tier: 'deep', where: 'here' },
      { id: 's3', title: 'Survey', tier: 'standard', where: 'agent' },
    ],
  } as never)

  // Nothing started: the chat's own effort.
  await step('m1', opusUse(10_000), undefined, 'high')
  expect(sent.at(-1)).toBe('high')

  // s1 started: light's effort (low), and the switch is logged with the cache it cost.
  const started = await $.tool.call({ tool: PLAN, start: ['s1'] } as never)
  expect(String(started.result)).toContain('[s1] List files: light, here, running')
  await step('m2', opusUse(12_000, 11_000), undefined, 'high')
  expect(sent.at(-1)).toBe('low')
  const log = store.get('effortLog') as { from: string; to: string; context: number; cacheWrite: number; cacheRead: number; step?: string }[]
  expect(log.at(-1)).toMatchObject({ from: 'high', to: 'low', step: 's1', cacheWrite: 11_000, cacheRead: 1_000 })
  // The same level again is no switch.
  await step('m3', opusUse(13_000), undefined, 'high')
  expect(sent.at(-1)).toBe('low')
  expect((store.get('effortLog') as unknown[]).length).toBe(1)

  // s1 done, s2 (deep, high) started in a chat on medium: the level goes up to the tier's, and that is a switch too.
  await $.tool.call({ tool: PLAN, done: ['s1'], start: ['s2'] } as never)
  await step('m4', opusUse(14_000), undefined, 'medium')
  expect(sent.at(-1)).toBe('high')
  expect((store.get('effortLog') as { to: string }[]).at(-1)?.to).toBe('high')

  // s2 done, nothing running: back to the chat's own level.
  await $.tool.call({ tool: PLAN, done: ['s2'] } as never)
  await step('m5', opusUse(15_000), undefined, 'medium')
  expect(sent.at(-1)).toBe('medium')

  // A subagent's request is not touched.
  await step('a1', { ...opusUse(5_000), model: 'claude-sonnet-5-5' }, 'x1', 'medium')
  expect(sent.at(-1)).toBe('medium')
})

test('here-step effort on: a chat over the limit keeps its level, and the card says why', async ($, on) => {
  const { step, sent } = await boot($, on, [['settings', { hereEffort: { enabled: true, maxContext: 40_000 } }]])
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'List files', tier: 'light', where: 'here' }] } as never)
  await step('m1', opusUse(90_000), undefined, 'high')
  await $.tool.call({ tool: PLAN, start: ['s1'] } as never)
  await step('m2', opusUse(91_000), undefined, 'high')
  expect(sent.at(-1)).toBe('high')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find({ type: 'Text', text: /^Kept at high: this chat is at 9\dk tokens, over the 40k limit/ } as never)).toBeTruthy()
  await pane.unmount()
})

test('here-step effort: the Settings switch turns it on, adds start to the plan tool, and shows what switches cost', async ($, on) => {
  const { store, registered } = await boot($, on, [['effortLog', [{ at: '2026-11-05T10:00:00Z', from: 'high', to: 'low', context: 20_000, cacheWrite: 19_000, cacheRead: 1_000 }]]])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'settings' })
  expect(await pane.find({ type: 'Text', text: /^1 switch so far: 19k tokens written to the cache, 1k read/ } as never)).toBeTruthy()
  await pane.press({ key: 'here-effort' })
  expect((store.get('settings') as { hereEffort: { enabled: boolean } }).hereEffort.enabled).toBe(true)
  expect(props(registered.at(-1)).start).toBeTruthy()
  await pane.unmount()
})
