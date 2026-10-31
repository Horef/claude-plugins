// session-status-line: one compact row above the prompt showing activity,
// model + effort, context fill, rate limits (with reset and pace), cost,
// last turn time and a few cheap extras; outside budgets (Kiro, Copilot,
// Claude extra usage) read every few minutes where their logins exist.
// Commands: `/status-line` toggles; `on|off`; `auto|one|two` picks the layout;
// `quotas on|off` reads the outside budgets or not; `debug` reports the
// version, measured width and the last quota readings. Env fallbacks: NO_COLOR=1
// drops colors, SESSION_STATUS_ASCII=1 swaps emoji/box glyphs for plain ASCII.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Layout, Limit, Quota, Quotas, Stats, Usage } from '../types'

const VERSION = '0.4.0' // keep in step with plugin.json; `/status-line debug` reports it

// ─── Tweak me ────────────────────────────────────────────────────────────
const CONFIG = {
  // Fill boundaries in percent (context window and rate limits): below `warn` is healthy.
  thresholds: { warn: 50, high: 75, crit: 90 },
  // Mid-tone hex colors chosen to keep at least 3:1 contrast on white,
  // off-white and dark backgrounds alike (plain ANSI yellow/cyan wash out on
  // light themes). Darker shades favour light themes, lighter ones dark.
  colors: {
    ok: '#15803d', // green
    warn: '#a16207', // dark gold
    high: '#ea580c', // orange
    crit: '#dc2626', // red
    model: '#0891b2', // teal
    switched: '#c026d3', // magenta
  },
  icons: {
    ok: '🟢', warn: '🟡', high: '🟠', crit: '🔴',
    working: '⏳', idle: '✅',
    model: '◆', switched: '⇄',
    barFull: '▰', barEmpty: '▱',
    reset: '⟳', pace: '⚠', turn: '⏱', files: '✎', compact: '🗜', sep: ' │ ',
  },
  // Used when SESSION_STATUS_ASCII is set (terminals without emoji fonts).
  asciiIcons: {
    ok: '[ok]', warn: '[50%+]', high: '[75%+]', crit: '[90%+]',
    working: '*', idle: '-',
    model: '>', switched: '<>',
    barFull: '#', barEmpty: '.',
    reset: 'reset ', pace: '! ', turn: 'turn ', files: 'files ', compact: 'compacted ', sep: ' | ',
  },
  // Proportional fonts (the desktop app) draw ▰▱ at uneven sizes; these stay even.
  desktopBar: { barFull: '●', barEmpty: '○' },
  barWidth: 6,
  // Default layout; `/status-line auto|one|two` changes it and is remembered.
  layout: 'auto' as Layout,
  // Segments on the first ("now") line when two lines are used; the rest go below.
  firstLine: ['head', 'ctx', 'ctxTokens', 'hint', 'cost'],
  // Thinking-effort tags shown after the model name; a numeric budget shows as e.g. (8k).
  effortLabels: { low: 'L', medium: 'M', high: 'H', xhigh: 'XH', max: 'Max' } as Record<string, string>,
  // Rate-limit windows: short label and length (the length drives the pace warning).
  limits: {
    five_hour: { label: '5h', ms: 5 * 3_600_000 },
    seven_day: { label: '7d', ms: 7 * 86_400_000 },
  } as Record<string, { label: string; ms: number }>,
  // Pace warning: only once this share of a window has elapsed (early readings are noisy).
  paceMinElapsed: 0.1,
  // ...and only when the limit would be hit at least this share of the window before it resets.
  paceMargin: 0.1,
  critHint: '/compact',
  // Compaction counter turns orange from this many summaries on (each one loses detail).
  compactWarnAt: 3,
  // Turns the switched-model highlight stays on after a model change.
  switchHighlightTurns: 3,
  // Outside budgets: how often to read them (shared across chats through $.store),
  // and after how long a reading is shown dimmed as old.
  quotas: { everyMs: 5 * 60_000, oldMs: 30 * 60_000 },
  // Claude extra usage shows only once credits are spent or a 5h/7d window is full.
  // Segments dropped first when a line does not fit, in order.
  // Activity, model and the context bar are never dropped. A reset or pace
  // tag must be listed before its limit, since it is glued to it.
  dropOrder: [
    'session', 'files', 'lastTurn', 'resetcopilot', 'resetkiro', 'cost', 'compactions', 'ctxTokens',
    'copilot', 'kiro', 'reset7d', 'pace7d', 'limit7d', 'resetOther', 'paceOther', 'limitOther',
    'reset5h', 'hint', 'pace5h', 'extra', 'limit5h',
  ],
}

// ─── State (host-held, survives hot reloads) ─────────────────────────────
const EMPTY: Stats = {
  turns: 0, compactions: 0, lastTurnMs: null, files: [],
  model: null, prevModel: null, apiModel: null, effort: null, switchedAtTurn: null,
}
const enabled = atom({ plugin: 'session-status-line', key: 'enabled' } as const, true)
const stats = atom({ plugin: 'session-status-line', key: 'stats' } as const, EMPTY)
const usage = atom({ plugin: 'session-status-line', key: 'usage' } as const, {} as Usage)
const layout = atom({ plugin: 'session-status-line', key: 'layout' } as const, CONFIG.layout)
const tick = atom({ plugin: 'session-status-line', key: 'tick' } as const, 0) // minute clock for countdowns
const quotas = atom({ plugin: 'session-status-line', key: 'quotas' } as const, { on: true, at: 0, items: [] } as Quotas)

// Read once per load in session.start.
let noColor = false
// What the last draw measured, for `/status-line debug` (module-local, display only).
let lastDraw: { surface: string; bodyColumns: number; maxRows: number; widths: number[] } | null = null
type Icons = Record<keyof typeof CONFIG.icons, string>
let icons: Icons = CONFIG.icons
// One quota read at a time; a second caller waits for it (module-local: a reload may start another, harmlessly).
let reading: Promise<void> | null = null
// Why each reader last came back empty, for `/status-line debug` (display only).
const misses: Record<string, string> = {}
const miss = (id: string, why: string) => {
  misses[id] = why
  return null
}

// ─── Formatting helpers ──────────────────────────────────────────────────
/** 950 → "950", 12_345 → "12k", 1_234_567 → "1.2M". */
const fmt = (n: number): string => {
  const [v, s] = n >= 1e6 ? [n / 1e6, 'M'] : n >= 1e3 ? [n / 1e3, 'k'] : [n, '']
  return (v < 10 && s ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v))) + s
}

/** "claude-sonnet-5-5" → "Sonnet 5.5", "opus[1m]" → "Opus 1M"; null if unrecognised. */
const shortModel = (id: string | null): string | null => {
  if (!id) return null
  const m = /(opus|sonnet|haiku|fable)[-_ ]?(\d+)?(?:[-.](\d{1,2})(?!\d))?/i.exec(id)
  if (!m) return null
  const name = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
  const ver = m[2] ? (m[3] ? `${m[2]}.${m[3]}` : m[2]) : ''
  return [name, ver, /\[1m\]/i.test(id) ? '1M' : ''].filter(Boolean).join(' ')
}

/** Terminal cells a string takes: pictographs are two wide. */
const cells = (s: string): number => {
  let w = 0
  for (const ch of s) w += /\p{Extended_Pictographic}/u.test(ch) ? 2 : ch === '️' ? 0 : 1
  return w
}

/** A span in ms → "8s", "45m", "2h10m", "3d4h" (seconds only under a minute). */
const fmtSpan = (ms: number): string => {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec}s`
  const m = Math.round(sec / 60)
  if (m < 60) return `${m}m`
  if (m < 24 * 60) return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(m / 1440)}d${Math.floor((m % 1440) / 60)}h`
}

/** A turn's length → "8s", "1m12s", "1h05m". */
const fmtTurn = (ms: number): string => {
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, '0')}s`
  return fmtSpan(ms)
}

const level = (pct: number) => {
  const t = CONFIG.thresholds
  return pct >= t.crit ? 'crit' : pct >= t.high ? 'high' : pct >= t.warn ? 'warn' : 'ok'
}

/**
 * Time until a window hits 100% at its average pace so far, when that comes
 * before the window resets; null when the pace is fine or unknowable.
 */
const timeToLimit = (lim: Limit, now: number): number | null => {
  const win = CONFIG.limits[lim.kind]?.ms
  const resets = lim.resetsAt ? Date.parse(lim.resetsAt) : NaN
  if (!win || Number.isNaN(resets) || resets <= now || lim.percentUsed <= 0) return null
  const elapsed = win - (resets - now)
  if (elapsed < win * CONFIG.paceMinElapsed) return null
  if (lim.percentUsed >= 100) return 0
  const left = ((100 - lim.percentUsed) * elapsed) / lim.percentUsed
  return left < resets - now - win * CONFIG.paceMargin ? left : null
}

// A segment is a few styled pieces; `id` ties it to CONFIG.dropOrder.
type Piece = { text: string; color?: string; dim?: boolean; bold?: boolean }
type Segment = { id: string; pieces: Piece[]; glue?: boolean } // glue: no separator before it

/** Money as "$2.37", "$59", or "12.40 EUR". */
const fmtMoney = (n: number, currency = 'USD') => {
  const v = n < 100 ? n.toFixed(2).replace(/\.00$/, '') : String(Math.round(n))
  return currency === 'USD' ? `$${v}` : `${v} ${currency}`
}

/** Kiro and Copilot: label, % used, overage, reset; Claude extra usage once it matters. */
const quotaSegments = (q: Quotas, u: Usage, now: number, ic: Icons): Segment[] => {
  if (!q.on) return []
  const out: Segment[] = []
  const claudeFull = (u.limits ?? []).some(l => l.percentUsed >= 100)
  for (const item of q.items) {
    const old = now - item.at > CONFIG.quotas.oldMs
    if (item.id === 'extra') {
      if (item.spent === undefined || (item.spent <= 0 && !claudeFull)) continue
      const pct = item.cap ? (item.spent / item.cap) * 100 : 0
      const lv = level(pct)
      out.push({
        id: 'extra',
        pieces: [
          { text: 'extra ', dim: true },
          {
            text: fmtMoney(item.spent, item.currency) + (item.cap ? `/${fmtMoney(item.cap, item.currency)}` : ''),
            color: lv === 'ok' ? undefined : CONFIG.colors[lv], dim: old,
          },
        ],
      })
      continue
    }
    const label = item.id === 'kiro' ? 'Kiro' : 'Copilot'
    if (item.login) {
      out.push({ id: item.id, pieces: [{ text: `${label} `, dim: true }, { text: 'log in', color: CONFIG.colors.warn }] })
      continue
    }
    if (item.percent === undefined) continue
    const lv = level(item.percent)
    const pieces: Piece[] = [
      { text: `${label} `, dim: true },
      { text: `${Math.round(item.percent)}%`, color: lv === 'ok' ? undefined : CONFIG.colors[lv], bold: lv === 'crit', dim: old },
    ]
    if (item.spent) pieces.push({ text: ` +${fmtMoney(item.spent, item.currency)}`, color: CONFIG.colors.high, dim: old })
    out.push({ id: item.id, pieces })
    const resets = item.resetsAt ? Date.parse(item.resetsAt) : NaN
    if (!Number.isNaN(resets) && resets > now) {
      out.push({ id: `reset${item.id}`, glue: true, pieces: [{ text: ` ${ic.reset}${fmtSpan(resets - now)}`, dim: true }] })
    }
  }
  return out
}

const buildSegments = (s: Stats, u: Usage, q: Quotas, isWorking: boolean, now: number, ic: Icons): Segment[] => {
  const out: Segment[] = []

  // Activity + model + effort (always shown).
  const isSwitched = s.switchedAtTurn !== null && s.turns - s.switchedAtTurn < CONFIG.switchHighlightTurns
  const model = shortModel(s.model) ?? shortModel(s.apiModel) ?? s.model?.slice(0, 18) ?? null
  const head: Piece[] = [{ text: isWorking ? ic.working : ic.idle }]
  if (model) {
    head.push({
      text: ` ${isSwitched ? ic.switched : ic.model} ${model}`,
      color: isSwitched ? CONFIG.colors.switched : CONFIG.colors.model,
      bold: isSwitched,
    })
  }
  if (s.effort !== null) {
    const tag = typeof s.effort === 'number' ? fmt(s.effort) : CONFIG.effortLabels[s.effort] ?? s.effort
    head.push({ text: ` (${tag})`, dim: true })
  }
  out.push({ id: 'head', pieces: head })

  // Context bar (always shown once the window has a reading).
  const pct = u.percent ?? (u.tokens !== undefined && u.window ? Math.round((u.tokens / u.window) * 100) : undefined)
  if (pct !== undefined) {
    const lv = level(pct)
    const filled = Math.min(CONFIG.barWidth, Math.max(0, Math.round((pct / 100) * CONFIG.barWidth)))
    out.push({
      id: 'ctx',
      pieces: [
        { text: `${ic[lv]} ` },
        { text: ic.barFull.repeat(filled), color: CONFIG.colors[lv] },
        { text: ic.barEmpty.repeat(CONFIG.barWidth - filled), dim: true },
        { text: ` ${pct}%`, color: CONFIG.colors[lv], bold: lv === 'crit' },
      ],
    })
    if (u.tokens !== undefined && u.window) {
      out.push({ id: 'ctxTokens', glue: true, pieces: [{ text: ` ${fmt(u.tokens)}/${fmt(u.window)}`, dim: true }] })
    }
    if (lv === 'crit') {
      out.push({ id: 'hint', glue: true, pieces: [{ text: ` → ${CONFIG.critHint}`, color: CONFIG.colors.crit }] })
    }
  } else if (u.window) {
    out.push({ id: 'ctxTokens', pieces: [{ text: `ctx ${fmt(u.window)}`, dim: true }] })
  }

  // Account rate-limit windows: label, %, time to reset, pace warning.
  for (const lim of u.limits ?? []) {
    const known = CONFIG.limits[lim.kind]
    const suffix = lim.kind === 'five_hour' ? '5h' : lim.kind === 'seven_day' ? '7d' : 'Other'
    const lv = level(lim.percentUsed)
    out.push({
      id: `limit${suffix}`,
      pieces: [
        { text: `${known?.label ?? lim.kind.replace(/_/g, ' ')} `, dim: true },
        { text: `${Math.round(lim.percentUsed)}%`, color: lv === 'ok' ? undefined : CONFIG.colors[lv], bold: lv === 'crit' },
      ],
    })
    const resets = lim.resetsAt ? Date.parse(lim.resetsAt) : NaN
    if (!Number.isNaN(resets) && resets > now) {
      out.push({ id: `reset${suffix}`, glue: true, pieces: [{ text: ` ${ic.reset}${fmtSpan(resets - now)}`, dim: true }] })
    }
    const left = timeToLimit(lim, now)
    if (left !== null) {
      out.push({
        id: `pace${suffix}`,
        glue: true,
        pieces: [{ text: ` ${ic.pace}${fmtSpan(left)}`, color: CONFIG.colors[left < 3_600_000 ? 'crit' : 'high'] }],
      })
    }
  }

  out.push(...quotaSegments(q, u, now, ic))

  if (u.costUsd !== undefined) {
    out.push({ id: 'cost', pieces: [{ text: `$${u.costUsd < 10 ? u.costUsd.toFixed(2) : u.costUsd.toFixed(1)}` }] })
  }

  // How long the last main-loop turn took.
  if (s.lastTurnMs !== null) {
    out.push({ id: 'lastTurn', pieces: [{ text: `${ic.turn}${fmtTurn(s.lastTurnMs)}`, dim: true }] })
  }

  if (s.files.length > 0) {
    out.push({ id: 'files', pieces: [{ text: `${ic.files}${s.files.length}`, dim: true }] })
  }

  // Times this conversation has been summarized (compacted); 0 is shown too.
  out.push({
    id: 'compactions',
    pieces: [{
      text: `${ic.compact}${s.compactions}`,
      dim: s.compactions === 0,
      color: s.compactions >= CONFIG.compactWarnAt ? CONFIG.colors.high : undefined,
    }],
  })

  // Session: turns, age.
  const session: string[] = []
  if (s.turns > 0) session.push(`${s.turns} turn${s.turns === 1 ? '' : 's'}`)
  if (u.startedAt !== undefined && now > u.startedAt) session.push(fmtSpan(Math.floor((now - u.startedAt) / 60_000) * 60_000))
  if (session.length > 0) out.push({ id: 'session', pieces: [{ text: session.join(' · '), dim: true }] })

  return out
}

const segWidth = (seg: Segment) =>
  (seg.glue ? 0 : cells(icons.sep)) + seg.pieces.reduce((w, p) => w + cells(p.text), 0)
const rowWidth = (segs: Segment[]) => segs.reduce((w, s) => w + segWidth(s), 0) - cells(icons.sep)

/** Drops segments in CONFIG.dropOrder until the row fits `columns`. */
const fit = (segs: Segment[], columns: number): Segment[] => {
  let kept = segs
  for (const id of CONFIG.dropOrder) {
    if (rowWidth(kept) <= columns) break
    kept = kept.filter(s => s.id !== id)
  }
  return kept
}

/** One line when it all fits (or is forced), else a "now" line and a "budget" line. */
const toLines = (segs: Segment[], columns: number, mode: Layout, maxRows: number): Segment[][] => {
  if (maxRows < 2 || mode === 'one' || (mode === 'auto' && rowWidth(segs) <= columns)) return [fit(segs, columns)]
  const first = segs.filter(s => CONFIG.firstLine.includes(s.id))
  const second = segs.filter(s => !CONFIG.firstLine.includes(s.id))
  return [fit(first, columns), fit(second, columns)].filter(line => line.length > 0)
}

/**
 * Compaction counts live in `$.store` per session id, so a resumed chat keeps
 * its count; the map keeps the 50 most recent sessions.
 */
async function loadCompactions($: EngineInterface) {
  const id = await $.session.id().catch(() => null)
  const map = (await $.store.get('compactions')) as Record<string, number> | undefined
  const n = id && map && typeof map[id] === 'number' ? map[id] : 0
  await update($, stats, s => (s.compactions === n ? s : { ...s, compactions: n }))
}

async function saveCompactions($: EngineInterface, n: number) {
  const id = await $.session.id().catch(() => null)
  if (!id) return
  const map = { ...((await $.store.get('compactions')) as Record<string, number> | undefined) }
  delete map[id] // re-insert last so it counts as most recent
  map[id] = n
  await $.store.set('compactions', Object.fromEntries(Object.entries(map).slice(-50)))
}

/** Re-reads the session model; records a switch when it changed. */
async function refreshModel($: EngineInterface) {
  const model = await $.session.model().catch(() => null)
  if (!model) return
  await update($, stats, s => {
    if (s.model === model) return s
    const isSwitch = s.model !== null
    return { ...s, model, prevModel: isSwitch ? s.model : s.prevModel, switchedAtTurn: isSwitch ? s.turns : s.switchedAtTurn }
  })
}

async function refreshUsage($: EngineInterface) {
  const u = await $.session.usage().catch(() => null)
  if (!u) return
  await update($, usage, () => ({
    tokens: u.context.tokens,
    window: u.context.window,
    percent: u.context.percent,
    costUsd: u.cost?.usd,
    startedAt: u.startedAt,
    limits: u.rateLimits,
  }))
}

// ─── Outside budgets ─────────────────────────────────────────────────────
// Each reader answers a Quota, or null when the service is absent here (no
// CLI, no login file, no plan): then it is simply not shown. Secrets read
// here go only into the request to the service they belong to.

type Json = Record<string, any>
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** Kiro: credits used of the month's limit and overage charges, from the API the CLI uses. */
async function readKiro($: EngineInterface, now: number): Promise<Quota | null> {
  const home = await $.env.get('HOME')
  if (!home) return miss('kiro', 'no HOME')
  const db = `${home}/Library/Application Support/kiro-cli/data.sqlite3`
  const sql = async (key: string, table: string) => {
    const r = await $.process.run(['sqlite3', '-readonly', db, `select value from ${table} where key='${key}'`], { timeoutMs: 5000 })
    return r.exitCode === 0 && r.stdout.trim() ? (JSON.parse(r.stdout) as Json) : null
  }
  const token = () => sql('kirocli:odic:token', 'auth_kv')
  let tok = await token().catch(() => null)
  if (!tok?.access_token) return miss('kiro', 'no token in kiro-cli data.sqlite3')
  const fresh = (t: Json) => Date.parse(t.expires_at) > now + 60_000
  if (!fresh(tok)) {
    // The access token lives about an hour; any kiro-cli run refreshes it.
    // When that fails, the login itself has gone stale (every 8-12 hours).
    const who = await $.process.run(['kiro-cli', 'whoami'], { timeoutMs: 20_000 }).catch(() => null)
    if (!who || who.exitCode !== 0) return { id: 'kiro', login: true, at: now }
    tok = await token().catch(() => null)
    if (!tok?.access_token || !fresh(tok)) return miss('kiro', 'token still expired after whoami') // keep the last reading
  }
  const arn = (await sql('api.codewhisperer.profile', 'state').catch(() => null))?.arn
  if (typeof arn !== 'string') return miss('kiro', 'no profile ARN')
  const region = arn.split(':')[3] || 'us-east-1'
  const res = await $.http.fetch(`https://codewhisperer.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.0',
      'x-amz-target': 'AmazonCodeWhispererService.GetUsageLimits',
      authorization: `Bearer ${tok.access_token}`,
    },
    body: JSON.stringify({ profileArn: arn, resourceType: 'AGENTIC_REQUEST', isEmailRequired: false }),
  })
  if (res.status === 401 || res.status === 403) return { id: 'kiro', login: true, at: now }
  if (!res.ok) return miss('kiro', `HTTP ${res.status}`)
  const body = JSON.parse(res.text) as Json
  const list = (body.usageBreakdownList ?? []) as Json[]
  const b = list.find(x => x.resourceType === 'CREDIT') ?? list[0]
  if (!b) return null
  const used = num(b.currentUsageWithPrecision), limit = num(b.usageLimitWithPrecision)
  if (used === undefined || !limit) return null
  const reset = num(body.nextDateReset)
  return {
    id: 'kiro', at: now, percent: (used / limit) * 100,
    resetsAt: reset ? new Date(reset * 1000).toISOString() : undefined,
    spent: num(b.overageCharges), currency: typeof b.currency === 'string' ? b.currency : 'USD',
  }
}

/** Copilot: premium credits used of the month's entitlement, through the gh login. */
async function readCopilot($: EngineInterface, now: number): Promise<Quota | null> {
  const r = await $.process.run(['gh', 'api', '/copilot_internal/user'], { timeoutMs: 10_000 })
  if (r.exitCode !== 0) return miss('copilot', `gh exit ${r.exitCode}: ${r.stderr.slice(0, 80)}`)
  const body = JSON.parse(r.stdout) as Json
  const p = body.quota_snapshots?.premium_interactions as Json | undefined
  const total = num(p?.entitlement)
  if (!p || p.unlimited || !total) return null
  const used = num(p.credits_used) ?? total - (num(p.remaining) ?? total)
  return {
    id: 'copilot', at: now, percent: (used / total) * 100,
    resetsAt: body.quota_reset_date_utc ?? body.quota_reset_date,
  }
}

/** Claude extra usage: credits spent past the plan's limits this month (minor units, e.g. cents). */
async function readExtra($: EngineInterface, now: number): Promise<Quota | null> {
  const auth = await $.session.authorize().catch(() => null)
  if (!auth || auth.kind !== 'bearer') return miss('extra', `no subscription login (${auth?.kind ?? 'none'})`)
  const res = await $.http.fetch('https://api.anthropic.com/api/oauth/usage', {
    headers: { 'anthropic-beta': 'oauth-2025-04-20' },
    auth: auth.handle,
  })
  if (!res.ok) return miss('extra', `HTTP ${res.status}`)
  const x = (JSON.parse(res.text) as Json).extra_usage as Json | null | undefined
  if (!x?.is_enabled) return miss('extra', 'extra usage not enabled')
  const used = num(x.used_credits), cap = num(x.monthly_limit)
  return {
    id: 'extra', at: now,
    spent: used === undefined ? undefined : used / 100,
    cap: cap === undefined ? undefined : cap / 100,
    currency: typeof x.currency === 'string' ? x.currency : 'USD',
  }
}

/**
 * Reads all budgets in the background, at most every `CONFIG.quotas.everyMs`
 * across all chats (the readings are shared through $.store). A reader that
 * fails keeps its previous reading.
 */
async function refreshQuotas($: EngineInterface, force = false): Promise<void> {
  if (reading) {
    await reading
    if (!force) return
    if (reading) return reading
  }
  if (!(await read($, quotas)).on) return
  reading = readQuotas($, force).finally(() => {
    reading = null
  })
  return reading
}

async function readQuotas($: EngineInterface, force: boolean) {
  {
    const now = await $.clock.now()
    const saved = (await $.store.get('quotaReadings')) as { at: number; items: Quota[] } | undefined
    if (!force && saved && now - saved.at < CONFIG.quotas.everyMs) {
      await update($, quotas, q => ({ ...q, at: saved.at, items: saved.items }))
      return
    }
    const prev = saved?.items ?? (await read($, quotas)).items
    const caught = (id: string) => (err: unknown) => miss(id, `threw: ${String(err).slice(0, 120)}`)
    const got = {
      kiro: await readKiro($, now).catch(caught('kiro')),
      copilot: await readCopilot($, now).catch(caught('copilot')),
      extra: await readExtra($, now).catch(caught('extra')),
    }
    const items: Quota[] = []
    for (const [id, fresh] of Object.entries(got)) {
      const keep = fresh ?? prev.find(p => p.id === id)
      if (keep) items.push(keep)
    }
    await $.store.set('quotaReadings', { at: now, items })
    await update($, quotas, q => ({ ...q, at: now, items }))
  }
}

// ─── Hooks ───────────────────────────────────────────────────────────────
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    noColor = (await $.env.get('NO_COLOR')) !== undefined
    icons = (await $.env.get('SESSION_STATUS_ASCII')) ? CONFIG.asciiIcons : CONFIG.icons
    const saved = await $.store.get('enabled')
    if (typeof saved === 'boolean') await update($, enabled, () => saved)
    const savedLayout = await $.store.get('layout')
    if (savedLayout === 'auto' || savedLayout === 'one' || savedLayout === 'two') await update($, layout, () => savedLayout)
    const savedQuotas = await $.store.get('quotasOn')
    if (typeof savedQuotas === 'boolean') await update($, quotas, q => ({ ...q, on: savedQuotas }))

    await $.command.register({
      name: 'status-line',
      description: 'Session status line: toggle, on | off, layout auto | one | two, quotas on | off, or debug',
    })
    await Promise.all([refreshModel($), refreshUsage($), loadCompactions($)])
    void refreshQuotas($) // network and CLI calls: never hold up the session
    // Once a minute: advance the countdowns and catch model switches made
    // outside a turn. Cheap: one state write, one model read.
    $.clock.every(60_000, () => {
      void update($, tick, n => n + 1)
      void refreshModel($)
      void refreshQuotas($)
    })
    return next(e)
  })

  on('command.run', { command: 'status-line' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'debug') {
      const d = lastDraw
      const q = await read($, quotas)
      const readings = q.on
        ? q.items.map(i => `${i.id} ${JSON.stringify({ ...i, at: undefined })}`).join('; ') || 'none'
        : 'off'
      return {
        text: (d
          ? `session-status-line ${VERSION}: surface ${d.surface}, band ${d.bodyColumns} columns × ${d.maxRows} rows, ` +
            `layout ${await read($, layout)}, ${d.widths.length} line(s) of ${d.widths.join(' + ')} columns`
          : `session-status-line ${VERSION}: not drawn yet`) +
          `. Quotas${q.at ? ` (read ${new Date(q.at).toISOString()})` : ''}: ${readings}` +
          (Object.keys(misses).length ? `. Last misses: ${Object.entries(misses).map(([k, v]) => `${k} ${v}`).join('; ')}` : ''),
      }
    }
    if (arg === 'quotas on' || arg === 'quotas off' || arg === 'quotas') {
      const isOn = arg !== 'quotas off'
      await update($, quotas, q => ({ ...q, on: isOn }))
      await $.store.set('quotasOn', isOn)
      if (isOn) await refreshQuotas($, true)
      const n = (await read($, quotas)).items.length
      const why = Object.entries(misses).map(([k, v]) => `${k}: ${v}`).join('; ')
      return {
        text: isOn
          ? `Outside budgets on (${n} found: Kiro, Copilot, Claude extra usage where logged in)${why ? `. Not read: ${why}` : ''}.`
          : 'Outside budgets off.',
      }
    }
    if (arg === 'auto' || arg === 'one' || arg === 'two') {
      await update($, layout, () => arg)
      await update($, enabled, () => true)
      await $.store.set('layout', arg)
      await $.store.set('enabled', true)
      return { text: `Session status line layout: ${arg}.` }
    }
    const value = await update($, enabled, cur => (arg === 'on' ? true : arg === 'off' ? false : !cur))
    await $.store.set('enabled', value)
    return { text: `Session status line ${value ? 'on' : 'off'}.` }
  })

  // `/model` and friends: pick up the new model right away.
  on('command.run', async ($, e, next) => {
    const result = await next(e)
    if (e.command === 'model') await refreshModel($)
    return result
  })

  on('turn.start', async ($, e, next) => {
    await refreshModel($)
    return next(e)
  })

  // The effort each main-loop request actually runs with (after any downgrade for the model).
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      const effort = e.effort ?? null
      await update($, stats, s => (s.effort === effort ? s : { ...s, effort }))
    }
    return yield* next(e)
  })

  // Files edited this session (main loop and subagents), counted once each.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const path =
      e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : e.tool === 'NotebookEdit' ? e.notebook_path : undefined
    if (path && !('deny' in result && result.deny) && !result.isError) {
      await update($, stats, s => (s.files.includes(path) ? s : { ...s, files: [...s.files, path].slice(-500) }))
    }
    return result
  })

  // Main-loop turn finished: count it and record how long it took.
  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      await update($, stats, s => ({
        ...s,
        turns: s.turns + 1,
        lastTurnMs: e.durationMs,
        apiModel: e.usage?.model ?? s.apiModel,
      }))
    }
    return next(e)
  })

  // Count compactions that actually replaced the main conversation: not a
  // subagent's, not a `precompute` (prepared ahead, installs nothing), not a veto.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && e.trigger !== 'precompute' && !('skip' in result && result.skip)) {
      const s = await update($, stats, cur => ({ ...cur, compactions: cur.compactions + 1 }))
      await saveCompactions($, s.compactions)
      await refreshUsage($)
    }
    return result
  })

  // The engine's own status-line figures: context fill, cost, rate limits.
  on('session.measure', async ($, e, next) => {
    await update($, usage, u => ({
      ...u,
      tokens: e.context.tokens,
      window: e.context.window,
      percent: e.context.percent,
      costUsd: e.cost?.usd ?? u.costUsd,
      limits: e.rateLimits.length ? e.rateLimits : u.limits,
    }))
    return next(e)
  })

  // /clear starts a fresh conversation in the same process: reset totals.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, stats, s => ({ ...EMPTY, model: s.model, apiModel: s.apiModel, effort: s.effort }))
      await refreshUsage($)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, enabled))) return next(e)

    const [s, u, mode, q] = await Promise.all([read($, stats), read($, usage), read($, layout), read($, quotas)])
    await read($, tick) // subscribe so the countdowns redraw each minute
    const now = await $.clock.now()
    const ic = e.surface !== 'terminal' && icons === CONFIG.icons ? { ...icons, ...CONFIG.desktopBar } : icons
    const lines = toLines(buildSegments(s, u, q, e.props.isWorking, now, ic), Math.max(10, e.props.bodyColumns - 1), mode, e.props.maxRows)
    lastDraw = { surface: e.surface, bodyColumns: e.props.bodyColumns, maxRows: e.props.maxRows, widths: lines.map(rowWidth) }
    if (lines.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const toPieces = (segs: Segment[]) => {
      const pieces: Piece[] = []
      segs.forEach((seg, i) => {
        if (i > 0 && !seg.glue) pieces.push({ text: icons.sep, dim: true })
        pieces.push(...seg.pieces)
      })
      return pieces
    }

    return (
      <Box flexDirection="column">
        {lines.map((line, l) => (
          <Box key={`l${l}`} flexDirection="row">
            {toPieces(line).map((p, i) => (
              <Text key={`p${l}-${i}`} wrap="truncate" color={noColor ? undefined : p.color} dimColor={p.dim} bold={p.bold}>
                {p.text}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
