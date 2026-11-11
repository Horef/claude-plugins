// The model-router mod: plan tool, routing of tagged Agent calls, cost accounting, rules delivery and the pane.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, ModelUsage, Register } from 'claude-code'

import type { CostView, Effort, EffortSwitch, HelperChoice, HelperPick, HelperState, HelperTotals, HelperUsage, HistoryEntry, Lifetime, PlanNode, Rung, Settings, Step, StepDraft, StepKnown, Tier, Totals, Usage, Verdict, Where } from '../types'
import {
  EMPTY_HELPER,
  EMPTY_USAGE,
  PANE,
  PLAN_TOOL,
  SKILL_TAG,
  STATUS_GLYPH,
  STEP_TAG,
  addHelperTotals,
  addUsage,
  applyDraft,
  asHelperEffort,
  asHelperUsage,
  asScriptPath,
  asVerdict,
  baseRung,
  costOf,
  depthOf,
  descendantsOf,
  draftCount,
  effortOfTemplate,
  compareVersions,
  expandIds,
  flattenPlan,
  fmtCost,
  fmtTok,
  fmtUsd,
  genomeNote,
  helperEfforts,
  helperFacts,
  helperGain,
  helperItems,
  helperLine,
  helperList,
  helperName,
  helperOrder,
  helperPickFor,
  helperProviders,
  helperRungLabel,
  helperSuggestions,
  helperTierDiffers,
  helperTierNames,
  helperTierRung,
  helperSignature,
  helperTotalsOf,
  helpersOff,
  helperEffective,
  hereNeeds,
  isDelegated,
  isHelperRun,
  isSetupHeavy,
  isTemplateName,
  isTier,
  kindStats,
  kindsOf,
  knownChanges,
  knownModels,
  knownOf,
  learnedHelpers,
  learnedRungs,
  leavesOf,
  mergeSettings,
  modelsChecked,
  modelWarnings,
  modelHint,
  modelOf,
  moveHelper,
  newStep,
  noHelperCli,
  nextRung,
  normKind,
  offeredModels,
  orderIsCustom,
  parseHelperConfig,
  parseModelsCache,
  parseList,
  parsePrice,
  pickSource,
  planText,
  priceOf,
  rollupOf,
  runSpan,
  samePick,
  settleGroups,
  setHelperConfig,
  stepChangeNote,
  trimDraft,
  VERSION,
  rungLabel,
  rungStats,
  runsOn,
  suggestions,
  templateLabel,
  templateOfRung,
  templateRung,
  verdictLine,
  withoutZeroUsage,
} from './logic'
import type { HelperAdvice, Learned, Suggestion } from './logic'
import { DEFAULT_SETTINGS, EFFORT_LIMITS, EFFORTS, MODELS, PRICES, SCOPE_NOTE, TIER_ORDER, TIER_USE } from './tiers'

// --- State: the session's (atoms) and what is remembered across sessions ($.store) --

const steps = atom({ plugin: 'model-router', key: 'steps' } as const, [])
const main = atom({ plugin: 'model-router', key: 'main' } as const, { usage: EMPTY_USAGE, cost: 0 })
const planStatus = atom({ plugin: 'model-router', key: 'planStatus' } as const, 'none')
const autoApprove = atom({ plugin: 'model-router', key: 'autoApprove' } as const, false)
const alwaysPlan = atom({ plugin: 'model-router', key: 'alwaysPlan' } as const, false)
const settings = atom({ plugin: 'model-router', key: 'settings' } as const, DEFAULT_SETTINGS)
const history = atom({ plugin: 'model-router', key: 'history' } as const, [])
const seenSkills = atom({ plugin: 'model-router', key: 'seenSkills' } as const, [])
const showSettings = atom({ plugin: 'model-router', key: 'showSettings' } as const, false)
const notes = atom({ plugin: 'model-router', key: 'notes' } as const, [])
const told = atom({ plugin: 'model-router', key: 'told' } as const, {})
const toldHelpers = atom({ plugin: 'model-router', key: 'toldHelpers' } as const, '')
const policySent = atom({ plugin: 'model-router', key: 'policy' } as const, {})
const delivery = atom({ plugin: 'model-router', key: 'delivery' } as const, { inChat: false, planDue: false })
const EMPTY_TOTALS: Totals = { mainCost: 0, agentCost: 0, mainEquivalent: 0, steps: 0, helper: EMPTY_HELPER }
const newLifetime = (): Lifetime => ({ ...EMPTY_TOTALS, since: new Date().toISOString(), plans: 0, byTier: { light: 0, standard: 0, deep: 0 } })
const chatTotals = atom({ plugin: 'model-router', key: 'chatTotals' } as const, EMPTY_TOTALS)
const planBase = atom({ plugin: 'model-router', key: 'planBase' } as const, { mainCost: 0 })
const costView = atom({ plugin: 'model-router', key: 'costView' } as const, 'plan')
const lifetime = atom({ plugin: 'model-router', key: 'lifetime' } as const, newLifetime())
const effortLog = atom({ plugin: 'model-router', key: 'effortLog' } as const, [])
const lastMain = atom({ plugin: 'model-router', key: 'lastMain' } as const, { context: 0 })
const ruleKinds = atom({ plugin: 'model-router', key: 'ruleKinds' } as const, [])
const genomeNoted = atom({ plugin: 'model-router', key: 'genomeNoted' } as const, [])
const draft = atom({ plugin: 'model-router', key: 'draft' } as const, {})
const helperCfg = atom({ plugin: 'model-router', key: 'helperCfg' } as const, { status: 'unknown', warnings: [] })

const STORE = { auto: 'autoApprove', always: 'alwaysPlan', settings: 'settings', history: 'history', lifetime: 'lifetime', effortLog: 'effortLog', genome: 'genomeNoted' }
const EFFORT_LOG_CAP = 200
const HISTORY_CAP = 500

// What the router saw in this load, for the plan tool's status check.
const diag = { turns: 0, appends: 0, composes: 0, lastError: '' }

// Nothing is written to the store before what it holds has been read: a write that raced
// ahead of the load would put the defaults over the remembered values.
let loading: Promise<boolean> | undefined

/** Resolves once the remembered state is loaded (loading it if need be); false when loading failed, so nothing may be written. */
function ready($: EngineInterface) {
  loading ??= loadRemembered($).then(
    () => true,
    err => {
      diag.lastError = `load: ${String(err).slice(0, 200)}`
      loading = undefined

      return false
    },
  )

  return loading
}

// Read-modify-write of one stored value runs one at a time.
const locks = new Map<string, Promise<unknown>>()
function locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(key) ?? Promise.resolve()).then(fn)
  locks.set(key, run.catch(() => undefined))

  return run
}

// Settings, auto-approve and always-plan are also kept in a file outside the store, which a
// new store file (re-adding the marketplace) would otherwise lose.
const MIRROR = '.config/model-router/settings.json'

async function mirrorPath($: EngineInterface) {
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))

  return home ? `${home.replace(/[\\/]+$/, '')}/${MIRROR}` : undefined
}

type Mirror = { settings?: Partial<Settings>; autoApprove?: boolean; alwaysPlan?: boolean }

async function readMirror($: EngineInterface): Promise<Mirror | undefined> {
  try {
    const path = await mirrorPath($)
    if (!path) return undefined
    const parsed = JSON.parse(String(await $.fs.read(path))) as Mirror

    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

async function writeMirror($: EngineInterface) {
  try {
    const path = await mirrorPath($)
    if (!path) return
    await locked('mirror', async () => {
      // Another session may have changed them since this one last looked: the file follows the store.
      await syncShared($)
      const body = { settings: await read($, settings), autoApprove: await read($, autoApprove), alwaysPlan: await read($, alwaysPlan) }
      await $.fs.write(path, `${JSON.stringify(body, null, 2)}\n`)
    })
  } catch (err) {
    diag.lastError = `mirror: ${String(err).slice(0, 200)}`
  }
}

/** The user's config directory: $XDG_CONFIG_HOME, else ~/.config. */
const configBase = async ($: EngineInterface) => {
  const xdg = await $.env.get('XDG_CONFIG_HOME')
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  const base = xdg || (home ? `${home.replace(/[\\/]+$/, '')}/.config` : undefined)

  return base ? base.replace(/[\\/]+$/, '') : undefined
}

/** The thinking level a helper's template sets (its `command:` line), or nothing: no home, no such template, or no level on it. */
async function templateEffort($: EngineInterface, template: string) {
  try {
    if (!isTemplateName(template)) return undefined
    const base = await configBase($)
    if (!base) return undefined

    return effortOfTemplate(String(await $.fs.read(`${base}/herdr-core/templates/${template}.md`)))
  } catch {
    return undefined
  }
}

const asLifetime = (v: unknown): Lifetime | undefined => {
  const life = v as Lifetime | undefined
  if (!life?.since) return undefined
  const merged = { ...newLifetime(), ...life }

  return { ...merged, helper: { ...EMPTY_HELPER, ...merged.helper, usage: Array.isArray(merged.helper?.usage) ? merged.helper.usage : [] } }
}

/**
 * Brings the session's settings, auto-approve and always-plan up to what the store holds, which another
 * session may have changed since this one loaded. Reads only; nothing is written.
 */
async function syncShared($: EngineInterface) {
  await locked('settings', async () => {
    const stored = await $.store.get(STORE.settings)
    if (stored === undefined) return
    const next = mergeSettings(stored as Partial<Settings>)
    if (JSON.stringify(next) !== JSON.stringify(await read($, settings))) await update($, settings, () => next)
  })
  const auto = await $.store.get(STORE.auto)
  if (typeof auto === 'boolean' && auto !== (await read($, autoApprove))) await update($, autoApprove, () => auto)
  const always = await $.store.get(STORE.always)
  if (typeof always === 'boolean' && always !== (await read($, alwaysPlan))) await update($, alwaysPlan, () => always)
}

/** `syncShared`, once the remembered state is loaded (and only then: before it, the store is not read). */
async function refreshShared($: EngineInterface) {
  if (!(await ready($))) return
  try {
    await syncShared($)
  } catch (err) {
    diag.lastError = `refresh: ${String(err).slice(0, 200)}`
  }
}

async function loadRemembered($: EngineInterface) {
  const stored = (await $.store.get(STORE.settings)) as Partial<Settings> | undefined
  const storedAuto = await $.store.get(STORE.auto)
  const storedAlways = await $.store.get(STORE.always)
  // The store wins; the mirror fills what a fresh store lacks.
  const needsMirror = stored === undefined || storedAuto === undefined || storedAlways === undefined
  const mirror = needsMirror ? await readMirror($) : undefined
  const restored = stored ?? (mirror?.settings && typeof mirror.settings === 'object' ? mirror.settings : undefined)
  const auto = storedAuto ?? (typeof mirror?.autoApprove === 'boolean' ? mirror.autoApprove : undefined)
  const always = storedAlways ?? (typeof mirror?.alwaysPlan === 'boolean' ? mirror.alwaysPlan : undefined)
  if (stored === undefined && restored) await $.store.set(STORE.settings, mergeSettings(restored))
  if (storedAuto === undefined && auto !== undefined) await $.store.set(STORE.auto, auto)
  if (storedAlways === undefined && always !== undefined) await $.store.set(STORE.always, always)

  await update($, settings, () => mergeSettings(restored))
  const switches = (await $.store.get(STORE.effortLog)) as EffortSwitch[] | undefined
  await update($, effortLog, () => (Array.isArray(switches) ? switches : []))
  await update($, autoApprove, () => auto === true)
  await update($, alwaysPlan, () => always === true)
  const past = (await $.store.get(STORE.history)) as HistoryEntry[] | undefined
  await update($, history, () => (Array.isArray(past) ? past : []))
  // An amount of 0 that an older version stored for "no usage shown" is dropped; written back at once.
  const life = await locked('lifetime', async () => {
    const was = asLifetime(await $.store.get(STORE.lifetime)) ?? newLifetime()
    const helper = withoutZeroUsage(was.helper)
    if (helper === was.helper) return was
    const cleaned = { ...was, helper }
    await $.store.set(STORE.lifetime, cleaned)

    return cleaned
  })
  await update($, lifetime, () => life)
  const noted = await $.store.get(STORE.genome)
  await update($, genomeNoted, () => (Array.isArray(noted) ? noted.filter((x): x is string => typeof x === 'string') : []))
  // The store is the source: bring the mirror up to date with it.
  if (stored !== undefined) await writeMirror($)
}

async function editLifetime($: EngineInterface, fn: (l: Lifetime) => Lifetime) {
  const ok = await ready($)
  await locked('lifetime', async () => {
    // Applied to what the store holds, so an atom that is behind never overwrites it.
    const base = (ok ? asLifetime(await $.store.get(STORE.lifetime)) : undefined) ?? (await read($, lifetime))
    const next = fn(base)
    if (ok) await $.store.set(STORE.lifetime, next)
    await update($, lifetime, () => next)
  })
}

async function setAuto($: EngineInterface, on: boolean) {
  const ok = await ready($)
  await update($, autoApprove, () => on)
  if (!ok) return
  await $.store.set(STORE.auto, on)
  await writeMirror($)
}

async function setAlways($: EngineInterface, on: boolean) {
  const ok = await ready($)
  await update($, alwaysPlan, () => on)
  if (!ok) return
  await $.store.set(STORE.always, on)
  await writeMirror($)
}

async function editSettings($: EngineInterface, fn: (s: Settings) => Settings) {
  const ok = await ready($)
  await locked('settings', async () => {
    // Applied to what the store holds, so a session that loaded earlier never writes its older copy over newer settings.
    const stored = ok ? await $.store.get(STORE.settings) : undefined
    const next = fn(stored !== undefined ? mergeSettings(stored as Partial<Settings>) : await read($, settings))
    await update($, settings, () => next)
    if (ok) await $.store.set(STORE.settings, next)
  })
  if (ok) await writeMirror($)
}

async function editHistory($: EngineInterface, fn: (h: HistoryEntry[]) => HistoryEntry[]) {
  const ok = await ready($)
  await locked('history', async () => {
    const stored = ok ? ((await $.store.get(STORE.history)) as HistoryEntry[] | undefined) : undefined
    const next = fn(Array.isArray(stored) ? stored : await read($, history)).slice(-HISTORY_CAP)
    if (ok) await $.store.set(STORE.history, next)
    await update($, history, () => next)
  })
  await noteForGenome($)
  await resolveHelperPicks($)
}

/** Auto mode's learned rung per kind, or nothing while auto mode is off. */
async function learnedOf($: EngineInterface): Promise<Learned | undefined> {
  const set = await read($, settings)

  return set.autoRoute ? learnedRungs(await read($, history), set) : undefined
}

/** The strange-loop unit an observation about a kind belongs to: the skill of that name, else model-router. */
async function unitOf($: EngineInterface, kind: string) {
  const skills = [...Object.keys((await read($, settings)).skills), ...(await read($, seenSkills))].map(normKind)

  return skills.includes(kind) ? kind : 'model-router'
}

/** Whether this machine has a strange-loop genome (the file ~/.config/strange-loop/genome that the note's command reads). */
async function genomeKnown($: EngineInterface) {
  try {
    const base = await configBase($)

    return !!base && (await readText($, `${base}/strange-loop/genome`)) !== undefined
  } catch {
    return false
  }
}

/**
 * Advice for a kind that has just reached its threshold queues one router note asking the lead
 * to record a strange-loop observation (model-router O1): once per kind and direction, remembered.
 */
async function noteForGenome($: EngineInterface) {
  const items = suggestions(await read($, history), await read($, settings)).filter(a => a.kind)
  if (items.length === 0) return
  const ok = await ready($)
  const keyOf = (a: Suggestion) => `${a.kind}:${a.isRaise ? 'up' : 'down'}`
  let fresh: Suggestion[] = []
  await locked('genome', async () => {
    const stored = ok ? await $.store.get(STORE.genome) : undefined
    const was = Array.isArray(stored) ? (stored as string[]) : await read($, genomeNoted)
    fresh = items.filter(a => !was.includes(keyOf(a)))
    if (fresh.length === 0) return
    // The note's command runs the strange-loop genome's loop.py: with no genome file there is nothing to record into, and nothing is marked as noted.
    if (!(await genomeKnown($))) {
      fresh = []
      return
    }
    const next = [...was, ...fresh.map(keyOf)].slice(-500)
    if (ok) await $.store.set(STORE.genome, next)
    await update($, genomeNoted, () => next)
  })
  for (const a of fresh) {
    const note = genomeNote(a, await unitOf($, a.kind!))
    await update($, notes, n => [...n, note])
  }
}

/** A model seen in usage that the router does not know yet joins the known models (and the pickers). */
async function rememberModel($: EngineInterface, model: string | undefined) {
  if (!model || knownModels(await read($, settings)).includes(model)) return
  await editSettings($, s => (knownModels(s).includes(model) ? s : { ...s, models: [...s.models, model].slice(-30) }))
}

// --- What the main agent knows of the plan ----------------------------------------------

/** Records every step as the agent now knows it: it was just handed the plan, or told of the change. */
async function tellSteps($: EngineInterface, only?: readonly string[]) {
  const set = await read($, settings)
  const learned = await learnedOf($)
  const list = (await read($, steps)).filter(s => !only || only.includes(s.id))
  await update($, told, t => ({ ...t, ...Object.fromEntries(list.map(s => [s.id, knownOf(s, set, learned)])) }))
}

/** Steps the user changed since the agent last knew them, final value against known value. Only while a plan is approved. */
async function stepChanges($: EngineInterface) {
  if ((await read($, planStatus)) !== 'approved') return []
  const set = await read($, settings)
  const learned = await learnedOf($)
  const was = await read($, told)

  return (await read($, steps)).flatMap(s => {
    const known = was[s.id]
    const note = !s.group && s.status !== 'done' && known ? stepChangeNote(s, known, knownOf(s, set, learned)) : undefined

    return note ? [{ id: s.id, note }] : []
  })
}

/** Notes reached the agent: if one named the helper orders, it now knows them as they stand. */
async function noteDelivered($: EngineInterface, delivered: readonly string[]) {
  if (!delivered.some(n => n.startsWith(HELPER_NOTE))) return
  const sig = helperSignature(await read($, settings))
  await update($, toldHelpers, () => sig)
}

// --- Actions ------------------------------------------------------------------

async function summary($: EngineInterface) {
  const list = await read($, steps)
  const set = await read($, settings)
  const sent = await read($, policySent)
  const always = await read($, alwaysPlan)

  // No plan: say the router is on and whether the active model has its rules.
  if (list.length === 0) {
    const rules = sent.model ? `rules sent to ${sent.model}` : 'rules go out with your next message'
    return `⇄ Router on · ${rules}${always ? ' · always plan' : ''} · /router for the pane`
  }

  const status = await read($, planStatus)
  // Groups are the sum of their parts: counted and drawn once, through the parts.
  const work = leavesOf(list)
  const done = work.filter(s => s.status === 'done').length
  const running = work.find(s => s.status === 'running')
  const cost = list.reduce((n, s) => n + s.cost, 0)
  const saved = list.reduce((n, s) => n + Math.max(0, s.mainCost - s.cost), 0)
  const dots = work.map(s => STATUS_GLYPH[s.status]).join('')
  const head = status === 'pending' ? 'plan awaiting approval' : `${done}/${work.length} done`
  const now = running ? ` · ${running.id} on ${rungLabel(runsOn(running, set, await learnedOf($)))}` : ''
  const money = cost > 0 ? ` · plan agents ≈${fmtUsd(cost)}${saved > 0 ? `, saved ≈${fmtUsd(saved)}` : ''}` : ''

  return `⇄ Router ${dots} ${head}${now}${money} · /router`
}

async function refreshStatus($: EngineInterface) {
  $.ui.status(await summary($))
}

/** Changes the plan's steps; a group's status follows its parts. */
async function setSteps($: EngineInterface, fn: (list: Step[]) => Step[]) {
  await update($, steps, list => settleGroups(fn(list)))
}

async function editStep($: EngineInterface, id: string, fn: (s: Step) => Step) {
  await setSteps($, list => list.map(s => (s.id === id ? fn(s) : s)))
  await refreshStatus($)
}

async function clearPlan($: EngineInterface) {
  await update($, steps, () => [])
  await update($, draft, () => ({}))
  await update($, planStatus, () => 'none')
  await refreshStatus($)
}

/**
 * A change made in the pane to where, tier, model or thinking of a step. While the plan is running it goes to a draft,
 * which neither the routing nor the agent sees until Send; before approval the plan takes it at once, since approval sends it.
 */
async function paneEdit($: EngineInterface, id: string, patch: StepDraft) {
  if ((await read($, planStatus)) !== 'approved') {
    await editStep($, id, s => applyDraft(s, patch))
    await resolveHelperPicks($)
    return
  }
  const step = (await read($, steps)).find(s => s.id === id)
  if (!step) return
  await update($, draft, d => {
    const next = { ...d }
    const kept = trimDraft(step, { ...d[id], ...patch })
    if (kept) next[id] = kept
    else delete next[id]

    return next
  })
}

/** Send changes: the draft becomes the plan's values (routing of steps not yet started uses them at once); the next turn's note carries the final values. */
async function sendDraft($: EngineInterface) {
  const held = await read($, draft)
  if (draftCount(held) === 0) return
  await setSteps($, list => list.map(s => applyDraft(s, held[s.id])))
  await update($, draft, () => ({}))
  await refreshStatus($)
  await resolveHelperPicks($)
}

async function discardDraft($: EngineInterface) {
  await update($, draft, () => ({}))
}

/** The fields a step's next run starts from: the verdict and history entry of the last run no longer apply. */
const freshRun = (s: Step): Step => ({
  ...s,
  status: 'planned',
  runs: 0,
  reruns: s.reruns + 1,
  verdict: undefined,
  why: undefined,
  asked: undefined,
  historyKey: undefined,
  startedAt: undefined,
  priorOutput: s.usage.output,
})

/** Moves a finished step one rung up the ladder and asks the main agent to redo it. */
async function rerun($: EngineInterface, id: string) {
  const set = await read($, settings)
  const step = (await read($, steps)).find(s => s.id === id)
  const up = step && !step.group && nextRung(runsOn(step, set, await learnedOf($)), set)
  if (!step || !up) return
  if (step.historyKey) {
    await editHistory($, h => h.map(x => (x.key === step.historyKey ? { ...x, rerun: true } : x)))
  }
  await editStep($, id, s => ({ ...freshRun(s), model: up.model, effort: up.effort }))
  // The rerun sets the step's model and thinking itself: unsent edits of those no longer apply.
  await update($, draft, d => {
    const { [id]: mine, ...rest } = d
    if (!mine) return d
    const { model: _m, effort: _e, ...others } = mine

    return Object.keys(others).length > 0 ? { ...rest, [id]: others } : rest
  })
  // The prompt below tells the agent of the new rung itself.
  await tellSteps($, [id])
  await $.prompt.submit({
    text: `[model-router] Please rerun step [${id}] "${step.title}": its result was not good enough, so it moves up to ${rungLabel(up)}. Delegate it again with the same brief, its description starting "[${id}]".`,
  })
}

/**
 * Marks steps done; a group stands for its unfinished parts. Records a helper step's end time and its reported usage (once),
 * the lead's verdict on a delegated step (a group's verdict goes to its delegated parts), and a helper run in the history.
 */
async function markDone($: EngineInterface, named: { id: string; ref: DoneRef }[]) {
  const before = await read($, steps)
  const targets = expandIds(before, named.map(n => n.id))
  const usage = new Map(named.flatMap(n => (typeof n.ref === 'object' && asHelperUsage(n.ref.usage) ? [[n.id, asHelperUsage(n.ref.usage)!] as const] : [])))
  const verdicts = new Map<string, { verdict: Verdict; why?: string }>()
  for (const n of named) {
    const v = typeof n.ref === 'object' ? asVerdict(n.ref.verdict) : undefined
    if (!v || typeof n.ref !== 'object') continue
    const why = typeof n.ref.why === 'string' && n.ref.why.trim() ? n.ref.why.trim().slice(0, 200) : undefined
    for (const id of expandIds(before, [n.id])) verdicts.set(id, { verdict: v, ...(why ? { why } : {}) })
  }
  const now = new Date().toISOString()
  await setSteps($, list =>
    list.map(s => {
      if (!targets.has(s.id)) return s
      const first = s.status !== 'done'
      const reported = usage.get(s.id)
      const next: Step = { ...s, status: 'done' }
      if (first && isHelperRun(s)) next.endedAt = now
      if (reported && !s.helperUsage) next.helperUsage = reported
      const judged = isDelegated(s) ? verdicts.get(s.id) : undefined
      if (judged) {
        next.verdict = judged.verdict
        next.why = judged.why
      }

      return next
    }),
  )
  const after = await read($, steps)

  // A helper run enters the history when it is first done; a verdict goes onto the run it judges.
  const added: HistoryEntry[] = []
  const keyOf = new Map<string, string>()
  const hcfg = (await read($, helperCfg)).config
  for (const s of after) {
    const was = before.find(x => x.id === s.id)
    if (s.group || !isHelperRun(s) || s.status !== 'done' || was?.status === 'done' || s.historyKey) continue
    const ms = runSpan(s)
    const key = `${now}:${s.id}`
    keyOf.set(s.id, key)
    // The model and level it ran on: the router's own pick if that is what was launched, else what the template stands for now.
    const picked = s.helperPick?.template && s.helperPick.template === s.helper ? s.helperPick : undefined
    const tpl = s.helper ? templateRung(hcfg, s.helper) : undefined
    const hrung: HelperChoice | undefined = picked
      ? { provider: picked.provider, model: picked.model, effort: picked.effort }
      : tpl
        ? { provider: tpl.provider, model: tpl.model, effort: tpl.effort }
        : undefined
    added.push({
      key,
      tier: s.tier,
      where: 'helper',
      ...(s.helper ? { helper: s.helper } : {}),
      ...(hrung ? { hrung } : {}),
      ...(s.kind ? { kind: s.kind } : {}),
      cost: 0,
      setupHeavy: false,
      rerun: false,
      reruns: s.reruns,
      ...(ms > 0 ? { ms } : {}),
      ...(s.verdict ? { verdict: s.verdict, ...(s.why ? { why: s.why } : {}) } : {}),
      at: now,
    })
  }
  if (keyOf.size) await update($, steps, list => list.map(s => (keyOf.has(s.id) ? { ...s, historyKey: keyOf.get(s.id) } : s)))
  const judged = after.filter(s => verdicts.has(s.id) && isDelegated(s) && s.historyKey && !keyOf.has(s.id))
  if (added.length || judged.length) {
    await editHistory($, h => [
      ...h.map(x => {
        const s = judged.find(j => j.historyKey === x.key)
        if (!s) return x
        const { why: _, ...rest } = x

        return { ...rest, verdict: s.verdict, ...(s.why ? { why: s.why } : {}) }
      }),
      ...added,
    ])
  }

  const gain = helperGain(before, after)
  if (gain.steps === 0 && gain.usage.length === 0) return
  await update($, chatTotals, t => ({ ...t, helper: addHelperTotals(t.helper, gain) }))
  await editLifetime($, l => ({ ...l, helper: addHelperTotals(l.helper, gain) }))
}

/** The line a plan tool result carries for finished delegated steps that have no verdict yet: asked once, or when named again. */
async function verdictsMissing($: EngineInterface, named: readonly string[]) {
  const list = await read($, steps)
  const again = expandIds(list, named)
  // A subagent step that never ran (marked done unrun) has nothing to judge.
  const ran = (s: Step) => isHelperRun(s) || !!s.startedAt || !!s.historyKey
  const missing = list.filter(s => isDelegated(s) && s.status === 'done' && !s.verdict && ran(s) && (!s.asked || again.has(s.id)))
  if (missing.length === 0) return undefined
  const ids = new Set(missing.map(s => s.id))
  await update($, steps, l => l.map(s => (ids.has(s.id) ? { ...s, asked: true } : s)))

  return `Verdict needed for ${missing.map(s => `[${s.id}]`).join(', ')}: call ${PLAN_TOOL} with done: [{id, verdict: "ok" | "weak" | "overkill", why}] (rule 5). Until then each counts as "no verdict".`
}

/** Marks steps running (a group: its unfinished parts) and records the helper a step was launched on. */
async function markStarted($: EngineInterface, named: { id: string; ref: StartRef }[]) {
  const targets = expandIds(await read($, steps), named.map(n => n.id))
  const launched = new Map(
    named.flatMap(n => (typeof n.ref === 'object' && (n.ref.helper || n.ref.model || n.ref.effort) ? [[n.id, n.ref] as const] : [])),
  )
  // The thinking level shown beside the model: what the lead reported, else what the helper's template sets.
  const efforts = new Map<string, string | undefined>()
  for (const [id, ref] of launched) {
    const reported = asHelperEffort(ref.effort)
    if (reported) efforts.set(id, reported)
    else if (ref.helper) efforts.set(id, await templateEffort($, ref.helper.trim()))
  }
  const now = new Date().toISOString()
  // One here step runs at a time: starting one sets an unfinished other back to planned.
  await setSteps($, list =>
    list.map(s => {
      if (s.group) return s
      if (!targets.has(s.id) || s.status === 'done') return s.where === 'here' && s.status === 'running' ? { ...s, status: 'planned' } : s
      const on = launched.get(s.id)
      const next: Step = { ...s, status: 'running' }
      if (on?.helper) next.helper = on.helper.trim()
      if (on?.model) next.helperModel = on.model.trim()
      if (efforts.has(s.id)) next.helperEffort = efforts.get(s.id)
      if (on || s.where === 'helper') next.startedAt = s.startedAt ?? now

      return next
    }),
  )
}

async function applySuggestion($: EngineInterface, s: Suggestion) {
  const to: Rung = { model: s.to.model, effort: s.to.effort }
  if (s.kind) {
    const kind = s.kind
    await editSettings($, set => ({ ...set, kinds: { ...set.kinds, [kind]: to } }))
    return
  }
  if (!s.tier) return
  const tier = s.tier
  await editSettings($, set => ({ ...set, tiers: { ...set.tiers, [tier]: { ...set.tiers[tier], ...to } } }))
}

// --- Helper models: helpers.py's config, read and changed through $.process ----------------

// One-off templates made in this chat, by provider, model and level; a failed attempt is kept too, so a plan does not retry it at every call.
const madeTemplates = new Map<string, { template?: string; error?: string }>()

const readText = async ($: EngineInterface, path: string) => {
  try {
    return String(await $.fs.read(path))
  } catch {
    return undefined
  }
}

const firstLine = (text: string) =>
  text
    .split(/\r?\n/)
    .map(l => l.trim())
    .find(Boolean)
    ?.replace(/^error:\s*/i, '')
    .slice(0, 200) ?? ''

/** helpers.py: the path set in Settings, else the newest installed herdr-delegate skill's (under $CLAUDE_CONFIG_DIR, default ~/.claude: plugins/cache/<marketplace>/herdr-delegate/<version>/...). */
async function findHelpers($: EngineInterface, set: Settings): Promise<string | undefined> {
  if (set.helpers.script) return set.helpers.script
  try {
    const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
    const claude = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (home ? `${home.replace(/[\\/]+$/, '')}/.claude` : undefined)
    if (!claude) return undefined
    const root = `${claude.replace(/[\\/]+$/, '')}/plugins/cache`
    const found: { path: string; version: string }[] = []
    for (const market of await $.fs.list(root)) {
      if (market.kind === 'file') continue
      const base = `${root}/${market.name}/herdr-delegate`
      let versions: Awaited<ReturnType<typeof $.fs.list>>
      try {
        versions = await $.fs.list(base)
      } catch {
        continue
      }
      for (const v of versions) {
        const path = `${base}/${v.name}/skills/herdr-delegate/scripts/helpers.py`
        if (v.kind !== 'file' && (await $.fs.exists(path))) found.push({ path, version: v.name })
      }
    }

    return found.sort((a, b) => compareVersions(b.version, a.version))[0]?.path
  } catch {
    return undefined
  }
}

/** Runs helpers.py with python; rejects when python cannot start or the run times out. */
async function runHelpers($: EngineInterface, script: string, args: string[], timeoutMs = 60_000) {
  const python = (await $.env.get('HOME')) ? 'python3' : 'python'

  return $.process.run([python, script, ...args], { timeoutMs })
}

const modelsPath = async ($: EngineInterface) => {
  const base = await configBase($)

  return base ? `${base}/herdr-delegate/models.json` : undefined
}

/** Reads helpers.py's effective config, the shipped defaults beside it and the model cache; run at the start, when Helpers go on, and after a change. */
async function loadHelperConfig($: EngineInterface) {
  const set = await read($, settings)
  if (!set.helpers.enabled) return
  madeTemplates.clear()
  const keep = (await read($, helperCfg)).warnings
  const script = await findHelpers($, set)
  if (!script) {
    setHelperConfig(undefined)
    await update($, helperCfg, () => ({ status: 'missing', warnings: [] }))
    return
  }
  try {
    const r = await runHelpers($, script, ['config'], 30_000)
    const config = r.exitCode === 0 ? parseHelperConfig(r.stdout) : undefined
    if (!config) {
      setHelperConfig(undefined)
      const message = r.exitCode === 2 ? 'This helpers.py has no config command: update herdr-delegate to 0.6.0 or later.' : `helpers.py config failed: ${firstLine(r.stderr || r.stdout) || `exit ${r.exitCode}`}`
      await update($, helperCfg, () => ({ status: 'error', script, warnings: [], message }))
      return
    }
    setHelperConfig(config)
    const skill = script.replace(/[\\/]scripts[\\/][^\\/]*$/, '')
    const defaults = parseHelperConfig((await readText($, `${skill}/helpers.default.json`)) ?? '')
    const path = await modelsPath($)
    const models = path ? parseModelsCache((await readText($, path)) ?? '') : undefined
    await update($, helperCfg, () => ({ status: 'ready', script, config, ...(defaults ? { defaults } : {}), ...(models ? { models } : {}), warnings: keep }))
  } catch (err) {
    setHelperConfig(undefined)
    await update($, helperCfg, () => ({ status: 'error', script, warnings: [], message: `helpers.py could not run: ${String(err).slice(0, 160)}` }))
    return
  }
  await resolveHelperPicks($)
}

/** The shell line for changing a tier by hand, shown where the router cannot run helpers.py itself. */
const SET_BY_HAND = 'python3 <path to herdr-delegate>/skills/herdr-delegate/scripts/helpers.py set <provider> <tier> model=<model> effort=<effort>'

/**
 * Changes a provider's tier through `helpers.py set` (which checks the model and level and renders the template), then reads the config again.
 * Runs that happened before this change and have no recorded model stay with the model they ran on.
 */
async function changeHelperTier($: EngineInterface, provider: string, tier: string, patch: Partial<HelperChoice>) {
  await locked('helper-set', async () => {
    const st = await read($, helperCfg)
    const now = helperTierRung(st.config, provider, tier)
    if (st.status !== 'ready' || !st.script || !now) return
    const next = { model: patch.model ?? now.model, effort: patch.effort ?? now.effort }
    if (next.model === now.model && next.effort === now.effort) return
    await stampHelperRuns($, `${provider}-${tier}`, { provider, ...now })
    try {
      const r = await runHelpers($, st.script, ['set', provider, tier, `model=${next.model}`, `effort=${next.effort}`])
      if (r.exitCode !== 0) {
        await update($, helperCfg, x => ({ ...x, message: firstLine(r.stderr || r.stdout) || `helpers.py set failed (exit ${r.exitCode})` }))
        return
      }
    } catch (err) {
      await update($, helperCfg, x => ({ ...x, message: `helpers.py could not run: ${String(err).slice(0, 160)}` }))
      return
    }
    await update($, helperCfg, x => ({ ...x, message: undefined }))
    await loadHelperConfig($)
  })
}

/** Gives the helper runs of a template that were recorded without a model the one the template stands for now, before it changes. */
async function stampHelperRuns($: EngineInterface, template: string, was: HelperChoice) {
  const lacking = (await read($, history)).some(x => x.where === 'helper' && x.helper === template && !x.hrung)
  if (lacking) await editHistory($, h => h.map(x => (x.where === 'helper' && x.helper === template && !x.hrung ? { ...x, hrung: was } : x)))
}

/** `helpers.py models`: asks each installed CLI what it offers, then shows what is no longer offered and what is newer. */
async function checkModels($: EngineInterface) {
  const st = await read($, helperCfg)
  if (st.status !== 'ready' || !st.script || st.busy) return
  await update($, helperCfg, x => ({ ...x, busy: true, message: undefined }))
  try {
    const r = await runHelpers($, st.script, ['models'], 180_000)
    const warnings = modelWarnings(r.stdout)
    await update($, helperCfg, x => ({ ...x, warnings, message: r.exitCode === 0 ? undefined : firstLine(r.stderr || r.stdout) || `helpers.py models failed (exit ${r.exitCode})` }))
  } catch (err) {
    await update($, helperCfg, x => ({ ...x, message: `helpers.py could not run: ${String(err).slice(0, 160)}` }))
  }
  await loadHelperConfig($)
  await update($, helperCfg, x => ({ ...x, busy: false }))
}

/** The template to launch for a pick: a tier template that already has this model and level, else a one-off made by `helpers.py custom`. */
async function templateFor($: EngineInterface, st: HelperState, want: HelperChoice, tier: Tier): Promise<{ template?: string; error?: string }> {
  const existing = st.config ? templateOfRung(st.config, want.provider, want, tier) : undefined
  if (existing) return { template: existing }
  const key = `${want.provider}|${want.model}|${want.effort}`
  const hit = madeTemplates.get(key)
  if (hit) return hit
  if (!st.script) return { error: 'helpers.py not found' }
  try {
    const r = await runHelpers($, st.script, ['custom', want.provider, `model=${want.model}`, `effort=${want.effort}`])
    const name = r.stdout.trim().split(/\r?\n/).at(-1)?.trim() ?? ''
    const made = r.exitCode === 0 && isTemplateName(name) ? { template: name } : { error: firstLine(r.stderr || r.stdout) || `helpers.py custom failed (exit ${r.exitCode})` }
    madeTemplates.set(key, made)

    return made
  } catch (err) {
    return { error: `helpers.py could not run: ${String(err).slice(0, 120)}` }
  }
}

// A router note about a helper step's launch template starts with this, so a newer one replaces it.
const LAUNCH_NOTE = 'Helper launch'

/**
 * Gives each helper step that has not started the model and level the router picks for it (auto mode's learned rung for its kind,
 * else its kind's stored choice) and the template to launch; the plan text and the card say so. A step with no pick keeps the tier order.
 */
async function resolveHelperPicks($: EngineInterface) {
  try {
    await locked('picks', async () => {
      const set = await read($, settings)
      const st = await read($, helperCfg)
      if (!set.helpers.enabled || st.status !== 'ready' || !st.config) return
      const learned = set.autoRoute ? learnedHelpers(await read($, history), set, st.config, st.models) : undefined
      const next = new Map<string, HelperPick | undefined>()
      for (const s of await read($, steps)) {
        if (s.group || s.where !== 'helper' || s.status !== 'planned' || s.helper) continue
        const want = helperPickFor(s, set, learned, st.config)
        if (!want) {
          if (s.helperPick) next.set(s.id, undefined)
          continue
        }
        if (samePick(s.helperPick, want) && (s.helperPick?.template || s.helperPick?.error)) continue
        next.set(s.id, { ...want, ...(await templateFor($, st, want, s.tier)) })
      }
      if (next.size === 0) return
      const before = await read($, steps)
      await setSteps($, list => list.map(s => (next.has(s.id) ? { ...s, helperPick: next.get(s.id) } : s)))
      // The lead was told the plan already: it hears of a template that changed.
      if ((await read($, planStatus)) !== 'approved') return
      const was = await read($, told)
      for (const [id, pick] of next) {
        const old = before.find(x => x.id === id)
        if (!old || !was[id] || old.helperPick?.template === pick?.template) continue
        const text = pick?.template
          ? `${LAUNCH_NOTE} for step [${id}] "${old.title}" changed: launch ${pick.template} (${pickSource(pick)}), then the tier order if it is not usable.`
          : `${LAUNCH_NOTE} for step [${id}] "${old.title}" changed: no template is named any more; use the tier order.`
        await update($, notes, n => [...n.filter(x => !x.startsWith(`${LAUNCH_NOTE} for step [${id}]`)), text])
      }
    })
  } catch (err) {
    diag.lastError = `picks: ${String(err).slice(0, 200)}`
  }
}

/** Applies the history's advice for a helper: a tier through `helpers.py set`, a kind as the model the router launches for it. */
async function applyHelperAdvice($: EngineInterface, a: HelperAdvice) {
  if (a.kind) {
    const kind = a.kind
    await editSettings($, set => ({ ...set, helpers: { ...set.helpers, kinds: { ...set.helpers.kinds, [kind]: { provider: a.provider, model: a.to.model, effort: a.to.effort } } } }))
    await resolveHelperPicks($)
    return
  }
  if (a.tier) await changeHelperTier($, a.provider, a.tier, a.to)
}

// --- The plan tool ---------------------------------------------------------------

/**
 * Registers the plan tool. The schema offers where = 'helper' only while Helpers are on,
 * so with them off it is the 0.9.3 schema exactly. It is registered when the chat starts
 * and again when Helpers are switched in the pane: a name registered again is replaced
 * (the engine's documented behaviour). The tool call also stores 'helper' as 'agent' while off.
 */
async function registerPlanTool($: EngineInterface) {
  const set = await read($, settings)
  const wheres = set.helpers.enabled ? ['agent', 'here', 'helper'] : ['agent', 'here']
  const helpersOn = set.helpers.enabled
  const hereOn = set.hereEffort.enabled
  const id = { type: 'string', description: 'Step id' }
  // Offered only while here-step effort or helpers are on, so with both off the schema is as before.
  const start =
    hereOn || helpersOn
      ? {
          start: {
            type: 'array',
            items: helpersOn
              ? {
                  anyOf: [
                    { type: 'string' },
                    {
                      type: 'object',
                      properties: {
                        id,
                        helper: { type: 'string', description: 'The helper template you launched, e.g. copilot-standard' },
                        model: { type: 'string', description: 'The model the helper reports on its screen' },
                        effort: { type: 'string', description: 'The thinking level the helper reports on its screen, if it shows one (e.g. high)' },
                      },
                      required: ['id'],
                    },
                  ],
                }
              : { type: 'string' },
            description: `Step ids you are starting now${hereOn ? ': the router runs this chat at a here step\'s tier\'s effort' : ''}${helpersOn ? '. A helper step may be {id, helper, model, effort}: the template you launched, and the model and thinking level its screen shows' : ''}`,
          },
        }
      : {}
  // A done item is an id or {id, verdict, why}; with helpers on it may also carry the helper's usage.
  const done = {
    type: 'array',
    items: {
      anyOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: {
            id,
            verdict: {
              type: 'string',
              enum: ['ok', 'weak', 'overkill'],
              description: 'For a delegated step: ok = result used as returned or with small edits; weak = it needed a rerun, you redid part of it, or review found a substantive error; overkill = plainly mechanical work (finding, listing, extracting, short output, no judgment) that ran above the light tier',
            },
            why: { type: 'string', description: 'A few words on the verdict' },
            ...(helpersOn
              ? {
                  usage: {
                    type: 'object',
                    description: 'A helper step\'s usage, exactly as `helpers.py usage <name>` printed it, e.g. {provider: "copilot", amount: 30.04, unit: "AIC"} or {provider: "codex", amount: 1.5, unit: "% of 7d"}. Leave it out when that printed nothing; never send 0 or a guess',
                    properties: { provider: { type: 'string' }, amount: { type: 'number' }, unit: { type: 'string' } },
                    required: ['provider', 'amount', 'unit'],
                  },
                }
              : {}),
          },
          required: ['id'],
        },
      ],
    },
    description: 'Step ids now done, with your verdict on each delegated step; a group id marks its unfinished parts done too',
  }
  await $.tool.register({
    name: 'plan',
    description:
      'Model router: set the plan for the current task (steps replaces the plan and waits for the user to approve it; overrides the user set are kept for step ids that stay) and/or mark steps done. A step may have parts (sub-steps, nested as deep as needed).',
    inputSchema: {
      type: 'object',
      properties: {
        steps: { type: 'array', items: stepSchema(wheres, PARTS_DEPTH) },
        done,
        ...start,
        status: { type: 'boolean', description: 'Report what the router sees (version, rule delivery, counters) instead of the plan' },
      },
    },
    isDeferred: false,
  })
}

// How many levels of `parts` the tool's schema spells out (a schema cannot refer to itself
// everywhere); a plan nested deeper is still taken.
const PARTS_DEPTH = 3

/** The schema of one plan step; `levels` more levels of parts may sit inside it. */
function stepSchema(wheres: string[], levels: number): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      id: { type: 'string', description: levels === PARTS_DEPTH ? 'Short id, e.g. s1. A part\'s id extends its parent\'s: s1.a, s1.a.1' : 'Id extending the parent\'s, e.g. s1.a' },
      title: { type: 'string', description: 'A few words' },
      tier: {
        type: 'string',
        enum: TIER_ORDER,
        description: 'How hard the step is. Picks the model of a subagent or helper; for a "here" step or a step with parts it is only a rating',
      },
      where: { type: 'string', enum: wheres },
      kind: { type: 'string', description: 'Short label for the kind of work (e.g. code-review, summarize, search, write-code, figure); reuse a kind the rules list' },
      count: { type: 'integer', minimum: 2, description: 'N identical agents with this id, run in parallel (a step without parts)' },
      ...(levels > 0
        ? {
            parts: {
              type: 'array',
              items: stepSchema(wheres, levels - 1),
              description: 'Sub-steps, same fields. The step becomes a group: done when all its parts are',
            },
          }
        : {}),
    },
    required: ['id', 'title', 'tier', 'where'],
  }
}

// A router note about the helper orders starts with this, so a newer one replaces it.
const HELPER_NOTE = 'Helper orders changed'

async function editHelpers($: EngineInterface, patch: Partial<Settings['helpers']> | ((h: Settings['helpers']) => Partial<Settings['helpers']>)) {
  const was = (await read($, settings)).helpers
  const wasOn = was.enabled
  await editSettings($, s => ({ ...s, helpers: { ...s.helpers, ...(typeof patch === 'function' ? patch(s.helpers) : patch) } }))
  const after = await read($, settings)
  // Helpers just went on, or helpers.py is somewhere else now: read its config.
  if (after.helpers.enabled && (!wasOn || after.helpers.script !== was.script)) await loadHelperConfig($)
  await resolveHelperPicks($)
  // The rules sit in the chat once; a changed order reaches it as a router note. One note
  // says where the orders stand, and none when they are back to what the chat was told.
  const knows = await read($, toldHelpers)
  await update($, notes, n => n.filter(x => !x.startsWith(HELPER_NOTE)))
  if (after.helpers.enabled && knows && knows !== helperSignature(after)) {
    const fusion = after.helpers.fusion === 'off' ? '' : ` (Copilot Fusion ${after.helpers.fusion})`
    await update($, notes, n => [...n, `${HELPER_NOTE}${fusion}; use these instead of rule 6's: ${helperSignature(after)}.`])
  }
  if (after.helpers.enabled === wasOn) return
  try {
    await registerPlanTool($)
  } catch {
    // Keep the first registration; see registerPlanTool.
  }
}

/** Switches a helper off, moves one, or puts one back, for a tier. */
async function editHelperOrder($: EngineInterface, tier: Tier, fn: (list: string[]) => string) {
  // Worked out from the settings as stored, not from this session's copy; a default order is first made explicit.
  await editHelpers($, h => ({ tiers: { ...h.tiers, [tier]: fn(helperEffective({ helpers: h } as Settings, tier)) } }))
}

async function editHereEffort($: EngineInterface, patch: Partial<Settings['hereEffort']>) {
  const wasOn = (await read($, settings)).hereEffort.enabled
  await editSettings($, s => ({ ...s, hereEffort: { ...s.hereEffort, ...patch } }))
  const after = (await read($, settings)).hereEffort
  if (after.enabled === wasOn) return
  // The rules sit in the chat once; the change reaches it as a router note.
  const note = after.enabled
    ? `Here-step effort is now on. ${hereEffortRule(await read($, settings))}`
    : 'Here-step effort is now off: no need to call the plan tool with start any more.'
  await update($, notes, n => [...n, note])
  try {
    await registerPlanTool($)
  } catch {
    // Keep the first registration; see registerPlanTool.
  }
}

// --- Here-step effort (opt-in experiment) ----------------------------------------

const kTok = (n: number) => `${Math.round(n / 1000)}k`
const effortRank = (x: Step['effort'] | number | undefined) => (typeof x === 'string' ? EFFORTS.indexOf(x) : -1)

/**
 * The effort a main-chat request goes out with: the running here step's tier effort, lower
 * or higher than the chat's own, while the chat is still small; else the chat's own. The
 * note says which, for the step's card.
 */
function hereEffortFor(set: Settings, step: Step | undefined, own: Effort | number | undefined, context: number) {
  if (!step || typeof own !== 'string') return { effort: own, note: undefined }
  const want = set.tiers[step.tier].effort
  if (want === own) return { effort: own, note: `Runs at this chat's ${own}, the ${step.tier} tier's level too.` }
  if (context > set.hereEffort.maxContext) {
    return {
      effort: own,
      note: `Kept at ${own}: this chat is at ${kTok(context)} tokens, over the ${kTok(set.hereEffort.maxContext)} limit for switching (a switch rewrites the cache).`,
    }
  }
  return { effort: want, note: `Runs at ${want} instead of this chat's ${own} (${effortRank(want) > effortRank(own) ? 'higher' : 'lower'}).` }
}

async function logSwitch($: EngineInterface, entry: EffortSwitch) {
  const ok = await ready($)
  await update($, effortLog, l => [...l, entry].slice(-EFFORT_LOG_CAP))
  if (ok) await $.store.set(STORE.effortLog, await read($, effortLog))
}

const hereEffortRule = (set: Settings) =>
  `Before you begin a "here" step, call ${PLAN_TOOL} with start: [<id>] (in the same call as done: [<previous id>]). While it runs, the router sends this chat's requests at that tier's thinking level (${TIER_ORDER.map(t => `${t} ${set.tiers[t].effort}`).join(', ')}), lower or higher than the chat's own, and only while the chat is under ${kTok(set.hereEffort.maxContext)} tokens, since a change of level makes the API write the conversation to the cache again. Mark the step done when it is finished, so the chat returns to its own level.`

// --- Money ---------------------------------------------------------------------

// Which plan step a subagent runs, by the tag its Agent call's description starts with.
const stepByAgent = new Map<string, string>()
// Agents of a counted step whose run has been counted.
const finishedAgents = new Set<string>()

async function stepOfAgent($: EngineInterface, agentId: string) {
  let id = stepByAgent.get(agentId)
  if (!id) {
    const agent = (await $.agent.list()).find(a => a.id === agentId)
    id = agent ? STEP_TAG.exec(agent.description)?.[1] : undefined
    if (id) stepByAgent.set(agentId, id)
  }
  const step = id ? (await read($, steps)).find(s => s.id === id) : undefined

  // A helper step has no Claude subagent: nothing is counted for it.
  return step?.where === 'helper' ? undefined : step
}

/** Adds one model response's cost to the chat, the step it belongs to, and the totals. A model with no price adds tokens, not money. */
async function account($: EngineInterface, used: Usage, modelId: string, agentId: string | undefined) {
  const model = modelOf(modelId, await read($, settings))
  await rememberModel($, model)
  const set = await read($, settings)
  if (!agentId) {
    const cost = costOf(used, model, set)
    await update($, main, m => ({ usage: addUsage(m.usage, used), cost: m.cost + (cost ?? 0), model: model ?? m.model, unpriced: m.unpriced || cost === undefined || undefined }))
    if (cost !== undefined) await editLifetime($, l => ({ ...l, mainCost: l.mainCost + cost }))
    await refreshStatus($)
    return
  }
  const step = await stepOfAgent($, agentId)
  if (!step) return
  const cost = costOf(used, model ?? runsOn(step, set, await learnedOf($)).model, set)
  if (cost === undefined) {
    // No price: the tokens show on the card, the money is "?", and the step is left out of savings.
    await editStep($, step.id, s => ({ ...s, usage: addUsage(s.usage, used), unpriced: true, resolvedModel: s.resolvedModel ?? model }))
    await update($, chatTotals, t => ({ ...t, unpriced: true }))
    return
  }
  // The main chat's model with no price: no saving can be worked out, so none is counted.
  const equivalent = costOf(used, (await read($, main)).model ?? 'opus', set) ?? cost
  const add = (t: Totals): Totals => ({ ...t, agentCost: t.agentCost + cost, mainEquivalent: t.mainEquivalent + equivalent })
  await update($, chatTotals, add)
  await editLifetime($, l => ({ ...l, ...add(l) }))
  await editStep($, step.id, s => ({ ...s, usage: addUsage(s.usage, used), cost: s.cost + cost, mainCost: s.mainCost + equivalent }))
}

// --- Policy -------------------------------------------------------------------

const policy = (set: Settings, kinds: readonly string[] = []) => {
  const tiers = TIER_ORDER.map(t => `- ${t} (${rungLabel(set.tiers[t])}): ${TIER_USE[t]}`).join('\n')
  const skills = Object.entries(set.skills)
  // With helpers on but no helper CLI installed, the rules do not advertise helpers or their orders.
  const helpersLive = set.helpers.enabled && !noHelperCli()
  const skillRule = skills.length
    ? `\n${helpersLive ? 7 : 6}. These skills run in a subagent on a tier: ${skills.map(([n, t]) => `${n} (${t})`).join(', ')}. To use one, delegate with the Agent tool, its description starting "[${SKILL_TAG}<name>]", and a brief that tells the subagent to invoke that skill with everything it needs from this conversation.`
    : ''

  const h = set.helpers
  const usageCmd = `python3 ${h.script ? h.script : `<the ${h.skill} skill's folder>/scripts/helpers.py`} usage <the helper's name>`
  const helperRule = helpersLive
    ? `\n6. where = "helper" runs a step on an agent from another subscription or account, through the ${h.skill} skill. ${
        h.use === 'all'
          ? 'Use it for every self-contained step that would otherwise be "agent".'
          : 'Use it for long self-contained steps (research, code to a spec, sweeps, anything over ~15 tool calls); shorter self-contained steps stay "agent".'
      } To run one, load the ${h.skill} skill and follow it. Pick the helper with its picker in this order for the step's tier: ${TIER_ORDER.map(t => `${t}: ${helperList(set, t).join(',') || 'none installed'}`).join('; ')}. When a helper step's plan line says "launch <template>", the router chose that model and level for it (the template already exists): give the picker that template first, then the tier's order (pick <template>,<the order>), and launch what it prints. If no helper is usable (the picker prints nothing, hc is missing, or there is no $HC_TERMINAL_ID), run the step as "agent" with the Agent tool instead, its description starting with "[<step id>]", and say so. When you start a helper step, call ${PLAN_TOOL} with start: [{id, helper: "<the template you launched>", model: "<the model the helper reports on its screen>", effort: "<its thinking level, if the screen shows one>"}], so the pane shows them (leave effort out when the screen shows none; the pane then reads it from the template). Review the helper's result yourself. Before you close the helper, run \`${usageCmd}\`: it prints the helper's usage as JSON {"provider","amount","unit"}, or nothing. Then mark the step done with ${PLAN_TOOL}: done: [{id, verdict, why, usage: {provider, amount, unit}}], passing that JSON as usage; leave usage out when it printed nothing, and never send 0 or a guess.`
    : ''

  return `# Model routing (model-router mod)

The user installed this mod so that each step of a task runs on the cheapest model tier that does it well, and authorizes delegating steps to subagents for this purpose.

1. When a request has several distinct steps (more than a handful of tool calls in all), first call ${PLAN_TOOL} with the steps. Tag each with a tier and with where it runs. Skip this for single-step or conversational requests. The call waits for the user to approve the plan (unless they turned on auto-approve) and returns the approved plan, which the user may have edited: follow what it returns. If it returns a revision request, revise and call it again. A step that splits into pieces may carry "parts" (the same fields, nested as deep as the work needs; a part's id extends its parent's: s3, s3.a, s3.a.1). A step with parts is a group: its tier only rates it, and each part runs where and on the tier it names. A part done by several identical agents at once (N readers, say) has "count": N. Give each step that does work a "kind": a short label for the kind of work (${
    kinds.length ? `kinds used so far: ${kinds.join(', ')}; reuse one when it fits, else a new short label` : 'e.g. code-review, summarize, search, write-code, figure'
  }; a step that runs a skill takes the skill's name). The router learns per kind which model does it well.
2. Tiers:
${tiers}
3. where = "here" for steps that need this conversation's accumulated context or back-and-forth with the user, and for small steps (under ~5 tool calls: a subagent costs ~15-40k tokens just to start). where = "agent" for self-contained steps, above all ones that read a lot. A "here" step runs on this chat's own model and thinking level, which no tier can change: still give it the tier its work needs, since that is the default if the user sends it to a subagent, and the router flags a here step rated above this chat's model. Do not mark a step "light" to mean "do it quickly here".
4. Delegate an "agent" step with the Agent tool, its description starting with "[<step id>]". Do not set model or effort: the router sets them from the plan. Never use subagent_type "fork" for a routed step, since a fork ignores the model. Delegate a part under its own id ("[s3.a]"); with "count": N make N Agent calls with that id, started together, and the part is done when all N finish. Write a self-contained brief: goal, files, what to return. Light-tier briefs ask for a findings list, not fixes; spot-check surprising findings. If a light result is weak, say so: the user can rerun the step one rung higher from the pane.
5. Mark "here" steps done through ${PLAN_TOOL} (done: [ids]) as you finish them. A group is done when all its parts are; naming it in done marks its unfinished parts done. Every delegated step (a subagent${h.enabled ? ' or helper' : ''} step, parts included) needs a verdict once you have checked its result: call ${PLAN_TOOL} with done: [{id, verdict, why}] (a subagent step is marked done when its agent ends; still give it one). The verdict says what happened, not how it felt: "ok" = you used the result as returned or with small edits; "weak" = it needed a rerun, you redid part of it, or review found a substantive error; "overkill" = plainly mechanical work (finding, listing, extracting, short output, no judgment) that ran above the light tier. why: a few words.${helperRule}${skillRule}${
    set.hereEffort.enabled ? `\n\nHere-step effort (an experiment the user turned on): ${hereEffortRule(set)}` : ''
  }`
}

const REMINDER = `Model router: "Always plan" is on. Before any tool call for this message, call ${PLAN_TOOL} with the steps (one step is fine), unless the current approved plan already covers it. Answer without a plan only if no tools are needed.`

const usageOf = (u: ModelUsage): Usage => ({
  input: u.input_tokens,
  cacheWrite: u.cache_creation_input_tokens ?? 0,
  cacheRead: u.cache_read_input_tokens ?? 0,
  output: u.output_tokens,
})

type StartRef = string | { id?: string; helper?: string; model?: string; effort?: string }
type DoneRef = string | { id?: string; usage?: unknown; verdict?: unknown; why?: unknown }
type PlanInput = {
  status?: boolean
  steps?: PlanNode[]
  done?: DoneRef[]
  start?: StartRef[]
}

const idOfRef = (r: StartRef | DoneRef) => (typeof r === 'string' ? r : r?.id)
const refs = <T extends StartRef | DoneRef>(list: T[] | undefined) =>
  (Array.isArray(list) ? list : []).flatMap(r => {
    const id = idOfRef(r)

    return typeof id === 'string' && id ? [{ id, ref: r }] : []
  })

// Run = go with the plan as it stands in the pane (tier, where, model, thinking edits
// included). Change = the steps themselves need work (add, drop, split, reword).
const APPROVE = 'Run it'
const APPROVE_AUTO = 'Run it, and auto-approve future plans'
const REVISE = 'Change the steps'


// --- The pane -----------------------------------------------------------------

const TIER_COLOR: Record<Tier, string> = { light: 'success', standard: 'suggestion', deep: 'claude' }
const STATUS_COLOR: Record<Step['status'], string> = { planned: 'inactive', running: 'warning', done: 'success' }

type Option = { value: string; label: string }

// What Settings offers for auto mode's thresholds (a stored value outside these is kept and listed too).
const AUTO_RUNS = [3, 5, 8, 10, 20]
const AUTO_OK = [70, 80, 90, 95, 100]
const withCurrent = (options: readonly number[], now: number) => (options.includes(now) ? options : [...options, now].sort((a, b) => a - b))

const cycle = (values: readonly string[], one: string) => values[(values.indexOf(one) + 1) % values.length]!

type RenderArgs = Parameters<Hook<'ui.render'>>

export async function renderPane($: RenderArgs[0], e: RenderArgs[1]) {
  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
  const hasFields = e.surface !== 'mobile'
  // The terminal gives the pane few rows and scrolls only with the keyboard: draw it compact.
  const tty = e.surface === 'terminal'
  const site = e.props as { isFocused?: boolean; scroll?: { offset: number } }
  // The terminal draws a Select's list inline, pushing its neighbours about, and only a
  // pick closes it: there a button that cycles to the next option on Enter reads better.
  const Select = hasFields && !tty && 'Select' in ui ? ui.Select : undefined
  const Input = hasFields && 'Input' in ui ? ui.Input : undefined

  const plan = await read($, steps)
  // Edits to a running plan wait in a draft: the cards show them laid over the plan's own values.
  const held = await read($, draft)
  const list = plan.map(x => applyDraft(x, held[x.id]))
  const planOf = (id: string) => plan.find(x => x.id === id)
  const heldCount = draftCount(held)
  const set = await read($, settings)
  const m = await read($, main)
  const status = await read($, planStatus)
  const auto = await read($, autoApprove)
  const always = await read($, alwaysPlan)
  const past = await read($, history)
  const seen = await read($, seenSkills)
  const isSettingsOpen = await read($, showSettings)
  const known = await read($, told)

  // Groups are the sum of their parts: counted once, through the parts.
  const work = leavesOf(list)
  const done = work.filter(s => s.status === 'done').length
  const agentCost = list.reduce((n, s) => n + s.cost, 0)
  const saved = list.reduce((n, s) => n + Math.max(0, s.mainCost - s.cost), 0)
  const view = await read($, costView)
  const chat = await read($, chatTotals)
  const base = await read($, planBase)
  const life = await read($, lifetime)
  const switches = await read($, effortLog)
  // Minimal view: only the steps and their settings, no explanatory text, so a long plan fits.
  const mini = set.compact
  const hint = mini ? undefined : modelHint(list, m.model)
  const advice = suggestions(past, set)
  // Helper models: what helpers.py holds (read at the start and after a change), and the advice the history gives for them.
  const hs = await read($, helperCfg)
  const hcfg = hs.status === 'ready' ? hs.config : undefined
  const helperAdvice = set.helpers.enabled ? helperSuggestions(past, set, hcfg, hs.models) : []
  // Auto mode: the rung each kind has learned, for the cards (nothing while it is off).
  const learned = set.autoRoute ? learnedRungs(past, set) : undefined
  const models = knownModels(set)

  // Settings that differ from the defaults get a quiet dot, so it shows which of your own values are active.
  const D = DEFAULT_SETTINGS
  const differs = {
    compact: set.compact !== D.compact,
    always,
    auto,
    openPane: set.openPane !== D.openPane,
    hereEffort: set.hereEffort.enabled !== D.hereEffort.enabled,
    hereLimit: set.hereEffort.maxContext !== D.hereEffort.maxContext,
    helpers: set.helpers.enabled !== D.helpers.enabled,
    use: set.helpers.use !== D.helpers.use,
    fusion: set.helpers.fusion !== D.helpers.fusion,
    autoRoute: set.autoRoute !== D.autoRoute,
    autoMinRuns: set.autoMinRuns !== D.autoMinRuns,
    autoOkPercent: set.autoOkPercent !== D.autoOkPercent,
  }
  // A model's price differs when Settings set one other than the default table's (or any, for a new model).
  const priceDiffers = (x: string) => !!set.prices[x] && JSON.stringify(set.prices[x]) !== JSON.stringify(PRICES[x])
  const tierDiffers = (t: Tier) => ({
    model: set.tiers[t].model !== D.tiers[t].model,
    effort: set.tiers[t].effort !== D.tiers[t].effort,
    scope: set.tiers[t].scopeNote !== D.tiers[t].scopeNote,
  })
  const orderDiffers = (t: Tier) => orderIsCustom(set, t)
  const helperDiffers = (provider: string, tier: string) => helperTierDiffers(hcfg, hs.defaults, provider, tier)
  const helperModelsDiffer =
    set.helpers.enabled &&
    (set.helpers.script !== D.helpers.script ||
      Object.keys(set.helpers.kinds).length > 0 ||
      (!!hcfg && helperProviders(hcfg, set).some(p => helperTierNames(hcfg, p).some(t => helperDiffers(p, t).model || helperDiffers(p, t).effort))))
  const anyDiffers =
    helperModelsDiffer ||
    Object.values(differs).some(Boolean) ||
    Object.keys(set.skills).length > 0 ||
    Object.keys(set.kinds).length > 0 ||
    set.models.length > 0 ||
    models.some(priceDiffers) ||
    TIER_ORDER.some(t => Object.values(tierDiffers(t)).some(Boolean) || (set.helpers.enabled && orderDiffers(t)))
  const dot = (key: string, on: boolean) =>
    on ? (
      <Text key={`dflt:${key}`} dimColor size="footnote">
        •
      </Text>
    ) : null

  // The agent has not heard yet of a change to this step (it is told at its next turn).
  // (Judged on the plan's own values: an edit still in the draft has not been sent, so nothing is noted yet.)
  const changeNoted = (s: Step) => {
    const own = planOf(s.id) ?? s

    return status === 'approved' && own.status !== 'done' && !!known[s.id] && knownChanges(known[s.id]!, knownOf(own, set, learned)).length > 0
  }
  const notedLine = (s: Step) =>
    changeNoted(s) ? (
      <Text key={`noted:${s.id}`} color="suggestion" size="footnote">
        change noted, applies from the next turn
      </Text>
    ) : null

  // A picker where the surface has one, else a button that cycles.
  const pick = (key: string, value: string, options: readonly Option[], onPick: (v: string) => void) =>
    Select ? (
      <Select key={key} value={value} options={options} onSelect={v => onPick(v)} />
    ) : (
      <Button key={key} onPress={() => onPick(cycle(options.map(o => o.value), value))}>
        {`${options.find(o => o.value === value)?.label ?? value}${tty ? ' ⇄' : ''}`}
      </Button>
    )

  // A settings row: what the switch does on the left, On/Off on the right.
  const switchRow = (key: string, label: string, help: string, isOn: boolean, onPress: () => void, isCustom = false) => (
    <Box key={`row:${key}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm" rowGap="xs" marginTop={mini ? 0 : 1}>
      <Box flexDirection="column" flexShrink={1}>
        <Box flexDirection="row" columnGap="xs">
          <Text weight="medium">{label}</Text>
          {dot(key, isCustom)}
        </Box>
        {!mini && <Text dimColor size="footnote" wrap="wrap">{help}</Text>}
      </Box>
      <Button key={key} variant={isOn ? 'primary' : 'secondary'} onPress={onPress}>
        {isOn ? 'On' : 'Off'}
      </Button>
    </Box>
  )

  // A settings group starts with a coloured band, so the groups tell apart at a glance.
  const group = (title: string, help?: string) => (
    <Box key={`group:${title}`} flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        <Text backgroundColor="suggestion" color="inverseText" weight="semibold">{` ${title.toUpperCase()} `}</Text>
      </Box>
      {help && !mini ? <Text dimColor size="footnote" wrap="wrap">{help}</Text> : null}
    </Box>
  )

  const section = (title: string, aside?: string) => (
    <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm" marginTop={mini ? 1 : 'xs'}>
      <Text weight="semibold">{title}</Text>
      {aside ? <Text dimColor size="footnote">{aside}</Text> : null}
    </Box>
  )

  const stat = (label: string, value: string, color?: string, sub?: string) => (
    <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={12}>
      <Text dimColor size="caption" wrap="wrap">{label}</Text>
      <Text weight="semibold" tabular color={color}>{value}</Text>
      {sub ? <Text size="caption" tabular color={color}>{sub}</Text> : null}
    </Box>
  )

  const savedOf = (t: Totals) => Math.max(0, t.mainEquivalent - t.agentCost)
  const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')
  const since = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  const VIEWS: { value: CostView; label: string }[] = [
    { value: 'plan', label: 'This plan' },
    { value: 'chat', label: 'This chat' },
    { value: 'all', label: 'All time' },
  ]

  // The money at the top: one span at a time, picked with a small segmented switch.
  // Saved as a share of what the same work would have cost with no routing:
  // main chat + what the subagents' tokens would have cost on the main model.
  const savedStat = (amount: number, mainSpent: number, equivalent: number) =>
    stat(
      'Saved',
      amount > 0 ? `≈${fmtUsd(amount)}` : '—',
      amount > 0 ? 'success' : undefined,
      amount > 0 ? `${pct(amount, mainSpent + equivalent)} of the total` : undefined,
    )

  const costCard = () => {
    const planMain = Math.max(0, m.cost - base.mainCost)
    const chatSaved = savedOf(chat)
    const lifeSaved = savedOf(life)
    // Some tokens ran on a model with no price: their money is "?".
    const planUnpriced = list.some(x => x.unpriced)
    // What was moved to helpers, in each provider's own unit, for the span picked.
    const moved = helperLine(view === 'plan' ? helperTotalsOf(list) : view === 'chat' ? chat.helper : life.helper)
    const body =
      view === 'plan' ? (
        <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs">
          {stat(`Main chat${m.model ? ` · ${m.model}` : ''}`, fmtCost(planMain, m.unpriced))}
          {stat('Subagents', fmtCost(agentCost, planUnpriced))}
          {savedStat(saved, planMain, list.reduce((n, x) => n + x.mainCost, 0))}
        </Box>
      ) : view === 'chat' ? (
        <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs">
          {stat(`Main chat${m.model ? ` · ${m.model}` : ''}`, fmtCost(m.cost, m.unpriced))}
          {stat('Subagents', fmtCost(chat.agentCost, chat.unpriced))}
          {savedStat(chatSaved, m.cost, chat.mainEquivalent)}
        </Box>
      ) : (
        <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs">
          {savedStat(lifeSaved, life.mainCost, life.mainEquivalent)}
          {stat('Subagents cost', `≈${fmtUsd(life.agentCost)}`)}
          {stat('On main model', `≈${fmtUsd(life.mainEquivalent)}`)}
        </Box>
      )
    const viewSwitch = (
      <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs">
        {VIEWS.map(v => (
          <Button key={`cost-view:${v.value}`} plain={v.value !== view ? true : undefined} variant={v.value === view ? 'primary' : undefined} onPress={() => void update($, costView, () => v.value)}>
            {v.label}
          </Button>
        ))}
      </Box>
    )
    if (tty || mini) {
      // Two rows: the switch, then main · subagents · saved on one line.
      const [mainSpent, agents, savedNow, equivalent] =
        view === 'plan'
          ? [planMain, agentCost, saved, list.reduce((n, x) => n + x.mainCost, 0)]
          : view === 'chat'
            ? [m.cost, chat.agentCost, chatSaved, chat.mainEquivalent]
            : [life.mainCost, life.agentCost, lifeSaved, life.mainEquivalent]
      const [mainOpen, agentsOpen] = view === 'plan' ? [m.unpriced, planUnpriced] : view === 'chat' ? [m.unpriced, chat.unpriced] : [false, false]
      return (
        <Box flexDirection="column">
          {viewSwitch}
          <Text size="footnote" tabular wrap="wrap">
            <Text dimColor>{`main${m.model && view !== 'all' ? ` (${m.model})` : ''} `}</Text>
            {fmtCost(mainSpent, mainOpen)}
            <Text dimColor> · subagents </Text>
            {fmtCost(agents, agentsOpen)}
            <Text dimColor> · saved </Text>
            <Text color={savedNow > 0 ? 'success' : undefined}>
              {savedNow > 0 ? `≈${fmtUsd(savedNow)} (${pct(savedNow, mainSpent + equivalent)})` : '—'}
            </Text>
          </Text>
          {moved && <Text size="footnote" wrap="wrap">{moved}</Text>}
        </Box>
      )
    }
    const foot =
      view === 'plan'
        ? `Since this plan was posted${base.at ? ` (${new Date(base.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })})` : ''}. A new plan starts a new count.`
        : view === 'chat'
          ? `Since this chat was opened or its plugins reloaded: ${chat.steps} delegated steps. Earlier turns are not counted.`
          : `Since ${since(life.since)}: ${life.steps} delegated steps in ${life.plans} plans (light ${life.byTier.light} · standard ${life.byTier.standard} · deep ${life.byTier.deep}). Delegated steps cost ${pct(lifeSaved, life.mainEquivalent)} less than on the main model; main chats cost ≈${fmtUsd(life.mainCost)}.`
    return (
      <Box flexDirection="column" rowGap="xs" borderStyle="round" borderColor="subtle" paddingX="sm" paddingY="xs">
        {viewSwitch}
        {body}
        {moved && <Text size="footnote" wrap="wrap">{moved}</Text>}
        <Text dimColor size="caption" wrap="wrap">{foot}</Text>
      </Box>
    )
  }

  // The four pickers of a step: where it runs, tier, and (for a subagent) model and thinking.
  const stepPickers = (s: Step) => {
    // The default a step runs on without picks of its own: its tier's, its kind's, or what auto mode learned.
    const base = baseRung(s, set, learned)
    const from = base.source === 'tier' ? 'tier' : base.source === 'kind' ? 'kind' : 'auto'
    // An edit not yet sent carries a mark beside its picker.
    const mark = (field: keyof StepDraft) =>
      held[s.id] && field in held[s.id]! ? (
        <Text key={`edited:${field}:${s.id}`} color="suggestion" size="footnote">
          ✎
        </Text>
      ) : null

    return [
      pick(
        `where:${s.id}`,
        s.where,
        [
          { value: 'agent', label: 'subagent' },
          { value: 'here', label: 'here' },
          ...(set.helpers.enabled || s.where === 'helper' ? [{ value: 'helper', label: 'helper' }] : []),
        ],
        v => void paneEdit($, s.id, { where: v as Where }),
      ),
      mark('where'),
      // On a here step the tier is a rating, not a setting of this chat: a label, not a picker.
      // Sending the step to a subagent brings the picker back.
      s.where === 'here' ? (
        <Text key={`tier:${s.id}`} color={TIER_COLOR[s.tier]} size="footnote">{`rated ${s.tier}`}</Text>
      ) : (
        pick(`tier:${s.id}`, s.tier, TIER_ORDER.map(t => ({ value: t, label: t })), v =>
          void paneEdit($, s.id, { tier: v as Tier }),
        )
      ),
      mark('tier'),
      s.where === 'agent' &&
        pick(
          `model:${s.id}`,
          s.model ?? 'tier',
          [{ value: 'tier', label: `${base.model} (${from})` }, ...models.map(x => ({ value: x, label: x }))],
          v => void paneEdit($, s.id, { model: v === 'tier' ? null : (v as Step['model']) }),
        ),
      s.where === 'agent' && mark('model'),
      s.where === 'agent' &&
        pick(
          `effort:${s.id}`,
          s.effort ?? 'tier',
          [{ value: 'tier', label: `${base.effort} (${from})` }, ...EFFORTS.map(x => ({ value: x, label: x }))],
          v => void paneEdit($, s.id, { effort: v === 'tier' ? null : (v as Step['effort']) }),
        ),
      s.where === 'agent' && mark('effort'),
    ]
  }

  // Minimal view: two lines a step, no border and no explanation. The title, then the
  // pickers with the cost and any rerun beside them.
  // N identical agents at once: "×4", and how many have finished while it runs.
  const countTag = (s: Step) =>
    s.count && s.count > 1 ? (
      <Text key={`count:${s.id}`} dimColor size="footnote">{`×${s.count}${s.status !== 'done' && (s.runs ?? 0) > 0 ? ` · ${s.runs} finished` : ''}`}</Text>
    ) : null
  // A helper step: the helper and the model it reported, then its usage and time.
  const helperInfo = (s: Step) => (isHelperRun(s) && s.helper ? <Text key={`helper:${s.id}`} size="footnote" weight="medium">{helperName(s)}</Text> : null)
  const helperFactsText = (s: Step) => {
    const facts = isHelperRun(s) ? helperFacts(s) : ''

    return facts ? <Text key={`facts:${s.id}`} dimColor size="footnote" tabular>{facts}</Text> : null
  }
  // The kind of work, and where the rung comes from when it is not the tier: "auto: sonnet · high (learned, 5 runs)".
  const kindTag = (s: Step) => (s.kind ? <Text key={`kind:${s.id}`} dimColor size="footnote">{s.kind}</Text> : null)
  const rungFrom = (s: Step) => {
    if (s.where !== 'agent' || (s.model && s.effort)) return null
    const b = baseRung(s, set, learned)
    if (b.source === 'tier') return null
    const label =
      b.source === 'auto' ? `auto: ${b.model} · ${b.effort} (learned, ${b.n} runs)` : `${s.kind} default: ${b.model} · ${b.effort}`

    return <Text key={`from:${s.id}`} color="suggestion" size="footnote">{label}</Text>
  }
  // A helper step the router picked a model for: the template to launch and why, or that making it failed.
  const pickLine = (s: Step) => {
    const p = s.where === 'helper' && !s.helper ? s.helperPick : undefined
    if (!p) return null

    return p.template ? (
      <Text key={`pick:${s.id}`} color="suggestion" size="footnote" wrap="wrap">{`launch ${p.template} · ${p.model} ${p.effort} · ${pickSource(p)}`}</Text>
    ) : (
      <Text key={`pick:${s.id}`} color="warning" size="footnote" wrap="wrap">{`no template for ${p.model} ${p.effort} (${p.error ?? 'unknown'}): the tier order applies`}</Text>
    )
  }
  // The lead's verdict on a finished delegated step, or that it has none yet.
  const verdictText = (s: Step) => {
    if (!isDelegated(s) || s.status !== 'done') return null
    const color = s.verdict === 'weak' ? 'warning' : s.verdict === 'overkill' ? 'suggestion' : undefined

    return (
      <Text key={`verdict:${s.id}`} color={color} dimColor={!s.verdict || s.verdict === 'ok'} size="footnote" wrap="wrap">
        {s.verdict ? `verdict ${s.verdict}${s.why && !mini ? `: ${s.why}` : ''}` : 'no verdict yet'}
      </Text>
    )
  }
  // A step whose tokens ran on a model with no price: its money is "?".
  const unpricedText = (s: Step) =>
    s.unpriced ? <Text key={`unpriced:${s.id}`} color="warning" size="footnote">{fmtCost(s.cost, true)}</Text> : null

  // A group: its title, how many parts are done and what they cost together. Its tier only rates it.
  const groupCard = (s: Step) => {
    const r = rollupOf(list, s)
    const head = (
      <Box flexDirection="row" flexWrap="wrap" columnGap="sm" alignItems="center">
        <Text color={STATUS_COLOR[s.status]}>{STATUS_GLYPH[s.status]}</Text>
        <Text color={TIER_COLOR[s.tier]} mono size="footnote">{s.id}</Text>
        <Text weight="semibold" wrap="wrap" dimColor={s.status === 'done'}>{s.title}</Text>
        <Text color={TIER_COLOR[s.tier]} size="footnote">{`rated ${s.tier}`}</Text>
        <Text dimColor size="footnote">{`${r.done}/${r.total} done`}</Text>
        {r.cost > 0 && <Text dimColor size="footnote" tabular>{`≈${fmtUsd(r.cost)}`}</Text>}
      </Box>
    )
    const moved = helperLine(r.helper)
    if (mini) {
      return (
        <Box key={`card:${s.id}`} flexDirection="column">
          {head}
          {moved && <Text dimColor size="footnote" wrap="wrap">{moved}</Text>}
        </Box>
      )
    }
    const tokens = r.usage.input + r.usage.cacheWrite + r.usage.output

    return (
      <Box key={`card:${s.id}`} flexDirection="column" rowGap="xs" borderStyle="round" borderColor={s.status === 'running' ? 'warning' : 'subtle'} paddingX="sm" paddingY={tty ? undefined : 'xs'}>
        {head}
        {r.cost > 0 && (
          <Text dimColor size="footnote" tabular>
            ≈{fmtUsd(r.cost)} · {fmtTok(tokens)} tok + {fmtTok(r.usage.cacheRead)} cached
            {r.mainCost > r.cost ? ` · saved ≈${fmtUsd(r.mainCost - r.cost)}` : ''}
          </Text>
        )}
        {moved && <Text dimColor size="footnote" wrap="wrap">{moved}</Text>}
      </Box>
    )
  }

  const miniCard = (s: Step) => {
    const own = planOf(s.id) ?? s
    const up = own.where === 'agent' && own.status === 'done' ? nextRung(runsOn(own, set, learned), set) : undefined

    return (
      <Box key={`card:${s.id}`} flexDirection="column">
        <Box flexDirection="row" columnGap="sm">
          <Text color={STATUS_COLOR[s.status]}>{STATUS_GLYPH[s.status]}</Text>
          <Text color={TIER_COLOR[s.tier]} mono size="footnote">{s.id}</Text>
          <Text weight="medium" wrap="wrap" dimColor={s.status === 'done'}>{s.title}</Text>
          {countTag(s)}
          {kindTag(s)}
        </Box>
        <Box flexDirection="row" flexWrap="wrap" columnGap="xs" alignItems="center" paddingLeft={2}>
          {stepPickers(s)}
          {s.cost > 0 && !s.unpriced && <Text dimColor size="footnote" tabular>{`≈${fmtUsd(s.cost)}`}</Text>}
          {unpricedText(s)}
          {rungFrom(s)}
          {pickLine(s)}
          {verdictText(s)}
          {helperInfo(s)}
          {helperFactsText(s)}
          {s.setupHeavy && <Text color="warning" size="footnote">⚠ start-up heavy</Text>}
          {hereNeeds(s, set, m.model) && <Text color="warning" size="footnote">{`⚠ rated for ${hereNeeds(s, set, m.model)}`}</Text>}
          {up && (
            <Button key={`rerun:${s.id}`} plain onPress={() => void rerun($, s.id)}>
              {`↑ ${rungLabel(up)}`}
            </Button>
          )}
        </Box>
        {changeNoted(s) && <Box paddingLeft={2}>{notedLine(s)}</Box>}
      </Box>
    )
  }

  const card = (s: Step) => {
    if (s.group) return groupCard(s)
    if (mini) return miniCard(s)
    const now = runsOn(s, set, learned)
    const own = planOf(s.id) ?? s
    const up = own.where === 'agent' && own.status === 'done' ? nextRung(runsOn(own, set, learned), set) : undefined
    const tokens = s.usage.input + s.usage.cacheWrite + s.usage.output
    return (
      <Box
        key={`card:${s.id}`}
        flexDirection="column"
        rowGap="xs"
        borderStyle="round"
        borderColor={s.status === 'running' ? 'warning' : 'subtle'}
        paddingX="sm"
        paddingY={tty ? undefined : 'xs'}
      >
        <Box flexDirection="row" columnGap="sm" alignItems="center">
          <Text color={STATUS_COLOR[s.status]}>{STATUS_GLYPH[s.status]}</Text>
          <Text color={TIER_COLOR[s.tier]} mono size="footnote">{s.id}</Text>
          <Text weight="medium" wrap="wrap" dimColor={s.status === 'done'}>{s.title}</Text>
          {countTag(s)}
          {kindTag(s)}
        </Box>
        <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center">
          {stepPickers(s)}
        </Box>
        {rungFrom(s)}
        {pickLine(s)}
        {notedLine(s)}
        {s.where === 'here' && (
          <Text dimColor size="footnote" wrap="wrap">
            {tty
              ? `Runs in this chat on ${m.model ?? 'its model'} and its thinking level; the tier is a rating, used if you send it to a subagent (then you can change it).`
              : `Done in this chat, on ${m.model ?? "this chat's model"} and its thinking level, which the tier cannot change. The tier rates the step and only picks a model if you send it to a subagent.`}
          </Text>
        )}
        {hereNeeds(s, set, m.model) && (
          <Text color="warning" size="footnote" wrap="wrap">
            {`Rated ${s.tier} (${hereNeeds(s, set, m.model)}), but this chat runs on ${m.model}: send it to a subagent, or switch this chat's model.`}
          </Text>
        )}
        {s.where === 'here' && s.effortNote && set.hereEffort.enabled && (
          <Text color={s.effortNote.startsWith('Kept') ? 'warning' : undefined} dimColor={!s.effortNote.startsWith('Kept')} size="footnote" wrap="wrap">
            {s.effortNote}
          </Text>
        )}
        {s.where === 'helper' && !s.helper && (
          <Text dimColor size="footnote" wrap="wrap">
            {`Runs on another subscription's agent (${helperOrder(set, s.tier)}); a subagent if none is usable.`}
          </Text>
        )}
        {helperInfo(s)}
        {helperFactsText(s)}
        {s.cost > 0 && !s.unpriced && (
          <Text dimColor size="footnote" tabular>
            ≈{fmtUsd(s.cost)} · {fmtTok(tokens)} tok + {fmtTok(s.usage.cacheRead)} cached
            {s.mainCost > s.cost ? ` · saved ≈${fmtUsd(s.mainCost - s.cost)}` : ''}
            {s.reruns > 0 ? ` · rerun ${s.reruns}×` : ''}
          </Text>
        )}
        {s.unpriced && (
          <Text color="warning" size="footnote" tabular wrap="wrap">
            {`${fmtCost(s.cost, true)} · ${fmtTok(tokens)} tok + ${fmtTok(s.usage.cacheRead)} cached · no price for ${s.resolvedModel ?? now.model}: left out of savings (Settings → Models)`}
          </Text>
        )}
        {verdictText(s)}
        {s.setupHeavy && (
          <Text color="warning" size="footnote">Mostly start-up cost: a step this small is cheaper done here.</Text>
        )}
        {up && (
          <Box flexDirection="row">
            <Button key={`rerun:${s.id}`} plain onPress={() => void rerun($, s.id)}>
              {`↑ Rerun on ${rungLabel(up)}`}
            </Button>
          </Box>
        )}
      </Box>
    )
  }

  // Parts sit under their group, indented two cells a level; deeper than three levels keeps the last indent.
  const row = (s: Step) => {
    const indent = Math.min(depthOf(list, s), 3) * 2

    return indent > 0 ? (
      <Box key={`row:${s.id}`} flexDirection="column" paddingLeft={indent}>
        {card(s)}
      </Box>
    ) : (
      card(s)
    )
  }

  const stats = rungStats(past)
  const kinds = kindStats(past)
  const mapped = Object.entries(set.skills)
  const unmapped = seen.filter(n => !(n in set.skills))

  return (
    <Box flexDirection="column" rowGap={mini ? 0 : tty ? 'sm' : 'md'} padding={tty ? undefined : 'sm'}>
      {tty && (
        <Text dimColor size="caption" wrap="wrap">
          {site.isFocused
            ? '↑↓ scroll · Tab buttons · Esc back to the prompt'
            : `${(site.scroll?.offset ?? 0) > 0 ? '↑ scrolled · ' : ''}ctrl+x tab, then ↑↓ to scroll${status === 'pending' && !mini ? ' (after answering the plan question)' : ''}`}
        </Text>
      )}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Box flexDirection="column">
          <Text size="heading" weight="semibold">Model router</Text>
          <Text dimColor size="footnote">
            {list.length === 0 ? 'No plan yet' : `${done} of ${work.length} steps done`}
            {status === 'pending' ? ' · awaiting your approval' : ''}
          </Text>
        </Box>
        <Box flexDirection="row" flexWrap="wrap" justifyContent="flex-end" columnGap="sm">
          <Button key="minimal" plain onPress={() => void editSettings($, x => ({ ...x, compact: !x.compact }))}>
            {mini ? 'Minimal ✓' : 'Minimal'}
          </Button>
          <Button key="settings" plain onPress={() => void (async () => {
            if (!isSettingsOpen) await refreshShared($)
            await update($, showSettings, v => !v)
          })()}>
            {isSettingsOpen ? 'Settings ▾' : 'Settings ▸'}
          </Button>
        </Box>
      </Box>

      {isSettingsOpen && (
        <Box key="settings-panel" flexDirection="column" borderStyle="round" borderColor="subtle" paddingX="md" paddingY={mini ? 0 : 'sm'}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text size="heading" weight="semibold">Settings</Text>
            <Button key="settings-done" variant="primary" onPress={() => void update($, showSettings, () => false)}>
              Done
            </Button>
          </Box>
          {anyDiffers && (
            <Text dimColor size="footnote">
              • differs from the default
            </Text>
          )}

          {group('Behaviour')}
          {switchRow('compact', 'Minimal view', 'Show only the steps and their settings, with no explanatory text, so a long plan fits without scrolling.', mini, () =>
            void editSettings($, x => ({ ...x, compact: !x.compact })),
            differs.compact,
          )}
          {switchRow('always', 'Always plan', 'Plan before any message that needs tools, not only multi-step ones.', always, () => void setAlways($, !always), differs.always)}
          {switchRow('auto', 'Auto-approve', 'Run new plans without asking first.', auto, () => void setAuto($, !auto), differs.auto)}
          {switchRow('open-pane', 'Open pane on start', 'Open this pane in every new chat.', set.openPane, () =>
            void editSettings($, s => ({ ...s, openPane: !s.openPane })),
            differs.openPane,
          )}

          {group('Experiment', 'Here steps run on this chat\'s model; this tries lowering its thinking level for them instead.')}
          {switchRow(
            'here-effort',
            'Adjust effort of here steps',
            'While a here step runs, send this chat\'s requests at its tier\'s thinking level, lower or higher than the chat\'s own. A change of level makes the API write the conversation to the cache again, so only while the chat is under the limit below.',
            set.hereEffort.enabled,
            () => void editHereEffort($, { enabled: !set.hereEffort.enabled }),
            differs.hereEffort,
          )}
          {set.hereEffort.enabled && (
            <Box key="here-effort-limit-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap="sm">
              <Text dimColor size="footnote">Switch only while the chat is under</Text>
              {dot('here-effort-limit', differs.hereLimit)}
              {pick(
                'here-effort-limit',
                String(set.hereEffort.maxContext),
                EFFORT_LIMITS.map(n => ({ value: String(n), label: `${kTok(n)} tokens` })),
                v => void editHereEffort($, { maxContext: Number(v) }),
              )}
            </Box>
          )}
          {switches.length > 0 && (
            <Text dimColor size="footnote" wrap="wrap">
              {`${switches.length} switch${switches.length === 1 ? '' : 'es'} so far: ${kTok(switches.reduce((n, x) => n + x.cacheWrite, 0))} tokens written to the cache, ${kTok(switches.reduce((n, x) => n + x.cacheRead, 0))} read on the request after each switch. Mostly written means the switch cost a cache rewrite.`}
            </Text>
          )}

          {group('Tiers', `Model and thinking level for steps sent to a subagent. "Here" steps always use this chat's model.${tty ? ' ⇄ buttons: Enter picks the next option.' : ''}`)}
          {TIER_ORDER.map(t => {
            const ts = set.tiers[t]
            const edit = (patch: Partial<typeof ts>) =>
              void editSettings($, s => ({ ...s, tiers: { ...s.tiers, [t]: { ...s.tiers[t], ...patch } } }))
            return (
              <Box key={`tierset:${t}`} flexDirection="column" rowGap="xs" borderStyle="round" borderColor={TIER_COLOR[t]} paddingX="sm" paddingY={mini ? 0 : 'xs'} marginTop={mini ? 0 : 1}>
                <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm">
                  <Text color={TIER_COLOR[t]} weight="semibold">{t}</Text>
                  <Box flexDirection="row" columnGap="xs" alignItems="center">
                    {dot(`scope:${t}`, tierDiffers(t).scope)}
                    <Button key={`set-scope:${t}`} plain dimColor={!ts.scopeNote} onPress={() => edit({ scopeNote: !ts.scopeNote })}>
                      {ts.scopeNote ? '✓ Scope note' : 'Scope note off'}
                    </Button>
                  </Box>
                </Box>
                {!mini && <Text dimColor size="footnote" wrap="wrap">{TIER_USE[t]}</Text>}
                <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center">
                  {pick(`set-model:${t}`, ts.model, models.map(x => ({ value: x, label: x })), v => edit({ model: v as typeof ts.model }))}
                  {dot(`model:${t}`, tierDiffers(t).model)}
                  {pick(`set-effort:${t}`, ts.effort, EFFORTS.map(x => ({ value: x, label: `${x} thinking` })), v => edit({ effort: v as typeof ts.effort }))}
                  {dot(`effort:${t}`, tierDiffers(t).effort)}
                </Box>
              </Box>
            )
          })}
          {!mini && <Text dimColor size="footnote" wrap="wrap">
            Scope note: one line added to that tier's briefs, asking the subagent to stay on its task and not start sessions or load extra tools.
          </Text>}

          {group('Learning', 'What the router learned per kind of work, from verdicts and reruns.')}
          {switchRow(
            'auto-route',
            'Auto mode',
            `A subagent step whose kind has enough history runs on the cheapest rung that did that kind well (ok in at least ${set.autoOkPercent}% of ${set.autoMinRuns} or more runs there). Your own picks on a step still win.${set.helpers.enabled ? ' A helper step gets its model the same way.' : ''}`,
            set.autoRoute,
            () =>
              void (async () => {
                await editSettings($, s => ({ ...s, autoRoute: !s.autoRoute }))
                await resolveHelperPicks($)
              })(),
            differs.autoRoute,
          )}
          <Box key="auto-thresholds" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap="xs" rowGap="xs">
            <Text dimColor size="footnote">Auto picks a rung with at least</Text>
            {pick('auto-min-runs', String(set.autoMinRuns), withCurrent(AUTO_RUNS, set.autoMinRuns).map(n => ({ value: String(n), label: `${n} runs` })), v =>
              void editSettings($, s => ({ ...s, autoMinRuns: Number(v) })).then(() => resolveHelperPicks($)),
            )}
            {dot('auto-min-runs', differs.autoMinRuns)}
            <Text dimColor size="footnote">and</Text>
            {pick('auto-ok-percent', String(set.autoOkPercent), withCurrent(AUTO_OK, set.autoOkPercent).map(n => ({ value: String(n), label: `${n}% ok` })), v =>
              void editSettings($, s => ({ ...s, autoOkPercent: Number(v) })).then(() => resolveHelperPicks($)),
            )}
            {dot('auto-ok-percent', differs.autoOkPercent)}
          </Box>
          {Object.entries(set.kinds).map(([kind, r]) => (
            <Box key={`kind-default:${kind}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm">
              <Box flexDirection="row" columnGap="xs" flexShrink={1}>
                <Text mono size="footnote" wrap="truncate">{kind}</Text>
                <Text size="footnote">{`→ ${rungLabel(r)}`}</Text>
                {dot(`kind:${kind}`, true)}
              </Box>
              <Button
                key={`kind-reset:${kind}`}
                plain
                dimColor
                onPress={() =>
                  void editSettings($, s => {
                    const kinds = { ...s.kinds }
                    delete kinds[kind]
                    return { ...s, kinds }
                  })
                }
              >
                reset
              </Button>
            </Box>
          ))}
          {!mini && Object.keys(set.kinds).length === 0 && (
            <Text dimColor size="footnote" wrap="wrap">No kind has a default of its own yet: applying advice under "What the history says" sets one.</Text>
          )}

          {group('Models', 'Models the router knows: the defaults, any seen in a chat, and any you add. Prices are dollars per million tokens; a model with none shows its cost as "?" and is left out of savings.')}
          {models.map(x => {
            const p = priceOf(x, set)
            const extra = !MODELS.includes(x)

            return (
              <Box key={`model-row:${x}`} flexDirection="column">
                <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm">
                  <Box flexDirection="row" columnGap="xs" flexShrink={1}>
                    <Text mono size="footnote" wrap="truncate">{x}</Text>
                    <Text dimColor={!!p} color={p ? undefined : 'warning'} size="footnote">
                      {p ? `$${p.input} in · $${p.output} out` : 'no price'}
                    </Text>
                    {dot(`model:${x}`, extra || priceDiffers(x))}
                  </Box>
                  {extra && (
                    <Button
                      key={`model-remove:${x}`}
                      plain
                      dimColor
                      onPress={() =>
                        void editSettings($, s => {
                          const prices = { ...s.prices }
                          delete prices[x]
                          return { ...s, models: s.models.filter(y => y !== x), prices }
                        })
                      }
                    >
                      remove
                    </Button>
                  )}
                </Box>
                {Input && (
                  <Input
                    key={`price:${x}`}
                    placeholder={`Price for ${x}: input output, e.g. 2 10 (empty: ${PRICES[x] ? 'the default' : 'none'})`}
                    submitLabel="Set"
                    onSubmit={v => {
                      const text = v.trim()
                      const price = parsePrice(text)
                      if (!text || price) {
                        void editSettings($, s => {
                          const prices = { ...s.prices }
                          if (price) prices[x] = price
                          else delete prices[x]
                          return { ...s, prices }
                        })
                      }
                    }}
                  />
                )}
              </Box>
            )
          })}
          {Input && (
            <Input
              key="add-model"
              placeholder="Add a model by name, e.g. nova"
              submitLabel="Add"
              onSubmit={v => {
                const name = modelOf(v.trim().toLowerCase())
                if (name && name === v.trim().toLowerCase()) {
                  void editSettings($, s => (knownModels(s).includes(name) ? s : { ...s, models: [...s.models, name] }))
                }
              }}
            />
          )}

          {group('Helpers', `Run long self-contained steps on agents from other subscriptions or Claude accounts${hcfg ? ` (${Object.entries(hcfg.providers).map(([n, p]) => p.label ?? n).join(', ')})` : ''}, started by a delegation skill. Needs that skill and herdr-core hc; with none usable, steps run as subagents.`)}
          {set.helpers.enabled && hs.status === 'ready' && noHelperCli() && (
            <Text key="helpers-no-cli" color="warning" size="footnote" wrap="wrap">No helper CLI installed: helpers are off for now and the rules do not mention them.</Text>
          )}
          {switchRow('helpers', 'Helpers (other subscriptions)', 'Let plans send steps to a helper.', set.helpers.enabled, () =>
            void editHelpers($, { enabled: !set.helpers.enabled }),
            differs.helpers,
          )}
          {set.helpers.enabled && (
            <Box key="helpers-detail" flexDirection="column" rowGap="xs" marginTop={mini ? 0 : 1}>
              <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm" rowGap="xs">
                <Box flexDirection="column" flexShrink={1}>
                  <Box flexDirection="row" columnGap="xs">
                    <Text weight="medium">Use helpers for</Text>
                    {dot('use', differs.use)}
                  </Box>
                  {!mini && (
                    <Text dimColor size="footnote" wrap="wrap">
                      {set.helpers.use === 'long'
                        ? 'Long self-contained steps only; shorter ones stay subagents.'
                        : 'Every self-contained step that would otherwise be a subagent.'}
                    </Text>
                  )}
                </Box>
                {pick(
                  'helpers-use',
                  set.helpers.use,
                  [{ value: 'long', label: 'long steps' }, { value: 'all', label: 'all steps' }],
                  v => void editHelpers($, { use: v === 'all' ? 'all' : 'long' }),
                )}
              </Box>
              <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm" rowGap="xs">
                <Box flexDirection="column" flexShrink={1}>
                  <Box flexDirection="row" columnGap="xs">
                    <Text weight="medium">Copilot Fusion</Text>
                    {dot('fusion', differs.fusion)}
                  </Box>
                  {!mini && (
                    <Text dimColor size="footnote" wrap="wrap">
                      GitHub's router across Claude and GPT models; tried before the pinned Copilot helper. Measured 2026-11-01: Max is near Opus 5.5 at max effort for about half the cost; High is unmeasured.
                    </Text>
                  )}
                </Box>
                {pick(
                  'helpers-fusion',
                  set.helpers.fusion,
                  [
                    { value: 'off', label: 'off' },
                    { value: 'deep', label: 'Max for deep' },
                    { value: 'both', label: 'High + Max' },
                  ],
                  v => void editHelpers($, { fusion: v === 'deep' || v === 'both' ? v : 'off' }),
                )}
              </Box>
              <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm">
                <Text dimColor size="footnote" wrap="wrap">Helper order per tier, first usable wins:</Text>
                <Button key="helper-reset" plain dimColor onPress={() => void editHelpers($, { tiers: { ...D.helpers.tiers } })}>
                  Reset to default order
                </Button>
              </Box>
              {TIER_ORDER.map(t => {
                const items = helperItems(set, t)
                const off = helpersOff(set, t)
                const short = (name: string) => name.split(`-${t}`).join('')

                return (
                  <Box key={`helper-order:${t}`} flexDirection="column">
                    <Box flexDirection="row" columnGap="xs" alignItems="center">
                      <Text color={TIER_COLOR[t]} weight="semibold">{t}</Text>
                      {dot(`order:${t}`, orderDiffers(t))}
                    </Box>
                    {items.map((name, i) => (
                      <Box key={`helper:${t}:${name}`} flexDirection="row" flexWrap="wrap" columnGap="xs" alignItems="center" paddingLeft={2}>
                        <Text size="footnote">{`${i + 1}. ${templateLabel(name, short(name))}`}</Text>
                        {i > 0 && (
                          <Button key={`helper-up:${t}:${name}`} plain onPress={() => void editHelperOrder($, t, l => moveHelper(l, i, -1))}>
                            ↑
                          </Button>
                        )}
                        {i < items.length - 1 && (
                          <Button key={`helper-down:${t}:${name}`} plain onPress={() => void editHelperOrder($, t, l => moveHelper(l, i, 1))}>
                            ↓
                          </Button>
                        )}
                        <Button key={`helper-off:${t}:${name}`} plain dimColor onPress={() => void editHelperOrder($, t, l => l.filter(x => x !== name).join(','))}>
                          off
                        </Button>
                      </Box>
                    ))}
                    {off.length > 0 && (
                      <Box flexDirection="row" flexWrap="wrap" columnGap="xs" alignItems="center" paddingLeft={2}>
                        <Text dimColor size="footnote">off:</Text>
                        {off.map(name => (
                          <Button key={`helper-on:${t}:${name}`} plain dimColor onPress={() => void editHelperOrder($, t, l => [...l, name].join(','))}>
                            {`+ ${templateLabel(name, short(name))}`}
                          </Button>
                        ))}
                      </Box>
                    )}
                    {!mini && helperList(set, t).length !== items.length && (
                      <Text dimColor size="footnote" wrap="wrap">{`tried: ${helperOrder(set, t).split(`-${t}`).join('')}`}</Text>
                    )}
                  </Box>
                )
              })}
              <Box key="helper-models" flexDirection="column" rowGap="xs" marginTop={mini ? 0 : 1}>
                <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm" rowGap="xs">
                  <Box flexDirection="column" flexShrink={1}>
                    <Box flexDirection="row" columnGap="xs">
                      <Text weight="medium">Helper models</Text>
                      {dot('helper-script', set.helpers.script !== D.helpers.script)}
                    </Box>
                    {!mini && (
                      <Text dimColor size="footnote" wrap="wrap">
                        Model and thinking level of each helper tier, kept in herdr-delegate's helpers.py (a change runs its set command and rewrites the template).
                      </Text>
                    )}
                  </Box>
                  <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center">
                    {hs.status === 'ready' && (
                      <Text dimColor size="footnote">{modelsChecked(hs.models) ? `models checked ${modelsChecked(hs.models)}` : 'models not checked yet'}</Text>
                    )}
                    {hs.status === 'ready' && (
                      <Button key="helpers-check" plain onPress={() => void checkModels($)}>
                        {hs.busy ? 'Checking…' : 'Check models'}
                      </Button>
                    )}
                    {hs.status !== 'ready' && (
                      <Button key="helpers-reload" plain onPress={() => void loadHelperConfig($)}>
                        Look again
                      </Button>
                    )}
                  </Box>
                </Box>
                {hs.status === 'missing' && (
                  <Text color="warning" size="footnote" wrap="wrap">
                    {`helpers.py was not found (herdr-delegate 0.6.0 or later, installed from the marketplace, or the path below). Until then the models cannot be changed here; by hand: ${SET_BY_HAND}`}
                  </Text>
                )}
                {hs.status === 'error' && <Text color="warning" size="footnote" wrap="wrap">{hs.message ?? 'helpers.py did not answer.'}</Text>}
                {hs.status === 'unknown' && <Text dimColor size="footnote">Not read yet.</Text>}
                {hs.message && hs.status === 'ready' && <Text color="warning" size="footnote" wrap="wrap">{hs.message}</Text>}
                {hs.warnings.map((w, i) => (
                  <Text key={`helper-warning:${i}`} color="warning" size="footnote" wrap="wrap">{w}</Text>
                ))}
                {hcfg &&
                  helperProviders(hcfg, set).map(provider => {
                    const prov = hcfg.providers[provider]!
                    const tiers = helperTierNames(hcfg, provider)
                    if (tiers.length === 0) return null

                    return (
                      <Box key={`helper-provider:${provider}`} flexDirection="column">
                        <Text weight="semibold" size="footnote">{prov.label ?? provider}</Text>
                        {tiers.map(tier => {
                          const r = helperTierRung(hcfg, provider, tier)!
                          const d = helperDiffers(provider, tier)

                          return (
                            <Box key={`helper-tier:${provider}:${tier}`} flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center" paddingLeft={2}>
                              <Text color={isTier(tier) ? TIER_COLOR[tier] : undefined} size="footnote">{tier}</Text>
                              {pick(
                                `helper-model:${provider}:${tier}`,
                                r.model,
                                offeredModels(hcfg, hs.models, provider).map(x => ({ value: x, label: x })),
                                v => void changeHelperTier($, provider, tier, { model: v }),
                              )}
                              {dot(`helper-model:${provider}:${tier}`, d.model)}
                              {pick(
                                `helper-effort:${provider}:${tier}`,
                                r.effort,
                                helperEfforts(hcfg, provider, r.effort).map(x => ({ value: x, label: `${x} thinking` })),
                                v => void changeHelperTier($, provider, tier, { effort: v }),
                              )}
                              {dot(`helper-effort:${provider}:${tier}`, d.effort)}
                            </Box>
                          )
                        })}
                      </Box>
                    )
                  })}
                {Object.entries(set.helpers.kinds).map(([kind, c]) => (
                  <Box key={`helper-kind:${kind}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm">
                    <Box flexDirection="row" columnGap="xs" flexShrink={1}>
                      <Text mono size="footnote" wrap="truncate">{kind}</Text>
                      <Text size="footnote">{`→ ${c.provider} ${helperRungLabel(c)}`}</Text>
                      {dot(`helper-kind:${kind}`, true)}
                    </Box>
                    <Button
                      key={`helper-kind-reset:${kind}`}
                      plain
                      dimColor
                      onPress={() =>
                        void (async () => {
                          await editSettings($, x => {
                            const kinds = { ...x.helpers.kinds }
                            delete kinds[kind]

                            return { ...x, helpers: { ...x.helpers, kinds } }
                          })
                          await resolveHelperPicks($)
                        })()
                      }
                    >
                      reset
                    </Button>
                  </Box>
                ))}
                {Input && (
                  <Input
                    key="helpers-script"
                    placeholder={`Path to helpers.py (now: ${set.helpers.script || 'the newest installed herdr-delegate'}; empty to look it up)`}
                    submitLabel="Set"
                    onSubmit={v => {
                      const path = asScriptPath(v)
                      if (path !== undefined || !v.trim()) void editHelpers($, { script: path ?? '' })
                    }}
                  />
                )}
              </Box>
            </Box>
          )}

          {group('Skills', 'Skills listed here run in a subagent on the tier you pick.')}
          {!mini && mapped.length + unmapped.length === 0 && (
            <Text dimColor size="footnote" wrap="wrap">None yet. Skills you use in a chat appear here, or add one by name.</Text>
          )}
          {[...mapped.map(([n]) => n), ...unmapped].map(name => (
            <Box key={`skill:${name}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm" rowGap="xs">
              <Box flexShrink={1} flexDirection="row" columnGap="xs">
                <Text mono size="footnote" wrap="truncate">{name}</Text>
                {dot(`skill:${name}`, name in set.skills)}
              </Box>
              {pick(
                `skill-tier:${name}`,
                set.skills[name] ?? 'off',
                [{ value: 'off', label: 'in this chat' }, ...TIER_ORDER.map(t => ({ value: t, label: t }))],
                v =>
                  void editSettings($, s => {
                    const skills = { ...s.skills }
                    if (isTier(v)) skills[name] = v
                    else delete skills[name]
                    return { ...s, skills }
                  }),
              )}
            </Box>
          ))}
          {Input && (
            <Input
              key="add-skill"
              placeholder="Skill name, e.g. scientific-figures"
              submitLabel="Add"
              onSubmit={v => {
                const name = v.trim()
                if (name) void editSettings($, s => ({ ...s, skills: { ...s.skills, [name]: s.skills[name] ?? 'standard' } }))
              }}
            />
          )}

          <Box flexDirection="column" rowGap="xs" marginTop={1}>
            <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs">
              <Button key="reset-tiers" plain dimColor onPress={() => void editSettings($, s => ({ ...s, tiers: DEFAULT_SETTINGS.tiers }))}>
                Reset tiers
              </Button>
              <Button key="clear-history" plain dimColor onPress={() => void editHistory($, () => [])}>
                Clear history
              </Button>
              <Button key="reset-stats" plain dimColor onPress={() => void editLifetime($, () => newLifetime())}>
                Reset statistics
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {!(tty && status === 'pending') && costCard()}

      {status === 'pending' && !mini &&
        (tty ? (
          <Text color="warning" size="footnote" wrap="wrap">
            Edit steps below, then pick "Run it" in the chat; "Change the steps" to add, drop or reword.
          </Text>
        ) : (
          <Box borderStyle="round" borderColor="warning" paddingX="sm" paddingY="xs">
            <Text color="warning" size="footnote">
              Change tiers, models or where steps run below, then pick "Run it" in the chat. To add, drop or reword steps, pick "Change the steps".
            </Text>
          </Box>
        ))}
      {hint && (
        <Box borderStyle="round" borderColor="suggestion" paddingX="sm" paddingY="xs">
          <Text color="suggestion" size="footnote">{hint}</Text>
        </Box>
      )}

      {section('Plan', list.length > 0 ? `${work.length} steps` : undefined)}
      {heldCount > 0 && (
        <Box key="draft-bar" flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX="sm" paddingY={mini ? 0 : 'xs'}>
          <Box flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
            <Button key="draft-send" variant="primary" onPress={() => void sendDraft($)}>
              {`Send changes (${heldCount})`}
            </Button>
            <Button key="draft-discard" plain onPress={() => void discardDraft($)}>
              Discard
            </Button>
          </Box>
          {!mini && (
            <Text dimColor size="footnote" wrap="wrap">
              ✎ marks your edits. They are held back: the routing and the main agent use the plan as it was until you send them.
            </Text>
          )}
        </Box>
      )}
      {list.length === 0 && !mini && (
        <Text dimColor size="footnote">The main agent posts a plan here for multi-step tasks. Turn on Always plan in Settings to plan every message.</Text>
      )}
      <Box flexDirection="column" rowGap={mini ? 0 : tty ? 'sm' : 'md'}>
        {list.map(row)}
      </Box>
      {list.length > 0 && (
        <Box flexDirection="row">
          <Button key="clear" plain dimColor onPress={() => void clearPlan($)}>Clear plan</Button>
        </Box>
      )}
      {tty && status === 'pending' && costCard()}

      {(stats.length > 0 || advice.length > 0 || helperAdvice.length > 0) && section('What the history says', mini ? undefined : `${past.length} runs`)}
      {advice.map(a => {
        const key = a.kind ? `kind:${a.kind}` : `tier:${a.tier}`
        const what = a.kind ? `${a.kind}'s default` : `the ${a.tier} tier`

        return (
          <Box key={`advice:${key}`} flexDirection="column" rowGap="xs" borderStyle="round" borderColor={a.isRaise ? 'warning' : 'success'} paddingX="sm" paddingY="xs">
            <Text size="footnote" wrap="wrap">
              {a.why}: {a.isRaise ? 'raise' : 'try lowering'} {what} to {rungLabel(a.to)}.
            </Text>
            <Box flexDirection="row">
              <Button key={a.kind ? `apply-kind:${a.kind}` : `apply:${a.tier}`} variant="primary" onPress={() => void applySuggestion($, a)}>
                {`Apply: ${rungLabel(a.to)}`}
              </Button>
            </Box>
          </Box>
        )
      })}
      {helperAdvice.map(a => {
        const key = a.kind ? `kind:${a.kind}` : `tier:${a.provider}:${a.tier}`
        const what = a.kind ? `${a.kind}'s helper` : `${a.provider}'s ${a.tier} helper`

        return (
          <Box key={`helper-advice:${key}`} flexDirection="column" rowGap="xs" borderStyle="round" borderColor={a.isRaise ? 'warning' : 'success'} paddingX="sm" paddingY="xs">
            <Text size="footnote" wrap="wrap">
              {a.why}: {a.isRaise ? 'raise' : 'try lowering'} {what} from {helperRungLabel(a.from)} to {a.provider} {helperRungLabel(a.to)}.
            </Text>
            <Box flexDirection="row">
              <Button key={a.kind ? `apply-helper-kind:${a.kind}` : `apply-helper:${a.provider}:${a.tier}`} variant="primary" onPress={() => void applyHelperAdvice($, a)}>
                {`Apply: ${a.provider} ${helperRungLabel(a.to)}`}
              </Button>
            </Box>
          </Box>
        )
      })}
      {!mini && stats.map(r => (
        <Box key={`rung:${r.label}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap="sm">
          <Text mono size="footnote">{r.label}</Text>
          <Text dimColor size="footnote" tabular wrap="wrap">
            {r.n} runs · {r.reruns} reruns{r.isHelper ? '' : ` · ≈${fmtUsd(r.avgCost)} each`}{r.setupHeavy ? ` · ${r.setupHeavy} start-up heavy` : ''}
            {verdictLine(r.verdicts) ? ` · ${verdictLine(r.verdicts)}` : ''}
          </Text>
        </Box>
      ))}
      {!mini && kinds.map(k => (
        <Box key={`kind-stats:${k.kind}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap="sm">
          <Text size="footnote">{k.kind}</Text>
          <Text dimColor size="footnote" tabular wrap="wrap">
            {`${k.n} runs · ${k.reruns} reruns${verdictLine(k.verdicts) ? ` · ${verdictLine(k.verdicts)}` : ''}`}
          </Text>
        </Box>
      ))}

    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    loading = undefined
    await ready($)
    // The kinds the rules list are those of the history now, so the rules stay the same all chat.
    const kinds = kindsOf(await read($, history))
    await update($, ruleKinds, () => kinds)
    // A reload mid-plan starts this chat's count from the plan's own, so the views agree.
    const plan = await read($, steps)
    if ((await read($, chatTotals)).agentCost === 0 && plan.some(x => x.cost > 0)) {
      await update($, chatTotals, t => ({
        ...t,
        agentCost: plan.reduce((n, x) => n + x.cost, 0),
        mainEquivalent: plan.reduce((n, x) => n + x.mainCost, 0),
        steps: plan.filter(x => x.where === 'agent' && x.status === 'done').length,
      }))
    }
    // Likewise the helper steps already finished in the plan.
    const moved = helperTotalsOf(plan)
    const chat = await read($, chatTotals)
    if (chat.helper.steps === 0 && chat.helper.usage.length === 0 && (moved.steps > 0 || moved.usage.length > 0)) {
      await update($, chatTotals, t => ({ ...t, helper: moved }))
    }
    await $.command.register({ name: 'router', description: 'Show the model-router pane' })
    setHelperConfig(undefined)
    await loadHelperConfig($)
    await registerPlanTool($)
    await refreshStatus($)
    if ((await read($, settings)).openPane) void $.ui.open({ id: PANE, title: 'Model router' })

    return next(e)
  })

  on('command.run', { command: 'router' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Model router' })

    return { text: 'Model router pane opened.' }
  })

  on('tool.call', { tool: PLAN_TOOL }, async ($, e) => {
    const input = e as unknown as PlanInput
    const set = await read($, settings)
    let ask: string | undefined
    // What the agent is handed here is the plan as it stands, so it knows every step now.
    const withNotes = async (body: string) => {
      const text = ask ? `${body}\n\n${ask}` : body
      const pending = await read($, notes)
      await update($, notes, () => [])
      await noteDelivered($, pending)
      await tellSteps($)
      return { result: pending.length ? `${text}\n\nRouter notes:\n${pending.map(n => `- ${n}`).join('\n')}` : text }
    }
    const shown = async () => {
      await resolveHelperPicks($)

      return planText(await read($, steps), await read($, settings), (await read($, main)).model, await learnedOf($))
    }

    if (input.status) {
      const report = {
        version: VERSION,
        delivery: await read($, delivery),
        rulesSentTo: (await read($, policySent)).model ?? null,
        alwaysPlan: await read($, alwaysPlan),
        autoApprove: await read($, autoApprove),
        steps: (await read($, steps)).length,
        ...diag,
      }
      return { result: `model-router status: ${JSON.stringify(report)}` }
    }
    const done = refs(input.done)
    if (done.length) await markDone($, done)
    const started = refs(input.start)
    if (started.length) await markStarted($, started)
    ask = await verdictsMissing($, done.map(d => d.id))
    await refreshStatus($)
    if (!input.steps) return withNotes(await shown())

    const old = await read($, steps)
    const flat = flattenPlan(input.steps)
    // A plan posted anew: edits not yet sent were made to the old one.
    await update($, draft, () => ({}))
    // A plan that shares no step with the last one, or follows a finished one (ids may
    // repeat), starts its own cost count and its own steps.
    const isNewPlan = (old.length > 0 && old.every(o => o.status === 'done')) || !old.some(o => flat.steps.some(s => s.id === o.id))
    if (isNewPlan) {
      const mainCost = (await read($, main)).cost
      await update($, planBase, () => ({ mainCost, at: new Date().toISOString() }))
    }
    await setSteps($, () =>
      flat.steps.map(s => {
        const was = isNewPlan ? undefined : old.find(o => o.id === s.id)
        // With Helpers off, a helper step is a normal subagent step.
        const where: Where = s.where === 'helper' && !set.helpers.enabled ? 'agent' : s.where
        const shape = { parent: s.parent, group: s.group || undefined, count: s.count, kind: s.kind }

        return { ...(was ? { ...was, title: s.title, tier: s.tier, where } : newStep(s.id, s.title, s.tier, where)), ...shape }
      }),
    )
    if (flat.dropped.length) {
      await update($, notes, n => [...n, `These step ids came up twice in the plan and the repeats were ignored: ${flat.dropped.join(', ')}. Every id must be unique.`])
    }
    void $.ui.open({ id: PANE, title: 'Model router' })

    if (await read($, autoApprove)) {
      if (isNewPlan) await editLifetime($, l => ({ ...l, plans: l.plans + 1 }))
      await update($, planStatus, () => 'approved')
      await refreshStatus($)
      return withNotes(`Plan auto-approved:\n${await shown()}`)
    }

    await update($, planStatus, () => 'pending')
    await refreshStatus($)
    let answer: string
    try {
      answer = await $.ui.ask(
        'Run this plan? Edits you make in the Model router pane (tier, where, model, thinking) are kept either way. To add, drop, split or reword steps, pick "Change the steps", or type what to change under Other.',
        {
          header: 'Plan',
          options: [APPROVE, APPROVE_AUTO, REVISE],
        },
      )
    } catch {
      await update($, planStatus, () => 'none')
      await refreshStatus($)
      return { result: 'The user dismissed the plan. Ask them how to proceed before delegating anything.' }
    }

    if (answer === APPROVE || answer === APPROVE_AUTO) {
      if (answer === APPROVE_AUTO) await setAuto($, true)
      if (isNewPlan) await editLifetime($, l => ({ ...l, plans: l.plans + 1 }))
      await update($, planStatus, () => 'approved')
      await refreshStatus($)
      return withNotes(
        `Plan approved by the user (follow these tiers and places; they may differ from what you proposed. A "here" step's tier is a rating: do it in this chat as usual):\n${await shown()}`,
      )
    }
    await update($, planStatus, () => 'none')
    await refreshStatus($)
    await resolveHelperPicks($)
    const note = answer === REVISE ? 'They gave no details yet: ask them what to change before anything else.' : `What they want changed: ${answer}`
    const kept = planText(await read($, steps), await read($, settings), undefined, await learnedOf($))
    await tellSteps($)

    return {
      result: `The user wants the steps changed before anything runs. ${note}\nTheir pane edits so far are in this version; keep a step's id when you keep the step, so its edits carry over:\n${kept}\nThen call ${PLAN_TOOL} again with the revised steps.`,
    }
  }).catch(() => ({ deny: 'model-router: the plan tool failed; continue without routing.' }))

  // Skills mapped to a tier run in a subagent; the main chat is told how.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const name = e.skill
    await update($, seenSkills, list => (list.includes(name) ? list : [...list, name].slice(-50)))
    const tier = (await read($, settings)).skills[name]
    if (!tier || (e as { agentId?: string }).agentId) return next(e)

    return {
      deny: `model-router: the user runs the skill "${name}" on the ${tier} tier. Delegate it with the Agent tool, description "[${SKILL_TAG}${name}] <a few words>", and a brief that tells the subagent to invoke the Skill tool with skill "${name}"${e.args ? ` and args ${JSON.stringify(e.args)}` : ''}, plus everything it needs from this conversation.`,
    }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const tag = STEP_TAG.exec(e.description)?.[1]
    if (!tag || e.subagent_type === 'fork') return next(e)
    const set = await read($, settings)

    if (tag.startsWith(SKILL_TAG)) {
      const tier = set.skills[tag.slice(SKILL_TAG.length)]
      if (!tier) return next(e)
      const exists = (await read($, steps)).some(s => s.id === tag)
      if (!exists) {
        // A skill-routed step's kind is the skill's name.
        const kind = normKind(tag.slice(SKILL_TAG.length))
        await setSteps($, list => [...list, { ...newStep(tag, `Skill ${tag.slice(SKILL_TAG.length)}`, tier, 'agent'), ...(kind ? { kind } : {}) }])
      }
    }
    let step = (await read($, steps)).find(s => s.id === tag)
    if (!step) return next(e)
    if (step.group) {
      const parts = (await read($, steps)).filter(s => s.parent === step!.id).map(s => `[${s.id}]`)
      return { deny: `model-router: step [${step.id}] has parts. Delegate each part under its own id (${parts.join(', ')}), not the group.` }
    }
    // A finished step delegated again is a rerun: a fact the history counts as weak.
    if (step.status === 'done') {
      const key = step.historyKey
      if (key) await editHistory($, h => h.map(x => (x.key === key ? { ...x, rerun: true } : x)))
      await editStep($, step.id, freshRun)
      step = (await read($, steps)).find(s => s.id === tag)!
    }
    // A helper step run through the Agent tool is the fallback: it is a subagent step now, and no helper ran it.
    if (step.where === 'helper') {
      await editStep($, step.id, s => ({ ...s, where: 'agent', helper: undefined, helperModel: undefined, helperEffort: undefined, startedAt: undefined }))
      await tellSteps($, [step.id])
      step = { ...step, where: 'agent' }
    }

    const { model, effort } = runsOn(step, set, await learnedOf($))
    const prompt = set.tiers[step.tier].scopeNote ? `${e.prompt}\n\n${SCOPE_NOTE}` : e.prompt
    const at = new Date().toISOString()
    // The run starts with its first Agent call (N calls for a counted step).
    await editStep($, step.id, s => ({ ...s, status: 'running', startedAt: s.status === 'running' && s.startedAt ? s.startedAt : at }))
    const ran = await next({ ...e, model: model as typeof e.model, effort, prompt })
    const resolved = ran.deny === undefined ? (ran.result as { resolvedModel?: string } | undefined)?.resolvedModel : undefined
    if (resolved) await editStep($, step.id, s => ({ ...s, resolvedModel: resolved }))

    return ran
  }).catch(($, e, next) => next(e))

  // Money is counted per model response, as it arrives, so every view moves together.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId) {
      const r = yield* next(e)
      if (r.usage) await account($, usageOf(r.usage), r.usage.model, e.agentId)
      return r
    }
    // The main chat: with here-step effort on, a started here step may lower the level.
    const set = await read($, settings)
    const before = await read($, lastMain)
    let effort = e.effort
    let step: Step | undefined
    if (set.hereEffort.enabled) {
      step = (await read($, steps)).filter(s => s.where === 'here' && s.status === 'running').at(-1)
      const chosen = hereEffortFor(set, step, e.effort, before.context)
      effort = chosen.effort
      if (step && chosen.note !== step.effortNote) await editStep($, step.id, s => ({ ...s, effortNote: chosen.note }))
    }
    const r = yield* next(effort === e.effort ? e : { ...e, effort })
    if (!r.usage) return r
    const used = usageOf(r.usage)
    await account($, used, r.usage.model, undefined)
    // Evidence for the experiment: what the request after a change of level read and wrote.
    if (set.hereEffort.enabled && before.effort !== undefined && effort !== undefined && effort !== before.effort) {
      await logSwitch($, {
        at: new Date().toISOString(),
        from: before.effort,
        to: effort,
        ...(step ? { step: step.id } : {}),
        context: before.context,
        cacheWrite: used.cacheWrite,
        cacheRead: used.cacheRead,
      })
    }
    await update($, lastMain, () => ({ effort, context: used.input + used.cacheWrite + used.cacheRead }))

    return r
  })

  // A subagent's run ending finishes its step: status, history, the start-up check.
  // A counted step (N identical agents) is done when its Nth run ends.
  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (!e.agentId) return ran
    const step = await stepOfAgent($, e.agentId)
    if (!step) return ran

    const set = await read($, settings)
    const total = step.count ?? 1
    // An agent ending twice is one run; only a counted step has to tell its agents apart.
    const again = total > 1 && finishedAgents.has(e.agentId)
    if (total > 1) finishedAgents.add(e.agentId)
    const runs = (step.runs ?? 0) + (again ? 0 : 1)
    if (runs < total) {
      await editStep($, step.id, s => ({ ...s, runs, status: s.status === 'done' ? 'done' : 'running', resolvedModel: s.resolvedModel ?? e.usage?.model }))
      return ran
    }
    const learned = await learnedOf($)
    const ranOn = { model: modelOf(e.usage?.model, set) ?? runsOn(step, set, learned).model, effort: runsOn(step, set, learned).effort }
    // Setting-up is judged per run: N runs add up N times the reading.
    const heavy = isSetupHeavy({ input: step.usage.input / total, cacheWrite: step.usage.cacheWrite / total, cacheRead: step.usage.cacheRead / total, output: step.usage.output / total })
    const at = new Date().toISOString()
    const key = `${at}:${step.id}`
    const output = Math.round((step.usage.output - (step.priorOutput ?? 0)) / total)
    const ms = step.startedAt ? Date.parse(at) - Date.parse(step.startedAt) : 0
    const isFirstFinish = step.status !== 'done'
    if (isFirstFinish) {
      await update($, chatTotals, t => ({ ...t, steps: t.steps + 1 }))
      await editLifetime($, l => ({ ...l, steps: l.steps + 1, byTier: { ...l.byTier, [step.tier]: l.byTier[step.tier] + 1 } }))
    }
    await editStep($, step.id, s => ({
      ...s,
      runs,
      status: 'done',
      resolvedModel: s.resolvedModel ?? e.usage?.model,
      setupHeavy: heavy,
      historyKey: key,
    }))
    await editHistory($, h => [
      ...h,
      {
        key,
        tier: step.tier,
        where: 'agent',
        ...ranOn,
        ...(step.kind ? { kind: step.kind } : {}),
        cost: step.cost / total,
        setupHeavy: heavy,
        rerun: false,
        reruns: step.reruns,
        output,
        ...(ms > 0 ? { ms } : {}),
        // A verdict given before the agent ended belongs to this run.
        ...(step.verdict ? { verdict: step.verdict, ...(step.why ? { why: step.why } : {}) } : {}),
        at,
      },
    ])
    if (heavy) {
      await update($, notes, n => [
        ...n,
        `Step ${step.id} was mostly subagent start-up cost (${step.usage.input + step.usage.cacheWrite + step.usage.cacheRead} tokens read, ${step.usage.output} written): steps this small are cheaper done here.`,
      ])
    }

    return ran
  })

  // Typed prompts carry the Always-plan reminder and any pending router notes, unseen by the person.
  // Each main-loop turn starts with a hidden note the model reads (a meta row in the
  // conversation): the rules when none are in the chat (the system prompt cannot be
  // relied on: the desktop app supplies its own), the plan again after a summarization,
  // the Always-plan reminder and router notes. Written straight into the chat, it
  // does not depend on how the prompt arrived.
  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)
    diag.turns += 1
    // Settings another session changed since this one last looked.
    await refreshShared($)
    const extra: string[] = []
    const how = await read($, delivery)
    const set = await read($, settings)
    if (!how.inChat) extra.push(policy(set, await read($, ruleKinds)))
    const list = await read($, steps)
    const replan = how.planDue && list.length > 0
    if (replan) {
      extra.push(
        `Model router: the conversation was summarized. The current plan (${await read($, planStatus)}), from the router's own record:\n${planText(list, set, undefined, await learnedOf($))}`,
      )
    }
    if (await read($, alwaysPlan)) extra.push(REMINDER)
    // A step the user changed since the agent last knew it: one note, the final value.
    const changes = replan ? [] : await stepChanges($)
    const pending = await read($, notes)
    const all = [...pending, ...changes.map(c => c.note)]
    if (all.length) extra.push(`Model router notes:\n${all.map(n => `- ${n}`).join('\n')}`)

    if (extra.length > 0) {
      try {
        await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: extra.join('\n\n') }] } })
        diag.appends += 1
        await update($, delivery, d => ({ ...d, inChat: true, planDue: false }))
        await update($, notes, () => [])
        if (!how.inChat) await update($, toldHelpers, () => helperSignature(set))
        await noteDelivered($, pending)
        await tellSteps($, replan ? undefined : changes.map(c => c.id))
      } catch (err) {
        diag.lastError = `append: ${String(err).slice(0, 200)}`
      }
    }

    return next(e)
  })

  // A summarization of the main chat drops the rules and the plan from the
  // history: the next typed message brings them back.
  on('session.compact', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId || 'skip' in done) return done
    await update($, delivery, d => ({ ...d, inChat: false, planDue: true }))
    await refreshStatus($)

    return done
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!e.tools.includes(PLAN_TOOL) || !e.tools.includes('Agent')) return composed
    diag.composes += 1
    // Under the SDK's preset (the desktop app) session sections ride the chat's first
    // message, which an open chat sent long ago: the rules go with a typed message instead.
    const isSystem = !e.traits.includes('sdk-preset')
    await update($, delivery, d => ({ ...d, via: isSystem ? 'system' : 'message' }))
    // A host with its own system prompt drops added sections without a trace, so only
    // rules written into the chat count as delivered.
    const hasRules = (await read($, delivery)).inChat
    const model = hasRules ? modelOf(e.model) : undefined
    if ((await read($, policySent)).model !== model) {
      await update($, policySent, () => ({ model, sentAt: new Date().toISOString() }))
      await refreshStatus($)
    }
    if (!isSystem) return composed

    // Only the settings shape this text, so it stays stable and the prompt cache holds.
    return {
      sections: [...composed.sections, { id: 'model-router:policy', text: policy(await read($, settings), await read($, ruleKinds)), scope: 'session' as const }],
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, renderPane)
}
