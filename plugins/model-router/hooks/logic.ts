// Pure helpers for model-router: prices, the escalation ladder, history statistics, text formatting.
import type { Effort, HelperTotals, HelperUsage, HistoryEntry, Model, PlanNode, Price, Rung, Settings, Step, StepKnown, Tier, Usage, Verdict, Where } from '../types'
import { DEFAULT_SETTINGS, EFFORTS, FUSION, LADDER, LEARN, MODELS, NEW_MODEL_RUNGS, PRICES, SETUP_HEAVY, TIER_ORDER } from './tiers'

// Pure helpers: no engine, no state. The hooks module owns everything that touches `$`.

export const VERSION = '0.18.0'
export const PANE = 'model-router'
export const PLAN_TOOL = 'mcp__model-router__plan'
export const STEP_TAG = /^\s*\[([^\]]+)\]/
export const SKILL_TAG = 'skill:'

export const EMPTY_USAGE: Usage = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }

export const STATUS_GLYPH: Record<Step['status'], string> = { planned: '○', running: '◐', done: '●' }

// --- Models, prices, the ladder ---------------------------------------------

/** Every model the router knows: the defaults, then those seen in usage or added in Settings. */
export const knownModels = (set?: Pick<Settings, 'models'>): Model[] => [...new Set([...MODELS, ...(set?.models ?? [])])]

// What a model id looks like; anything else ("<synthetic>", an empty string) is not a model.
const MODEL_ID = /^[a-z0-9][a-z0-9._:/-]{0,79}$/i

/** The family alias a model id belongs to ("claude-haiku-5-5" is haiku); an unknown family is kept under its id. */
export const modelOf = (id: string | undefined, set?: Pick<Settings, 'models'>): Model | undefined => {
  if (!id) return undefined
  const known = knownModels(set).find(m => id.includes(m))
  if (known) return known

  return MODEL_ID.test(id) ? id : undefined
}

/** A model's price: the one set in Settings, else the default table; undefined when it has none. */
export const priceOf = (model: Model, set?: Pick<Settings, 'prices'>): Price | undefined => set?.prices?.[model] ?? PRICES[model]

/** Dollars for some tokens on a model, or undefined when the model has no price. No model: Opus's price, as before. */
export const costOf = (u: Usage, model: Model | undefined, set?: Pick<Settings, 'prices'>): number | undefined => {
  const p = priceOf(model ?? 'opus', set)
  if (!p) return undefined

  return (u.input * p.input + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead + u.output * p.output) / 1e6
}

/** "2 15" (input, output; cache write 1.25x and read 0.1x input) or "2 2.5 0.2 15", in dollars per million tokens. */
export const parsePrice = (v: string): Price | undefined => {
  const n = v
    .split(/[\s,/;]+/)
    .filter(Boolean)
    .map(x => Number(x.replace(/^\$/, '')))
  if (!n.every(x => Number.isFinite(x) && x >= 0)) return undefined
  if (n.length === 2) return { input: n[0]!, cacheWrite: n[0]! * 1.25, cacheRead: n[0]! * 0.1, output: n[1]! }
  if (n.length === 4) return { input: n[0]!, cacheWrite: n[1]!, cacheRead: n[2]!, output: n[3]! }

  return undefined
}

/** The known models that have a price, cheapest first (by output price, then input). */
export const modelOrder = (set?: Pick<Settings, 'models' | 'prices'>): Model[] =>
  knownModels(set)
    .filter(m => priceOf(m, set))
    .sort((a, b) => priceOf(a, set)!.output - priceOf(b, set)!.output || priceOf(a, set)!.input - priceOf(b, set)!.input)

// The default ladder's thinking levels per model, so with only the defaults known the ladder is LADDER.
const DEFAULT_RUNGS = LADDER.reduce<Record<string, Effort[]>>((by, r) => ({ ...by, [r.model]: [...(by[r.model] ?? []), r.effort] }), {})

/** The escalation ladder from the known models, by price: each default keeps its rungs, a new model gets medium and high. */
export const ladderOf = (set?: Pick<Settings, 'models' | 'prices'>): Rung[] =>
  modelOrder(set).flatMap(model => (DEFAULT_RUNGS[model] ?? NEW_MODEL_RUNGS).map(effort => ({ model, effort })))

export const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  cacheRead: a.cacheRead + b.cacheRead,
  output: a.output + b.output,
})

export const isSetupHeavy = (u: Usage) =>
  u.output < SETUP_HEAVY.maxOutput && u.input + u.cacheWrite + u.cacheRead > SETUP_HEAVY.minRead

type Ladder = Pick<Settings, 'models' | 'prices'>

/** Where a rung sits: by its model's price, then its thinking level; undefined for a model with no price. */
const rank = (r: Rung, set?: Ladder) => {
  const at = modelOrder(set).indexOf(r.model)

  return at < 0 ? undefined : at * 10 + EFFORTS.indexOf(r.effort)
}

/** The rung above where a step runs now, or undefined at the top (or on a model with no price). */
export const nextRung = (r: Rung, set?: Ladder) => {
  const at = rank(r, set)

  return at === undefined ? undefined : ladderOf(set).find(x => rank(x, set)! > at)
}

/** The rung below, for a tier or kind that runs above what it needs. */
export const prevRung = (r: Rung, set?: Ladder) => {
  const at = rank(r, set)

  return at === undefined ? undefined : [...ladderOf(set)].reverse().find(x => rank(x, set)! < at)
}

export const rungLabel = (r: Rung) => `${r.model}/${r.effort}`

/** Per kind, the rung auto mode runs it on, and from how many runs that was learned. */
export type Learned = Record<string, { rung: Rung; n: number }>

/** Where a step's rung comes from before the user's own picks: auto mode's learned rung, the kind's default, or the tier. */
export const baseRung = (s: Step, set: Settings, learned?: Learned): Rung & { source: 'tier' | 'kind' | 'auto'; n?: number } => {
  const auto = s.kind ? learned?.[s.kind] : undefined
  if (auto) return { ...auto.rung, source: 'auto', n: auto.n }
  const own = s.kind ? set.kinds?.[s.kind] : undefined
  if (own) return { model: own.model, effort: own.effort, source: 'kind' }

  return { model: set.tiers[s.tier].model, effort: set.tiers[s.tier].effort, source: 'tier' }
}

/** The rung a step runs on: the user's picks on the step win, then auto mode, the kind's default, the tier. */
export const runsOn = (s: Step, set: Settings, learned?: Learned): Rung => {
  const base = baseRung(s, set, learned)

  return { model: s.model ?? base.model, effort: s.effort ?? base.effort }
}

/** A kind label as stored: lower case letters, digits and hyphens, short (it ends up in a shell command, see genomeNote). */
export const normKind = (v: unknown) => {
  if (typeof v !== 'string') return undefined
  const k = v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 40)

  return k || undefined
}

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
  kinds: { ...(stored?.kinds && typeof stored.kinds === 'object' ? stored.kinds : {}) },
  autoRoute: stored?.autoRoute === true,
  models: Array.isArray(stored?.models) ? stored.models.filter(m => typeof m === 'string' && !MODELS.includes(m)) : [],
  prices: { ...(stored?.prices && typeof stored.prices === 'object' ? stored.prices : {}) },
})

// --- What the agent knows of each step ----------------------------------------------

/** What a step stands at now, as the agent would be told it. */
export const knownOf = (s: Step, set: Settings, learned?: Learned): StepKnown => ({ where: s.where, tier: s.tier, ...runsOn(s, set, learned) })

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
// than this chat's model, which is judged by price.

/** The tier's model when a here step is rated above this chat's model, else undefined. */
export const hereNeeds = (s: Step, set: Settings, mainModel: Model | undefined): Model | undefined => {
  if (s.where !== 'here' || !mainModel) return undefined
  const want = set.tiers[s.tier].model
  const order = modelOrder(set)
  const [a, b] = [order.indexOf(want), order.indexOf(mainModel)]
  return a >= 0 && b >= 0 && a > b ? want : undefined
}

/** How a subagent step's rung came about, when it is not simply its tier's: auto mode, or its kind's default. */
export const rungSource = (s: Step, set: Settings, learned?: Learned) => {
  if (s.model && s.effort) return undefined
  const base = baseRung(s, set, learned)
  if (base.source === 'auto') return `auto: learned, ${base.n} runs`
  if (base.source === 'kind') return `${s.kind} default`

  return undefined
}

const placeOf = (s: Step, set: Settings, mainModel?: Model, learned?: Learned) => {
  if (s.where === 'here') {
    const want = hereNeeds(s, set, mainModel)
    return want ? `here (rated for ${want}, this chat runs ${mainModel}: consider a subagent)` : 'here'
  }
  if (s.where === 'helper') return `helper (${s.helper ? helperName(s) : helperOrder(set, s.tier)})`
  const why = rungSource(s, set, learned)

  return `${rungLabel(runsOn(s, set, learned))}${why ? ` (${why})` : ''}`
}

/** The plan as the agent reads it: one line a step, parts indented under their group. */
export const planText = (list: readonly Step[], set: Settings, mainModel?: Model, learned?: Learned) =>
  list
    .map(s => {
      const indent = '  '.repeat(depthOf(list, s))
      if (s.group) {
        const r = rollupOf(list, s)

        return `${indent}[${s.id}] ${s.title}: ${s.tier} (rates the group), ${r.done} of ${r.total} parts done, ${s.status}`
      }
      const parallel = s.count && s.count > 1 ? `, ×${s.count} in parallel` : ''
      const kind = s.kind ? `, kind ${s.kind}` : ''
      const status = s.count && s.count > 1 && s.status === 'running' && (s.runs ?? 0) > 0 ? `running (${s.runs} of ${s.count} finished)` : s.status
      const verdict = s.verdict ? ` (verdict ${s.verdict})` : ''

      return `${indent}[${s.id}] ${s.title}: ${s.tier}, ${placeOf(s, set, mainModel, learned)}${parallel}${kind}, ${status}${verdict}`
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
  const out: { id: string; title: string; tier: Tier; where: Where; parent?: string; group: boolean; count?: number; kind?: string }[] = []
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
      const kind = parts.length ? undefined : normKind(n.kind)
      out.push({ id, title: n.title, tier, where: n.where ?? 'agent', ...(up ? { parent: up.id } : {}), group: parts.length > 0, ...(count ? { count } : {}), ...(kind ? { kind } : {}) })
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

/** How long a step ran, from its start to when it was marked done (helper steps), in ms; 0 when unknown. */
export const runSpan = (s: Step) => {
  const ms = s.startedAt && s.endedAt ? Date.parse(s.endedAt) - Date.parse(s.startedAt) : 0

  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

/** What the finished helper steps in a list moved off Claude. A group's own usage counts, its steps do not. */
export const helperTotalsOf = (list: readonly Step[]): HelperTotals => {
  const run = leavesOf(list).filter(s => isHelperRun(s) && s.status === 'done')

  return {
    steps: run.length,
    ms: run.reduce((n, s) => n + runSpan(s), 0),
    usage: list.flatMap(s => (s.helperUsage ? [s.helperUsage] : [])).reduce(addHelperUsage, [] as HelperUsage[]),
  }
}

/** What changed between two states of a plan: helper steps newly done, and usage newly reported. */
export const helperGain = (before: readonly Step[], after: readonly Step[]): HelperTotals => {
  let gain = EMPTY_HELPER
  for (const s of after) {
    const was = before.find(x => x.id === s.id)
    if (!s.group && isHelperRun(s) && s.status === 'done' && was?.status !== 'done') {
      gain = addHelperTotals(gain, { steps: 1, ms: runSpan(s), usage: [] })
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
  if (runSpan(s) > 0) parts.push(fmtMin(runSpan(s)))
  else if (s.startedAt && s.status !== 'done') {
    parts.push(`started ${new Date(s.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`)
  }

  return parts.join(' · ')
}

// --- What the history says ------------------------------------------------------

/** A verdict from the plan tool, if it is one. */
export const asVerdict = (v: unknown): Verdict | undefined => {
  const x = typeof v === 'string' ? v.trim().toLowerCase() : ''

  return x === 'ok' || x === 'weak' || x === 'overkill' ? x : undefined
}

/** A step the router or a helper ran for the lead, which needs a verdict when it is done: not a group, not a here step. */
export const isDelegated = (s: Step) => !s.group && (s.where === 'agent' || isHelperRun(s))

const isAgentRun = (x: HistoryEntry) => (x.where ?? 'agent') === 'agent' && !!x.model && !!x.effort

/** The rung a run ran on: model/effort, or the helper template. */
export const entryRung = (x: HistoryEntry) => (x.where === 'helper' ? (x.helper ?? 'helper') : `${x.model}/${x.effort}`)

// Facts weigh at least as much as verdicts: a rerun makes a run weak whatever its verdict said.
const isWeak = (x: HistoryEntry) => x.rerun || x.verdict === 'weak'
const isOk = (x: HistoryEntry) => !x.rerun && x.verdict === 'ok'
const isOverkill = (x: HistoryEntry) => !x.rerun && x.verdict === 'overkill'

export type VerdictCounts = { ok: number; weak: number; overkill: number; none: number }

const countVerdicts = (xs: readonly HistoryEntry[]): VerdictCounts => ({
  ok: xs.filter(x => x.verdict === 'ok').length,
  weak: xs.filter(x => x.verdict === 'weak').length,
  overkill: xs.filter(x => x.verdict === 'overkill').length,
  none: xs.filter(x => !x.verdict).length,
})

/** "2 ok, 1 weak, 1 no verdict", leaving out what is zero. */
export const verdictLine = (c: VerdictCounts) =>
  [
    c.ok ? `${c.ok} ok` : '',
    c.weak ? `${c.weak} weak` : '',
    c.overkill ? `${c.overkill} overkill` : '',
    c.none ? `${c.none} no verdict` : '',
  ]
    .filter(Boolean)
    .join(', ')

export type RungStats = { label: string; n: number; reruns: number; avgCost: number; setupHeavy: number; isHelper: boolean; verdicts: VerdictCounts }

export const rungStats = (h: readonly HistoryEntry[]): RungStats[] => {
  const by = new Map<string, HistoryEntry[]>()
  for (const x of h) by.set(entryRung(x), [...(by.get(entryRung(x)) ?? []), x])
  return [...by.entries()].map(([label, xs]) => ({
    label,
    n: xs.length,
    reruns: xs.filter(x => x.rerun).length,
    avgCost: xs.reduce((n, x) => n + x.cost, 0) / xs.length,
    setupHeavy: xs.filter(x => x.setupHeavy).length,
    isHelper: xs.every(x => x.where === 'helper'),
    verdicts: countVerdicts(xs),
  }))
}

/** The kinds the history has seen, most used first. */
export const kindsOf = (h: readonly HistoryEntry[], cap = 30) => {
  const n = new Map<string, number>()
  for (const x of h) if (x.kind) n.set(x.kind, (n.get(x.kind) ?? 0) + 1)

  return [...n.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap)
    .map(([k]) => k)
}

export type KindStats = { kind: string; n: number; reruns: number; verdicts: VerdictCounts }

export const kindStats = (h: readonly HistoryEntry[]): KindStats[] =>
  kindsOf(h).map(kind => {
    const xs = h.filter(x => x.kind === kind)

    return { kind, n: xs.length, reruns: xs.filter(x => x.rerun).length, verdicts: countVerdicts(xs) }
  })

/** One piece of advice: a kind (or, for runs with no kind, a tier) to move one rung, with its evidence. */
export type Suggestion = { tier?: Tier; kind?: string; from: Rung; to: Rung; why: string; isRaise: boolean }

const sameRung = (x: HistoryEntry, r: Rung) => x.model === r.model && x.effort === r.effort

/** Up when at least half the runs were weak (a weak verdict or a rerun); down when at least half were overkill and none of the last few was weak. */
const judge = (xs: readonly HistoryEntry[], from: Rung, label: string, set: Settings) => {
  if (xs.length < LEARN.minRuns) return undefined
  const weak = xs.filter(isWeak).length
  const over = xs.filter(isOverkill).length
  const up = nextRung(from, set)
  const down = prevRung(from, set)
  if (weak / xs.length >= LEARN.weakShare && up) return { to: up, isRaise: true, why: `${label}: ${weak} of ${xs.length} weak` }
  const recent = [...xs].sort((a, b) => a.at.localeCompare(b.at)).slice(-LEARN.recent)
  if (over / xs.length >= LEARN.overkillShare && !recent.some(isWeak) && down) {
    return { to: down, isRaise: false, why: `${label}: ${over} of ${xs.length} overkill` }
  }
  return undefined
}

/** What the history argues for: per kind on the rung it runs on now, and per tier for runs with no kind. Subagent runs only. */
export const suggestions = (h: readonly HistoryEntry[], set: Settings): Suggestion[] => {
  const runs = h.filter(isAgentRun)
  const byTier = TIER_ORDER.flatMap(tier => {
    const now = set.tiers[tier]
    const j = judge(runs.filter(x => !x.kind && x.tier === tier && sameRung(x, now)), now, `${tier} steps on ${rungLabel(now)}`, set)
    return j ? [{ tier, from: { model: now.model, effort: now.effort }, ...j }] : []
  })
  const byKind = kindsOf(runs, Infinity).flatMap(kind => {
    const own = set.kinds?.[kind]
    const mine = runs.filter(x => x.kind === kind)
    // With a default of its own the kind is judged on that rung; else on each tier's rung, the busiest first.
    const groups = own
      ? [{ xs: mine.filter(x => sameRung(x, own)), from: own, label: `${kind} on ${rungLabel(own)}`, tier: undefined as Tier | undefined }]
      : TIER_ORDER.map(t => ({ xs: mine.filter(x => x.tier === t && sameRung(x, set.tiers[t])), from: set.tiers[t] as Rung, label: `${kind} on ${t}`, tier: t as Tier | undefined })).sort(
          (a, b) => b.xs.length - a.xs.length,
        )
    for (const g of groups) {
      const j = judge(g.xs, g.from, g.label, set)
      if (j) return [{ kind, ...(g.tier ? { tier: g.tier } : {}), from: { model: g.from.model, effort: g.from.effort }, ...j }]
    }
    return []
  })

  return [...byTier, ...byKind]
}

/** Auto mode: per kind, the cheapest rung that did it well (ok in at least 80% of at least 3 runs there). */
export const learnedRungs = (h: readonly HistoryEntry[], set: Settings): Learned => {
  const out: Learned = {}
  const runs = h.filter(isAgentRun)
  for (const kind of kindsOf(runs, Infinity)) {
    const by = new Map<string, HistoryEntry[]>()
    for (const x of runs.filter(r => r.kind === kind)) by.set(entryRung(x), [...(by.get(entryRung(x)) ?? []), x])
    const good = [...by.values()]
      .filter(xs => xs.length >= LEARN.minRuns && xs.filter(isOk).length / xs.length >= LEARN.autoOkShare)
      .map(xs => ({ rung: { model: xs[0]!.model!, effort: xs[0]!.effort! }, n: xs.length }))
      .filter(g => rank(g.rung, set) !== undefined)
      .sort((a, b) => rank(a.rung, set)! - rank(b.rung, set)!)
    if (good[0]) out[kind] = good[0]
  }

  return out
}

/** The strange-loop observation the lead is asked to record when a kind's advice first reaches its threshold. */
export const genomeNote = (a: Suggestion, unit: string) => {
  const what = `model-router's history says ${a.why}; it suggests ${a.isRaise ? 'raising' : 'lowering'} ${a.kind} to ${rungLabel(a.to)}`

  return `Advice for kind "${a.kind}" reached its threshold (${a.why}). Record it once as a strange-loop observation: python3 "$(cat ~/.config/strange-loop/genome)/plugins/strange-loop/skills/strange-loop/scripts/loop.py" note ${unit} ${a.isRaise ? 'friction' : 'wish'} "routing: ${what}" --harness claude-code --context "model-router history"`
}

/** "≈$0.12", or with a part that has no price "≈$0.12 + ?", or "?" when none of it has one. */
export const fmtCost = (n: number, unpriced?: boolean) => (unpriced ? (n > 0 ? `≈${fmtUsd(n)} + ?` : '?') : `≈${fmtUsd(n)}`)

// --- The main chat's model ------------------------------------------------------

/** A hint to run this chat on a cheaper model when the plan has no deep step. */
export const modelHint = (list: readonly Step[], mainModel: Model | undefined) => {
  if (!mainModel || list.length === 0 || list.some(s => s.tier === 'deep')) return undefined
  if (mainModel !== 'opus' && mainModel !== 'fable') return undefined
  const ratio = PRICES.sonnet!.output / PRICES[mainModel]!.output

  return `No step in this plan is deep: Sonnet could run this chat for about ${Math.round(ratio * 100)}% of the cost. Switch it in the model menu if the conversation itself is routine.`
}

// --- Text -------------------------------------------------------------------

export const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : `${n}`)

export const fmtUsd = (n: number) =>
  n === 0 ? '$0' : n < 0.01 ? `$${n.toFixed(4)}` : n < 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(0)}`
