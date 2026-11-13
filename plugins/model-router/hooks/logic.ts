// Pure helpers for model-router: prices, the escalation ladder, history statistics, text formatting.
import type { Effort, HelperChoice, HelperConfig, HelperPick, HelperRuns, HelperTotals, HelperUsage, HistoryEntry, Model, ModelsCache, PlanNode, Price, Rung, Settings, Step, StepDraft, StepKnown, Tier, Usage, Verdict, Where } from '../types'
import { DEFAULT_SETTINGS, EFFORTS, FUSION, LADDER, LEARN, MODELS, NEW_MODEL_RUNGS, PRICES, SETUP_HEAVY, TIER_ORDER } from './tiers'

// Pure helpers: no engine, no state. The hooks module owns everything that touches `$`.

export const VERSION = '0.23.0'
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

// --- Default helper orders: built from helpers.py's config, else the hard-coded strings ---------
//
// The one piece of state in this file: the orders and labels the config gives, kept here so the many pure callers that take
// only `set` need no new argument. The hooks module sets it whenever helpers.py's config is (re)read.

type HelperEnv = {
  /** Per tier, the templates tried by default: providers by `order`, with an installed CLI, not this account. */
  on: Partial<Record<Tier, string[]>>
  /** Per tier, every template the config offers (for putting one back). */
  all: Partial<Record<Tier, string[]>>
  self: ReadonlySet<string>
  units: Record<string, string>
  labels: Record<string, string>
  /** The config lists providers and none has its CLI installed. */
  noCli: boolean
}

let helperEnv: HelperEnv | undefined

/** The order a provider has when the config states none (helpers.py's own defaults). */
const ORDER_OF: Record<string, number> = { kiro: 10, copilot: 20, codex: 30, agy: 40 }
const orderOf = (name: string, p: HelperConfig['providers'][string]) => p.order ?? ORDER_OF[name] ?? (p.kind === 'claude' ? 50 : 100)

/** A provider's name as shown: its config label, "Claude <label>" for another Claude account, else the name capitalised. */
export const providerLabel = (provider: string) => helperEnv?.labels[provider] ?? cap(provider)

/** Whether a provider is the session's own account (it cannot be its own helper). */
export const isSelfProvider = (provider: string) => helperEnv?.self.has(provider) ?? false

/** What the router knows of the config's providers; undefined (no helpers.py, no hc, or a config that failed) means there are no helpers at all. */
export const setHelperConfig = (cfg: HelperConfig | undefined) => {
  if (!cfg) {
    helperEnv = undefined

    return
  }
  const names = Object.keys(cfg.providers).sort((a, b) => orderOf(a, cfg.providers[a]!) - orderOf(b, cfg.providers[b]!) || a.localeCompare(b))
  const on: HelperEnv['on'] = {}
  const all: HelperEnv['all'] = {}
  for (const t of TIER_ORDER) {
    const has = names.filter(n => cfg.providers[n]!.tiers?.[t])
    all[t] = has.map(n => `${n}-${t}`)
    on[t] = has.filter(n => cfg.providers[n]!.cli_found !== false && !cfg.providers[n]!.self).map(n => `${n}-${t}`)
  }
  const entries = Object.entries(cfg.providers)
  const labelOf = (p: HelperConfig['providers'][string]) => (p.kind === 'claude' && p.label && !/claude/i.test(p.label) ? `Claude ${p.label}` : p.label)
  helperEnv = {
    on,
    all,
    self: new Set(entries.filter(([, p]) => p.self).map(([n]) => n)),
    units: Object.fromEntries(entries.flatMap(([n, p]) => (p.unit ? [[n, p.unit]] : []))),
    labels: Object.fromEntries(entries.flatMap(([n, p]) => (labelOf(p) ? [[n, labelOf(p)!]] : []))),
    noCli: entries.length > 0 && entries.every(([, p]) => p.cli_found === false),
  }
}

/** True when helpers.py's config is known and none of its providers has an installed CLI. */
export const noHelperCli = () => helperEnv?.noCli ?? false

/** Whether any helper can run on this machine: helpers.py's config is known (so herdr-delegate and hc are there) and a provider's CLI is installed. */
export const helpersAvailable = () => !!helperEnv && !helperEnv.noCli

/** Whether helpers are switched on and can run; the plan tool, the rules and the pane offer helper steps only then. */
export const helpersLive = (set: Settings) => set.helpers.enabled && helpersAvailable()

/** The default order of a tier's helper templates: only what is installed, so none when no config is known. */
export const defaultHelperList = (tier: Tier): string[] => helperEnv?.on[tier] ?? []

/**
 * Whether a tier's stored order is the shipped default (never changed by the user), so the config's default applies.
 * The hard-coded strings in DEFAULT_SETTINGS only serve as this "never changed" marker; they are never shown as helpers.
 */
const isDefaultOrder = (set: Settings, tier: Tier) => set.helpers.tiers[tier] === DEFAULT_SETTINGS.helpers.tiers[tier]

/** A tier's helper templates as in force: the stored order if the user set one, else the default; none while no helper can run. */
export const helperEffective = (set: Settings, tier: Tier): string[] =>
  !helpersAvailable() ? [] : isDefaultOrder(set, tier) ? defaultHelperList(tier) : parseList(set.helpers.tiers[tier])

/** Whether a tier's order differs from the default (for the pane's dot). */
export const orderIsCustom = (set: Settings, tier: Tier) => !isDefaultOrder(set, tier) && helperEffective(set, tier).join(',') !== defaultHelperList(tier).join(',')

/** A template with " (this account)" after it when its provider is the session's own account. */
export const templateLabel = (template: string, shortName = template) => `${shortName}${isSelfProvider(template.split('-')[0]!) ? ' (this account)' : ''}`

/** A tier's helper templates in the order they are tried, e.g. "kiro-deep → copilot-deep". */
export const helperOrder = (set: Settings, tier: Tier) => helperList(set, tier).map(t => templateLabel(t)).join(' → ')

/** A tier's helper templates in order, with Copilot Fusion added when its setting covers the tier. */
export const helperList = (set: Settings, tier: Tier): string[] => {
  const list = helperEffective(set, tier)
  if (!helpersAvailable()) return list
  const f = FUSION[tier]
  const on = set.helpers.fusion === 'both' || (set.helpers.fusion === 'deep' && tier === 'deep')
  if (!f || !on || list.includes(f.template)) return list
  const at = list.indexOf(f.before)
  // A default order without Copilot means its CLI is not installed: Fusion would have nothing to run on.
  if (at < 0) return isDefaultOrder(set, tier) ? list : [...list, f.template]

  return [...list.slice(0, at), f.template, ...list.slice(at)]
}

export const parseList = (v: string) =>
  v
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)

/** A tier's helpers as in force, in order, without Copilot Fusion (its own setting adds that). */
export const helperItems = (set: Settings, tier: Tier) => helperEffective(set, tier)

/** The templates of a tier the config offers that are switched off now, offered back in the pane. */
export const helpersOff = (set: Settings, tier: Tier) => {
  const on = helperItems(set, tier)

  return helpersAvailable() ? (helperEnv?.all[tier] ?? []).filter(x => !on.includes(x)) : []
}

/** The stored string after moving the helper at `index` one place (-1 up, 1 down); unchanged at an end. */
export const moveHelper = (list: readonly string[], index: number, by: -1 | 1) => {
  const to = index + by
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list.join(',')
  const next = [...list]
  ;[next[index], next[to]] = [next[to]!, next[index]!]

  return next.join(',')
}

/** One string for every tier's helper order, to tell whether the orders the agent knows are still current; empty while no helper can run (the rules then name none). */
export const helperSignature = (set: Settings) => !helpersAvailable() ? '' : TIER_ORDER.map(t => `${t}: ${helperList(set, t).join(',')}`).join('; ')

/** A whole number within [lo, hi], else undefined (a stored value that is missing or unusable). */
const wholeIn = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined)

/** A path to helpers.py as stored or typed: it must end in helpers.py (the router runs it with python, so no other file is taken). */
export const asScriptPath = (v: unknown) => {
  const t = typeof v === 'string' ? v.trim() : ''

  return /^[^\n\r]*[\\/]helpers\.py$/.test(t) ? t : undefined
}

/** Per-kind helper choices as stored; anything that is not a provider, model and level of plain words is dropped. */
const helperChoices = (v: unknown): Record<string, HelperChoice> => {
  const word = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9][\w.-]{0,79}$/.test(x)
  if (!v || typeof v !== 'object') return {}

  return Object.fromEntries(
    Object.entries(v as Record<string, Partial<HelperChoice>>).flatMap(([kind, c]) =>
      word(c?.provider) && word(c?.model) && word(c?.effort) ? [[kind, { provider: c.provider, model: c.model, effort: c.effort }]] : [],
    ),
  )
}

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
    script: asScriptPath(stored?.helpers?.script) ?? DEFAULT_SETTINGS.helpers.script,
    kinds: helperChoices(stored?.helpers?.kinds),
  },
  hereEffort: { ...DEFAULT_SETTINGS.hereEffort, ...(stored?.hereEffort ?? {}) },
  kinds: { ...(stored?.kinds && typeof stored.kinds === 'object' ? stored.kinds : {}) },
  autoRoute: stored?.autoRoute === true,
  autoMinRuns: wholeIn(stored?.autoMinRuns, 1, 1000) ?? DEFAULT_SETTINGS.autoMinRuns,
  autoOkPercent: wholeIn(stored?.autoOkPercent, 1, 100) ?? DEFAULT_SETTINGS.autoOkPercent,
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
  if (s.where === 'helper') {
    if (s.helper) return `helper (${helperName(s)})`
    const pick = s.helperPick

    return pick?.template ? `helper (launch ${pick.template}: ${pick.model} ${pick.effort}, ${pickSource(pick)}; else ${helperOrder(set, s.tier)})` : `helper (${helperOrder(set, s.tier)})`
  }
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
export const helperName = (s: Step) =>
  s.helper ? `${s.helper}${s.helperModel ? ` · ${s.helperModel}` : ''}${s.helperEffort ? ` · ${s.helperEffort}` : ''}` : ''

/** A helper template name that is safe to build a file path from. */
export const isTemplateName = (v: string) => /^[a-z0-9][a-z0-9._-]{0,60}$/i.test(v)

/** A thinking level as the lead reported it from the helper's screen: a short word or two, else nothing. */
export const asHelperEffort = (v: unknown) => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : ''

  return t && t.length <= 20 ? t : undefined
}

/**
 * The thinking level a helper template sets on its command line (front matter `command:`): Kiro's `--effort X`,
 * Copilot's `--reasoning-effort X`, Claude's `--effort X` (another account's helper), Codex's `-c model_reasoning_effort=X`; for agy, the level its model id ends with (`gemini-4-argon-high`). Nothing when it sets none.
 */
export const effortOfTemplate = (text: string) => {
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? ''
  const command = /^command:\s*(.+)$/m.exec(front)?.[1] ?? ''
  const flag = (
    /(?:^|\s)--(?:reasoning-)?effort(?:=|\s+)([a-z]+)\b/i.exec(command) ?? /(?:^|\s)(?:-c|--config)(?:=|\s+)['"]?model_reasoning_effort\s*=\s*['"]?([a-z]+)\b/i.exec(command)
  )?.[1]?.toLowerCase()
  if (flag) return EFFORTS.includes(flag as Effort) ? flag : undefined
  if (!/(?:^|\s)agy\s/.test(command)) return undefined
  const model = /--model(?:=|\s+)(\S+)/.exec(command)?.[1] ?? ''

  return /-(low|medium|high|xhigh|max)$/i.exec(model)?.[1]?.toLowerCase()
}

// --- Pane edits to a running plan, held back until sent --------------------------

/** A step as the pane shows it: the plan's values with its unsent edits laid over. */
export const applyDraft = (s: Step, d: StepDraft | undefined): Step =>
  !d
    ? s
    : {
        ...s,
        ...(d.where !== undefined ? { where: d.where } : {}),
        ...(d.tier !== undefined ? { tier: d.tier } : {}),
        ...('model' in d ? { model: d.model ?? undefined } : {}),
        ...('effort' in d ? { effort: d.effort ?? undefined } : {}),
      }

/** An edit with the fields that equal the plan's own values removed (an edit put back is no edit); undefined when nothing is left. */
export const trimDraft = (s: Step, d: StepDraft): StepDraft | undefined => {
  const out: StepDraft = {}
  if (d.where !== undefined && d.where !== s.where) out.where = d.where
  if (d.tier !== undefined && d.tier !== s.tier) out.tier = d.tier
  if ('model' in d && (d.model ?? undefined) !== s.model) out.model = d.model ?? null
  if ('effort' in d && (d.effort ?? undefined) !== s.effort) out.effort = d.effort ?? null

  return Object.keys(out).length > 0 ? out : undefined
}

/** How many values the draft changes. */
export const draftCount = (d: Record<string, StepDraft>) => Object.values(d).reduce((n, x) => n + Object.keys(x).length, 0)

/** A usage report from the plan tool, if it is one: provider, a number and a unit. */
export const asHelperUsage = (v: unknown): HelperUsage | undefined => {
  const u = v as { provider?: unknown; amount?: unknown; unit?: unknown } | null | undefined
  const amount = typeof u?.amount === 'string' ? Number(u.amount) : u?.amount
  if (typeof u?.provider !== 'string' || typeof u.unit !== 'string' || typeof amount !== 'number') return undefined
  const provider = u.provider.trim().toLowerCase()
  const unit = u.unit.trim()

  // 0 is not a report: a helper whose screen showed no usage must not read as "used nothing".
  return provider && unit && Number.isFinite(amount) && amount > 0 ? { provider, amount, unit } : undefined
}

export const addHelperUsage = (list: readonly HelperUsage[], u: HelperUsage): HelperUsage[] => {
  const at = list.findIndex(x => x.provider === u.provider && x.unit === u.unit)
  if (at < 0) return [...list, u]

  return list.map((x, i) => (i === at ? { ...x, amount: x.amount + u.amount } : x))
}

/** Per provider, the helper runs counted and how many of them reported usage, added up. */
export const addHelperRuns = (a: HelperTotals['runs'], b: HelperTotals['runs']): NonNullable<HelperTotals['runs']> => {
  const out: Record<string, HelperRuns> = { ...(a ?? {}) }
  for (const [provider, r] of Object.entries(b ?? {})) {
    out[provider] = { n: (out[provider]?.n ?? 0) + r.n, reported: (out[provider]?.reported ?? 0) + r.reported }
  }

  return out
}

export const addHelperTotals = (a: HelperTotals | undefined, b: HelperTotals): HelperTotals => {
  const runs = addHelperRuns(a?.runs, b.runs)

  return {
    steps: (a?.steps ?? 0) + b.steps,
    ms: (a?.ms ?? 0) + b.ms,
    usage: b.usage.reduce(addHelperUsage, a?.usage ?? []),
    ...(Object.keys(runs).length > 0 ? { runs } : {}),
  }
}

/** The totals without usage entries of 0 (an old report of "nothing" that was really "not reported"); the same object when there are none. */
export const withoutZeroUsage = <T extends { usage: HelperUsage[] }>(h: T): T =>
  h.usage.some(u => !(u.amount > 0)) ? { ...h, usage: h.usage.filter(u => u.amount > 0) } : h

/** The provider a helper run belongs to: the part of its template name before the first '-', else the router's pick, else what it reported. */
export const providerOfRun = (s: Step) => {
  const named = s.helper?.split('-')[0]?.trim().toLowerCase()

  return named || s.helperPick?.provider?.toLowerCase() || s.helperUsage?.provider || undefined
}

/** How long a step ran, from its start to when it was marked done (helper steps), in ms; 0 when unknown. */
export const runSpan = (s: Step) => {
  const ms = s.startedAt && s.endedAt ? Date.parse(s.endedAt) - Date.parse(s.startedAt) : 0

  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

/** What the finished helper steps in a list moved off Claude. A group's own usage counts, its steps do not. */
export const helperTotalsOf = (list: readonly Step[]): HelperTotals => {
  const run = leavesOf(list).filter(s => isHelperRun(s) && s.status === 'done')
  // A run reported usage itself, or through a group above it (ids extend the parent's).
  const groups = list.filter(g => g.group && g.helperUsage).map(g => `${g.id}.`)
  const runs: Record<string, HelperRuns> = {}
  for (const s of run) {
    const provider = providerOfRun(s)
    if (!provider) continue
    const r = (runs[provider] ??= { n: 0, reported: 0 })
    r.n += 1
    if (s.helperUsage || groups.some(g => s.id.startsWith(g))) r.reported += 1
  }

  return {
    steps: run.length,
    ms: run.reduce((n, s) => n + runSpan(s), 0),
    usage: list.flatMap(s => (s.helperUsage ? [s.helperUsage] : [])).reduce(addHelperUsage, [] as HelperUsage[]),
    ...(Object.keys(runs).length > 0 ? { runs } : {}),
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
  // The runs per provider that are newly counted, and those newly reported (also through a group's usage).
  const now = helperTotalsOf(after).runs ?? {}
  const then = helperTotalsOf(before).runs ?? {}
  const runs: Record<string, HelperRuns> = {}
  for (const [provider, r] of Object.entries(now)) {
    const n = r.n - (then[provider]?.n ?? 0)
    const reported = r.reported - (then[provider]?.reported ?? 0)
    if (n > 0 || reported > 0) runs[provider] = { n: Math.max(0, n), reported: Math.max(0, reported) }
  }

  return Object.keys(runs).length > 0 ? { ...gain, runs } : gain
}

export const fmtMin = (ms: number) => {
  const m = Math.round(ms / 60000)

  return m < 1 ? '<1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

export const fmtAmount = (n: number) => `${Number(n.toFixed(2))}`

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)

/** An amount with its unit: "30 AIC", but "1.5% of 7d" (a percent unit follows the number without a space). */
export const amountWithUnit = (amount: number, unit: string) => `${fmtAmount(amount)}${unit.startsWith('%') ? '' : ' '}${unit}`

/** "Copilot 30 AIC": one provider's usage in its own unit. */
export const usageLabel = (u: HelperUsage) => `${providerLabel(u.provider)} ${amountWithUnit(u.amount, u.unit)}`

/** The unit a provider reports in when the config names none, for saying that it did not: what its screen shows. */
const UNIT_OF: Record<string, string> = { kiro: 'credits', copilot: 'AIC' }
const unitOf = (provider: string) => helperEnv?.units[provider] ?? UNIT_OF[provider] ?? 'usage'

/**
 * The one-line account of what was moved off Claude, or undefined when nothing was. A provider whose runs did not all
 * report usage says so: "Kiro 2.1 credits (3 of 6 runs reported)", or "Kiro: credits not reported" when none did.
 */
export const helperLine = (h: HelperTotals | undefined) => {
  if (!h || (h.steps === 0 && h.usage.length === 0)) return undefined
  const used = h.usage.filter(u => u.amount > 0)
  const sorted = [...used].sort((a, b) => a.provider.localeCompare(b.provider) || a.unit.localeCompare(b.unit))
  const runs = h.runs ?? {}
  const partial = (provider: string) => {
    const r = runs[provider]

    return r && r.reported < r.n ? ` (${r.reported} of ${r.n} runs reported)` : ''
  }
  const parts = sorted.map(u => `${usageLabel(u)}${partial(u.provider)}`)
  const silent = Object.entries(runs)
    .filter(([provider, r]) => r.n > 0 && !used.some(u => u.provider === provider))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider]) => `${providerLabel(provider)}: ${unitOf(provider)} not reported`)
  const head = `${h.steps} helper step${h.steps === 1 ? '' : 's'}${h.ms > 0 ? `, ${fmtMin(h.ms)}` : ''}`

  return `Moved off Claude: ${[head, ...parts, ...silent].join('; ')}`
}

/** A helper step's usage and time for its card: "30.04 AIC · 12 min", or when it started while it runs. */
export const helperFacts = (s: Step) => {
  const parts: string[] = []
  if (s.helperUsage && s.helperUsage.amount > 0) parts.push(amountWithUnit(s.helperUsage.amount, s.helperUsage.unit))
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
const judgeRuns = <R>(xs: readonly HistoryEntry[], label: string, up: R | undefined, down: R | undefined) => {
  if (xs.length < LEARN.minRuns) return undefined
  const weak = xs.filter(isWeak).length
  const over = xs.filter(isOverkill).length
  if (weak / xs.length >= LEARN.weakShare && up) return { to: up, isRaise: true, why: `${label}: ${weak} of ${xs.length} weak` }
  const recent = [...xs].sort((a, b) => a.at.localeCompare(b.at)).slice(-LEARN.recent)
  if (over / xs.length >= LEARN.overkillShare && !recent.some(isWeak) && down) {
    return { to: down, isRaise: false, why: `${label}: ${over} of ${xs.length} overkill` }
  }
  return undefined
}

const judge = (xs: readonly HistoryEntry[], from: Rung, label: string, set: Settings) => judgeRuns(xs, label, nextRung(from, set), prevRung(from, set))

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

/** Auto mode: per kind, the cheapest rung that did it well (ok in at least `autoOkPercent` of at least `autoMinRuns` runs there). */
export const learnedRungs = (h: readonly HistoryEntry[], set: Settings): Learned => {
  const out: Learned = {}
  const runs = h.filter(isAgentRun)
  for (const kind of kindsOf(runs, Infinity)) {
    const by = new Map<string, HistoryEntry[]>()
    for (const x of runs.filter(r => r.kind === kind)) by.set(entryRung(x), [...(by.get(entryRung(x)) ?? []), x])
    const good = [...by.values()]
      .filter(xs => xs.length >= set.autoMinRuns && (xs.filter(isOk).length * 100) / xs.length >= set.autoOkPercent)
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

// --- Helper models: the config helpers.py holds, its ladder, advice and picks -----------------

/** A model and a thinking level on a helper provider's CLI. */
export type HelperRung = { model: string; effort: string }

/** helpers.py's `config` output, if it is one: an object with providers. */
export const parseHelperConfig = (text: string): HelperConfig | undefined => {
  try {
    const v = JSON.parse(text) as HelperConfig | null

    return v && typeof v === 'object' && v.providers && typeof v.providers === 'object' ? v : undefined
  } catch {
    return undefined
  }
}

/** The cache of offered models (models.json): an object per provider, else nothing. */
export const parseModelsCache = (text: string): ModelsCache | undefined => {
  try {
    const v = JSON.parse(text) as ModelsCache | null

    return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined
  } catch {
    return undefined
  }
}

/** The lines `helpers.py models` printed that need a look: models no longer offered, newer ones, a CLI that failed. */
export const modelWarnings = (out: string) =>
  out
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => /^(NOT OFFERED|NEWER)\b/.test(l) || /\bERROR:/.test(l))
    .map(l => l.replace(/\s{2,}/g, ' '))

/** The day models were last checked, from the cache (the latest of the providers'), or nothing. */
export const modelsChecked = (cache: ModelsCache | undefined) =>
  Object.values(cache ?? {})
    .map(e => e?.checked ?? e?.date)
    .filter((d): d is string => typeof d === 'string')
    .sort()
    .at(-1)

/** A provider's tiers that are a model and a level (not a router's fixed command), the router's tiers first. */
export const helperTierNames = (cfg: HelperConfig, provider: string): string[] => {
  const tiers = cfg.providers[provider]?.tiers ?? {}
  const own = Object.keys(tiers).filter(t => !tiers[t]?.command && tiers[t]?.model && tiers[t]?.effort)

  return [...TIER_ORDER.filter(t => own.includes(t)), ...own.filter(t => !TIER_ORDER.includes(t as Tier)).sort()]
}

/** The providers of the config, in the order the tiers' helper orders first name them, then the rest. */
export const helperProviders = (cfg: HelperConfig, set: Settings): string[] => {
  const named = TIER_ORDER.flatMap(t => providersOf(helperItems(set, t)))
  const all = Object.keys(cfg.providers)

  return [...new Set([...named.filter(p => all.includes(p)), ...all])]
}

/** The providers a list of helper templates names, in order ("kiro-deep,agy-deep" gives kiro, agy). */
export const providersOf = (templates: readonly string[]) => [...new Set(templates.map(t => t.split('-')[0]!).filter(Boolean))]

/** A tier's model and level, or nothing when it has none (a router's fixed command, a missing tier). */
export const helperTierRung = (cfg: HelperConfig | undefined, provider: string, tier: string): HelperRung | undefined => {
  const t = cfg?.providers[provider]?.tiers?.[tier]

  return t && !t.command && t.model && t.effort ? { model: t.model, effort: t.effort } : undefined
}

const escapeRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** An id the CLI offers, without the level when the provider's ids carry it (agy: `gemini-4-argon-high`). */
export const baseModelId = (cfg: HelperConfig, provider: string, id: string) => {
  const prov = cfg.providers[provider]
  const efforts = prov?.efforts ?? []
  if (!prov || !(prov.model_id ?? '{model}').endsWith('-{effort}') || efforts.length === 0) return id

  return new RegExp(`^(.*)-(?:${efforts.map(escapeRe).join('|')})$`).exec(id)?.[1] ?? id
}

/** The models a provider's picker lists: those its CLI offered (as last checked), then those configured that it did not list. */
export const offeredModels = (cfg: HelperConfig, cache: ModelsCache | undefined, provider: string, extra: readonly string[] = []) => {
  const listed = (cache?.[provider]?.models ?? []).map(id => baseModelId(cfg, provider, id))
  const configured = helperTierNames(cfg, provider).map(t => helperTierRung(cfg, provider, t)!.model)

  return [...new Set([...listed, ...configured, ...extra])]
}

/** The thinking levels a provider's picker lists: its own, with the current one added if it is not among them. */
export const helperEfforts = (cfg: HelperConfig, provider: string, current?: string) => {
  const own = cfg.providers[provider]?.efforts ?? []

  return current && !own.includes(current) ? [...own, current] : own
}

/** Whether a tier's model and level differ from the shipped defaults; a tier the defaults lack counts as different. */
export const helperTierDiffers = (cfg: HelperConfig | undefined, defaults: HelperConfig | undefined, provider: string, tier: string) => {
  const now = helperTierRung(cfg, provider, tier)
  const was = helperTierRung(defaults, provider, tier)
  if (!defaults) return { model: false, effort: false }

  return { model: now?.model !== was?.model, effort: now?.effort !== was?.effort }
}

const slugOf = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** The name helpers.py gives a one-off template: `<provider>-<model slug>-<effort>`. */
export const customTemplate = (provider: string, model: string, effort: string) => `${provider}-${slugOf(model)}-${effort}`

/** The provider, tier, model and level a helper template stands for (`kiro-standard`, or a custom one), if it is one the config knows. */
export const templateRung = (cfg: HelperConfig | undefined, template: string): (HelperChoice & { tier?: string }) | undefined => {
  if (!cfg) return undefined
  for (const provider of Object.keys(cfg.providers)) {
    for (const tier of helperTierNames(cfg, provider)) {
      const r = helperTierRung(cfg, provider, tier)!
      if (`${provider}-${tier}` === template) return { provider, tier, ...r }
    }
  }
  for (const c of cfg.custom ?? []) if (customTemplate(c.provider, c.model, c.effort) === template) return { provider: c.provider, model: c.model, effort: c.effort }

  return undefined
}

/** A tier template that already stands for this provider, model and level (preferring `tier`'s own), so no one-off template is needed. */
export const templateOfRung = (cfg: HelperConfig, provider: string, r: HelperRung, tier?: string) => {
  const hits = helperTierNames(cfg, provider).filter(t => {
    const x = helperTierRung(cfg, provider, t)!

    return x.model === r.model && x.effort === r.effort
  })
  const at = tier && hits.includes(tier) ? tier : hits[0]

  return at ? `${provider}-${at}` : undefined
}

/**
 * The rungs a provider's helper can climb, weakest first: the models of its light, standard and deep tiers (ordered by Kiro's
 * credit multiplier when models.json has one for every one of them, else in tier order), each from the lowest level a tier gives
 * it up to `high`; the top model goes on to the provider's highest level. A model's levels never start below what the owner gave it.
 */
export const helperLadder = (cfg: HelperConfig, provider: string, cache?: ModelsCache): HelperRung[] => {
  const prov = cfg.providers[provider]
  if (!prov) return []
  const efforts = (prov.efforts ?? []).filter(e => e !== 'none' && e !== 'minimal')
  const models: string[] = []
  const floor = new Map<string, number>()
  for (const tier of TIER_ORDER) {
    const r = helperTierRung(cfg, provider, tier)
    if (!r) continue
    if (!models.includes(r.model)) models.push(r.model)
    floor.set(r.model, Math.min(floor.get(r.model) ?? Infinity, Math.max(0, efforts.indexOf(r.effort))))
  }
  const credits = cache?.[provider]?.credits
  const ordered = credits && models.every(m => typeof credits[m] === 'number') ? [...models].sort((a, b) => credits[a]! - credits[b]!) : models
  const high = efforts.indexOf('high')

  return ordered.flatMap((model, i) => {
    const from = floor.get(model)!
    const to = i === ordered.length - 1 || high < 0 ? efforts.length - 1 : Math.max(high, from)

    return efforts.slice(from, to + 1).map(effort => ({ model, effort }))
  })
}

/** The rung `by` places from this one on a ladder (1 stronger, -1 weaker); nothing at an end or when it is not on the ladder. */
export const helperStep = (ladder: readonly HelperRung[], r: HelperRung, by: 1 | -1) => {
  const at = ladder.findIndex(x => x.model === r.model && x.effort === r.effort)

  return at < 0 ? undefined : ladder[at + by]
}

export const helperRungLabel = (r: HelperRung) => `${r.model}/${r.effort}`

/** How a pick came about, for the plan text and the card. */
export const pickSource = (p: HelperPick) => (p.source === 'auto' ? `auto: learned, ${p.n} runs` : 'its kind\'s choice')

const isHelperEntry = (x: HistoryEntry) => x.where === 'helper'

/** The provider, model and level a helper run ran on: as recorded, else what its template stands for now. */
export const helperRungOf = (x: HistoryEntry, cfg: HelperConfig | undefined): HelperChoice | undefined => {
  if (x.hrung) return x.hrung
  const t = x.helper ? templateRung(cfg, x.helper) : undefined

  return t ? { provider: t.provider, model: t.model, effort: t.effort } : undefined
}

const sameChoice = (a: HelperChoice | undefined, b: HelperChoice) => !!a && a.provider === b.provider && a.model === b.model && a.effort === b.effort

/** One piece of advice for a helper: a provider's tier (runs with no kind) or a kind, one rung up or down, with its evidence. */
export type HelperAdvice = { provider: string; tier?: string; kind?: string; from: HelperRung; to: HelperRung; why: string; isRaise: boolean }

/**
 * What the history argues for the helpers: per provider and tier on the model and level the tier has now, for runs with no kind;
 * per kind on the model and level it ran on (its own choice, or the busiest tier's). Weak at half of at least 3 runs: the next
 * stronger rung of that provider's ladder; overkill: the next weaker.
 */
export const helperSuggestions = (h: readonly HistoryEntry[], set: Settings, cfg: HelperConfig | undefined, cache?: ModelsCache): HelperAdvice[] => {
  if (!cfg) return []
  const runs = h.filter(isHelperEntry)
  const out: HelperAdvice[] = []
  const judged = (xs: readonly HistoryEntry[], provider: string, from: HelperRung, label: string) => {
    const ladder = helperLadder(cfg, provider, cache)

    return judgeRuns(xs, label, helperStep(ladder, from, 1), helperStep(ladder, from, -1))
  }
  for (const provider of helperProviders(cfg, set).filter(p => !cfg.providers[p]?.self)) {
    for (const tier of helperTierNames(cfg, provider)) {
      const now = helperTierRung(cfg, provider, tier)!
      const xs = runs.filter(x => !x.kind && x.helper === `${provider}-${tier}` && sameChoice(helperRungOf(x, cfg), { provider, ...now }))
      const j = judged(xs, provider, now, `${provider}-${tier} on ${helperRungLabel(now)}`)
      if (j) out.push({ provider, tier, from: now, ...j })
    }
  }
  for (const kind of kindsOf(runs, Infinity)) {
    const mine = runs.filter(x => x.kind === kind)
    const own = set.helpers.kinds[kind]
    const groups = own
      ? [{ provider: own.provider, tier: undefined as string | undefined, from: { model: own.model, effort: own.effort }, xs: mine.filter(x => sameChoice(helperRungOf(x, cfg), own)) }]
      : helperProviders(cfg, set).filter(p => !cfg.providers[p]?.self)
          .flatMap(provider =>
            helperTierNames(cfg, provider).map(tier => {
              const now = helperTierRung(cfg, provider, tier)!

              return { provider, tier: tier as string | undefined, from: now, xs: mine.filter(x => x.helper === `${provider}-${tier}` && sameChoice(helperRungOf(x, cfg), { provider, ...now })) }
            }),
          )
          .sort((a, b) => b.xs.length - a.xs.length)
    for (const g of groups) {
      const j = judged(g.xs, g.provider, g.from, `${kind} on ${g.provider} ${g.tier ?? helperRungLabel(g.from)}`)
      if (j) {
        out.push({ provider: g.provider, ...(g.tier ? { tier: g.tier } : {}), kind, from: g.from, ...j })
        break
      }
    }
  }

  return out
}

/** Auto mode for helpers: per kind, the rungs that did it well (ok in at least `autoOkPercent` of at least `autoMinRuns` runs there), cheapest first within a provider. */
export type HelperLearned = Record<string, (HelperChoice & { n: number })[]>

export const learnedHelpers = (h: readonly HistoryEntry[], set: Settings, cfg: HelperConfig | undefined, cache?: ModelsCache): HelperLearned => {
  const out: HelperLearned = {}
  if (!cfg) return out
  const runs = h.filter(isHelperEntry)
  for (const kind of kindsOf(runs, Infinity)) {
    const by = new Map<string, { choice: HelperChoice; xs: HistoryEntry[] }>()
    for (const x of runs.filter(r => r.kind === kind)) {
      const choice = helperRungOf(x, cfg)
      if (!choice) continue
      const key = `${choice.provider}|${choice.model}|${choice.effort}`
      by.set(key, { choice, xs: [...(by.get(key)?.xs ?? []), x] })
    }
    const good = [...by.values()]
      .filter(g => g.xs.length >= set.autoMinRuns && (g.xs.filter(isOk).length * 100) / g.xs.length >= set.autoOkPercent)
      .flatMap(g => {
        const at = helperLadder(cfg, g.choice.provider, cache).findIndex(r => r.model === g.choice.model && r.effort === g.choice.effort)

        return at < 0 ? [] : [{ ...g.choice, n: g.xs.length, at }]
      })
      .sort((a, b) => a.at - b.at)
      .map(({ at: _at, ...c }) => c)
    if (good.length) out[kind] = good
  }

  return out
}

/**
 * The model and level the router picks for a helper step that has not started: what auto mode learned for its kind, else its kind's
 * stored choice. Only a provider the step's tier lists (the owner's configured helpers) can be picked; the tier order still follows.
 */
export const helperPickFor = (s: Step, set: Settings, learned: HelperLearned | undefined, cfg: HelperConfig | undefined): Omit<HelperPick, 'template' | 'error'> | undefined => {
  if (s.group || s.where !== 'helper' || s.status !== 'planned' || s.helper || !s.kind || !cfg) return undefined
  const allowed = providersOf(helperList(set, s.tier)).filter(p => cfg.providers[p] && !cfg.providers[p]!.self)
  const auto = (learned?.[s.kind] ?? []).filter(c => allowed.includes(c.provider)).sort((a, b) => allowed.indexOf(a.provider) - allowed.indexOf(b.provider))[0]
  if (auto) return { provider: auto.provider, model: auto.model, effort: auto.effort, source: 'auto', n: auto.n }
  const own = set.helpers.kinds[s.kind]

  return own && allowed.includes(own.provider) ? { ...own, source: 'kind' } : undefined
}

/** Whether a stored pick says the same as a fresh one (the template and any error are about making it, not choosing it). */
export const samePick = (a: HelperPick | undefined, b: Omit<HelperPick, 'template' | 'error'> | undefined) =>
  !a ? !b : !!b && a.provider === b.provider && a.model === b.model && a.effort === b.effort && a.source === b.source && a.n === b.n

/** Orders two version strings ("0.6.0", "0.10.1") by their numbers; positive when `a` is newer. */
export const compareVersions = (a: string, b: string) => {
  const [x, y] = [a, b].map(v => v.split(/[.-]/).map(n => Number.parseInt(n, 10) || 0))
  for (let i = 0; i < Math.max(x!.length, y!.length); i += 1) {
    const d = (x![i] ?? 0) - (y![i] ?? 0)
    if (d !== 0) return d
  }

  return 0
}
