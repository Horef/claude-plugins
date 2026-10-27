import type { Effort, HistoryEntry, Model, Settings, Step, Tier, Usage } from '../types'
import { EFFORTS, LADDER, MODELS, PRICES, SETUP_HEAVY, TIER_ORDER } from './tiers'

// Pure helpers: no engine, no state. The hooks module owns everything that touches `$`.

export const VERSION = '0.8.3'
export const PANE = 'model-router'
export const PLAN_TOOL = 'mcp__model-router__plan'
export const STEP_TAG = /^\s*\[([^\]]+)\]/
export const SKILL_TAG = 'skill:'

export const EMPTY_USAGE: Usage = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }

export const STATUS_GLYPH: Record<Step['status'], string> = { planned: '○', running: '◐', done: '●' }

// --- Models, prices, the ladder ---------------------------------------------

export const modelOf = (id: string | undefined): Model | undefined => MODELS.find(m => id?.includes(m))

export const costOf = (u: Usage, model: Model | undefined) => {
  const p = PRICES[model ?? 'opus']
  return (u.input * p.input + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead + u.output * p.output) / 1e6
}

export const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  cacheRead: a.cacheRead + b.cacheRead,
  output: a.output + b.output,
})

export const isSetupHeavy = (u: Usage) =>
  u.output < SETUP_HEAVY.maxOutput && u.input + u.cacheWrite + u.cacheRead > SETUP_HEAVY.minRead

type Rung = { model: Model; effort: Effort }

const rank = (r: Rung) => MODELS.indexOf(r.model) * 10 + EFFORTS.indexOf(r.effort)

/** The rung above where a step runs now, or undefined at the top. */
export const nextRung = (r: Rung) => LADDER.find(x => rank(x) > rank(r))

/** The rung below, for a tier that never needed a rerun. */
export const prevRung = (r: Rung) => [...LADDER].reverse().find(x => rank(x) < rank(r))

export const rungLabel = (r: Rung) => `${r.model}/${r.effort}`

export const runsOn = (s: Step, set: Settings): Rung => ({
  model: s.model ?? set.tiers[s.tier].model,
  effort: s.effort ?? set.tiers[s.tier].effort,
})

// --- Plan ---------------------------------------------------------------------

export const newStep = (id: string, title: string, tier: Tier, where: Step['where']): Step => ({
  id,
  title,
  tier,
  where,
  status: 'planned',
  usage: EMPTY_USAGE,
  cost: 0,
  mainCost: 0,
  reruns: 0,
})

export const isTier = (v: unknown): v is Tier => TIER_ORDER.includes(v as Tier)

export const planText = (list: readonly Step[], set: Settings) =>
  list
    .map(s => `[${s.id}] ${s.title}: ${s.tier}, ${s.where === 'here' ? 'here' : rungLabel(runsOn(s, set))}, ${s.status}`)
    .join('\n')

// --- What the history says ------------------------------------------------------

export type RungStats = { label: string; n: number; reruns: number; avgCost: number; setupHeavy: number }

export const rungStats = (h: readonly HistoryEntry[]): RungStats[] => {
  const by = new Map<string, HistoryEntry[]>()
  for (const x of h) by.set(rungLabel(x), [...(by.get(rungLabel(x)) ?? []), x])
  return [...by.entries()].map(([label, xs]) => ({
    label,
    n: xs.length,
    reruns: xs.filter(x => x.rerun).length,
    avgCost: xs.reduce((n, x) => n + x.cost, 0) / xs.length,
    setupHeavy: xs.filter(x => x.setupHeavy).length,
  }))
}

export type Suggestion = { tier: Tier; to: Rung; why: string; isRaise: boolean }

/** Tier defaults the history argues for: up when reruns are common, down when there were none. */
export const suggestions = (h: readonly HistoryEntry[], set: Settings): Suggestion[] =>
  TIER_ORDER.flatMap(tier => {
    const now = set.tiers[tier]
    const xs = h.filter(x => x.tier === tier && x.model === now.model && x.effort === now.effort)
    const reruns = xs.filter(x => x.rerun).length
    const up = nextRung(now)
    const down = prevRung(now)
    if (xs.length >= 4 && reruns / xs.length >= 0.3 && up) {
      return [{ tier, to: up, isRaise: true, why: `${reruns} of ${xs.length} ${tier} steps on ${rungLabel(now)} needed a rerun` }]
    }
    if (xs.length >= 10 && reruns === 0 && down) {
      return [{ tier, to: down, isRaise: false, why: `none of ${xs.length} ${tier} steps on ${rungLabel(now)} needed a rerun` }]
    }
    return []
  })

// --- The main chat's model ------------------------------------------------------

/** A hint to run this chat on a cheaper model when the plan has no deep step. */
export const modelHint = (list: readonly Step[], mainModel: Model | undefined) => {
  if (!mainModel || list.length === 0 || list.some(s => s.tier === 'deep')) return undefined
  if (mainModel !== 'opus' && mainModel !== 'fable') return undefined
  const ratio = PRICES.sonnet.output / PRICES[mainModel].output

  return `No step in this plan is deep: Sonnet could run this chat for about ${Math.round(ratio * 100)}% of the cost. Switch it in the model menu if the conversation itself is routine.`
}

// --- Text -------------------------------------------------------------------

export const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : `${n}`)

export const fmtUsd = (n: number) =>
  n === 0 ? '$0' : n < 0.01 ? `$${n.toFixed(4)}` : n < 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(0)}`
