// The model-router mod: plan tool, routing of tagged Agent calls, cost accounting, rules delivery and the pane.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, ModelUsage, Register } from 'claude-code'

import type { CostView, Effort, EffortSwitch, HelperChoice, HelperPick, HelperState, HelperTotals, HelperUsage, HistoryEntry, Lifetime, ModelNews, ModelNote, ModelsReport, PlanNode, Proposal, Rung, Settings, Step, StepDraft, StepKnown, Tier, Totals, Usage, Verdict, Where } from '../types'
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
  helpersLive,
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
  asReason,
  directAvailable,
  fallbackLine,
  healthChecks,
  healthLine,
  helperMode,
  helperModeOf,
  helperRuleSig,
  historyLine,
  liveProviders,
  logFileName,
  logLine,
  oldLogFiles,
  planFallbacks,
  reportFileName,
  reportMarkdown,
  asModelNews,
  cardModelLine,
  checkProposals,
  dayOf,
  hasModelsJson,
  modelCheckLines,
  modelsAskNote,
  newModelsCard,
  notedNew,
  parseModelsReport,
  providerLabel,
  reportChecked,
  reportWarnings,
  staleProviders,
  toAsk,
  applyPreset,
  presetOf,
  stepOpen,
  tiersSummary,
  whereLabel,
} from './logic'
import { TAGS, checkNote, findNote, mergeNotes, normId, parseNotesFile } from './notes'
import type { Check, HelperAdvice, HelperMode, Learned, Suggestion } from './logic'
import { buildSnapshot, chatKeyOf, newsLines, oldStateFiles, snapshotKey } from './snapshot'
import type { RouterState } from './snapshot'
import { DEFAULT_SETTINGS, EFFORT_LIMITS, EFFORTS, MODELS, PRESETS, PRICES, SCOPE_NOTE, TIER_ORDER, TIER_USE } from './tiers'

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
const showHelperPath = atom({ plugin: 'model-router', key: 'showHelperPath' } as const, false)
const helperCfg = atom({ plugin: 'model-router', key: 'helperCfg' } as const, { status: 'unknown', warnings: [] })
const showHealth = atom({ plugin: 'model-router', key: 'showHealth' } as const, false)
const reportNote = atom({ plugin: 'model-router', key: 'reportNote' } as const, '')
const modelNews = atom({ plugin: 'model-router', key: 'modelNews' } as const, { seen: {}, asked: [], proposals: [], dismissed: [] })
const modelNotes = atom({ plugin: 'model-router', key: 'modelNotes' } as const, mergeNotes(undefined))
const modelFeedback = atom({ plugin: 'model-router', key: 'modelFeedback' } as const, {})
const showCardNotes = atom({ plugin: 'model-router', key: 'showCardNotes' } as const, false)
const showAllNotes = atom({ plugin: 'model-router', key: 'showAllNotes' } as const, false)
const paneView = atom({ plugin: 'model-router', key: 'paneView' } as const, { toggled: {} })
const showGlossary = atom({ plugin: 'model-router', key: 'showGlossary' } as const, false)
const showCostDetails = atom({ plugin: 'model-router', key: 'showCostDetails' } as const, false)
const editOrder = atom({ plugin: 'model-router', key: 'editOrder' } as const, '')
const showHelperGrid = atom({ plugin: 'model-router', key: 'showHelperGrid' } as const, false)
const confirmReset = atom({ plugin: 'model-router', key: 'confirmReset' } as const, '')
const resetNote = atom({ plugin: 'model-router', key: 'resetNote' } as const, '')

const STORE = { auto: 'autoApprove', always: 'alwaysPlan', settings: 'settings', history: 'history', lifetime: 'lifetime', effortLog: 'effortLog', genome: 'genomeNoted', modelNews: 'modelNews' }
const EFFORT_LOG_CAP = 200
const HISTORY_CAP = 500

// What the router saw in this load, for the plan tool's status check.
const diag = { turns: 0, appends: 0, composes: 0, lastError: '' }

// The surface the chat started on, for the log and the report.
let surfaceNow: string | undefined

// --- The log: one JSON object per line, a file a day, under <config base>/model-router/log ---------
//
// Never prompts, briefs, file contents, titles or why-texts: only ids, tiers, models, verdicts, usage, reasons and errors.

const LOG_DAYS = 14

async function logDir($: EngineInterface) {
  const base = await configBase($)

  return base ? `${base}/model-router/log` : undefined
}

/** Appends one event to today's log file. Never throws: a failure is kept in the status check only. */
async function logEvent($: EngineInterface, ev: string, fields: Record<string, unknown> = {}) {
  try {
    if (!(await read($, settings)).log) return
    const dir = await logDir($)
    if (!dir) return
    const line = logLine(ev, fields)
    const path = `${dir}/${logFileName(new Date())}`
    // The fs API has no append: the day file is read and written whole, one writer at a time.
    await locked(`log:${path}`, async () => {
      const was = (await readText($, path)) ?? ''
      await $.fs.write(path, `${was}${line}\n`)
    })
  } catch (err) {
    diag.lastError = `log: ${String(err).slice(0, 200)}`
  }
}

/** A caught error: kept for the status check and written to the log. */
async function fault($: EngineInterface, where: string, err: unknown) {
  const message = String(err).slice(0, 200)
  diag.lastError = `${where}: ${message}`
  await logEvent($, 'error', { where, message })
}

/** Deletes log files older than 14 days (the fs API has no delete: rm, best effort). */
async function pruneLogs($: EngineInterface) {
  try {
    const dir = await logDir($)
    if (!dir) return
    let names: string[]
    try {
      names = (await $.fs.list(dir)).filter(x => x.kind === 'file').map(x => x.name)
    } catch {
      return
    }
    const old = oldLogFiles(names, new Date(), LOG_DAYS)
    if (old.length) await $.process.run(['rm', '-f', '--', ...old.map(n => `${dir}/${n}`)], { timeoutMs: 10_000 })
  } catch (err) {
    await fault($, 'prune-logs', err)
  }
}

// --- The state file for the Herdr view: <config base>/model-router/state/<chat>.json -------------------
//
// Short display strings of the plan and the money, so a Herdr mod can show them in a scrollable pane. Written only when
// ~/.config/herdr-app exists (checked at the chat's start), at most once a second, and only when something changed.

const chatKey = atom({ plugin: 'model-router', key: 'chatKey' } as const, '')
const STATE_EVERY_MS = 1000
const state = { on: false, cwd: '', last: 0, key: '', timer: false }

const stateDir = async ($: EngineInterface) => {
  const base = await configBase($)

  return base ? `${base}/model-router/state` : undefined
}

/** At a chat's start: is Herdr here, which chat is this, and clear out files of chats older than two days. Never throws. */
async function startState($: EngineInterface, e: { cwd?: string; sessionId?: unknown }) {
  try {
    state.on = false
    state.last = 0
    state.key = ''
    state.cwd = e.cwd ?? ''
    const base = await configBase($)
    if (!base || !(await $.fs.exists(`${base}/herdr-app`))) return
    state.on = true
    if (!(await read($, chatKey))) {
      const key = chatKeyOf(e.sessionId, () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`)
      await update($, chatKey, () => key)
    }
    const dir = await stateDir($)
    if (!dir) return
    const names = (await $.fs.list(dir)).filter(x => x.kind === 'file').map(x => x.name)
    const files = await Promise.all(names.map(async name => {
      try {
        return { name, at: (JSON.parse(String(await $.fs.read(`${dir}/${name}`))) as { at?: string }).at }
      } catch {
        return { name }
      }
    }))
    const old = oldStateFiles(files, new Date())
    if (old.length) await $.process.run(['rm', '-f', '--', ...old.map(n => `${dir}/${n}`)], { timeoutMs: 10_000 })
  } catch (err) {
    diag.lastError = `state: ${String(err).slice(0, 200)}`
  }
}

/** Writes the state file when what it shows has changed: at most once a second (a change inside that second is written at its end). Never throws. */
async function publishState($: EngineInterface) {
  try {
    if (!state.on || !(await read($, settings)).herdrView) return
    const wait = state.last + STATE_EVERY_MS - Date.now()
    if (wait > 0) {
      if (!state.timer && typeof setTimeout === 'function') {
        state.timer = true
        setTimeout(() => {
          state.timer = false
          void publishState($)
        }, wait)
      }

      return
    }
    const dir = await stateDir($)
    const key = await read($, chatKey)
    if (!dir || !key) return
    const set = await read($, settings)
    const hs = await read($, helperCfg)
    const checks = healthChecks({ set, st: hs, rules: (await read($, delivery)).inChat && (await read($, toldHelpers)) === helperRuleSig(set) })
    const health = healthLine(set, checks, hs.status, liveProviders(set))
    const snap: RouterState = buildSnapshot({
      router: VERSION,
      chat: key,
      cwd: state.cwd,
      at: new Date(),
      status: await read($, planStatus),
      health: { ok: health.ok, text: health.text },
      list: await read($, steps),
      set,
      learned: await learnedOf($),
      main: await read($, main),
      planBaseCost: (await read($, planBase)).mainCost,
      totals: await read($, chatTotals),
      news: newsLines(newModelsCard({ news: await read($, modelNews), notes: await read($, modelNotes), report: hs.report, cache: hs.models, cfg: hs.status === 'ready' ? hs.config : undefined, set, today: dayOf(new Date()) })),
    })
    const same = snapshotKey(snap)
    if (same === state.key) return
    state.key = same
    state.last = Date.now()
    // One line, so the Herdr view can read the newest files in one command, here or on another machine.
    await $.fs.write(`${dir}/${key}.json`, `${JSON.stringify(snap)}\n`)
  } catch (err) {
    diag.lastError = `state: ${String(err).slice(0, 200)}`
  }
}

/** The last `n` lines of the log, across the newest files. */
async function lastLogLines($: EngineInterface, n = 100) {
  const dir = await logDir($)
  if (!dir) return []
  let names: string[] = []
  try {
    names = (await $.fs.list(dir)).filter(x => x.kind === 'file' && /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(x.name)).map(x => x.name).sort()
  } catch {
    names = [logFileName(new Date())]
  }
  const out: string[] = []
  for (const name of names.reverse()) {
    const text = await readText($, `${dir}/${name}`)
    if (!text) continue
    out.unshift(...text.split('\n').filter(Boolean))
    if (out.length >= n) break
  }

  return out.slice(-n)
}

// Nothing is written to the store before what it holds has been read: a write that raced
// ahead of the load would put the defaults over the remembered values.
let loading: Promise<boolean> | undefined

/** Resolves once the remembered state is loaded (loading it if need be); false when loading failed, so nothing may be written. */
function ready($: EngineInterface) {
  loading ??= loadRemembered($).then(
    () => true,
    err => {
      void fault($, 'load', err)
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
    await fault($, 'mirror', err)
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
    await fault($, 'refresh', err)
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
  const news = asModelNews(await $.store.get(STORE.modelNews))
  await update($, modelNews, () => news)
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

/** Changes the remembered model news, applied to what the store holds so a chat that loaded earlier never writes its older copy over newer news. */
async function editModelNews($: EngineInterface, fn: (n: ModelNews) => ModelNews) {
  const ok = await ready($)
  await locked('modelNews', async () => {
    const stored = ok ? await $.store.get(STORE.modelNews) : undefined
    const next = fn(stored !== undefined ? asModelNews(stored) : await read($, modelNews))
    await update($, modelNews, () => next)
    if (ok) await $.store.set(STORE.modelNews, next)
  })
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
  // A Claude model the router has not seen before is new: it gets a note like a helper's new model.
  await editModelNews($, n => notedNew(n, [{ provider: 'claude', model, first_seen: dayOf(new Date()) }]))
  await queueModelsNote($)
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

/** The rules or a helper note reached the agent: it now knows helpers as they stand. */
async function helpersTold($: EngineInterface) {
  const sig = helperRuleSig(await read($, settings))
  await update($, toldHelpers, () => sig)
}

// --- Actions ------------------------------------------------------------------

async function summary($: EngineInterface) {
  const list = await read($, steps)
  const set = await read($, settings)
  const sent = await read($, policySent)
  const always = await read($, alwaysPlan)

  // No plan: say the router is on and whether the active model has its rules.
  const broken = (await helpersBroken($)) ? ' · helpers ✗' : ''
  if (list.length === 0) {
    const rules = sent.model ? `rules sent to ${sent.model}` : 'rules go out with your next message'
    return `⇄ Router on · ${rules}${always ? ' · always plan' : ''}${broken} · /router for the pane`
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

  return `⇄ Router ${dots} ${head}${now}${money}${broken} · /router`
}

async function refreshStatus($: EngineInterface) {
  $.ui.status(await summary($))
  await publishState($)
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
  await update($, paneView, v => ({ ...v, toggled: {} }))
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

/** The fields a step's next run starts from: the verdict and history entry of the last run no longer apply. A run cut short is not a rerun. */
const freshRun = (s: Step): Step => ({
  ...s,
  status: 'planned',
  runs: 0,
  reruns: s.verdict === 'cut-short' ? s.reruns : s.reruns + 1,
  verdict: undefined,
  verdictBefore: undefined,
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
  // A run cut short says nothing about the model: running it again is not a rerun.
  if (step.historyKey && step.verdict !== 'cut-short') {
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

  for (const [id, v] of verdicts) if (after.some(s => s.id === id && isDelegated(s))) await logEvent($, 'verdict', { id, verdict: v.verdict })
  for (const s of after) {
    const was = before.find(x => x.id === s.id)
    if (s.group || !isHelperRun(s) || s.status !== 'done' || was?.status === 'done') continue
    await logEvent($, 'helper-done', { id: s.id, verdict: s.verdict, usage: s.helperUsage, minutes: runSpan(s) > 0 ? Math.round(runSpan(s) / 6000) / 10 : undefined })
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

  return `Verdict needed for ${missing.map(s => `[${s.id}]`).join(', ')}: call ${PLAN_TOOL} with done: [{id, verdict: "ok" | "weak" | "overkill" | "cut-short", why}] (rule 5). Until then each counts as "no verdict".`
}

/** Records that a helper step runs as a subagent instead, and why: once per run, counted in the chat and all-time totals. */
async function recordFallback($: EngineInterface, id: string, reason: string) {
  const step = (await read($, steps)).find(s => s.id === id)
  if (!step || step.group || (step.where !== 'helper' && !step.helper)) return false
  const counted = !!step.fallback
  await editStep($, id, s => ({ ...s, where: 'agent', fallback: s.fallback ?? reason, helper: undefined, helperModel: undefined, helperEffort: undefined, startedAt: undefined }))
  // The lead made the change itself: no note about it.
  await tellSteps($, [id])
  if (counted) return true
  await update($, chatTotals, t => ({ ...t, fallbacks: (t.fallbacks ?? 0) + 1, lastFallback: reason }))
  await editLifetime($, l => ({ ...l, fallbacks: (l.fallbacks ?? 0) + 1, lastFallback: reason }))
  await logEvent($, 'fallback', { id, reason })

  return true
}

/** Marks steps running (a group: its unfinished parts) and records the helper a step was launched on; `{id, fallback}` runs a helper step as a subagent. */
async function markStarted($: EngineInterface, all: { id: string; ref: StartRef }[]) {
  const fallbacks = all.flatMap(n => (typeof n.ref === 'object' && asReason(n.ref.fallback) ? [{ id: n.id, reason: asReason(n.ref.fallback)! }] : []))
  for (const f of fallbacks) await recordFallback($, f.id, f.reason)
  const named = all.filter(n => !fallbacks.some(f => f.id === n.id))
  if (named.length === 0) return
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
  const mode = helperMode()
  for (const s of await read($, steps)) {
    const on = launched.get(s.id)
    if (on?.helper && targets.has(s.id)) await logEvent($, 'helper-start', { id: s.id, template: s.helper, model: s.helperModel, effort: s.helperEffort, mode })
  }
}

/** The pane's "cut short?": marks a finished delegated run cut short (it then says nothing about the model), or puts back the verdict it had. */
async function toggleCutShort($: EngineInterface, id: string) {
  const step = (await read($, steps)).find(s => s.id === id)
  if (!step || !isDelegated(step) || step.status !== 'done') return
  const undo = step.verdict === 'cut-short'
  const verdict = undo ? (step.verdictBefore ?? undefined) : 'cut-short'
  await editStep($, id, s => ({ ...s, verdict, verdictBefore: undo ? undefined : (s.verdict ?? null) }))
  if (step.historyKey) {
    await editHistory($, h =>
      h.map(x => {
        if (x.key !== step.historyKey) return x
        const { verdict: _v, ...rest } = x

        return verdict ? { ...rest, verdict } : rest
      }),
    )
  }
  await logEvent($, 'verdict', { id, verdict: verdict ?? null, via: 'pane' })
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

/** Claude Code's config directory: $CLAUDE_CONFIG_DIR, else ~/.claude. */
const claudeDir = async ($: EngineInterface) => {
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))

  return (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (home ? `${home.replace(/[\\/]+$/, '')}/.claude` : undefined)
}

/** The marketplace this plugin was installed from (for the install line shown in the pane), read from installed_plugins.json; the author's own when unknown. */
const OWN_MARKETPLACE = 'horef-claude-plugins'
async function marketplaceName($: EngineInterface): Promise<string> {
  try {
    const claude = await claudeDir($)
    const text = claude ? await readText($, `${claude.replace(/[\\/]+$/, '')}/plugins/installed_plugins.json`) : undefined
    const keys = Object.keys((JSON.parse(text ?? '{}') as { plugins?: Record<string, unknown> }).plugins ?? {})
    const mine = keys.find(k => /^model-router@[\w.-]+$/.test(k))

    return mine ? mine.slice('model-router@'.length) : OWN_MARKETPLACE
  } catch {
    return OWN_MARKETPLACE
  }
}

/** Whether Herdr's `hc` can be started (helpers run through it). Only a failure to start it, or the shell's "not found", counts as missing. */
async function hcOnPath($: EngineInterface) {
  try {
    const r = await $.process.run(['hc', '--version'], { timeoutMs: 10_000 })

    return r.exitCode !== 127 && r.exitCode !== 126
  } catch {
    return false
  }
}

/** helpers.py: the path set in Settings, else the newest installed herdr-delegate skill's (under $CLAUDE_CONFIG_DIR, default ~/.claude: plugins/cache/<marketplace>/herdr-delegate/<version>/...). */
async function findHelpers($: EngineInterface, set: Settings): Promise<string | undefined> {
  if (set.helpers.script) return set.helpers.script
  try {
    const claude = await claudeDir($)
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

/** Reads the helper config, and keeps the plan tool's helper offer in step with whether helpers can run now. */
async function loadHelperConfig($: EngineInterface) {
  await readHelperConfig($)
  await syncPlanTool($)
  await logHealth($)
}

/** Whether the chat holds the rules and what they say of helpers is what holds now. */
async function rulesCurrent($: EngineInterface) {
  return (await read($, delivery)).inChat && (await read($, toldHelpers)) === helperRuleSig(await read($, settings))
}

async function checksNow($: EngineInterface): Promise<Check[]> {
  return healthChecks({ set: await read($, settings), st: await read($, helperCfg), rules: await rulesCurrent($) })
}

// The checks last written to the log, so a `health` event is written only when they change.
let loggedHealth = ''

async function logHealth($: EngineInterface) {
  const checks = await checksNow($)
  const key = `${helperMode()}|${checks.map(c => `${c.id}:${c.state}`).join(',')}`
  if (key === loggedHealth) return
  loggedHealth = key
  await logEvent($, 'health', { mode: helperMode(), checks: checks.map(c => ({ id: c.id, state: c.state })) })
}

/** Whether helpers are switched on but cannot run (for the status line's "helpers ✗"). */
async function helpersBroken($: EngineInterface) {
  const set = await read($, settings)
  const st = await read($, helperCfg)

  return set.helpers.enabled && st.status !== 'unknown' && helperMode() === 'none'
}

/** Reads helpers.py's effective config, the shipped defaults beside it and the model cache; run at the start, when Helpers go on, and after a change. */
async function readHelperConfig($: EngineInterface) {
  const set = await read($, settings)
  if (!set.helpers.enabled) return
  madeTemplates.clear()
  const keep = (await read($, helperCfg)).warnings
  const keepReport = (await read($, helperCfg)).report
  const script = await findHelpers($, set)
  // No helper can run without herdr-delegate's helpers.py and Herdr's hc: then there are no helpers (no hard-coded ones).
  if (!script) {
    setHelperConfig(undefined)
    const marketplace = await marketplaceName($)
    await update($, helperCfg, () => ({ status: 'missing', warnings: [], marketplace }))
    return
  }
  // Herdr runs helpers when hc starts and this chat is in a Herdr terminal; without it, direct mode may (helpers.py run).
  const hc = await hcOnPath($)
  const terminal = !!(await $.env.get('HC_TERMINAL_ID'))
  try {
    const r = await runHelpers($, script, ['config'], 30_000)
    const config = r.exitCode === 0 ? parseHelperConfig(r.stdout) : undefined
    if (!config) {
      setHelperConfig(undefined)
      const message = r.exitCode === 2 ? 'This helpers.py has no config command: update herdr-delegate to 0.6.0 or later.' : `helpers.py config failed: ${firstLine(r.stderr || r.stdout) || `exit ${r.exitCode}`}`
      await update($, helperCfg, () => ({ status: 'error', script, warnings: [], message, hc, terminal }))
      return
    }
    const skill = script.replace(/[\\/]scripts[\\/][^\\/]*$/, '')
    const defaults = parseHelperConfig((await readText($, `${skill}/helpers.default.json`)) ?? '')
    const path = await modelsPath($)
    const models = path ? parseModelsCache((await readText($, path)) ?? '') : undefined
    const marketplace = hc ? undefined : await marketplaceName($)
    await update($, helperCfg, () => ({ status: 'ready', script, config, ...(defaults ? { defaults } : {}), ...(models ? { models } : {}), warnings: keep, ...(keepReport ? { report: keepReport } : {}), hc, terminal, ...(marketplace ? { marketplace } : {}) }))
    await applyHelperMode($)
  } catch (err) {
    setHelperConfig(undefined)
    await update($, helperCfg, () => ({ status: 'error', script, warnings: [], message: `helpers.py could not run: ${String(err).slice(0, 160)}`, hc, terminal }))
    await fault($, 'helpers-config', err)
    return
  }
  await resolveHelperPicks($)
}

/**
 * Sets what the router knows of helpers from the config read and the "Run helpers" setting: the mode (Herdr, direct, none)
 * and, unless it is none, the config's orders. With hc missing and no direct mode the status is 'nohc' (the pane says so).
 */
async function applyHelperMode($: EngineInterface) {
  const set = await read($, settings)
  const st = await read($, helperCfg)
  if (!st.config || (st.status !== 'ready' && st.status !== 'nohc')) return
  const mode: HelperMode = helperModeOf(set.helpers.run, { hc: st.hc === true, terminal: st.terminal === true, direct: directAvailable(st.config) })
  setHelperConfig(mode === 'none' ? undefined : st.config, mode)
  const status = mode === 'none' && st.hc === false ? 'nohc' : 'ready'
  if (status !== st.status) await update($, helperCfg, x => ({ ...x, status }))
}

/**
 * Changes a provider's tier through `helpers.py set` (which checks the model and level and renders the template), then reads the config again.
 * Runs that happened before this change and have no recorded model stay with the model they ran on.
 */
async function changeHelperTier($: EngineInterface, provider: string, tier: string, patch: Partial<HelperChoice>): Promise<boolean> {
  return locked('helper-set', async () => {
    const st = await read($, helperCfg)
    const now = helperTierRung(st.config, provider, tier)
    if (st.status !== 'ready' || !st.script || !now) return false
    const next = { model: patch.model ?? now.model, effort: patch.effort ?? now.effort }
    if (next.model === now.model && next.effort === now.effort) return true
    await stampHelperRuns($, `${provider}-${tier}`, { provider, ...now })
    try {
      const r = await runHelpers($, st.script, ['set', provider, tier, `model=${next.model}`, `effort=${next.effort}`])
      if (r.exitCode !== 0) {
        await update($, helperCfg, x => ({ ...x, message: firstLine(r.stderr || r.stdout) || `helpers.py set failed (exit ${r.exitCode})` }))
        return false
      }
    } catch (err) {
      await update($, helperCfg, x => ({ ...x, message: `helpers.py could not run: ${String(err).slice(0, 160)}` }))
      return false
    }
    await update($, helperCfg, x => ({ ...x, message: undefined }))
    await loadHelperConfig($)

    return true
  })
}

/** Gives the helper runs of a template that were recorded without a model the one the template stands for now, before it changes. */
async function stampHelperRuns($: EngineInterface, template: string, was: HelperChoice) {
  const lacking = (await read($, history)).some(x => x.where === 'helper' && x.helper === template && !x.hrung)
  if (lacking) await editHistory($, h => h.map(x => (x.where === 'helper' && x.helper === template && !x.hrung ? { ...x, hrung: was } : x)))
}

/** `helpers.py models`: asks each installed CLI what it offers (JSON with herdr-delegate 0.15+, else the text), then shows what is no longer offered and what is newer. */
async function checkModels($: EngineInterface) {
  const st = await read($, helperCfg)
  if (st.status !== 'ready' || !st.script || st.busy) return
  await update($, helperCfg, x => ({ ...x, busy: true, message: undefined }))
  let report: ModelsReport | undefined
  try {
    const r = await runHelpers($, st.script, hasModelsJson(st.script) ? ['models', '--json'] : ['models'], 180_000)
    // An older helpers.py ignores --json and prints text: then the text is read as before.
    report = r.exitCode === 0 ? parseModelsReport(r.stdout) : undefined
    const warnings = report ? reportWarnings(report) : modelWarnings(r.stdout)
    await update($, helperCfg, x => ({ ...x, warnings, message: r.exitCode === 0 ? undefined : firstLine(r.stderr || r.stdout) || `helpers.py models failed (exit ${r.exitCode})` }))
  } catch (err) {
    await update($, helperCfg, x => ({ ...x, message: `helpers.py could not run: ${String(err).slice(0, 160)}` }))
  }
  await loadHelperConfig($)
  if (report) await absorbReport($, report)
  await update($, helperCfg, x => ({ ...x, busy: false }))
}

// --- New models: the check, the notes file, the note for the main agent, proposals ---------------------------

const today = () => dayOf(new Date())

/** The notes file: <config base>/model-router/model-notes.json, `{ "models": { "<id>": note } }`. */
const notesPath = async ($: EngineInterface) => {
  const base = await configBase($)

  return base ? `${base}/model-router/model-notes.json` : undefined
}

/** Reads the notes file and puts the shipped seed under it (the file wins for the same id). */
async function loadModelNotes($: EngineInterface) {
  try {
    const path = await notesPath($)
    const file = path ? parseNotesFile(await readText($, path)) : undefined
    await update($, modelNotes, () => mergeNotes(file))
  } catch (err) {
    await fault($, 'model-notes', err)
  }
}

/** Adds notes to the file (read again first, so another chat's notes stay) and to this chat's notes. */
async function saveModelNotes($: EngineInterface, list: readonly ModelNote[]) {
  const path = await notesPath($)
  if (!path) throw new Error('no home directory to write to')
  await locked('model-notes', async () => {
    const file = parseNotesFile(await readText($, path))
    for (const n of list) file[n.id] = n
    await $.fs.write(path, `${JSON.stringify({ models: file }, null, 2)}\n`)
    await update($, modelNotes, () => mergeNotes(file))
  })
}

/** A report was read: its new models are remembered, and the main agent is asked about those with no note. */
async function absorbReport($: EngineInterface, report: ModelsReport) {
  await update($, helperCfg, x => ({ ...x, report }))
  await update($, modelFeedback, () => ({}))
  await editModelNews($, n => notedNew(n, report.new))
  await queueModelsNote($)
}

/**
 * Queues ONE router note asking the main agent to look up new models that have no note, and configured models that are gone;
 * once per model (remembered in `modelNews.asked`), several models in one note.
 */
async function queueModelsNote($: EngineInterface) {
  try {
    const have = await read($, modelNotes)
    const report = (await read($, helperCfg)).report
    let ask: ReturnType<typeof toAsk> | undefined
    await editModelNews($, n => {
      const a = toAsk(n, have, report, today())
      if (a.fresh.length === 0 && a.gone.length === 0) return n
      ask = a

      return { ...n, asked: [...n.asked, ...a.fresh.map(m => `${m.provider}:${m.model}`), ...a.gone.map(g => `gone:${g.provider}:${g.model}`)].slice(-200) }
    })
    if (!ask) return
    const text = modelsAskNote(ask, PLAN_TOOL, providerLabel)
    await update($, notes, n => [...n, text])
    await logEvent($, 'models-asked', { new: ask.fresh.map(m => `${m.provider}:${m.model}`), gone: ask.gone.map(g => `${g.provider}:${g.model}`) })
  } catch (err) {
    await fault($, 'models-note', err)
  }
}

// Whether this chat has started the background check already (at most once per chat).
let modelsBackground = false

/**
 * At the start, with helpers ready: the cached report (fast; awaited), and, when a provider's list is missing or older than a week,
 * a live check in the background (not awaited: it asks the CLIs and may take minutes).
 */
async function modelsStartup($: EngineInterface) {
  try {
    const st = await read($, helperCfg)
    // An older helpers.py has no --json (and would ask the CLIs at once for --cached, which it does not know): nothing is read.
    if (st.status !== 'ready' || !st.script || !hasModelsJson(st.script)) return
    const r = await runHelpers($, st.script, ['models', '--json', '--cached'], 30_000)
    const report = r.exitCode === 0 ? parseModelsReport(r.stdout) : undefined
    if (report) await absorbReport($, report)
    const stale = staleProviders(st.config, report, st.models, today())
    if (stale.length > 0 && !modelsBackground) {
      modelsBackground = true
      void backgroundModelsCheck($, st.script, stale)
    }
  } catch (err) {
    await fault($, 'models-cached', err)
  }
}

async function backgroundModelsCheck($: EngineInterface, script: string, stale: string[]) {
  try {
    await logEvent($, 'models-check', { providers: stale })
    const r = await runHelpers($, script, ['models', '--json'], 180_000)
    const report = r.exitCode === 0 ? parseModelsReport(r.stdout) : undefined
    // The config and the model cache are read again, then the report.
    await loadHelperConfig($)
    if (report) await absorbReport($, report)
  } catch (err) {
    await fault($, 'models-check', err)
  }
}

/** What the main agent sent in the plan tool's `models` input: notes into the file, proposals into the news. Returns what was stored and what was skipped. */
async function acceptModels($: EngineInterface, raw: unknown): Promise<string> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as { notes?: unknown; proposals?: unknown }
  const day = today()
  const lines: string[] = []
  const have = await read($, modelNotes)
  const take: ModelNote[] = []
  for (const r of Array.isArray(input.notes) ? input.notes : []) {
    const c = checkNote(r, day)
    for (const d of c.dropped) lines.push(`left out: ${d}`)
    if (!c.note) {
      lines.push(`note skipped: ${c.error}`)
      continue
    }
    const note = c.note
    // The same model under another spelling keeps its id, so there is one note.
    const same = Object.keys(have).find(k => normId(k) === normId(note.id))
    if (same) note.id = same
    if (have[note.id]?.by === 'person') {
      lines.push(`note skipped: ${note.id} was written by the person; it stays`)
      continue
    }
    take.push(note)
  }
  let stored: string[] = []
  if (take.length) {
    try {
      await saveModelNotes($, take)
      stored = take.map(n => n.id)
    } catch (err) {
      lines.push(`notes not stored: ${String(err).slice(0, 120)}`)
    }
  }
  const st = await read($, helperCfg)
  const set = await read($, settings)
  let added: Proposal[] = []
  let skipped: string[] = []
  await editModelNews($, n => {
    const r = checkProposals(input.proposals, { cfg: st.status === 'ready' ? st.config : undefined, cache: st.models, set, news: n, today: day })
    added = r.ok
    skipped = r.skipped

    return r.ok.length ? { ...n, proposals: [...n.proposals, ...r.ok].slice(-20) } : n
  })
  await logEvent($, 'models-from-agent', { notes: stored, proposals: added.map(p => p.key), skipped: lines.length + skipped.length })
  const out = [
    stored.length ? `Stored notes: ${stored.join(', ')}.` : 'No notes stored.',
    added.length ? `Stored proposals (the person sees them under New models and applies or dismisses them): ${added.map(p => `${p.provider} ${p.tier} -> ${p.model}/${p.effort}`).join('; ')}.` : 'No proposals stored.',
    ...[...lines, ...skipped].map(l => `Skipped: ${l}`),
  ]

  return `model-router models: ${out.join('\n')}`
}

/** Applies a proposal from the card: a helper's tier through `helpers.py set`, a Claude tier in the settings. `line` is the card's line, kept as the feedback. */
async function applyProposal($: EngineInterface, key: string, line: string) {
  const p = (await read($, modelNews)).proposals.find(x => x.key === key)
  if (!p) return
  let ok = false
  let text = 'applied'
  if (p.provider === 'claude') {
    if (isTier(p.tier)) {
      const tier = p.tier
      await editSettings($, s => ({ ...s, tiers: { ...s.tiers, [tier]: { ...s.tiers[tier], model: p.model, effort: p.effort as Effort } } }))
      ok = true
    }
  } else {
    ok = await changeHelperTier($, p.provider, p.tier, { model: p.model, effort: p.effort })
    if (!ok) text = (await read($, helperCfg)).message ?? 'could not be applied'
  }
  if (ok) await editModelNews($, n => ({ ...n, proposals: n.proposals.filter(x => x.key !== key) }))
  await update($, modelFeedback, f => ({ ...f, [key]: { line, text, ok } }))
  await logEvent($, ok ? 'model-applied' : 'model-apply-refused', { provider: p.provider, tier: p.tier, model: p.model, effort: p.effort, ...(ok ? {} : { message: text }) })
}

async function dismissProposal($: EngineInterface, key: string) {
  await editModelNews($, n => ({ ...n, proposals: n.proposals.filter(x => x.key !== key), dismissed: n.dismissed.includes(key) ? n.dismissed : [...n.dismissed, key].slice(-200) }))
  await update($, modelFeedback, f => Object.fromEntries(Object.entries(f).filter(([k]) => k !== key)))
  await logEvent($, 'model-dismissed', { key })
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
    await fault($, 'picks', err)
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

/** Whether the plan tool as last registered offers helper steps (undefined: not registered yet this session). */
let planToolHelpers: boolean | undefined

/** Registers the plan tool again when whether helpers can run has changed since it was registered. */
async function syncPlanTool($: EngineInterface) {
  if (planToolHelpers === undefined || planToolHelpers === helpersLive(await read($, settings))) return
  try {
    await registerPlanTool($)
  } catch (err) {
    // Keep the first registration; see registerPlanTool.
    await fault($, 'register-plan-tool', err)
  }
}

/**
 * Registers the plan tool. The schema offers where = 'helper' only while Helpers are on and can run,
 * so with them off it is the 0.9.3 schema exactly. It is registered when the chat starts
 * and again when Helpers are switched in the pane: a name registered again is replaced
 * (the engine's documented behaviour). The tool call also stores 'helper' as 'agent' while off.
 */
async function registerPlanTool($: EngineInterface) {
  const set = await read($, settings)
  // Helpers are offered only when they can run: on, with helpers.py, hc and a helper CLI found.
  const helpersOn = helpersLive(set)
  planToolHelpers = helpersOn
  const wheres = helpersOn ? ['agent', 'here', 'helper'] : ['agent', 'here']
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
                        fallback: { type: 'string', description: 'Instead of helper: the helper step runs as a subagent, for this short reason (e.g. "no Herdr terminal", "picker found nothing", "out of quota")' },
                      },
                      required: ['id'],
                    },
                  ],
                }
              : { type: 'string' },
            description: `Step ids you are starting now${hereOn ? ': the router runs this chat at a here step\'s tier\'s effort' : ''}${helpersOn ? '. A helper step may be {id, helper, model, effort}: the template you launched, and the model and thinking level its screen shows; or {id, fallback}: it runs as a subagent instead, and why' : ''}`,
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
              enum: ['ok', 'weak', 'overkill', 'cut-short'],
              description: 'For a delegated step: ok = result used as returned or with small edits; weak = it needed a rerun, you redid part of it, or review found a substantive error; overkill = plainly mechanical work (finding, listing, extracting, short output, no judgment) that ran above the light tier; cut-short = the run was stopped by something outside the model (lost connection, quota or rate limit, a crash, the person stopping it): it says nothing about the model',
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
        models: {
          type: 'object',
          description:
            'Notes on models and proposed tier changes, after looking up new models (works on its own, without steps). The router stores the notes (by "agent", dated today) and shows the proposals to the person, who applies or dismisses each; nothing changes without their click',
          properties: {
            notes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'The model id as the provider offers it, lowercase, e.g. gemini-4-neon' },
                  name: { type: 'string', description: 'Display name, e.g. Gemini 4 Neon' },
                  providers: { type: 'array', items: { type: 'string' }, description: 'Helper providers (agy, copilot, kiro, ...) or claude that offer it' },
                  released: { type: 'string', description: 'YYYY-MM-DD' },
                  summary: { type: 'string', description: 'One line' },
                  strengths: { type: 'array', items: { type: 'string' } },
                  weaknesses: { type: 'array', items: { type: 'string' } },
                  tags: { type: 'array', items: { type: 'string', enum: [...TAGS] }, description: 'code, review, research, judgment, long-context, fast, cheap, careful (low hallucination), second-opinion (a family other than Claude), agentic' },
                  fits: {
                    type: 'array',
                    items: { type: 'object', properties: { tier: { type: 'string', description: 'light, standard, deep, or a provider tier such as second' }, effort: { type: 'string' }, why: { type: 'string' } }, required: ['tier', 'why'] },
                    description: 'Which tier and thinking level the model fits, and why',
                  },
                  sources: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['url'] } },
                },
                required: ['id', 'summary'],
              },
            },
            proposals: {
              type: 'array',
              description: 'Only where the model is clearly better or cheaper for that tier',
              items: {
                type: 'object',
                properties: {
                  provider: { type: 'string', description: 'A helper provider in the config, or claude for the subagent tiers' },
                  tier: { type: 'string', description: 'A tier the provider has (claude: light, standard, deep)' },
                  model: { type: 'string', description: 'A model the provider offers' },
                  effort: { type: 'string', description: "One of the provider's thinking levels" },
                  why: { type: 'string', description: 'One line' },
                  source: { type: 'string', description: 'A url' },
                },
                required: ['provider', 'tier', 'model', 'effort', 'why'],
              },
            },
          },
        },
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

// A router note about helpers starts with this. It is worked out when a note is delivered (helperNote), not queued.
const HELPER_NOTE = 'Helpers changed'

/**
 * The note that brings what the chat knows of helpers up to date, when it changed since the rules were delivered: whether they
 * can run, the mode, what they are used for, the orders. Undefined when the chat has no rules yet (they will carry it) or nothing changed.
 */
async function helperNote($: EngineInterface) {
  const was = await read($, toldHelpers)
  if (!was || !(await read($, delivery)).inChat) return undefined
  const set = await read($, settings)
  if (helperRuleSig(set) === was) return undefined
  if (!helpersLive(set)) return 'Helpers are now off: run every step as a subagent or here; do not plan "helper" steps.'
  const fusion = set.helpers.fusion === 'off' ? '' : ` (Copilot Fusion ${set.helpers.fusion})`

  return `${HELPER_NOTE}${fusion}; this replaces rule 6: ${helperRule(set, (await read($, helperCfg)).script)}`
}

async function editHelpers($: EngineInterface, patch: Partial<Settings['helpers']> | ((h: Settings['helpers']) => Partial<Settings['helpers']>)) {
  const was = (await read($, settings)).helpers
  const wasOn = was.enabled
  await editSettings($, s => ({ ...s, helpers: { ...s.helpers, ...(typeof patch === 'function' ? patch(s.helpers) : patch) } }))
  const after = await read($, settings)
  // Helpers just went on, or helpers.py is somewhere else now: read its config.
  if (after.helpers.enabled && (!wasOn || after.helpers.script !== was.script)) await loadHelperConfig($)
  // The way helpers run changed: the mode follows from what was read.
  else if (after.helpers.run !== was.run) await applyHelperMode($)
  await resolveHelperPicks($)
  // The plan tool offers "helper" only while helpers can run. The rules sit in the chat once; what changed reaches it as
  // one router note at the next turn (helperNote).
  await syncPlanTool($)
  await logHealth($)
  await refreshStatus($)
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
  } catch (err) {
    // Keep the first registration; see registerPlanTool.
    await fault($, 'register-plan-tool', err)
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

/**
 * Rule 6, the helper rule, without its number: how to run a helper step in the mode helpers run in now (through Herdr, or
 * directly with helpers.py run), the orders, the fallback and the usage. `script` is the helpers.py found, for direct mode.
 */
const helperRule = (set: Settings, script?: string) => {
  const h = set.helpers
  const use =
    h.use === 'all'
      ? 'Use it for every self-contained step that would otherwise be "agent".'
      : 'Use it for long self-contained steps (research, code to a spec, sweeps, anything over ~15 tool calls); shorter self-contained steps stay "agent".'
  const orders = TIER_ORDER.map(t => `${t}: ${helperList(set, t).join(',') || 'none installed'}`).join('; ')
  const fallback = `If no helper is usable, call ${PLAN_TOOL} with start: [{id, fallback: "<short reason>"}] (e.g. "no Herdr terminal", "picker found nothing", "out of quota"), then run the step as "agent" with the Agent tool, its description starting with "[<step id>]", and say so.`
  if (helperMode() === 'direct') {
    const py = `python3 ${h.script || script || `<the ${h.skill} skill's folder>/scripts/helpers.py`}`

    return `where = "helper" runs a step on an agent from another subscription or account, directly, without Herdr (direct mode). ${use} The ${h.skill} skill's direct-mode section has the details. Pick the helper with \`${py} pick <order>\` in this order for the step's tier: ${orders}. When a helper step's plan line says "launch <template>", the router chose that model and level for it: pick <template>,<the order>. Write the brief to a file inside the workspace; nobody can approve the helper's commands while it runs, so the brief must keep it to reading and editing files in its workspace. Run \`${py} run <template> --brief <file> --cwd <dir>\` with Bash in the background (in Claude Code: run_in_background); you are notified when it ends. When you start it, call ${PLAN_TOOL} with start: [{id, helper: "<the template>", model: "<the template's model>"}]. Its last stdout line is JSON with "out" (the helper's report file), "model", "effort" and "usage". Read the report and review the work yourself. Then mark the step done with ${PLAN_TOOL}: done: [{id, verdict, why, usage}], passing the JSON's usage as it is; leave usage out when it is null, and never send 0 or a guess. ${fallback}`
  }
  const usageCmd = `python3 ${h.script ? h.script : `<the ${h.skill} skill's folder>/scripts/helpers.py`} usage <the helper's name>`

  return `where = "helper" runs a step on an agent from another subscription or account, through the ${h.skill} skill. ${use} To run one, load the ${h.skill} skill and follow it. Pick the helper with its picker in this order for the step's tier: ${orders}. When a helper step's plan line says "launch <template>", the router chose that model and level for it (the template already exists): give the picker that template first, then the tier's order (pick <template>,<the order>), and launch what it prints. ${fallback} When you start a helper step, call ${PLAN_TOOL} with start: [{id, helper: "<the template you launched>", model: "<the model the helper reports on its screen>", effort: "<its thinking level, if the screen shows one>"}], so the pane shows them (leave effort out when the screen shows none; the pane then reads it from the template). Review the helper's result yourself. Before you close the helper, run \`${usageCmd}\`: it prints the helper's usage as JSON {"provider","amount","unit"}, or nothing. Then mark the step done with ${PLAN_TOOL}: done: [{id, verdict, why, usage: {provider, amount, unit}}], passing that JSON as usage; leave usage out when it printed nothing, and never send 0 or a guess.`
}

const policy = (set: Settings, kinds: readonly string[] = [], script?: string) => {
  const tiers = TIER_ORDER.map(t => `- ${t} (${rungLabel(set.tiers[t])}): ${TIER_USE[t]}`).join('\n')
  const skills = Object.entries(set.skills)
  // With helpers on but no helper able to run, the rules do not advertise helpers or their orders.
  const live = helpersLive(set)
  const skillRule = skills.length
    ? `\n${live ? 7 : 6}. These skills run in a subagent on a tier: ${skills.map(([n, t]) => `${n} (${t})`).join(', ')}. To use one, delegate with the Agent tool, its description starting "[${SKILL_TAG}<name>]", and a brief that tells the subagent to invoke that skill with everything it needs from this conversation.`
    : ''
  const helperText = live ? `\n6. ${helperRule(set, script)}` : ''

  return `# Model routing (model-router mod)

The user installed this mod so that each step of a task runs on the cheapest model tier that does it well, and authorizes delegating steps to subagents for this purpose.

1. When a request has several distinct steps (more than a handful of tool calls in all), first call ${PLAN_TOOL} with the steps. Tag each with a tier and with where it runs. Skip this for single-step or conversational requests. The call waits for the user to approve the plan (unless they turned on auto-approve) and returns the approved plan, which the user may have edited: follow what it returns. If it returns a revision request, revise and call it again. A step that splits into pieces may carry "parts" (the same fields, nested as deep as the work needs; a part's id extends its parent's: s3, s3.a, s3.a.1). A step with parts is a group: its tier only rates it, and each part runs where and on the tier it names. A part done by several identical agents at once (N readers, say) has "count": N. Give each step that does work a "kind": a short label for the kind of work (${
    kinds.length ? `kinds used so far: ${kinds.join(', ')}; reuse one when it fits, else a new short label` : 'e.g. code-review, summarize, search, write-code, figure'
  }; a step that runs a skill takes the skill's name). The router learns per kind which model does it well.
2. Tiers:
${tiers}
3. where = "here" for steps that need this conversation's accumulated context or back-and-forth with the user, and for small steps (under ~5 tool calls: a subagent costs ~15-40k tokens just to start). where = "agent" for self-contained steps, above all ones that read a lot. A "here" step runs on this chat's own model and thinking level, which no tier can change: still give it the tier its work needs, since that is the default if the user sends it to a subagent, and the router flags a here step rated above this chat's model. Do not mark a step "light" to mean "do it quickly here".
4. Delegate an "agent" step with the Agent tool, its description starting with "[<step id>]". Do not set model or effort: the router sets them from the plan. Never use subagent_type "fork" for a routed step, since a fork ignores the model. Delegate a part under its own id ("[s3.a]"); with "count": N make N Agent calls with that id, started together, and the part is done when all N finish. Write a self-contained brief: goal, files, what to return. Light-tier briefs ask for a findings list, not fixes; spot-check surprising findings. If a light result is weak, say so: the user can rerun the step one rung higher from the pane.
5. Mark "here" steps done through ${PLAN_TOOL} (done: [ids]) as you finish them. A group is done when all its parts are; naming it in done marks its unfinished parts done. Every delegated step (a subagent${live ? ' or helper' : ''} step, parts included) needs a verdict once you have checked its result: call ${PLAN_TOOL} with done: [{id, verdict, why}] (a subagent step is marked done when its agent ends; still give it one). The verdict says what happened, not how it felt: "ok" = you used the result as returned or with small edits; "weak" = it needed a rerun, you redid part of it, or review found a substantive error; "overkill" = plainly mechanical work (finding, listing, extracting, short output, no judgment) that ran above the light tier; "cut-short" = the run was stopped by something outside the model (lost connection, quota or rate limit, a crash, the person stopping it): it says nothing about the model. why: a few words.${helperText}${skillRule}${
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

type StartRef = string | { id?: string; helper?: string; model?: string; effort?: string; fallback?: string }
type DoneRef = string | { id?: string; usage?: unknown; verdict?: unknown; why?: unknown }
type PlanInput = {
  status?: boolean
  models?: unknown
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


// --- The report ---------------------------------------------------------------

/** The model check as the report and the status check give it. */
async function modelCheck($: EngineInterface) {
  const st = await read($, helperCfg)

  return modelCheckLines({ report: st.report, cache: st.models, news: await read($, modelNews), notes: Object.keys(await read($, modelNotes)).length, today: today() })
}

/** One line each for the status check. */
async function modelStatus($: EngineInterface) {
  const c = await modelCheck($)

  return { modelsChecked: c.checked, modelsNew: c.new, modelsGone: c.gone, modelProposals: Number(c.proposals), modelNotes: Number(c.notes) }
}

/** Writes the diagnostics report to <config base>/model-router/report-YYYYMMDD-HHMM.md; the pane shows where, beside the button. */
async function writeReport($: EngineInterface): Promise<string | undefined> {
  try {
    const base = await configBase($)
    if (!base) throw new Error('no home directory to write to')
    const at = new Date()
    const path = `${base}/model-router/${reportFileName(at)}`
    const set = await read($, settings)
    const life = await read($, lifetime)
    let platform: string | undefined
    try {
      platform = (await $.session.info()).platform
    } catch {
      platform = undefined
    }
    const text = reportMarkdown({
      version: VERSION,
      at,
      platform,
      surface: surfaceNow,
      model: (await read($, main)).model ?? (await read($, policySent)).model,
      set,
      checks: await checksNow($),
      mode: helperMode(),
      st: await read($, helperCfg),
      history: (await read($, history)).length,
      lifetime: { steps: life.steps, plans: life.plans, helperSteps: life.helper.steps, fallbacks: life.fallbacks, since: life.since },
      events: await lastLogLines($, 100),
      models: await modelCheck($),
    })
    await $.fs.write(path, text)
    const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
    const shown = home && path.startsWith(home) ? `~${path.slice(home.replace(/[\\/]+$/, '').length)}` : path
    await update($, reportNote, () => `Report written: ${shown} — send this file`)
    await logEvent($, 'report', {})

    return shown
  } catch (err) {
    await update($, reportNote, () => `Report not written: ${String(err).slice(0, 120)}`)
    await fault($, 'report', err)

    return undefined
  }
}

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

// The pane, one layout on every surface (0.26): health line, new-models card, plan, cost, footer.
// Layer 1: the plan as rows of two lines, one cost line, the footer. Layer 2: a step's details (▸),
// the glossary (?), cost details, and the Settings groups. Settings replace plan, cost and footer while open.
export async function renderPane($: RenderArgs[0], e: RenderArgs[1]) {
  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
  const hasFields = e.surface !== 'mobile'
  const tty = e.surface === 'terminal'
  const site = e.props as { isFocused?: boolean; scroll?: { offset: number }; bodyColumns?: number }
  // A narrow terminal gets the short word for helpers.
  const tight = tty && (site.bodyColumns ?? 80) < 50
  // The terminal draws a Select's list inline, pushing its neighbours about, and only a
  // pick closes it: there a button that cycles to the next option on Enter reads better.
  const Select = hasFields && !tty && 'Select' in ui ? ui.Select : undefined
  const Input = hasFields && 'Input' in ui ? ui.Input : undefined

  const plan = await read($, steps)
  // Edits to a running plan wait in a draft: the rows show them laid over the plan's own values.
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
  const pathOpen = await read($, showHelperPath)
  const known = await read($, told)
  const pv = await read($, paneView)
  const glossaryOpen = await read($, showGlossary)
  const costOpen = await read($, showCostDetails)
  const orderEdit = await read($, editOrder)
  const gridOpen = await read($, showHelperGrid)
  const asking = await read($, confirmReset)
  const resetText = await read($, resetNote)

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
  const hint = modelHint(list, m.model)
  const advice = suggestions(past, set)
  // Helper models: what helpers.py holds (read at the start and after a change), and the advice the history gives for them.
  const hs = await read($, helperCfg)
  const hcfg = hs.status === 'ready' ? hs.config : undefined
  // Helpers are on and can run (helpers.py, hc and a helper CLI found): only then are orders and models shown.
  const helpersOn = helpersLive(set)
  const helperAdvice = set.helpers.enabled ? helperSuggestions(past, set, hcfg, hs.models) : []
  // Auto mode: the rung each kind has learned, for the rows (nothing while it is off).
  const learned = set.autoRoute ? learnedRungs(past, set) : undefined
  // The health line: quiet when helpers are off or can run; the first failing check, with the full list one click away, when not.
  const checks = healthChecks({ set, st: hs, rules: (await read($, delivery)).inChat && (await read($, toldHelpers)) === helperRuleSig(set) })
  const health = healthLine(set, checks, hs.status, liveProviders(set))
  const healthOpen = await read($, showHealth)
  const reportText = await read($, reportNote)
  const models = knownModels(set)
  // New models: the card (only with proposals pending or models without notes), and the list of notes in Settings.
  const news = await read($, modelNews)
  const allNotes = await read($, modelNotes)
  const feedback = await read($, modelFeedback)
  const nm = newModelsCard({ news, notes: allNotes, report: hs.report, cache: hs.models, cfg: hcfg, set, today: dayOf(new Date()) })
  const cardNotes = await read($, showCardNotes)
  const allNotesOpen = await read($, showAllNotes)

  // Settings that differ from the defaults get a quiet dot, so it shows which of your own values are active.
  const D = DEFAULT_SETTINGS
  const differs = {
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
    run: set.helpers.run !== D.helpers.run,
    log: set.log !== D.log,
    herdrView: set.herdrView !== D.herdrView,
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
  const helperTiersDiffering = hcfg
    ? helperProviders(hcfg, set).flatMap(p => helperTierNames(hcfg, p).filter(t => helperDiffers(p, t).model || helperDiffers(p, t).effort).map(t => ({ provider: p, tier: t })))
    : []
  // What each Settings group holds that differs from the defaults: the dot on its closed header.
  const groupDiffers = {
    models: TIER_ORDER.some(t => tierDiffers(t).model || tierDiffers(t).effort),
    helpers:
      set.helpers.enabled &&
      (differs.run || differs.fusion || set.helpers.script !== D.helpers.script || Object.keys(set.helpers.kinds).length > 0 || helperTiersDiffering.length > 0 || TIER_ORDER.some(orderDiffers)),
    learning: differs.autoRoute || differs.autoMinRuns || differs.autoOkPercent || Object.keys(set.kinds).length > 0,
    prices: set.models.length > 0 || models.some(priceDiffers),
    skills: Object.keys(set.skills).length > 0,
    diagnostics: differs.log || differs.herdrView,
    advanced: differs.hereEffort || differs.hereLimit || TIER_ORDER.some(t => tierDiffers(t).scope),
  }
  const preset = presetOf(set)
  const anyDiffers =
    Object.values(groupDiffers).some(Boolean) || differs.always || differs.auto || differs.openPane || differs.helpers || differs.use || preset !== 'balanced'
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

  // A picker where the surface has one, else a button that cycles.
  const pick = (key: string, value: string, options: readonly Option[], onPick: (v: string) => void) =>
    Select ? (
      <Select key={key} value={value} options={options} onSelect={v => onPick(v)} />
    ) : (
      <Button key={key} onPress={() => onPick(cycle(options.map(o => o.value), value))}>
        {`${options.find(o => o.value === value)?.label ?? value}${tty ? ' ⇄' : ''}`}
      </Button>
    )

  // A settings row: the name and what it changes on the left, its control on the right.
  const settingRow = (key: string, label: string, help: string | undefined, control: unknown, isCustom = false, below?: unknown) => (
    <Box key={`row:${key}`} flexDirection="column">
      <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm" rowGap="xs">
        <Box flexDirection="column" flexShrink={1}>
          <Box flexDirection="row" columnGap="xs">
            <Text weight="medium">{label}</Text>
            {dot(key, isCustom)}
          </Box>
          {help ? <Text dimColor size="footnote" wrap="wrap">{help}</Text> : null}
        </Box>
        {control as never}
      </Box>
      {(below ?? null) as never}
    </Box>
  )
  const switchRow = (key: string, label: string, help: string, isOn: boolean, onPress: () => void, isCustom = false) =>
    settingRow(
      key,
      label,
      help,
      <Button key={key} variant={isOn ? 'primary' : 'secondary'} onPress={onPress}>
        {isOn ? 'On' : 'Off'}
      </Button>,
      isCustom,
    )

  // A Settings group: one line when closed (name, what is inside, a dot when something differs); open, its rows under it.
  const settingsGroup = (id: string, name: string, summary: string, flagged: { fail?: boolean; custom?: boolean }, body: () => unknown) => {
    const isOpen = set.openGroups.includes(id)

    return (
      <Box key={`settings-group:${id}`} flexDirection="column" rowGap="xs">
        <Box flexDirection="row" flexWrap="wrap" columnGap="sm" alignItems="center">
          <Button
            key={`group:${id}`}
            plain
            onPress={() => void editSettings($, s => ({ ...s, openGroups: s.openGroups.includes(id) ? s.openGroups.filter(x => x !== id) : [...s.openGroups, id] }))}
          >
            {`${isOpen ? '▾' : '▸'} ${name}`}
          </Button>
          <Text key={`group-summary:${id}`} size="footnote" color={flagged.fail ? 'warning' : undefined} dimColor={!flagged.fail} wrap="wrap">
            {summary}
          </Text>
          {dot(`group:${id}`, !!flagged.custom)}
        </Box>
        {isOpen ? (
          <Box key={`group-body:${id}`} flexDirection="column" rowGap="xs" paddingLeft={2}>
            {body() as never}
          </Box>
        ) : null}
      </Box>
    )
  }

  // Write report, with where it went (or why not) right beside it.
  const reportRow = (key: string) => (
    <Box key={`report-row:${key}`} flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
      <Button key={key} plain onPress={() => void writeReport($)}>
        Write report
      </Button>
      {reportText ? <Text color={reportText.startsWith('Report written') ? 'success' : 'warning'} size="footnote" wrap="wrap">{reportText}</Text> : null}
    </Box>
  )
  const checkGlyph = { ok: '✓', fail: '✗', skip: '–' } as const
  // The helper checks with their fixes: under the health line's Why, and in Settings → Other subscriptions.
  const checkList = (where: string) =>
    checks.map(c => (
      <Box key={`check:${where}:${c.id}`} flexDirection="column">
        <Text size="footnote" color={c.state === 'fail' ? 'warning' : undefined} dimColor={c.state === 'skip'} wrap="wrap">{`${checkGlyph[c.state]} ${c.text}`}</Text>
        {c.state === 'fail' && c.fix ? (
          <Box paddingLeft={2}>
            <Text dimColor size="footnote" wrap="wrap">{c.fix}</Text>
          </Box>
        ) : null}
      </Box>
    ))
  const healthRow = (
    <Box key="section:health" flexDirection="column" rowGap="xs">
      <Box flexDirection="row" flexWrap="wrap" columnGap="sm" alignItems="center">
        <Text key="health-line" size="footnote" color={health.ok ? undefined : 'warning'} dimColor={health.ok} wrap="wrap">
          {health.text}
        </Text>
        {!health.ok && (
          <Button key="health-why" plain onPress={() => void update($, showHealth, v => !v)}>
            {healthOpen ? 'Why ▾' : 'Why ▸'}
          </Button>
        )}
      </Box>
      {!health.ok && healthOpen && (
        <Box key="health-checks" flexDirection="column" rowGap="xs" paddingLeft={2}>
          {checkList('health')}
          {reportRow('health-report')}
        </Box>
      )}
    </Box>
  )

  // Layer 1: new models and proposals, each with Apply and Dismiss. Layer 2 (Notes ▸): strengths, weaknesses, fits and sources.
  const applied = Object.entries(feedback).filter(([k, f]) => f.ok && !nm?.proposals.some(p => p.key === k))
  const modelsCard =
    nm || applied.length > 0 ? (
      <Box key="section:news" flexDirection="column" rowGap="xs" borderStyle="round" borderColor="suggestion" paddingX="sm" paddingY={tty ? 0 : 'xs'}>
        {nm && (
          <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm">
            <Text weight="semibold">{`New models (${nm.models.length || nm.proposals.length})`}</Text>
            {nm.checked ? <Text dimColor size="footnote">{`checked ${nm.checked}`}</Text> : null}
          </Box>
        )}
        {nm?.models.map(m => (
          <Text key={`new-model:${m.key}`} size="footnote" dimColor={!m.note} wrap={tty ? 'truncate' : 'wrap'}>
            {cardModelLine(m, tty ? 50 : undefined)}
          </Text>
        ))}
        {nm?.proposals.map(p => {
          const line = `${p.tier} ${p.label}: ${p.from} → ${p.to} · ${p.why}`
          const fb = feedback[p.key]

          return (
            <Box key={`proposal:${p.key}`} flexDirection="column">
              <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap="sm" rowGap="xs">
                <Text size="footnote" wrap={tty ? 'truncate' : 'wrap'}>{line}</Text>
                <Button key={`model-apply:${p.key}`} onPress={() => void applyProposal($, p.key, line)}>
                  Apply
                </Button>
                <Button key={`model-dismiss:${p.key}`} plain dimColor onPress={() => void dismissProposal($, p.key)}>
                  Dismiss
                </Button>
              </Box>
              {fb && !fb.ok ? <Text color="warning" size="footnote" wrap="wrap">{fb.text}</Text> : null}
            </Box>
          )
        })}
        {applied.map(([k, f]) => (
          <Text key={`proposal-done:${k}`} color="success" size="footnote" wrap={tty ? 'truncate' : 'wrap'}>{`✓ ${f.line} · ${f.text}`}</Text>
        ))}
        {nm && nm.models.some(m => m.note) && (
          <Button key="model-card-notes" plain onPress={() => void update($, showCardNotes, v => !v)}>
            {cardNotes ? 'Notes ▾' : 'Notes ▸'}
          </Button>
        )}
        {nm && cardNotes
          ? nm.models.flatMap(m =>
              m.note
                ? [
                    <Box key={`card-note:${m.key}`} flexDirection="column" paddingLeft={2}>
                      <Text weight="medium" size="footnote">{m.name}</Text>
                      {m.note.strengths.length ? <Text size="footnote" wrap="wrap">{`Strengths: ${m.note.strengths.join('; ')}`}</Text> : null}
                      {m.note.weaknesses.length ? <Text size="footnote" wrap="wrap">{`Weaknesses: ${m.note.weaknesses.join('; ')}`}</Text> : null}
                      {m.note.fits.length ? <Text size="footnote" wrap="wrap">{`Fits: ${m.note.fits.map(f => `${f.tier}${f.effort ? ` ${f.effort}` : ''} (${f.why})`).join('; ')}`}</Text> : null}
                      {m.note.sources.length ? <Text dimColor size="footnote" wrap="wrap">{`Sources: ${m.note.sources.map(x => `${x.title} ${x.url}${x.date ? ` (${x.date})` : ''}`).join('; ')}`}</Text> : null}
                    </Box>,
                  ]
                : [],
            )
          : null}
      </Box>
    ) : null

  // --- Plan ---------------------------------------------------------------------

  // The four pickers of a step: where it runs, its level, and (for a Claude agent) model and effort.
  const stepPickers = (s: Step) => {
    // The default a step runs on without picks of its own: its level's, its kind's, or what auto mode learned.
    const base = baseRung(s, set, learned)
    const from = base.source === 'tier' ? 'level' : base.source === 'kind' ? 'kind' : 'auto'
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
          { value: 'agent', label: whereLabel('agent') },
          { value: 'here', label: whereLabel('here') },
          ...(helpersLive(set) || s.where === 'helper' ? [{ value: 'helper', label: whereLabel('helper', tight) }] : []),
        ],
        v => void paneEdit($, s.id, { where: v as Where }),
      ),
      mark('where'),
      // On a here step the level is a rating, not a setting of this chat: a label, not a picker.
      // Sending the step to a Claude agent brings the picker back.
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
  const kindTag = (s: Step) => (s.kind ? <Text key={`kind:${s.id}`} dimColor size="footnote">{s.kind}</Text> : null)
  // Where the rung comes from when it is not the level: "auto: sonnet · high (learned, 5 runs)".
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
      <Text key={`pick:${s.id}`} color="warning" size="footnote" wrap="wrap">{`no template for ${p.model} ${p.effort} (${p.error ?? 'unknown'}): the order applies`}</Text>
    )
  }
  // The lead's verdict on a finished delegated step: one word on the row, the why and "cut short?" in the details.
  const hasVerdictLine = (s: Step) => isDelegated(s) && s.status === 'done'
  const verdictColor = (s: Step) => (s.verdict === 'weak' ? 'warning' : s.verdict === 'overkill' ? 'suggestion' : undefined)
  const verdictWord = (s: Step) =>
    hasVerdictLine(s) ? (
      <Text key={`verdict-word:${s.id}`} color={verdictColor(s)} dimColor={!s.verdict || s.verdict === 'ok' || s.verdict === 'cut-short'} size="footnote">
        {s.verdict === 'cut-short' ? 'cut short' : (s.verdict ?? 'no verdict yet')}
      </Text>
    ) : null
  const verdictText = (s: Step) => {
    if (!hasVerdictLine(s)) return null
    const label =
      s.verdict === 'cut-short'
        ? 'cut short: says nothing about the model, left out of the advice'
        : s.verdict
          ? `verdict ${s.verdict}${s.why ? `: ${s.why}` : ''}`
          : 'no verdict yet'

    return (
      <Box key={`verdict-row:${s.id}`} flexDirection="row" flexWrap="wrap" columnGap="xs" alignItems="center">
        <Text key={`verdict:${s.id}`} color={verdictColor(s)} dimColor={!s.verdict || s.verdict === 'ok' || s.verdict === 'cut-short'} size="footnote" wrap="wrap">
          {label}
        </Text>
        {/* A run stopped by a lost connection, a quota or a crash: one quiet link takes it out of the advice; again puts it back. */}
        <Button key={`cut:${s.id}`} plain dimColor onPress={() => void toggleCutShort($, s.id)}>
          {s.verdict === 'cut-short' ? 'undo' : 'cut short?'}
        </Button>
      </Box>
    )
  }

  const isOpen = (s: Step) => stepOpen(pv, set, s.id)
  const opener = (s: Step) => (
    <Button key={`open:${s.id}`} plain onPress={() => void update($, paneView, v => ({ ...v, toggled: { ...v.toggled, [s.id]: !stepOpen(v, set, s.id) } }))}>
      {isOpen(s) ? '▾' : '▸'}
    </Button>
  )
  // Line 1 of a row: the opener, status, id, title (wrapping) and tags.
  const rowHead = (s: Step, tags: unknown[]) => (
    <Box flexDirection="row" columnGap="sm" alignItems="center">
      {opener(s)}
      <Text color={STATUS_COLOR[s.status]}>{STATUS_GLYPH[s.status]}</Text>
      <Text color={TIER_COLOR[s.tier]} mono size="footnote">{s.id}</Text>
      <Box flexShrink={1}>
        <Text weight={s.group ? 'semibold' : 'medium'} wrap="wrap" dimColor={s.status === 'done'}>{s.title}</Text>
      </Box>
      {tags as never}
    </Box>
  )

  // A group: its title, how many parts are done and what they cost together. Its level only rates it.
  const groupRow = (s: Step) => {
    const r = rollupOf(list, s)
    const moved = helperLine(r.helper)
    const tokens = r.usage.input + r.usage.cacheWrite + r.usage.output

    return (
      <Box key={`card:${s.id}`} flexDirection="column">
        {rowHead(s, [
          <Text key={`rated:${s.id}`} color={TIER_COLOR[s.tier]} size="footnote">{`rated ${s.tier}`}</Text>,
          <Text key={`parts:${s.id}`} dimColor size="footnote">{`${r.done}/${r.total} done`}</Text>,
          r.cost > 0 ? <Text key={`gcost:${s.id}`} dimColor size="footnote" tabular>{`≈${fmtUsd(r.cost)}`}</Text> : null,
        ])}
        {isOpen(s) && (r.cost > 0 || moved) ? (
          <Box key={`details:${s.id}`} flexDirection="column" paddingLeft={4}>
            {r.cost > 0 && (
              <Text dimColor size="footnote" tabular wrap="wrap">
                ≈{fmtUsd(r.cost)} · {fmtTok(tokens)} tok + {fmtTok(r.usage.cacheRead)} cached
                {r.mainCost > r.cost ? ` · saved ≈${fmtUsd(r.mainCost - r.cost)}` : ''}
              </Text>
            )}
            {moved && <Text dimColor size="footnote" wrap="wrap">{moved}</Text>}
          </Box>
        ) : null}
      </Box>
    )
  }

  // A step: two lines (title; pickers, cost, verdict, rerun), its details under it when open.
  const stepRow = (s: Step) => {
    if (s.group) return groupRow(s)
    const now = runsOn(s, set, learned)
    const own = planOf(s.id) ?? s
    const up = own.where === 'agent' && own.status === 'done' ? nextRung(runsOn(own, set, learned), set) : undefined
    const tokens = s.usage.input + s.usage.cacheWrite + s.usage.output
    const needs = hereNeeds(s, set, m.model)

    return (
      <Box key={`card:${s.id}`} flexDirection="column">
        {rowHead(s, [countTag(s), kindTag(s)])}
        <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center" paddingLeft={4}>
          {stepPickers(s)}
          {s.cost > 0 && !s.unpriced && <Text dimColor size="footnote" tabular>{`≈${fmtUsd(s.cost)}`}</Text>}
          {s.unpriced && <Text key={`unpriced:${s.id}`} color="warning" size="footnote">{fmtCost(s.cost, true)}</Text>}
          {helperInfo(s)}
          {verdictWord(s)}
          {needs && <Text color="warning" size="footnote">{`⚠ rated for ${needs}`}</Text>}
          {s.setupHeavy && <Text color="warning" size="footnote">⚠ start-up heavy</Text>}
          {changeNoted(s) && <Text key={`noted:${s.id}`} color="suggestion" size="footnote">change noted, applies from the next turn</Text>}
          {up && (
            <Button key={`rerun:${s.id}`} plain onPress={() => void rerun($, s.id)}>
              {`↑ Rerun on ${rungLabel(up)}`}
            </Button>
          )}
        </Box>
        {isOpen(s) && (
          <Box key={`details:${s.id}`} flexDirection="column" rowGap="xs" paddingLeft={4}>
            {rungFrom(s)}
            {pickLine(s)}
            {s.where === 'here' && (
              <Text dimColor size="footnote" wrap="wrap">
                {`Runs in this chat on ${m.model ?? 'its model'} at its own effort; the level is a rating, used if you send it to a Claude agent (then you can change it).`}
              </Text>
            )}
            {needs && (
              <Text color="warning" size="footnote" wrap="wrap">
                {`Rated ${s.tier} (${needs}), but this chat runs on ${m.model}: send it to a Claude agent, or switch this chat's model.`}
              </Text>
            )}
            {s.where === 'here' && s.effortNote && set.hereEffort.enabled && (
              <Text color={s.effortNote.startsWith('Kept') ? 'warning' : undefined} dimColor={!s.effortNote.startsWith('Kept')} size="footnote" wrap="wrap">
                {s.effortNote}
              </Text>
            )}
            {s.where === 'helper' && !s.helper && (
              <Text dimColor size="footnote" wrap="wrap">
                {`Runs on another subscription's agent (${helperOrder(set, s.tier)}); a Claude agent if none is usable.`}
              </Text>
            )}
            {helperFactsText(s)}
            {s.cost > 0 && !s.unpriced && (
              <Text dimColor size="footnote" tabular wrap="wrap">
                ≈{fmtUsd(s.cost)} · {fmtTok(tokens)} tok + {fmtTok(s.usage.cacheRead)} cached
                {s.mainCost > s.cost ? ` · saved ≈${fmtUsd(s.mainCost - s.cost)}` : ''}
                {s.reruns > 0 ? ` · rerun ${s.reruns}×` : ''}
              </Text>
            )}
            {s.unpriced && (
              <Text color="warning" size="footnote" tabular wrap="wrap">
                {`${fmtCost(s.cost, true)} · ${fmtTok(tokens)} tok + ${fmtTok(s.usage.cacheRead)} cached · no price for ${s.resolvedModel ?? now.model}: left out of savings (Settings → Models and prices)`}
              </Text>
            )}
            {verdictText(s)}
            {s.fallback ? <Text key={`fallback:${s.id}`} dimColor size="footnote" wrap="wrap">{`ran as a Claude agent: ${s.fallback}`}</Text> : null}
            {s.setupHeavy && <Text color="warning" size="footnote" wrap="wrap">Mostly start-up cost: a step this small is cheaper done here.</Text>}
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
        {stepRow(s)}
      </Box>
    ) : (
      stepRow(s)
    )
  }

  const allOpen = list.length > 0 && list.every(isOpen)
  const GLOSSARY: [string, string][] = [
    ['light · standard · deep', 'how hard a step is; it picks the model a Claude agent or other subscription runs on'],
    ['this chat', 'the step is done here, on this chat’s own model and effort'],
    ['Claude agent', 'a separate Claude helper (a subagent) on the level’s model'],
    ['other subscription', 'an agent of another account or service (Copilot, Codex, Kiro, Antigravity), through herdr-delegate'],
    ['kind', 'the sort of work (write-code, code-review…); the router learns per kind which model does it well'],
    ['verdict', 'ok · weak (needed more) · overkill (a cheaper model would do) · cut short (stopped by a fault, not counted)'],
    ['effort', 'how long the model thinks before it answers: low, medium, high, xhigh, max'],
    ['saved', 'what delegated steps cost less than the same work on this chat’s model'],
    ...(tty ? ([['⇄', 'a button that picks the next option on Enter']] as [string, string][]) : []),
  ]
  const planSection = (
    <Box key="section:plan" flexDirection="column" rowGap="xs">
      {list.length === 0 ? (
        <Box flexDirection="column">
          <Text key="plan-empty" size="footnote" wrap="wrap">No plan yet. Multi-step tasks show their steps here.</Text>
          {!always && <Text dimColor size="footnote" wrap="wrap">Turn on "Plan every message" in Settings to plan every message.</Text>}
        </Box>
      ) : (
        <Box flexDirection="column" rowGap="xs">
          <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm">
            <Text key="plan-head" weight="semibold" wrap="wrap">
              {`Plan · ${done} of ${work.length} done`}
              {status === 'pending' ? <Text color="warning">{' · awaiting your approval'}</Text> : null}
            </Text>
            <Box flexDirection="row" columnGap="sm">
              <Button key="glossary" plain onPress={() => void update($, showGlossary, v => !v)}>
                {glossaryOpen ? '? ▾' : '?'}
              </Button>
              <Button
                key="expand-all"
                plain
                onPress={() =>
                  void (async () => {
                    await update($, paneView, () => ({ all: !allOpen, toggled: {} }))
                    // Remembered for new chats too, as the Minimal view was.
                    await editSettings($, s => ({ ...s, expandAll: !allOpen }))
                  })()
                }
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Button>
            </Box>
          </Box>
          {status === 'pending' && (
            <Text dimColor size="footnote" wrap="wrap">
              Change steps here, then pick "Run it" in the chat; "Change the steps" to add, drop or reword.
            </Text>
          )}
        </Box>
      )}
      {glossaryOpen && list.length > 0 && (
        <Box key="glossary-list" flexDirection="column" paddingLeft={2}>
          {GLOSSARY.map(([term, what]) => (
            <Text key={`term:${term}`} size="footnote" wrap="wrap">
              <Text weight="medium">{term}</Text>
              <Text dimColor>{`: ${what}`}</Text>
            </Text>
          ))}
        </Box>
      )}
      {heldCount > 0 && (
        <Box key="draft-bar" flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
          <Button key="draft-send" variant="primary" onPress={() => void sendDraft($)}>
            {`Send changes (${heldCount})`}
          </Button>
          <Button key="draft-discard" plain onPress={() => void discardDraft($)}>
            Discard
          </Button>
          <Text dimColor size="footnote" wrap="wrap">✎ edits wait until you send them</Text>
        </Box>
      )}
      <Box flexDirection="column" rowGap="xs">
        {list.map(row)}
      </Box>
      {list.length > 0 && (
        <Box flexDirection="row">
          <Button key="clear" plain dimColor onPress={() => void clearPlan($)}>Clear plan</Button>
        </Box>
      )}
    </Box>
  )

  // --- Cost -----------------------------------------------------------------------

  const savedOf = (t: Totals) => Math.max(0, t.mainEquivalent - t.agentCost)
  const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')
  const since = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  const VIEWS: { value: CostView; label: string }[] = [
    { value: 'plan', label: 'This plan' },
    { value: 'chat', label: 'This chat' },
    { value: 'all', label: 'All time' },
  ]
  const stat = (label: string, value: string, color?: string, sub?: string) => (
    <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={12}>
      <Text dimColor size="caption" wrap="wrap">{label}</Text>
      <Text weight="semibold" tabular color={color}>{value}</Text>
      {sub ? <Text size="caption" tabular color={color}>{sub}</Text> : null}
    </Box>
  )
  // Saved as a share of what the same work would have cost with no routing:
  // main chat + what the subagents' tokens would have cost on the main model.
  const savedStat = (amount: number, mainSpent: number, equivalent: number) =>
    stat('Saved', amount > 0 ? `≈${fmtUsd(amount)}` : '—', amount > 0 ? 'success' : undefined, amount > 0 ? `${pct(amount, mainSpent + equivalent)} of the total` : undefined)

  const planMain = Math.max(0, m.cost - base.mainCost)
  const chatSaved = savedOf(chat)
  const lifeSaved = savedOf(life)
  // Some tokens ran on a model with no price: their money is "?".
  const planUnpriced = list.some(x => x.unpriced)
  const planEquivalent = list.reduce((n, x) => n + x.mainCost, 0)
  const [mainSpent, agents, savedNow, equivalent] =
    view === 'plan'
      ? [planMain, agentCost, saved, planEquivalent]
      : view === 'chat'
        ? [m.cost, chat.agentCost, chatSaved, chat.mainEquivalent]
        : [life.mainCost, life.agentCost, lifeSaved, life.mainEquivalent]
  const [mainOpen, agentsOpen] = view === 'plan' ? [m.unpriced, planUnpriced] : view === 'chat' ? [m.unpriced, chat.unpriced] : [false, false]
  // What was moved to helpers, in each provider's own unit, for the span picked; with helpers on and none run yet, an empty state.
  // Helper steps that ran as subagents instead are counted beside it, with the latest reason.
  const fell = view === 'plan' ? planFallbacks(list) : view === 'chat' ? { n: chat.fallbacks ?? 0, reason: chat.lastFallback } : { n: life.fallbacks ?? 0, reason: life.lastFallback }
  const movedLine = helperLine(view === 'plan' ? helperTotalsOf(list) : view === 'chat' ? chat.helper : life.helper)
  const moved = movedLine
    ? `${movedLine}${fallbackLine(fell.n, fell.reason)}`
    : set.helpers.enabled || fell.n > 0
      ? `Off Claude: no helper steps yet${fallbackLine(fell.n, fell.reason)}`
      : undefined
  const tiles =
    view === 'plan' ? (
      <Box flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs">
        {stat(`Main chat${m.model ? ` · ${m.model}` : ''}`, fmtCost(planMain, m.unpriced))}
        {stat('Subagents', fmtCost(agentCost, planUnpriced))}
        {savedStat(saved, planMain, planEquivalent)}
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
  const foot =
    view === 'plan'
      ? `Since this plan was posted${base.at ? ` (${new Date(base.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })})` : ''}. A new plan starts a new count.`
      : view === 'chat'
        ? `Since this chat was opened or its plugins reloaded: ${chat.steps + chat.helper.steps} delegated steps${chat.helper.steps || set.helpers.enabled ? ` (${chat.helper.steps} on helpers)` : ''}. Earlier turns are not counted.`
        : `Since ${since(life.since)}: ${life.steps + life.helper.steps} delegated steps${life.helper.steps || set.helpers.enabled ? ` (${life.helper.steps} on helpers)` : ''} in ${life.plans} plans (light ${life.byTier.light} · standard ${life.byTier.standard} · deep ${life.byTier.deep}). Delegated steps cost ${pct(lifeSaved, life.mainEquivalent)} less than on the main model; main chats cost ≈${fmtUsd(life.mainCost)}.`
  const stats = rungStats(past)
  const kinds = kindStats(past)
  const hasAdvice = advice.length > 0 || helperAdvice.length > 0

  const costSection = (
    <Box key="section:cost" flexDirection="column" rowGap="xs">
      <Box flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
        <Button key="cost-view" plain onPress={() => void update($, costView, v => cycle(VIEWS.map(x => x.value), v) as CostView)}>
          {`${VIEWS.find(x => x.value === view)?.label ?? 'This plan'} ▾`}
        </Button>
        <Text key="cost-line" size="footnote" tabular wrap="wrap">
          <Text dimColor>{`main${m.model && view !== 'all' ? ` (${m.model})` : ''} `}</Text>
          {fmtCost(mainSpent, mainOpen)}
          <Text dimColor> · subagents </Text>
          {fmtCost(agents, agentsOpen)}
          <Text dimColor> · saved </Text>
          <Text color={savedNow > 0 ? 'success' : undefined}>{savedNow > 0 ? `≈${fmtUsd(savedNow)} (${pct(savedNow, mainSpent + equivalent)})` : '—'}</Text>
        </Text>
      </Box>
      {moved && <Text key="moved-line" size="footnote" wrap="wrap">{moved}</Text>}
      <Box flexDirection="row" flexWrap="wrap" columnGap="sm" alignItems="center">
        <Text key="history-line" dimColor size="footnote" wrap="wrap">
          {hasAdvice ? `History: ${past.length} run${past.length === 1 ? '' : 's'}; advice below.` : historyLine(past)}
        </Text>
        <Button key="cost-details" plain onPress={() => void update($, showCostDetails, v => !v)}>
          {costOpen ? 'Details ▾' : 'Details ▸'}
        </Button>
      </Box>
      {costOpen && (
        <Box key="cost-detail-body" flexDirection="column" rowGap="xs" paddingLeft={2}>
          {tiles}
          <Text dimColor size="caption" wrap="wrap">{foot}</Text>
          {stats.map(r => (
            <Box key={`rung:${r.label}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap="sm">
              <Text mono size="footnote">{r.label}</Text>
              <Text dimColor size="footnote" tabular wrap="wrap">
                {r.n} runs · {r.reruns} reruns{r.isHelper ? '' : ` · ≈${fmtUsd(r.avgCost)} each`}{r.setupHeavy ? ` · ${r.setupHeavy} start-up heavy` : ''}
                {verdictLine(r.verdicts) ? ` · ${verdictLine(r.verdicts)}` : ''}
              </Text>
            </Box>
          ))}
          {kinds.map(k => (
            <Box key={`kind-stats:${k.kind}`} flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap="sm">
              <Text size="footnote">{k.kind}</Text>
              <Text dimColor size="footnote" tabular wrap="wrap">
                {`${k.n} runs · ${k.reruns} reruns${verdictLine(k.verdicts) ? ` · ${verdictLine(k.verdicts)}` : ''}`}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      {advice.map(a => {
        const key = a.kind ? `kind:${a.kind}` : `tier:${a.tier}`
        const what = a.kind ? `${a.kind}'s default` : `the ${a.tier} level`

        return (
          <Box key={`advice:${key}`} flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
            <Text size="footnote" color={a.isRaise ? 'warning' : 'success'}>{a.isRaise ? '↑' : '↓'}</Text>
            <Box flexShrink={1}>
              <Text size="footnote" wrap="wrap">
                {a.why}: {a.isRaise ? 'raise' : 'try lowering'} {what} to {rungLabel(a.to)}.
              </Text>
            </Box>
            <Button key={a.kind ? `apply-kind:${a.kind}` : `apply:${a.tier}`} variant="primary" onPress={() => void applySuggestion($, a)}>
              {`Apply: ${rungLabel(a.to)}`}
            </Button>
          </Box>
        )
      })}
      {helperAdvice.map(a => {
        const key = a.kind ? `kind:${a.kind}` : `tier:${a.provider}:${a.tier}`
        const what = a.kind ? `${a.kind}'s helper` : `${a.provider}'s ${a.tier} helper`

        return (
          <Box key={`helper-advice:${key}`} flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
            <Text size="footnote" color={a.isRaise ? 'warning' : 'success'}>{a.isRaise ? '↑' : '↓'}</Text>
            <Box flexShrink={1}>
              <Text size="footnote" wrap="wrap">
                {a.why}: {a.isRaise ? 'raise' : 'try lowering'} {what} from {helperRungLabel(a.from)} to {a.provider} {helperRungLabel(a.to)}.
              </Text>
            </Box>
            <Button key={a.kind ? `apply-helper-kind:${a.kind}` : `apply-helper:${a.provider}:${a.tier}`} variant="primary" onPress={() => void applyHelperAdvice($, a)}>
              {`Apply: ${a.provider} ${helperRungLabel(a.to)}`}
            </Button>
          </Box>
        )
      })}
      {hint && <Text key="model-hint" color="suggestion" size="footnote" wrap="wrap">{hint}</Text>}
    </Box>
  )

  const footer = (
    <Box key="section:footer" flexDirection="row" flexWrap="wrap" columnGap="md" rowGap="xs" alignItems="center">
      <Button
        key="settings"
        plain
        onPress={() =>
          void (async () => {
            await refreshShared($)
            await update($, showSettings, () => true)
          })()
        }
      >
        Settings ▸
      </Button>
      {reportRow('footer-report')}
    </Box>
  )

  // --- Settings -----------------------------------------------------------------------

  const mapped = Object.entries(set.skills)
  const unmapped = seen.filter(n => !(n in set.skills))
  const helperState = !set.helpers.enabled
    ? 'off'
    : helperMode() === 'herdr'
      ? 'ready · Herdr'
      : helperMode() === 'direct'
        ? 'ready · direct'
        : hs.status === 'unknown'
          ? 'looking for them…'
          : `✗ ${health.failing ? health.failing.text : 'cannot run'}`
  const helperFails = set.helpers.enabled && helperState.startsWith('✗')
  const PRESET_OPTIONS: Option[] = [...PRESETS.map(p => ({ value: p.id, label: p.label })), { value: 'custom', label: 'Custom' }]
  const openGroup = (id: string) => editSettings($, s => (s.openGroups.includes(id) ? s : { ...s, openGroups: [...s.openGroups, id] }))
  const scopeOn = TIER_ORDER.filter(t => set.tiers[t].scopeNote)
  const noPrice = models.filter(x => !priceOf(x, set)).length
  const notesCount = Object.keys(allNotes).length
  const kindsTuned = Object.keys(set.kinds).length

  // The three resets: the first click names what goes, the second does it.
  const RESETS: Record<string, { key: string; label: string; ask: string; verb: string; done: string; run: () => Promise<void> }> = {
    tiers: {
      key: 'reset-tiers',
      label: 'Reset models per level',
      ask: 'Really put the three levels back to Balanced, scope notes off?',
      verb: 'Reset',
      done: 'Models per level reset.',
      run: () => editSettings($, s => ({ ...s, tiers: DEFAULT_SETTINGS.tiers })),
    },
    history: {
      key: 'clear-history',
      label: `Clear history (${past.length} run${past.length === 1 ? '' : 's'})`,
      ask: `Really clear ${past.length} run${past.length === 1 ? '' : 's'}? The advice and auto mode start again.`,
      verb: 'Clear',
      done: 'History cleared.',
      run: () => editHistory($, () => []),
    },
    stats: {
      key: 'reset-stats',
      label: 'Reset statistics',
      ask: `Really reset the all-time statistics (since ${since(life.since)})?`,
      verb: 'Reset',
      done: 'Statistics reset.',
      run: () => editLifetime($, () => newLifetime()),
    },
  }
  const resetRows = Object.entries(RESETS).map(([id, r]) =>
    asking === id ? (
      <Box key={`reset-ask:${id}`} flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
        <Text color="warning" size="footnote" wrap="wrap">{r.ask}</Text>
        <Button
          key="reset-confirm"
          variant="primary"
          onPress={() =>
            void (async () => {
              await r.run()
              await update($, confirmReset, () => '')
              await update($, resetNote, () => r.done)
            })()
          }
        >
          {r.verb}
        </Button>
        <Button key="reset-keep" plain onPress={() => void update($, confirmReset, () => '')}>
          Keep
        </Button>
      </Box>
    ) : (
      <Box key={`reset-row:${id}`} flexDirection="row">
        <Button
          key={r.key}
          plain
          dimColor
          onPress={() =>
            void (async () => {
              await update($, resetNote, () => '')
              await update($, confirmReset, () => id)
            })()
          }
        >
          {r.label}
        </Button>
      </Box>
    ),
  )

  const helpersBody = () => {
    if (!set.helpers.enabled) {
      return [
        <Text key="helpers-off-note" dimColor size="footnote" wrap="wrap">
          Off: every step runs in this chat or as a Claude agent. Turn on under "Other subscriptions" above to send long self-contained steps to agents of
          your other subscriptions or Claude accounts, started by herdr-delegate.
        </Text>,
      ]
    }
    const pathRow = (
      <Box key="helpers-path" flexDirection="column" rowGap="xs">
        <Box flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
          {!helpersOn && (
            <Button key="helpers-reload" plain onPress={() => void loadHelperConfig($)}>
              Look again
            </Button>
          )}
          <Button key="helpers-path-toggle" plain dimColor onPress={() => void update($, showHelperPath, v => !v)}>
            {pathOpen ? 'Hide path' : 'Set path by hand'}
          </Button>
          {dot('helper-script', set.helpers.script !== D.helpers.script)}
        </Box>
        {pathOpen && Input && (
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
    )
    const runRow = settingRow(
      'run',
      'Run helpers',
      `Through Herdr in a Herdr terminal, else directly (helpers.py run). Now: ${helperMode() === 'none' ? 'cannot run' : helperMode()}.`,
      pick(
        'helpers-run',
        set.helpers.run,
        [
          { value: 'auto', label: 'Herdr, else direct' },
          { value: 'herdr', label: 'Herdr only' },
          { value: 'direct', label: 'direct only' },
        ],
        v => void editHelpers($, { run: v === 'herdr' || v === 'direct' ? v : 'auto' }),
      ),
      differs.run,
    )
    if (!helpersOn) {
      return [
        <Box key="helper-checks" flexDirection="column" rowGap="xs">{checkList('settings')}</Box>,
        runRow,
        <Box key="helpers-none" flexDirection="column" rowGap="xs">
          {hs.status === 'unknown' && <Text dimColor size="footnote">Not read yet.</Text>}
          {hs.status === 'error' && <Text color="warning" size="footnote" wrap="wrap">{hs.message ?? 'helpers.py did not answer.'}</Text>}
          {hs.status === 'ready' && noHelperCli() && (
            <Text key="helpers-no-cli" color="warning" size="footnote" wrap="wrap">No helper CLI is installed: install at least one (Kiro, Copilot, Codex, Antigravity, or another Claude account), then look again. Until then helpers are off and the rules do not mention them.</Text>
          )}
          {(hs.status === 'missing' || hs.status === 'nohc') && (
            <Box key="helpers-how" flexDirection="column">
              <Text size="footnote" wrap="wrap">
                {hs.status === 'nohc'
                  ? "Helpers run through Herdr's hc, which was not found on your PATH. Model-router works without it: every step runs as a Claude agent."
                  : 'Helpers are agents on other subscriptions or accounts. They are optional: model-router works without them, running every step as a Claude agent.'}
              </Text>
              <Text dimColor size="footnote" wrap="wrap">To enable them:</Text>
              {hs.status === 'missing' && (
                <Text dimColor size="footnote" wrap="wrap">{`1. Install herdr-delegate from the same marketplace: /plugin install herdr-delegate@${hs.marketplace ?? 'horef-claude-plugins'}`}</Text>
              )}
              <Text dimColor size="footnote" wrap="wrap">{`${hs.status === 'missing' ? '2' : '1'}. Install Herdr's hc and put it on your PATH.`}</Text>
              <Text dimColor size="footnote" wrap="wrap">{`${hs.status === 'missing' ? '3' : '2'}. Install at least one helper CLI: Kiro, Copilot, Codex, Antigravity, or another Claude account.`}</Text>
            </Box>
          )}
        </Box>,
        pathRow,
      ]
    }

    return [
      <Box key="helper-checks" flexDirection="column" rowGap="xs">{checkList('settings')}</Box>,
      runRow,
      settingRow(
        'fusion',
        'Copilot Fusion',
        "GitHub's router across Claude and GPT models, tried before the pinned Copilot helper. Measured 2026-11-01: Max is near Opus 5.5 at max effort for about half the cost; High is unmeasured.",
        pick(
          'helpers-fusion',
          set.helpers.fusion,
          [
            { value: 'off', label: 'off' },
            { value: 'deep', label: 'Max for deep' },
            { value: 'both', label: 'High + Max' },
          ],
          v => void editHelpers($, { fusion: v === 'deep' || v === 'both' ? v : 'off' }),
        ),
        differs.fusion,
      ),
      // Order: one line a level; Edit swaps that line for its ↑ ↓ off / + controls, one level at a time.
      <Box key="helper-order" flexDirection="column" rowGap="xs">
        <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm">
          <Box flexDirection="column" flexShrink={1}>
            <Text weight="medium">Order</Text>
            <Text dimColor size="footnote" wrap="wrap">Per level, the first usable helper runs the step.</Text>
          </Box>
          <Button key="helper-reset" plain dimColor onPress={() => void editHelpers($, { tiers: { ...D.helpers.tiers } })}>
            Reset to default order
          </Button>
        </Box>
        {TIER_ORDER.map(t => {
          const items = helperItems(set, t)
          const off = helpersOff(set, t)
          const short = (name: string) => name.split(`-${t}`).join('')
          const editing = orderEdit === t

          return (
            <Box key={`helper-order:${t}`} flexDirection="column">
              <Box flexDirection="row" flexWrap="wrap" columnGap="xs" alignItems="center">
                <Text color={TIER_COLOR[t]} weight="semibold" size="footnote">{`${t}:`}</Text>
                {!editing && <Text size="footnote" wrap="wrap">{helperOrder(set, t).split(`-${t}`).join('') || 'none'}</Text>}
                {dot(`order:${t}`, orderDiffers(t))}
                <Button key={`order-edit:${t}`} plain dimColor={!editing} onPress={() => void update($, editOrder, v => (v === t ? '' : t))}>
                  {editing ? 'Done' : 'Edit'}
                </Button>
              </Box>
              {editing &&
                items.map((name, i) => (
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
              {editing && off.length > 0 && (
                <Box flexDirection="row" flexWrap="wrap" columnGap="xs" alignItems="center" paddingLeft={2}>
                  <Text dimColor size="footnote">off:</Text>
                  {off.map(name => (
                    <Button key={`helper-on:${t}:${name}`} plain dimColor onPress={() => void editHelperOrder($, t, l => [...l, name].join(','))}>
                      {`+ ${templateLabel(name, short(name))}`}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>,
      // Helper models: only what differs from herdr-delegate's defaults; Change… opens the full grid.
      <Box key="helper-models" flexDirection="column" rowGap="xs">
        <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" alignItems="center" columnGap="sm" rowGap="xs">
          <Box flexDirection="column" flexShrink={1}>
            <Text weight="medium">Helper models</Text>
            <Text dimColor size="footnote" wrap="wrap">Model and effort of each helper level, kept in herdr-delegate's helpers.py.</Text>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center">
            {hs.status === 'ready' && (
              <Text dimColor size="footnote">{modelsChecked(hs.models) ? `checked ${modelsChecked(hs.models)}` : 'not checked yet'}</Text>
            )}
            {hs.status === 'ready' && (
              <Button key="helpers-check" plain onPress={() => void checkModels($)}>
                {hs.busy ? 'Checking…' : 'Check models'}
              </Button>
            )}
          </Box>
        </Box>
        {hs.message && hs.status === 'ready' && <Text color="warning" size="footnote" wrap="wrap">{hs.message}</Text>}
        {hs.warnings.map((w, i) => (
          <Text key={`helper-warning:${i}`} color="warning" size="footnote" wrap="wrap">{w}</Text>
        ))}
        {!gridOpen &&
          hcfg &&
          (helperTiersDiffering.length === 0 ? (
            <Text key="helper-models-default" dimColor size="footnote">All at herdr-delegate's defaults.</Text>
          ) : (
            helperTiersDiffering.map(({ provider, tier }) => {
              const r = helperTierRung(hcfg, provider, tier)!

              return (
                <Text key={`helper-differs:${provider}:${tier}`} size="footnote" wrap="wrap">
                  {`${hcfg.providers[provider]?.label ?? provider} ${tier}: ${r.model} ${r.effort} •`}
                </Text>
              )
            })
          ))}
        {hcfg && (
          <Box flexDirection="row">
            <Button key="helper-grid" plain onPress={() => void update($, showHelperGrid, v => !v)}>
              {gridOpen ? 'Hide the list' : 'Change…'}
            </Button>
          </Box>
        )}
        {gridOpen &&
          hcfg &&
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
                        helperEfforts(hcfg, provider, r.effort).map(x => ({ value: x, label: `${x} effort` })),
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
      </Box>,
      pathRow,
    ]
  }

  const settingsPanel = (
    <Box key="section:settings" flexDirection="column" rowGap="sm">
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

      {switchRow('auto', 'Ask me before a plan runs', 'Off: plans run at once, without the "Run it?" question.', !auto, () => void setAuto($, !auto), differs.auto)}
      {switchRow('always', 'Plan every message', 'Plan before any message that needs tools, not only multi-step tasks.', always, () => void setAlways($, !always), differs.always)}
      {settingRow(
        'helpers',
        'Other subscriptions',
        'Send self-contained steps to agents of your other subscriptions or accounts (Copilot, Codex, Kiro…).',
        pick(
          'helpers',
          set.helpers.enabled ? set.helpers.use : 'off',
          [
            { value: 'off', label: 'Off' },
            { value: 'long', label: 'Long steps' },
            { value: 'all', label: 'All steps' },
          ],
          v => void editHelpers($, v === 'off' ? { enabled: false } : { enabled: true, use: v === 'all' ? 'all' : 'long' }),
        ),
        differs.helpers || differs.use,
        set.helpers.enabled ? (
          <Text key="helpers-state" size="footnote" color={helperFails ? 'warning' : undefined} dimColor={!helperFails} wrap="wrap">
            {helperState}
          </Text>
        ) : null,
      )}
      {settingRow(
        'spend',
        'Spend',
        'The models and effort the three levels of step run on.',
        pick('spend', preset, PRESET_OPTIONS, v =>
          void (v === 'custom' ? openGroup('models') : editSettings($, s => applyPreset(s, v))),
        ),
        preset !== 'balanced',
      )}
      {switchRow('open-pane', 'Open the pane in new chats', 'Opens this pane whenever a chat starts.', set.openPane, () =>
        void editSettings($, s => ({ ...s, openPane: !s.openPane })),
        differs.openPane,
      )}

      <Box key="settings-groups" flexDirection="column" rowGap="xs" marginTop={1}>
        {settingsGroup('models', 'Models per level', tiersSummary(set), { custom: groupDiffers.models }, () => [
          ...TIER_ORDER.map(t => {
            const ts = set.tiers[t]
            const edit = (patch: Partial<typeof ts>) => void editSettings($, s => ({ ...s, tiers: { ...s.tiers, [t]: { ...s.tiers[t], ...patch } } }))

            return (
              <Box key={`tierset:${t}`} flexDirection="column">
                <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center">
                  <Text color={TIER_COLOR[t]} weight="semibold">{t}</Text>
                  {pick(`set-model:${t}`, ts.model, models.map(x => ({ value: x, label: x })), v => edit({ model: v as typeof ts.model }))}
                  {dot(`model:${t}`, tierDiffers(t).model)}
                  {pick(`set-effort:${t}`, ts.effort, EFFORTS.map(x => ({ value: x, label: `${x} effort` })), v => edit({ effort: v as typeof ts.effort }))}
                  {dot(`effort:${t}`, tierDiffers(t).effort)}
                </Box>
                <Text dimColor size="footnote" wrap="wrap">{TIER_USE[t]}</Text>
              </Box>
            )
          }),
          <Text key="tiers-note" dimColor size="footnote" wrap="wrap">
            For steps run by a Claude agent. Steps done in this chat use this chat's model.
          </Text>,
        ])}

        {settingsGroup('helpers', 'Other subscriptions', !set.helpers.enabled ? 'off' : helperFails ? helperState : `${liveProviders(set).join(', ') || 'none'} · ${helperState.replace(/^ready · /, '')}`, { fail: helperFails, custom: groupDiffers.helpers }, helpersBody)}

        {settingsGroup('learning', 'Learning', `auto ${set.autoRoute ? 'on' : 'off'} · ${kindsTuned ? `${kindsTuned} kind${kindsTuned === 1 ? '' : 's'} tuned` : 'no kinds tuned'}`, { custom: groupDiffers.learning }, () => [
          switchRow(
            'auto-route',
            'Auto mode',
            `A Claude agent step whose kind has enough history runs on the cheapest rung that did that kind well (ok in at least ${set.autoOkPercent}% of ${set.autoMinRuns} or more runs there). Your own picks on a step still win.${helpersLive(set) ? ' A helper step gets its model the same way.' : ''}`,
            set.autoRoute,
            () =>
              void (async () => {
                await editSettings($, s => ({ ...s, autoRoute: !s.autoRoute }))
                await resolveHelperPicks($)
              })(),
            differs.autoRoute,
          ),
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
          </Box>,
          ...Object.entries(set.kinds).map(([kind, r]) => (
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
          )),
          kindsTuned === 0 ? (
            <Text key="kinds-none" dimColor size="footnote" wrap="wrap">No kind has a default of its own yet: applying the history's advice (under the cost) sets one.</Text>
          ) : null,
        ])}

        {settingsGroup(
          'prices',
          'Models and prices',
          `${models.length} models${noPrice ? ` · ${noPrice} without price` : ''} · ${notesCount} note${notesCount === 1 ? '' : 's'}`,
          { fail: noPrice > 0, custom: groupDiffers.prices },
          () => [
            <Text key="prices-help" dimColor size="footnote" wrap="wrap">
              Dollars per million tokens. A model with no price shows its cost as "?" and is left out of savings.
            </Text>,
            ...models.map(x => {
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
            }),
            Input ? (
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
            ) : null,
            <Box key="model-notes-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap="sm" rowGap="xs">
              <Text size="footnote">{`Model notes (${notesCount}) · checked ${reportChecked(hs.report) ?? modelsChecked(hs.models) ?? 'never'}`}</Text>
              {hs.status === 'ready' && (
                <Button key="model-notes-check" plain onPress={() => void checkModels($)}>
                  {hs.busy ? 'Checking…' : 'Check now'}
                </Button>
              )}
              <Button key="model-notes-toggle" plain onPress={() => void update($, showAllNotes, v => !v)}>
                {allNotesOpen ? 'List ▾' : 'List ▸'}
              </Button>
            </Box>,
            ...(allNotesOpen
              ? Object.values(allNotes)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(n => <Text key={`model-note:${n.id}`} size="footnote" wrap="wrap">{`${n.name} · ${n.tags.join(', ') || 'no tags'} · ${n.summary} · ${n.by} ${n.checked}`}</Text>)
              : []),
          ],
        )}

        {settingsGroup('skills', 'Skills', mapped.length ? `${mapped.length} mapped` : 'none mapped', { custom: groupDiffers.skills }, () => [
          <Text key="skills-help" dimColor size="footnote" wrap="wrap">
            A skill set to a level runs as a Claude agent on that level's model instead of in this chat.
          </Text>,
          mapped.length + unmapped.length === 0 ? (
            <Text key="skills-none" dimColor size="footnote" wrap="wrap">None yet. Skills you use in a chat appear here, or add one by name.</Text>
          ) : null,
          ...[...mapped.map(([n]) => n), ...unmapped].map(name => (
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
          )),
          Input ? (
            <Input
              key="add-skill"
              placeholder="Skill name, e.g. scientific-figures"
              submitLabel="Add"
              onSubmit={v => {
                const name = v.trim()
                if (name) void editSettings($, s => ({ ...s, skills: { ...s.skills, [name]: s.skills[name] ?? 'standard' } }))
              }}
            />
          ) : null,
        ])}

        {settingsGroup('diagnostics', 'Diagnostics', `log ${set.log ? 'on' : 'off'} · Herdr view ${set.herdrView ? 'on' : 'off'}`, { custom: groupDiffers.diagnostics }, () => [
          switchRow('log', 'Keep a log', 'One file a day under ~/.config/model-router/log/, kept 14 days; no prompts, titles or file contents.', set.log, () => void editSettings($, s => ({ ...s, log: !s.log })), differs.log),
          reportRow('settings-report'),
          switchRow(
            'herdr-view',
            'Show in Herdr',
            'A scrollable view of the plan in Herdr (read-only), for plans too long for this pane. Writes ~/.config/model-router/state/ when ~/.config/herdr-app exists.',
            set.herdrView,
            () => void editSettings($, s => ({ ...s, herdrView: !s.herdrView })),
            differs.herdrView,
          ),
        ])}

        {settingsGroup(
          'advanced',
          'Advanced',
          `experiment ${set.hereEffort.enabled ? 'on' : 'off'} · scope notes ${scopeOn.length ? `on for ${scopeOn.join(', ')}` : 'off'}`,
          { custom: groupDiffers.advanced },
          () => [
            switchRow(
              'here-effort',
              'Experiment: effort of steps done in this chat',
              "While a step done in this chat runs, send this chat's requests at its level's effort, lower or higher than the chat's own. A change of effort makes the API write the conversation to the cache again, so only while the chat is under the limit below.",
              set.hereEffort.enabled,
              () => void editHereEffort($, { enabled: !set.hereEffort.enabled }),
              differs.hereEffort,
            ),
            set.hereEffort.enabled ? (
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
            ) : null,
            switches.length > 0 ? (
              <Text key="effort-switches" dimColor size="footnote" wrap="wrap">
                {`${switches.length} switch${switches.length === 1 ? '' : 'es'} so far: ${kTok(switches.reduce((n, x) => n + x.cacheWrite, 0))} tokens written to the cache, ${kTok(switches.reduce((n, x) => n + x.cacheRead, 0))} read on the request after each switch. Mostly written means the switch cost a cache rewrite.`}
              </Text>
            ) : null,
            <Box key="scope-notes" flexDirection="column" rowGap="xs">
              <Text weight="medium">Scope notes</Text>
              <Text dimColor size="footnote" wrap="wrap">
                One line added to a level's briefs, asking the Claude agent to stay on its task and not start sessions or load extra tools.
              </Text>
              <Box flexDirection="row" flexWrap="wrap" columnGap="sm" rowGap="xs" alignItems="center">
                {TIER_ORDER.map(t => (
                  <Box key={`scope:${t}`} flexDirection="row" columnGap="xs" alignItems="center">
                    <Button
                      key={`set-scope:${t}`}
                      plain
                      dimColor={!set.tiers[t].scopeNote}
                      onPress={() => void editSettings($, s => ({ ...s, tiers: { ...s.tiers, [t]: { ...s.tiers[t], scopeNote: !s.tiers[t].scopeNote } } }))}
                    >
                      {`${set.tiers[t].scopeNote ? '✓' : '○'} ${t}`}
                    </Button>
                    {dot(`scope:${t}`, tierDiffers(t).scope)}
                  </Box>
                ))}
              </Box>
            </Box>,
            <Box key="resets" flexDirection="column" rowGap="xs">
              {resetRows}
              {resetText ? <Text key="reset-note" color="success" size="footnote">{resetText}</Text> : null}
            </Box>,
          ],
        )}
      </Box>
    </Box>
  )

  return (
    <Box flexDirection="column" rowGap={tty ? 'sm' : 'md'} padding={tty ? undefined : 'sm'}>
      {healthRow}
      {modelsCard}
      {tty && (
        <Text dimColor size="caption" wrap="wrap">
          {site.isFocused
            ? '↑↓ scroll · Tab buttons · Esc back to the prompt'
            : `${(site.scroll?.offset ?? 0) > 0 ? '↑ scrolled · ' : ''}ctrl+x tab, then ↑↓ to scroll${status === 'pending' ? ' (after answering the plan question)' : ''}`}
        </Text>
      )}
      {isSettingsOpen ? settingsPanel : planSection}
      {isSettingsOpen ? null : costSection}
      {isSettingsOpen ? null : footer}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    loading = undefined
    loggedHealth = ''
    surfaceNow = e.surface ?? undefined
    await ready($)
    await logEvent($, 'start', { version: VERSION, surface: surfaceNow, model: (await read($, main)).model })
    await pruneLogs($)
    await startState($, e as { cwd?: string; sessionId?: unknown })
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
    await $.command.register({ name: 'router', description: 'Show the model-router pane; /router report writes a diagnostics report' })
    setHelperConfig(undefined)
    planToolHelpers = undefined
    modelsBackground = false
    await update($, modelFeedback, () => ({}))
    await loadModelNotes($)
    await loadHelperConfig($)
    await modelsStartup($)
    await registerPlanTool($)
    await refreshStatus($)
    if ((await read($, settings)).openPane) void $.ui.open({ id: PANE, title: 'Model router' })

    return next(e)
  })

  on('command.run', { command: 'router' }, async ($, e) => {
    if ((e.args ?? '').trim().toLowerCase() === 'report') {
      const path = await writeReport($)

      return { text: path ? `Model router report written: ${path}. Send this file.` : `Model router report not written: ${await read($, reportNote)}` }
    }
    await $.ui.open({ id: PANE, title: 'Model router' })

    return { text: 'Model router pane opened.' }
  })

  on('tool.call', { tool: PLAN_TOOL }, async ($, e) => {
    const input = e as unknown as PlanInput
    const set = await read($, settings)
    let ask: string | undefined
    let modelsText: string | undefined
    // What the agent is handed here is the plan as it stands, so it knows every step now.
    const withNotes = async (body: string) => {
      const text = [body, ask, modelsText].filter(Boolean).join('\n\n')
      const helperChange = await helperNote($)
      const pending = [...(await read($, notes)), ...(helperChange ? [helperChange] : [])]
      await update($, notes, () => [])
      if (helperChange) await helpersTold($)
      await tellSteps($)
      return { result: pending.length ? `${text}\n\nRouter notes:\n${pending.map(n => `- ${n}`).join('\n')}` : text }
    }
    const shown = async () => {
      await resolveHelperPicks($)

      return planText(await read($, steps), await read($, settings), (await read($, main)).model, await learnedOf($))
    }

    if (input.status) {
      const st = await read($, helperCfg)
      const dir = await logDir($).catch(() => undefined)
      const report = {
        version: VERSION,
        delivery: await read($, delivery),
        rulesSentTo: (await read($, policySent)).model ?? null,
        alwaysPlan: await read($, alwaysPlan),
        autoApprove: await read($, autoApprove),
        steps: (await read($, steps)).length,
        helperMode: helperMode(),
        helperStatus: st.status,
        ...(st.message ? { helperMessage: st.message } : {}),
        checks: (await checksNow($)).map(c => `${c.state} ${c.id}: ${c.text}`),
        log: set.log && dir ? `${dir}/${logFileName(new Date())}` : 'off',
        history: (await read($, history)).length,
        ...(await modelStatus($)),
        ...diag,
      }
      return { result: `model-router status: ${JSON.stringify(report)}` }
    }
    // Notes and proposals about models work on their own, or beside steps.
    if (input.models !== undefined) {
      modelsText = await acceptModels($, input.models)
      if (!input.steps && !input.done && !input.start) return { result: modelsText }
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
      // Ids repeat across plans: steps opened one by one in the last plan close again.
      await update($, paneView, v => ({ ...v, toggled: {} }))
    }
    await setSteps($, () =>
      flat.steps.map(s => {
        const was = isNewPlan ? undefined : old.find(o => o.id === s.id)
        // With Helpers off, a helper step is a normal subagent step.
        const where: Where = s.where === 'helper' && !helpersLive(set) ? 'agent' : s.where
        const shape = { parent: s.parent, group: s.group || undefined, count: s.count, kind: s.kind }

        return { ...(was ? { ...was, title: s.title, tier: s.tier, where } : newStep(s.id, s.title, s.tier, where)), ...shape }
      }),
    )
    await logEvent($, 'plan', { new: isNewPlan, steps: flat.steps.map(x => ({ id: x.id, tier: x.tier, where: x.where, ...(x.kind ? { kind: x.kind } : {}), ...(x.group ? { group: true } : {}) })) })
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
  }).catch(async ($, _e, next) => {
    await fault($, 'plan-tool', next.error)

    return { deny: 'model-router: the plan tool failed; continue without routing.' }
  })

  // Skills mapped to a tier run in a subagent; the main chat is told how.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const name = e.skill
    await update($, seenSkills, list => (list.includes(name) ? list : [...list, name].slice(-50)))
    const tier = (await read($, settings)).skills[name]
    if (!tier || (e as { agentId?: string }).agentId) return next(e)

    return {
      deny: `model-router: the user runs the skill "${name}" on the ${tier} tier. Delegate it with the Agent tool, description "[${SKILL_TAG}${name}] <a few words>", and a brief that tells the subagent to invoke the Skill tool with skill "${name}"${e.args ? ` and args ${JSON.stringify(e.args)}` : ''}, plus everything it needs from this conversation.`,
    }
  }).catch(async ($, e, next) => {
    await fault($, 'skill-route', next.error)

    return next(e)
  })

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
    // A finished step delegated again is a rerun: a fact the history counts as weak. One whose last run was cut short is not.
    if (step.status === 'done') {
      const key = step.historyKey
      if (key && step.verdict !== 'cut-short') await editHistory($, h => h.map(x => (x.key === key ? { ...x, rerun: true } : x)))
      await editStep($, step.id, freshRun)
      step = (await read($, steps)).find(s => s.id === tag)!
    }
    // A helper step run through the Agent tool is the fallback: it is a subagent step now, and no helper ran it.
    if (step.where === 'helper') {
      await recordFallback($, step.id, 'no reason given')
      step = (await read($, steps)).find(s => s.id === tag)!
    }

    const learnedNow = await learnedOf($)
    const { model, effort } = runsOn(step, set, learnedNow)
    await logEvent($, 'route', { id: step.id, model, effort, source: step.model || step.effort ? 'step' : baseRung(step, set, learnedNow).source })
    const prompt = set.tiers[step.tier].scopeNote ? `${e.prompt}\n\n${SCOPE_NOTE}` : e.prompt
    const at = new Date().toISOString()
    // The run starts with its first Agent call (N calls for a counted step).
    await editStep($, step.id, s => ({ ...s, status: 'running', startedAt: s.status === 'running' && s.startedAt ? s.startedAt : at }))
    const ran = await next({ ...e, model: model as typeof e.model, effort, prompt })
    const resolved = ran.deny === undefined ? (ran.result as { resolvedModel?: string } | undefined)?.resolvedModel : undefined
    if (resolved) await editStep($, step.id, s => ({ ...s, resolvedModel: resolved }))

    return ran
  }).catch(async ($, e, next) => {
    await fault($, 'agent-route', next.error)

    return next(e)
  })

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
    const script = (await read($, helperCfg)).script
    if (!how.inChat) extra.push(policy(set, await read($, ruleKinds), script))
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
    // What the chat knows of helpers changed since the rules: one note with the whole helper rule (none when the rules go now).
    const helperChange = how.inChat ? await helperNote($) : undefined
    const all = [...pending, ...(helperChange ? [helperChange] : []), ...changes.map(c => c.note)]
    if (all.length) extra.push(`Model router notes:\n${all.map(n => `- ${n}`).join('\n')}`)

    if (extra.length > 0) {
      try {
        await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: extra.join('\n\n') }] } })
        diag.appends += 1
        await update($, delivery, d => ({ ...d, inChat: true, planDue: false }))
        await update($, notes, () => [])
        if (!how.inChat || helperChange) await helpersTold($)
        if (!how.inChat) await logEvent($, 'rules', { delivered: true, via: how.via ?? 'message', helpers: helperMode() })
        await tellSteps($, replan ? undefined : changes.map(c => c.id))
        await logHealth($)
      } catch (err) {
        await fault($, 'append', err)
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
      sections: [...composed.sections, { id: 'model-router:policy', text: policy(await read($, settings), await read($, ruleKinds), (await read($, helperCfg)).script), scope: 'session' as const }],
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, renderPane)
}
