// On a Team or Enterprise account Claude Code (2.1.330) seats the built-in sec-default plugin, which sends
// session.compact and prompt.compose past every mod a person installs. Here neither event reaches the router:
// the test raises neither. The rules must still come back after a compaction (the chat no longer holds the
// row that carried them: `$.session.messages({ after })` answers `{ deny }`), and the status line must still
// say which model has them.
import { expect, mock, test } from 'claude-code/testing'

const PLAN = 'mcp__model-router__plan'
const lastRow = (rows: { appended: () => readonly unknown[] }) => JSON.stringify(rows.appended().at(-1) ?? '')

test('with session.compact and prompt.compose kept from the router, the rules return once their row is gone', async ($, on) => {
  const statuses: (string | undefined)[] = []
  const store = new Map<string, unknown>([['autoApprove', true]])
  const chat = { gone: new Set<string>() } // rows a compaction left behind
  const reads: string[] = []

  on('command.register', () => ({ value: { command: 'router' } }))
  on('tool.register', () => ({ value: { tool: PLAN } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('store.get', (_, e) => ({ value: store.get((e as { key: string }).key) }))
  on('store.set', (_, e) => {
    store.set((e as { key: string }).key, (e as { value: unknown }).value)
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'claude-opus-5-5[1m]' }))
  on('session.messages', (_, e) => {
    const after = (e as { after?: string }).after
    if (after) reads.push(after)
    return { value: after && chat.gone.has(after) ? { deny: `row ${after} was left behind the last compaction` } : [] }
  })
  on('ui.status', (_, e) => {
    statuses.push((e as { text?: string }).text)
    return { value: undefined }
  })
  const rows = mock.session(on)
  on('turn.start', (_, e) => ({ turnId: (e as { turnId: string }).turnId }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // The first turn writes the rules into the chat; with no prompt.compose the turn says which model has them.
  await $.turn.start({ text: 'hello', turnId: 't1' })
  expect(lastRow(rows)).toContain('# Model routing')
  expect(statuses.at(-1)).toContain('rules sent to opus')
  const count = rows.appended().length
  await $.turn.start({ text: 'again', turnId: 't2' })
  expect(rows.appended().length).toBe(count) // still in the chat: nothing more
  const rulesRow = (rows.appended().find(r => JSON.stringify(r).includes('# Model routing')) as { uuid: string }).uuid
  expect(reads).toContain(rulesRow)

  // A plan, then a compaction the router never hears of: its row is gone, so rules and plan return together.
  await $.tool.call({ tool: PLAN, steps: [{ id: 'p1', title: 'Read papers', tier: 'light', where: 'agent' }] } as never)
  chat.gone.add(rulesRow)
  await $.turn.start({ text: 'continue', turnId: 't3' })
  const row = lastRow(rows)
  expect(row).toContain('# Model routing')
  expect(row).toContain('conversation was summarized')
  expect(row).toContain('[p1] Read papers')
  const after = rows.appended().length
  await $.turn.start({ text: 'and on', turnId: 't4' })
  expect(rows.appended().length).toBe(after) // the new row holds: nothing more

  // A subagent's turn neither reads nor writes.
  const seen = reads.length
  await $.turn.start({ text: 'sub', turnId: 't5', agentId: 'a1' })
  expect(reads.length).toBe(seen)
  expect(rows.appended().length).toBe(after)
})
