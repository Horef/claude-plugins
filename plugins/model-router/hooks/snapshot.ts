// The state file the Herdr view reads: the plan and the money as short display strings, built by a pure function.
import type { HelperTotals, Settings, Step, Totals } from '../types'
import { cardModelLine, fmtCost, fmtUsd, helperLine, helperName, helperTotalsOf, isDelegated, isHelperRun, leavesOf, rollupOf, runsOn, depthOf, pickSource, whereLabel } from './logic'
import type { Learned, NewModelsCard } from './logic'

/** Days a state file is kept after its last write. */
export const STATE_DAYS = 2

export type StateStep = {
  id: string
  depth: number
  title: string
  status: Step['status']
  tier: Step['tier']
  group: boolean
  /** "this chat", "Claude agent" or "other subscription" (the pane's words); empty on a group. */
  where: string
  /** What it runs on: "sonnet/medium", "copilot-standard · Claude Sonnet 5.5", "launch <template> · …"; for a group, its progress. */
  on: string
  cost: string
  verdict: string
  fallback: string
  /** Extra short notes: count, kind, start-up heavy. */
  notes: string[]
}

export type RouterState = {
  version: 1
  router: string
  chat: string
  cwd: string
  at: string
  status: 'none' | 'pending' | 'approved'
  statusText: string
  health: { ok: boolean; text: string }
  steps: StateStep[]
  cost: { plan: string[]; chat: string[] }
  news: string[]
}

export type SnapshotInput = {
  router: string
  chat: string
  cwd?: string
  at: Date
  status: RouterState['status']
  health: { ok: boolean; text: string }
  list: readonly Step[]
  set: Settings
  learned?: Learned
  main: { cost: number; model?: string; unpriced?: boolean }
  planBaseCost: number
  totals: Totals
  news?: readonly string[]
}

/** A file-name-safe chat key: the engine's session id when there is one, else a random one made once per chat. */
export const chatKeyOf = (sessionId: unknown, random: () => string) => {
  const clean = typeof sessionId === 'string' ? sessionId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) : ''

  return clean || random()
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')

const whereOf = (s: Step) => (s.group ? '' : whereLabel(s.where === 'here' ? 'here' : isHelperRun(s) ? 'helper' : 'agent'))

const onOf = (list: readonly Step[], s: Step, set: Settings, learned?: Learned) => {
  if (s.group) {
    const r = rollupOf(list, s)

    return `rated ${s.tier} · ${r.done}/${r.total} done`
  }
  if (s.where === 'here') return ''
  if (isHelperRun(s) && s.helper) return helperName(s)
  if (s.where === 'helper') {
    const p = s.helperPick

    return p ? (p.template ? `launch ${p.template} · ${p.model} ${p.effort} · ${pickSource(p)}` : `no template for ${p.model} ${p.effort}`) : 'other subscription (in order)'
  }
  const r = runsOn(s, set, learned)

  return `${r.model}/${r.effort}`
}

const verdictOf = (s: Step) => {
  if (!isDelegated(s) || s.status !== 'done') return ''
  if (s.verdict === 'cut-short') return 'cut short'

  return s.verdict ? `verdict ${s.verdict}${s.why ? `: ${s.why}` : ''}` : 'no verdict yet'
}

const stepOf = (list: readonly Step[], s: Step, set: Settings, learned?: Learned): StateStep => {
  const cost = s.group ? rollupOf(list, s).cost : s.cost
  const notes = [
    s.count && s.count > 1 ? `${s.runs ?? 0}/${s.count} agents` : '',
    s.kind ?? '',
    s.reruns > 0 ? `rerun ${s.reruns}×` : '',
    s.setupHeavy ? 'start-up heavy' : '',
  ].filter(Boolean)

  return {
    id: s.id,
    depth: depthOf(list, s),
    title: s.title,
    status: s.status,
    tier: s.tier,
    group: !!s.group,
    where: whereOf(s),
    on: onOf(list, s, set, learned),
    cost: s.unpriced ? fmtCost(s.cost, true) : cost > 0 ? fmtCost(cost) : '',
    verdict: verdictOf(s),
    fallback: s.fallback ? `ran as a Claude agent: ${s.fallback}` : '',
    notes,
  }
}

const moneyLines = (model: string | undefined, mainSpent: number, mainOpen: boolean | undefined, agents: number, agentsOpen: boolean | undefined, saved: number, equivalent: number, moved: HelperTotals | undefined, helpersOn: boolean) => {
  const lines = [
    `Main chat${model ? ` · ${model}` : ''}: ${fmtCost(mainSpent, mainOpen)}`,
    `Subagents: ${fmtCost(agents, agentsOpen)}`,
    `Saved: ${saved > 0 ? `≈${fmtUsd(saved)} (${pct(saved, mainSpent + equivalent)} of the total)` : '—'}`,
  ]
  const off = helperLine(moved)
  if (off) lines.push(off)
  else if (helpersOn) lines.push('Off Claude: no helper steps yet')

  return lines
}

const textOfStatus = (status: RouterState['status'], list: readonly Step[]) => {
  if (list.length === 0) return 'no plan'
  const work = leavesOf(list)
  const done = work.filter(s => s.status === 'done').length

  return status === 'pending' ? 'awaiting your approval' : `${status === 'approved' ? 'approved' : 'plan'} · ${done}/${work.length} done`
}

/** Everything the Herdr view shows, as short display strings (the same words as the pane). */
export const buildSnapshot = (i: SnapshotInput): RouterState => {
  const { list, set, totals } = i
  const agentCost = list.reduce((n, s) => n + s.cost, 0)
  const equivalent = list.reduce((n, s) => n + s.mainCost, 0)
  const saved = list.reduce((n, s) => n + Math.max(0, s.mainCost - s.cost), 0)
  const planMain = Math.max(0, i.main.cost - i.planBaseCost)
  const chatSaved = Math.max(0, totals.mainEquivalent - totals.agentCost)

  return {
    version: 1,
    router: i.router,
    chat: i.chat,
    cwd: i.cwd ?? '',
    at: i.at.toISOString(),
    status: i.status,
    statusText: textOfStatus(i.status, list),
    health: i.health,
    steps: list.map(s => stepOf(list, s, set, i.learned)),
    cost: {
      plan: moneyLines(i.main.model, planMain, i.main.unpriced, agentCost, list.some(x => x.unpriced), saved, equivalent, helperTotalsOf(list), set.helpers.enabled),
      chat: moneyLines(i.main.model, i.main.cost, i.main.unpriced, totals.agentCost, totals.unpriced, chatSaved, totals.mainEquivalent, totals.helper, set.helpers.enabled),
    },
    news: [...(i.news ?? [])],
  }
}

/** The New models card as text lines, the same words as the pane: a header, a line per model, a line per proposal. */
export const newsLines = (card: NewModelsCard | undefined): string[] =>
  card
    ? [
        `New models (${card.models.length || card.proposals.length})${card.checked ? ` · checked ${card.checked}` : ''}`,
        ...card.models.map(m => cardModelLine(m)),
        ...card.proposals.map(p => `${p.tier} ${p.label}: ${p.from} → ${p.to} · ${p.why}`),
      ]
    : []

/** The snapshot without its time: two snapshots with the same key need no second write. */
export const snapshotKey = (s: RouterState) => JSON.stringify({ ...s, at: '' })

/** The state files to delete: those last written more than `days` ago, or that no one can read. */
export const oldStateFiles = (files: readonly { name: string; at?: string }[], now: Date, days = STATE_DAYS) =>
  files
    .filter(f => /^[A-Za-z0-9_-]+\.json$/.test(f.name))
    .filter(f => {
      const t = f.at ? Date.parse(f.at) : Number.NaN

      return Number.isNaN(t) || now.getTime() - t > days * 86_400_000
    })
    .map(f => f.name)
