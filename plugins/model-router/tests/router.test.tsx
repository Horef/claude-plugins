import { expect, test } from 'claude-code/testing'

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
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('auto-approved plan routes a step to its tier; pane pickers override', async ($, on) => {
  const seen: { model?: string; effort?: string }[] = []
  on('command.register', () => ({ value: { command: 'router' } }))
  on('tool.register', () => ({ value: { tool: PLAN } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const store = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: store.get((e as { key: string }).key) }))
  on('store.set', (_, e) => {
    store.set((e as { key: string }).key, (e as { value: unknown }).value)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('tool.call', (_, e) => {
    seen.push(e as { model?: string; effort?: string })
    return { result: { agentId: 'a1' } }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  // Turn auto-approve on from the pane, so the plan call does not ask.
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'auto' })
  await pane.unmount()

  const planned = await $.tool.call({
    tool: PLAN,
    steps: [
      { id: 's1', title: 'Check docs agree', tier: 'light', where: 'agent' },
      { id: 's2', title: 'Decide training plan', tier: 'deep', where: 'here' },
    ],
  } as never)
  expect(String(planned.result)).toContain('auto-approved')

  await $.tool.call({ tool: 'Agent', description: '[s1] check docs', prompt: 'go' })
  expect(seen.at(-1)?.model).toBe('haiku')
  expect(seen.at(-1)?.effort).toBe('low')

  await $.tool.call({ tool: 'Agent', description: 'other', prompt: 'go' })
  expect(seen.at(-1)?.model).toBe(undefined)

  // Desktop draws pickers; the model picker overrides the tier.
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Check docs agree/ }))?.text).toBe('Check docs agree')
  await ui.select({ key: 'model:s1', value: 'opus' })
  await ui.unmount()
  await $.tool.call({ tool: 'Agent', description: '[s1] check docs', prompt: 'go' })
  expect(seen.at(-1)?.model).toBe('opus')
  expect(seen.at(-1)?.effort).toBe('low')

  // Mobile has no Select: the tier is a button that cycles.
  const phone = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await phone.press({ key: 'tier:s1' })
  await phone.unmount()
  await $.tool.call({ tool: 'Agent', description: '[s1] check docs', prompt: 'go' })
  expect(seen.at(-1)?.effort).toBe('medium')

  // The band above the prompt shows the plan; the engine draws nothing beneath it here.
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({
      plugin: 'model-router',
      component: 'AbovePrompt',
      surface,
      props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 100, scroll: { offset: 0, bodyRows: 3 } },
    } as never)
    expect((await band.find({ type: 'Text', text: /Router/ }))?.text).toContain('Router')
    await band.unmount()
  }
})
