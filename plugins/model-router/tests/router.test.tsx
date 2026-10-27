import { expect, mock, test } from 'claude-code/testing'

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

  // The main chat runs on Opus; the subagent's turn is priced at Haiku and compared.
  await $.turn.complete({
    answer: 'ok', durationMs: 1, isAborted: false, turnId: 't0', reason: 'answer',
    usage: { model: 'claude-opus-5-5', input_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 50000, output_tokens: 500 },
  } as never)
  await $.turn.complete({
    answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a1',
    usage: { model: 'claude-haiku-5-5', input_tokens: 2, cache_creation_input_tokens: 4000, cache_read_input_tokens: 37000, output_tokens: 1000 },
  } as never)
  expect(statuses.at(-1)).toContain('1/2 done')
  expect(statuses.at(-1)).toContain('saved')
  expect((store.get('history') as unknown[]).length).toBe(1)

  // The start-up-heavy note reaches the model with the next plan call.
  const after = await $.tool.call({ tool: PLAN, done: ['u2'] } as never)
  expect(String(after.result)).toContain('mostly subagent start-up cost')

  // The card shows cost and savings, and offers the next rung.
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /saved ≈/ }))?.text).toContain('saved')
  expect((await ui.find({ type: 'Text', text: /^Done in this chat, on opus/ }))?.text).toContain('only picks a model')
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
