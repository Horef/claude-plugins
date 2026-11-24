// Engine tests for model-router: planning, routing, costs, reruns, skill routing, rule delivery, all surfaces.
import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { EMPTY_HELPER, EMPTY_USAGE, applyDraft, applyPreset, presetOf, asHelperEffort, asHelperUsage, baseModelId, compareVersions, customTemplate, depthOf, helperTierDefault, helperTierDiffers, draftCount, effortOfTemplate, fitEffort, modelEfforts, fmtCost, fmtMin, genomeNote, helperFacts, helperLadder, helperLine, helperPickFor, helperStep, helperSuggestions, helperTotalsOf, ladderOf, learnedHelpers, learnedRungs, mergeSettings, modelOf, modelWarnings, modelsChecked, newStep, nextRung, offeredModels, parsePrice, rollupOf, settleGroups, suggestions, templateOfRung, templateRung, trimDraft } from '../hooks/logic'
import { helperList, helperOrder, helpersAvailable, helpersOff, noHelperCli, setHelperConfig } from '../hooks/logic'
import { asVerdict, healthChecks, healthLine, helperModeOf, historyLine, learnedRungs as learned2, logFileName, oldLogFiles, reportFileName, reportMarkdown, verdictLine } from '../hooks/logic'
import { asModelNews, cardModelLine, checkProposals, dayOf, hasModelsJson, modelsAskNote, newModelsCard, notedNew, parseModelsReport, staleProviders, toAsk } from '../hooks/logic'
import { SEED_NOTES, checkNote, findNote, mergeNotes, parseNotesFile } from '../hooks/notes'
import { buildSnapshot, chatKeyOf, newsLines, oldStateFiles, snapshotKey } from '../hooks/snapshot'
import { DEFAULT_SETTINGS, KIND_TAGS, LADDER } from '../hooks/tiers'
import { EXPLORE, VERSION, exploreRungs } from '../hooks/logic'
import { kindList, kindTagsEdited, noteMapLine, runsNow, runsNowText, tagsOfKind, tierOfKind, toggleTag, trySuggestions, withKindTags } from '../hooks/strengths'
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

type Mounted = { find: (q: never) => Promise<unknown>; press: (t: { key: string }) => Promise<unknown> }
const GROUPS = ['models', 'helpers', 'learning', 'prices', 'skills', 'diagnostics', 'advanced']
/** Opens Settings and every group in it (0.26 groups them, closed by default), so a test reaches any row. */
async function openSettings(pane: Mounted) {
  if (!(await pane.find({ type: 'Button', key: 'settings-done' } as never))) await pressPick(pane, 'settings')
  for (const g of GROUPS) {
    if ((await pane.find({ type: 'Button', key: `group:${g}` } as never)) && !(await pane.find({ key: `group-body:${g}` } as never))) await pane.press({ key: `group:${g}` })
  }
}
/** Opens the details of every step (0.26 shows steps as two-line rows). */
async function expandAll(pane: Mounted) {
  const b = (await pane.find({ type: 'Button', key: 'expand-all' } as never)) as { text?: string } | undefined
  if (b && b.text !== 'Collapse all') await pressPick(pane, 'expand-all')
}

const VIEW_LABEL: Record<string, string> = { plan: 'This plan', chat: 'This chat', all: 'All time' }
/** Cycles the cost line's span button to a view and opens Details (0.26: one cycle button; tiles and footnotes in Details). */
async function costView(pane: Mounted, view: 'plan' | 'chat' | 'all') {
  for (let i = 0; i < 3; i++) {
    const b = (await pane.find({ type: 'Button', key: 'cost-view' } as never)) as { text?: string } | undefined
    if (b?.text?.startsWith(VIEW_LABEL[view]!)) break
    await pressPick(pane, 'cost-view')
  }
  if (!(await pane.find({ key: 'cost-detail-body' } as never))) await pressPick(pane, 'cost-details')
}

const lastRow = (rows: { appended: () => readonly unknown[] }) =>
  JSON.stringify(rows.appended().at(-1) ?? '')

type Call = { tool: string; model?: string; effort?: string; prompt?: string }

// The engine's side of an Agent call: it starts the subagent (agent.spawn, where the router sets the model and the scope
// note) and sends the subagent's requests (turn.step, where it sets the effort). The tests' tool.call stand-ins record what
// the subagent runs with, the call as it reached the engine beside it: since O8 the router leaves that call as the model
// wrote it, because auto mode refuses an Agent call a hook changed after its review.
const SESSION_EFFORT = 'max'
let spawnedN = 0
const spawnSeen: { prompt?: string; effort?: string | number } = {}
const isSpawned = (e: unknown) => String((e as { agentId?: string }).agentId ?? '').startsWith('spawned-')
type AgentCall = { tool: string; description?: string; prompt?: string; subagent_type?: string; model?: string; effort?: string }
type Engine = { agent: { spawn: (x: never) => Promise<unknown> }; turn: { step: (x: never) => AsyncIterable<unknown> } }
function spawnStub(on: (event: 'agent.spawn', hook: (_: unknown, e: unknown) => unknown) => void) {
  on('agent.spawn', (_, e) => {
    const x = e as { model?: string; prompt: string }
    spawnSeen.prompt = x.prompt
    return { model: x.model ?? 'inherit', agentId: `spawned-${++spawnedN}` }
  })
}
async function runAgent($: Engine, e: AgentCall): Promise<Call & { asCalled: AgentCall }> {
  spawnSeen.prompt = undefined
  spawnSeen.effort = undefined
  const got = (await $.agent.spawn({ prompt: e.prompt ?? '', description: e.description ?? '', ...(e.subagent_type ? { subagentType: e.subagent_type } : {}), ...(e.model ? { model: e.model } : {}) } as never)) as { model?: string; agentId?: string }
  if (got.agentId) for await (const _ of $.turn.step({ turnId: `${got.agentId}-t`, index: 0, model: 'x', messageCount: 1, agentId: got.agentId, effort: e.effort ?? SESSION_EFFORT } as never)) void _
  const effort = spawnSeen.effort === SESSION_EFFORT ? undefined : (spawnSeen.effort as string | undefined)
  return { tool: e.tool, model: got.model === 'inherit' ? undefined : got.model, effort, prompt: spawnSeen.prompt, asCalled: e }
}

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
    const x = e as { turnId: string; index: number; effort?: string | number }
    if (isSpawned(e)) spawnSeen.effort = x.effort
    return { turnId: x.turnId, index: x.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: usageFor[x.turnId] ?? null } as never
  })
  spawnStub(on as never)
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
  on('tool.call', async (_, e) => {
    calls.push((e as Call).tool === 'Agent' ? await runAgent($ as never, e as AgentCall) : (e as Call))
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
  await openSettings(pane)
  await pressPick(pane, 'auto')
  await pressPick(pane, 'always')
  await pressPick(pane, 'open-pane')
  // Settings take the place of plan, cost and footer until Done.
  expect(await pane.find({ key: 'section:plan' } as never)).toBeFalsy()
  await pressPick(pane, 'settings-done')
  expect(await pane.find({ key: 'section:plan' } as never)).toBeTruthy()
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
  await costView(mid, 'plan')
  const planSaved = (await mid.find({ type: 'Text', text: /of the total$/ }))?.text
  await costView(mid, 'chat')
  expect((await mid.find({ type: 'Text', text: /of the total$/ }))?.text).toBe(planSaved)
  await costView(mid, 'plan')
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
  await expandAll(ui)
  expect((await ui.find({ type: 'Text', text: /saved ≈/ }))?.text).toContain('saved')
  expect((await ui.find({ type: 'Text', text: /^Runs in this chat on opus/ }))?.text).toContain('used if you send it to a Claude agent')
  await costView(ui, 'all')
  expect((await ui.find({ type: 'Text', text: /delegated steps in 1 plans/ }))?.text).toContain('light 1')
  await costView(ui, 'chat')
  expect((await ui.find({ type: 'Text', text: /^Since this chat was opened/ }))?.text).toContain('1 delegated steps')
  await costView(ui, 'plan')
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
  await openSettings(set)
  await set.press({ key: 'set-scope:light' })
  await set.press({ key: 'settings-done' })
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
  await openSettings(narrow)
  expect((await narrow.find({ type: 'Button', key: 'settings-done' } as never))).toBeTruthy()
  // The terminal draws no Select: a picker of up to three options cycles on Enter (⇄); a longer one (0.29) lists its
  // options under it, the current one marked, and a press on one picks it and closes the list.
  expect(await narrow.find({ type: 'Select' } as never)).toBeFalsy()
  const tierBtn = await narrow.find({ type: 'Button', key: 'set-model:light' } as never)
  expect(String((tierBtn as any)?.text ?? JSON.stringify(tierBtn))).toBe('haiku ▾')
  expect(await narrow.find({ type: 'Button', key: 'set-model:light:opt:sonnet' } as never)).toBeFalsy()
  await narrow.press({ key: 'set-model:light' })
  expect((await narrow.find({ type: 'Button', key: 'set-model:light' } as never) as { text: string }).text).toBe('haiku ▴')
  expect((await narrow.find({ type: 'Button', key: 'set-model:light:opt:haiku' } as never) as { text: string }).text).toBe('● haiku')
  expect((await narrow.find({ type: 'Button', key: 'set-model:light:opt:sonnet' } as never) as { text: string }).text).toBe('○ sonnet')
  await narrow.press({ key: 'set-model:light:opt:sonnet' })
  expect((store.get('settings') as { tiers: { light: { model: string } } }).tiers.light.model).toBe('sonnet')
  expect(await narrow.find({ type: 'Button', key: 'set-model:light:opt:sonnet' } as never)).toBeFalsy()
  // Picking the marked one only closes the list; a second press on the picker closes it too.
  await narrow.press({ key: 'set-model:light' })
  await narrow.press({ key: 'set-model:light:opt:sonnet' })
  expect((store.get('settings') as { tiers: { light: { model: string } } }).tiers.light.model).toBe('sonnet')
  await narrow.press({ key: 'set-model:light' })
  await narrow.press({ key: 'set-model:light' })
  expect(await narrow.find({ type: 'Button', key: 'set-model:light:opt:haiku' } as never)).toBeFalsy()
  await pressPick(narrow as never, 'set-model:light')
  await narrow.unmount()

  // The whole pane, settings open (every group), then closed with its cost details, draws on every surface.
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const any = await $.ui.mount({ ...PANE, surface })
    await openSettings(any)
    expect((await any.find({ type: 'Text', text: /^Settings$/ }))?.text).toBe('Settings')
    expect(await any.find({ key: 'group-body:advanced' } as never)).toBeTruthy()
    await any.press({ key: 'settings-done' })
    await costView(any, 'plan')
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
  env: Record<string, string> = { HC_TERMINAL_ID: 'w1:t1' },
) => {
  asker = undefined
  const store = new Map<string, unknown>([['autoApprove', true], ...init])
  // The settings mirror lives in a file under the home directory: here, a map of paths to text. By default this chat
  // runs inside a Herdr terminal, as on the owner's machine.
  mock.env(on, { HOME: HOME, ...env })
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
  const statuses: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    statuses.push((e as { text?: string }).text)
    return { value: undefined }
  })
  on('turn.complete', (_, e) => ({ text: (e as { answer: string }).answer }))
  on('agent.list', () => ({ value: agents.map(a => ({ ...a, type: 'general-purpose', status: 'running' })) }))
  on('turn.step', async function* (_, e) {
    const x = e as { turnId: string; index: number; effort?: string | number }
    if (isSpawned(e)) spawnSeen.effort = x.effort
    else sent.push(x.effort)
    return { turnId: x.turnId, index: x.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: usageFor[x.turnId] ?? null } as never
  })
  const rows = mock.session(on)
  on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'base', scope: 'shared' as const }] }))
  on('tool.call', async (_, e) => {
    // A test may answer the plan's approval question (the dialog is an AskUserQuestion call).
    if ((e as { tool: string }).tool === 'AskUserQuestion' && asker) return asker(e as never) as never
    calls.push((e as Call).tool === 'Agent' ? await runAgent($ as never, e as AgentCall) : (e as Call))
    return { result: { agentId: 'a1' } }
  })
  spawnStub(on as never)

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

  return { store, registered, calls, rows, step, sent, files, statuses }
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
  await openSettings(pane)
  // Basics → Other subscriptions: one picker for helpers off / long steps / all steps.
  await pane.select({ key: 'helpers', value: 'off' })
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
  await openSettings(pane)
  await pressPick(pane, 'helpers-fusion')
  expect((store.get('settings') as { helpers: { fusion: string } }).helpers.fusion).toBe('deep')
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(lastRow(rows)).toContain('deep: kiro-deep,copilot-fusion-max,copilot-deep,agy-deep')
  expect(lastRow(rows)).toContain('standard: kiro-standard,copilot-standard,agy-standard')

  await pressPick(pane, 'helpers-fusion')
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

test('steps are two-line rows: ▸ opens one step in place, Expand all opens every step and is remembered for new chats', async ($, on) => {
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

  // A new install: rows only, the pickers on line 2, no details; plain words for where a step runs.
  const pane = await $.ui.mount(TERMINAL)
  expect(await pane.find(text(/^Plan · 0 of 2 done/))).toBeTruthy()
  expect(await pane.find(text(/Runs in this chat on/))).toBeFalsy()
  expect((await pane.find({ type: 'Button', key: 'where:s1' } as never) as { text: string }).text).toContain('this chat')
  expect((await pane.find({ type: 'Button', key: 'where:s2' } as never) as { text: string }).text).toContain('Claude agent')
  expect(await pane.find({ type: 'Button', key: 'effort:s2' } as never)).toBeTruthy()
  // Still editable: a picker cycles. A here step's level is a label, not a picker.
  await pressPick(pane, 'tier:s2')
  expect(await pane.find({ type: 'Button', key: 'tier:s1' } as never)).toBeFalsy()

  // ▸ opens that step's details only, in place; ▾ closes them.
  await pressPick(pane, 'open:s1')
  expect(await pane.find(text(/Runs in this chat on/))).toBeTruthy()
  expect(await pane.find({ key: 'details:s2' } as never)).toBeFalsy()
  await pressPick(pane, 'open:s1')
  expect(await pane.find(text(/Runs in this chat on/))).toBeFalsy()

  // Expand all opens every step, says Collapse all, and is remembered as the default for new chats.
  await pressPick(pane, 'expand-all')
  expect(await pane.find({ key: 'details:s1' } as never)).toBeTruthy()
  expect(await pane.find({ key: 'details:s2' } as never)).toBeTruthy()
  expect((await pane.find({ type: 'Button', key: 'expand-all' } as never) as { text: string }).text).toBe('Collapse all')
  expect((store.get('settings') as { expandAll: boolean }).expandAll).toBe(true)
  // One step closed by hand stays closed while the rest are open.
  await pressPick(pane, 'open:s2')
  expect(await pane.find({ key: 'details:s2' } as never)).toBeFalsy()
  expect((await pane.find({ type: 'Button', key: 'expand-all' } as never) as { text: string }).text).toBe('Expand all')
  await pressPick(pane, 'expand-all')
  await pressPick(pane, 'expand-all')
  expect(await pane.find({ key: 'details:s1' } as never)).toBeFalsy()
  expect((store.get('settings') as { expandAll: boolean }).expandAll).toBe(false)

  // The glossary is one click away and explains the words of the rows; the terminal gives each term its own line
  // with what it means indented under it (0.29), wider surfaces one line each.
  await pressPick(pane, 'glossary')
  expect(await pane.find(text(/^other subscription$/))).toBeTruthy()
  expect(await pane.find(text(/^an agent of another account/))).toBeTruthy()
  expect(await pane.find(text(/^ok · weak/))).toBeTruthy()
  await pane.unmount()
  // (Still open: the glossary's state belongs to the chat, not the surface.)
  const wide = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await wide.find(text(/^verdict: ok · weak/))).toBeTruthy()
  await wide.unmount()
  await $.tool.call({ tool: PLAN, done: [] } as never)
})

test('the stored Minimal view (0.25) becomes the plan view: full view opens every step, Minimal and new installs start closed', async ($, on) => {
  expect(mergeSettings({ compact: false } as never).expandAll).toBe(true)
  expect(mergeSettings({ compact: true } as never).expandAll).toBe(false)
  expect(mergeSettings(undefined).expandAll).toBe(false)
  expect(mergeSettings({ compact: false, expandAll: false } as never).expandAll).toBe(false)
  expect('compact' in mergeSettings({ compact: true } as never)).toBe(false)
  expect(mergeSettings({ openGroups: ['models', 3, 'models'] } as never).openGroups).toEqual(['models'])

  // Settings stored by 0.25 with the full view: every step opens, and the next write drops `compact`.
  const { store } = await boot($, on, [['settings', { compact: false }]])
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'Read', tier: 'light', where: 'here' }] } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await pane.find({ type: 'Text', text: /Runs in this chat on/ } as never)).toBeTruthy()
  await pressPick(pane, 'expand-all')
  expect('compact' in (store.get('settings') as object)).toBe(false)
  await pane.unmount()
})

test('a chat that starts with the minimal view stored draws its steps closed', async ($, on) => {
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
  // The row says it in three words; the details in a sentence.
  expect(await pane.find({ type: 'Text', text: /^⚠ rated for opus$/ } as never)).toBeTruthy()
  await expandAll(pane)
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
  await expandAll(pane)
  expect(await pane.find({ type: 'Text', text: /^Kept at high: this chat is at 9\dk tokens, over the 40k limit/ } as never)).toBeTruthy()
  await pane.unmount()
})

test('here-step effort: the Settings switch turns it on, adds start to the plan tool, and shows what switches cost', async ($, on) => {
  const { store, registered } = await boot($, on, [['effortLog', [{ at: '2026-11-05T10:00:00Z', from: 'high', to: 'low', context: 20_000, cacheWrite: 19_000, cacheRead: 1_000 }]]])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(pane)
  expect(await pane.find({ type: 'Text', text: /^1 switch so far: 19k tokens written to the cache, 1k read/ } as never)).toBeTruthy()
  await pressPick(pane, 'here-effort')
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
  await openSettings(pane)
  await pressPick(pane, 'set-model:deep')
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
  await openSettings(pane)
  expect(await pane.find(legend)).toBeFalsy()
  expect(await pane.find(dots)).toBeFalsy()
  await pressPick(pane, 'set-model:light')
  expect(await pane.find(legend)).toBeTruthy()
  // Three: beside the picker, on the Models per level header, and on Spend (now Custom).
  expect(await pane.findAll(dots)).toHaveLength(3)
  expect((await pane.find({ type: 'Button', key: 'spend' } as never) as { text: string }).text).toContain('Custom')
  await pressPick(pane, 'always')
  expect(await pane.findAll(dots)).toHaveLength(4)
  // Back to the default: the dot goes.
  await pressPick(pane, 'always')
  expect(await pane.findAll(dots)).toHaveLength(3)
  // A closed group still shows that something inside differs.
  await pressPick(pane, 'group:models')
  expect(await pane.findAll(dots)).toHaveLength(2)
  await pane.unmount()
})

test('moving or switching off a helper changes the order in the rules, one note says so, and none when it is back', async ($, on) => {
  const { store, rows } = await boot($, on, [['settings', { helpers: { enabled: true } }]])
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('light: kiro-light,copilot-light,agy-light')

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await openSettings(pane)
  // The order is one line a level; Edit gives that level its ↑ ↓ off controls.
  expect(await pane.find({ type: 'Button', key: 'helper-down:light:kiro-light' } as never)).toBeFalsy()
  await pressPick(pane, 'order-edit:light')
  await pressPick(pane, 'helper-down:light:kiro-light')
  expect((store.get('settings') as { helpers: { tiers: { light: string } } }).helpers.tiers.light).toBe('copilot-light,kiro-light,agy-light')
  await pressPick(pane, 'helper-off:light:agy-light')
  expect((store.get('settings') as { helpers: { tiers: { light: string } } }).helpers.tiers.light).toBe('copilot-light,kiro-light')
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(lastRow(rows)).toContain('light: copilot-light,kiro-light;')
  expect(lastRow(rows).match(/Helpers changed/g)?.length).toBe(1)
  // The note carries the whole helper rule, so the chat need not piece it together from rule 6.
  expect(lastRow(rows)).toContain('this replaces rule 6: where = ')

  // Switching the helper back on puts it last; "Reset to default order" restores the defaults.
  await pressPick(pane, 'helper-on:light:agy-light')
  expect((store.get('settings') as { helpers: { tiers: { light: string } } }).helpers.tiers.light).toBe('copilot-light,kiro-light,agy-light')
  await pressPick(pane, 'helper-reset')
  // At the default order there is nothing to reset: the link goes.
  expect(await pane.find({ type: 'Button', key: 'helper-reset' } as never)).toBeFalsy()
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
  await openSettings(pane)
  await pressPick(pane, 'order-edit:deep')
  await pressPick(pane, 'helper-down:deep:kiro-deep')
  await pressPick(pane, 'helper-reset')
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
  for (let i = 0; i < 3; i++) await pressPick(pane, 'tier:s1')
  expect(await pane.find(noted)).toBeFalsy()
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(rows.appended().length).toBe(count)

  // Passing through deep to rest on light: one note, the final value only. Since 0.19 the edits wait in the draft
  // (nothing is noted) until Send changes.
  await pressPick(pane, 'tier:s1')
  expect(await pane.find(noted)).toBeFalsy()
  await pressPick(pane, 'tier:s1')
  for (let i = 0; i < 3; i++) await pressPick(pane, 'model:s1')
  expect(await pane.find(noted)).toBeFalsy()
  await pressPick(pane, 'draft-send')
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
  await pressPick(pane, 'where:s1')
  await pressPick(pane, 'draft-send')
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
  await pressPick(pane, 'tier:s1')
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
  expect(tool.inputSchema.properties.done.items.anyOf[1].properties.verdict.enum).toEqual(['ok', 'weak', 'overkill', 'cut-short'])
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
  await expandAll(pane)
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

test('parts nest in the pane, the indent stops at three levels, each part has its own pickers, and rows stay compact', async ($, on) => {
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

  await expandAll(pane)
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
  expect(await pane.find(text(/^Plan · 0 of 1 done$/))).toBeTruthy()

  // Rows have no border around a group; closed, the pickers are still there.
  await pressPick(pane, 'expand-all')
  expect((await pane.find({ type: 'Box', key: 'card:s1' } as never))?.props.borderStyle).toBeUndefined()
  expect(await pane.find({ type: 'Button', key: 'tier:s1.a.b.c.d' } as never)).toBeTruthy()
  expect(await pane.find(text(/0\/1 done$/))).toBeTruthy()
  await pane.unmount()
  expect(lastRow(rows)).toContain('Model routing')
})

test('a change to a part reaches the agent as one note naming the part', async ($, on) => {
  const { rows } = await boot($, on, [])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: partsPlan } as never)
  const pane = await $.ui.mount(TERMINAL)
  await pressPick(pane, 'tier:s1.a.b')
  // The first press picks the tier's own model by name, which changes nothing; the second does.
  await pressPick(pane, 'model:s1.a.1')
  await pressPick(pane, 'model:s1.a.1')
  // Edits to a running plan wait for Send changes (0.19).
  expect(await pane.find(text(/^change noted, applies from the next turn$/))).toBeFalsy()
  await pressPick(pane, 'draft-send')
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

  await expandAll(pane)
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

  await expandAll(pane)
  expect(await pane.find(text(/^30\.04 AIC · <1 min$/))).toBeTruthy()
  expect(await pane.find(text(/^2\.1 credits · <1 min$/))).toBeTruthy()
  const plan = /^Moved off Claude: 3 helper steps, <1 min; Copilot 30\.04 AIC; Kiro 2\.1 credits$/
  expect(await pane.find(text(plan))).toBeTruthy()
  await costView(pane, 'chat')
  expect(await pane.find(text(plan))).toBeTruthy()
  await costView(pane, 'all')
  expect(await pane.find(text(/^Moved off Claude: 4 helper steps, 6 min; Copilot 40\.04 AIC; Kiro 2\.1 credits$/))).toBeTruthy()

  // Never converted to money, and reset with the other statistics: a second click that names what goes.
  await openSettings(pane)
  await pressPick(pane, 'reset-stats')
  expect((store.get('lifetime') as typeof seeded).helper.steps).toBe(4)
  expect(await pane.find(text(/^Really reset the all-time statistics/))).toBeTruthy()
  await pressPick(pane, 'reset-confirm')
  expect(await pane.find(text(/^Statistics reset\.$/))).toBeTruthy()
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
  await expandAll(pane)
  expect(await pane.find(text(/^verdict weak: missed two files$/))).toBeTruthy()
  await costView(pane, 'plan')
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
  await expandAll(pane)
  expect(await pane.find(text(/^code-review on light: 2 of 3 weak: raise code-review's default to haiku\/medium\.$/))).toBeTruthy()
  // The per-kind table is in the cost Details.
  expect(await pane.find(text(/^code-review$/))).toBeFalsy()
  await costView(pane, 'plan')
  expect(await pane.find(text(/^code-review$/))).toBeTruthy()
  await pressPick(pane, 'apply-kind:code-review')
  expect((store.get('settings') as { kinds: Record<string, unknown> }).kinds['code-review']).toEqual({ model: 'haiku', effort: 'medium' })
  expect((JSON.parse(files.get(MIRROR) ?? '{}') as { settings: { kinds: Record<string, unknown> } }).settings.kinds['code-review']).toEqual({ model: 'haiku', effort: 'medium' })
  // The advice is gone (the kind now runs on its own rung, with no runs there yet), and the default is marked.
  expect(await pane.find({ type: 'Button', key: 'apply-kind:code-review' } as never)).toBeFalsy()
  await openSettings(pane)
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

  await pressPick(pane, 'kind-reset:code-review')
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
  await expandAll(pane)
  await openSettings(pane)
  await pressPick(pane, 'auto-route')
  expect((store.get('settings') as { autoRoute: boolean }).autoRoute).toBe(true)
  await pressPick(pane, 'settings-done')
  expect(await pane.find(text(/^auto: haiku · high \(learned, 5 runs\)$/))).toBeTruthy()
  const after = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(after.result)).toContain('[s1] Summarize: standard, haiku/high (auto: learned, 5 runs), kind summarize, running')
  expect(String(after.result)).toContain('[s2] Other: standard, sonnet/medium, planned')
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'high' })

  // The owner picks a model on the step: it wins; the thinking level still comes from auto mode.
  // (A pick in a running plan counts once sent.)
  await pressPick(pane, 'model:s1')
  await pressPick(pane, 'model:s1')
  await pressPick(pane, 'draft-send')
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

  await expandAll(pane)
  const picker = await pane.find({ type: 'Select', key: 'model:n1' } as never)
  expect((picker?.props.options as { value: string }[]).map(o => o.value)).toEqual(['tier', 'haiku', 'sonnet', 'opus', 'fable', 'claude-nova-6'])
  expect(await pane.find(text(/^\? · 5\.0k tok \+ 37\.0k cached · no price for claude-nova-6: left out of savings/))).toBeTruthy()
  expect(await pane.find(text(/^\?$/))).toBeTruthy()
  // Saved stays empty: nothing was priced on both sides.
  expect(await pane.find(text(/of the total$/))).toBeFalsy()

  // Settings lists it with no price; a price set there is kept, and a model can be added by name.
  await openSettings(pane)
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
  await pressPick(pane, 'model-remove:nova')
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
  await costView(pane, 'plan')
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
  await pressPick(pane, 'model:s1')
  await pressPick(pane, 'effort:s1')
  await pressPick(pane, 'tier:s1')
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
  await pressPick(pane, 'draft-send')
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
  await pressPick(pane, 'tier:s1')
  await pressPick(pane, 'where:s1')
  expect((await pane.find(SEND))?.text).toBe('Send changes (2)')
  await pressPick(pane, 'draft-discard')
  expect(await pane.find(SEND)).toBeFalsy()
  expect(await pane.findAll(text(/^✎$/))).toHaveLength(0)
  expect((await pane.find({ type: 'Button', key: 'tier:s1' } as never))?.text).toContain('standard')
  const count = rows.appended().length
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(rows.appended().length).toBe(count)
  await $.tool.call({ tool: 'Agent', description: '[s1] survey', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet', effort: 'medium' })

  // Cycling a picker back to the plan's own value is no edit.
  for (let i = 0; i < 3; i++) await pressPick(pane, 'tier:s1')
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
  await pressPick(pane, 'tier:s1')
  expect(await pane.find(SEND)).toBeFalsy()
  answer('Run it')
  const res = await planning
  expect(String(res.result)).toContain('[s1] Survey: deep, opus/high, planned')
  await $.tool.call({ tool: 'Agent', description: '[s1] survey', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'opus', effort: 'high' })
  // Approved: from here edits wait.
  await pressPick(pane, 'tier:s1')
  expect((await pane.find(SEND))?.text).toBe('Send changes (1)')
  await pane.unmount()
})

test('O8: a routed Agent call reaches the engine as the model wrote it; the subagent still runs on its rung, with the scope note', async ($, on) => {
  const { calls } = await boot($, on, [['settings', { tiers: { standard: { model: 'sonnet', effort: 'medium', scopeNote: true } } }]], [{ id: 'x1', description: '[s1] survey' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: surveyPlan } as never)
  await $.tool.call({ tool: 'Agent', description: '[s1] survey', prompt: 'go', subagent_type: 'general-purpose' })
  const last = calls.at(-1) as Call & { asCalled: AgentCall }
  // Auto mode reviewed this call: model, effort and prompt are untouched, so its verdict holds for the call that runs.
  const { tool_use_id: _id, ...asCalled } = last.asCalled as AgentCall & { tool_use_id?: string }
  expect(asCalled).toEqual({ tool: 'Agent', description: '[s1] survey', prompt: 'go', subagent_type: 'general-purpose' })
  expect(last).toMatchObject({ model: 'sonnet', effort: 'medium' })
  expect(last.prompt).toContain('go')
  expect(last.prompt).toContain('Scope:')
  // A fork, or a call with no step tag, starts as it was written.
  await $.tool.call({ tool: 'Agent', description: 'other', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: undefined, effort: undefined, prompt: 'go' })
})

test('a plan posted anew drops the edits that were never sent; a rerun drops unsent model and thinking picks of its step', async ($, on) => {
  const { calls } = await boot($, on, [], [{ id: 'x1', description: '[s1] survey' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: surveyPlan } as never)
  const pane = await $.ui.mount(TERMINAL)
  await pressPick(pane, 'tier:s1')
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

test('a closed part row shows its model and effort: pickers for a Claude agent part, the helper line for a helper part', async ($, on) => {
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
  await openSettings(pane)
  expect(await pane.find(text(/^Auto picks a rung with at least$/))).toBeTruthy()
  expect((await pane.find({ type: 'Button', key: 'auto-min-runs' } as never))?.text).toContain('5 runs')
  expect((await pane.find({ type: 'Button', key: 'auto-ok-percent' } as never))?.text).toContain('90% ok')
  // Marked so far: auto-approve (boot turns it on), the auto switch (on in the stored settings) and the Learning header.
  expect(await pane.findAll(text(/^•$/))).toHaveLength(3)
  expect(await pane.find(text(/ok in 90% of 5\+ runs/))).toBeTruthy()

  // The picker offers 3, 5, 8, 10, 20 runs and cycles forward: 5 -> 8 -> 10 -> 20 -> 3.
  for (let i = 0; i < 4; i++) await pressPick(pane, 'auto-min-runs')
  expect((store.get('settings') as { autoMinRuns: number }).autoMinRuns).toBe(3)
  expect(await pane.findAll(text(/^•$/))).toHaveLength(4)
  // 90% -> 95% -> 100% -> 70% -> 80%.
  for (let i = 0; i < 4; i++) await pressPick(pane, 'auto-ok-percent')
  expect((store.get('settings') as { autoOkPercent: number }).autoOkPercent).toBe(80)
  expect(await pane.findAll(text(/^•$/))).toHaveLength(5)
  const written = JSON.parse(files.get(MIRROR) ?? '{}') as { settings: { autoMinRuns: number; autoOkPercent: number } }
  expect(written.settings).toMatchObject({ autoMinRuns: 3, autoOkPercent: 80 })
  expect(await pane.find(text(/ok in 80% of 3\+ runs/))).toBeTruthy()

  // With the owner's 3 runs and 80%, the same history now teaches the kind.
  const after = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(after.result)).toContain('[s1] Summarize: standard, haiku/high (auto: learned, 3 runs), kind summarize, planned')
  // Back to the defaults: the dots go.
  await pressPick(pane, 'auto-min-runs')
  await pressPick(pane, 'auto-ok-percent')
  expect((store.get('settings') as { autoMinRuns: number; autoOkPercent: number })).toMatchObject({ autoMinRuns: 5, autoOkPercent: 90 })
  expect(await pane.findAll(text(/^•$/))).toHaveLength(3)
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

/**
 * Presses a control as a person moves a picker on by one: a terminal picker with more than three options opens its
 * list under it (0.29), and the option after the marked one is pressed; any other control is just pressed.
 */
async function pressPick(pane: { press: (q: never) => Promise<unknown>; findAll: (q: never) => Promise<unknown[]> }, key: string) {
  await pane.press({ key } as never)
  const opts = ((await pane.findAll({ type: 'Button' } as never)) as { key?: string; text: string }[]).filter(b => b.key?.startsWith(`${key}:opt:`))
  if (opts.length === 0) return
  const at = opts.findIndex(b => b.text.startsWith('●'))
  await pane.press({ key: opts[(at + 1) % opts.length]!.key } as never)
}

const OFFERED = {
  kiro: { date: '2026-11-07', checked: '2026-11-07', models: ['auto', 'claude-opus-5.5', 'claude-sonnet-5.5', 'claude-haiku-5.5', 'glm-5'] },
  agy: { date: '2026-11-07', checked: '2026-11-07', models: ['claude-sonnet-5-5-high', 'claude-sonnet-5-5-low', 'gemini-3.8-flash-high', 'claude-opus-5-5-high'] },
}

/**
 * helpers.py as the router sees it: the installed skill's folders, its files, and the python runs, answered from a config the
 * `set` and `custom` commands change. `ran` holds every argv; `fail` makes a subcommand exit 1 with that stderr.
 */
const helperWorld = (on: Parameters<TestBody>[1], files: Map<string, string>, o: { present?: boolean; oldScript?: string; noHc?: boolean; noCli?: boolean; direct?: string[]; version?: string } = {}) => {
  const present = o.present ?? true
  const version = o.version ?? '0.6.0'
  // What `models --json` prints (herdr-delegate 0.15+), by the world's test; --cached asks the same.
  const json: { value?: Record<string, unknown> } = {}
  const cfg = helperDefaults()
  if (o.noCli) for (const p of Object.values(cfg.providers)) (p as { cli_found?: boolean }).cli_found = false
  // herdr-delegate 0.15+ marks the providers it can run headless.
  for (const name of o.direct ?? []) ((cfg.providers as Record<string, { direct?: boolean }>)[name]!).direct = true
  const ran: string[][] = []
  const hcRuns: string[][] = []
  const fail: Record<string, string> = {}
  files.set(`${CACHE}/${version}/skills/herdr-delegate/helpers.default.json`, JSON.stringify(helperDefaults()))
  files.set(MODELS_FILE, JSON.stringify(OFFERED))
  const result = (exitCode: number, stdout = '', stderr = '') => ({ value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } })
  const setup = () => {
    on('fs.list', (_, e) => {
      const path = (e as { path: string }).path
      if (present && path === `${HOME}/.claude/plugins/cache`) return { value: [dirEntry('mk')] }
      if (present && path === CACHE) return { value: [dirEntry('0.5.1'), dirEntry(version)] }

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
      if (cmd === 'models' && args.includes('--json') && json.value) {
        if (!args.includes('--cached')) files.set(MODELS_FILE, JSON.stringify(json.value.cache ?? OFFERED))

        return result(0, JSON.stringify(args.includes('--cached') ? json.value.report : (json.value.live ?? json.value.report)))
      }
      if (cmd === 'models') {
        files.set(MODELS_FILE, JSON.stringify({ ...OFFERED, kiro: { ...OFFERED.kiro, date: '2026-11-08', checked: '2026-11-08' } }))

        return result(0, 'kiro     5 models (2026-11-08)\nNOT OFFERED  kiro-light: claude-haiku-5.5 (provider kiro); change it with: helpers.py set\nNEWER        kiro-standard: claude-sonnet-5.5 -> claude-sonnet-5.6\n')
      }

      return result(2, 'usage')
    })
  }

  return { setup, ran, hcRuns, fail, cfg, json, script: `${CACHE}/${version}/skills/herdr-delegate/scripts/helpers.py`, argsOf: (cmd: string) => ran.filter(a => a[2] === cmd) }
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
  await openSettings(pane)
  // Only the helper levels that differ from herdr-delegate's defaults are listed; Change… opens the full grid.
  expect(await pane.find(text(/^All at herdr-delegate's defaults\.$/))).toBeTruthy()
  // The checks that pass are one count; Show lists each, and Hide folds them again.
  expect(await pane.find(text(/^✓ \d+ checks? pass/))).toBeTruthy()
  await pressPick(pane, 'checks-show')
  expect(await pane.find(text(/^✓ \d+ checks? pass/))).toBeFalsy()
  await pressPick(pane, 'checks-hide')
  expect(await pane.find(text(/^✓ \d+ checks? pass/))).toBeTruthy()
  await pressPick(pane, 'helper-grid')
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
  expect(await pane.find(text(/^checked 2026-11-07$/))).toBeTruthy()

  // A change runs set with both values, then reads the config again; the value differs from the shipped default, so it is marked.
  const marks = (await pane.findAll(text(/^•$/))).length
  await pane.select({ key: 'helper-effort:kiro:light', value: 'medium' } as never)
  expect(world.ran.at(-2)).toEqual(['python3', SCRIPT, 'set', 'kiro', 'light', 'model=claude-haiku-5.5', 'effort=medium'])
  expect(world.ran.at(-1)).toEqual(['python3', SCRIPT, 'config'])
  expect((await picker('helper-effort:kiro:light')).props.value).toBe('medium')
  // Marked beside the picker and on the closed-able group's header.
  expect((await pane.findAll(text(/^•$/))).length).toBe(marks + 2)
  await pane.select({ key: 'helper-model:kiro:standard', value: 'claude-opus-5.5' } as never)
  expect(world.ran.at(-2)).toEqual(['python3', SCRIPT, 'set', 'kiro', 'standard', 'model=claude-opus-5.5', 'effort=high'])
  expect((await pane.findAll(text(/^•$/))).length).toBe(marks + 3)
  // Back to the default: the mark goes.
  await pane.select({ key: 'helper-effort:kiro:light', value: 'low' } as never)
  expect((await pane.findAll(text(/^•$/))).length).toBe(marks + 2)
  // With the grid closed, the one level that differs is listed on its provider's line.
  await pressPick(pane, 'helper-grid')
  expect(await pane.find(text(/^Kiro:$/))).toBeTruthy()
  expect(await pane.find(text(/^claude-opus-5\.5 high$/))).toBeTruthy()
  await pressPick(pane, 'helper-grid')

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
  await openSettings(pane)
  expect(await pane.find(text(/^NOT OFFERED/))).toBeFalsy()
  await pressPick(pane, 'helpers-check')
  expect(world.argsOf('models')).toEqual([['python3', SCRIPT, 'models']])
  expect(await pane.find(text(/^NOT OFFERED kiro-light: claude-haiku-5\.5 \(provider kiro\)/))).toBeTruthy()
  expect(await pane.find(text(/^NEWER kiro-standard: claude-sonnet-5\.5 -> claude-sonnet-5\.6$/))).toBeTruthy()
  // The cache was written by helpers.py; the router read it again.
  expect(await pane.find(text(/^checked 2026-11-08$/))).toBeTruthy()
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
  await openSettings(pane)
  expect(await pane.find(text(/^Helpers are agents on other subscriptions or accounts\. They are optional: model-router works without them, running every step as a Claude agent\.$/))).toBeTruthy()
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
  await pressPick(pane, 'helpers-path-toggle')
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
  await pressPick(pane, 'helper-grid')
  expect(await pane.find({ type: 'Select', key: 'helper-model:kiro:light' } as never)).toBeTruthy()
  await pressPick(pane, 'order-edit:light')
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
  // hc was looked for; helpers.py was run for its config (direct mode needs it), which offers no direct provider.
  expect(world.hcRuns[0]).toEqual(['hc', '--version'])
  expect(world.argsOf('config').length).toBe(1)
  expect(wheres(registered.at(-1))).toEqual(['agent', 'here'])
  for (const t of ['light', 'standard', 'deep'] as const) expect(helperList(mergeSettings({ helpers: { enabled: true } }), t)).toEqual([])

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(pane)
  expect(await pane.find(text(/^Helpers run through Herdr's hc, which was not found on your PATH, or directly/))).toBeTruthy()
  // The steps below say what to install, so the failing check does not repeat its fix.
  expect(await pane.find(text(/^Install Herdr and put hc on your PATH/))).toBeFalsy()
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
  await pressPick(pane, 'apply-helper:kiro:standard')
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
  await pressPick(pane, 'apply-helper-kind:research')
  const choice = { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'medium' }
  expect((store.get('settings') as { helpers: { kinds: unknown } }).helpers.kinds).toEqual({ research: choice })
  expect(JSON.parse(files.get(MIRROR) ?? '{}').settings.helpers.kinds).toEqual({ research: choice })
  // Nothing in helpers.py changed: a kind's choice is the router's.
  expect(world.argsOf('set')).toEqual([])
  expect(await pane.find({ type: 'Button', key: 'apply-helper-kind:research' } as never)).toBeFalsy()
  await openSettings(pane)
  expect(await pane.find(text(/^→ kiro claude-haiku-5\.5\/medium$/))).toBeTruthy()
  await pressPick(pane, 'helper-kind-reset:research')
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

  await expandAll(pane)
  expect(await pane.find(text(/^launch kiro-claude-haiku-5-5-medium · claude-haiku-5\.5 medium · auto: learned, 5 runs$/))).toBeTruthy()

  // Auto mode off: the step is back on the tier order, and the lead hears of it with the next plan result.
  await openSettings(pane)
  await pressPick(pane, 'auto-route')
  expect((store.get('settings') as { autoRoute: boolean }).autoRoute).toBe(false)
  const off = String((await $.tool.call({ tool: PLAN, done: [] } as never)).result)
  expect(off).not.toContain('(launch ')
  expect(off).toContain('[h1] Summarize papers: standard, helper (kiro-standard → copilot-standard → agy-standard), kind summarize, planned')
  expect(off).toContain('Helper launch for step [h1] "Summarize papers" changed: no template is named any more; use the tier order.')
  expect(await pane.find(text(/^launch kiro-claude-haiku/))).toBeFalsy()
  // And on again: the template made earlier is reused, and the next turn carries the note.
  await pressPick(pane, 'auto-route')
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
  await expandAll(pane)
  expect(await pane.find(text(/^no template for glm-5 low \('kiro-glm-5-low' cannot be made here\): the order applies$/))).toBeTruthy()

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

  // Levels per model where the ids carry them (0.29): agy's gpt-oss-120b comes at medium only, so moving a high tier to it
  // takes medium instead of a model and level helpers.py refuses (the stuck ⇄ button of 0.28).
  const lv = { providers: { agy: { model_id: '{model}-{effort}', efforts: ['low', 'medium', 'high', 'xhigh'], tiers: {} }, kiro: { efforts: ['low', 'high'], tiers: {} } } } as never
  const lvCache = { agy: { models: ['gpt-oss-120b-medium', 'claude-sonnet-5-5-low', 'claude-sonnet-5-5-high', 'gemini-4-neon-xhigh', 'gemini-4-neon-high'] } }
  expect(modelEfforts(lv, lvCache, 'agy', 'gpt-oss-120b')).toEqual(['medium'])
  expect(modelEfforts(lv, lvCache, 'agy', 'claude-sonnet-5-5')).toEqual(['low', 'high'])
  expect(modelEfforts(lv, lvCache, 'agy', 'not-listed')).toEqual(['low', 'medium', 'high', 'xhigh'])
  expect(modelEfforts(lv, lvCache, 'kiro', 'anything')).toEqual(['low', 'high'])
  expect(fitEffort(lv, lvCache, 'agy', 'gpt-oss-120b', 'high')).toBe('medium')
  expect(fitEffort(lv, lvCache, 'agy', 'gemini-4-neon', 'high')).toBe('high')
  expect(fitEffort(lv, lvCache, 'agy', 'claude-sonnet-5-5', 'medium')).toBe('high')
  expect(fitEffort(lv, lvCache, 'agy', 'claude-sonnet-5-5', 'xhigh')).toBe('high')
  expect(fitEffort(lv, undefined, 'agy', 'gpt-oss-120b', 'high')).toBe('high')
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
  await openSettings(pane)
  await pressPick(pane, 'open-pane')
  await pane.unmount()

  const kept = store.get('settings') as { openPane: boolean; tiers: { deep: { model: string } }; helpers: { enabled: boolean; tiers: { light: string } } }
  expect(kept.openPane).toBe(true)
  expect(kept.tiers.deep.model).toBe('haiku')
  expect(kept.helpers.enabled).toBe(true)
  expect(kept.helpers.tiers.light).toBe('copilot-light')
  const mirrored = (JSON.parse(files.get(MIRROR) ?? '{}') as { settings: typeof kept }).settings
  expect(mirrored.openPane).toBe(true)
  expect(mirrored.tiers.deep.model).toBe('haiku')
  expect(mirrored.helpers.enabled).toBe(true)
})

test('reordering helpers works on the stored order, not this session\'s copy', async ($, on) => {
  const { store } = await boot($, on, HELPERS)
  store.set('settings', { helpers: { enabled: true, tiers: { light: 'copilot-light', standard: 'kiro-standard,copilot-standard,agy-standard' } } })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await openSettings(pane)
  await pressPick(pane, 'order-edit:standard')
  await pressPick(pane, 'helper-up:standard:copilot-standard')
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
  await openSettings(pane)
  await pressPick(pane, 'auto')
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
  await openSettings(pane)
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
  await costView(pane, 'all')
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
  await openSettings(pane)
  // One line a level; Edit lists the helpers one per row.
  expect(await pane.find(text(/^Claude main \(this account\) → Codex$/))).toBeTruthy()
  await pressPick(pane, 'order-edit:standard')
  expect(await pane.find(text(/^1\. Claude main \(this account\)$/))).toBeTruthy()
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
  await openSettings(pane2)
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


// --- 0.24: helper mode and health, the log and the report, cut short, fallbacks, empty states -------------------

const NO_TERMINAL: Record<string, string> = {}
const logPath = () => `${HOME}/.config/model-router/log/${logFileName(new Date())}`
const logEvents = (files: Map<string, string>) => (files.get(logPath()) ?? '').split('\n').filter(Boolean).map(l => JSON.parse(l) as Record<string, unknown>)

test('the helper mode: Herdr inside a Herdr terminal, else direct when a provider runs headless and the setting allows it, else none', () => {
  const f = (hc: boolean, terminal: boolean, direct: boolean) => ({ hc, terminal, direct })
  expect(helperModeOf('auto', f(true, true, true))).toBe('herdr')
  expect(helperModeOf('auto', f(true, false, true))).toBe('direct')
  expect(helperModeOf('auto', f(false, false, true))).toBe('direct')
  expect(helperModeOf('auto', f(true, false, false))).toBe('none')
  expect(helperModeOf('herdr', f(true, false, true))).toBe('none')
  expect(helperModeOf('herdr', f(true, true, false))).toBe('herdr')
  expect(helperModeOf('direct', f(true, true, true))).toBe('direct')
  expect(helperModeOf('direct', f(true, true, false))).toBe('none')
})

test('health checks come in order, each failure with its fix, and what depends on a failure is skipped', () => {
  const on = mergeSettings({ helpers: { enabled: true } })
  const states = (cs: { id: string; state: string }[]) => Object.fromEntries(cs.map(c => [c.id, c.state]))
  const cfg = { providers: { kiro: { cli_found: true }, copilot: { cli_found: true, direct: true } } }

  // Off: everything after the switch is skipped.
  const off = healthChecks({ set: mergeSettings({}), st: { status: 'unknown' }, rules: false })
  expect(off.map(c => c.id)).toEqual(['enabled', 'script', 'python', 'cli', 'hc', 'terminal', 'direct', 'rules'])
  expect(states(off)).toEqual({ enabled: 'fail', script: 'skip', python: 'skip', cli: 'skip', hc: 'skip', terminal: 'skip', direct: 'skip', rules: 'skip' })

  // No helpers.py: its fix names the install line with the marketplace.
  const missing = healthChecks({ set: on, st: { status: 'missing', marketplace: 'mk' }, rules: false })
  expect(missing.find(c => c.id === 'script')?.fix).toBe('Install the herdr-delegate plugin: /plugin install herdr-delegate@mk, then Look again.')
  expect(states(missing).python).toBe('skip')

  // Not in a Herdr terminal, no direct provider: the terminal and direct mode fail, with fixes.
  const noTerm = healthChecks({ set: on, st: { status: 'ready', config: { providers: { kiro: { cli_found: true } } }, hc: true, terminal: false }, rules: false })
  expect(states(noTerm)).toMatchObject({ enabled: 'ok', script: 'ok', python: 'ok', cli: 'ok', hc: 'ok', terminal: 'fail', direct: 'fail', rules: 'skip' })
  // In auto mode the fixes name both ways out; with "Herdr only" they do not offer an update for direct mode.
  expect(noTerm.find(c => c.id === 'terminal')?.fix).toBe('Start Claude from a Herdr terminal, or update herdr-delegate to 0.15+ for direct mode.')
  const herdrOnly = mergeSettings({ helpers: { enabled: true, run: 'herdr' } })
  expect(healthChecks({ set: herdrOnly, st: { status: 'ready', config: { providers: { kiro: {} } }, hc: true, terminal: false }, rules: false }).find(c => c.id === 'terminal')?.fix).toBe('Start Claude from a Herdr terminal, or use direct mode.')

  // Auto mode running direct: a missing Herdr is no failure (no ✗ under a ✓ line), each check says direct mode runs instead.
  const direct = healthChecks({ set: on, st: { status: 'ready', config: cfg, hc: false, terminal: false }, rules: true })
  expect(states(direct)).toMatchObject({ hc: 'skip', terminal: 'skip', direct: 'ok', rules: 'ok' })
  expect(direct.find(c => c.id === 'hc')?.text).toBe("Herdr's hc not found: direct mode runs helpers instead")
  expect(direct.find(c => c.id === 'terminal')?.text).toBe('Not inside a Herdr terminal: direct mode runs helpers instead')
  const hcNoTerm = healthChecks({ set: on, st: { status: 'ready', config: cfg, hc: true, terminal: false }, rules: true })
  expect(states(hcNoTerm)).toMatchObject({ hc: 'ok', terminal: 'skip', direct: 'ok' })
  expect(hcNoTerm.filter(c => c.state === 'fail')).toEqual([])
  expect(hcNoTerm.find(c => c.id === 'terminal')?.text).toBe('Not inside a Herdr terminal: direct mode runs helpers instead')
  // The no-hc case with a mode of none still fails, with both ways in its fix.
  const neither = healthChecks({ set: on, st: { status: 'ready', config: { providers: { kiro: {} } }, hc: false, terminal: false }, rules: false })
  expect(states(neither)).toMatchObject({ hc: 'fail', terminal: 'skip', direct: 'fail' })
  expect(neither.find(c => c.id === 'hc')?.fix).toBe('Install Herdr and put hc on your PATH, or update herdr-delegate to 0.15+ for direct mode.')

  // Inside Herdr direct mode does not matter; the setting "direct" skips the Herdr checks.
  expect(states(healthChecks({ set: on, st: { status: 'ready', config: cfg, hc: true, terminal: true }, rules: false }))).toMatchObject({ terminal: 'ok', direct: 'skip', rules: 'skip' })
  const onlyDirect = mergeSettings({ helpers: { enabled: true, run: 'direct' } })
  expect(states(healthChecks({ set: onlyDirect, st: { status: 'ready', config: cfg, hc: false, terminal: false }, rules: true }))).toMatchObject({ hc: 'skip', terminal: 'skip', direct: 'ok' })

  // A config with no installed CLI fails there, and the rest is skipped.
  const noCli = healthChecks({ set: on, st: { status: 'ready', config: { providers: { kiro: { cli_found: false } } }, hc: true, terminal: true }, rules: false })
  expect(states(noCli)).toMatchObject({ cli: 'fail', hc: 'skip', terminal: 'skip', direct: 'skip' })
})

test('the health line: quiet when helpers are off or can run, the first failing check when they cannot', () => {
  setHelperConfig(undefined)
  const on = mergeSettings({ helpers: { enabled: true } })
  expect(healthLine(mergeSettings({}), [], 'unknown')).toEqual({ ok: true, text: 'Router on · helpers off' })
  const checks = healthChecks({ set: on, st: { status: 'ready', config: { providers: { kiro: {} } }, hc: true, terminal: false }, rules: false })
  const broken = healthLine(on, checks, 'ready')
  expect(broken.ok).toBe(false)
  expect(broken.text).toBe("✗ Helpers can't run: this chat is not inside a Herdr terminal")
  setHelperConfig(helperDefaults(), 'herdr')
  expect(healthLine(on, [], 'ready', ['Kiro', 'Copilot']).text).toBe('✓ Router on · helpers: Herdr (Kiro, Copilot)')
  setHelperConfig(helperDefaults(), 'direct')
  expect(healthLine(on, checks, 'ready').text).toBe('✓ Router on · helpers: direct mode (no Herdr terminal)')
  // The reason comes from what is missing, now that a missing hc is skipped, not failed, in direct mode.
  const viaDirect = healthChecks({ set: on, st: { status: 'ready', config: { providers: { kiro: { direct: true } } }, hc: false, terminal: false }, rules: true })
  expect(healthLine(on, viaDirect, 'ready').text).toBe("✓ Router on · helpers: direct mode (no Herdr's hc)")
  setHelperConfig(undefined)
})

test('log and report names, old log files, and the history line when there is no advice', () => {
  const d = new Date(2026, 10, 19, 9, 5)
  expect(logFileName(d)).toBe('2026-11-19.jsonl')
  expect(reportFileName(d)).toBe('report-20261119-0905.md')
  expect(oldLogFiles(['2026-11-01.jsonl', '2026-11-04.jsonl', '2026-11-05.jsonl', '2026-11-19.jsonl', 'notes.txt'], d)).toEqual(['2026-11-01.jsonl', '2026-11-04.jsonl'])
  expect(historyLine([])).toBe('History: no runs yet; advice starts after 3 runs of a kind.')
  const run = { key: 'k', tier: 'light', model: 'haiku', effort: 'low', cost: 0, setupHeavy: false, rerun: false, at: '2026-11-19' } as HistoryEntry
  expect(historyLine([run, run])).toBe('History: 2 runs; advice needs 3 on one rung.')
  const md = reportMarkdown({
    version: '9.9.9', at: d, platform: 'macos', surface: 'terminal', set: mergeSettings({ helpers: { enabled: true }, log: false }),
    checks: [{ id: 'terminal', state: 'fail', text: 'This chat is not inside a Herdr terminal', fix: 'Start Claude from a Herdr terminal, or use direct mode.' }],
    mode: 'none', st: { status: 'ready' }, history: 4, lifetime: { steps: 2, plans: 1, helperSteps: 3 }, events: ['{"ev":"start"}'],
  })
  expect(md).toContain('Router version: 9.9.9')
  expect(md).toContain('- helpers.enabled: true')
  expect(md).toContain('- log: false')
  expect(md).toContain('✗ This chat is not inside a Herdr terminal — fix: Start Claude from a Herdr terminal')
  expect(md).toContain('```\n{"ev":"start"}\n```')
})

test('cut short says nothing about the model: left out of advice and auto mode, counted apart, and accepted as a verdict', () => {
  expect(asVerdict('cut-short')).toBe('cut-short')
  expect(asVerdict('Cut short')).toBe('cut-short')
  const set = mergeSettings({ autoMinRuns: 3, autoOkPercent: 90 })
  const at = (i: number) => `2026-11-1${i}`
  const run = (verdict: string, i: number) => ({ key: `k${i}`, tier: 'light', kind: 'search', model: 'haiku', effort: 'low', cost: 0, setupHeavy: false, rerun: false, verdict, at: at(i) }) as HistoryEntry
  // Three cut short and two ok: under three judged runs, so no advice and nothing learned.
  const h = [run('cut-short', 1), run('cut-short', 2), run('cut-short', 3), run('ok', 4), run('ok', 5)]
  expect(suggestions(h, set)).toEqual([])
  expect(learned2(h, set)).toEqual({})
  // Weak runs cut short do not raise the rung either.
  const w = [run('weak', 1), run('cut-short', 2), run('cut-short', 3), run('ok', 4), run('ok', 5), run('ok', 6)]
  expect(suggestions(w, set)).toEqual([])
  expect(verdictLine({ ok: 1, weak: 0, overkill: 0, none: 0, cutShort: 2 })).toBe('1 ok, 2 cut short')
})

test('outside a Herdr terminal with no headless helper, helpers cannot run: no helper in the tool or the rules, and the pane and the status line say why', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  const { registered, rows, statuses } = await boot($, on, [HELPERS_ON], [], files, world.setup, NO_TERMINAL)
  expect(wheres(registered.at(-1))).toEqual(['agent', 'here'])
  expect(statuses.at(-1)).toContain('helpers ✗')
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows).toLowerCase()).not.toContain('helper')

  for (const surface of ['desktop', 'terminal'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface } as never)
    expect(await pane.find(text(/^✗ Helpers can't run: this chat is not inside a Herdr terminal$/))).toBeTruthy()
    // The checks and their fixes are one click away.
    expect(await pane.find(text(/^Start Claude from a Herdr terminal, or update herdr-delegate to 0\.15\+ for direct mode\.$/))).toBeFalsy()
    await pressPick(pane, 'health-why')
    expect(await pane.find(text(/^✓ herdr-delegate's helpers\.py found$/))).toBeTruthy()
    expect(await pane.find(text(/^✗ This chat is not inside a Herdr terminal$/))).toBeTruthy()
    expect(await pane.find(text(/^Start Claude from a Herdr terminal, or update herdr-delegate to 0\.15\+ for direct mode\.$/))).toBeTruthy()
    await pressPick(pane, 'health-why')
    await pane.unmount()
  }
  // Settings keep the health line on top, and Basics say the same in one word.
  const mini = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(mini)
  expect(await mini.find(text(/^✗ Helpers can't run/))).toBeTruthy()
  // Under Basics → Other subscriptions, and on the group's closed header (the full list with fixes is inside).
  expect(await mini.findAll(text(/^✗ This chat is not inside a Herdr terminal/))).toHaveLength(3)
  await mini.unmount()

  const status = await $.tool.call({ tool: PLAN, status: true } as never)
  expect(String(status.result)).toContain('"helperMode":"none"')
  expect(String(status.result)).toContain('fail terminal: This chat is not inside a Herdr terminal')
  expect(String(status.result)).toContain('"log":"/home/tester/.config/model-router/log/')
  expect(String(status.result)).toContain('"history":0')
})

test('direct mode: without a Herdr terminal a headless helper runs through helpers.py run; the setting can forbid it', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { direct: ['copilot'] })
  const { registered, rows, store } = await boot($, on, [HELPERS_ON], [], files, world.setup, NO_TERMINAL)
  expect(wheres(registered.at(-1))).toEqual(['agent', 'here', 'helper'])
  await $.turn.start({ text: 'first', turnId: 't0' })
  const rules = lastRow(rows)
  expect(rules).toContain(`python3 ${SCRIPT} run <template> --brief <file> --cwd <dir>`)
  expect(rules).toContain('run_in_background')
  expect(rules).toContain(`python3 ${SCRIPT} pick <order>`)
  expect(rules).toContain('fallback: \\"<short reason>\\"')
  expect(rules).not.toContain('helpers.py usage')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^✓ Router on · helpers: direct mode \(no Herdr terminal\)$/))).toBeTruthy()
  // "Herdr only" forbids direct mode: helpers cannot run, the plan tool drops "helper", and the chat is told.
  await openSettings(pane)
  await pane.select({ key: 'helpers-run', value: 'herdr' } as never)
  expect((store.get('settings') as { helpers: { run: string } }).helpers.run).toBe('herdr')
  expect(wheres(registered.at(-1))).toEqual(['agent', 'here'])
  expect(await pane.find(text(/^✗ Helpers can't run: this chat is not inside a Herdr terminal$/))).toBeTruthy()
  await pane.unmount()
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(lastRow(rows)).toContain('Helpers are now off: run every step as a subagent or here')
})

test('inside Herdr the health line names the helpers, and Herdr mode keeps rule 6 as it was', async ($, on) => {
  const { rows } = await boot($, on, [HELPERS_ON])
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await pane.find(text(/^✓ Router on · helpers: Herdr \(Kiro, Copilot, Antigravity\)$/))).toBeTruthy()
  await pane.unmount()
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows)).toContain('load the herdr-delegate skill and follow it')
  expect(lastRow(rows)).not.toContain('--brief')
})

test('rules delivered with helpers off: switching them on sends the helper rule at the next turn, once', async ($, on) => {
  const { rows } = await boot($, on, [])
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows).toLowerCase()).not.toContain('helper')
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(pane)
  await pane.select({ key: 'helpers', value: 'long' })
  await $.turn.start({ text: 'second', turnId: 't1' })
  const note = lastRow(rows)
  expect(note).toContain('Helpers changed; this replaces rule 6: where = ')
  expect(note).toContain('kiro-deep,copilot-deep,agy-deep')
  const count = rows.appended().length
  await $.turn.start({ text: 'third', turnId: 't2' })
  expect(rows.appended().length).toBe(count)
  // "Use helpers for" changed mid-chat: the chat hears the new rule.
  await pane.select({ key: 'helpers', value: 'all' } as never)
  await pane.unmount()
  await $.turn.start({ text: 'fourth', turnId: 't3' })
  expect(lastRow(rows)).toContain('every self-contained step that would otherwise be')
})

test('the log: one JSON line per event, ids and models but never titles; off in Settings writes nothing', async ($, on) => {
  const { files } = await boot($, on, [HELPERS_ON], [{ id: 'x1', description: '[a1] secret title' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: [{ id: 'a1', title: 'Secret title', tier: 'light', where: 'agent', kind: 'search' }, { id: 'h1', title: 'Other secret', tier: 'deep', where: 'helper' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[a1] secret title', prompt: 'the brief text' })
  await $.tool.call({ tool: PLAN, start: [{ id: 'h1', fallback: 'picker found nothing' }] } as never)
  await $.tool.call({ tool: PLAN, done: [{ id: 'a1', verdict: 'ok', why: 'private reason' }] } as never)
  const evs = logEvents(files)
  expect(evs.map(e => e.ev)).toEqual(expect.arrayContaining(['start', 'health', 'rules', 'plan', 'route', 'fallback', 'verdict']))
  expect(evs.find(e => e.ev === 'route')).toMatchObject({ id: 'a1', model: 'haiku', effort: 'low', source: 'tier' })
  expect(evs.find(e => e.ev === 'fallback')).toMatchObject({ id: 'h1', reason: 'picker found nothing' })
  expect(evs.find(e => e.ev === 'plan')).toMatchObject({ steps: [{ id: 'a1', tier: 'light', where: 'agent', kind: 'search' }, { id: 'h1', tier: 'deep', where: 'helper' }] })
  const raw = files.get(logPath()) ?? ''
  expect(raw).not.toMatch(/secret|brief text|private reason/i)
  expect(typeof evs[0]!.t).toBe('string')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(pane)
  await pressPick(pane, 'log')
  await pane.unmount()
  const before = files.get(logPath())
  await $.tool.call({ tool: PLAN, steps: [{ id: 'b1', title: 'Next', tier: 'light', where: 'agent' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[b1] next', prompt: 'go' })
  expect(files.get(logPath())).toBe(before)
})

test('Write report: the file lands under ~/.config/model-router with the checks and the last log events, and the pane says where; /router report too', async ($, on) => {
  const { files } = await boot($, on, [HELPERS_ON], [], new Map(), undefined, NO_TERMINAL)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pressPick(pane, 'health-why')
  await pressPick(pane, 'health-report')
  const shown = await pane.find(text(/^Report written: ~\/\.config\/model-router\/report-\d{8}-\d{4}\.md — send this file$/))
  expect(shown).toBeTruthy()
  const path = [...files.keys()].find(k => /\/model-router\/report-\d{8}-\d{4}\.md$/.test(k))!
  expect(path.startsWith(`${HOME}/.config/model-router/`)).toBe(true)
  const md = files.get(path)!
  expect(md).toContain('## Health checks')
  expect(md).toContain('✗ This chat is not inside a Herdr terminal — fix:')
  expect(md).toContain('- helpers.enabled: true')
  expect(md).toContain('"ev":"start"')
  // The same button sits in Settings → Diagnostics.
  await openSettings(pane)
  expect(await pane.find({ type: 'Button', key: 'settings-report' } as never)).toBeTruthy()
  await pane.unmount()
  const ran = await $.command.run({ command: 'router', args: 'report' } as never)
  expect(String((ran as { text?: string }).text)).toMatch(/^Model router report written: ~\/\.config\/model-router\/report-/)
})

test('a run cut short: no rerun when delegated again, out of the advice, and the card\'s link marks it and puts the verdict back', async ($, on) => {
  const { store } = await boot($, on, [], [{ id: 'x1', description: '[s1] list' }])
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'List', tier: 'light', where: 'agent', kind: 'search' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[s1] list', prompt: 'go' })
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'x1' } as never)
  await $.tool.call({ tool: PLAN, done: [{ id: 's1', verdict: 'weak', why: 'lost' }] } as never)
  const history = () => store.get('history') as HistoryEntry[]
  expect(history().at(-1)?.verdict).toBe('weak')

  // The card's quiet link marks the run cut short, in the plan and in its history entry; again puts "weak" back.
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await expandAll(pane)
  await pressPick(pane, 'cut:s1')
  expect(history().at(-1)?.verdict).toBe('cut-short')
  expect(await pane.find(text(/^cut short: says nothing about the model/))).toBeTruthy()
  await pressPick(pane, 'cut:s1')
  expect(history().at(-1)?.verdict).toBe('weak')
  await pressPick(pane, 'cut:s1')
  await pane.unmount()

  // Delegated again after a cut-short run: not a rerun.
  await $.tool.call({ tool: 'Agent', description: '[s1] list', prompt: 'go' })
  expect(history().at(-1)?.rerun).toBe(false)
  const text1 = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(text1.result)).toContain('[s1] List: light, haiku/low, kind search, running')
  const steps = await $.tool.call({ tool: PLAN, status: true } as never)
  expect(String(steps.result)).toContain('"history":1')
})

test('a helper step that falls back: start with a reason, or an Agent call without one; the card and the totals say so', async ($, on) => {
  const { store } = await boot($, on, [HELPERS_ON], [{ id: 'x2', description: '[h2] survey' }])
  await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'Sweep', tier: 'light', where: 'helper' }, { id: 'h2', title: 'Survey', tier: 'deep', where: 'helper' }] } as never)
  await $.tool.call({ tool: PLAN, start: [{ id: 'h1', fallback: 'out of quota' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[h2] survey', prompt: 'go' })
  const plan = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(plan.result)).toContain('[h1] Sweep: light, haiku/low, planned')
  expect(String(plan.result)).not.toContain('runs helper')
  const life = store.get('lifetime') as { fallbacks?: number; lastFallback?: string }
  expect(life.fallbacks).toBe(2)
  expect(life.lastFallback).toBe('no reason given')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)

  await expandAll(pane)
  expect(await pane.find(text(/^ran as a Claude agent: out of quota$/))).toBeTruthy()
  expect(await pane.find(text(/^ran as a Claude agent: no reason given$/))).toBeTruthy()
  expect(await pane.find(text(/^Off Claude: no helper steps yet · 2 ran as subagents: no reason given$/))).toBeTruthy()
  await costView(pane, 'all')
  expect(await pane.find(text(/^Off Claude: no helper steps yet · 2 ran as subagents: no reason given$/))).toBeTruthy()
  expect(await pane.find(text(/delegated steps \(0 on helpers\) in 1 plans/))).toBeTruthy()
  await pane.unmount()
})

test('empty states: helpers on and none run yet; no history yet, or runs without advice; never a heading with nothing under it', async ($, on) => {
  await boot($, on, [HELPERS_ON, ['welcomeSeen', true]])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^Off Claude: no helper steps yet$/))).toBeTruthy()
  expect(await pane.find(text(/^History: no runs yet; advice starts after 3 runs of a kind\.$/))).toBeTruthy()
  // The same on the terminal, and no plan means one line, not an empty heading.
  const tty = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await tty.find(text(/^Off Claude: no helper steps yet$/))).toBeTruthy()
  expect(await tty.find(text(/^History: no runs yet/))).toBeTruthy()
  expect(await tty.find(text(/^What the history says$/))).toBeFalsy()
  expect(await tty.find(text(/^No plan yet\. Multi-step tasks show their steps here\.$/))).toBeTruthy()
  expect(await tty.find(text(/^Turn on "Plan every message" in Settings/))).toBeTruthy()
  expect(await tty.find({ key: 'plan-head' } as never)).toBeFalsy()
  await tty.unmount()
  await pane.unmount()
})

test('with runs but no advice the cost section shows the history\'s one line, not an empty heading', async ($, on) => {
  const run = { key: 'k1', tier: 'light', where: 'agent', model: 'haiku', effort: 'low', cost: 0.01, setupHeavy: false, rerun: false, verdict: 'ok', at: '2026-11-18T00:00:00.000Z' }
  await boot($, on, [['history', [run, { ...run, key: 'k2' }]], ['settings', { compact: true }]])
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await pane.find(text(/^History: 2 runs; advice needs 3 on one rung\.$/))).toBeTruthy()
  expect(await pane.find(text(/^What the history says$/))).toBeFalsy()
  await pane.unmount()
})

// --- New models (0.25): the check by itself, notes, the plan tool's models input, the card -------------------

const ago = (n: number) => dayOf(new Date(Date.now() - n * 86_400_000))
const NOTES_FILE = `${HOME}/.config/model-router/model-notes.json`

test('notes: the seed has the facts, a note is found by id, alias or normalised id, the file wins, tags are checked', () => {
  const notes = mergeNotes(undefined)
  const neon = findNote(notes, 'gemini-4-neon')!
  expect(neon.by).toBe('seed')
  expect(neon.released).toBe('2026-11-18')
  expect(neon.providers).toEqual(['agy', 'copilot'])
  expect(neon.tags).toEqual(['judgment', 'agentic', 'research', 'long-context', 'second-opinion'])
  expect(neon.fits.map(f => `${f.tier} ${f.effort}`)).toEqual(['deep high', 'second high', 'standard medium'])
  expect(neon.sources.map(x => x.url)).toContain('https://9to5google.com/2026/11/18/gemini-4-neon-announcement/')
  expect(findNote(notes, 'gemini-4-argon')!.fits[0]).toMatchObject({ tier: 'second', effort: 'high' })
  expect(findNote(notes, 'gemini-3.8-flash')!.fits[0]!.tier).toBe('light')
  expect(findNote(notes, 'GEMINI-3-8-FLASH')?.id).toBe('gemini-3.8-flash')
  // The Claude models by alias, by full id and by Kiro's or Copilot's spelling.
  for (const id of ['sonnet', 'claude-sonnet-5-5', 'claude-sonnet-5.5', 'Claude-Sonnet-5.5']) expect(findNote(notes, id)?.id).toBe('claude-sonnet-5-5')
  expect(findNote(notes, 'haiku')?.fits[0]!.tier).toBe('light')
  expect(findNote(notes, 'fable')?.id).toBe('claude-fable-5-2')
  expect(findNote(notes, 'constructor')).toBeUndefined()
  expect(findNote(notes, 'gemini-9')).toBeUndefined()
  expect(SEED_NOTES.every(n => n.by === 'seed' && n.checked === '2026-11-19')).toBe(true)

  // The file wins for the same id.
  const file = parseNotesFile(JSON.stringify({ models: { 'gemini-4-neon': { name: 'Mine', summary: 'mine', by: 'person', checked: '2026-11-20' }, junk: 5 } }))
  expect(Object.keys(file)).toEqual(['gemini-4-neon'])
  expect(findNote(mergeNotes(file), 'gemini-4-neon')).toMatchObject({ name: 'Mine', by: 'person' })
  expect(parseNotesFile('not json')).toEqual({})

  // An agent's note: by agent, dated today; unknown tags are dropped and named; a note with no summary or a bad id is refused.
  const c = checkNote({ id: 'Gemini-5-Xenon', name: 'Gemini 5 Xenon', summary: 'A model', tags: ['code', 'fast', 'magic'], released: 'last week', sources: [{ title: 'x', url: 'ftp://x' }, { url: 'https://x.test/a', date: '2026-11-20' }], fits: [{ tier: 'deep', why: 'strong' }, { why: 'no tier' }] }, '2026-11-21')
  expect(c.note).toMatchObject({ id: 'gemini-5-xenon', by: 'agent', checked: '2026-11-21', tags: ['code', 'fast'] })
  expect(c.note!.released).toBeUndefined()
  expect(c.note!.sources).toEqual([{ title: 'https://x.test/a', url: 'https://x.test/a', date: '2026-11-20' }])
  expect(c.dropped.join('|')).toContain('tag "magic"')
  expect(c.dropped.join('|')).toContain('released "last week"')
  expect(checkNote({ id: 'x y', summary: 's' }, '2026-11-21').error).toContain('not a model id')
  expect(checkNote({ id: 'ok' }, '2026-11-21').error).toContain('summary')
})

test('the models report: parsed, older helpers.py recognised, stale providers found, news and asks worked out', () => {
  const report = parseModelsReport(JSON.stringify({ providers: { agy: { date: '2026-11-19', checked: '2026-11-19', count: 3 } }, not_offered: [{ template: 'kiro-light', model: 'claude-haiku-5.5' }], newer: [], new: [{ provider: 'agy', model: 'gemini-5-xenon', first_seen: ago(1) }, { provider: 'bad' }], gone: [{ provider: 'kiro', model: 'glm-4', since: ago(2) }] }))!
  expect(report.new).toHaveLength(1)
  expect(parseModelsReport('kiro     5 models (2026-11-08)\nNEWER ...')).toBeUndefined()
  expect(hasModelsJson('/h/.claude/plugins/cache/mk/herdr-delegate/0.6.0/skills/herdr-delegate/scripts/helpers.py')).toBe(false)
  expect(hasModelsJson('/h/.claude/plugins/cache/mk/herdr-delegate/0.15.0/skills/herdr-delegate/scripts/helpers.py')).toBe(true)
  expect(hasModelsJson('/opt/mine/helpers.py')).toBe(true)

  const cfg = { providers: { kiro: { cli_found: true }, agy: { cli_found: true }, codex: { cli_found: false }, mine: { cli_found: true, self: true }, other: { cli_found: true, kind: 'claude' } } }
  // Missing or older than 7 days counts; a missing CLI, this account and another Claude account do not.
  expect(staleProviders(cfg, report, { kiro: { date: ago(8) } }, ago(0))).toEqual(['kiro'])
  expect(staleProviders(cfg, report, { kiro: { date: ago(7) } }, ago(0))).toEqual([])
  expect(staleProviders(cfg, undefined, undefined, ago(0))).toEqual(['kiro', 'agy'])
  // A list that failed today (Kiro logged out) waits until tomorrow.
  expect(staleProviders(cfg, report, { kiro: { date: ago(12), checked: ago(0), error: 'Not logged in' } }, ago(0))).toEqual([])

  // Newly seen models are remembered; one with a note is not asked about, one without is, once.
  const notes = mergeNotes(undefined)
  let news = notedNew(asModelNews(undefined), [...report.new, { provider: 'agy', model: 'gemini-4-neon', first_seen: ago(1) }])
  expect(Object.keys(news.seen).sort()).toEqual(['agy:gemini-4-neon', 'agy:gemini-5-xenon'])
  expect(notedNew(news, report.new)).toBe(news)
  const ask = toAsk(news, notes, report, ago(0))
  expect(ask.fresh.map(m => m.model)).toEqual(['gemini-4-neon', 'gemini-5-xenon'].filter(m => m !== 'gemini-4-neon'))
  expect(ask.gone.map(g => g.template)).toEqual(['kiro-light'])
  const text = modelsAskNote(ask, PLAN, p => (p === 'agy' ? 'Antigravity' : p))
  expect(text).toContain(`New models offered: Antigravity gemini-5-xenon (first seen ${ago(1)}); no longer offered: kiro claude-haiku-5.5, used by kiro-light.`)
  expect(text).toContain('do not interrupt it')
  expect(text).toContain('https://openrouter.ai/api/v1/models')
  expect(text).toContain(`call ${PLAN} with models: {notes: [...], proposals: [...]}`)
  news = { ...news, asked: ['agy:gemini-5-xenon', 'gone:kiro:claude-haiku-5.5'] }
  expect(toAsk(news, notes, report, ago(0))).toEqual({ fresh: [], gone: [] })
  // A model first seen over 14 days ago is no longer new.
  expect(toAsk(notedNew(asModelNews(undefined), [{ provider: 'agy', model: 'gemini-6', first_seen: ago(15) }]), notes, undefined, ago(0)).fresh).toEqual([])
})

test('proposals are checked against the config, the offered models and the levels; the card shows only what needs a click', () => {
  setHelperConfig({ providers: { agy: { label: 'Antigravity', model_id: '{model}-{effort}', efforts: ['low', 'medium', 'high'], tiers: { deep: { model: 'claude-opus-5-5', effort: 'high' }, second: { model: 'gemini-4-argon', effort: 'high' } } } } })
  const cfg = helperDefaults() as never
  const ctx = { cfg: { providers: { agy: { label: 'Antigravity', model_id: '{model}-{effort}', efforts: ['low', 'medium', 'high'], tiers: { deep: { model: 'claude-opus-5-5', effort: 'high' }, second: { model: 'gemini-4-argon', effort: 'high' } } } } } as never, cache: { agy: { models: ['gemini-4-neon-high', 'gemini-4-argon-high', 'gemini-4-argon-low'] } }, set: mergeSettings(undefined), news: asModelNews({ dismissed: ['agy|deep|gemini-4-argon|low'] }), today: '2026-11-19' }
  void cfg
  const r = checkProposals(
    [
      { provider: 'agy', tier: 'deep', model: 'gemini-4-neon', effort: 'high', why: 'Opus-class, off Claude quota', source: 'https://x.test' },
      { provider: 'agy', tier: 'second', model: 'Gemini-4-Neon', effort: 'high', why: 'normalised id' },
      { provider: 'agy', tier: 'deep', model: 'claude-opus-5-5', effort: 'high', why: 'same as now' },
      { provider: 'agy', tier: 'deep', model: 'gemini-9', effort: 'high', why: 'not offered' },
      { provider: 'agy', tier: 'deep', model: 'gemini-4-neon', effort: 'xhigh', why: 'no such level' },
      { provider: 'agy', tier: 'argon', model: 'gemini-4-neon', effort: 'high', why: 'no such tier' },
      { provider: 'kiro', tier: 'deep', model: 'x', effort: 'high', why: 'not in config' },
      { provider: 'agy', tier: 'deep', model: 'gemini-4-argon', effort: 'low', why: 'dismissed' },
      { provider: 'claude', tier: 'light', model: 'sonnet', effort: 'low', why: 'better' },
      { provider: 'claude', tier: 'light', model: 'haiku', effort: 'low', why: 'same' },
      { provider: 'claude', tier: 'light', model: 'gpt', effort: 'low', why: 'unknown' },
      { provider: 'claude', tier: 'light', model: 'haiku', effort: 'huge', why: 'bad level' },
      { provider: 'claude', tier: 'second', model: 'haiku', effort: 'low', why: 'claude has no second' },
      { provider: 'agy', tier: 'deep', model: 'gemini-4-neon', effort: 'high' },
    ],
    ctx,
  )
  expect(r.ok.map(p => p.key)).toEqual(['agy|deep|gemini-4-neon|high', 'agy|second|gemini-4-neon|high', 'claude|light|sonnet|low'])
  expect(r.ok[0]).toMatchObject({ source: 'https://x.test', at: '2026-11-19' })
  expect(r.skipped).toHaveLength(11)
  expect(r.skipped.join('\n')).toContain('already')
  expect(r.skipped.join('\n')).toContain('dismissed by the person')
  // A level the provider has but this model is not offered at (agy lists ids per level) is refused before it reaches the card.
  expect(r.skipped.join('\n')).toContain('gemini-4-neon on agy comes at high')
  expect(r.skipped.join('\n')).toContain('does not offer gemini-9')
  setHelperConfig(undefined)

  // The card: nothing when every new model has a note and no proposal is pending.
  const base = { notes: mergeNotes(undefined), report: undefined, cache: undefined, cfg: undefined, set: mergeSettings(undefined), today: ago(0) }
  expect(newModelsCard({ ...base, news: asModelNews({ seen: { 'agy:gemini-4-neon': ago(1) } }) })).toBeUndefined()
  expect(newModelsCard({ ...base, news: asModelNews(undefined) })).toBeUndefined()
  const c = newModelsCard({ ...base, news: asModelNews({ seen: { 'agy:gemini-5-xenon': ago(1), 'agy:gemini-4-neon': ago(1), 'copilot:gemini-4-neon': ago(1) } }) })!
  expect(c.models.map(m => cardModelLine(m))).toEqual([expect.stringMatching(/^Gemini 4 Neon · Agy, Copilot · 2026-11-18 · Google's mid-top/), expect.stringMatching(/^gemini-5-xenon · Agy · notes not written yet$/)])
  expect(cardModelLine(c.models[0]!, 30).endsWith('…')).toBe(true)
  // A pending Claude proposal shows with the tier's current rung; one the tier already has is no proposal.
  const prop = { key: 'claude|light|sonnet|low', provider: 'claude', tier: 'light', model: 'sonnet', effort: 'low', why: 'better', at: ago(0) }
  const withProp = newModelsCard({ ...base, news: asModelNews({ proposals: [prop] }) })!
  expect(withProp.proposals).toEqual([{ key: prop.key, tier: 'light', label: 'Claude', from: 'haiku/low', to: 'sonnet/low', why: 'better' }])
  expect(newModelsCard({ ...base, set: mergeSettings({ tiers: { light: { model: 'sonnet', effort: 'low', scopeNote: false } } } as never), news: asModelNews({ proposals: [prop] }) })).toBeUndefined()
})

const modelsReport = (over: Record<string, unknown> = {}) => ({
  providers: { agy: { date: ago(0), checked: ago(0), count: 4 }, kiro: { date: ago(0), checked: ago(0), count: 5 } },
  not_offered: [],
  newer: [],
  new: [],
  gone: [],
  ...over,
})

test('at the start the cached report is read; a provider list older than a week starts one live check in the background; its new models are queued as ONE router note, once', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { version: '0.15.0' })
  // Antigravity's list is 10 days old: stale. It offers a model nobody has a note for.
  const cache = { ...OFFERED, agy: { ...OFFERED.agy, date: ago(10), checked: ago(10), models: [...OFFERED.agy.models, 'gemini-5-xenon-high', 'gemini-4-neon-high'] } }
  files.set(MODELS_FILE, JSON.stringify(cache))
  const stale = modelsReport({ providers: { agy: { date: ago(10), checked: ago(10), count: 6 }, kiro: { date: ago(0), count: 5 } } })
  const { rows, store } = await boot($, on, [HELPERS_ON], [], files, () => {
    world.setup()
    // Cached: what the cache says. Live: the check found new models.
    world.json.value = { report: stale, cache, live: modelsReport({ new: [{ provider: 'agy', model: 'gemini-5-xenon', first_seen: ago(0) }] }) }
  })
  // The cached report came first (awaited at the start); the live one was started because agy is stale, once.
  await new Promise(r => setTimeout(r, 50))
  expect(world.ran.filter(a => a[2] === 'models').map(a => a.slice(3))).toEqual([['--json', '--cached'], ['--json']])
  expect(world.ran.findIndex(a => a[2] === 'config')).toBeLessThan(world.ran.findIndex(a => a[2] === 'models'))
  // The live check's report was taken: the new model is known, with one note asked for it.
  expect(store.get('modelNews')).toMatchObject({ seen: { 'agy:gemini-5-xenon': ago(0) }, asked: ['agy:gemini-5-xenon'] })
  await $.turn.start({ text: 'first', turnId: 't0' })
  expect(lastRow(rows).match(/New models offered:/g)).toHaveLength(1)
  // The config was read again after the live check.
  expect(world.ran.filter(a => a[2] === 'config').length).toBeGreaterThanOrEqual(2)
})

test('a new model with no note: one router note to the lead, remembered; a new model with a note is not asked about; the card says notes are not written yet', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { version: '0.15.0' })
  const rep = modelsReport({ new: [{ provider: 'agy', model: 'gemini-5-xenon', first_seen: ago(0) }, { provider: 'agy', model: 'gemini-4-neon', first_seen: ago(0) }], not_offered: [{ template: 'kiro-light', model: 'claude-haiku-5.5' }] })
  const { rows, store } = await boot($, on, [HELPERS_ON], [], files, () => {
    world.setup()
    world.json.value = { report: rep, cache: OFFERED }
  })
  const logged = () => [...files.entries()].filter(([k]) => k.includes('/model-router/log/')).map(([, v]) => v).join('')
  expect(store.get('modelNews')).toMatchObject({ seen: { 'agy:gemini-5-xenon': ago(0), 'agy:gemini-4-neon': ago(0) }, asked: ['agy:gemini-5-xenon', 'gone:kiro:claude-haiku-5.5'] })
  await $.turn.start({ text: 'first', turnId: 't0' })
  const delivered = lastRow(rows)
  expect(delivered).toContain(`New models offered: Antigravity gemini-5-xenon (first seen ${ago(0)}); no longer offered: Kiro claude-haiku-5.5, used by kiro-light.`)
  expect(delivered).not.toContain('gemini-4-neon (first seen')
  expect(logged()).toContain('"ev":"models-asked"')

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^New models \(2\)$/))).toBeTruthy()
  expect(await pane.find(text(new RegExp(`^checked ${ago(0)}$`)))).toBeTruthy()
  expect(await pane.find(text(/^gemini-5-xenon · Antigravity · notes not written yet$/))).toBeTruthy()
  expect(await pane.find(text(/^Gemini 4 Neon · Antigravity · 2026-11-18 · Google's mid-top/))).toBeTruthy()
  // Notes ▸ opens strengths, weaknesses, fits and sources of the models that have a note.
  expect(await pane.find(text(/^Strengths:/))).toBeFalsy()
  await pressPick(pane, 'model-card-notes')
  expect(await pane.find(text(/^Strengths: reasoning and science benchmarks/))).toBeTruthy()
  expect(await pane.find(text(/^Weaknesses: hallucinates more than Argon/))).toBeTruthy()
  expect(await pane.find(text(/^Fits: deep high \(Opus-class judgment/))).toBeTruthy()
  expect(await pane.find(text(/^Sources: Gemini API changelog https:\/\/ai\.google\.dev/))).toBeTruthy()
  await pane.unmount()
  // The terminal and the minimal view draw it too, with the summary cut.
  for (const surface of ['terminal', 'desktop'] as const) {
    const p = await $.ui.mount({ ...PANE, surface } as never)
    expect(await p.find(text(/^New models \(2\)$/))).toBeTruthy()
    await p.unmount()
  }
})

test('no card while every new model has a note and nothing is pending', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { version: '0.15.0' })
  await boot($, on, [HELPERS_ON], [], files, () => {
    world.setup()
    world.json.value = { report: modelsReport({ new: [{ provider: 'agy', model: 'gemini-4-neon', first_seen: ago(0) }] }), cache: OFFERED }
  })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^New models/))).toBeFalsy()
  expect(await pane.find({ type: 'Button', key: 'model-card-notes' } as never)).toBeFalsy()
  await pane.unmount()
})

test('the plan tool takes models on its own: notes go to the file, proposals to the card; invalid items are skipped with a reason; Apply and Dismiss', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { version: '0.15.0' })
  const cache = { ...OFFERED, agy: { ...OFFERED.agy, models: [...OFFERED.agy.models, 'gemini-4-neon-high', 'gemini-4-neon-low'] } }
  files.set(MODELS_FILE, JSON.stringify(cache))
  const { registered, store } = await boot($, on, [HELPERS_ON], [], files, () => {
    world.setup()
    world.json.value = { report: modelsReport(), cache }
  })
  const schema = registered.at(-1)?.inputSchema?.properties?.models as { properties: { notes: { items: { properties: { tags: { items: { enum: string[] } } } } } } }
  expect(schema.properties.notes.items.properties.tags.items.enum).toContain('second-opinion')

  const r = await $.tool.call({
    tool: PLAN,
    models: {
      notes: [
        { id: 'gemini-5-xenon', name: 'Gemini 5 Xenon', summary: 'A new model', tags: ['code', 'wizardry'], providers: ['agy'], fits: [{ tier: 'standard', effort: 'high', why: 'cheap' }] },
        { id: 'bad id', summary: 'x' },
      ],
      proposals: [
        { provider: 'agy', tier: 'deep', model: 'gemini-4-neon', effort: 'high', why: 'Opus-class off Claude quota' },
        { provider: 'claude', tier: 'light', model: 'haiku', effort: 'medium', why: 'a little more care' },
        { provider: 'agy', tier: 'deep', model: 'gemini-9', effort: 'high', why: 'x' },
      ],
    },
  } as never)
  const out = String(r.result)
  expect(out).toContain('Stored notes: gemini-5-xenon.')
  expect(out).toContain('Stored proposals')
  expect(out).toContain('left out: tag "wizardry" on gemini-5-xenon')
  expect(out).toContain('Skipped: note skipped: note id "bad id" is not a model id')
  expect(out).toContain('Skipped: proposal agy deep gemini-9: agy does not offer gemini-9')
  // The plan is untouched, and the notes are in the file, by "agent" and dated today.
  const file = JSON.parse(files.get(NOTES_FILE)!) as { models: Record<string, { by: string; checked: string; tags: string[] }> }
  expect(file.models['gemini-5-xenon']).toMatchObject({ by: 'agent', checked: dayOf(new Date()), tags: ['code'] })
  expect((store.get('modelNews') as { proposals: unknown[] }).proposals).toHaveLength(2)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^deep Antigravity: claude-opus-5-5\/high → gemini-4-neon\/high · Opus-class off Claude quota$/))).toBeTruthy()
  expect(await pane.find(text(/^light Claude: haiku\/low → haiku\/medium · a little more care$/))).toBeTruthy()

  // Apply (helper): helpers.py set, the config read again, the proposal goes, the card says applied.
  await pressPick(pane, 'model-apply:agy|deep|gemini-4-neon|high')
  expect(world.ran.filter(a => a[2] === 'set').at(-1)).toEqual(['python3', world.script, 'set', 'agy', 'deep', 'model=gemini-4-neon', 'effort=high'])
  expect(await pane.find(text(/^✓ deep Antigravity: claude-opus-5-5\/high → gemini-4-neon\/high · .* · applied$/))).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'model-apply:agy|deep|gemini-4-neon|high' } as never)).toBeFalsy()
  expect((store.get('modelNews') as { proposals: unknown[] }).proposals).toHaveLength(1)

  // Dismiss: remembered, and the same proposal is not stored again.
  await pressPick(pane, 'model-dismiss:claude|light|haiku|medium')
  expect((store.get('modelNews') as { dismissed: string[]; proposals: unknown[] })).toMatchObject({ dismissed: ['claude|light|haiku|medium'], proposals: [] })
  const again = await $.tool.call({ tool: PLAN, models: { proposals: [{ provider: 'claude', tier: 'light', model: 'haiku', effort: 'medium', why: 'again' }] } } as never)
  expect(String(again.result)).toContain('dismissed by the person before')
  await pane.unmount()
  const log = [...files.entries()].filter(([k]) => k.includes('/log/')).map(([, v]) => v).join('')
  expect(log).toContain('"ev":"model-applied"')
  expect(log).toContain('"ev":"model-dismissed"')
  expect(log).toContain('"ev":"models-from-agent"')
})

test('Apply on a Claude tier changes the tier in the settings; a refusal from helpers.py shows beside the button and the proposal stays', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { version: '0.15.0' })
  const cache = { ...OFFERED, agy: { ...OFFERED.agy, models: [...OFFERED.agy.models, 'gemini-4-neon-high'] } }
  files.set(MODELS_FILE, JSON.stringify(cache))
  const { store } = await boot($, on, [HELPERS_ON], [], files, () => {
    world.setup()
    world.json.value = { report: modelsReport(), cache }
  })
  await $.tool.call({
    tool: PLAN,
    models: { proposals: [{ provider: 'claude', tier: 'standard', model: 'opus', effort: 'medium', why: 'worth it' }, { provider: 'agy', tier: 'deep', model: 'gemini-4-neon', effort: 'high', why: 'cheaper' }] },
  } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pressPick(pane, 'model-apply:claude|standard|opus|medium')
  expect((store.get('settings') as { tiers: { standard: { model: string; effort: string } } }).tiers.standard).toMatchObject({ model: 'opus', effort: 'medium' })
  expect(await pane.find(text(/^✓ standard Claude: sonnet\/medium → opus\/medium · worth it · applied$/))).toBeTruthy()

  world.fail.set = "error: 'gemini-4-neon-high' is not in agy's model list"
  await pressPick(pane, 'model-apply:agy|deep|gemini-4-neon|high')
  expect(await pane.find(text(/^'gemini-4-neon-high' is not in agy's model list$/))).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'model-apply:agy|deep|gemini-4-neon|high' } as never)).toBeTruthy()
  expect((store.get('modelNews') as { proposals: unknown[] }).proposals).toHaveLength(1)
  await pane.unmount()
})

test('a Claude model seen in usage for the first time is new for provider claude and is asked about once', async ($, on) => {
  const { store, step, rows } = await boot($, on, [], [], undefined)
  await step('t0', { model: 'claude-nova-1', input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 })
  expect(store.get('modelNews')).toMatchObject({ seen: { 'claude:claude-nova-1': dayOf(new Date()) }, asked: ['claude:claude-nova-1'] })
  await $.turn.start({ text: 'next', turnId: 't1' })
  expect(lastRow(rows)).toContain(`New models offered: Claude claude-nova-1 (first seen ${dayOf(new Date())})`)
  // The known models are not new.
  await step('t2', { model: 'claude-sonnet-5-5', input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 })
  expect(Object.keys((store.get('modelNews') as { seen: object }).seen)).toEqual(['claude:claude-nova-1'])
})

test('model news is merged on write: another chat\'s dismissals in the store are kept', async ($, on) => {
  const { store } = await boot($, on, [['modelNews', { dismissed: ['other|chat|a|b'], proposals: [] }]])
  await $.tool.call({ tool: PLAN, models: { proposals: [{ provider: 'claude', tier: 'light', model: 'sonnet', effort: 'low', why: 'x' }] } } as never)
  // Another chat dismissed something after this one loaded.
  store.set('modelNews', { ...(store.get('modelNews') as object), dismissed: ['other|chat|a|b', 'late|one|c|d'] })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pressPick(pane, 'model-dismiss:claude|light|sonnet|low')
  await pane.unmount()
  expect((store.get('modelNews') as { dismissed: string[] }).dismissed).toEqual(['other|chat|a|b', 'late|one|c|d', 'claude|light|sonnet|low'])
})

test('older helpers.py (before 0.15): no models command runs at the start', async ($, on) => {
  const old = new Map<string, string>()
  const oldWorld = helperWorld(on, old)
  await boot($, on, [HELPERS_ON], [], old, oldWorld.setup)
  expect(oldWorld.argsOf('models')).toEqual([])
})

test('Check now in Settings runs models --json; the Models group counts the notes and lists them', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { version: '0.15.0' })
  await boot($, on, [HELPERS_ON], [], files, () => {
    world.setup()
    world.json.value = { report: modelsReport({ not_offered: [{ template: 'kiro-light', model: 'claude-haiku-5.5' }] }), cache: OFFERED }
  })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(pane)
  expect(await pane.find(text(new RegExp(`^Model notes \\(${SEED_NOTES.length}\\) · checked ${ago(0)}$`)))).toBeTruthy()
  expect(await pane.find(text(/^Gemini 4 Neon · judgment/))).toBeFalsy()
  await pressPick(pane, 'model-notes-toggle')
  expect(await pane.find(text(/^Gemini 4 Neon · judgment, agentic, research, long-context, second-opinion · .* · seed 2026-11-19$/))).toBeTruthy()
  const before = world.argsOf('models').length
  await pressPick(pane, 'model-notes-check')
  expect(world.argsOf('models').slice(before)).toEqual([['python3', world.script, 'models', '--json']])
  expect(await pane.find(text(/^NOT OFFERED kiro-light: claude-haiku-5\.5/))).toBeTruthy()
  await pane.unmount()
})

test('status and report carry the model check', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { version: '0.15.0' })
  await boot($, on, [HELPERS_ON], [], files, () => {
    world.setup()
    world.json.value = { report: modelsReport({ new: [{ provider: 'agy', model: 'gemini-5-xenon', first_seen: ago(0) }], gone: [{ provider: 'kiro', model: 'glm-4', since: ago(3) }] }), cache: OFFERED }
  })
  const st = String((await $.tool.call({ tool: PLAN, status: true } as never)).result)
  const body = JSON.parse(st.slice(st.indexOf('{'))) as Record<string, unknown>
  expect(body.modelsChecked).toBe(`checked ${ago(0)}: agy ${ago(0)}, kiro ${ago(0)}`)
  expect(body.modelsNew).toBe(`agy:gemini-5-xenon (${ago(0)})`)
  expect(body.modelsGone).toBe(`kiro:glm-4 (since ${ago(3)})`)
  expect(body.modelProposals).toBe(0)
  expect(body.modelNotes).toBe(SEED_NOTES.length)

  await $.command.run({ command: 'router', args: 'report' } as never)
  const report = [...files.entries()].find(([k]) => /model-router\/report-/.test(k))![1]
  expect(report).toContain('## Model check')
  expect(report).toContain(`- Models checked ${ago(0)}: agy ${ago(0)}, kiro ${ago(0)}`)
  expect(report).toContain(`- New in the last 14 days: agy:gemini-5-xenon (${ago(0)})`)
  expect(report).toContain(`- No longer offered in the last 14 days: kiro:glm-4 (since ${ago(3)})`)
  expect(report).toContain(`- Pending proposals: 0; model notes: ${SEED_NOTES.length}`)
})

test('Herdr view state: the snapshot as display strings, a stable chat key, files older than two days to delete', async () => {
  const done = { ...newStep('s1.a', 'Read the code', 'light', 'agent'), status: 'done' as const, cost: 0.02, mainCost: 0.1, verdict: 'ok' as const, why: 'fine' }
  const list: Step[] = [
    { ...newStep('s1', 'Review', 'standard', 'agent'), group: true, status: 'running' },
    { ...done, parent: 's1' },
    { ...newStep('s1.b', 'Write tests', 'deep', 'agent'), parent: 's1', status: 'running' },
    newStep('s2', 'Summarise', 'light', 'here'),
  ]
  const snap = buildSnapshot({
    router: '0.25.0', chat: 'abc', cwd: '/work/x', at: new Date('2026-11-19T08:00:00Z'), status: 'pending', health: { ok: true, text: 'Router on · helpers off' },
    list, set: DEFAULT_SETTINGS, main: { cost: 1, model: 'opus' }, planBaseCost: 0.4,
    totals: { mainCost: 1, agentCost: 0.02, mainEquivalent: 0.1, steps: 1, helper: EMPTY_HELPER },
  })
  expect(snap).toMatchObject({ version: 1, chat: 'abc', cwd: '/work/x', status: 'pending', statusText: 'awaiting your approval', news: [] })
  expect(snap.steps.map(x => [x.id, x.depth, x.where, x.on])).toEqual([
    ['s1', 0, '', 'rated standard · 1/2 done'],
    ['s1.a', 1, 'Claude agent', 'haiku/low'],
    ['s1.b', 1, 'Claude agent', 'opus/high'],
    ['s2', 0, 'this chat', ''],
  ])
  expect(snap.steps[1]).toMatchObject({ status: 'done', tier: 'light', cost: '≈$0.02', verdict: 'verdict ok: fine' })
  expect(snap.cost.plan[0]).toBe('Main chat · opus: ≈$0.60')
  expect(snap.cost.plan[2]).toMatch(/^Saved: ≈\$0\.08 \(/)
  // A later time alone is no change.
  expect(snapshotKey({ ...snap, at: '2030-01-01T00:00:00.000Z' })).toBe(snapshotKey(snap))

  expect(newsLines(undefined)).toEqual([])
  expect(
    newsLines({ checked: '2026-11-19', models: [{ key: 'm', name: 'Sonnet 5.6', providers: 'Kiro', summary: 'faster' }, { key: 'n', name: 'glm-6', providers: 'Kiro' }], proposals: [{ key: 'p', tier: 'standard', label: 'Kiro', from: 'a/low', to: 'b/low', why: 'cheaper' }] }),
  ).toEqual(['New models (2) · checked 2026-11-19', 'Sonnet 5.6 · Kiro · faster', 'glm-6 · Kiro · notes not written yet', 'standard Kiro: a/low → b/low · cheaper'])
  expect(chatKeyOf('a/b c..d', () => 'r')).toBe('abcd')
  expect(chatKeyOf(undefined, () => 'rand1')).toBe('rand1')
  const now = new Date('2026-11-19T08:00:00Z')
  expect(
    oldStateFiles([{ name: 'new.json', at: '2026-11-18T09:00:00Z' }, { name: 'old.json', at: '2026-11-16T09:00:00Z' }, { name: 'bad.json' }, { name: 'x y.json', at: '2020-01-01T00:00:00Z' }, { name: 'sample.txt' }], now),
  ).toEqual(['old.json', 'bad.json'])
})

test('Herdr view state: written under <config>/model-router/state when ~/.config/herdr-app exists, with the plan, throttled to one write a second; old files removed at the start', async ($, on) => {
  const files = new Map<string, string>([[`${HOME}/.config/model-router/state/gone.json`, JSON.stringify({ at: '2020-01-01T00:00:00Z' })]])
  const rm: string[][] = []
  const dir = `${HOME}/.config/model-router/state`
  const setup = () => {
    on('fs.exists', (_, e) => ({ value: (e as { path: string }).path === `${HOME}/.config/herdr-app` }))
    on('fs.list', (_, e) => ((e as { path: string }).path === dir ? { value: [{ name: 'gone.json', kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false }] } : { deny: 'ENOENT' }))
    on('process.run', (_, e) => {
      rm.push((e as { argv: string[] }).argv)

      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
  }
  await boot($, on, [], [], files, setup)
  expect(rm.at(-1)).toEqual(['rm', '-f', '--', `${dir}/gone.json`])
  const name = () => [...files.keys()].filter(k => k.startsWith(`${dir}/`) && !k.endsWith('gone.json'))
  expect(name()).toHaveLength(1)
  const read = () => JSON.parse(files.get(name()[0]!)!) as { chat: string; status: string; steps: { id: string; title: string }[] }
  expect(read().steps).toEqual([])

  await $.tool.call({ tool: PLAN, steps: [{ id: 'a1', title: 'List files', tier: 'light', where: 'agent' }] } as never)
  // Inside the second: not written yet; at its end the latest state is.
  expect(read().steps).toEqual([])
  await new Promise(r => setTimeout(r, 1300))
  expect(read().status).toBe('approved')
  expect(read().steps.map(x => x.id)).toEqual(['a1'])
  expect(read().chat).toBe(name()[0]!.slice(dir.length + 1, -5))
})

// --- One layout on every surface, and Settings in groups (0.26) -------------------------------------------------

type Node = { type?: string; key?: string; props?: { key?: string }; children?: unknown[] }
/** The controls a person can act on under an element: buttons, pickers and text boxes. */
const controlsIn = (n: unknown): string[] => {
  if (!n || typeof n !== 'object') return []
  const e = n as Node
  const own = e.type === 'Button' || e.type === 'Select' || e.type === 'Input' ? [e.key ?? e.props?.key ?? e.type] : []
  return [...own, ...(e.children ?? []).flatMap(controlsIn)]
}
const sectionsOf = async (pane: { findAll: (q: never) => Promise<{ key?: string }[]> }) =>
  (await pane.findAll({ type: 'Box' } as never)).map(b => b.key ?? '').filter(k => k.startsWith('section:'))

test('the pane draws the same sections in the same order on every surface, also while a plan awaits approval', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files, { version: '0.15.0' })
  const rep = modelsReport({ new: [{ provider: 'agy', model: 'gemini-5-xenon', first_seen: ago(0) }] })
  await boot($, on, [HELPERS_ON, ['autoApprove', false]], [], files, () => {
    world.setup()
    world.json.value = { report: rep, cache: OFFERED }
  })
  let answer: (v: string) => void = () => undefined
  asker = e => new Promise(r => { answer = v => r({ result: { answers: { [e.questions[0]!.question]: v } } }) })
  await $.turn.start({ text: 'first', turnId: 't0' })
  const planning = $.tool.call({ tool: PLAN, steps: partsPlan } as never)
  await new Promise(r => setTimeout(r, 10))

  const surfaces = [
    { surface: 'desktop' },
    { surface: 'vscode' },
    { surface: 'mobile' },
    { surface: 'terminal' },
    { surface: 'terminal', props: { ...PANE.props, bodyColumns: 40 } },
    { surface: 'desktop', props: { ...PANE.props, placement: 'float' } },
  ]
  for (const s of surfaces) {
    const pane = await $.ui.mount({ ...PANE, ...s } as never)
    expect(await sectionsOf(pane)).toEqual(['section:health', 'section:news', 'section:plan', 'section:cost', 'section:footer'])
    expect((await pane.find({ type: 'Text', text: /^Plan · 0 of \d+ done/ } as never))?.text).toContain('awaiting your approval')
    expect(await pane.find({ type: 'Button', key: 'expand-all' } as never)).toBeTruthy()
    expect(await pane.find({ type: 'Button', key: 'cost-view' } as never)).toBeTruthy()
    expect(await pane.find({ type: 'Button', key: 'settings' } as never)).toBeTruthy()
    expect(await pane.find({ type: 'Button', key: 'footer-report' } as never)).toBeTruthy()
    // Settings take the place of plan, cost and footer, on every surface alike.
    await pressPick(pane, 'settings')
    expect(await sectionsOf(pane)).toEqual(['section:health', 'section:news', 'section:settings'])
    await pressPick(pane, 'settings-done')
    await pane.unmount()
  }
  answer('Run it')
  await planning
})

test('control counts: the first screen of Settings has at most 12, and a collapsed five-step plan stays small', async ($, on) => {
  await boot($, on, [])
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 's1', title: 'Read the brief', tier: 'light', where: 'here' },
      { id: 's2', title: 'Survey', tier: 'standard', where: 'agent', kind: 'web-research' },
      { id: 's3', title: 'Write', tier: 'standard', where: 'agent' },
      { id: 's4', title: 'Review', tier: 'deep', where: 'agent' },
      { id: 's5', title: 'Report', tier: 'light', where: 'here' },
    ],
  } as never)
  for (const surface of ['desktop', 'terminal'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface } as never)
    const plan = controlsIn(await pane.find({ key: 'section:plan' } as never))
    const all = [...plan, ...controlsIn(await pane.find({ key: 'section:cost' } as never)), ...controlsIn(await pane.find({ key: 'section:footer' } as never))]
    // Per step: ▸ and the pickers (where, and a Claude agent step's level, model and effort); then ?, Expand all, Clear plan;
    // the cost's span and Details; Settings and Write report. 2 here steps × 2 + 3 agent steps × 5 + 3 + 2 + 2 = 26.
    expect(all).toHaveLength(26)
    await pressPick(pane, 'settings')
    const first = controlsIn(await pane.find({ key: 'section:settings' } as never)).filter(k => k !== 'settings-done')
    // Five Basics and seven closed group headers.
    expect(first).toEqual(['auto', 'always', 'helpers', 'spend', 'open-pane', 'group:models', 'group:helpers', 'group:learning', 'group:prices', 'group:skills', 'group:diagnostics', 'group:advanced'])
    expect(first.length).toBeLessThanOrEqual(12)
    await pressPick(pane, 'settings-done')
    await pane.unmount()
  }
})

test('Spend presets set the three levels in one choice; tiers that match none show Custom, and Custom opens Models per level', async ($, on) => {
  expect(presetOf(DEFAULT_SETTINGS)).toBe('balanced')
  expect(applyPreset(DEFAULT_SETTINGS, 'thrifty').tiers).toEqual({
    light: { model: 'haiku', effort: 'low', scopeNote: false },
    standard: { model: 'sonnet', effort: 'low', scopeNote: false },
    deep: { model: 'opus', effort: 'medium', scopeNote: false },
  })
  expect(presetOf(applyPreset(DEFAULT_SETTINGS, 'best'))).toBe('best')
  // A preset keeps the scope notes and leaves the rest alone; an unknown one changes nothing.
  const noted = { ...DEFAULT_SETTINGS, tiers: { ...DEFAULT_SETTINGS.tiers, deep: { ...DEFAULT_SETTINGS.tiers.deep, scopeNote: true } } }
  expect(applyPreset(noted, 'best').tiers.deep).toEqual({ model: 'opus', effort: 'high', scopeNote: true })
  expect(applyPreset(noted, 'nonsense')).toBe(noted)

  const files = new Map<string, string>()
  const { store, calls } = await boot($, on, [], [{ id: 'x1', description: '[s1] write' }], files)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pressPick(pane, 'settings')
  const spend = async () => (await pane.find({ type: 'Select', key: 'spend' } as never))?.props.value
  expect(await spend()).toBe('balanced')
  await pane.select({ key: 'spend', value: 'best' })
  const tiers = () => (store.get('settings') as { tiers: Record<string, { model: string; effort: string }> }).tiers
  expect(tiers().light).toMatchObject({ model: 'haiku', effort: 'high' })
  expect(tiers().standard).toMatchObject({ model: 'sonnet', effort: 'high' })
  expect((JSON.parse(files.get(MIRROR) ?? '{}') as { settings: { tiers: { standard: { effort: string } } } }).settings.tiers.standard.effort).toBe('high')
  expect(await spend()).toBe('best')
  // The group's closed line names what each level runs on.
  expect(await pane.find({ type: 'Text', text: /^light Haiku high · standard Sonnet high · deep Opus high$/ } as never)).toBeTruthy()
  // Routing follows at once.
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'Write', tier: 'standard', where: 'agent' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[s1] write', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet', effort: 'high' })

  // A level changed by hand matches no preset: Custom, marked.
  await pressPick(pane, 'group:models')
  await pane.select({ key: 'set-effort:deep', value: 'max' })
  expect(await spend()).toBe('custom')
  await pressPick(pane, 'group:models')
  expect(await pane.find({ key: 'group-body:models' } as never)).toBeFalsy()
  // Picking Custom changes nothing and opens Models per level.
  await pane.select({ key: 'spend', value: 'custom' })
  expect(tiers().deep).toMatchObject({ model: 'opus', effort: 'max' })
  expect(await pane.find({ key: 'group-body:models' } as never)).toBeTruthy()
  expect((store.get('settings') as { openGroups: string[] }).openGroups).toEqual(['models'])
  await pane.select({ key: 'spend', value: 'balanced' })
  expect(tiers()).toEqual(DEFAULT_SETTINGS.tiers)
  await pane.unmount()

  // The terminal lists the four presets under one button.
  const tty = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect((await tty.find({ type: 'Button', key: 'spend' } as never))?.text).toBe('Balanced ▾')
  await pressPick(tty as never, 'spend')
  expect((await tty.find({ type: 'Button', key: 'spend' } as never))?.text).toBe('Best quality ▾')
  await tty.unmount()
})

test('each Settings group says what it holds in one line while closed, remembers being open, and is marked when something differs', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  const run = { key: 'k1', tier: 'light', where: 'agent', model: 'haiku', effort: 'low', cost: 0.01, setupHeavy: false, rerun: false, verdict: 'ok', at: '2026-11-18T00:00:00.000Z' }
  const { store } = await boot(
    $,
    on,
    [HELPERS_ON, ['history', [run]], ['settings', { helpers: { enabled: true }, kinds: { 'code-review': { model: 'haiku', effort: 'medium' } }, skills: { 'scientific-figures': 'standard' }, models: ['nova'], log: false, hereEffort: { enabled: true }, tiers: { deep: { model: 'opus', effort: 'high', scopeNote: true } } }]],
    [],
    files,
    world.setup,
  )
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pressPick(pane, 'settings')
  const summary = async (re: RegExp) => (await pane.find({ type: 'Text', text: re } as never))?.text
  expect(await summary(/^light Haiku/)).toBe('light Haiku low · standard Sonnet medium · deep Opus high')
  // The health line says "ready", so Basics repeat it only on a failure; the group's line names the helpers in their order.
  expect(await summary(/^ready · Herdr$/)).toBeFalsy()
  expect(await summary(/^\w+, .* · Herdr$/)).toBe('Kiro, Copilot, Antigravity · Herdr')
  expect(await summary(/^auto off/)).toBe('auto off · 1 kind tuned')
  expect(await summary(/^\d+ models/)).toMatch(/^5 models · 1 without price · \d+ notes$/)
  expect(await summary(/mapped$/)).toBe('1 mapped')
  expect(await summary(/^log /)).toBe('log off · Herdr view on')
  expect(await summary(/^experiment /)).toBe('experiment on · scope notes on for deep')
  // Marked: Other subscriptions (Basics), and the Learning, Models and prices, Skills, Diagnostics and Advanced headers.
  expect(await pane.findAll({ type: 'Text', text: /^•$/ } as never)).toHaveLength(7)
  // Show in Herdr sits in Diagnostics; switching it off is marked and named in the closed line.
  await pressPick(pane, 'group:diagnostics')
  await pressPick(pane, 'herdr-view')
  expect((store.get('settings') as { herdrView: boolean }).herdrView).toBe(false)
  await pressPick(pane, 'group:diagnostics')
  expect(await summary(/^log /)).toBe('log off · Herdr view off')
  // Opening a group is remembered in the settings, for the next chat too.
  await pressPick(pane, 'group:skills')
  expect(await pane.find({ type: 'Select', key: 'skill-tier:scientific-figures' } as never)).toBeTruthy()
  // An open group does not repeat its closed line.
  expect(await summary(/mapped$/)).toBeFalsy()
  expect((store.get('settings') as { openGroups: string[] }).openGroups).toEqual(['skills'])
  await pane.unmount()
  const again = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect(await again.find({ type: 'Button', key: 'skill-tier:scientific-figures' } as never)).toBeTruthy()
  expect((await again.find({ type: 'Button', key: 'group:skills' } as never))?.text).toBe('▾ Skills')
  expect((await again.find({ type: 'Button', key: 'group:advanced' } as never))?.text).toBe('▸ Advanced')
  await again.unmount()
})

test('the resets ask once, naming what goes: Keep leaves it, the second click clears it and says so', async ($, on) => {
  const run = { key: 'k1', tier: 'light', where: 'agent', model: 'haiku', effort: 'low', cost: 0.01, setupHeavy: false, rerun: false, verdict: 'ok', at: '2026-11-18T00:00:00.000Z' }
  const { store } = await boot($, on, [['history', [run, { ...run, key: 'k2' }, { ...run, key: 'k3' }]], ['settings', { tiers: { light: { model: 'sonnet', effort: 'high', scopeNote: true } } }]])
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  await pressPick(pane, 'settings')
  await pressPick(pane, 'group:advanced')
  const text = (re: RegExp) => ({ type: 'Text', text: re }) as never
  expect((await pane.find({ type: 'Button', key: 'clear-history' } as never))?.text).toBe('Clear history (3 runs)')
  await pressPick(pane, 'clear-history')
  expect((store.get('history') as unknown[]).length).toBe(3)
  expect(await pane.find(text(/^Really clear 3 runs\?/))).toBeTruthy()
  expect((await pane.find({ type: 'Button', key: 'reset-confirm' } as never))?.text).toBe('Clear')
  await pressPick(pane, 'reset-keep')
  expect(await pane.find(text(/^Really clear/))).toBeFalsy()
  expect((store.get('history') as unknown[]).length).toBe(3)
  await pressPick(pane, 'clear-history')
  await pressPick(pane, 'reset-confirm')
  expect(store.get('history')).toEqual([])
  expect(await pane.find(text(/^History cleared\.$/))).toBeTruthy()
  expect((await pane.find({ type: 'Button', key: 'clear-history' } as never))?.text).toBe('Clear history (0 runs)')

  // Reset models per level asks too, and puts back the shipped levels (Balanced, scope notes off).
  await pressPick(pane, 'reset-tiers')
  expect(await pane.find(text(/^Really put the three levels back to Balanced/))).toBeTruthy()
  expect((store.get('settings') as { tiers: { light: { model: string } } }).tiers.light.model).toBe('sonnet')
  await pressPick(pane, 'reset-confirm')
  expect((store.get('settings') as { tiers: unknown }).tiers).toEqual(DEFAULT_SETTINGS.tiers)
  expect(await pane.find(text(/^Models per level reset\.$/))).toBeTruthy()
  await pane.unmount()
})

test('a narrow terminal wraps the rows instead of laying them side by side, with the short word for helpers', async ($, on) => {
  await boot($, on, [HELPERS_ON])
  await $.tool.call({ tool: PLAN, steps: [{ id: 'h1', title: 'A long survey of everything that has been written on the topic', tier: 'deep', where: 'helper' }] } as never)
  const pane = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 40 }, surface: 'terminal' } as never)
  expect((await pane.find({ type: 'Button', key: 'where:h1' } as never))?.text).toBe('other sub ⇄')
  // The title wraps instead of being cut, and the pickers' row wraps.
  expect((await pane.find({ type: 'Text', text: /^A long survey/ } as never))?.props.wrap).toBe('wrap')
  await pane.unmount()
  const wide = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  expect((await wide.find({ type: 'Button', key: 'where:h1' } as never))?.text).toBe('other subscription ⇄')
  await wide.unmount()
})

// --- Strengths and the model map (0.28) -----------------------------------------------------

test('a kind\'s strengths: the table, then the words of its name, then the person\'s own list (which may be empty); toggles keep the vocabulary order', () => {
  const set = mergeSettings({})
  expect(KIND_TAGS['code-review']).toEqual(['review', 'careful'])
  expect(tagsOfKind('write-code', set)).toEqual(['code'])
  expect(tagsOfKind('code-read', set)).toEqual(['careful', 'long-context'])
  expect(tagsOfKind('summarize', set)).toEqual(['long-context', 'fast'])
  expect(tagsOfKind('eval-run', set)).toEqual(['agentic'])
  // Not in the table: by its own words.
  expect(tagsOfKind('security-review', set)).toEqual(['review'])
  expect(tagsOfKind('market-research-notes', set)).toEqual(['research'])
  expect(tagsOfKind('refactor-codebase', set)).toEqual(['code'])
  expect(tagsOfKind('code-review-lite', set)).toEqual(['code', 'review'])
  expect(tagsOfKind('figure', set)).toEqual([])
  // A name like an Object property is a kind like any other.
  expect(tagsOfKind('constructor', set)).toEqual([])
  expect(tagsOfKind('__proto__', set)).toEqual([])
  // The person's list wins, even an empty one; the default put back is no override.
  const own = withKindTags(set, 'write-code', ['code', 'review'])
  expect(own.kindTags).toEqual({ 'write-code': ['code', 'review'] })
  expect(tagsOfKind('write-code', own)).toEqual(['code', 'review'])
  expect(kindTagsEdited('write-code', own)).toBe(true)
  const none = withKindTags(own, 'write-code', [])
  expect(tagsOfKind('write-code', none)).toEqual([])
  expect(withKindTags(none, 'write-code', ['code']).kindTags).toEqual({})
  expect(toggleTag(['review'], 'code')).toEqual(['code', 'review'])
  expect(toggleTag(['code', 'review'], 'code')).toEqual(['review'])
  // Stored lists are cleaned: only vocabulary tags, once, in order; only kinds of plain words.
  const stored = mergeSettings({ kindTags: { 'x-y': ['review', 'nonsense', 'code', 'code'], 'Bad Kind': ['code'], z: 'code' } } as never)
  expect(stored.kindTags).toEqual({ 'x-y': ['code', 'review'] })
  expect(mergeSettings({ kindTags: ['code'] } as never).kindTags).toEqual({})
  expect(mergeSettings(undefined).kindTags).toEqual({})
})

const NEON = { ...SEED_NOTES.find(n => n.id === 'gemini-4-neon')!, tags: ['careful', 'review', 'agentic'], fits: [{ tier: 'deep', effort: 'high', why: 'x' }, { tier: 'standard', effort: 'medium', why: 'y' }] } as never
const NOTES = mergeNotes({ 'gemini-4-neon': NEON })

test('Try suggestions: a model whose note has a strength the kind\'s current model lacks and fits its tier; one per kind, never for enough history, dismissed, or a kind with no strengths', () => {
  const cfg = helperDefaults() as never
  setHelperConfig(cfg)
  const cache = { agy: { models: ['gemini-4-neon-high', 'claude-opus-5-5-high'] } } as never
  const set = mergeSettings({ helpers: { enabled: true } } as never)
  const base = { set, notes: NOTES, cfg, cache, helpersOn: true, dismissed: [] as string[] }
  const hist = (n: number, over: Partial<HistoryEntry> = {}) => Array.from({ length: n }, (_, i) => hrun(i + 1, { tier: 'deep', helper: 'kiro-deep', kind: 'code-review', verdict: 'ok', ...over }))
  const texts = (o: Partial<Parameters<typeof trySuggestions>[0]> & { history: HistoryEntry[]; kinds: string[] }) => trySuggestions({ ...base, ...o }).map(t => t.text)

  // Opus (the deep helper now) has review but not careful: Neon adds careful. The level is the note's, offered by agy.
  expect(texts({ history: hist(2), kinds: ['code-review'] })).toEqual(['Try Gemini 4 Neon high on Antigravity for code-review (careful)'])
  const [t] = trySuggestions({ ...base, history: hist(2), kinds: ['code-review'] })
  expect(t).toMatchObject({ key: 'code-review|agy|gemini-4-neon|high', provider: 'agy', model: 'gemini-4-neon', effort: 'high', tier: 'deep' })
  // A kind with no history at all, but in the plan at deep, gets it too.
  expect(texts({ history: [], kinds: ['code-review'], planTiers: { 'code-review': 'deep' } })).toHaveLength(1)
  // No history and no plan: its tier is not known, so nothing.
  expect(texts({ history: [], kinds: ['code-review'] })).toEqual([])
  // Enough runs on the model it runs on now (autoMinRuns, 5): the history owns it.
  expect(texts({ history: hist(5), kinds: ['code-review'] })).toEqual([])
  expect(texts({ history: hist(4), kinds: ['code-review'] })).toHaveLength(1)
  // Auto mode's learned rung, or advice, owns it too.
  expect(texts({ history: hist(2), kinds: ['code-review'], learnedHelpers: { 'code-review': [{ provider: 'kiro', model: 'm', effort: 'low', n: 5 }] } })).toEqual([])
  expect(texts({ history: hist(2), kinds: ['code-review'], skip: new Set(['code-review']) })).toEqual([])
  // Dismissed: not again (the next best, if any, would show).
  expect(texts({ history: hist(2), kinds: ['code-review'], dismissed: ['code-review|agy|gemini-4-neon|high'] })).toEqual([])
  // With helpers off there is no helper model to try, and a kind that ran on helpers gets no Claude one.
  expect(texts({ history: hist(2), kinds: ['code-review'], helpersOn: false })).toEqual([])
  // The person's own strengths decide: none, none to suggest; research is a strength Neon's note lacks.
  expect(texts({ history: hist(2), kinds: ['code-review'], set: withKindTags(set, 'code-review', []) })).toEqual([])
  expect(texts({ history: hist(2), kinds: ['code-review'], set: withKindTags(set, 'code-review', ['research']) })).toEqual([])
  // A model the provider does not offer is not suggested.
  expect(texts({ history: hist(2), kinds: ['code-review'], cache: { agy: { models: ['claude-opus-5-5-high'] } } as never })).toEqual([])
  // A note's level the provider lacks (a fit at xhigh on a provider with low, medium, high): not suggested.
  const xhigh = mergeNotes({ 'gemini-4-neon': { ...(NEON as object), fits: [{ tier: 'deep', effort: 'xhigh', why: 'x' }] } as never })
  expect(texts({ history: hist(2), kinds: ['code-review'], notes: xhigh })).toEqual([])
  // A fit for another tier does not count.
  const light = mergeNotes({ 'gemini-4-neon': { ...(NEON as object), fits: [{ tier: 'light', effort: 'high', why: 'x' }] } as never })
  expect(texts({ history: hist(2), kinds: ['code-review'], notes: light })).toEqual([])
  // At most three, in the order of the kinds.
  const many = ['code-review', 'review', 'code-read', 'cross-check']
  const manyHist = many.flatMap((k, j) => hist(2, { kind: k }).map((x, i) => ({ ...x, key: `${k}${i}${j}` })))
  expect(trySuggestions({ ...base, history: manyHist, kinds: many }).map(x => x.kind)).toEqual(['code-review', 'review', 'code-read'])
  expect(trySuggestions({ ...base, history: manyHist, kinds: many, max: 1 })).toHaveLength(1)
  setHelperConfig(undefined)
})

test('Try suggestions for Claude: the tier\'s own rung, when the kind runs on a default of its own that lacks the strength', () => {
  setHelperConfig(undefined)
  const set = mergeSettings({ kinds: { 'write-code': { model: 'haiku', effort: 'low' } } })
  const base = { set, notes: mergeNotes(undefined), helpersOn: false, dismissed: [] as string[], kinds: ['write-code'] }
  const h = (n: number) => Array.from({ length: n }, (_, i) => run(i + 1, { tier: 'standard', kind: 'write-code', verdict: 'ok' }))
  const [t] = trySuggestions({ ...base, history: h(2) })
  expect(t).toMatchObject({ text: 'Try Claude Sonnet 5.5 medium for write-code (code)', provider: 'claude', model: 'sonnet', effort: 'medium', key: 'write-code|claude|sonnet|medium' })
  // Without a default of its own the kind already runs on the tier's rung: nothing to suggest.
  expect(trySuggestions({ ...base, set: mergeSettings({}), history: h(2) })).toEqual([])
  // Five runs on the default it has: the history owns it.
  expect(trySuggestions({ ...base, history: h(5) })).toEqual([])
  // The tier's model has no fit for the tier (a note that says deep only): nothing.
  const deepOnly = mergeNotes({ 'claude-sonnet-5-5': { ...mergeNotes(undefined)['claude-sonnet-5-5']!, fits: [{ tier: 'deep', why: 'z' }] } })
  expect(trySuggestions({ ...base, notes: deepOnly, history: h(2) })).toEqual([])
  // Runs mostly on helpers: a helper's business, not Claude's.
  expect(trySuggestions({ ...base, history: [hrun(1, { kind: 'write-code' }), hrun(2, { kind: 'write-code' }), run(3, { tier: 'standard', kind: 'write-code' })] })).toEqual([])
})

test('what would run a kind now: the Claude rung and its source, and with helpers the first helper of the tier\'s order; model lines list name, tags and fits', () => {
  const cfg = helperDefaults() as never
  setHelperConfig(cfg)
  const set = mergeSettings({ helpers: { enabled: true, kinds: { design: { provider: 'agy', model: 'gemini-4-neon', effort: 'medium' } } }, kinds: { design: { model: 'opus', effort: 'high' } } } as never)
  const line = (kind: string, tier: 'light' | 'standard' | 'deep', o: object = {}) => runsNow(kind, tier, { set, cfg, helpersOn: true, ...o }).map(runsNowText)
  expect(line('write-code', 'standard')).toEqual(['Claude: sonnet medium (tier)', 'Kiro: claude-sonnet-5.5 high (tier)'])
  expect(line('design', 'deep')).toEqual(['Claude: opus high (kind default)', 'Antigravity: gemini-4-neon medium (kind choice)'])
  expect(line('write-code', 'standard', { learned: { 'write-code': { rung: { model: 'haiku', effort: 'high' }, n: 6 } } })[0]).toBe('Claude: haiku high (auto, 6 runs)')
  expect(line('write-code', 'standard', { learnedHelpers: { 'write-code': [{ provider: 'copilot', model: 'claude-sonnet-5.5', effort: 'medium', n: 7 }] } })[1]).toBe('Copilot: claude-sonnet-5.5 medium (auto, 7 runs)')
  expect(runsNow('write-code', 'standard', { set, cfg, helpersOn: false }).map(runsNowText)).toEqual(['Claude: sonnet medium (tier)'])
  const neon = SEED_NOTES.find(n => n.id === 'gemini-4-neon')!
  expect(noteMapLine(neon)).toBe('Gemini 4 Neon · judgment, agentic, research, long-context, second-opinion · deep high, second high, standard medium')
  expect(noteMapLine({ ...neon, tags: [], fits: [] })).toBe('Gemini 4 Neon · no tags · no fits')
  expect(kindList([run(1, { kind: 'b' }), run(2, { kind: 'a' }), run(3, { kind: 'a' })], ['c', 'a'], ['d'])).toEqual(['a', 'b', 'c', 'd'])
  expect(kindList([], ['a', 'b', 'c'], [], 2)).toEqual(['a', 'b'])
  expect(tierOfKind([run(1, { tier: 'light' }), run(2, { tier: 'deep' }), run(3, { tier: 'deep' })], run(1).kind!)).toBe('deep')
  expect(tierOfKind([run(1, { tier: 'light', at: '2026-11-02T00:00:00Z' }), run(2, { tier: 'deep', at: '2026-11-01T00:00:00Z' })], 'code-review')).toBe('light')
  expect(tierOfKind([], 'x', { x: 'standard' })).toBe('standard')
  expect(tierOfKind([], 'constructor', {})).toBeUndefined()
  setHelperConfig(undefined)
})

test('the pane suggests a Claude model for a kind, applies it as the kind\'s default on a click, and a dismissal is remembered in the store without losing others', async ($, on) => {
  const past = [1, 2].flatMap(n => [run(n, { tier: 'standard', kind: 'write-code', verdict: 'ok' }), run(n + 2, { tier: 'standard', kind: 'research', verdict: 'ok', key: `r${n}` })])
  const kinds = { 'write-code': { model: 'haiku', effort: 'low' }, research: { model: 'haiku', effort: 'low' } }
  const { store } = await boot($, on, [['settings', { kinds }], ['history', past], ['modelNews', { dismissedTries: ['old|claude|x|low'] }]])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^Try Claude Sonnet 5\.5 medium for write-code \(code\)$/))).toBeTruthy()
  expect(await pane.find(text(/^Try Claude Sonnet 5\.5 medium for research \(research\)$/))).toBeTruthy()
  expect(await pane.find(text(/^History: 4 runs; advice below\.$/))).toBeTruthy()
  // Nothing has changed routing yet.
  expect((store.get('settings') as { kinds: unknown }).kinds).toEqual(kinds)
  await pressPick(pane, 'try-apply:write-code|claude|sonnet|medium')
  expect((store.get('settings') as { kinds: unknown }).kinds).toEqual({ ...kinds, 'write-code': { model: 'sonnet', effort: 'medium' } })
  expect(await pane.find(text(/for write-code/))).toBeFalsy()
  await pressPick(pane, 'try-dismiss:research|claude|sonnet|medium')
  expect((store.get('modelNews') as { dismissedTries: string[] }).dismissedTries).toEqual(['old|claude|x|low', 'research|claude|sonnet|medium'])
  expect(await pane.find(text(/for research/))).toBeFalsy()
  // The dismissal changed no setting.
  expect((store.get('settings') as { kinds: unknown }).kinds).toEqual({ ...kinds, 'write-code': { model: 'sonnet', effort: 'medium' } })
  await pane.unmount()
})

test('with helpers on, a helper model is suggested for a kind, applied as the kind\'s helper choice (nothing in helpers.py changes), and shown in the map', async ($, on) => {
  const files = new Map<string, string>()
  const world = helperWorld(on, files)
  files.set(MODELS_FILE, JSON.stringify({ ...OFFERED, agy: { ...OFFERED.agy, models: [...OFFERED.agy.models, 'gemini-4-neon-high'] } }))
  const past = [1, 2].map(n => hrun(n, { kind: 'design', verdict: 'ok' }))
  const { store } = await boot($, on, [HELPERS_ON, ['history', past]], [], files, world.setup)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  const key = 'design|agy|gemini-4-neon|medium'
  expect(await pane.find(text(/^Try Gemini 4 Neon medium on Antigravity for design \(judgment\)$/))).toBeTruthy()
  await pane.press({ key: `try-apply:${key}` })
  const choice = { provider: 'agy', model: 'gemini-4-neon', effort: 'medium' }
  expect((store.get('settings') as { helpers: { kinds: unknown } }).helpers.kinds).toEqual({ design: choice })
  expect(world.argsOf('set')).toEqual([])
  expect(await pane.find({ type: 'Button', key: `try-apply:${key}` } as never)).toBeFalsy()
  await openSettings(pane)
  await pressPick(pane, 'model-map-toggle')
  expect(await pane.find(text(/^Claude: sonnet medium \(tier\) · Antigravity: gemini-4-neon medium \(kind choice\)$/))).toBeTruthy()
  await pane.unmount()
})

test('Settings → Learning: the strengths and model map sit behind one handle; a kind\'s tags are edited by toggles, reset per kind, and the models are listed with their fits', async ($, on) => {
  const past = [1, 2].map(n => run(n, { tier: 'standard', kind: 'write-code', verdict: 'ok' }))
  const { store } = await boot($, on, [['settings', { kinds: { 'write-code': { model: 'haiku', effort: 'low' } } }], ['history', past]])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(pane)
  // Closed: the handle says what is inside; no kind lines yet.
  expect(await pane.find(text(/^1 kind · \d+ models?$/))).toBeTruthy()
  expect(await pane.find({ key: 'map-kind:write-code' } as never)).toBeFalsy()
  await pressPick(pane, 'model-map-toggle')
  expect(await pane.find(text(/^code$/))).toBeTruthy()
  expect(await pane.find(text(/^Claude: haiku low \(kind default\)$/))).toBeTruthy()
  expect(await pane.find(text(new RegExp(`^Gemini 4 Neon · judgment, agentic, research, long-context, second-opinion · deep high, second high, standard medium$`)))).toBeTruthy()
  expect(await pane.find({ type: 'Button', key: 'kind-tags-reset:write-code' } as never)).toBeFalsy()
  // Edit: toggles for the vocabulary; each press is stored and marks the kind as edited.
  await pressPick(pane, 'kind-tags-edit:write-code')
  await pressPick(pane, 'tag:write-code:review')
  expect((store.get('settings') as { kindTags: unknown }).kindTags).toEqual({ 'write-code': ['code', 'review'] })
  expect(await pane.find(text(/^code · review$/))).toBeTruthy()
  await pressPick(pane, 'tag:write-code:code')
  await pressPick(pane, 'tag:write-code:review')
  expect((store.get('settings') as { kindTags: unknown }).kindTags).toEqual({ 'write-code': [] })
  expect(await pane.find(text(/^no strengths$/))).toBeTruthy()
  await pressPick(pane, 'kind-tags-reset:write-code')
  expect((store.get('settings') as { kindTags: unknown }).kindTags).toEqual({})
  expect(await pane.find(text(/^code$/))).toBeTruthy()
  // Putting the default back by toggling leaves no override.
  await pressPick(pane, 'tag:write-code:review')
  await pressPick(pane, 'tag:write-code:review')
  expect((store.get('settings') as { kindTags: unknown }).kindTags).toEqual({})
  await pane.unmount()
})

test('another Claude account is compared with herdr-delegate\'s defaults for Claude accounts; a tier with no default is never marked', () => {
  const defaults = {
    providers: { kiro: { tiers: { light: { model: 'claude-haiku-5.5', effort: 'low' } } } },
    kind_defaults: { claude: { tiers: { light: { model: 'haiku', effort: 'high' }, deep: { model: 'opus', effort: 'high' } } } },
  }
  const cfg = {
    providers: {
      kiro: { tiers: { light: { model: 'claude-haiku-5.5', effort: 'high' }, extra: { model: 'glm-5', effort: 'high' } } },
      uni: { kind: 'claude', tiers: { light: { model: 'haiku', effort: 'high' }, deep: { model: 'fable', effort: 'high' } } },
    },
  }
  expect(helperTierDefault(cfg, defaults, 'uni', 'light')).toEqual({ model: 'haiku', effort: 'high' })
  expect(helperTierDiffers(cfg, defaults, 'uni', 'light')).toEqual({ model: false, effort: false })
  expect(helperTierDiffers(cfg, defaults, 'uni', 'deep')).toEqual({ model: true, effort: false })
  expect(helperTierDiffers(cfg, defaults, 'kiro', 'light')).toEqual({ model: false, effort: true })
  expect(helperTierDiffers(cfg, defaults, 'kiro', 'extra')).toEqual({ model: false, effort: false })
  expect(helperTierDiffers(cfg, undefined, 'kiro', 'light')).toEqual({ model: false, effort: false })
})

test('review fixes: details always say what a step runs on; dots count only what is shown; an open list closes with its view; a refused value says why', async ($, on) => {
  const { store } = await boot($, on, [['settings', { hereEffort: { enabled: false, maxContext: 80_000 }, helpers: { enabled: false, use: 'all' } }]])
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 's1', title: 'Write', tier: 'standard', where: 'agent' },
      { id: 'g1', title: 'Group', tier: 'deep', where: 'agent', parts: [{ id: 'g1.a', title: 'Part', tier: 'light', where: 'agent' }] },
    ],
  } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as never)
  // A Claude agent step on its level's default, and a group with nothing run yet, still open to a line.
  await pressPick(pane, 'open:s1')
  expect(await pane.find(text(/^standard level's default: \w+ · \w+$/))).toBeTruthy()
  await pressPick(pane, 'open:g1')
  expect(await pane.find(text(/^No part has run yet/))).toBeTruthy()

  // A limit kept while its experiment is off, and "All steps" kept while helpers are off, are not marked.
  await pressPick(pane, 'settings')
  expect(await pane.find({ key: 'dflt:helpers' } as never)).toBeFalsy()
  expect(await pane.find({ key: 'dflt:group:advanced' } as never)).toBeFalsy()

  // An open ▾ list closes when Settings close: it is not open again on the next visit.
  await pane.press({ key: 'spend' } as never)
  expect(await pane.find({ type: 'Button', key: 'spend:opt:balanced' } as never)).toBeTruthy()
  await pane.press({ key: 'settings-done' } as never)
  await pane.press({ key: 'settings' } as never)
  expect(await pane.find({ type: 'Button', key: 'spend:opt:balanced' } as never)).toBeFalsy()

  // Values an input does not take say why under it; the next one taken clears the note.
  await pane.unmount()
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(desk)
  await desk.input({ key: 'add-model', text: 'opus-fast' } as never)
  expect(await desk.find(text(/^Not taken: "opus-fast" counts as opus/))).toBeTruthy()
  await desk.input({ key: 'add-model', text: 'nova' } as never)
  expect(await desk.find(text(/^Not taken/))).toBeFalsy()
  expect((store.get('settings') as { models: string[] }).models).toContain('nova')
  await desk.input({ key: 'price:nova', text: '2' } as never)
  expect(await desk.find(text(/^Not taken: two numbers/))).toBeTruthy()
  await desk.unmount()
})

test('the helper checks: skipped after a failure is not "not needed"; the rules are pending, not failing, before the next message', () => {
  const set = mergeSettings({ helpers: { enabled: true } } as never)
  const missing = healthChecks({ set, st: { status: 'missing' } as never, rules: false })
  const byId = Object.fromEntries(missing.map(c => [c.id, c]))
  expect(byId.script!.state).toBe('fail')
  expect(byId.terminal).toMatchObject({ state: 'skip', blocked: true })
  expect(byId.terminal!.text).not.toContain('needs hc')
  expect(byId.enabled!.fix ?? '').not.toContain('Settings → Helpers')
})

// 0.29.4: auto mode leaves runs with no verdict out, and can try the rung below a learned one.
const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}T10:00:00.000Z`
const sum = (n: number, model: 'haiku' | 'sonnet', effort: 'low' | 'medium' | 'high', over: Partial<HistoryEntry> = {}) =>
  run(n, { kind: 'summarize', tier: 'standard', model, effort, verdict: 'ok', at: day(n), ...over })

test('auto mode: a run with no verdict says nothing either way; a rerun still counts as weak', () => {
  const set = mergeSettings({})
  const five = [1, 2, 3, 4, 5].map(n => sum(n, 'haiku', 'high'))
  const unjudged = [6, 7, 8].map(n => sum(n, 'haiku', 'high', { verdict: undefined }))
  expect(learnedRungs([...five, ...unjudged], set)).toEqual({ summarize: { rung: { model: 'haiku', effort: 'high' }, n: 5 } })
  // A rerun with no verdict is weak evidence: 5 ok of 6 judged is 83%, under 90%.
  expect(learnedRungs([...five, sum(9, 'haiku', 'high', { verdict: undefined, rerun: true })], set)).toEqual({})
  // Only unjudged runs: nothing learned.
  expect(learnedRungs(unjudged, set)).toEqual({})
})

test('exploration is off by default; on, it tries the rung below a learned one every few runs, and stops on a weak run', () => {
  expect(DEFAULT_SETTINGS.autoExplore).toBe(false)
  expect(mergeSettings({ autoExplore: true }).autoExplore).toBe(true)
  expect(EXPLORE.every).toBe(4)
  const set = mergeSettings({ autoRoute: true, autoExplore: true })
  const learnedOnSonnet = [1, 2, 3, 4, 5].map(n => sum(n, 'sonnet', 'medium'))
  const learned = learnedRungs(learnedOnSonnet, set)
  expect(learned).toEqual({ summarize: { rung: { model: 'sonnet', effort: 'medium' }, n: 5 } })
  // 5 runs on sonnet/medium and none below: the next run tries haiku/high, the rung below on the ladder.
  expect(exploreRungs(learnedOnSonnet, set, learned)).toEqual({
    summarize: { rung: { model: 'haiku', effort: 'high' }, n: 0, explore: { model: 'sonnet', effort: 'medium' } },
  })
  // A step of the kind already trying it: the others stay on the learned rung.
  expect(exploreRungs(learnedOnSonnet, set, learned, [{ kind: 'summarize', rung: { model: 'haiku', effort: 'high' } }])).toEqual(learned)
  // One ok try, then 2 runs on the learned rung: too soon for the next try; after 4, again.
  const tried = [...learnedOnSonnet, sum(6, 'haiku', 'high'), sum(7, 'sonnet', 'medium'), sum(8, 'sonnet', 'medium')]
  expect(exploreRungs(tried, set, learnedRungs(tried, set))).toEqual(learnedRungs(tried, set))
  const later = [...tried, sum(9, 'sonnet', 'medium'), sum(10, 'sonnet', 'medium')]
  expect(exploreRungs(later, set, learnedRungs(later, set)).summarize).toMatchObject({ rung: { model: 'haiku', effort: 'high' }, n: 1 })
  // A weak try stops the tries on that rung.
  const weak = [...learnedOnSonnet, sum(6, 'haiku', 'high', { verdict: 'weak' }), ...[7, 8, 9, 10, 11].map(n => sum(n, 'sonnet', 'medium'))]
  expect(exploreRungs(weak, set, learnedRungs(weak, set))).toEqual(learnedRungs(weak, set))
  // Once the rung below has its 5 ok runs it is learned (the cheapest good rung), and the tries move one rung further down.
  const earned = [...learnedOnSonnet, ...[6, 7, 8, 9, 10].map(n => sum(n, 'haiku', 'high')), ...[11, 12, 13, 14].map(n => sum(n, 'haiku', 'high'))]
  const now = learnedRungs(earned, set)
  expect(now.summarize?.rung).toEqual({ model: 'haiku', effort: 'high' })
  expect(exploreRungs(earned, set, now).summarize).toMatchObject({ rung: { model: 'haiku', effort: 'medium' }, explore: { model: 'haiku', effort: 'high' } })
  // The bottom of the ladder has nothing below.
  const bottom = [1, 2, 3, 4, 5].map(n => sum(n, 'haiku', 'low'))
  expect(exploreRungs(bottom, set, learnedRungs(bottom, set))).toEqual(learnedRungs(bottom, set))
})

test('a try one rung below is routed there, and the plan says so', async ($, on) => {
  const past = [1, 2, 3, 4, 5].map(n => sum(n, 'sonnet', 'medium'))
  const { calls } = await boot($, on, [['history', past], ['settings', { ...mergeSettings({}), autoRoute: true, autoExplore: true }]], [{ id: 'x1', description: '[s1] sum' }])
  await $.tool.call({ tool: PLAN, steps: [{ id: 's1', title: 'Summarize', tier: 'standard', where: 'agent', kind: 'summarize' }] } as never)
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'high' })
  const after = await $.tool.call({ tool: PLAN, done: [] } as never)
  expect(String(after.result)).toContain('[s1] Summarize: standard, haiku/high')
  // Delegated again while it runs (a second call of the same run), it stays on the rung it was put on.
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'high' })
})

// 0.29.4 review fixes (Gemini 4 Neon via the lead): exploration is decided only when an Agent call is routed.
const sumPlan = (ids: string[], over: Record<string, unknown> = {}) => ids.map(id => ({ id, title: `Summarize ${id}`, tier: 'standard', where: 'agent', kind: 'summarize', ...over }))
const exploreOn = (past: HistoryEntry[]): [string, unknown][] => [['history', past], ['settings', { ...mergeSettings({}), autoRoute: true, autoExplore: true }]]
const onSonnet = () => [1, 2, 3, 4, 5].map(n => sum(n, 'sonnet', 'medium'))

test('review fix 1: parallel Agent calls of one kind: only one tries the rung below', async ($, on) => {
  const { calls } = await boot($, on, exploreOn(onSonnet()), [{ id: 'x1', description: '[s1] sum' }, { id: 'x2', description: '[s2] sum' }])
  await $.tool.call({ tool: PLAN, steps: sumPlan(['s1', 's2']) } as never)
  await Promise.all([$.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' }), $.tool.call({ tool: 'Agent', description: '[s2] sum', prompt: 'go' })])
  const routed = calls.filter(c => c.tool === 'Agent').map(c => `${c.model}/${c.effort}`).sort()
  expect(routed).toEqual(['haiku/high', 'sonnet/medium'])
})

test('review fix 2: a try one rung below brings no "the user changed" note, and the other steps keep the learned rung', async ($, on) => {
  const { rows, calls } = await boot($, on, exploreOn(onSonnet()), [{ id: 'x1', description: '[s1] sum' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: sumPlan(['s1', 's2']) } as never)
  // Before anything runs, the agent is told the learned rung, not a try.
  const before = String((await $.tool.call({ tool: PLAN, done: [] } as never)).result)
  expect(before).toContain('[s2] Summarize s2: standard, sonnet/medium')
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'high' })
  await $.turn.start({ text: 'second', turnId: 't1' })
  expect(JSON.stringify(rows.appended())).not.toContain('changed step')
  const after = String((await $.tool.call({ tool: PLAN, done: [] } as never)).result)
  expect(after).toContain('[s2] Summarize s2: standard, sonnet/medium')
})

test('review fix 3: a pick of the effort alone fills the model from the learned rung, never from a try below', async ($, on) => {
  const { calls } = await boot($, on, exploreOn(onSonnet()), [{ id: 'x1', description: '[s1] sum' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: sumPlan(['s1']) } as never)
  const pane = await $.ui.mount(TERMINAL)
  await pressPick(pane, 'effort:s1')
  await pressPick(pane, 'draft-send')
  await pane.unmount()
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)?.model).toBe('sonnet')
  expect(calls.at(-1)?.effort).not.toBe('medium')
})

test('review fix 4: overkill counts as passing for auto mode (Claude agents and helpers); the advice still weighs it', () => {
  const set = mergeSettings({ autoRoute: true, autoExplore: true })
  const mixed = [1, 2, 3, 4].map(n => sum(n, 'haiku', 'high')).concat(sum(5, 'haiku', 'high', { verdict: 'overkill' }))
  expect(learnedRungs(mixed, set)).toEqual({ summarize: { rung: { model: 'haiku', effort: 'high' }, n: 5 } })
  // On a learned rung, one overkill among ok runs does not unlearn it; a rerun marked overkill still counts as weak.
  const six = [...[1, 2, 3, 4, 5].map(n => sum(n, 'sonnet', 'medium')), sum(6, 'sonnet', 'medium', { verdict: 'overkill' })]
  expect(learnedRungs(six, set).summarize?.rung).toEqual({ model: 'sonnet', effort: 'medium' })
  expect(learnedRungs([...six.slice(0, 5), sum(6, 'sonnet', 'medium', { verdict: 'overkill', rerun: true })], set)).toEqual({})
  // Tries that came out overkill end with the rung below learned, and the tries move one rung further down.
  const tried = [...onSonnet(), ...[6, 7, 8, 9].map(n => sum(n, 'haiku', 'high')), sum(10, 'haiku', 'high', { verdict: 'overkill' }), ...[11, 12, 13, 14].map(n => sum(n, 'haiku', 'high'))]
  expect(exploreRungs(tried, set, learnedRungs(tried, set)).summarize).toMatchObject({ rung: { model: 'haiku', effort: 'medium' }, explore: { model: 'haiku', effort: 'high' } })
  // Helpers: four ok and one overkill on a rung is learned.
  const cfg = helperDefaults() as never
  const hok = (n: number, verdict: 'ok' | 'overkill') => hrun(n, { kind: 'summarize', verdict, helper: 'x', hrung: { provider: 'kiro', model: 'claude-haiku-5.5', effort: 'medium' } })
  expect(learnedHelpers([1, 2, 3, 4].map(n => hok(n, 'ok')).concat(hok(5, 'overkill')), set, cfg).summarize?.map(c => `${c.model}/${c.effort} ${c.n}`)).toEqual(['claude-haiku-5.5/medium 5'])
  // The advice is unchanged: three overkill runs still advise a step down.
  expect(suggestions([1, 2, 3].map(n => sum(n, 'sonnet', 'medium', { verdict: 'overkill' })), set).map(a => a.isRaise)).toEqual([false])
})

test('review fix 5: a pane edit of model, effort or place ends a try below; the tier alone does not', () => {
  const tried = { ...newStep('s1', 'x', 'standard', 'agent'), kind: 'summarize', status: 'running' as const, model: 'haiku' as const, effort: 'high' as const, explored: { model: 'haiku', effort: 'high' } as never }
  expect(applyDraft(tried, { effort: 'medium' }).explored).toBeUndefined()
  expect(applyDraft(tried, { model: 'sonnet' }).explored).toBeUndefined()
  expect(applyDraft(tried, { where: 'helper' }).explored).toBeUndefined()
  expect(applyDraft(tried, { tier: 'deep' }).explored).toEqual({ model: 'haiku', effort: 'high' })
  expect(applyDraft(tried, { effort: 'high' }).explored).toEqual({ model: 'haiku', effort: 'high' })
})

test('review fix 5: a try run again goes back to the learned rung and no longer counts as trying', async ($, on) => {
  const { calls, step } = await boot($, on, exploreOn(onSonnet()), [{ id: 'x1', description: '[s1] sum' }])
  await $.tool.call({ tool: PLAN, steps: sumPlan(['s1', 's2']) } as never)
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'high' })
  await step('t1', haikuUse, 'x1')
  await end($, 'x1', 't1')
  // Delegated again: a rerun (which also counts as a weak try, so the tries on haiku/high stop), back on the learned rung.
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet', effort: 'medium' })
  const text = String((await $.tool.call({ tool: PLAN, done: [] } as never)).result)
  expect(text).not.toContain('trying one rung below')
})

test('review fix 5: a pane edit of a running try ends it, so another step of the kind may try the rung below', async ($, on) => {
  const { calls } = await boot($, on, exploreOn(onSonnet()), [{ id: 'x1', description: '[s1] sum' }, { id: 'x2', description: '[s2] sum' }])
  await $.turn.start({ text: 'first', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: sumPlan(['s1', 's2']) } as never)
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'high' })
  const pane = await $.ui.mount(TERMINAL)
  await pressPick(pane, 'effort:s1')
  await pressPick(pane, 'draft-send')
  await pane.unmount()
  await $.tool.call({ tool: 'Agent', description: '[s2] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'haiku', effort: 'high' })
  const text = String((await $.tool.call({ tool: PLAN, done: [] } as never)).result)
  expect(text).toContain('[s2] Summarize s2: standard, haiku/high (auto: trying one rung below sonnet/medium)')
  expect(text).not.toMatch(/\[s1\][^\n]*trying one rung below/)
})

test('review fix 6: a counted step (N agents) never tries the rung below', async ($, on) => {
  const { calls } = await boot($, on, exploreOn(onSonnet()), [{ id: 'x1', description: '[s1] sum' }])
  await $.tool.call({ tool: PLAN, steps: sumPlan(['s1'], { count: 2 }) } as never)
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(calls.at(-1)).toMatchObject({ model: 'sonnet', effort: 'medium' })
})

test('review fix 7: a started try still says so in the plan; n counts voiced tries; unjudged tries end at twice the minimum', async ($, on) => {
  const set = mergeSettings({ autoRoute: true, autoExplore: true })
  // Two judged tries and three without a verdict, then four runs on the learned rung: n is 2.
  const some = [...onSonnet(), sum(6, 'haiku', 'high'), sum(7, 'haiku', 'high'), ...[8, 9, 10].map(n => sum(n, 'haiku', 'high', { verdict: undefined })), ...[11, 12, 13, 14].map(n => sum(n, 'sonnet', 'medium'))]
  expect(exploreRungs(some, set, learnedRungs(some, set)).summarize).toMatchObject({ rung: { model: 'haiku', effort: 'high' }, n: 2 })
  // Ten tries none of them judged: no more tries.
  const silent = [...onSonnet(), ...[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(n => sum(n, 'haiku', 'high', { verdict: undefined })), ...[16, 17, 18, 19].map(n => sum(n, 'sonnet', 'medium'))]
  expect(exploreRungs(silent, set, learnedRungs(silent, set))).toEqual(learnedRungs(silent, set))

  await boot($, on, exploreOn(onSonnet()), [{ id: 'x1', description: '[s1] sum' }])
  await $.tool.call({ tool: PLAN, steps: sumPlan(['s1']) } as never)
  await $.tool.call({ tool: 'Agent', description: '[s1] sum', prompt: 'go' })
  expect(String((await $.tool.call({ tool: PLAN, done: [] } as never)).result)).toContain('auto: trying one rung below sonnet/medium')
})

test('review fix 8: VERSION is the plugin version', () => {
  expect(VERSION).toBe('0.30.0')
})

// --- Verdicts asked for at the next turn (0.29.5) ---------------------------------------

test('a delegated step that finished with no verdict is asked for in the next turn note, once; judged or already asked steps are not', async ($, on) => {
  const { step, rows } = await boot($, on, [], [
    { id: 'x1', description: '[r1] review' },
    { id: 'x2', description: '[r2] review' },
    { id: 'x3', description: '[r3] review' },
  ])
  await $.turn.start({ text: 'plan it', turnId: 't0' })
  await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 'r1', title: 'Review one', tier: 'light', where: 'agent' },
      { id: 'r2', title: 'Review two', tier: 'light', where: 'agent' },
      { id: 'r3', title: 'Review three', tier: 'light', where: 'agent' },
    ],
  } as never)
  const run = async (id: string, n: number) => {
    await $.tool.call({ tool: 'Agent', description: `[${id}] review`, prompt: 'go' })
    await new Promise(r => setTimeout(r, 5))
    await step(`t${n}`, haikuUse, `x${n}`)
    await end($, `x${n}`, `t${n}`)
  }
  await run('r2', 2)
  await run('r3', 3)
  // r2 gets its verdict; the plan tool asks about r3 in the same call.
  expect(String((await $.tool.call({ tool: PLAN, done: [{ id: 'r2', verdict: 'ok', why: 'fine' }] } as never)).result)).toContain('Verdict needed for [r3]')
  // r1 finishes last and the plan tool is not called again.
  await run('r1', 1)
  const count = rows.appended().length
  await $.turn.start({ text: 'next', turnId: 't9' })
  // r1 alone: it never reached the plan tool again after finishing.
  expect(rows.appended().length).toBe(count + 1)
  expect(lastRow(rows)).toContain('Verdict needed for [r1]:')
  expect(lastRow(rows)).not.toContain('[r2]')
  expect(lastRow(rows)).not.toContain('[r3]')
  // Once: the turn after says nothing, and the plan tool does not ask again either.
  await $.turn.start({ text: 'and on', turnId: 't10' })
  expect(rows.appended().length).toBe(count + 1)
  expect(String((await $.tool.call({ tool: PLAN, done: [] } as never)).result)).not.toContain('Verdict needed')
})

test('a step the plan tool already asked about is not asked again at the next turn; one never run is not asked', async ($, on) => {
  const { step, rows } = await boot($, on, [], [{ id: 'x1', description: '[r1] review' }])
  await $.turn.start({ text: 'plan it', turnId: 't0' })
  await $.tool.call({ tool: PLAN, steps: [
    { id: 'r1', title: 'Review one', tier: 'light', where: 'agent' },
    { id: 'r2', title: 'Never run', tier: 'light', where: 'agent' },
  ] } as never)
  await $.tool.call({ tool: 'Agent', description: '[r1] review', prompt: 'go' })
  await new Promise(r => setTimeout(r, 5))
  await step('t1', haikuUse, 'x1')
  await end($, 'x1', 't1')
  const asked = String((await $.tool.call({ tool: PLAN, done: ['r2'] } as never)).result)
  expect(asked).toContain('Verdict needed for [r1]')
  expect(asked).not.toContain('[r2]:')
  const count = rows.appended().length
  await $.turn.start({ text: 'next', turnId: 't2' })
  expect(rows.appended().length).toBe(count)
})

// --- Welcome, Guide link, help and update check (0.30.0) --------------------------------------
// By default the test engine loads the mod from a checkout (a dev install, which never checks); the
// CLAUDE_PLUGINS_UPDATE_CHECK_FORCE=1 environment makes it act as a cache install, as in session-status-line's tests.

const GUIDE_URL = 'https://horef.github.io/claude-plugins/model-router.html'
const UPDATING = 'https://horef.github.io/claude-plugins/updating.html'
const CHANGELOG = 'https://github.com/Horef/claude-plugins/blob/main/plugins/model-router/CHANGELOG.md'
const MANIFEST = 'https://raw.githubusercontent.com/Horef/claude-plugins/main/plugins/model-router/.claude-plugin/plugin.json'
const T0 = Date.parse('2026-11-23T08:00:00Z')
const DAY = 24 * 3_600_000
const SEEN: [string, unknown] = ['welcomeSeen', true]

/** The plugin's own plugin.json, whatever folder the engine loaded the mod from. */
class ManifestFiles extends Map<string, string> {
  version = '0.30.0'
  override get(k: string) {
    return k.endsWith('/.claude-plugin/plugin.json') ? JSON.stringify({ name: 'model-router', version: this.version }) : super.get(k)
  }
}

type Up = { installed?: string; latest?: string; init?: [string, unknown][]; env?: Record<string, string>; cache?: boolean }
/** A chat with a pretend manifest on GitHub ('down' answers 503), clock and prompt box. */
const bootUp = async ($: Parameters<TestBody>[0], on: Parameters<TestBody>[1], o: Up = {}) => {
  const files = new ManifestFiles()
  if (o.installed) files.version = o.installed
  const fetched: string[] = []
  const fills: { text: string; mode?: string }[] = []
  const net = { latest: o.latest ?? '0.30.0' }
  const box = { open: true }
  let clock!: ReturnType<typeof mock.clock>
  const b = await boot($, on, o.init ?? [], [], files, () => {
    on('http.fetch', (_, e) => {
      fetched.push((e as { url: string }).url)
      return { value: net.latest === 'down' ? { status: 503, ok: false, headers: {}, text: 'busy' } : { status: 200, ok: true, headers: {}, text: JSON.stringify({ name: 'model-router', version: net.latest }) } }
    })
    on('prompt.fill', (_, e) => {
      fills.push(e as never)
      return (box.open ? { isFilled: true, text: (e as { text: string }).text } : { isFilled: false, text: '', refusal: 'dialog' }) as never
    })
    clock = mock.clock(on, { now: T0 })
    helperWorld(on, files).setup()
  }, { HC_TERMINAL_ID: 'w1:t1', ...(o.cache === false ? {} : { CLAUDE_PLUGINS_UPDATE_CHECK_FORCE: '1' }), ...o.env })
  // The check runs after session.start returns: a few pretend milliseconds let it finish.
  await clock.advance(10)

  return { ...b, files, fetched, fills, net, box, clock }
}
const router = async ($: Parameters<TestBody>[0], args: string) => String(((await $.command.run({ command: 'router', args } as never)) as { text: string }).text)
const updateState = (store: Map<string, unknown>) => store.get('update') as { latest?: string; dismissed?: string; lastOk?: boolean } | undefined
const NOTICE = /^↑ model-router 0\.30\.1 available$/
const link = (label: string) => ({ type: 'Link', text: label }) as never
/** A Link's props, found by its label. */
const hrefOf = async (pane: { findAll: (q: never) => Promise<unknown[]> }, label: string) =>
  ((await pane.findAll({ type: 'Link' } as never)) as { props: { href: string; label: string } }[]).filter(l => l.props.label === label).map(l => l.props.href)

test('welcome: a fresh store replaces the empty-plan line with three steps; a Guide link and Got it close it, and it stays closed', async ($, on) => {
  const { store } = await bootUp($, on)
  for (const surface of ['desktop', 'terminal'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface } as never)
    expect(await pane.find(text(/^New here\? Three steps:$/))).toBeTruthy()
    expect(await pane.find(text(/^1\. Ask for something with several steps \(e\.g\. "In three steps: find the five largest files here, summarize each, and pick the one most worth cleaning up"\)\.$/))).toBeTruthy()
    expect(await pane.find(text(/^2\. Approve the plan in the question that appears\.$/))).toBeTruthy()
    expect(await pane.find(text(/^3\. Watch the steps, models and cost here\.$/))).toBeTruthy()
    expect(await pane.find(text(/^No plan yet/))).toBeFalsy()
    expect(await pane.find(link('Guide ↗'))).toBeTruthy()
    expect(await pane.find({ key: 'welcome-ok' } as never)).toBeTruthy()
    await pane.unmount()
  }
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'welcome-ok' } as never)
  expect(store.get('welcomeSeen')).toBe(true)
  expect(await pane.find(text(/^New here\?/))).toBeFalsy()
  expect(await pane.find(text(/^No plan yet\. Multi-step tasks show their steps here\.$/))).toBeTruthy()
  await pane.unmount()
})

test('welcome: never for someone with history or any plan ever posted; the first plan closes it for good', async ($, on) => {
  // History: runs on record.
  const old = await bootUp($, on, { init: [['history', [run(1)]]] })
  let pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^New here\?/))).toBeFalsy()
  expect(await pane.find(text(/^No plan yet/))).toBeTruthy()
  await pane.unmount()
  expect(old.store.has('welcomeSeen')).toBe(false)
})

test('welcome: all-time counters count too (history cleared, a plan once posted)', async ($, on) => {
  const seeded = { mainCost: 5, agentCost: 1, mainEquivalent: 3, steps: 0, plans: 2, since: '2026-10-01T00:00:00.000Z', byTier: { light: 1, standard: 2, deep: 1 } }
  await bootUp($, on, { init: [['lifetime', seeded]] })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^New here\?/))).toBeFalsy()
  await pane.unmount()
})

test('welcome: the first posted plan sets it seen, and it does not come back when the plan is gone', async ($, on) => {
  const { store } = await bootUp($, on)
  let pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^New here\?/))).toBeTruthy()
  await pane.unmount()
  await $.tool.call({ tool: PLAN, steps: [{ id: 'a', title: 'Look', tier: 'light', where: 'here' }] } as never)
  expect(store.get('welcomeSeen')).toBe(true)
  await $.tool.call({ tool: PLAN, steps: [] } as never).catch(() => undefined)
  pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/^New here\?/))).toBeFalsy()
  await pane.unmount()
})

test('footer: a Guide link sits beside Settings and Write report, on every surface', async ($, on) => {
  await bootUp($, on, { init: [SEEN] })
  for (const surface of ['desktop', 'terminal'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface } as never)
    expect(await hrefOf(pane, 'Guide ↗')).toEqual([GUIDE_URL])
    expect(await pane.find({ type: 'Button', key: 'settings' } as never)).toBeTruthy()
    expect(await pane.find({ type: 'Button', key: 'footer-report' } as never)).toBeTruthy()
    await pane.unmount()
  }
})

test('/router help: at most 12 plain lines: what it does, the three steps, the commands, the guide and the installed version', async ($, on) => {
  const { clock } = await bootUp($, on, { installed: '7.8.9', latest: '7.8.9' })
  const help = await router($, 'help')
  expect(help.split('\n').length).toBeLessThanOrEqual(12)
  expect(help).toBe(
    [
      'Model router plans multi-step tasks and runs each step on the cheapest model that does it well.',
      'To start:',
      '  1. Ask for something with several steps ("In three steps: find the five largest files here, summarize each, and pick the one most worth cleaning up").',
      '  2. Approve the plan in the question that appears.',
      '  3. Watch the steps, models and cost in the pane.',
      '  /router                 open the pane',
      '  /router report          write a diagnostics report to send',
      '  /router update          check for a newer version and update it from here',
      `Guide: ${GUIDE_URL}`,
      'Version 7.8.9.',
    ].join('\n'),
  )
  expect(await router($, ' HELP ')).toBe(help)
  void clock
})

test('the command description names help and update', async ($, on) => {
  const registered: { description?: string }[] = []
  mock.env(on, { HOME })
  on('command.register', (_, e) => {
    registered.push(e as never)
    return { value: { command: 'router' } }
  })
  on('tool.register', () => ({ value: { tool: PLAN } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.read', () => ({ deny: 'ENOENT' }))
  on('fs.write', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.status', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [] }))
  mock.session(on)
  helperWorld(on, new Map()).setup()
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(registered.at(-1)?.description).toContain('help')
  expect(registered.at(-1)?.description).toContain('update')
})

test('update notice: a newer release is one quiet line under the health line, with What\'s new, Update, How and ×', async ($, on) => {
  const { store, fetched } = await bootUp($, on, { latest: '0.30.1', init: [SEEN] })
  expect(fetched).toEqual([MANIFEST])
  expect(updateState(store)).toMatchObject({ latest: '0.30.1', lastOk: true })
  for (const surface of ['desktop', 'terminal'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface } as never)
    expect(await pane.find(text(NOTICE))).toBeTruthy()
    expect(await hrefOf(pane, "What's new ↗")).toEqual([CHANGELOG])
    expect(await hrefOf(pane, 'How ↗')).toEqual([UPDATING])
    expect(await pane.find({ type: 'Button', key: 'update-run' } as never)).toBeTruthy()
    expect(await pane.find({ type: 'Button', key: 'update-dismiss' } as never)).toBeTruthy()
    await pane.unmount()
  }
})

for (const latest of ['0.29.9', '0.30.0', '0.31.0-rc.1', '0.9.0', 'down']) {
  test(`update notice: not for ${latest === 'down' ? 'a failed check' : `a latest of ${latest} (installed 0.30.0)`}, and a failed check never touches the health line`, async ($, on) => {
    const { fetched } = await bootUp($, on, { latest, init: [SEEN] })
    expect(fetched).toEqual([MANIFEST])
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
    expect(await pane.find(text(/available$/))).toBeFalsy()
    expect(await pane.find(text(/✗/))).toBeFalsy()
    await pane.unmount()
  })
}

test('update notice: × dismisses that version (remembered); a later version shows again; a dismissed one stays quiet', async ($, on) => {
  const { store, net, clock } = await bootUp($, on, { latest: '0.30.1', init: [SEEN] })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'update-dismiss' } as never)
  expect(updateState(store)?.dismissed).toBe('0.30.1')
  expect(await pane.find(text(NOTICE))).toBeFalsy()
  await pane.unmount()
  // A later release (its check is due after a day) is announced.
  net.latest = '0.31.0'
  store.set('update', { ...updateState(store), lastCheck: new Date(T0 - 2 * DAY).toISOString() })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.advance(10)
  const again = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await again.find(text(/^↑ model-router 0\.31\.0 available$/))).toBeTruthy()
  expect(updateState(store)?.dismissed).toBe('0.30.1')
  await again.unmount()
})

test('update notice: a version dismissed before is not shown', async ($, on) => {
  await bootUp($, on, { latest: '0.30.1', init: [SEEN, ['update', { lastCheck: new Date(T0).toISOString(), lastOk: true, latest: '0.30.1', dismissed: '0.30.1' }]] })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/available$/))).toBeFalsy()
  await pane.unmount()
})

test('update notice: Update puts the request in the prompt box; when the box refuses, the pane shows the text', async ($, on) => {
  const { fills, box } = await bootUp($, on, { latest: '0.30.1', init: [SEEN] })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await pane.press({ key: 'update-run' } as never)
  expect(fills).toHaveLength(1)
  expect(fills[0]).toMatchObject({ mode: 'replace' })
  expect(fills[0]!.text).toContain('claude plugin marketplace update horef-claude-plugins')
  expect(fills[0]!.text).toContain('claude plugin update model-router@horef-claude-plugins')
  expect(await pane.find(text(/^The update request is in your prompt box: press Enter\.$/))).toBeTruthy()
  box.open = false
  await pane.press({ key: 'update-run' } as never)
  expect(await pane.find(text(/^Send this to Claude to update: Please update my model-router plugin/))).toBeTruthy()
  await pane.unmount()
})

test('/router update: checks now (also with the daily check off), prints both versions and the links, fills the prompt', async ($, on) => {
  const { fills, fetched, store } = await bootUp($, on, { latest: '0.30.1', init: [SEEN, ['settings', { updateCheck: false }]], env: { CLAUDE_PLUGINS_NO_UPDATE_CHECK: '1' } })
  expect(fetched).toEqual([]) // both opt-outs: the quiet check never ran
  const out = await router($, 'update')
  expect(fetched).toEqual([MANIFEST])
  expect(out).toContain('model-router 0.30.0 is installed; the latest is 0.30.1.')
  expect(out).toContain('press Enter')
  expect(out).toContain(CHANGELOG)
  expect(out).toContain(UPDATING)
  expect(fills).toMatchObject([{ mode: 'replace' }])
  expect(updateState(store)?.latest).toBe('0.30.1')
})

test('/router update: up to date, offline and a closed prompt box say so; dismiss stores the latest version', async ($, on) => {
  const e = await bootUp($, on, { latest: '0.30.0', init: [SEEN] })
  expect(await router($, 'update')).toContain('model-router 0.30.0 is installed; the latest is 0.30.0: up to date.')
  e.net.latest = 'down'
  const offline = await router($, 'update')
  expect(offline).toContain('Could not read the latest version')
  expect(offline).toContain(UPDATING)
  expect(await router($, 'update dismiss')).toContain('nothing to dismiss')
  e.net.latest = '0.30.1'
  e.box.open = false
  expect(await router($, 'update')).toContain('Send this to Claude to update: Please update my model-router plugin')
  expect(await router($, 'update dismiss')).toContain('Dismissed 0.30.1')
  expect(updateState(e.store)?.dismissed).toBe('0.30.1')
  expect(await router($, 'update later')).toContain('Usage')
})

test('update check: a checkout (dev install) never checks, shows no notice and /router update says how to update', async ($, on) => {
  const { fetched, fills } = await bootUp($, on, { latest: '0.30.1', init: [SEEN], cache: false })
  expect(fetched).toEqual([])
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect(await pane.find(text(/available$/))).toBeFalsy()
  await pane.unmount()
  expect(await router($, 'update')).toContain('does not update itself')
  expect(fetched).toEqual([])
  expect(fills).toEqual([])
})

for (const [how, o] of [
  ['the CLAUDE_PLUGINS_NO_UPDATE_CHECK environment', { env: { CLAUDE_PLUGINS_NO_UPDATE_CHECK: '1' }, init: [SEEN] }],
  ['the Check for updates setting', { init: [SEEN, ['settings', { updateCheck: false }]] }],
] as [string, Up][]) {
  test(`update check: off by ${how}: nothing is asked and a version found by hand stays out of the pane`, async ($, on) => {
    const { fetched } = await bootUp($, on, { latest: '0.30.1', ...o })
    expect(fetched).toEqual([])
    expect(await router($, 'update')).toContain('the latest is 0.30.1')
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
    expect(await pane.find(text(/available$/))).toBeFalsy()
    await pane.unmount()
  })
}

test('update check: Settings → Diagnostics has the Check for updates switch, on by default', async ($, on) => {
  const { store, fetched } = await bootUp($, on, { latest: '0.30.1', init: [SEEN] })
  expect(mergeSettings(undefined).updateCheck).toBe(true)
  expect(DEFAULT_SETTINGS.updateCheck).toBe(true)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  await openSettings(pane)
  expect(await pane.find(text(/^Check for updates$/))).toBeTruthy()
  await pane.press({ key: 'update-check' } as never)
  expect((store.get('settings') as { updateCheck: boolean }).updateCheck).toBe(false)
  await pane.unmount()
  expect(fetched).toHaveLength(1) // asked once, at the start, while it was on
})

test('update check: once a day, and a failure is silent and backs off for 6 hours', async ($, on) => {
  const e = await bootUp($, on, { latest: 'down', init: [SEEN] })
  expect(e.fetched).toHaveLength(1)
  expect(updateState(e.store)?.lastOk).toBe(false)
  const restart = async () => {
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    await e.clock.advance(10)
  }
  await restart()
  expect(e.fetched).toHaveLength(1) // inside the back-off
  e.store.set('update', { ...updateState(e.store), lastCheck: new Date(T0 - 7 * 3_600_000).toISOString() })
  e.net.latest = '0.30.1'
  await restart()
  expect(e.fetched).toHaveLength(2)
  await restart()
  expect(e.fetched).toHaveLength(2) // a good answer holds for 24 h
})

test('the report and the status check show the installed version from plugin.json', async ($, on) => {
  await bootUp($, on, { installed: '7.8.9', init: [SEEN] })
  const status = await $.tool.call({ tool: PLAN, status: true } as never)
  expect(String(status.result)).toContain('"version":"7.8.9"')
})

// --- hooks/update.ts (the same file as in session-status-line: its pure rules) ---------------------

import { dueForCheck, installCommand, isDevInstall, isNewer, parseVersion, shouldAnnounce, updateRequest, versionOfManifest } from '../hooks/update'

const HOUR = 3_600_000
test('update.ts: parseVersion takes plain releases only', () => {
  expect(parseVersion('0.30.0')).toEqual([0, 30, 0])
  expect(parseVersion('12.0.104')).toEqual([12, 0, 104])
  for (const bad of ['0.30.0-rc.1', 'v1.2.3', '1.2', '1.2.3.4', '', ' 1.2.3', '1.2.x', 'latest', undefined, 3]) expect(parseVersion(bad)).toBeUndefined()
})

test('update.ts: isNewer is true only for a higher release, numerically', () => {
  expect(isNewer('0.30.1', '0.30.0')).toBe(true)
  expect(isNewer('0.30.0', '0.9.9')).toBe(true) // not a string comparison
  expect(isNewer('1.0.0', '0.99.99')).toBe(true)
  expect(isNewer('0.30.0', '0.30.0')).toBe(false)
  expect(isNewer('0.29.9', '0.30.0')).toBe(false)
  expect(isNewer('0.31.0-rc.1', '0.30.0')).toBe(false) // a pre-release is never "newer"
  expect(isNewer('0.30.0', 'dev')).toBe(false)
  expect(isNewer(undefined, '0.1.0')).toBe(false)
})

test('update.ts: dueForCheck is at once without a check, 24 h after a good one, 6 h after a failed one', () => {
  const at = (h: number) => T0 + h * HOUR
  const iso = (ms: number) => new Date(ms).toISOString()
  expect(dueForCheck(T0, undefined)).toBe(true)
  expect(dueForCheck(T0, { lastCheck: 'garbage' })).toBe(true)
  const ok = { lastCheck: iso(T0), lastOk: true }
  expect(dueForCheck(at(0), ok)).toBe(false)
  expect(dueForCheck(at(23.9), ok)).toBe(false)
  expect(dueForCheck(at(24), ok)).toBe(true)
  const failed = { lastCheck: iso(T0), lastOk: false }
  expect(dueForCheck(at(5.9), failed)).toBe(false)
  expect(dueForCheck(at(6), failed)).toBe(true)
  expect(dueForCheck(T0 - 5_000, ok)).toBe(false)
})

test('update.ts: only a folder under plugins/cache is an installed copy; the request and install command say what to run', () => {
  expect(isDevInstall('/Users/a/.claude/plugins/cache/horef-claude-plugins/model-router/0.30.0')).toBe(false)
  expect(isDevInstall('C:\\Users\\a\\.claude\\plugins\\cache\\horef-claude-plugins\\model-router\\0.30.0')).toBe(false)
  expect(isDevInstall('/Users/a/Programming/claude-plugins/plugins/model-router')).toBe(true)
  expect(updateRequest('model-router')).toContain('claude plugin update model-router@horef-claude-plugins')
  expect(installCommand('model-router')).toBe('/plugin install model-router --marketplace Horef/claude-plugins')
  expect(versionOfManifest('{"version":"0.30.1"}')).toBe('0.30.1')
  expect(versionOfManifest('{"version":"0.30.1-rc.1"}')).toBeUndefined()
  expect(versionOfManifest('<html>rate limited</html>')).toBeUndefined()
  expect(shouldAnnounce({ latest: '0.30.1' }, '0.30.0')).toBe(true)
  expect(shouldAnnounce({ latest: '0.30.1', dismissed: '0.30.1' }, '0.30.0')).toBe(false)
})
