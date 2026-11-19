// Strengths and the model map: which model suits which kind of work (a kind's tags against a model note's tags and fits), "Try" suggestions
// for kinds with little history, and what would run now per kind. Pure and advisory: nothing here changes routing; a click in the pane does.
import type { HelperChoice, HelperConfig, HistoryEntry, ModelNote, ModelsCache, ModelTag, Rung, Settings, Tier } from '../types'
import {
  baseRung,
  baseModelId,
  helperEfforts,
  helperList,
  helperPickFor,
  helperRungOf,
  helperTierRung,
  judgedRuns,
  newStep,
  offeredModels,
  providerLabel,
  providersOf,
  isSelfProvider,
  templateRung,
  type HelperLearned,
  type Learned,
} from './logic'
import { findNote, TAGS } from './notes'
import { KIND_TAGS, KIND_WORDS, TIER_ORDER } from './tiers'

// --- A kind's tags ----------------------------------------------------------------------

/** The strengths a kind wants by default: the table's entry, else the tags its own words stand for (a kind with "review" in it wants review), else none. */
export const defaultKindTags = (kind: string): ModelTag[] => {
  if (Object.hasOwn(KIND_TAGS, kind)) return [...KIND_TAGS[kind]!]
  const words = KIND_WORDS.filter(([w]) => kind.includes(w)).map(([, t]) => t)

  return TAGS.filter(t => words.includes(t))
}

/** The strengths a kind wants now: the person's own list for it (which may be empty), else the default. */
export const tagsOfKind = (kind: string, set: Pick<Settings, 'kindTags'>): ModelTag[] => (Object.hasOwn(set.kindTags ?? {}, kind) ? [...set.kindTags[kind]!] : defaultKindTags(kind))

/** Whether the person has set a kind's tags themselves. */
export const kindTagsEdited = (kind: string, set: Pick<Settings, 'kindTags'>) => Object.hasOwn(set.kindTags ?? {}, kind)

/** A tag added or taken away, the list kept in the vocabulary's order. */
export const toggleTag = (tags: readonly ModelTag[], tag: ModelTag): ModelTag[] => TAGS.filter(t => (t === tag ? !tags.includes(t) : tags.includes(t)))

/** `kind: tags` after a toggle, as the settings hold it: the default list put back as no override. */
export const withKindTags = (set: Settings, kind: string, tags: readonly ModelTag[]): Settings => {
  const kindTags = Object.fromEntries(Object.entries(set.kindTags ?? {}).filter(([k]) => k !== kind))
  const same = tags.length === defaultKindTags(kind).length && tags.every(t => defaultKindTags(kind).includes(t))

  return { ...set, kindTags: same ? kindTags : { ...kindTags, [kind]: [...tags] } }
}

// --- The kinds the map and the suggestions cover -------------------------------------------

/** The kinds to show: those in the history (most used first), then the rules' kinds, then those in the plan; at most `cap`. */
export const kindList = (h: readonly HistoryEntry[], ruleKinds: readonly string[], planKinds: readonly string[], cap = 20): string[] => {
  const n = new Map<string, number>()
  for (const x of h) if (x.kind) n.set(x.kind, (n.get(x.kind) ?? 0) + 1)
  const used = [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k)

  return [...new Set([...used, ...ruleKinds, ...planKinds])].slice(0, cap)
}

/** The tier a kind usually runs at: the tier of most of its runs (the latest on a tie), else the tier of a step of it in the plan. */
export const tierOfKind = (h: readonly HistoryEntry[], kind: string, planTiers: Readonly<Record<string, Tier>> = {}): Tier | undefined => {
  const n = new Map<Tier, { n: number; last: string }>()
  for (const x of h.filter(x => x.kind === kind)) {
    const was = n.get(x.tier)
    n.set(x.tier, { n: (was?.n ?? 0) + 1, last: was && was.last > x.at ? was.last : x.at })
  }
  const best = [...n.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last))[0]?.[0]

  return best ?? (Object.hasOwn(planTiers, kind) ? planTiers[kind] : undefined)
}

// --- Try suggestions ---------------------------------------------------------------------

export type Try = {
  /** `kind|provider|model|effort`: what a dismissal remembers. */
  key: string
  kind: string
  tier: Tier
  /** `claude`, or the helper provider. */
  provider: string
  model: string
  effort: string
  name: string
  /** The strengths this model adds for the kind (the kind's tags the model has and the kind's current model has not). */
  tags: ModelTag[]
  /** The line shown: "Try Gemini 4 Neon high on Antigravity for code-review (careful · review)". */
  text: string
}

export type TryInput = {
  history: readonly HistoryEntry[]
  set: Settings
  notes: Record<string, ModelNote>
  /** The helper config; with `helpersOn`, helpers' models are candidates too. */
  cfg?: HelperConfig
  cache?: ModelsCache
  helpersOn: boolean
  kinds: readonly string[]
  planTiers?: Readonly<Record<string, Tier>>
  /** Kinds auto mode or the history's advice already owns. */
  skip?: ReadonlySet<string>
  learned?: Learned
  learnedHelpers?: HelperLearned
  /** `Try.key`s the person dismissed. */
  dismissed: readonly string[]
  max?: number
}

const tryKey = (kind: string, provider: string, model: string, effort: string) => `${kind}|${provider}|${model}|${effort}`
const sameRungOf = (x: HistoryEntry, r: Rung) => x.model === r.model && x.effort === r.effort
const hasFit = (n: ModelNote, tier: Tier) => n.fits.some(f => f.tier === tier)

/**
 * Models that suit a kind of work by their notes, for kinds with fewer runs than auto mode needs on the model they run on now.
 * Advice only: a candidate must carry a tag the kind wants that the kind's current model lacks, and its note must say it fits the kind's tier
 * (Claude: the tier's own rung; helpers: each provider in the tier's order, its offered models, at the note's level when that provider has it).
 * A kind whose runs are mostly on helpers is offered helper models, mostly on Claude agents Claude's; with no runs, both. One per kind, `max` in all.
 */
export const trySuggestions = (i: TryInput): Try[] => {
  const out: Try[] = []
  const max = i.max ?? 3
  const runs = judgedRuns([...i.history])
  const needed = i.set.autoMinRuns
  for (const kind of i.kinds) {
    if (out.length >= max) break
    if (i.skip?.has(kind) || i.learned?.[kind] || i.learnedHelpers?.[kind]) continue
    const wants = tagsOfKind(kind, i.set)
    const tier = tierOfKind(i.history, kind, i.planTiers)
    if (wants.length === 0 || !tier) continue
    const mine = runs.filter(x => x.kind === kind)
    const onAgents = mine.filter(x => (x.where ?? 'agent') === 'agent')
    const onHelpers = mine.filter(x => x.where === 'helper')
    const cands: Omit<Try, 'text' | 'key' | 'kind' | 'tier'>[] = []
    const gainOf = (note: ModelNote | undefined, now: ModelNote | undefined) => wants.filter(t => note?.tags.includes(t) && !now?.tags.includes(t))

    if (onHelpers.length <= onAgents.length) {
      const now = i.set.kinds?.[kind] ?? i.set.tiers[tier]
      if (onAgents.filter(x => sameRungOf(x, now)).length < needed) {
        const to = i.set.tiers[tier]
        const note = findNote(i.notes, to.model)
        const gain = note && hasFit(note, tier) && !(to.model === now.model && to.effort === now.effort) ? gainOf(note, findNote(i.notes, now.model)) : []
        if (note && gain.length) cands.push({ provider: 'claude', model: to.model, effort: to.effort, name: note.name, tags: gain })
      }
    }
    if (i.helpersOn && i.cfg && onHelpers.length >= onAgents.length) {
      const cfg = i.cfg
      const providers = providersOf(helperList(i.set, tier)).filter(p => cfg.providers[p] && !isSelfProvider(p) && !cfg.providers[p]!.self)
      const first = providers.map(p => ({ p, r: helperTierRung(cfg, p, tier) })).find(x => x.r)
      const now: HelperChoice | undefined = i.set.helpers.kinds[kind] ?? (first?.r ? { provider: first.p, ...first.r } : undefined)
      const same = (x: HistoryEntry) => {
        const c = helperRungOf(x, cfg)

        return !!now && !!c && c.provider === now.provider && c.model === now.model && c.effort === now.effort
      }
      if (onHelpers.filter(same).length < needed) {
        const nowNote = now ? findNote(i.notes, now.model) : undefined
        for (const provider of providers) {
          const levels = helperEfforts(cfg, provider)
          for (const model of offeredModels(cfg, i.cache, provider)) {
            const note = findNote(i.notes, baseModelId(cfg, provider, model))
            const fit = note?.fits.find(f => f.tier === tier)
            if (!note || !fit) continue
            const effort = fit.effort ?? helperTierRung(cfg, provider, tier)?.effort
            if (!effort || !levels.includes(effort)) continue
            if (now && now.provider === provider && now.model === model && now.effort === effort) continue
            const gain = gainOf(note, nowNote)
            if (gain.length) cands.push({ provider, model, effort, name: note.name, tags: gain })
          }
        }
      }
    }
    // The most strengths added first; on a tie Claude's, then the provider order the tier lists.
    const best = cands
      .map((c, at) => ({ c, at }))
      .filter(({ c }) => !i.dismissed.includes(tryKey(kind, c.provider, c.model, c.effort)))
      .sort((a, b) => b.c.tags.length - a.c.tags.length || a.at - b.at)[0]?.c
    if (!best) continue
    const where = best.provider === 'claude' ? '' : ` on ${providerLabel(best.provider)}`
    out.push({ ...best, kind, tier, key: tryKey(kind, best.provider, best.model, best.effort), text: `Try ${best.name} ${best.effort}${where} for ${kind} (${best.tags.join(' · ')})` })
  }

  return out
}

// --- The model map -------------------------------------------------------------------------

/** What would run a kind now, as its line shows it. */
export type RunsNow = { who: string; model: string; effort: string; source: string }

/** Per kind, where its steps would run now: a Claude agent (learned rung, the kind's default, or the tier's) and, with helpers on, the first helper. */
export const runsNow = (kind: string, tier: Tier, i: { set: Settings; learned?: Learned; learnedHelpers?: HelperLearned; cfg?: HelperConfig; helpersOn: boolean }): RunsNow[] => {
  const step = { ...newStep('map', kind, tier, 'agent'), kind }
  const c = baseRung(step, i.set, i.learned)
  const out: RunsNow[] = [{ who: 'Claude', model: c.model, effort: c.effort, source: c.source === 'auto' ? `auto, ${c.n} runs` : c.source === 'kind' ? 'kind default' : 'tier' }]
  if (i.helpersOn && i.cfg) {
    const pick = helperPickFor({ ...step, where: 'helper' }, i.set, i.learnedHelpers, i.cfg)
    if (pick) out.push({ who: providerLabel(pick.provider), model: pick.model, effort: pick.effort, source: pick.source === 'auto' ? `auto, ${pick.n} runs` : 'kind choice' })
    else {
      for (const template of helperList(i.set, tier)) {
        const r = templateRung(i.cfg, template)
        const provider = template.split('-')[0]!
        if (r && (isSelfProvider(r.provider) || i.cfg.providers[r.provider]?.self)) continue
        out.push({ who: providerLabel(r?.provider ?? provider), model: r?.model ?? template, effort: r?.effort ?? '', source: 'tier' })
        break
      }
    }
  }

  return out
}

export const runsNowText = (r: RunsNow) => `${r.who}: ${r.model}${r.effort ? ` ${r.effort}` : ''} (${r.source})`

/** A model note as one line of the map: name · tags · fits ("deep high, second high, standard medium"). */
export const noteMapLine = (n: ModelNote) =>
  `${n.name} · ${n.tags.join(', ') || 'no tags'} · ${n.fits.map(f => `${f.tier}${f.effort ? ` ${f.effort}` : ''}`).join(', ') || 'no fits'}`
