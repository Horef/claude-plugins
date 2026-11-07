// Pure helpers for model-router: prices, the escalation ladder, history statistics, text formatting.
import type { Effort, HelperTotals, HelperUsage, HistoryEntry, Model, PlanNode, Settings, Step, StepKnown, Tier, Usage, Where } from '../types'
import { DEFAULT_SETTINGS, EFFORTS, FUSION, LADDER, MODELS, PRICES, SETUP_HEAVY, TIER_ORDER } from './tiers'

// Pure helpers: no engine, no state. The hooks module owns everything that touches `$`.

export const VERSION = '0.17.0'
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

/** A tier's helper templates in the order they are tried, e.g. "kiro-deep → copilot-deep". */
export const helperOrder = (set: Settings, tier: Tier) => helperList(set, tier).join(' → ')

/** A tier's helper templates in order, with Copilot Fusion added when its setting covers the tier. */
export const helperList = (set: Settings, tier: Tier): string[] => {
  const list = set.helpers.tiers[tier]
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
  const f = FUSION[tier]
  const on = set.helpers.fusion === 'both' || (set.helpers.fusion === 'deep' && tier === 'deep')
  if (!f || !on || list.includes(f.template)) return list
  const at = list.indexOf(f.before)
  return at < 0 ? [...list, f.template] : [...list.slice(0, at), f.template, ...list.slice(at)]
}

const parseList = (v: string) =>
  v
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)

/** A tier's helpers as stored, in order, without Copilot Fusion (its own setting adds that). */
export const helperItems = (set: Settings, tier: Tier) => parseList(set.helpers.tiers[tier])

/** The default helper templates of a tier that are switched off now, offered back in the pane. */
export const helpersOff = (set: Settings, tier: Tier) => {
  const on = helperItems(set, tier)
  return parseList(DEFAULT_SETTINGS.helpers.tiers[tier]).filter(x => !on.includes(x))
}

/** The stored string after moving the helper at `index` one place (-1 up, 1 down); unchanged at an end. */
export const moveHelper = (list: readonly string[], index: number, by: -1 | 1) => {
  const to = index + by
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list.join(',')
  const next = [...list]
  ;[next[index], next[to]] = [next[to]!, next[index]!]

  return next.join(',')
}

/** One string for every tier's helper order, to tell whether the orders the agent knows are still current. */
export const helperSignature = (set: Settings) => TIER_ORDER.map(t => `${t}: ${helperList(set, t).join(',')}`).join('; ')

/** Settings as stored, which may be missing parts that older versions did not have, filled from the defaults. */
export const mergeSettings = (stored: Partial<Settings> | undefined): Settings => ({
  tiers: { ...DEFAULT_SETTINGS.tiers, ...(stored?.tiers ?? {}) },
  skills: { ...(stored?.skills ?? {}) },
  openPane: stored?.openPane ?? DEFAULT_SETTINGS.openPane,
  compact: stored?.compact ?? DEFAULT_SETTINGS.compact,
  helpers: {
    ...DEFAULT_SETTINGS.helpers,
    ...(stored?.helpers ?? {}),
    tiers: { ...DEFAULT_SETTINGS.helpers.tiers, ...(stored?.helpers?.tiers ?? {}) },
  },
  hereEffort: { ...DEFAULT_SETTINGS.hereEffort, ...(stored?.hereEffort ?? {}) },
})

// --- What the agent knows of each step ----------------------------------------------

/** What a step stands at now, as the agent would be told it. */
export const knownOf = (s: Step, set: Settings): StepKnown => ({ where: s.where, tier: s.tier, ...runsOn(s, set) })

const WHERE_LABEL: Record<Step['where'], string> = { agent: 'subagent', here: 'here', helper: 'helper' }

/** The fields of a step that differ from what the agent was last told. Model and effort count only for a subagent step. */
export const knownChanges = (was: StepKnown, now: StepKnown): string[] => {
  const out: string[] = []
  if (was.where !== now.where) out.push(`runs ${WHERE_LABEL[was.where]} → ${WHERE_LABEL[now.where]}`)
  if (was.tier !== now.tier) out.push(`tier ${was.tier} → ${now.tier}`)
  if (now.where === 'agent') {
    if (was.model !== now.model) out.push(`model ${was.model} → ${now.model}`)
    if (was.effort !== now.effort) out.push(`thinking ${was.effort} → ${now.effort}`)
  }

  return out
}

/** The note for one step whose settings the user changed since the agent was last told. */
export const stepChangeNote = (s: Step, was: StepKnown, now: StepKnown) => {
  const changes = knownChanges(was, now)
  if (changes.length === 0) return undefined
  const rung = now.where === 'agent' ? ` It now runs on ${rungLabel(now)}.` : ''

  return `The user changed step [${s.id}] "${s.title}" in the pane: ${changes.join('; ')}.${rung} Use the new values from now on.`
}

// A here step's tier cannot change this chat's model or thinking; it rates the step and is
// the default if the step is sent to a subagent. It matters here only when it asks for more
// than this chat's model.
const RANK: Record<Model, number> = { haiku: 0, sonnet: 1, opus: 2, fable: 3 }

/** The tier's model when a here step is rated above this chat's model, else undefined. */
export const hereNeeds = (s: Step, set: Settings, mainModel: Model | undefined): Model | undefined => {
  if (s.where !== 'here' || !mainModel) return undefined
  const want = set.tiers[s.tier].model
  return RANK[want] > RANK[mainModel] ? want : undefined
}

const placeOf = (s: Step, set: Settings, mainModel?: Model) => {
  if (s.where === 'here') {
    const want = hereNeeds(s, set, mainModel)
    return want ? `here (rated for ${want}, this chat runs ${mainModel}: consider a subagent)` : 'here'
  }
  if (s.where === 'helper') return `helper (${s.helper ? helperName(s) : helperOrder(set, s.tier)})`

  return rungLabel(runsOn(s, set))
}

/** The plan as the agent reads it: one line a step, parts indented under their group. */
export const planText = (list: readonly Step[], set: Settings, mainModel?: Model) =>
  list
    .map(s => {
      const indent = '  '.repeat(depthOf(list, s))
      if (s.group) {
        const r = rollupOf(list, s)

        return `${indent}[${s.id}] ${s.title}: ${s.tier} (rates the group), ${r.done} of ${r.total} parts done, ${s.status}`
      }
      const parallel = s.count && s.count > 1 ? `, ×${s.count} in parallel` : ''
      const status = s.count && s.count > 1 && s.status === 'running' && (s.runs ?? 0) > 0 ? `running (${s.runs} of ${s.count} finished)` : s.status

      return `${indent}[${s.id}] ${s.title}: ${s.tier}, ${placeOf(s, set, mainModel)}${parallel}, ${status}`
    })
    .join('\n')

// --- Parts: steps inside steps ------------------------------------------------------

/** The steps that are parts of step `id`, at any depth. */
export const descendantsOf = (list: readonly Step[], id: string): Step[] =>
  list.filter(s => s.parent === id).flatMap(c => [c, ...descendantsOf(list, c.id)])

/** How many levels below the top a step sits. */
export const depthOf = (list: readonly Step[], s: Step) => {
  let depth = 0
  for (let p = s.parent; p && depth < 20; depth += 1) p = list.find(x => x.id === p)?.parent

  return depth
}

/** The steps that do the work: all of them except groups. */
export const leavesOf = (list: readonly Step[]) => list.filter(s => !s.group)

/** A group's parts counted, and its cost and tokens as the sum of its parts. */
export const rollupOf = (list: readonly Step[], g: Step) => {
  const all = [g, ...descendantsOf(list, g.id)]
  const leaves = leavesOf(all)

  return {
    total: leaves.length,
    done: leaves.filter(x => x.status === 'done').length,
    cost: all.reduce((n, x) => n + x.cost, 0),
    mainCost: all.reduce((n, x) => n + x.mainCost, 0),
    usage: all.reduce((u, x) => addUsage(u, x.usage), EMPTY_USAGE),
    helper: helperTotalsOf(all),
  }
}

/** Every group's status from its parts: done when all are, planned when none has started, else running. */
export const settleGroups = (list: Step[]): Step[] => {
  const groups = list.filter(s => s.group).sort((a, b) => depthOf(list, b) - depthOf(list, a))
  const status = new Map(list.map(s => [s.id, s.status]))
  for (const g of groups) {
    const kids = list.filter(s => s.parent === g.id).map(s => status.get(s.id)!)
    if (kids.length === 0) continue
    status.set(g.id, kids.every(k => k === 'done') ? 'done' : kids.every(k => k === 'planned') ? 'planned' : 'running')
  }

  return list.map(s => (status.get(s.id) === s.status ? s : { ...s, status: status.get(s.id)! }))
}

/** The ids a plan call names, expanded: a group stands for every part under it. */
export const expandIds = (list: readonly Step[], ids: readonly string[]) =>
  new Set(ids.flatMap(id => (list.some(s => s.id === id) ? [id, ...descendantsOf(list, id).map(s => s.id)] : [])))

/** The plan tool's steps as a flat list in reading order, parts after their parent, with hierarchical ids. */
export const flattenPlan = (nodes: readonly PlanNode[]) => {
  const out: { id: string; title: string; tier: Tier; where: Where; parent?: string; group: boolean; count?: number }[] = []
  const dropped: string[] = []
  const seen = new Set<string>()
  const walk = (list: readonly PlanNode[], up?: { id: string; tier: Tier }) => {
    for (const n of list) {
      // A part's id extends its parent's: "a" under s3 is s3.a.
      const id = up && !n.id.startsWith(`${up.id}.`) ? `${up.id}.${n.id}` : n.id
      if (seen.has(id)) {
        dropped.push(id)
        continue
      }
      seen.add(id)
      const tier = isTier(n.tier) ? n.tier : (up?.tier ?? 'standard')
      const parts = Array.isArray(n.parts) ? n.parts : []
      const count = !parts.length && typeof n.count === 'number' && n.count >= 2 ? Math.floor(n.count) : undefined
      out.push({ id, title: n.title, tier, where: n.where ?? 'agent', ...(up ? { parent: up.id } : {}), group: parts.length > 0, ...(count ? { count } : {}) })
      if (parts.length) walk(parts, { id, tier })
    }
  }
  walk(nodes)

  return { steps: out, dropped }
}

// --- Helper steps: which helper, how long, what it used ---------------------------------

export const EMPTY_HELPER: HelperTotals = { steps: 0, ms: 0, usage: [] }

/** A step run by a helper: planned as one, or reported with a helper when started. */
export const isHelperRun = (s: Step) => s.where === 'helper' || !!s.helper

/** The helper a step runs on, as its card shows it: "copilot-standard · Claude Sonnet 5.5". */
export const helperName = (s: Step) => (s.helper ? `${s.helper}${s.helperModel ? ` · ${s.helperModel}` : ''}` : '')

/** A usage report from the plan tool, if it is one: provider, a number and a unit. */
export const asHelperUsage = (v: unknown): HelperUsage | undefined => {
  const u = v as { provider?: unknown; amount?: unknown; unit?: unknown } | null | undefined
  const amount = typeof u?.amount === 'string' ? Number(u.amount) : u?.amount
  if (typeof u?.provider !== 'string' || typeof u.unit !== 'string' || typeof amount !== 'number') return undefined
  const provider = u.provider.trim().toLowerCase()
  const unit = u.unit.trim()

  return provider && unit && Number.isFinite(amount) && amount >= 0 ? { provider, amount, unit } : undefined
}

export const addHelperUsage = (list: readonly HelperUsage[], u: HelperUsage): HelperUsage[] => {
  const at = list.findIndex(x => x.provider === u.provider && x.unit === u.unit)
  if (at < 0) return [...list, u]

  return list.map((x, i) => (i === at ? { ...x, amount: x.amount + u.amount } : x))
}

export const addHelperTotals = (a: HelperTotals | undefined, b: HelperTotals): HelperTotals => ({
  steps: (a?.steps ?? 0) + b.steps,
  ms: (a?.ms ?? 0) + b.ms,
  usage: b.usage.reduce(addHelperUsage, a?.usage ?? []),
})

const spanOf = (s: Step) => {
  const ms = s.startedAt && s.endedAt ? Date.parse(s.endedAt) - Date.parse(s.startedAt) : 0

  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

/** What the finished helper steps in a list moved off Claude. A group's own usage counts, its steps do not. */
export const helperTotalsOf = (list: readonly Step[]): HelperTotals => {
  const run = leavesOf(list).filter(s => isHelperRun(s) && s.status === 'done')

  return {
    steps: run.length,
    ms: run.reduce((n, s) => n + spanOf(s), 0),
    usage: list.flatMap(s => (s.helperUsage ? [s.helperUsage] : [])).reduce(addHelperUsage, [] as HelperUsage[]),
  }
}

/** What changed between two states of a plan: helper steps newly done, and usage newly reported. */
export const helperGain = (before: readonly Step[], after: readonly Step[]): HelperTotals => {
  let gain = EMPTY_HELPER
  for (const s of after) {
    const was = before.find(x => x.id === s.id)
    if (!s.group && isHelperRun(s) && s.status === 'done' && was?.status !== 'done') {
      gain = addHelperTotals(gain, { steps: 1, ms: spanOf(s), usage: [] })
    }
    if (s.helperUsage && !was?.helperUsage) gain = addHelperTotals(gain, { steps: 0, ms: 0, usage: [s.helperUsage] })
  }

  return gain
}

export const fmtMin = (ms: number) => {
  const m = Math.round(ms / 60000)

  return m < 1 ? '<1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

export const fmtAmount = (n: number) => `${Number(n.toFixed(2))}`

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)

/** "Copilot 30 AIC": one provider's usage in its own unit. */
export const usageLabel = (u: HelperUsage) => `${cap(u.provider)} ${fmtAmount(u.amount)} ${u.unit}`

/** The one-line account of what was moved off Claude, or undefined when nothing was. */
export const helperLine = (h: HelperTotals | undefined) => {
  if (!h || (h.steps === 0 && h.usage.length === 0)) return undefined
  const usage = [...h.usage].sort((a, b) => a.provider.localeCompare(b.provider) || a.unit.localeCompare(b.unit))
  const head = `${h.steps} helper step${h.steps === 1 ? '' : 's'}${h.ms > 0 ? `, ${fmtMin(h.ms)}` : ''}`

  return `Moved off Claude: ${[head, ...usage.map(usageLabel)].join('; ')}`
}

/** A helper step's usage and time for its card: "30.04 AIC · 12 min", or when it started while it runs. */
export const helperFacts = (s: Step) => {
  const parts: string[] = []
  if (s.helperUsage) parts.push(`${fmtAmount(s.helperUsage.amount)} ${s.helperUsage.unit}`)
  if (spanOf(s) > 0) parts.push(fmtMin(spanOf(s)))
  else if (s.startedAt && s.status !== 'done') {
    parts.push(`started ${new Date(s.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`)
  }

  return parts.join(' · ')
}

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
