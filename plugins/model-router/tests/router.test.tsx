// Engine tests for model-router: planning, routing, costs, reruns, skill routing, rule delivery, all surfaces.
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { EMPTY_HELPER, EMPTY_USAGE, applyDraft, asHelperEffort, asHelperUsage, baseModelId, compareVersions, customTemplate, depthOf, draftCount, effortOfTemplate, fmtCost, fmtMin, genomeNote, helperFacts, helperLadder, helperLine, helperPickFor, helperStep, helperSuggestions, helperTotalsOf, ladderOf, learnedHelpers, learnedRungs, mergeSettings, modelOf, modelWarnings, modelsChecked, newStep, nextRung, offeredModels, parsePrice, rollupOf, settleGroups, suggestions, templateOfRung, templateRung, trimDraft } from '../hooks/logic'
import { helperList, helperOrder, helpersAvailable, helpersOff, noHelperCli, setHelperConfig } from '../hooks/logic'
import { DEFAULT_SETTINGS, LADDER } from '../hooks/tiers'
import type { HistoryEntry, Step } from '../types'

const PLAN = 'mcp__model-router__plan'
const HOME = '/home/tester'
const MIRROR = `${HOME}/.config/model-router/settings.json`
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
// Answers the approval question of a plan when a test sets it (reset by boot).
let asker: ((e: { questions: { question: string }[] }) => Promise<unknown>) | undefined

const boot = async (
  $: Parameters<TestBody>[0],
  on: Parameters<TestBody>[1],
  init: [string, unknown][],
  agents: { id: string; description: string }[] = [],
  files = new Map<string, string>(),
  setup?: () => void,
) => {
  asker = undefined
  const store = new Map<string, unknown>([['autoApprove', true], ...init])
  // The settings mirror lives in a file under the home directory: here, a map of paths to text.
  mock.env(on, { HOME: HOME })
  on('fs.read', (_, e) => {
    const text = files.get((e as { path: string }).path)

    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', (_, e) => {
    files.set((e as { path: string }).path, (e as { text: string }).text)
    return { value: undefined }
  })
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
    // A test may answer the plan's approval question (the dialog is an AskUserQuestion call).
    if ((e as { tool: string }).tool === 'AskUserQuestion' && asker) return asker(e as never) as never
    calls.push(e as Call)
    return { result: { agentId: 'a1' } }
  })

  // More mocks the test needs before the chat starts (helpers.py runs at the start). Without any, helpers.py, hc and the
  // Kiro, Copilot and Antigravity CLIs are all there, as on the owner's machine.
  if (setup) setup()
  else helperWorld(on, files).setup()
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  // Without agentId the usage is the main chat's own.
  const step = async (turnId: string, usage: unknown, agentId?: string, effort?: string) => {
    usageFor[turnId] = usage
    const st = $.turn.step({ turnId, index: 0, model: 'x', messageCount: 1, ...(agentId ? { agentId } : {}), ...(effort ? { effort } : {}) } as never)
    for await (const _ of st) void _
    return st.result
  }

  return { store, registered, calls, rows, step, sent, files }
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

// --- Persistence, helper order, mid-run notes ------------------------------------------

test('a response that arrives while the store is still loading leaves the stored lifetime intact', async ($, on) => {
  const seeded = { mainCost: 5, agentCost: 1, mainEquivalent: 3, steps: 4, plans: 2, since: '2026-10-01T00:00:00.000Z', byTier: { light: 1, standard: 2, deep: 1 } }
  const store = new Map<string, unknown>([['lifetime', seeded]])
  let release!: () => void
  const gate = new Promise<void>(r => (release = r))
  mock.env(on, { HOME })
  on('fs.read', () => ({ deny: 'ENOENT' }))
  on('fs.write', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'router' } }))
  on('tool.register', () => ({ value: { tool: PLAN } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('store.get', async (_, e) => {
    await gate
    return { value: store.get((e as { key: string }).key) }
  })
  on('store.set', (_, e) => {
    store.set((e as { key: string }).key, (e as { value: unknown }).value)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    const x = e as { turnId: string; index: number }
    return { turnId: x.turnId, index: x.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 1000 } } as never
  })

  const starting = $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await new Promise(r => setTimeout(r, 5))
  const st = $.turn.step({ turnId: 't1', index: 0, model: 'x', messageCount: 1 } as never)
  const stepping = (async () => { for await (const _ of st) void _ })()
  await new Promise(r => setTimeout(r, 5))
  release()
  await starting
  await stepping

  const life = store.get('lifetime') as typeof seeded
  expect(life.since).toBe(seeded.since)
  expect(life.steps).toBe(4)
  expect(life.plans).toBe(2)
  expect(life.mainCost).toBeGreaterThan(5)
})

test('an empty store takes its settings back from the mirror; a store that has them wins, and every change is mirrored', async ($, on) => {
  const mirror = {
    settings: { tiers: { light: { model: 'sonnet', effort: 'low', scopeNote: true } }, skills: { 'scientific-figures': 'standard' } },
    autoApprove: true,
    alwaysPlan: true,
  }
  const files = new Map([[MIRROR, JSON.stringify(mirror)]])
  const { store, rows } = await boot($, on, [], [], files)
  const restored = store.get('settings') as { tiers: { light: { model: string; scopeNote: boolean }; deep: { model: string } }; skills: Record<string, string> }
  expect(restored.tiers.light.model).toBe('sonnet')
  expect(restored.tiers.light.scopeNote).toBe(true)
  expect(restored.tiers.deep.model).toBe('opus')
  expect(restored.skills['scientific-figures']).toBe('standard')
  expect(store.get('alwaysPlan')).toBe(true)
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('light (sonnet/low)')

  // Every change is written to the mirror too.
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'set-model:deep' })
  await pane.unmount()
  const written = JSON.parse(files.get(MIRROR) ?? '{}') as { settings: { tiers: { deep: { model: string } } }; alwaysPlan: boolean }
  expect(written.settings.tiers.deep.model).toBe('fable')
  expect(written.alwaysPlan).toBe(true)
})

test('when the store and the mirror both hold settings the store wins, and the mirror is brought up to date', async ($, on) => {
  const files = new Map([[MIRROR, JSON.stringify({ settings: { tiers: { deep: { model: 'sonnet', effort: 'low', scopeNote: false } } } })]])
  const { store } = await boot($, on, [['settings', { tiers: { deep: { model: 'haiku', effort: 'low', scopeNote: false } } }]], [], files)
  expect((store.get('settings') as { tiers: { deep: { model: string } } }).tiers.deep.model).toBe('haiku')
  expect((JSON.parse(files.get(MIRROR) ?? '{}') as { settings: { tiers: { deep: { model: string } } } }).settings.tiers.deep.model).toBe('haiku')
})

test('values that differ from the default carry a dot and a legend', async ($, on) => {
  await boot($, on, [['autoApprove', false]])
  const dots = { type: 'Text', text: /^•$/ } as never
  const legend = { type: 'Text', text: /^• differs from the default$/ } as never
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'settings' })
  expect(await pane.find(legend)).toBeFalsy()
  expect(await pane.find(dots)).toBeFalsy()
  await pane.press({ key: 'set-model:light' })
  expect(await pane.find(legend)).toBeTruthy()
  expect(await pane.findAll(dots)).toHaveLength(1)
  await pane.press({ key: 'always' })
  expect(await pane.findAll(dots)).toHaveLength(2)
  // Back to the default: the dot goes.
  await pane.press({ key: 'always' })
  expect(await pane.findAll(dots)).toHaveLength(1)
  await pane.unmount()
})

test('moving or switching off a helper changes the order in the rules, one note says so, and none when it is back', async ($, on) => {
  const { store, rows } = await boot($, on, [['settings', { helpers: { enabled: true } }]])
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('light: kiro-light,copilot-light,agy-light')

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'helper-down:light:kiro-light' })
  expect((store.get('settings') as { helpers: { tiers: { light: string } } }).helpers.tiers.light).toBe('copilot-light,kiro-light,agy-light')
  await pane.press({ key: 'helper-off:light:agy-light' })
  expect((store.get('settings') as { helpers: { tiers: { light: string } } }).helpers.tiers.light).toBe('copilot-light,kiro-light')
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(lastRow(rows)).toContain('light: copilot-light,kiro-light;')
  expect(lastRow(rows).match(/Helper orders changed/g)?.length).toBe(1)

  // Switching the helper back on puts it last; "Reset to default order" restores the defaults.
  await pane.press({ key: 'helper-on:light:agy-light' })
  expect((store.get('settings') as { helpers: { tiers: { light: string } } }).helpers.tiers.light).toBe('copilot-light,kiro-light,agy-light')
  await pane.press({ key: 'helper-up:light:kiro-light' })
  await pane.press({ key: 'helper-reset' })
  await pane.unmount()
  expect((store.get('settings') as { helpers: { tiers: { light: string } } }).helpers.tiers.light).toBe('kiro-light,copilot-light,agy-light')
  // Back to the first order the chat was told, then to the order of the second.
  const count = rows.appended().length
  await $.turn.start({ text: 'third', turnId: 't2' })
  expect(rows.appended().length).toBeGreaterThan(count)
  expect(lastRow(rows)).toContain('light: kiro-light,copilot-light,agy-light;')
})

test('a helper order that returns to what the chat was told sends no note', async ($, on) => {
  const { rows } = await boot($, on, [['settings', { helpers: { enabled: true } }]])
  await $.turn.start({ text: 'first', turnId: 't0' })
  const count = rows.appended().length
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'helper-down:deep:kiro-deep' })
  await pane.press({ key: 'helper-reset' })
  await pane.unmount()
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(rows.appended().length).toBe(count)
})

test('a step changed in the pane reaches the agent once at the next turn, with the final value, and not at all when it is put back', async ($, on) => {
  const { rows } = await boot($, on, [])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'Survey', tier: 'standard', where: 'agent' }] } as never)
  const noted = { type: 'Text', text: /^change noted, applies from the next turn$/ } as never
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await pane.find(noted)).toBeFalsy()

  // Cycling the tier picker round to where it began is no change.
  const count = rows.appended().length
  for (let i = 0; i < 3; i++) await pane.press({ key: 'tier:s1' })
  expect(await pane.find(noted)).toBeFalsy()
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(rows.appended().length).toBe(count)

  // Passing through deep to rest on light: one note, the final value only. Since 0.19 the edits wait in the draft
  // (nothing is noted) until Send changes.
  await pane.press({ key: 'tier:s1' })
  expect(await pane.find(noted)).toBeFalsy()
  await pane.press({ key: 'tier:s1' })
  for (let i = 0; i < 3; i++) await pane.press({ key: 'model:s1' })
  expect(await pane.find(noted)).toBeFalsy()
  await pane.press({ key: 'draft-send' })
  expect(await pane.find(noted)).toBeTruthy()
  await $.turn.start({ text: 'third', turnId: 't2' })
  const row = lastRow(rows)
  expect(row.match(/\[s1\]/g)?.length).toBe(1)
  expect(row).toContain('tier standard → light')
  expect(row).toContain('model sonnet → opus')
  expect(row).toContain('thinking medium → low')
  expect(row).not.toContain('deep')
  expect(await pane.find(noted)).toBeFalsy()

  // Delivered: the same values send nothing more.
  const after = rows.appended().length
  await $.turn.start({ text: 'fourth', turnId: 't3' })
  expect(rows.appended().length).toBe(after)

  // Where it runs is announced too.
  await pane.press({ key: 'where:s1' })
  await pane.press({ key: 'draft-send' })
  await $.turn.start({ text: 'fifth', turnId: 't4' })
  expect(lastRow(rows)).toContain('runs subagent → here')
  await pane.unmount()
})

test('before the plan is approved no change is announced, and the plan the agent is handed counts as told', async ($, on) => {
  const { rows } = await boot($, on, [['autoApprove', false]])
  await $.turn.start({ text: 'first', turnId: 't0' })
  const planning = $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'Survey', tier: 'standard', where: 'agent' }] } as never)
  await new Promise(r => setTimeout(r, 5))
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'tier:s1' })
  await pane.unmount()
  void planning
  // Not approved yet: nothing to tell.
  const count = rows.appended().length
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(rows.appended().length).toBe(count)
})

// --- Parts, helper and model shown, helper usage (0.17.0) ---------------------------------

const TERMINAL = { ...PANE, surface: 'terminal' } as never
const text = (re: RegExp) => ({ type: 'Text', text: re }) as never
const partsPlan = [
  {
    id: 's1',
    title: 'Survey',
    tier: 'deep',
    where: 'agent',
    parts: [
      {
        id: 'a',
        title: 'Read',
        tier: 'light',
        where: 'agent',
        parts: [
          { id: 's1.a.1', title: 'Readers', tier: 'light', where: 'agent', count: 2 },
          { id: 'b', title: 'Index', tier: 'light', where: 'agent' },
        ],
      },
      { id: 's1.c', title: 'Write up', tier: 'standard', where: 'here' },
    ],
  },
]

test('a plan nests three levels: ids extend the parent\'s, the tree is shown to the agent, a group follows its parts', async ($, on) => {
  const { registered, rows, calls } = await boot($, on, [], [
    { id: 'x1', description: '[s1.a.1] read' },
    { id: 'x2', description: '[s1.a.1] read' },
  ])
  // The schema takes parts, recursively; with helpers off start stays as it was. Since 0.18.0 a done item
  // may carry a verdict (with helpers off, no usage).
  const tool = registered.at(-1) as unknown as { inputSchema: { properties: Record<string, any> } }
  const level1 = tool.inputSchema.properties.steps.items.properties.parts.items.properties
  expect(level1.parts.items.properties.parts.items.properties.count).toBeTruthy()
  expect(tool.inputSchema.properties.done.items.anyOf[0]).toEqual({ type: 'string' })
  expect(tool.inputSchema.properties.done.items.anyOf[1].properties.verdict.enum).toEqual(['ok', 'weak', 'overkill'])
  expect(tool.inputSchema.properties.done.items.anyOf[1].properties.usage).toBeUndefined()
  expect(tool.inputSchema.properties.start).toBeUndefined()

  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('may carry \\"parts\\"')
  expect(lastRow(rows)).toContain('s3, s3.a, s3.a.1')
  expect(lastRow(rows)).toContain('N readers')

  const planned = await $.tool.call({ tool: PLAN, steps: partsPlan } as never)
  expect(String(planned.result)).toContain(
    [
      '[s1] Survey: deep (rates the group), 0 of 3 parts done, planned',
      '  [s1.a] Read: light (rates the group), 0 of 2 parts done, planned',
      '    [s1.a.1] Readers: light, haiku/low, ×2 in parallel, planned',
      '    [s1.a.b] Index: light, haiku/low, planned',
      '  [s1.c] Write up: standard, here, planned',
    ].join('\n'),
  )

  // A group is not delegated; a part is, by its dotted tag, and routed by its own tier.
  const refused = await $.tool.call({ tool: 'Agent', description: '[s1.a] read it all', prompt: 'go' })
  expect(String(refused.deny ?? '')).toContain('[s1.a.1], [s1.a.b]')
  await $.tool.call({ tool: 'Agent', description: '[s1.a.1] read', prompt: 'go' })
  expect(calls.at(-1)?.model).toBe('haiku')
  await $.tool.call({ tool: 'Agent', description: '[s1.a.1] read', prompt: 'go' })
  const during = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(during.result)).toContain('[s1.a.1] Readers: light, haiku/low, ×2 in parallel, running')
  expect(String(during.result)).toContain('[s1] Survey: deep (rates the group), 0 of 3 parts done, running')

  // Two agents, one id: the step is done when the second one ends.
  await $.turn.complete({ answer: 'one', durationMs: 1, isAborted: false, turnId: 'c1', reason: 'answer', agentId: 'x1' } as never)
  const half = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(half.result)).toContain('×2 in parallel, running (1 of 2 finished)')
  await $.turn.complete({ answer: 'two', durationMs: 1, isAborted: false, turnId: 'c2', reason: 'answer', agentId: 'x2' } as never)
  const both = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(both.result)).toContain('[s1.a.1] Readers: light, haiku/low, ×2 in parallel, done')
  expect(String(both.result)).toContain('[s1.a] Read: light (rates the group), 1 of 2 parts done, running')
})

test('a counted step adds up its agents\' cost, counts once, and a group is done when its parts are, or when named done', async ($, on) => {
  const { store, step } = await boot($, on, [], [
    { id: 'x1', description: '[s1.a.1] read' },
    { id: 'x2', description: '[s1.a.1] read' },
  ])
  await $.tool.call({ tool: PLAN, steps: partsPlan } as never)
  const usage = { model: 'claude-haiku-5-5', input_tokens: 2, cache_creation_input_tokens: 4000, cache_read_input_tokens: 37000, output_tokens: 1000 }
  await step('t1', usage, 'x1')
  const one = (store.get('lifetime') as { agentCost: number }).agentCost
  await step('t2', usage, 'x2')
  const two = (store.get('lifetime') as { agentCost: number }).agentCost
  expect(Math.abs(two - one * 2)).toBeLessThan(1e-9)

  await $.turn.complete({ answer: 'one', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'x1' } as never)
  expect((store.get('lifetime') as { steps: number }).steps).toBe(0)
  // An agent ending twice is still one run.
  await $.turn.complete({ answer: 'one again', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'x1' } as never)
  expect((store.get('lifetime') as { steps: number }).steps).toBe(0)
  await $.turn.complete({ answer: 'two', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'x2' } as never)
  expect((store.get('lifetime') as { steps: number }).steps).toBe(1)
  expect((store.get('history') as { cost: number }[]).length).toBe(1)
  expect(Math.abs((store.get('history') as { cost: number }[])[0]!.cost - two / 2)).toBeLessThan(1e-9)

  // The group card shows the sum of its parts; the cost line of the plan does not count it twice.
  const pane = await $.ui.mount(TERMINAL)
  const cards = await pane.findAll(text(/^≈\$[\d.]+ · [\d.]+k tok/))
  // The counted step, its group and the group above it show the same sum.
  expect(cards).toHaveLength(3)
  const dollars = cards.map(c => /^≈(\$[\d.]+)/.exec(c.text)?.[1])
  expect(new Set(dollars).size).toBe(1)
  await pane.unmount()

  // Naming a group done marks its unfinished parts done, and the groups above follow.
  const marked = await $.tool.call({ tool: PLAN, done: ['s1'] } as never)
  for (const line of String(marked.result).split('\n').filter(l => /^\s*\[/.test(l))) expect(line).toMatch(/, done$/)
  expect(String(marked.result)).toContain('[s1] Survey: deep (rates the group), 3 of 3 parts done, done')
})

test('a group is done with its last part', async ($, on) => {
  await boot($, on, [])
  await $.tool.call({ tool: PLAN, steps: partsPlan } as never)
  const some = await $.tool.call({ tool: PLAN, done: ['s1.a.1', 's1.a.b'] } as never)
  expect(String(some.result)).toContain('[s1.a] Read: light (rates the group), 2 of 2 parts done, done')
  expect(String(some.result)).toContain('[s1] Survey: deep (rates the group), 2 of 3 parts done, running')
  const all = await $.tool.call({ tool: PLAN, done: ['s1.c'] } as never)
  expect(String(all.result)).toContain('[s1] Survey: deep (rates the group), 3 of 3 parts done, done')

  // Starting a group starts its unfinished parts.
  const again = await $.tool.call({ tool: PLAN, steps: partsPlan } as never)
  expect(String(again.result)).toContain('[s1.a.b] Index: light, haiku/low, planned')
  const started = await $.tool.call({ tool: PLAN, start: ['s1.a'] } as never)
  expect(String(started.result)).toContain('[s1.a.b] Index: light, haiku/low, running')
  expect(String(started.result)).toContain('[s1.c] Write up: standard, here, planned')

})

test('parts nest in the pane, the indent stops at three levels, each part has its own pickers, and the minimal view stays compact', async ($, on) => {
  const { rows } = await boot($, on, [])
  const deep = [
    {
      id: 's1',
      title: 'L0',
      tier: 'deep',
      where: 'agent',
      parts: [{ id: 'a', title: 'L1', tier: 'standard', where: 'agent', parts: [{ id: 'b', title: 'L2', tier: 'light', where: 'agent', parts: [{ id: 'c', title: 'L3', tier: 'light', where: 'agent', parts: [{ id: 'd', title: 'L4', tier: 'light', where: 'agent' }] }] }] }],
    },
  ]
  await $.turn.start({ text: 'first', turnId: 't0' })
  const res = await $.tool.call({ tool: PLAN, steps: deep } as never)
  // Deeper than the schema spells out is still taken.
  expect(String(res.result)).toContain('        [s1.a.b.c.d] L4: light, haiku/low, planned')

  const pane = await $.ui.mount(TERMINAL)
  const pad = async (id: string) => ((await pane.find({ type: 'Box', key: `row:${id}` } as never))?.props.paddingLeft as number | undefined) ?? 0
  expect(await pad('s1')).toBe(0)
  expect(await pad('s1.a')).toBe(2)
  expect(await pad('s1.a.b')).toBe(4)
  expect(await pad('s1.a.b.c')).toBe(6)
  expect(await pad('s1.a.b.c.d')).toBe(6)
  // A group is a label with its rating; a part has its own pickers.
  expect(await pane.find({ type: 'Button', key: 'tier:s1' } as never)).toBeFalsy()
  expect(await pane.find(text(/^rated deep$/))).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'tier:s1.a' } as never)).toBeFalsy()
  expect(await pane.find({ type: 'Button', key: 'tier:s1.a.b.c.d' } as never)).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'model:s1.a.b.c.d' } as never)).toBeTruthy()
  // Only the part that does the work is counted as a step.
  expect(await pane.find(text(/^0 of 1 steps done$/))).toBeTruthy()

  // Minimal: no border around a group, no explanatory text, pickers still there.
  await pane.press({ key: 'minimal' })
  expect((await pane.find({ type: 'Box', key: 'card:s1' } as never))?.props.borderStyle).toBeUndefined()
  expect(await pane.find({ type: 'Button', key: 'tier:s1.a.b.c.d' } as never)).toBeTruthy()
  expect(await pane.find(text(/^0\/1 done$/))).toBeTruthy()
  await pane.unmount()
  expect(lastRow(rows)).toContain('Model routing')
})

test('a change to a part reaches the agent as one note naming the part', async ($, on) => {
  const { rows } = await boot($, on, [])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: partsPlan } as never)
  const pane = await $.ui.mount(TERMINAL)
  await pane.press({ key: 'tier:s1.a.b' })
  // The first press picks the tier's own model by name, which changes nothing; the second does.
  await pane.press({ key: 'model:s1.a.1' })
  await pane.press({ key: 'model:s1.a.1' })
  // Edits to a running plan wait for Send changes (0.19).
  expect(await pane.find(text(/^change noted, applies from the next turn$/))).toBeFalsy()
  await pane.press({ key: 'draft-send' })
  expect(await pane.find(text(/^change noted, applies from the next turn$/))).toBeTruthy()
  await $.turn.start({ text: 'second', turnId: 't1' })
  const row = lastRow(rows)
  expect(row).toContain('[s1.a.b]')
  expect(row).toContain('tier light → standard')
  expect(row).toContain('[s1.a.1]')
  expect(row).not.toContain('The user changed step [s1]')
  // Told once.
  const count = rows.appended().length
  await $.turn.start({ text: 'third', turnId: 't2' })
  expect(rows.appended().length).toBe(count)
  await pane.unmount()
})

test('a repeated id in the plan is ignored and the agent is told', async ($, on) => {
  await boot($, on, [])
  const res = await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 's1', title: 'A', tier: 'light', where: 'here', parts: [{ id: 'x', title: 'B', tier: 'light', where: 'here' }, { id: 's1.x', title: 'C', tier: 'light', where: 'here' }] },
    ],
  } as never)
  expect(String(res.result)).toContain('repeats were ignored: s1.x')
  expect(String(res.result)).not.toContain(' C: ')
})

test('helper time, usage and group sums are worked out from the steps', () => {
  const step = (id: string, over: Partial<Step> = {}): Step => ({
    id, title: id, tier: 'light', where: 'helper', status: 'done', usage: EMPTY_USAGE, cost: 0, mainCost: 0, reruns: 0, ...over,
  })
  const list = [
    step('g', { group: true }),
    step('g.a', { parent: 'g', helper: 'copilot-standard', startedAt: '2026-11-07T10:00:00Z', endedAt: '2026-11-07T10:10:30Z', helperUsage: { provider: 'copilot', amount: 30.04, unit: 'AIC' } }),
    step('g.b', { parent: 'g', helper: 'kiro-light', startedAt: '2026-11-07T10:00:00Z', endedAt: '2026-11-07T11:05:00Z', helperUsage: { provider: 'kiro', amount: 2.1, unit: 'credits' } }),
    step('g.c', { parent: 'g', where: 'agent' }),
    step('g.d', { parent: 'g', startedAt: '2026-11-07T10:00:00Z', status: 'running' }),
  ]
  const totals = helperTotalsOf(list)
  // The group and the subagent step are not helper steps; the running one is not done yet.
  expect(totals.steps).toBe(2)
  expect(totals.ms).toBe(75.5 * 60_000)
  expect(helperLine(totals)).toBe('Moved off Claude: 2 helper steps, 1 h 16 min; Copilot 30.04 AIC; Kiro 2.1 credits')
  expect(helperLine(EMPTY_HELPER)).toBeUndefined()
  expect(helperLine({ steps: 1, ms: 0, usage: [] })).toBe('Moved off Claude: 1 helper step')
  expect(helperFacts(list[1]!)).toBe('30.04 AIC · 11 min')
  expect(fmtMin(20_000)).toBe('<1 min')
  expect(depthOf(list, list[1]!)).toBe(1)
  expect(rollupOf(list, list[0]!)).toMatchObject({ total: 4, done: 3 })
  expect(settleGroups([{ ...list[0]!, status: 'planned' }, ...list.slice(1)])[0]!.status).toBe('running')
  expect(asHelperUsage({ provider: ' Copilot ', amount: '30.04', unit: 'AIC' })).toEqual({ provider: 'copilot', amount: 30.04, unit: 'AIC' })
  expect(asHelperUsage({ provider: 'copilot', amount: -1, unit: 'AIC' })).toBeUndefined()
  expect(asHelperUsage({ provider: 'copilot', amount: 3 })).toBeUndefined()
})

const HELPERS: [string, unknown][] = [['settings', { helpers: { enabled: true } }]]

test('starting a helper step with the helper and the model it reports shows both, in the plan and on the card', async ($, on) => {
  const { registered, rows } = await boot($, on, HELPERS)
  const tool = registered.at(-1) as unknown as { inputSchema: { properties: Record<string, any> } }
  expect(tool.inputSchema.properties.start.items.anyOf).toHaveLength(2)
  expect(tool.inputSchema.properties.done.items.anyOf).toHaveLength(2)
  await $.turn.start({ text: 'first', turnId: 't0' })
  // The usage comes from `helpers.py usage <name>` (0.21.0), not from reading the screen.
  expect(lastRow(rows)).toContain("helpers.py usage <the helper's name>")
  expect(lastRow(rows)).toContain('never send 0 or a guess')
  expect(lastRow(rows)).not.toContain('Session: N AIC used')
  expect(lastRow(rows)).toContain('the template you launched')

  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'h1', title: 'Survey', tier: 'standard', where: 'helper' },
      { id: 'h2', title: 'Sweep', tier: 'light', where: 'helper' },
    ],
  } as never)
  const started = await $.tool.call({ tool: PLAN, start: [{ id: 'h1', helper: 'copilot-standard', model: 'Claude Sonnet 5.5' }, 'h2'] } as never)
  expect(String(started.result)).toContain('[h1] Survey: standard, helper (copilot-standard · Claude Sonnet 5.5), running')
  expect(String(started.result)).toContain('[h2] Sweep: light, helper (kiro-light → copilot-light → agy-light), running')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^copilot-standard · Claude Sonnet 5\.5$/))).toBeTruthy()
  expect(await pane.find(text(/^Runs on another subscription's agent/))).toBeTruthy()
  await pane.unmount()
})

test('a helper step marked done with its usage: shown on its card, added up per provider and unit in the plan, chat and all-time views, and kept', async ($, on) => {
  const seeded = {
    mainCost: 5, agentCost: 1, mainEquivalent: 3, steps: 4, plans: 2, since: '2026-10-01T00:00:00.000Z', byTier: { light: 1, standard: 2, deep: 1 },
    helper: { steps: 1, ms: 6 * 60_000, usage: [{ provider: 'copilot', amount: 10, unit: 'AIC' }] },
  }
  const { store } = await boot($, on, [...HELPERS, ['lifetime', seeded]])
  const later = () => new Promise(r => setTimeout(r, 5))
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'h1', title: 'Survey', tier: 'standard', where: 'helper' },
      { id: 'h2', title: 'Sweep', tier: 'light', where: 'helper' },
      { id: 'h3', title: 'Check', tier: 'light', where: 'helper' },
    ],
  } as never)
  await $.tool.call({ tool: PLAN, start: [{ id: 'h1', helper: 'copilot-standard', model: 'Claude Sonnet 5.5' }, { id: 'h2', helper: 'kiro-light', model: 'Haiku' }] } as never)
  await later()
  await $.tool.call({ tool: PLAN, done: [{ id: 'h1', usage: { provider: 'copilot', amount: 30.04, unit: 'AIC' } }] } as never)
  await later()
  await $.tool.call({ tool: PLAN, done: [{ id: 'h2', usage: { provider: 'Kiro', amount: '2.1', unit: 'credits' } }, 'h3'] } as never)

  // h3 never reported any: it counts as a step, with no usage and no time.
  const life = store.get('lifetime') as typeof seeded
  expect(life.steps).toBe(4)
  expect(life.mainCost).toBe(5)
  expect(life.helper.steps).toBe(4)
  expect(life.helper.ms).toBeGreaterThan(6 * 60_000)
  expect(life.helper.ms).toBeLessThan(7 * 60_000)
  expect(life.helper.usage).toEqual([
    { provider: 'copilot', amount: 40.04, unit: 'AIC' },
    { provider: 'kiro', amount: 2.1, unit: 'credits' },
  ])

  // The same usage named again changes nothing.
  await $.tool.call({ tool: PLAN, done: [{ id: 'h1', usage: { provider: 'copilot', amount: 99, unit: 'AIC' } }] } as never)
  expect((store.get('lifetime') as typeof seeded).helper.steps).toBe(4)
  expect((store.get('lifetime') as typeof seeded).helper.usage[0]!.amount).toBe(40.04)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^30\.04 AIC · <1 min$/))).toBeTruthy()
  expect(await pane.find(text(/^2\.1 credits · <1 min$/))).toBeTruthy()
  const plan = /^Moved off Claude: 3 helper steps, <1 min; Copilot 30\.04 AIC; Kiro 2\.1 credits$/
  expect(await pane.find(text(plan))).toBeTruthy()
  await pane.press({ key: 'cost-view:chat' })
  expect(await pane.find(text(plan))).toBeTruthy()
  await pane.press({ key: 'cost-view:all' })
  expect(await pane.find(text(/^Moved off Claude: 4 helper steps, 6 min; Copilot 40\.04 AIC; Kiro 2\.1 credits$/))).toBeTruthy()

  // Never converted to money, and reset with the other statistics.
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'reset-stats' })
  await pane.unmount()
  expect((store.get('lifetime') as typeof seeded).helper).toEqual({ steps: 0, ms: 0, usage: [] })
})

test('a lifetime stored before helper totals existed gains them without losing its numbers', async ($, on) => {
  const old = { mainCost: 5, agentCost: 1, mainEquivalent: 3, steps: 4, plans: 2, since: '2026-10-01T00:00:00.000Z', byTier: { light: 1, standard: 2, deep: 1 } }
  const { store } = await boot($, on, [...HELPERS, ['lifetime', old]])
  await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Survey', tier: 'standard', where: 'helper' }] } as never)
  await $.tool.call({ tool: PLAN, done: [{ id: 'h1', usage: { provider: 'copilot', amount: 1.5, unit: 'AIC' } }] } as never)
  const life = store.get('lifetime') as typeof old & { helper: { steps: number; usage: unknown[] } }
  expect(life.since).toBe(old.since)
  expect(life.steps).toBe(4)
  expect(life.helper.steps).toBe(1)
  expect(life.helper.usage).toEqual([{ provider: 'copilot', amount: 1.5, unit: 'AIC' }])
  // Unusable usage is left out.
  await $.tool.call({ tool: PLAN, steps: [{ id: 'h2', title: 'Sweep', tier: 'light', where: 'helper' }] } as never)
  await $.tool.call({ tool: PLAN, done: [{ id: 'h2', usage: { provider: 'copilot', amount: 'lots', unit: 'AIC' } }] } as never)
  expect((store.get('lifetime') as typeof life).helper.usage).toEqual([{ provider: 'copilot', amount: 1.5, unit: 'AIC' }])
})

test('a helper step run through the Agent tool as the fallback drops the helper it never had', async ($, on) => {
  const { calls } = await boot($, on, HELPERS)
  await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Survey', tier: 'standard', where: 'helper' }] } as never)
  await $.tool.call({ tool: PLAN, start: [{ id: 'h1', helper: 'kiro-standard', model: 'Sonnet' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[h1] survey', prompt: 'go' })
  expect(calls.at(-1)?.model).toBe('sonnet')
  const res = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(res.result)).toContain('[h1] Survey: standard, sonnet/medium, running')
})

// --- Verdicts, kinds, learned advice, auto mode, open model list (0.18.0) -------------------

/** One run in the history, as the router stores it. */
const run = (n: number, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  key: `k${n}`,
  tier: 'light',
  where: 'agent',
  model: 'haiku',
  effort: 'low',
  kind: 'code-review',
  cost: 0.01,
  setupHeavy: false,
  rerun: false,
  at: `2026-11-0${Math.min(n, 9)}T10:00:00.000Z`,
  ...over,
})
/** A subagent's run ending. */
const end = ($: Parameters<TestBody>[0], agentId: string, turnId: string) =>
  $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId, reason: 'answer', agentId } as never)
const haikuUse = { model: 'claude-haiku-5-5', input_tokens: 2, cache_creation_input_tokens: 400, cache_read_input_tokens: 3000, output_tokens: 1500 }

test('a delegated step asks for a verdict once, records it on its run with the facts, and a finished step delegated again is a rerun', async ($, on) => {
  const { store, step, calls } = await boot($, on, [], [
    { id: 'x1', description: '[r1] review' },
    { id: 'x2', description: '[r1] review' },
  ])
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'r1', title: 'Review the parser', tier: 'light', where: 'agent', kind: 'Code Review' },
      { id: 'w1', title: 'Write up', tier: 'standard', where: 'here' },
    ],
  } as never)
  await $.tool.call({ tool: 'Agent', description: '[r1] review', prompt: 'go' })
  await new Promise(r => setTimeout(r, 5))
  await step('t1', haikuUse, 'x1')
  await end($, 'x1', 't1')

  // The run's facts are recorded without being asked: kind, where, rung, output, reruns, time.
  const entry = (store.get('history') as HistoryEntry[]).at(-1)!
  expect(entry).toMatchObject({ kind: 'code-review', where: 'agent', model: 'haiku', effort: 'low', output: 1500, reruns: 0, rerun: false })
  expect(entry.ms).toBeGreaterThan(0)
  expect(entry.verdict).toBeUndefined()

  // The next plan call asks for the verdict, once; a here step needs none.
  const asked = await $.tool.call({ tool: PLAN, done: ['w1'] } as never)
  expect(String(asked.result)).toContain('[r1] Review the parser: light, haiku/low, kind code-review, done')
  expect(String(asked.result)).toContain('Verdict needed for [r1]:')
  expect(String(asked.result)).not.toContain('[w1]:')
  const again = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(again.result)).not.toContain('Verdict needed')
  // Named done again without one: asked again.
  const named = await $.tool.call({ tool: PLAN, done: ['r1'] } as never)
  expect(String(named.result)).toContain('Verdict needed for [r1]')

  // The verdict goes onto the run it judges and shows in the plan and on the card.
  const judged = await $.tool.call({ tool: PLAN, done: [{ id: 'r1', verdict: 'weak', why: 'missed two files' }] } as never)
  expect(String(judged.result)).toContain('done (verdict weak)')
  expect(String(judged.result)).not.toContain('Verdict needed')
  expect((store.get('history') as HistoryEntry[]).at(-1)).toMatchObject({ verdict: 'weak', why: 'missed two files' })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^verdict weak: missed two files$/))).toBeTruthy()
  expect((await pane.find(text(/^1 runs · 0 reruns · 1 weak$/)))).toBeTruthy()
  await pane.unmount()

  // Delegated again after it finished: a rerun, so the earlier run counts as weak whatever its verdict.
  await $.tool.call({ tool: 'Agent', description: '[r1] review', prompt: 'again' })
  expect(calls.at(-1)?.model).toBe('haiku')
  const h = store.get('history') as HistoryEntry[]
  expect(h.at(-1)?.rerun).toBe(true)
  await step('t2', { ...haikuUse, output_tokens: 700 }, 'x2')
  await end($, 'x2', 't2')
  const second = (store.get('history') as HistoryEntry[]).at(-1)!
  // The second run's own output, and the rerun before it, are its facts; it starts with no verdict.
  expect(second).toMatchObject({ output: 700, reruns: 1, rerun: false })
  expect(second.verdict).toBeUndefined()
})

test('a helper step enters the history when done, with its template, kind and verdict; without one it is asked for', async ($, on) => {
  const { store } = await boot($, on, HELPERS)
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'h1', title: 'Survey', tier: 'standard', where: 'helper', kind: 'search' },
      { id: 'h2', title: 'Sweep', tier: 'light', where: 'helper' },
    ],
  } as never)
  await $.tool.call({ tool: PLAN, start: [{ id: 'h1', helper: 'copilot-standard', model: 'Claude Sonnet 5.5' }, 'h2'] } as never)
  const res = await $.tool.call({
    tool: PLAN,
    done: [{ id: 'h1', verdict: 'ok', why: 'used as is', usage: { provider: 'copilot', amount: 3, unit: 'AIC' } }, 'h2'],
  } as never)
  const h = store.get('history') as HistoryEntry[]
  expect(h).toHaveLength(2)
  expect(h[0]).toMatchObject({ where: 'helper', helper: 'copilot-standard', kind: 'search', tier: 'standard', verdict: 'ok', why: 'used as is' })
  expect(h[1]!.verdict).toBeUndefined()
  expect(String(res.result)).toContain('Verdict needed for [h2]')
  expect(String(res.result)).not.toContain('[h1],')
  // Given later, the verdict reaches the same run.
  await $.tool.call({ tool: PLAN, done: [{ id: 'h2', verdict: 'overkill' }] } as never)
  expect((store.get('history') as HistoryEntry[])[1]!.verdict).toBe('overkill')
  expect(store.get('history') as HistoryEntry[]).toHaveLength(2)
})

test('the rules list the kinds the history has seen, and a skill-routed step takes the skill\'s name as its kind', async ($, on) => {
  const { rows, store } = await boot(
    $,
    on,
    [
      ['history', [run(1), run(2), run(3, { kind: 'summarize' })]],
      ['settings', { skills: { 'scientific-figures': 'standard' } }],
    ],
    [{ id: 'x1', description: '[skill:scientific-figures] draw' }],
  )
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('kinds used so far: code-review, summarize; reuse one when it fits')
  expect(lastRow(rows)).toContain('done: [{id, verdict, why}]')
  expect(lastRow(rows)).toContain('\\"overkill\\" = plainly mechanical work')

  await $.tool.call({ tool: 'Agent', description: '[skill:scientific-figures] draw', prompt: 'use the skill' })
  await end($, 'x1', 't1')
  expect((store.get('history') as HistoryEntry[]).at(-1)?.kind).toBe('scientific-figures')
})

test('with no history the rules give example kinds', async ($, on) => {
  const { rows } = await boot($, on, [])
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('e.g. code-review, summarize, search, write-code, figure')
})

test('learned advice: one rung up at half weak (a rerun counts), down at half overkill with no recent weak, never under three runs', () => {
  const set = mergeSettings({})
  // Two runs are not enough.
  expect(suggestions([run(1, { verdict: 'weak' }), run(2, { verdict: 'weak' })], set)).toEqual([])
  // Two of three weak, one of them a rerun with an ok verdict: up one rung, with the evidence.
  const up = suggestions([run(1, { verdict: 'weak' }), run(2, { rerun: true, verdict: 'ok' }), run(3, { verdict: 'ok' })], set)
  expect(up).toEqual([{ kind: 'code-review', tier: 'light', from: { model: 'haiku', effort: 'low' }, to: { model: 'haiku', effort: 'medium' }, isRaise: true, why: 'code-review on light: 2 of 3 weak' }])
  // One of three weak: nothing.
  expect(suggestions([run(1, { verdict: 'weak' }), run(2, { verdict: 'ok' }), run(3, { verdict: 'ok' })], set)).toEqual([])
  // Overkill on sonnet: down one rung; with a weak run among the last three, not.
  const std = (n: number, over: Partial<HistoryEntry>) => run(n, { kind: 'search', tier: 'standard', model: 'sonnet', effort: 'medium', ...over })
  const down = suggestions([std(1, { verdict: 'overkill' }), std(2, { verdict: 'overkill' }), std(3, { verdict: 'ok' })], set)
  expect(down[0]).toMatchObject({ kind: 'search', isRaise: false, to: { model: 'haiku', effort: 'high' }, why: 'search on standard: 2 of 3 overkill' })
  expect(suggestions([std(1, { verdict: 'overkill' }), std(2, { verdict: 'overkill' }), std(3, { verdict: 'overkill' }), std(4, { verdict: 'weak' })], set)).toEqual([])
  // Runs with no kind are judged per tier; runs on another rung than the tier's do not count.
  const tier = suggestions([run(1, { kind: undefined, rerun: true }), run(2, { kind: undefined, rerun: true }), run(3, { kind: undefined }), run(4, { kind: undefined, model: 'sonnet', effort: 'high', verdict: 'ok' })], set)
  expect(tier).toEqual([{ tier: 'light', from: { model: 'haiku', effort: 'low' }, to: { model: 'haiku', effort: 'medium' }, isRaise: true, why: 'light steps on haiku/low: 2 of 3 weak' }])
  // A kind with a default of its own is judged on that rung.
  const own = mergeSettings({ kinds: { 'code-review': { model: 'sonnet', effort: 'medium' } } })
  expect(suggestions([run(1, { verdict: 'weak' }), run(2, { verdict: 'weak' }), run(3, { verdict: 'weak' })], own)).toEqual([])
  // Helper runs are recorded but never move a rung.
  expect(suggestions([1, 2, 3].map(n => run(n, { where: 'helper', helper: 'kiro-light', model: undefined, effort: undefined, verdict: 'weak' })), set)).toEqual([])
})

test('applying a kind\'s advice sets its default: persisted, mirrored, marked, used for routing, and reset', async ($, on) => {
  const weak = [run(1, { verdict: 'weak' }), run(2, { verdict: 'weak' }), run(3, { verdict: 'ok' })]
  const { store, files, calls } = await boot($, on, [['history', weak]], [{ id: 'x1', description: '[r1] review' }])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^code-review on light: 2 of 3 weak: raise code-review's default to haiku\/medium\.$/))).toBeTruthy()
  expect(await pane.find(text(/^code-review$/))).toBeTruthy()
  await pane.press({ key: 'apply-kind:code-review' })
  expect((store.get('settings') as { kinds: Record<string, unknown> }).kinds['code-review']).toEqual({ model: 'haiku', effort: 'medium' })
  expect((JSON.parse(files.get(MIRROR) ?? '{}') as { settings: { kinds: Record<string, unknown> } }).settings.kinds['code-review']).toEqual({ model: 'haiku', effort: 'medium' })
  // The advice is gone (the kind now runs on its own rung, with no runs there yet), and the default is marked.
  expect(await pane.find({ type: 'Button', key: 'apply-kind:code-review' } as never)).toBeFalsy()
  await pane.press({ key: 'settings' })
  expect(await pane.find(text(/^→ haiku\/medium$/))).toBeTruthy()
  expect(await pane.find(text(/^• differs from the default$/))).toBeTruthy()

  // A step of that kind runs on it; one of another kind on its tier.
  const res = await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'r1', title: 'Review', tier: 'light', where: 'agent', kind: 'code-review' },
      { id: 'r2', title: 'List', tier: 'light', where: 'agent', kind: 'search' },
    ],
  } as never)
  expect(String(res.result)).toContain('[r1] Review: light, haiku/medium (code-review default), kind code-review, planned')
  expect(String(res.result)).toContain('[r2] List: light, haiku/low, kind search, planned')
  await $.tool.call({ tool: 'Agent', description: '[r1] review', prompt: 'go' })
  expect(calls.at(-1)?.effort).toBe('medium')

  await pane.press({ key: 'kind-reset:code-review' })
  await pane.unmount()
  expect((store.get('settings') as { kinds: Record<string, unknown> }).kinds).toEqual({})
})

test('auto mode is off by default; on, a kind runs on the cheapest rung it did well on, and the owner\'s own pick still wins', async ($, on) => {
  const ok = (n: number, over: Partial<HistoryEntry>) => run(n, { kind: 'summarize', tier: 'standard', verdict: 'ok', ...over })
  // Auto mode wants 5 runs and 90% ok by default (0.19; it was 3 runs and 80%).
  const past = [
    ...[1, 2, 3, 4, 5].map(n => ok(n, { model: 'sonnet', effort: 'medium' })),
    ...[6, 7, 8, 9, 10].map(n => ok(n, { model: 'haiku', effort: 'high' })),
    // Cheaper, but only 4 of 5 ok (80%): not learned.
    ...[11, 12, 13, 14].map(n => ok(n, { model: 'haiku', effort: 'low' })), ok(15, { model: 'haiku', effort: 'low', verdict: 'weak' }),
  ]
  expect(learnedRungs(past, mergeSettings({}))).toEqual({ summarize: { rung: { model: 'haiku', effort: 'high' }, n: 5 } })
  const { store, calls } = await boot($, on, [['history', past]], [{ id: 'x1', description: '[s1] sum' }])
  const plan = [
    { id: 's1', title: 'Summarize', tier: 'standard', where: 'agent', kind: 'summarize' },
    { id: 's2', title: 'Other', tier: 'standard', where: 'agent' },
  ]

  // Off: today's routing exactly.
  const before = await $.tool.call({ tool: PLAN, steps: plan } as never)
  expect(String(before.result)).toContain('[s1] Summarize: standard, sonnet/medium, kind summarize, planned')
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet', effort: 'medium' })

  // On, from Settings: persisted; the step runs on the learned rung, and its card says so.
  const pane = await $.ui.mount(TERMINAL)
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'auto-route' })
  expect((store.get('settings') as { autoRoute: boolean }).autoRoute).toBe(true)
  expect(await pane.find(text(/^auto: haiku · high \(learned, 5 runs\)$/))).toBeTruthy()
  const after = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(after.result)).toContain('[s1] Summarize: standard, haiku/high (auto: learned, 5 runs), kind summarize, running')
  expect(String(after.result)).toContain('[s2] Other: standard, sonnet/medium, planned')
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'high' })

  // The owner picks a model on the step: it wins; the thinking level still comes from auto mode.
  // (A pick in a running plan counts once sent.)
  await pane.press({ key: 'model:s1' })
  await pane.press({ key: 'model:s1' })
  await pane.press({ key: 'draft-send' })
  await pane.unmount()
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet', effort: 'high' })
})

test('a model seen in usage joins the known models and the pickers; with no price its cost is "?" and it saves nothing', async ($, on) => {
  const { store, step } = await boot($, on, [], [{ id: 'x1', description: '[n1] try' }])
  await $.tool.call({ tool: PLAN, steps: [{ id: 'n1', title: 'Try', tier: 'standard', where: 'agent' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[n1] try', prompt: 'go' })
  await step('m1', { model: 'claude-opus-5-5', input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 50 })
  await step('t1', { model: 'claude-nova-6', input_tokens: 2, cache_creation_input_tokens: 4000, cache_read_input_tokens: 37000, output_tokens: 1000 }, 'x1')
  // A synthetic id is not a model.
  await step('m2', { model: '<synthetic>', input_tokens: 0, output_tokens: 0 })

  expect((store.get('settings') as { models: string[] }).models).toEqual(['claude-nova-6'])
  const life = store.get('lifetime') as { agentCost: number; mainEquivalent: number }
  expect(life.agentCost).toBe(0)
  expect(life.mainEquivalent).toBe(0)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  const picker = await pane.find({ type: 'Select', key: 'model:n1' } as never)
  expect((picker?.props.options as { value: string }[]).map(o => o.value)).toEqual(['tier', 'haiku', 'sonnet', 'opus', 'fable', 'claude-nova-6'])
  expect(await pane.find(text(/^\? · 5\.0k tok \+ 37\.0k cached · no price for claude-nova-6: left out of savings/))).toBeTruthy()
  expect(await pane.find(text(/^\?$/))).toBeTruthy()
  // Saved stays empty: nothing was priced on both sides.
  expect(await pane.find(text(/of the total$/))).toBeFalsy()

  // Settings lists it with no price; a price set there is kept, and a model can be added by name.
  await pane.press({ key: 'settings' })
  expect(await pane.find(text(/^no price$/))).toBeTruthy()
  await pane.input({ key: 'price:claude-nova-6', text: '3 15' })
  expect((store.get('settings') as { prices: Record<string, unknown> }).prices['claude-nova-6']).toEqual({ input: 3, cacheWrite: 3.75, cacheRead: 0.30000000000000004, output: 15 })
  await pane.input({ key: 'price:claude-nova-6', text: 'cheap' })
  expect((store.get('settings') as { prices: Record<string, unknown> }).prices['claude-nova-6']).toBeTruthy()
  await pane.input({ key: 'add-model', text: 'Nova' })
  expect((store.get('settings') as { models: string[] }).models).toEqual(['claude-nova-6', 'nova'])
  // A model the defaults know is not added twice.
  await pane.input({ key: 'add-model', text: 'opus' })
  expect((store.get('settings') as { models: string[] }).models).toEqual(['claude-nova-6', 'nova'])
  await pane.press({ key: 'model-remove:nova' })
  await pane.unmount()
  expect((store.get('settings') as { models: string[] }).models).toEqual(['claude-nova-6'])
})

test('the ladder is built from the known models by price, and is the old one when only the defaults are known', () => {
  expect(ladderOf(DEFAULT_SETTINGS)).toEqual(LADDER)
  const set = mergeSettings({ models: ['nova', 'dusk'], prices: { nova: { input: 3, cacheWrite: 3.75, cacheRead: 0.3, output: 15 } } })
  const ladder = ladderOf(set).map(r => `${r.model}/${r.effort}`)
  // nova sits between Sonnet and Opus by price, on medium and high; dusk has no price and is not on it.
  expect(ladder).toEqual(['haiku/low', 'haiku/medium', 'haiku/high', 'sonnet/medium', 'sonnet/high', 'nova/medium', 'nova/high', 'opus/high', 'opus/xhigh', 'fable/high'])
  expect(nextRung({ model: 'sonnet', effort: 'high' }, set)).toEqual({ model: 'nova', effort: 'medium' })
  expect(nextRung({ model: 'dusk', effort: 'high' }, set)).toBeUndefined()
  expect(nextRung({ model: 'fable', effort: 'high' }, set)).toBeUndefined()
  // Ids map to family aliases; an unknown family is kept under its id.
  expect(modelOf('claude-haiku-5-5', set)).toBe('haiku')
  expect(modelOf('claude-nova-6-1', set)).toBe('nova')
  expect(modelOf('claude-ember-7', set)).toBe('claude-ember-7')
  expect(modelOf('<synthetic>', set)).toBeUndefined()
  expect(parsePrice('1 2 0.1 5')).toEqual({ input: 1, cacheWrite: 2, cacheRead: 0.1, output: 5 })
  expect(parsePrice('1')).toBeUndefined()
  expect(fmtCost(0.5, true)).toBe('≈$0.50 + ?')
  expect(fmtCost(0, true)).toBe('?')
})

test('advice for a kind that first reaches its threshold asks the lead, once, to record a strange-loop observation', async ($, on) => {
  const { store, step } = await boot($, on, [['history', [run(1, { verdict: 'weak' }), run(2, { verdict: 'ok' })]]], [
    { id: 'x1', description: '[r1] review' },
    { id: 'x2', description: '[r2] review' },
  ], new Map([[`${HOME}/.config/strange-loop/genome`, '/genome']]))
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'r1', title: 'Review A', tier: 'light', where: 'agent', kind: 'code-review' },
      { id: 'r2', title: 'Review B', tier: 'light', where: 'agent', kind: 'code-review' },
    ],
  } as never)
  await $.tool.call({ tool: 'Agent', description: '[r1] review', prompt: 'go' })
  await step('t1', haikuUse, 'x1')
  await end($, 'x1', 't1')
  // Two runs of three: the threshold is not reached until the verdict comes.
  expect(store.get('genomeNoted')).toBeUndefined()
  const res = await $.tool.call({ tool: PLAN, done: [{ id: 'r1', verdict: 'weak' }] } as never)
  expect(store.get('genomeNoted')).toEqual(['code-review:up'])
  const text0 = String(res.result)
  expect(text0).toContain('Advice for kind "code-review" reached its threshold (code-review on light: 2 of 3 weak)')
  expect(text0).toContain('loop.py" note model-router friction "routing: model-router\'s history says code-review on light: 2 of 3 weak; it suggests raising code-review to haiku/medium"')

  // Another weak run of the same kind: no second note.
  await $.tool.call({ tool: 'Agent', description: '[r2] review', prompt: 'go' })
  await step('t2', haikuUse, 'x2')
  await end($, 'x2', 't2')
  const res2 = await $.tool.call({ tool: PLAN, done: [{ id: 'r2', verdict: 'weak' }] } as never)
  expect(String(res2.result)).not.toContain('strange-loop observation')
  expect(store.get('genomeNoted')).toEqual(['code-review:up'])

  // A kind that is a skill's name is noted to that skill; the kind is cleaned before it reaches a shell command.
  const a = suggestions([1, 2, 3].map(n => run(n, { kind: 'scientific-figures', verdict: 'weak' })), mergeSettings({}))[0]!
  expect(genomeNote(a, 'scientific-figures')).toContain('note scientific-figures friction')
})

test('a main chat on a model with no price counts no saving, and a verdict given before the agent ends goes onto its run', async ($, on) => {
  const { store, step } = await boot($, on, [], [{ id: 'x1', description: '[r1] review' }])
  await $.tool.call({ tool: PLAN, steps: [{ id: 'r1', title: 'Review', tier: 'light', where: 'agent', kind: 'code-review' }] } as never)
  await step('m1', { model: 'claude-nova-6', input_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: 50 })
  await $.tool.call({ tool: 'Agent', description: '[r1] review', prompt: 'go' })
  await step('t1', haikuUse, 'x1')
  const life = store.get('lifetime') as { agentCost: number; mainEquivalent: number; mainCost: number }
  expect(life.agentCost).toBeGreaterThan(0)
  expect(life.mainEquivalent).toBe(life.agentCost)
  expect(life.mainCost).toBe(0)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^\?$/))).toBeTruthy()
  await pane.unmount()

  await $.tool.call({ tool: PLAN, done: [{ id: 'r1', verdict: 'ok', why: 'fine' }] } as never)
  await end($, 'x1', 't1')
  expect((store.get('history') as HistoryEntry[]).at(-1)).toMatchObject({ kind: 'code-review', verdict: 'ok', why: 'fine' })
})

// --- Send changes, helper thinking level, auto mode thresholds (0.19.0) ---------------------

const SEND = { type: 'Button', key: 'draft-send' } as never
const DISCARD = { type: 'Button', key: 'draft-discard' } as never
const surveyPlan = [{ id: 's1', title: 'Survey', tier: 'standard', where: 'agent' }]

test('edits to a running plan wait in a draft: routing and notes ignore them until Send, which applies them and sends one note', async ($, on) => {
  const { rows, calls } = await boot($, on, [], [{ id: 'x1', description: '[s1] survey' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: surveyPlan } as never)
  const pane = await $.ui.mount(TERMINAL)
  expect(await pane.find(SEND)).toBeFalsy()

  // A model, a thinking level and a tier change: the bar counts three values and the cards mark them.
  await pane.press({ key: 'model:s1' })
  await pane.press({ key: 'effort:s1' })
  await pane.press({ key: 'tier:s1' })
  expect((await pane.find(SEND))?.text).toBe('Send changes (3)')
  expect(await pane.find(DISCARD)).toBeTruthy()
  expect(await pane.findAll(text(/^✎$/))).toHaveLength(3)
  // The picker shows the edit; the card does not claim the agent was told.
  expect((await pane.find({ type: 'Button', key: 'tier:s1' } as never))?.text).toContain('deep')
  expect(await pane.find(text(/^change noted/))).toBeFalsy()

  // The plan and the routing are as they were, and the agent hears nothing.
  const count = rows.appended().length
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(rows.appended().length).toBe(count)
  const same = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(same.result)).toContain('[s1] Survey: standard, sonnet/medium, planned')
  await $.tool.call({ tool: 'Agent', description: '[s1] survey', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet', effort: 'medium' })

  // Send: the plan has the final values at once, and the next turn brings one note.
  await pane.press({ key: 'draft-send' })
  expect(await pane.find(SEND)).toBeFalsy()
  expect(await pane.findAll(text(/^✎$/))).toHaveLength(0)
  expect(await pane.find(text(/^change noted, applies from the next turn$/))).toBeTruthy()
  await $.tool.call({ tool: 'Agent', description: '[s1] survey', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'low' })
  await $.turn.start({ text: 'third', turnId: 't2' })
  const row = lastRow(rows)
  expect(row.match(/\[s1\]/g)?.length).toBe(1)
  expect(row).toContain('tier standard → deep')
  expect(row).toContain('model sonnet → haiku')
  expect(row).toContain('thinking medium → low')
  const sent = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(sent.result)).toContain('[s1] Survey: deep, haiku/low, running')
  await pane.unmount()
})

test('Discard drops the draft and leaves the plan as it was; an edit put back leaves no draft', async ($, on) => {
  const { rows, calls } = await boot($, on, [], [{ id: 'x1', description: '[s1] survey' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: surveyPlan } as never)
  const pane = await $.ui.mount(TERMINAL)
  await pane.press({ key: 'tier:s1' })
  await pane.press({ key: 'where:s1' })
  expect((await pane.find(SEND))?.text).toBe('Send changes (2)')
  await pane.press({ key: 'draft-discard' })
  expect(await pane.find(SEND)).toBeFalsy()
  expect(await pane.findAll(text(/^✎$/))).toHaveLength(0)
  expect((await pane.find({ type: 'Button', key: 'tier:s1' } as never))?.text).toContain('standard')
  const count = rows.appended().length
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(rows.appended().length).toBe(count)
  await $.tool.call({ tool: 'Agent', description: '[s1] survey', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet', effort: 'medium' })

  // Cycling a picker back to the plan's own value is no edit.
  for (let i = 0; i < 3; i++) await pane.press({ key: 'tier:s1' })
  expect(await pane.find(SEND)).toBeFalsy()
  await pane.unmount()
})

test('before approval a pane edit goes straight into the plan, which approval then sends', async ($, on) => {
  const { calls } = await boot($, on, [['autoApprove', false]], [{ id: 'x1', description: '[s1] survey' }])
  let answer: (v: string) => void = () => undefined
  asker = e => new Promise(r => { answer = v => r({ result: { answers: { [e.questions[0]!.question]: v } } }) })
  await $.turn.start({ text: 'first', turnId: 't0' })
  const planning = $.tool.call({ tool: PLAN, steps: surveyPlan } as never)
  await new Promise(r => setTimeout(r, 10))
  const pane = await $.ui.mount(TERMINAL)
  await pane.press({ key: 'tier:s1' })
  expect(await pane.find(SEND)).toBeFalsy()
  answer('Run it')
  const res = await planning
  expect(String(res.result)).toContain('[s1] Survey: deep, opus/high, planned')
  await $.tool.call({ tool: 'Agent', description: '[s1] survey', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'opus', effort: 'high' })
  // Approved: from here edits wait.
  await pane.press({ key: 'tier:s1' })
  expect((await pane.find(SEND))?.text).toBe('Send changes (1)')
  await pane.unmount()
})

test('a plan posted anew drops the edits that were never sent; a rerun drops unsent model and thinking picks of its step', async ($, on) => {
  const { calls } = await boot($, on, [], [{ id: 'x1', description: '[s1] survey' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: surveyPlan } as never)
  const pane = await $.ui.mount(TERMINAL)
  await pane.press({ key: 'tier:s1' })
  expect(await pane.find(SEND)).toBeTruthy()
  await $.tool.call({ tool: PLAN, steps: surveyPlan } as never)
  expect(await pane.find(SEND)).toBeFalsy()
  await $.tool.call({ tool: 'Agent', description: '[s1] survey', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet' })
  await pane.unmount()
})

test('pure draft helpers: applying, trimming and counting', () => {
  const s = newStep('s1', 'Survey', 'standard', 'agent')
  expect(applyDraft(s, undefined)).toBe(s)
  expect(applyDraft(s, { tier: 'deep', model: 'opus', effort: null })).toMatchObject({ tier: 'deep', model: 'opus' })
  expect(applyDraft({ ...s, model: 'opus' }, { model: null }).model).toBeUndefined()
  // Values equal to the plan's own are dropped; null equals "the tier's".
  expect(trimDraft(s, { tier: s.tier, model: null })).toBeUndefined()
  expect(trimDraft({ ...s, model: 'opus' }, { tier: s.tier, model: 'opus', effort: 'max' })).toEqual({ effort: 'max' })
  expect(draftCount({ a: { tier: 'deep' }, b: { model: null, effort: 'low' } })).toBe(3)
})

const TEMPLATES = `${HOME}/.config/herdr-core/templates`
const template = (command: string) => `---\nname: x\ndescription: a helper\ncommand: ${command}\n---\nYou are a helper agent.\n`

test('a helper template\'s thinking level is read from its command line; the lead\'s report wins; none shown when neither gives one', () => {
  // Kiro: --effort; Copilot: --reasoning-effort; agy: the level its model id ends with.
  expect(effortOfTemplate(template('kiro-cli chat --v3 --trust-workspace --model claude-sonnet-5.5 --effort high'))).toBe('high')
  expect(effortOfTemplate(template('copilot --no-ask-user --model gpt-6-luna --reasoning-effort xhigh'))).toBe('xhigh')
  expect(effortOfTemplate(template('agy --model claude-opus-5-5-high --mode auto'))).toBe('high')
  expect(effortOfTemplate(template('agy --model gemini-3.8-flash --mode auto'))).toBeUndefined()
  // Copilot Fusion sets none; a level outside the known ones is not guessed at; a model id ending in a level only counts for agy.
  expect(effortOfTemplate(template('copilot --no-ask-user --model auto --auto-tier hydrafusion'))).toBeUndefined()
  expect(effortOfTemplate(template('kiro-cli chat --effort turbo'))).toBeUndefined()
  expect(effortOfTemplate(template('copilot --model something-high'))).toBeUndefined()
  expect(effortOfTemplate('no front matter\ncommand: kiro-cli --effort high')).toBeUndefined()
  expect(asHelperEffort('  high ')).toBe('high')
  expect(asHelperEffort('')).toBeUndefined()
  expect(asHelperEffort(3)).toBeUndefined()
  expect(asHelperEffort('x'.repeat(40))).toBeUndefined()
})

test('a helper step\'s card shows its thinking level beside the model, from the lead\'s report or else the template', async ($, on) => {
  const files = new Map([
    [`${TEMPLATES}/copilot-standard.md`, template('copilot --no-ask-user --model claude-sonnet-5.5 --reasoning-effort high')],
    [`${TEMPLATES}/kiro-light.md`, template('kiro-cli chat --v3 --model claude-sonnet-5.5 --effort low')],
    [`${TEMPLATES}/copilot-fusion-high.md`, template('copilot --no-ask-user --model auto --auto-tier hydrafusion')],
    // What a path-like name would reach if it were taken as a template.
    [`${TEMPLATES}/sub/kiro-light.md`, template('kiro-cli chat --effort max')],
  ])
  const { rows } = await boot($, on, HELPERS, [], files)
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('<its thinking level, if the screen shows one>')
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'h1', title: 'Survey', tier: 'standard', where: 'helper' },
      { id: 'h2', title: 'Sweep', tier: 'light', where: 'helper' },
      { id: 'h3', title: 'Think', tier: 'deep', where: 'helper' },
      { id: 'h4', title: 'Odd', tier: 'light', where: 'helper' },
      { id: 'h5', title: 'Plain', tier: 'light', where: 'helper' },
    ],
  } as never)
  const started = await $.tool.call({
    tool: PLAN,
    start: [
      { id: 'h1', helper: 'copilot-standard', model: 'Claude Sonnet 5.5' },
      // The lead reads the level off the helper's screen: that wins over the template's low.
      { id: 'h2', helper: 'kiro-light', model: 'Sonnet 5.5', effort: 'medium' },
      { id: 'h3', helper: 'copilot-fusion-high', model: 'Auto' },
      // A name that is not a template name is never turned into a path.
      { id: 'h4', helper: 'sub/kiro-light', model: 'Haiku' },
      'h5',
    ],
  } as never)
  const plan = String(started.result)
  expect(plan).toContain('[h1] Survey: standard, helper (copilot-standard · Claude Sonnet 5.5 · high), running')
  expect(plan).toContain('[h2] Sweep: light, helper (kiro-light · Sonnet 5.5 · medium), running')
  expect(plan).toContain('[h3] Think: deep, helper (copilot-fusion-high · Auto), running')
  expect(plan).toContain('[h4] Odd: light, helper (sub/kiro-light · Haiku), running')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^copilot-standard · Claude Sonnet 5\.5 · high$/))).toBeTruthy()
  expect(await pane.find(text(/^kiro-light · Sonnet 5\.5 · medium$/))).toBeTruthy()
  expect(await pane.find(text(/^copilot-fusion-high · Auto$/))).toBeTruthy()
  await pane.unmount()

  // A later start naming only a model keeps the level it had.
  const again = await $.tool.call({ tool: PLAN, start: [{ id: 'h1', model: 'Claude Sonnet 5.5 (high)' }] } as never)
  expect(String(again.result)).toContain('(copilot-standard · Claude Sonnet 5.5 (high) · high)')
})

test('with no templates to read and no report, a helper step shows its model and no thinking level', async ($, on) => {
  await boot($, on, HELPERS)
  await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Survey', tier: 'standard', where: 'helper' }] } as never)
  const started = await $.tool.call({ tool: PLAN, start: [{ id: 'h1', helper: 'copilot-standard', model: 'Claude Sonnet 5.5' }] } as never)
  expect(String(started.result)).toContain('[h1] Survey: standard, helper (copilot-standard · Claude Sonnet 5.5), running')
})

test('in the minimal view a part\'s card shows its model and thinking level: pickers for a subagent part, the helper line for a helper part', async ($, on) => {
  const files = new Map([[`${TEMPLATES}/kiro-standard.md`, template('kiro-cli chat --v3 --model claude-sonnet-5.5 --effort high')]])
  await boot($, on, HELPERS, [], files)
  await $.tool.call({
    tool: PLAN,
    steps: [
      {
        id: 's1',
        title: 'Survey',
        tier: 'deep',
        where: 'agent',
        parts: [
          { id: 'a', title: 'Read', tier: 'light', where: 'agent' },
          { id: 'b', title: 'Sweep', tier: 'standard', where: 'helper' },
        ],
      },
    ],
  } as never)
  await $.tool.call({ tool: PLAN, start: [{ id: 's1.b', helper: 'kiro-standard', model: 'Claude Sonnet 5.5' }] } as never)
  const pane = await $.ui.mount(TERMINAL)
  await pane.press({ key: 'minimal' })
  expect((await pane.find({ type: 'Button', key: 'model:s1.a' } as never))?.text).toContain('haiku')
  expect((await pane.find({ type: 'Button', key: 'effort:s1.a' } as never))?.text).toContain('low')
  expect(await pane.find(text(/^kiro-standard · Claude Sonnet 5\.5 · high$/))).toBeTruthy()
  await pane.unmount()
})

// Auto mode's thresholds (0.19.0): 5 runs and 90% ok by default; before, 3 runs and 80%.
const okRuns = (n: number, bad: number, over: Partial<HistoryEntry> = {}) =>
  Array.from({ length: n }, (_, i) => run(i + 1, { kind: 'summarize', tier: 'standard', model: 'haiku', effort: 'high', verdict: i < bad ? 'weak' : 'ok', ...over }))
const learnedOn = (n: number, bad: number, set: Partial<Parameters<typeof mergeSettings>[0]> = {}) =>
  learnedRungs(okRuns(n, bad), mergeSettings(set))['summarize']?.n

test('auto mode wants 5 runs and 90% ok by default, and the owner\'s own numbers when set', () => {
  expect(DEFAULT_SETTINGS.autoMinRuns).toBe(5)
  expect(DEFAULT_SETTINGS.autoOkPercent).toBe(90)
  // Default: 4 runs are too few; 5 all ok will do; 4 of 5 ok (80%) is too permissive now; 9 of 10 is exactly 90%.
  expect(learnedOn(4, 0)).toBeUndefined()
  expect(learnedOn(5, 0)).toBe(5)
  expect(learnedOn(5, 1)).toBeUndefined()
  expect(learnedOn(10, 1)).toBe(10)
  expect(learnedOn(10, 2)).toBeUndefined()
  // The old numbers, set by the owner: 3 runs, 80%.
  const old = { autoMinRuns: 3, autoOkPercent: 80 }
  expect(learnedOn(3, 0, old)).toBe(3)
  expect(learnedOn(3, 1, old)).toBeUndefined()
  expect(learnedOn(5, 1, old)).toBe(5)
  // Stricter than the default.
  expect(learnedOn(5, 0, { autoMinRuns: 8 })).toBeUndefined()
  expect(learnedOn(8, 0, { autoMinRuns: 8 })).toBe(8)
  expect(learnedOn(10, 1, { autoOkPercent: 100 })).toBeUndefined()
  // Stored values that cannot be used fall back to the defaults.
  const merged = mergeSettings({ autoMinRuns: 0, autoOkPercent: 150 })
  expect([merged.autoMinRuns, merged.autoOkPercent]).toEqual([5, 90])
  expect(mergeSettings({ autoMinRuns: 2.5, autoOkPercent: 'x' as never })).toMatchObject({ autoMinRuns: 5, autoOkPercent: 90 })
  expect(mergeSettings({ autoMinRuns: 4, autoOkPercent: 75 })).toMatchObject({ autoMinRuns: 4, autoOkPercent: 75 })
  // The advice keeps its own thresholds (3 runs, half weak).
  expect(suggestions(okRuns(3, 2).map(x => ({ ...x, tier: 'standard' as const, model: 'sonnet' as const, effort: 'medium' as const })), mergeSettings({}))).toHaveLength(1)
})

test('Settings > Learning: "Auto picks a rung with at least N runs and P% ok" is persisted, mirrored, marked when it differs, and used for routing', async ($, on) => {
  const past = okRuns(3, 0)
  const files = new Map<string, string>()
  const { store } = await boot($, on, [['history', past], ['settings', { autoRoute: true }]], [], files)
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'Summarize', tier: 'standard', where: 'agent', kind: 'summarize' }] } as never)
  // Three ok runs are too few for the default 5: routing stays on the tier.
  const before = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(before.result)).toContain('[s1] Summarize: standard, sonnet/medium, kind summarize, planned')

  const pane = await $.ui.mount(TERMINAL)
  await pane.press({ key: 'settings' })
  expect(await pane.find(text(/^Auto picks a rung with at least$/))).toBeTruthy()
  expect((await pane.find({ type: 'Button', key: 'auto-min-runs' } as never))?.text).toContain('5 runs')
  expect((await pane.find({ type: 'Button', key: 'auto-ok-percent' } as never))?.text).toContain('90% ok')
  // Marked so far: auto-approve (boot turns it on) and the auto switch (on in the stored settings).
  expect(await pane.findAll(text(/^•$/))).toHaveLength(2)
  expect(await pane.find(text(/ok in at least 90% of 5 or more runs/))).toBeTruthy()

  // The picker offers 3, 5, 8, 10, 20 runs and cycles forward: 5 -> 8 -> 10 -> 20 -> 3.
  for (let i = 0; i < 4; i++) await pane.press({ key: 'auto-min-runs' })
  expect((store.get('settings') as { autoMinRuns: number }).autoMinRuns).toBe(3)
  expect(await pane.findAll(text(/^•$/))).toHaveLength(3)
  // 90% -> 95% -> 100% -> 70% -> 80%.
  for (let i = 0; i < 4; i++) await pane.press({ key: 'auto-ok-percent' })
  expect((store.get('settings') as { autoOkPercent: number }).autoOkPercent).toBe(80)
  expect(await pane.findAll(text(/^•$/))).toHaveLength(4)
  const written = JSON.parse(files.get(MIRROR) ?? '{}') as { settings: { autoMinRuns: number; autoOkPercent: number } }
  expect(written.settings).toMatchObject({ autoMinRuns: 3, autoOkPercent: 80 })
  expect(await pane.find(text(/ok in at least 80% of 3 or more runs/))).toBeTruthy()

  // With the owner's 3 runs and 80%, the same history now teaches the kind.
  const after = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(after.result)).toContain('[s1] Summarize: standard, haiku/high (auto: learned, 3 runs), kind summarize, planned')
  // Back to the defaults: the dots go.
  await pane.press({ key: 'auto-min-runs' })
  await pane.press({ key: 'auto-ok-percent' })
  expect((store.get('settings') as { autoMinRuns: number; autoOkPercent: number })).toMatchObject({ autoMinRuns: 5, autoOkPercent: 90 })
  expect(await pane.findAll(text(/^•$/))).toHaveLength(2)
  await pane.unmount()
})

// --- Helper models (0.20.0): pickers from helpers.py, the check, advice, and the router's own picks -----------------

const CACHE = `${HOME}/.claude/plugins/cache/mk/herdr-delegate`
const SKILL = `${CACHE}/0.6.0/skills/herdr-delegate`
const SCRIPT = `${SKILL}/scripts/helpers.py`
const MODELS_FILE = `${HOME}/.config/herdr-delegate/models.json`
const dirEntry = (name: string) => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })

const helperDefaults = () => ({
  providers: {
    kiro: {
      label: 'Kiro',
      cli: 'kiro-cli',
      efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      tiers: { light: { model: 'claude-haiku-5.5', effort: 'low' }, standard: { model: 'claude-sonnet-5.5', effort: 'high' }, deep: { model: 'claude-opus-5.5', effort: 'high' } },
    },
    copilot: {
      label: 'Copilot',
      cli: 'copilot',
      efforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
      tiers: {
        light: { model: 'gpt-6-luna', effort: 'high' },
        standard: { model: 'claude-sonnet-5.5', effort: 'high' },
        deep: { model: 'claude-opus-5.5', effort: 'high' },
        'fusion-max': { command: 'copilot --model auto --auto-tier hydrafusion-max', description: 'a router' },
      },
    },
    agy: {
      label: 'Antigravity',
      cli: 'agy',
      model_id: '{model}-{effort}',
      efforts: ['low', 'medium', 'high'],
      tiers: { light: { model: 'gemini-3.8-flash', effort: 'high' }, standard: { model: 'claude-sonnet-5-5', effort: 'high' }, deep: { model: 'claude-opus-5-5', effort: 'high' } },
    },
  },
  custom: [] as { provider: string; model: string; effort: string }[],
})

const OFFERED = {
  kiro: { date: '2026-11-07', checked: '2026-11-07', models: ['auto', 'claude-opus-5.5', 'claude-sonnet-5.5', 'claude-haiku-5.5', 'glm-5'] },
  agy: { date: '2026-11-07', checked: '2026-11-07', models: ['claude-sonnet-5-5-high', 'claude-sonnet-5-5-low', 'gemini-3.8-flash-high', 'claude-opus-5-5-high'] },
}

/**
 * helpers.py as the router sees it: the installed skill's folders, its files, and the python runs, answered from a config the
 * `set` and `custom` commands change. `ran` holds every argv; `fail` makes a subcommand exit 1 with that stderr.
 */
const helperWorld = (on: Parameters<TestBody>[1], files: Map<string, string>, o: { present?: boolean; oldScript?: string; noHc?: boolean; noCli?: boolean } = {}) => {
  const present = o.present ?? true
  const cfg = helperDefaults()
  if (o.noCli) for (const p of Object.values(cfg.providers)) (p as { cli_found?: boolean }).cli_found = false
  const ran: string[][] = []
  const hcRuns: string[][] = []
  const fail: Record<string, string> = {}
  files.set(`${SKILL}/helpers.default.json`, JSON.stringify(helperDefaults()))
  files.set(MODELS_FILE, JSON.stringify(OFFERED))
  const result = (exitCode: number, stdout = '', stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
  const setup = () => {
    on('fs.list', (_, e) => {
      const path = (e as { path: string }).path
      if (present && path === `${HOME}/.claude/plugins/cache`) return { value: [dirEntry('mk')] }
      if (present && path === CACHE) return { value: [dirEntry('0.5.1'), dirEntry('0.6.0')] }

      return { deny: 'ENOENT' }
    })
    on('fs.exists', (_, e) => ({ value: present && (e as { path: string }).path.endsWith('/skills/herdr-delegate/scripts/helpers.py') }))
    on('process.run', (_, e) => {
      const argv = (e as { argv: string[] }).argv
      // Herdr's hc: found unless the world says it is not (a program that cannot start is refused).
      if (argv[0] === 'hc') {
        hcRuns.push(argv)

        return o.noHc ? { deny: 'ENOENT' } : result(0, 'hc 0.1.20\n')
      }
      ran.push(argv)
      const [cmd, ...args] = argv.slice(2)
      const kv = Object.fromEntries(args.filter(a => a.includes('=')).map(a => [a.split('=')[0]!, a.split('=')[1]!]))
      if (cmd && fail[cmd]) return result(1, '', fail[cmd])
      if (cmd === 'config') return o.oldScript === argv[1] ? result(2, 'usage: helpers.py ...') : result(0, JSON.stringify(cfg, null, 2))
      if (cmd === 'set') {
        Object.assign((cfg.providers as Record<string, { tiers: Record<string, object> }>)[args[0]!]!.tiers[args[1]!]!, kv)

        return result(0, `${args[0]}-${args[1]}: ${kv.model} ${kv.effort} (saved)\n`)
      }
      if (cmd === 'custom') {
        if (kv.model === 'glm-5') return result(1, '', `error: 'kiro-glm-5-${kv.effort}' cannot be made here\n`)
        const name = `${args[0]}-${kv.model!.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${kv.effort}`
        cfg.custom.push({ provider: args[0]!, model: kv.model!, effort: kv.effort! })

        return result(0, `${name}\n`)
      }
      if (cmd === 'models') {
        files.set(MODELS_FILE, JSON.stringify({ ...OFFERED, kiro: { ...OFFERED.kiro, date: '2026-11-08', checked: '2026-11-08' } }))

        return result(0, 'kiro     5 models (2026-11-08)\nNOT OFFERED  kiro-light: claude-haiku-5.5 (provider kiro); change it with: helpers.py set\nNEWER        kiro-standard: claude-sonnet-5.5 -> claude-sonnet-5.6\n')
      }

      return result(2, 'usage')
    })
  }

  return { setup, ran, hcRuns, fail, cfg, argsOf: (cmd: string) => ran.filter(a => a[2] === cmd) }
}

const hrun = (n: number, over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  key: `h${n}`,
  tier: 'standard',
  where: 'helper',
  helper: 'kiro-standard',
  cost: 0,
  setupHeavy: false,
  rerun: false,
  at: `2026-11-0${Math.min(n, 9)}T10:00:00.000Z`,
  ...over,
})

const HELPERS_ON = ['settings', { helpers: { enabled: true } }] as [string, unknown]

test('Settings > Helpers: model and thinking pickers for each provider and tier, from helpers.py and its model list; a change runs set and reads the config again', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  await boot($, on, [HELPERS_ON], [], files, world.setup)
  // The newest installed skill's helpers.py (0.6.0, not 0.5.1) was asked for its config at the start.
  expect(world.ran[0]).toEqual(['python3', SCRIPT, 'config'])

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'settings' })
  const picker = async (key: string) => (await pane.find({ type: 'Select', key } as never)) as { props: { value: string; options: { value: string; label: string }[] } }
  expect((await picker('helper-model:kiro:light')).props.options.map(o => o.value)).toEqual(['auto', 'claude-opus-5.5', 'claude-sonnet-5.5', 'claude-haiku-5.5', 'glm-5'])
  expect((await picker('helper-model:kiro:light')).props.value).toBe('claude-haiku-5.5')
  expect((await picker('helper-effort:kiro:light')).props.options.map(o => o.value)).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  expect((await picker('helper-effort:kiro:light')).props.value).toBe('low')
  // Copilot lists its own levels; its Fusion tier is a router with a fixed command: no picker.
  expect((await picker('helper-effort:copilot:deep')).props.options.map(o => o.value)).toEqual(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
  expect(await pane.find({ type: 'Select', key: 'helper-model:copilot:fusion-max' } as never)).toBeFalsy()
  // agy's ids carry the level; the picker lists the models without it. A provider with no cached list shows the configured ones.
  expect((await picker('helper-model:agy:standard')).props.options.map(o => o.value)).toEqual(['claude-sonnet-5-5', 'gemini-3.8-flash', 'claude-opus-5-5'])
  expect((await picker('helper-model:copilot:light')).props.options.map(o => o.value)).toEqual(['gpt-6-luna', 'claude-sonnet-5.5', 'claude-opus-5.5'])
  expect(await pane.find(text(/^models checked 2026-11-07$/))).toBeTruthy()

  // A change runs set with both values, then reads the config again; the value differs from the shipped default, so it is marked.
  const marks = (await pane.findAll(text(/^•$/))).length
  await pane.select({ key: 'helper-effort:kiro:light', value: 'medium' } as never)
  expect(world.ran.at(-2)).toEqual(['python3', SCRIPT, 'set', 'kiro', 'light', 'model=claude-haiku-5.5', 'effort=medium'])
  expect(world.ran.at(-1)).toEqual(['python3', SCRIPT, 'config'])
  expect((await picker('helper-effort:kiro:light')).props.value).toBe('medium')
  expect((await pane.findAll(text(/^•$/))).length).toBe(marks + 1)
  await pane.select({ key: 'helper-model:kiro:standard', value: 'claude-opus-5.5' } as never)
  expect(world.ran.at(-2)).toEqual(['python3', SCRIPT, 'set', 'kiro', 'standard', 'model=claude-opus-5.5', 'effort=high'])
  expect((await pane.findAll(text(/^•$/))).length).toBe(marks + 2)
  // Back to the default: the mark goes.
  await pane.select({ key: 'helper-effort:kiro:light', value: 'low' } as never)
  expect((await pane.findAll(text(/^•$/))).length).toBe(marks + 1)

  // helpers.py refuses (it validates the model and level): its message shows, and the config stays as it was.
  world.fail.set = "error: effort 'xhigh' is not one of ['low'] for kiro"
  const before = world.ran.length
  await pane.select({ key: 'helper-effort:kiro:deep', value: 'xhigh' } as never)
  expect(await pane.find(text(/^effort 'xhigh' is not one of/))).toBeTruthy()
  expect(world.ran.length).toBe(before + 1)
  expect((await picker('helper-effort:kiro:deep')).props.value).toBe('high')
  await pane.unmount()
})

test('Check models runs helpers.py models; the models no longer offered and the newer ones show in the pane, with the day of the check', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  await boot($, on, [HELPERS_ON], [], files, world.setup)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'settings' })
  expect(await pane.find(text(/^NOT OFFERED/))).toBeFalsy()
  await pane.press({ key: 'helpers-check' })
  expect(world.argsOf('models')).toEqual([['python3', SCRIPT, 'models']])
  expect(await pane.find(text(/^NOT OFFERED kiro-light: claude-haiku-5\.5 \(provider kiro\)/))).toBeTruthy()
  expect(await pane.find(text(/^NEWER kiro-standard: claude-sonnet-5\.5 -> claude-sonnet-5\.6$/))).toBeTruthy()
  // The cache was written by helpers.py; the router read it again.
  expect(await pane.find(text(/^models checked 2026-11-08$/))).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'helpers-check' } as never)).toBeTruthy()
  await pane.unmount()
})

test('without helpers.py there are no helpers: the pane explains how to get them, hides the orders and pickers, the rules and the plan tool offer none; a path set by hand brings them in; an old helpers.py is named', async ($, on) => {
  const files = new Map<string, string>()
  const old = '/opt/old/skills/herdr-delegate/scripts/helpers.py'
  const world = helperWorld(on, files, { present: false, oldScript: old })
  files.set(`${HOME}/.claude/plugins/installed_plugins.json`, JSON.stringify({ plugins: { 'model-router@mk': [{ version: '0.22.0' }] } }))
  const choice = { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'medium' }
  const { store, rows, registered } = await boot($, on, [['settings', { helpers: { enabled: true, kinds: { summarize: choice } } }]], [], files, world.setup)
  expect(world.ran).toEqual([])
  expect(wheres(registered.at(-1))).toEqual(['agent', 'here'])

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'settings' })
  expect(await pane.find(text(/^Helpers are agents on other subscriptions or accounts\. They are optional: model-router works without them, running every step as a Claude subagent\.$/))).toBeTruthy()
  // The install line names the marketplace this plugin came from.
  expect(await pane.find(text(/^1\. Install herdr-delegate from the same marketplace: \/plugin install herdr-delegate@mk$/))).toBeTruthy()
  expect(await pane.find(text(/Install Herdr's hc/))).toBeTruthy()
  expect(await pane.find(text(/Kiro, Copilot, Codex, Antigravity, or another Claude account/))).toBeTruthy()
  // No helper rows: no orders, no "off" buttons, no model pickers, no Copilot Fusion, no check.
  expect(await pane.find(text(/^\d\. (kiro|copilot|agy)|^(kiro|copilot|agy)\b/i))).toBeFalsy()
  expect(await pane.find({ type: 'Button', key: 'helper-off:light:kiro-light' } as never)).toBeFalsy()
  expect(await pane.find({ type: 'Select', key: 'helper-model:kiro:light' } as never)).toBeFalsy()
  expect(await pane.find({ type: 'Select', key: 'helpers-fusion' } as never)).toBeFalsy()
  expect(await pane.find({ type: 'Button', key: 'helpers-check' } as never)).toBeFalsy()
  // The path box sits behind a small disclosure.
  expect(await pane.find({ type: 'Input', key: 'helpers-script' } as never)).toBeFalsy()
  await pane.press({ key: 'helpers-path-toggle' })
  expect(await pane.find({ type: 'Input', key: 'helpers-script' } as never)).toBeTruthy()

  // The rules do not offer helper steps, and a helper step in a plan is a subagent step.
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('# Model routing')
  expect(lastRow(rows).toLowerCase()).not.toContain('helper')
  expect(lastRow(rows)).not.toContain('herdr-delegate')
  const planned = await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Summarize', tier: 'standard', where: 'helper', kind: 'summarize' }] } as never)
  expect(String(planned.result)).toContain('[h1] Summarize: standard, sonnet/medium')
  expect(String(planned.result)).not.toContain('helper (')
  expect(world.ran).toEqual([])

  // A path of its own: the config is read from there, and the shipped defaults beside it.
  const own = '/opt/hp/skills/herdr-delegate/scripts/helpers.py'
  files.set('/opt/hp/skills/herdr-delegate/helpers.default.json', JSON.stringify(helperDefaults()))
  await pane.input({ key: 'helpers-script', text: own })
  expect((store.get('settings') as { helpers: { script: string } }).helpers.script).toBe(own)
  expect(world.argsOf('config').at(-1)).toEqual(['python3', own, 'config'])
  expect(await pane.find({ type: 'Select', key: 'helper-model:kiro:light' } as never)).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'helper-off:light:kiro-light' } as never)).toBeTruthy()
  expect(JSON.parse(files.get(MIRROR) ?? '{}').settings.helpers.script).toBe(own)
  // Helpers can run now: the plan tool offers helper steps again.
  expect(wheres(registered.at(-1))).toEqual(['agent', 'here', 'helper'])
  // A path that is not a helpers.py is not taken.
  await pane.input({ key: 'helpers-script', text: '/opt/hp/run.sh' })
  expect((store.get('settings') as { helpers: { script: string } }).helpers.script).toBe(own)
  // The choice stored for the kind is used now that a template can be made.
  const again = await $.tool.call({ tool: PLAN, steps: [{ id: 'h2', title: 'Summarize', tier: 'standard', where: 'helper', kind: 'summarize' }] } as never)
  expect(String(again.result)).toContain('[h2] Summarize: standard, helper (launch kiro-claude-haiku-5-5-medium:')
  // A helpers.py older than the config command: the pane names the fix, and the helpers go again.
  await pane.input({ key: 'helpers-script', text: old })
  expect(await pane.find(text(/^This helpers\.py has no config command: update herdr-delegate to 0\.6\.0 or later\.$/))).toBeTruthy()
  expect(await pane.find({ type: 'Select', key: 'helper-model:kiro:light' } as never)).toBeFalsy()
  expect(wheres(registered.at(-1))).toEqual(['agent', 'here'])
  await pane.unmount()
})

test('without Herdr\'s hc there are no helpers either: its own message, no helper rows, no helper rule, helper steps run as subagents', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { noHc: true })
  const { rows, registered } = await boot($, on, [HELPERS_ON], [], files, world.setup)
  // hc was looked for; helpers.py was not run for a config.
  expect(world.hcRuns[0]).toEqual(['hc', '--version'])
  expect(world.ran).toEqual([])
  expect(wheres(registered.at(-1))).toEqual(['agent', 'here'])
  for (const t of ['light', 'standard', 'deep'] as const) expect(helperList(mergeSettings({ helpers: { enabled: true } }), t)).toEqual([])

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'settings' })
  expect(await pane.find(text(/^Helpers run through Herdr's hc, which was not found on your PATH\./))).toBeTruthy()
  // herdr-delegate is installed here: its install line is not offered, the hc one is.
  expect(await pane.find(text(/Install herdr-delegate/))).toBeFalsy()
  expect(await pane.find(text(/^1\. Install Herdr's hc/))).toBeTruthy()
  expect(await pane.find(text(/^\d\. (kiro|copilot|agy)|^(kiro|copilot|agy)\b/i))).toBeFalsy()
  expect(await pane.find({ type: 'Select', key: 'helper-model:kiro:light' } as never)).toBeFalsy()
  expect(await pane.find({ type: 'Button', key: 'helper-off:light:kiro-light' } as never)).toBeFalsy()

  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows).toLowerCase()).not.toContain('helper')
  const planned = await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Survey', tier: 'light', where: 'helper' }] } as never)
  expect(String(planned.result)).toContain('[h1] Survey: light, haiku/low')
  await pane.unmount()
})

test('advice for a helper tier that was weak: the next stronger rung of that provider, applied with set; runs from before keep the model they ran on', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  const past = [hrun(1, { verdict: 'weak' }), hrun(2, { verdict: 'weak' }), hrun(3, { verdict: 'ok' })]
  const { store } = await boot($, on, [HELPERS_ON, ['history', past]], [], files, world.setup)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  // Kiro's ladder: Haiku low..high, Sonnet high, Opus high, xhigh, max: standard sits on Sonnet high, so Opus high is next.
  expect(await pane.find(text(/^kiro-standard on claude-sonnet-5\.5\/high: 2 of 3 weak: raise kiro's standard helper from claude-sonnet-5\.5\/high to kiro claude-opus-5\.5\/high\.$/))).toBeTruthy()
  await pane.press({ key: 'apply-helper:kiro:standard' })
  expect(world.argsOf('set')).toEqual([['python3', SCRIPT, 'set', 'kiro', 'standard', 'model=claude-opus-5.5', 'effort=high']])
  // The old runs are stamped with the model they ran on, so they do not count against the new one.
  expect((store.get('history') as HistoryEntry[]).map(x => x.hrung)).toEqual(Array(3).fill({ provider: 'kiro', model: 'claude-sonnet-5.5', effort: 'high' }))
  expect(await pane.find({ type: 'Button', key: 'apply-helper:kiro:standard' } as never)).toBeFalsy()
  await pane.unmount()
})

test('advice for a kind on a helper is stored as that kind\'s helper choice: mirrored, marked, and reset', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  const past = [1, 2, 3].map(n => hrun(n, { helper: 'kiro-light', tier: 'light', kind: 'research', verdict: n < 3 ? 'weak' : 'ok' }))
  const { store } = await boot($, on, [HELPERS_ON, ['history', past]], [], files, world.setup)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^research on kiro light: 2 of 3 weak: raise research's helper from claude-haiku-5\.5\/low to kiro claude-haiku-5\.5\/medium\.$/))).toBeTruthy()
  await pane.press({ key: 'apply-helper-kind:research' })
  const choice = { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'medium' }
  expect((store.get('settings') as { helpers: { kinds: unknown } }).helpers.kinds).toEqual({ research: choice })
  expect(JSON.parse(files.get(MIRROR) ?? '{}').settings.helpers.kinds).toEqual({ research: choice })
  // Nothing in helpers.py changed: a kind's choice is the router's.
  expect(world.argsOf('set')).toEqual([])
  expect(await pane.find({ type: 'Button', key: 'apply-helper-kind:research' } as never)).toBeFalsy()
  await pane.press({ key: 'settings' })
  expect(await pane.find(text(/^→ kiro claude-haiku-5\.5\/medium$/))).toBeTruthy()
  await pane.press({ key: 'helper-kind-reset:research' })
  expect((store.get('settings') as { helpers: { kinds: unknown } }).helpers.kinds).toEqual({})
  await pane.unmount()
})

test('auto mode picks a helper model per step: the router makes the template, names it in the plan text, the rules and the card, and the lead is told when auto goes off', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  const learned = [1, 2, 3, 4, 5].map(n => hrun(n, { helper: 'kiro-claude-haiku-5-5-medium', kind: 'summarize', verdict: 'ok', hrung: { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'medium' } }))
  const { store, rows } = await boot($, on, [['settings', { autoRoute: true, helpers: { enabled: true } }], ['history', learned]], [], files, world.setup)
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('give the picker that template first, then the tier')

  const steps = [
    { id: 'h1', title: 'Summarize papers', tier: 'standard', where: 'helper', kind: 'summarize' },
    { id: 'h2', title: 'Look things up', tier: 'standard', where: 'helper', kind: 'search' },
  ]
  const planned = await $.tool.call({ tool: PLAN, steps } as never)
  const order = 'kiro-standard → copilot-standard → agy-standard'
  expect(String(planned.result)).toContain(`[h1] Summarize papers: standard, helper (launch kiro-claude-haiku-5-5-medium: claude-haiku-5.5 medium, auto: learned, 5 runs; else ${order}), kind summarize, planned`)
  // A kind with no history keeps the tier order.
  expect(String(planned.result)).toContain(`[h2] Look things up: standard, helper (${order}), kind search, planned`)
  expect(world.argsOf('custom')).toEqual([['python3', SCRIPT, 'custom', 'kiro', 'model=claude-haiku-5.5', 'effort=medium']])
  // Asked again, the same template is not made twice.
  await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(world.argsOf('custom')).toHaveLength(1)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^launch kiro-claude-haiku-5-5-medium · claude-haiku-5\.5 medium · auto: learned, 5 runs$/))).toBeTruthy()

  // Auto mode off: the step is back on the tier order, and the lead hears of it with the next plan result.
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'auto-route' })
  expect((store.get('settings') as { autoRoute: boolean }).autoRoute).toBe(false)
  const off = String((await $.tool.call({ tool: PLAN, done: [] } as never)).result)
  expect(off).not.toContain('(launch ')
  expect(off).toContain('[h1] Summarize papers: standard, helper (kiro-standard → copilot-standard → agy-standard), kind summarize, planned')
  expect(off).toContain('Helper launch for step [h1] "Summarize papers" changed: no template is named any more; use the tier order.')
  expect(await pane.find(text(/^launch kiro-claude-haiku/))).toBeFalsy()
  // And on again: the template made earlier is reused, and the next turn carries the note.
  await pane.press({ key: 'auto-route' })
  expect(world.argsOf('custom')).toHaveLength(1)
  await $.turn.start({ text: 'next', turnId: 't1' })
  expect(lastRow(rows)).toContain('Helper launch for step [h1] \\"Summarize papers\\" changed: launch kiro-claude-haiku-5-5-medium (auto: learned, 5 runs)')
  await pane.unmount()
})

test('a kind\'s stored helper choice names a tier template when one fits, a one-off otherwise, ignores a provider the tier does not list, and falls back when the template cannot be made; the run records the model', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  const kinds = {
    a: { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'low' },
    c: { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'high' },
    d: { provider: 'kiro', model: 'glm-5', effort: 'low' },
  }
  const tiers = { light: 'kiro-light,copilot-light,agy-light', standard: 'copilot-standard,agy-standard', deep: 'kiro-deep' }
  const { store } = await boot($, on, [['settings', { helpers: { enabled: true, tiers, kinds } }]], [], files, world.setup)
  const planned = await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'l1', title: 'First', tier: 'light', where: 'helper', kind: 'a' },
      { id: 's1', title: 'Second', tier: 'standard', where: 'helper', kind: 'a' },
      { id: 'l2', title: 'Third', tier: 'light', where: 'helper', kind: 'c' },
      { id: 'l3', title: 'Fourth', tier: 'light', where: 'helper', kind: 'd' },
    ],
  } as never)
  const text1 = String(planned.result)
  const light = 'kiro-light → copilot-light → agy-light'
  // Kiro's light tier already is Haiku low: its own template, nothing made.
  expect(text1).toContain(`[l1] First: light, helper (launch kiro-light: claude-haiku-5.5 low, its kind's choice; else ${light}), kind a, planned`)
  // The standard tier lists no Kiro helper, so the choice is not used.
  expect(text1).toContain('[s1] Second: standard, helper (copilot-standard → agy-standard), kind a, planned')
  expect(text1).toContain(`[l2] Third: light, helper (launch kiro-claude-haiku-5-5-high: claude-haiku-5.5 high, its kind's choice; else ${light}), kind c, planned`)
  // helpers.py refuses the one-off: the tier order stays, and the card says why.
  expect(text1).toContain(`[l3] Fourth: light, helper (${light}), kind d, planned`)
  expect(world.argsOf('custom').map(a => a[4])).toEqual(['model=claude-haiku-5.5', 'model=glm-5'])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^no template for glm-5 low \('kiro-glm-5-low' cannot be made here\): the tier order applies$/))).toBeTruthy()

  // The lead launches them; each finished run records the provider, model and level it ran on.
  await $.tool.call({ tool: PLAN, start: [{ id: 'l1', helper: 'kiro-light', model: 'Claude Haiku 5.5' }, { id: 'l2', helper: 'kiro-claude-haiku-5-5-high' }, { id: 'l3', helper: 'kiro-light' }] } as never)
  await $.tool.call({ tool: PLAN, done: [{ id: 'l1', verdict: 'ok' }, { id: 'l2', verdict: 'weak', why: 'thin' }, { id: 'l3', verdict: 'ok' }] } as never)
  const past = store.get('history') as HistoryEntry[]
  expect(past.map(x => [x.helper, x.hrung])).toEqual([
    ['kiro-light', { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'low' }],
    ['kiro-claude-haiku-5-5-high', { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'high' }],
    ['kiro-light', { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'low' }],
  ])
  await pane.unmount()
})

test('helper ladder, advice, learned rungs and template names, worked out from the config', () => {
  const cfg = helperDefaults() as never
  // The helpers of a machine that has them: with no config there are none.
  setHelperConfig(cfg)
  const ladder = (p: string, cache?: never) => helperLadder(cfg, p, cache).map(r => `${r.model}/${r.effort}`)
  // Tier order; each model from the lowest level a tier gives it up to high, the top model on to the provider's highest.
  expect(ladder('kiro')).toEqual(['claude-haiku-5.5/low', 'claude-haiku-5.5/medium', 'claude-haiku-5.5/high', 'claude-sonnet-5.5/high', 'claude-opus-5.5/high', 'claude-opus-5.5/xhigh', 'claude-opus-5.5/max'])
  expect(ladder('agy')).toEqual(['gemini-3.8-flash/high', 'claude-sonnet-5-5/high', 'claude-opus-5-5/high'])
  expect(ladder('copilot')[0]).toBe('gpt-6-luna/high')
  // With a credit multiplier for every one of the models, it orders them: here Sonnet is cheaper than Haiku.
  const credits = { kiro: { credits: { 'claude-haiku-5.5': 2, 'claude-sonnet-5.5': 1.3, 'claude-opus-5.5': 3 } } } as never
  expect(ladder('kiro', credits).slice(0, 2)).toEqual(['claude-sonnet-5.5/high', 'claude-haiku-5.5/low'])
  // Credits for only some of them: the tier order stays.
  expect(ladder('kiro', { kiro: { credits: { 'claude-haiku-5.5': 2 } } } as never)[0]).toBe('claude-haiku-5.5/low')
  expect(helperStep(helperLadder(cfg, 'kiro'), { model: 'claude-sonnet-5.5', effort: 'high' }, 1)).toEqual({ model: 'claude-opus-5.5', effort: 'high' })
  expect(helperStep(helperLadder(cfg, 'kiro'), { model: 'claude-sonnet-5.5', effort: 'high' }, -1)).toEqual({ model: 'claude-haiku-5.5', effort: 'high' })
  expect(helperStep(helperLadder(cfg, 'kiro'), { model: 'claude-opus-5.5', effort: 'max' }, 1)).toBeUndefined()
  expect(helperStep(helperLadder(cfg, 'kiro'), { model: 'glm-5', effort: 'low' }, 1)).toBeUndefined()

  const set = mergeSettings({})
  const advice = (h: HistoryEntry[], s = set) => helperSuggestions(h, s, cfg).map(a => `${a.provider}/${a.tier ?? ''}/${a.kind ?? ''}: ${a.isRaise ? 'up' : 'down'} to ${a.to.model}/${a.to.effort}`)
  const weak = (n: number, over: Partial<HistoryEntry> = {}) => hrun(n, { verdict: 'weak', ...over })
  // Under three runs: nothing. Two of three weak: up. A run that was redone counts as weak whatever its verdict said.
  expect(advice([weak(1), weak(2)])).toEqual([])
  expect(advice([weak(1), weak(2), hrun(3, { verdict: 'ok' })])).toEqual(['kiro/standard/: up to claude-opus-5.5/high'])
  expect(advice([hrun(1, { verdict: 'ok', rerun: true }), hrun(2, { verdict: 'ok', rerun: true }), hrun(3, { verdict: 'ok' })])).toEqual(['kiro/standard/: up to claude-opus-5.5/high'])
  // Overkill at half, none of the last three weak: down. At the bottom of the ladder there is nothing lower.
  const over = (n: number, over: Partial<HistoryEntry> = {}) => hrun(n, { verdict: 'overkill', ...over })
  expect(advice([over(1), over(2), hrun(3, { verdict: 'ok' })])).toEqual(['kiro/standard/: down to claude-haiku-5.5/high'])
  expect(advice([over(1), over(2), weak(3)])).toEqual([])
  expect(advice([over(1, { helper: 'kiro-light' }), over(2, { helper: 'kiro-light' }), over(3, { helper: 'kiro-light' })])).toEqual([])
  // A run on another model than the tier has now does not count; a kind is judged apart from the tier's runs without one.
  expect(advice([weak(1, { hrung: { provider: 'kiro', model: 'claude-opus-5.5', effort: 'high' } }), weak(2), weak(3)])).toEqual([])
  expect(advice([1, 2, 3].map(n => weak(n, { kind: 'review' })))).toEqual(['kiro/standard/review: up to claude-opus-5.5/high'])
  // A kind with a choice of its own is judged on the rung the choice names.
  const own = mergeSettings({ helpers: { kinds: { review: { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'low' } } } } as never)
  expect(advice([1, 2, 3].map(n => weak(n, { kind: 'review', helper: 'kiro-claude-haiku-5-5-low', hrung: { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'low' } })), own)).toEqual(['kiro//review: up to claude-haiku-5.5/medium'])
  // Entries from before the router recorded a model read it from the template's tier; no config, no advice.
  expect(helperSuggestions([weak(1), weak(2), weak(3)], set, undefined)).toEqual([])

  // Learned: the cheapest rung per provider with enough runs and enough ok (5 and 90 by default).
  const ok = (n: number, r: { model: string; effort: string }, over: Partial<HistoryEntry> = {}) => hrun(n, { kind: 'summarize', verdict: 'ok', helper: 'x', hrung: { provider: 'kiro', ...r }, ...over })
  const five = (r: { model: string; effort: string }) => [1, 2, 3, 4, 5].map(n => ok(n, r))
  const learnedOf = (h: HistoryEntry[]) => learnedHelpers(h, set, cfg).summarize?.map(c => `${c.provider} ${c.model}/${c.effort} ${c.n}`)
  expect(learnedOf([...five({ model: 'claude-sonnet-5.5', effort: 'high' }), ...five({ model: 'claude-haiku-5.5', effort: 'medium' })])).toEqual(['kiro claude-haiku-5.5/medium 5', 'kiro claude-sonnet-5.5/high 5'])
  expect(learnedOf([...five({ model: 'claude-haiku-5.5', effort: 'medium' }).slice(0, 4)])).toBeUndefined()
  expect(learnedOf([...five({ model: 'claude-haiku-5.5', effort: 'medium' }).slice(0, 4), ok(6, { model: 'claude-haiku-5.5', effort: 'medium' }, { verdict: 'weak' })])).toBeUndefined()
  // A rung that is not on the provider's ladder is not offered.
  expect(learnedOf(five({ model: 'glm-5', effort: 'low' }))).toBeUndefined()

  // Picks: auto's rung for the kind first, then the kind's choice; only a provider the tier lists, in the tier's order; never a step that started.
  const learnedPick = { summarize: [{ provider: 'kiro', model: 'claude-haiku-5.5', effort: 'medium', n: 5 }, { provider: 'copilot', model: 'gpt-6-luna', effort: 'high', n: 6 }] }
  const hstep = { ...newStep('h1', 'x', 'standard', 'helper'), kind: 'summarize' }
  expect(helperPickFor(hstep, set, learnedPick, cfg)).toEqual({ provider: 'kiro', model: 'claude-haiku-5.5', effort: 'medium', source: 'auto', n: 5 })
  expect(helperPickFor(hstep, mergeSettings({ helpers: { tiers: { standard: 'copilot-standard,kiro-standard' } } } as never), learnedPick, cfg)).toMatchObject({ provider: 'copilot', source: 'auto', n: 6 })
  expect(helperPickFor(hstep, mergeSettings({ helpers: { tiers: { standard: 'agy-standard' } } } as never), learnedPick, cfg)).toBeUndefined()
  const withChoice = mergeSettings({ helpers: { kinds: { summarize: { provider: 'agy', model: 'claude-opus-5-5', effort: 'high' } } } } as never)
  expect(helperPickFor(hstep, withChoice, undefined, cfg)).toEqual({ provider: 'agy', model: 'claude-opus-5-5', effort: 'high', source: 'kind' })
  expect(helperPickFor(hstep, withChoice, learnedPick, cfg)).toMatchObject({ source: 'auto' })
  expect(helperPickFor({ ...hstep, status: 'running' }, withChoice, undefined, cfg)).toBeUndefined()
  expect(helperPickFor({ ...hstep, helper: 'kiro-standard' }, withChoice, undefined, cfg)).toBeUndefined()
  expect(helperPickFor({ ...hstep, kind: undefined }, withChoice, learnedPick, cfg)).toBeUndefined()
  expect(helperPickFor({ ...hstep, where: 'agent' }, withChoice, learnedPick, cfg)).toBeUndefined()

  // Names: a tier template, a custom one, and the template that already has a model and level.
  expect(templateRung(cfg, 'kiro-standard')).toEqual({ provider: 'kiro', tier: 'standard', model: 'claude-sonnet-5.5', effort: 'high' })
  expect(templateRung(cfg, 'copilot-fusion-max')).toBeUndefined()
  expect(customTemplate('kiro', 'claude-haiku-5.5', 'low')).toBe('kiro-claude-haiku-5-5-low')
  expect(templateRung({ ...(cfg as object), custom: [{ provider: 'kiro', model: 'claude-haiku-5.5', effort: 'high' }] } as never, 'kiro-claude-haiku-5-5-high')).toEqual({ provider: 'kiro', model: 'claude-haiku-5.5', effort: 'high' })
  expect(templateOfRung(cfg, 'copilot', { model: 'claude-sonnet-5.5', effort: 'high' }, 'deep')).toBe('copilot-standard')
  expect(templateOfRung(cfg, 'kiro', { model: 'claude-haiku-5.5', effort: 'high' })).toBeUndefined()

  // Models and the check: ids without the level where the provider's carry it; the lines worth showing; the day.
  expect(baseModelId(cfg, 'agy', 'claude-sonnet-5-5-high')).toBe('claude-sonnet-5-5')
  expect(baseModelId(cfg, 'kiro', 'claude-haiku-5.5')).toBe('claude-haiku-5.5')
  expect(offeredModels(cfg, OFFERED as never, 'kiro', ['custom-x']).at(-1)).toBe('custom-x')
  expect(modelWarnings('kiro  5 models\nNOT OFFERED  kiro-light: x\nNEWER        kiro-deep: a -> b\ncopilot  ERROR: boom\nevery configured model is offered')).toEqual(['NOT OFFERED kiro-light: x', 'NEWER kiro-deep: a -> b', 'copilot ERROR: boom'])
  expect(modelsChecked({ kiro: { checked: '2026-11-07' }, agy: { date: '2026-11-08' } })).toBe('2026-11-08')
  expect(modelsChecked(undefined)).toBeUndefined()
  expect(compareVersions('0.6.0', '0.5.1')).toBeGreaterThan(0)
  expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0)
  expect(compareVersions('1.0', '1.0.0')).toBe(0)
  setHelperConfig(undefined)
})

test('per-kind helper choices from storage keep only a provider, model and level of plain words', () => {
  const good = { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'low' }
  const set = mergeSettings({ helpers: { kinds: { ok: good, bad1: { provider: 'kiro; rm -rf /', model: 'x', effort: 'low' }, bad2: 'kiro', bad3: { provider: 'kiro' } }, script: '  /x/helpers.py ' } } as never)
  expect(set.helpers.kinds).toEqual({ ok: good })
  expect(set.helpers.script).toBe('/x/helpers.py')
  expect(mergeSettings({}).helpers).toMatchObject({ kinds: {}, script: '' })
  // Only a file called helpers.py is run with python: anything else stored (a mirror file anyone could edit) is dropped.
  expect(mergeSettings({ helpers: { script: '/x/evil.sh' } } as never).helpers.script).toBe('')
  expect(mergeSettings({ helpers: { script: 'C:\\skills\\helpers.py' } } as never).helpers.script).toBe('C:\\skills\\helpers.py')
})

// --- 0.21.0: settings shared between sessions, helper usage that was not reported --------------------

/** What another session left in the store: tiers and helpers set there, in a copy this session never saw. */
const OTHER_SESSION = {
  tiers: { deep: { model: 'haiku', effort: 'low', scopeNote: false } },
  helpers: { enabled: true, tiers: { light: 'copilot-light' } },
}

test('a change in this session leaves what another session stored in place: store and mirror', async ($, on) => {
  const files = new Map<string, string>()
  const { store } = await boot($, on, [], [], files)
  // Another session saves its settings after this one has loaded.
  store.set('settings', OTHER_SESSION)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'minimal' })
  await pane.unmount()

  const kept = store.get('settings') as { compact: boolean; tiers: { deep: { model: string } }; helpers: { enabled: boolean; tiers: { light: string } } }
  expect(kept.compact).toBe(true)
  expect(kept.tiers.deep.model).toBe('haiku')
  expect(kept.helpers.enabled).toBe(true)
  expect(kept.helpers.tiers.light).toBe('copilot-light')
  const mirrored = (JSON.parse(files.get(MIRROR) ?? '{}') as { settings: typeof kept }).settings
  expect(mirrored.compact).toBe(true)
  expect(mirrored.tiers.deep.model).toBe('haiku')
  expect(mirrored.helpers.enabled).toBe(true)
})

test('reordering helpers works on the stored order, not this session\'s copy', async ($, on) => {
  const { store } = await boot($, on, HELPERS)
  store.set('settings', { helpers: { enabled: true, tiers: { light: 'copilot-light', standard: 'kiro-standard,copilot-standard,agy-standard' } } })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'helper-up:standard:copilot-standard' })
  await pane.unmount()
  const kept = store.get('settings') as { helpers: { tiers: { light: string; standard: string } } }
  expect(kept.helpers.tiers.standard).toBe('copilot-standard,kiro-standard,agy-standard')
  expect(kept.helpers.tiers.light).toBe('copilot-light')
})

test('auto-approve and always-plan set elsewhere are kept when this session changes another setting', async ($, on) => {
  const files = new Map<string, string>()
  const { store } = await boot($, on, [['autoApprove', false]], [], files)
  store.set('alwaysPlan', true)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pane.press({ key: 'settings' })
  await pane.press({ key: 'auto' })
  await pane.unmount()
  expect(store.get('autoApprove')).toBe(true)
  expect(store.get('alwaysPlan')).toBe(true)
  const mirrored = JSON.parse(files.get(MIRROR) ?? '{}') as { autoApprove: boolean; alwaysPlan: boolean }
  expect(mirrored.autoApprove).toBe(true)
  expect(mirrored.alwaysPlan).toBe(true)
})

test('a turn picks up settings and switches another session changed in the store', async ($, on) => {
  const { store, rows } = await boot($, on, [])
  store.set('settings', { tiers: { deep: { model: 'sonnet', effort: 'low', scopeNote: false } } })
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('deep (sonnet/low)')
  expect(lastRow(rows)).not.toContain('Before any tool call for this message')

  store.set('alwaysPlan', true)
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(lastRow(rows)).toContain('Before any tool call for this message')
})

test('opening Settings reads what the store holds now', async ($, on) => {
  const { store } = await boot($, on, [])
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  const mapped = { type: 'Button', key: 'skill-tier:other-skill' } as never
  store.set('settings', { skills: { 'other-skill': 'standard' } })
  expect(await pane.find(mapped)).toBeFalsy()
  await pane.press({ key: 'settings' })
  expect(await pane.find(mapped)).toBeTruthy()
  await pane.unmount()
})

test('helper usage of 0 is not a report; a lifetime that holds one drops it on load', async ($, on) => {
  expect(asHelperUsage({ provider: 'kiro', amount: 0, unit: 'credits' })).toBeUndefined()
  expect(asHelperUsage({ provider: 'kiro', amount: '0', unit: 'credits' })).toBeUndefined()
  expect(asHelperUsage({ provider: 'kiro', amount: 0.03, unit: 'credits' })).toEqual({ provider: 'kiro', amount: 0.03, unit: 'credits' })

  const seeded = {
    mainCost: 5, agentCost: 1, mainEquivalent: 3, steps: 4, plans: 2, since: '2026-10-01T00:00:00.000Z', byTier: { light: 1, standard: 2, deep: 1 },
    helper: { steps: 6, ms: 0, usage: [{ provider: 'kiro', amount: 0, unit: 'credits' }, { provider: 'copilot', amount: 2, unit: 'AIC' }] },
  }
  const { store } = await boot($, on, [...HELPERS, ['lifetime', seeded]])
  const life = store.get('lifetime') as typeof seeded
  expect(life.helper.usage).toEqual([{ provider: 'copilot', amount: 2, unit: 'AIC' }])
  expect(life.helper.steps).toBe(6)
  expect(life.steps).toBe(4)

  // A step marked done with a 0 records no usage.
  await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Survey', tier: 'light', where: 'helper' }] } as never)
  await $.tool.call({ tool: PLAN, start: [{ id: 'h1', helper: 'kiro-light', model: 'Haiku' }] } as never)
  await $.tool.call({ tool: PLAN, done: [{ id: 'h1', usage: { provider: 'kiro', amount: 0, unit: 'credits' } }] } as never)
  expect((store.get('lifetime') as typeof seeded).helper.usage).toEqual([{ provider: 'copilot', amount: 2, unit: 'AIC' }])
})

test('the cost line says which providers\' runs did not report usage', async ($, on) => {
  const step = (id: string, over: Partial<Step> = {}): Step => ({
    id, title: id, tier: 'light', where: 'helper', status: 'done', usage: EMPTY_USAGE, cost: 0, mainCost: 0, reruns: 0, ...over,
  })
  const kiro = { provider: 'kiro', amount: 2.1, unit: 'credits' }
  const list = [
    step('a', { helper: 'kiro-light', helperUsage: kiro }),
    step('b', { helper: 'kiro-light' }),
    step('c', { helper: 'kiro-standard' }),
    step('d', { helper: 'copilot-standard' }),
    step('e', { helper: 'agy-light', helperUsage: { provider: 'agy', amount: 1, unit: 'runs' } }),
  ]
  const totals = helperTotalsOf(list)
  expect(totals.runs).toEqual({ kiro: { n: 3, reported: 1 }, copilot: { n: 1, reported: 0 }, agy: { n: 1, reported: 1 } })
  expect(helperLine(totals)).toBe('Moved off Claude: 5 helper steps; Agy 1 runs; Kiro 2.1 credits (1 of 3 runs reported); Copilot: AIC not reported')
  // All reported: no remark. Totals stored before 0.21.0 have no run counts: no remark either.
  expect(helperLine(helperTotalsOf([list[0]!, list[4]!]))).toBe('Moved off Claude: 2 helper steps; Agy 1 runs; Kiro 2.1 credits')
  expect(helperLine({ steps: 6, ms: 0, usage: [kiro] })).toBe('Moved off Claude: 6 helper steps; Kiro 2.1 credits')
  // A group's usage covers the runs under it.
  const grouped = [step('g', { group: true, helperUsage: kiro }), step('g.a', { parent: 'g', helper: 'kiro-light' }), step('g.b', { parent: 'g', helper: 'kiro-light' })]
  expect(helperTotalsOf(grouped).runs).toEqual({ kiro: { n: 2, reported: 2 } })

  // Through the plan tool: six runs, one reports; the pane (plan, chat and all-time) and the stored totals say so.
  const { store } = await boot($, on, HELPERS)
  const ids = ['h1', 'h2', 'h3']
  await $.tool.call({ tool: PLAN, steps: ids.map(id => ({ id, title: id, tier: 'light', where: 'helper' })) } as never)
  await $.tool.call({ tool: PLAN, start: ids.map(id => ({ id, helper: 'kiro-light', model: 'Haiku' })) } as never)
  await $.tool.call({ tool: PLAN, done: [{ id: 'h1', usage: { provider: 'kiro', amount: 0.03, unit: 'credits' } }, 'h2', 'h3'] } as never)
  const life = store.get('lifetime') as { helper: { steps: number; runs: Record<string, { n: number; reported: number }> } }
  expect(life.helper.steps).toBe(3)
  expect(life.helper.runs).toEqual({ kiro: { n: 3, reported: 1 } })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  const line = /^Moved off Claude: 3 helper steps(, <1 min)?; Kiro 0\.03 credits \(1 of 3 runs reported\)$/
  expect(await pane.find(text(line))).toBeTruthy()
  await pane.press({ key: 'cost-view:all' })
  expect(await pane.find(text(line))).toBeTruthy()
  await pane.unmount()
})

test('when none of a provider\'s runs reported usage the line says so', async ($, on) => {
  const { store } = await boot($, on, HELPERS)
  await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Survey', tier: 'light', where: 'helper' }] } as never)
  await $.tool.call({ tool: PLAN, start: [{ id: 'h1', helper: 'kiro-light', model: 'Haiku' }] } as never)
  await $.tool.call({ tool: PLAN, done: ['h1'] } as never)
  expect((store.get('lifetime') as { helper: { usage: unknown[] } }).helper.usage).toEqual([])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^Moved off Claude: 1 helper step(, <1 min)?; Kiro: credits not reported$/))).toBeTruthy()
  await pane.unmount()
})

test('the rules send the lead to helpers.py usage, with the configured script when there is one', async ($, on) => {
  const { rows, registered } = await boot($, on, [['settings', { helpers: { enabled: true, script: '/skills/herdr-delegate/scripts/helpers.py' } }]])
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain("python3 /skills/herdr-delegate/scripts/helpers.py usage <the helper's name>")
  const tool = registered.at(-1) as unknown as { inputSchema: { properties: Record<string, any> } }
  const usage = JSON.stringify(tool.inputSchema.properties.done)
  expect(usage).toContain('helpers.py usage <name>')
  expect(usage).toContain('never send 0 or a guess')
})

// --- Other Claude accounts and Codex as helpers: orders, units and labels come from helpers.py's config ---

const tiersOf = (m: string) => ({ light: { model: m, effort: 'low' }, standard: { model: m, effort: 'high' }, deep: { model: m, effort: 'high' } })
const accountsConfig = () => ({
  providers: {
    kiro: { label: 'Kiro', cli_found: false, order: 10, unit: 'credits', tiers: tiersOf('k') },
    copilot: { label: 'Copilot', cli_found: true, order: 20, unit: 'AIC', tiers: tiersOf('c') },
    agy: { label: 'Antigravity', cli_found: true, order: 40, tiers: tiersOf('a') },
    codex: { label: 'Codex', cli_found: true, order: 30, unit: '% of 7d', tiers: tiersOf('x') },
    claudeuni: { kind: 'claude', config_dir: '~/.claude-uni', label: 'uni', cli_found: true, self: false, order: 50, unit: '% of 7d', tiers: tiersOf('haiku') },
    claudemain: { kind: 'claude', config_dir: '~/.claude', label: 'main', cli_found: true, self: true, order: 50, unit: '% of 7d', tiers: tiersOf('haiku') },
  },
})

test('default helper orders come from the config: by order, installed CLIs only, never this account; a stored order wins; no config, no helpers', () => {
  const set = mergeSettings({})
  try {
    setHelperConfig(accountsConfig())
    expect(helperList(set, 'light')).toEqual(['copilot-light', 'codex-light', 'agy-light', 'claudeuni-light'])
    // Kiro is not installed: its templates are offered back, not tried.
    expect(helpersOff(set, 'deep')).toEqual(['kiro-deep', 'claudemain-deep'])
    // A stored order wins, and names this account as such.
    const own = mergeSettings({ helpers: { tiers: { light: 'claudemain-light,kiro-light' } } as never })
    expect(helperList(own, 'light')).toEqual(['claudemain-light', 'kiro-light'])
    expect(helperOrder(own, 'light')).toBe('claudemain-light (this account) → kiro-light')
    expect(helperList(own, 'deep')).toEqual(['copilot-deep', 'codex-deep', 'agy-deep', 'claudeuni-deep'])
    // The order is the config's: a provider that moves up is tried first.
    const moved = accountsConfig()
    moved.providers.agy.order = 5
    setHelperConfig(moved)
    expect(helperList(set, 'standard')[0]).toBe('agy-standard')
    // Copilot Fusion needs Copilot: with no installed Copilot a default order does not get it.
    moved.providers.copilot.cli_found = false
    setHelperConfig(moved)
    expect(helperList(mergeSettings({ helpers: { fusion: 'both' } as never }), 'deep')).not.toContain('copilot-fusion-max')
    expect(noHelperCli()).toBe(false)
    const none = accountsConfig()
    for (const p of Object.values(none.providers)) p.cli_found = false
    setHelperConfig(none)
    expect(noHelperCli()).toBe(true)
  } finally {
    setHelperConfig(undefined)
  }
  // No config (no helpers.py, no hc, or a config that failed): there are no helpers, not the hard-coded ones.
  for (const t of ['light', 'standard', 'deep'] as const) {
    expect(helperList(set, t)).toEqual([])
    expect(helpersOff(set, t)).toEqual([])
  }
  expect(helperList(mergeSettings({ helpers: { fusion: 'both' } as never }), 'deep')).toEqual([])
  // Not even a stored order of the user's own is offered while no helper can run.
  expect(helperList(mergeSettings({ helpers: { tiers: { light: 'kiro-light' } } as never }), 'light')).toEqual([])
  expect(helpersAvailable()).toBe(false)
  expect(noHelperCli()).toBe(false)
  // A config with no installed CLI is not available either.
  try {
    const none = accountsConfig()
    for (const p of Object.values(none.providers)) p.cli_found = false
    setHelperConfig(none)
    expect(helpersAvailable()).toBe(false)
    expect(helperList(set, 'light')).toEqual([])
    expect(helpersOff(set, 'light')).toEqual([])
  } finally {
    setHelperConfig(undefined)
  }
})

test('helper usage in the config\'s units and labels: a percent unit follows its number and adds up per provider', () => {
  const step = (id: string, helper: string, usage?: { provider: string; amount: number; unit: string }): Step => ({
    id, title: id, tier: 'light', where: 'helper', status: 'done', usage: EMPTY_USAGE, cost: 0, mainCost: 0, reruns: 0, helper, ...(usage ? { helperUsage: usage } : {}),
  })
  const list = [
    step('a', 'codex-light', { provider: 'codex', amount: 1.5, unit: '% of 7d' }),
    step('b', 'codex-standard', { provider: 'codex', amount: 2, unit: '% of 7d' }),
    step('c', 'claudeuni-light', { provider: 'claudeuni', amount: 0.5, unit: '% of 7d' }),
    step('d', 'claudeuni-light'),
    step('e', 'copilot-light', { provider: 'copilot', amount: 4, unit: 'AIC' }),
  ]
  const totals = helperTotalsOf(list)
  expect(totals.usage).toEqual([
    { provider: 'codex', amount: 3.5, unit: '% of 7d' },
    { provider: 'claudeuni', amount: 0.5, unit: '% of 7d' },
    { provider: 'copilot', amount: 4, unit: 'AIC' },
  ])
  expect(helperFacts(list[0]!)).toBe('1.5% of 7d')
  expect(helperFacts(list[4]!)).toBe('4 AIC')
  expect(helperLine(totals)).toBe('Moved off Claude: 5 helper steps; Claudeuni 0.5% of 7d (1 of 2 runs reported); Codex 3.5% of 7d; Copilot 4 AIC')
  try {
    setHelperConfig(accountsConfig())
    expect(helperLine(totals)).toBe('Moved off Claude: 5 helper steps; Claude uni 0.5% of 7d (1 of 2 runs reported); Codex 3.5% of 7d; Copilot 4 AIC')
    expect(helperLine(helperTotalsOf([step('f', 'agy-light'), step('g', 'claudeuni-light')]))).toBe('Moved off Claude: 2 helper steps; Antigravity: usage not reported; Claude uni: % of 7d not reported')
  } finally {
    setHelperConfig(undefined)
  }
})

test('a Claude account helper\'s --effort and Codex\'s -c model_reasoning_effort are read as the template\'s thinking level', () => {
  const tpl = (command: string) => `---\nname: x\ncommand: ${command}\n---\nbody`
  expect(effortOfTemplate(tpl('CLAUDE_CONFIG_DIR=/h/.claude-uni claude --model haiku --effort xhigh --permission-mode auto'))).toBe('xhigh')
  expect(effortOfTemplate(tpl('codex --no-daemon --model gpt-6 -c model_reasoning_effort=high --ask-for-approval on-request'))).toBe('high')
  expect(effortOfTemplate(tpl('codex --model gpt-6 -c \'model_reasoning_effort="medium"\' --sandbox workspace-write'))).toBe('medium')
  expect(effortOfTemplate(tpl('codex --model gpt-6 --config model_reasoning_effort=low'))).toBe('low')
  expect(effortOfTemplate(tpl('codex --model gpt-6 --sandbox workspace-write'))).toBeUndefined()
})

test('with the config naming installed CLIs the rules list those, with this account marked; with none installed the rules and Settings say so', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  Object.assign(world.cfg, accountsConfig())
  const { rows } = await boot($, on, [['settings', { helpers: { enabled: true, tiers: { standard: 'claudemain-standard,codex-standard' } } }]], [], files, world.setup)
  await $.turn.start({ text: 'first', turnId: 't0' })
  const rules = lastRow(rows)
  expect(rules).toContain('light: copilot-light,codex-light,agy-light,claudeuni-light')
  expect(rules).toContain('standard: claudemain-standard,codex-standard')
  const planned = await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Survey', tier: 'standard', where: 'helper' }] } as never)
  expect(String(planned.result)).toContain('helper (claudemain-standard (this account) → codex-standard)')
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'settings' })
  expect(await pane.find(text(/^1\. claudemain \(this account\)$/))).toBeTruthy()
  expect(await pane.find(text(/No helper CLI installed/))).toBeFalsy()
  await pane.unmount()
})

test('with no helper CLI installed the rules do not mention helpers and Settings says so', async ($, on) => {
  const files2 = new Map<string, string>()
  const world2 = helperWorld(on, files2)
  const none = accountsConfig()
  for (const p of Object.values(none.providers)) p.cli_found = false
  Object.assign(world2.cfg, none)
  const second = await boot($, on, HELPERS, [], files2, world2.setup)
  await $.turn.start({ text: 'first', turnId: 't1' })
  expect(lastRow(second.rows)).not.toContain('runs a step on an agent from another subscription')
  const pane2 = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane2.press({ key: 'settings' })
  expect(await pane2.find(text(/^No helper CLI is installed: install at least one/))).toBeTruthy()
  expect(await pane2.find({ type: 'Button', key: 'helper-off:light:kiro-light' } as never)).toBeFalsy()
  expect(await pane2.find({ type: 'Select', key: 'helper-model:kiro:light' } as never)).toBeFalsy()
  expect(wheres(second.registered.at(-1))).toEqual(['agent', 'here'])
  await pane2.unmount()
})

test('without a strange-loop genome file on this machine, advice queues no strange-loop note and is not marked as noted', async ($, on) => {
  const { store, step } = await boot($, on, [['history', [run(1, { verdict: 'weak' }), run(2, { verdict: 'ok' })]]], [
    { id: 'x1', description: '[r1] review' },
  ])
  await $.tool.call({ tool: PLAN, steps: [{ id: 'r1', title: 'Review A', tier: 'light', where: 'agent', kind: 'code-review' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[r1] review', prompt: 'go' })
  await step('t1', haikuUse, 'x1')
  await end($, 'x1', 't1')
  const res = await $.tool.call({ tool: PLAN, done: [{ id: 'r1', verdict: 'weak' }] } as never)
  expect(String(res.result)).not.toContain('strange-loop')
  expect(store.get('genomeNoted')).toBeUndefined()
})
