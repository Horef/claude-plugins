// session-status-line: one compact row above the prompt showing activity,
// model + effort, context fill, rate limits (with reset and pace), cost,
// last turn time and a few cheap extras; outside budgets (Kiro, Copilot, Codex,
// Antigravity, Claude extra usage) read every few minutes where their logins exist,
// and the 5h / 7d limits of other Claude accounts on this machine (each account's
// sessions write their own readings to ${XDG_CONFIG_HOME:-~/.config}/claude-accounts/<key>.json).
// Rows: model, context and Claude limits; helper budgets; the rest.
// Commands: `/status-line` toggles; `on|off`; `auto|one|rows` picks the layout;
// `quotas on|off` reads the outside budgets or not; `account-label <name>` names this
// account in the other accounts' status lines; `live on|off` lets it read other accounts' limits
// straight from the service; `debug` reports the
// version, measured width and the last quota readings. Env fallbacks: NO_COLOR=1
// drops colors, SESSION_STATUS_ASCII=1 swaps emoji/box glyphs for plain ASCII.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Account, Layout, Limit, Quota, Quotas, Stats, Usage, Win } from '../types'

const VERSION = '0.6.0' // keep in step with plugin.json; `/status-line debug` reports it

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
  // Default layout; `/status-line auto|one|rows` changes it and is remembered.
  layout: 'auto' as Layout,
  // Rows when the line does not fit (or `rows` is chosen): Claude's own state, then the
  // helpers' budgets; every segment not listed goes on a last row. Empty rows are skipped.
  rows: [
    ['head', 'ctx', 'ctxTokens', 'hint', 'limit5h', 'reset5h', 'pace5h', 'limit7d', 'reset7d', 'pace7d',
      'limitOther', 'resetOther', 'paceOther'],
    ['kiro', 'resetkiro', 'copilot', 'resetcopilot', 'codex', 'resetcodex', 'agy', 'argon', 'resetargon', 'acct', 'resetacct', 'extra'],
  ],
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
  // Other Claude accounts: a reading older than `oldMs` is shown dimmed; the live read
  // runs only when the file's reading is older than `liveAfterMs`, at most every `liveEveryMs` per account.
  accounts: { oldMs: 6 * 3_600_000, liveAfterMs: 10 * 60_000, liveEveryMs: 5 * 60_000, labelMax: 24 },
  // Claude extra usage shows only once credits are spent or a 5h/7d window is full.
  // Segments dropped first when a line does not fit, in order.
  // Activity, model and the context bar are never dropped. A reset or pace
  // tag must be listed before its limit, since it is glued to it.
  dropOrder: [
    'session', 'files', 'lastTurn', 'resetacct', 'resetcodex', 'resetargon', 'resetcopilot', 'resetkiro', 'cost', 'compactions', 'ctxTokens',
    'acct', 'codex', 'agy', 'argon', 'copilot', 'kiro', 'reset7d', 'pace7d', 'limit7d', 'resetOther', 'paceOther', 'limitOther',
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
const quotas = atom({ plugin: 'session-status-line', key: 'quotas' } as const, { on: true, at: 0, items: [], accounts: [] } as Quotas)

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

/** ` 5h 21%`: a window's label and share used, colored by fill. */
const winPieces = (label: string, v: number | undefined, old: boolean): Piece[] => {
  if (v === undefined) return []
  const lv = level(v)
  return [{ text: ` ${label} `, dim: true }, { text: `${Math.round(v)}%`, color: lv === 'ok' ? undefined : CONFIG.colors[lv], bold: lv === 'crit', dim: old }]
}

/** A window whose reset has passed counts as unused. */
const liveWin = (w: Win | undefined, now: number): Win | undefined => {
  if (!w) return undefined
  const r = w.resetsAt ? Date.parse(w.resetsAt) : NaN
  return !Number.isNaN(r) && r <= now ? { label: w.label, percent: 0 } : w
}

/** The window that limits first (the fullest) and its reset, as a glued segment; nothing when it has no future reset. */
const bindingReset = (id: string, wins: (Win | undefined)[], now: number, ic: Icons): Segment[] => {
  const w = wins.filter((x): x is Win => !!x).sort((a, b) => b.percent - a.percent)[0]
  const r = w?.resetsAt ? Date.parse(w.resetsAt) : NaN
  return !Number.isNaN(r) && r > now ? [{ id, glue: true, pieces: [{ text: ` ${ic.reset}${fmtSpan(r - now)}`, dim: true }] }] : []
}

/** Kiro, Copilot, Codex, Antigravity and the other Claude accounts: label, % used, overage, reset; Claude extra usage once it matters. */
const quotaSegments = (q: Quotas, u: Usage, now: number, ic: Icons): Segment[] => {
  if (!q.on) return []
  const out: Segment[] = []
  let extra: Segment | undefined
  const claudeFull = (u.limits ?? []).some(l => l.percentUsed >= 100)
  for (const item of q.items) {
    const old = now - item.at > CONFIG.quotas.oldMs
    if (item.id === 'extra') {
      if (item.spent === undefined || (item.spent <= 0 && !claudeFull)) continue
      const pct = item.cap ? (item.spent / item.cap) * 100 : 0
      const lv = level(pct)
      extra = {
        id: 'extra',
        pieces: [
          { text: 'extra ', dim: true },
          {
            text: fmtMoney(item.spent, item.currency) + (item.cap ? `/${fmtMoney(item.cap, item.currency)}` : ''),
            color: lv === 'ok' ? undefined : CONFIG.colors[lv], dim: old,
          },
        ],
      }
      continue
    }
    if (item.id === 'agy') {
      // Antigravity: the 5h and weekly use of its shared groups (worst one), and Argon's own weekly limit.
      const shared = (item.groups ?? []).filter(g => !/argon/i.test(g.name))
      const argon = (item.groups ?? []).find(g => /argon/i.test(g.name))
      const pc = (v: number | undefined, key: string) => winPieces(key, v, old)
      const worst = (k: 'five' | 'week') => {
        const v = shared.map(g => g[k]).filter((x): x is number => x !== undefined)
        return v.length ? Math.max(...v) : undefined
      }
      const body = [...pc(worst('five'), '5h'), ...pc(worst('week'), '7d')]
      if (body.length) out.push({ id: 'agy', pieces: [{ text: 'agy', dim: true }, ...body] })
      if (argon?.week !== undefined) {
        const lv = level(argon.week)
        out.push({ id: 'argon', pieces: [
          { text: 'Argon ', dim: true },
          { text: `${Math.round(argon.week)}%`, color: lv === 'ok' ? undefined : CONFIG.colors[lv], bold: lv === 'crit', dim: old },
        ] })
        const r = argon.weekResetsAt ? Date.parse(argon.weekResetsAt) : NaN
        if (!Number.isNaN(r) && r > now) out.push({ id: 'resetargon', glue: true, pieces: [{ text: ` ${ic.reset}${fmtSpan(r - now)}`, dim: true }] })
      }
      continue
    }
    if (item.id === 'codex') {
      const wins = (item.windows ?? []).map(w => liveWin(w, now)!)
      if (!wins.length) continue
      out.push({ id: 'codex', pieces: [{ text: 'Codex', dim: true }, ...wins.flatMap(w => winPieces(w.label, w.percent, old))] })
      out.push(...bindingReset('resetcodex', wins, now, ic))
      continue
    }
    const label = item.label ?? (item.id === 'kiro' ? 'Kiro' : 'Copilot')
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
  // Other Claude accounts: 'uni 5h 21% 7d 30% ⟳3d4h', dimmed when the reading is old.
  for (const a of q.accounts ?? []) {
    const old = now - a.at > CONFIG.accounts.oldMs
    const wins = [liveWin(a.five, now), liveWin(a.week, now)].filter((w): w is Win => !!w)
    if (!wins.length) continue
    out.push({ id: 'acct', pieces: [{ text: a.label, dim: true }, ...wins.flatMap(w => winPieces(w.label, w.percent, old))] })
    out.push(...bindingReset('resetacct', [a.five, a.week].map(w => liveWin(w, now)), now, ic))
  }
  if (extra) out.push(extra)
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

/** One line when it all fits (or is forced), else the rows of CONFIG.rows plus a row for the rest. */
const toLines = (segs: Segment[], columns: number, mode: Layout, maxRows: number): Segment[][] => {
  if (maxRows < 2 || mode === 'one' || (mode === 'auto' && rowWidth(segs) <= columns)) return [fit(segs, columns)]
  const listed = CONFIG.rows.flat()
  const rows = [...CONFIG.rows.map(ids => segs.filter(s => ids.includes(s.id))), segs.filter(s => !listed.includes(s.id))]
  return rows
    .filter(r => r.length > 0)
    .slice(0, maxRows)
    .map(r => fit(r[0]?.glue ? [{ ...r[0], glue: false }, ...r.slice(1)] : r, columns))
    .filter(line => line.length > 0)
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
  await writeOwnReading($, u.rateLimits ?? [])
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
  // macOS keeps the data under Application Support; Linux under the XDG data dir (path unverified: the docs do not name it).
  const mac = `${home}/Library/Application Support/kiro-cli/data.sqlite3`
  const xdg = (await $.env.get('XDG_DATA_HOME')) || `${home}/.local/share`
  const db = (await $.fs.exists(mac).catch(() => false)) ? mac : `${xdg}/kiro-cli/data.sqlite3`
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
    if (!who || who.exitCode !== 0) return { id: 'kiro', label: 'Kiro', login: true, at: now }
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
  if (res.status === 401 || res.status === 403) return { id: 'kiro', label: 'Kiro', login: true, at: now }
  if (!res.ok) return miss('kiro', `HTTP ${res.status}`)
  const body = JSON.parse(res.text) as Json
  const list = (body.usageBreakdownList ?? []) as Json[]
  const b = list.find(x => x.resourceType === 'CREDIT') ?? list[0]
  if (!b) return null
  const used = num(b.currentUsageWithPrecision), limit = num(b.usageLimitWithPrecision)
  if (used === undefined || !limit) return null
  const reset = num(body.nextDateReset)
  return {
    id: 'kiro', label: 'Kiro', at: now, percent: (used / limit) * 100,
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
    id: 'copilot', label: 'Copilot', at: now, percent: (used / total) * 100,
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
 * Antigravity: each model group's 5h and weekly remaining share, from `agy -p /usage`
 * (a local command that answers without a model turn; measured 2026-11-09).
 */
async function readAgy($: EngineInterface, now: number): Promise<Quota | null> {
  const home = await $.env.get('HOME')
  const args = ['-p', '/usage', '--output-format', 'json']
  let r = await $.process.run(['agy', ...args], { timeoutMs: 60_000 }).catch(() => null)
  // Not on the PATH of this process (a GUI launch): the installer's default spot, only if it is there.
  const fallback = home ? `${home}/.local/bin/agy` : undefined
  if ((!r || r.exitCode !== 0) && fallback && (await $.fs.exists(fallback).catch(() => false))) {
    r = await $.process.run([fallback, ...args], { timeoutMs: 60_000 }).catch(() => null)
  }
  if (!r || r.exitCode !== 0) return miss('agy', `agy exit ${r?.exitCode ?? 'none'}`)
  const groups = ((JSON.parse(r.stdout) as Json).command?.data?.groups ?? []) as Json[]
  if (!groups.length) return miss('agy', 'no usage groups')
  const used = (b?: Json) => (num(b?.remaining_fraction) === undefined ? undefined : (1 - b!.remaining_fraction) * 100)
  return {
    id: 'agy', at: now,
    groups: groups.map(g => {
      const bs = (g.buckets ?? []) as Json[]
      const five = bs.find(b => b.window === '5h'), week = bs.find(b => b.window === 'weekly')
      return { name: String(g.name), five: used(five), week: used(week), weekResetsAt: week?.reset_time }
    }),
  }
}

/** 300 → "5h", 10080 → "7d", 43200 → "30d" (a Codex window's length in minutes). */
const windowLabel = (minutes: number): string =>
  minutes % 1440 === 0 ? `${minutes / 1440}d` : minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`

const unixIso = (sec: unknown) => (num(sec) === undefined ? undefined : new Date((sec as number) * 1000).toISOString())

/** Codex's windows from the service the CLI uses (the access token goes only to chatgpt.com); null when it does not answer. */
async function codexLive($: EngineInterface, dir: string, now: number): Promise<Win[] | null> {
  const auth = JSON.parse(String(await $.fs.read(`${dir}/auth.json`))) as Json
  const token = auth.tokens?.access_token
  if (typeof token !== 'string') return miss('codex', 'no access token in auth.json')
  const headers: Record<string, string> = { authorization: `Bearer ${token}` }
  if (typeof auth.tokens?.account_id === 'string') headers['chatgpt-account-id'] = auth.tokens.account_id
  const res = await $.http.fetch('https://chatgpt.com/backend-api/wham/usage', { headers })
  if (!res.ok) return miss('codex', `HTTP ${res.status}`)
  const rl = (JSON.parse(res.text) as Json).rate_limit as Json | undefined
  const wins: Win[] = []
  for (const w of [rl?.primary_window, rl?.secondary_window] as (Json | undefined)[]) {
    const used = num(w?.used_percent), secs = num(w?.limit_window_seconds)
    if (!w || used === undefined || !secs) continue
    const after = num(w.reset_after_seconds)
    wins.push({
      label: windowLabel(Math.round(secs / 60)), percent: used,
      resetsAt: unixIso(w.reset_at) ?? (after === undefined ? undefined : new Date(now + after * 1000).toISOString()),
    })
  }
  return wins.length ? wins : miss('codex', 'no rate_limit windows')
}

/** The newest session rollout carrying a `rate_limits` line: its windows and when that line was written. */
async function codexRollout($: EngineInterface, dir: string): Promise<{ wins: Win[]; at?: number } | null> {
  const root = `${dir}/sessions`
  const newest = async (path: string) =>
    (await $.fs.list(path)).map(e => e.name).sort().reverse()
  const files: string[] = []
  for (const y of await newest(root)) {
    for (const m of await newest(`${root}/${y}`)) {
      for (const d of await newest(`${root}/${y}/${m}`)) {
        for (const f of await newest(`${root}/${y}/${m}/${d}`)) if (/^rollout-.*\.jsonl$/.test(f)) files.push(`${root}/${y}/${m}/${d}/${f}`)
        if (files.length >= 3) break
      }
      if (files.length >= 3) break
    }
    if (files.length >= 3) break
  }
  for (const file of files.slice(0, 3)) {
    const r = await $.process.run(['sh', '-c', 'tail -n 500 "$1" | grep rate_limits | tail -n 1', 'sh', file], { timeoutMs: 5000 }).catch(() => null)
    if (!r || r.exitCode !== 0 || !r.stdout.trim()) continue
    const line = JSON.parse(r.stdout.trim()) as Json
    const rl = (line.payload?.rate_limits ?? line.rate_limits) as Json | undefined
    const wins: Win[] = []
    for (const w of [rl?.primary, rl?.secondary] as (Json | undefined)[]) {
      const used = num(w?.used_percent), mins = num(w?.window_minutes)
      if (w && used !== undefined && mins) wins.push({ label: windowLabel(mins), percent: used, resetsAt: unixIso(w.resets_at) })
    }
    if (wins.length) {
      const at = typeof line.timestamp === 'string' ? Date.parse(line.timestamp) : NaN
      return { wins, at: Number.isNaN(at) ? undefined : at }
    }
  }
  return null
}

/** Codex: 5h and weekly limits (a monthly one on the free plan), live, else from the newest session; nothing where Codex was never used. */
async function readCodex($: EngineInterface, now: number): Promise<Quota | null> {
  const home = await $.env.get('HOME')
  const dir = (await $.env.get('CODEX_HOME')) || (home ? `${home}/.codex` : undefined)
  if (!dir) return miss('codex', 'no HOME or CODEX_HOME')
  const hasAuth = await $.fs.exists(`${dir}/auth.json`).catch(() => false)
  if (!hasAuth && !(await $.fs.exists(`${dir}/sessions`).catch(() => false))) return miss('codex', 'no Codex login or sessions')
  const live = hasAuth ? await codexLive($, dir, now).catch(err => miss('codex', `live: ${String(err).slice(0, 80)}`)) : null
  if (live) return { id: 'codex', label: 'Codex', at: now, windows: live }
  const old = await codexRollout($, dir).catch(() => null)
  if (!old) return miss('codex', 'no live reading and no rate_limits in recent sessions')
  return { id: 'codex', label: 'Codex', at: old.at ?? now, windows: old.wins }
}

// ─── Claude accounts ─────────────────────────────────────────────────────
// Each account has its own config dir; its sessions write the 5h / 7d readings to
// ${XDG_CONFIG_HOME:-~/.config}/claude-accounts/<key>.json (no token, no email), and the
// others read them: this is the contract other tools (the router's helper picker) rely on.

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

/** SHA-256 of a string as hex (the mod's sandbox has no crypto module; Claude Code names its Keychain item with this hash). */
const sha256 = (text: string): string => {
  const bytes = [...new TextEncoder().encode(text)]
  const bits = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 0xff)
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let o = 0; o < bytes.length; o += 64) {
    const w: number[] = []
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3]
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    ;[a, b, c, d, e, f, g, hh].forEach((v, i) => (h[i] = (h[i] + v) | 0))
  }
  return h.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('')
}

type Own = { key: string; dir: string; label: string }
// This session's account, found once (module-local: a reload finds it again).
let own: Own | null = null
let lastWrite = 0
let dirReady = false
let writing = false
const lastLive: Record<string, number> = {}
let liveOn = true

const homeOf = async ($: EngineInterface) => ((await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')))?.replace(/[\\/]+$/, '')

/** The directory's real path (symlinks resolved), or the path itself when it cannot be resolved. */
async function realpath($: EngineInterface, path: string) {
  const r = await $.process.run(['sh', '-c', 'cd "$1" 2>/dev/null && pwd -P', 'sh', path], { timeoutMs: 5000 }).catch(() => null)
  return r && r.exitCode === 0 && r.stdout.trim() ? r.stdout.trim() : path
}

const defaultLabel = (key: string, dir: string) => {
  if (key === 'default') return 'main'
  const base = dir.split(/[\\/]/).pop() ?? dir
  return base.replace(/^\.claude-?/, '') || base
}

/** This session's account: key (`default`, or the first 8 hex of sha256 of the config dir as written), dir and label. */
async function ownAccount($: EngineInterface): Promise<Own | null> {
  if (own) return own
  const home = await homeOf($)
  const given = ((await $.env.get('CLAUDE_CONFIG_DIR')) ?? '').trim()
  const written = (given || (home ? `${home}/.claude` : '')).replace(/(.)[\\/]+$/, '$1')
  if (!written) return null
  const isDefault = !!home && (await realpath($, written)) === (await realpath($, `${home}/.claude`))
  const key = isDefault ? 'default' : sha256(written).slice(0, 8)
  const labels = ((await $.store.get('accountLabels')) ?? {}) as Record<string, string>
  own = { key, dir: written, label: labels[key] || defaultLabel(key, written) }
  return own
}

const accountsDir = async ($: EngineInterface) => {
  const xdg = (await $.env.get('XDG_CONFIG_HOME')) || ''
  const home = await homeOf($)
  const base = xdg || (home ? `${home}/.config` : '')
  return base ? `${base.replace(/[\\/]+$/, '')}/claude-accounts` : undefined
}

const isoSec = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')

/**
 * Writes this session's 5h / 7d readings to its account file, atomically (tmp + rename), at most once a minute
 * unless `force`. Never throws: the status line must not depend on it.
 */
async function writeOwnReading($: EngineInterface, limits: Limit[], force = false): Promise<void> {
  if (writing) return
  writing = true
  try {
    const now = await $.clock.now()
    if (!force && now - lastWrite < 60_000) return
    const acc = await ownAccount($)
    const dir = await accountsDir($)
    const five = limits.find(l => l.kind === 'five_hour'), week = limits.find(l => l.kind === 'seven_day')
    if (!acc || !dir || (!five && !week)) return
    lastWrite = now
    if (!dirReady) {
      const r = await $.process.run(['mkdir', '-p', dir], { timeoutMs: 5000 })
      if (r.exitCode !== 0) return void miss('account file', `mkdir exit ${r.exitCode}`)
      dirReady = true
    }
    const win = (l: Limit | undefined) => (l ? { percent: l.percentUsed, ...(l.resetsAt ? { resets_at: l.resetsAt } : {}) } : undefined)
    const body = {
      version: 1, key: acc.key, config_dir: acc.dir, label: acc.label, at: isoSec(now),
      five_hour: win(five), seven_day: win(week),
    }
    const path = `${dir}/${acc.key}.json`
    const tmp = `${path}.${now}.tmp`
    await $.fs.write(tmp, `${JSON.stringify(body)}\n`)
    const mv = await $.process.run(['mv', '-f', tmp, path], { timeoutMs: 5000 })
    if (mv.exitCode !== 0) {
      await $.process.run(['rm', '-f', tmp], { timeoutMs: 5000 }).catch(() => null)
      miss('account file', `mv exit ${mv.exitCode}`)
    }
  } catch (err) {
    miss('account file', `threw: ${String(err).slice(0, 100)}`)
  } finally {
    writing = false
  }
}

/** A fresher reading of another account from the service, when its OAuth token is readable and unexpired; never refreshes a token. */
async function liveAccount($: EngineInterface, a: Account, configDir: string | undefined, now: number): Promise<Account> {
  if (!liveOn || now - a.at < CONFIG.accounts.liveAfterMs || now - (lastLive[a.key] ?? 0) < CONFIG.accounts.liveEveryMs) return a
  lastLive[a.key] = now
  try {
    const service = a.key === 'default' ? 'Claude Code-credentials' : `Claude Code-credentials-${a.key}`
    const kc = await $.process.run(['security', 'find-generic-password', '-s', service, '-w'], { timeoutMs: 5000 }).catch(() => null)
    let creds: Json | null = null
    try {
      if (kc && kc.exitCode === 0) creds = JSON.parse(kc.stdout)
    } catch {}
    if (!creds && configDir) creds = JSON.parse(String(await $.fs.read(`${configDir}/.credentials.json`).catch(() => 'null')))
    const o = creds?.claudeAiOauth as Json | undefined
    const exp = num(o?.expiresAt)
    if (typeof o?.accessToken !== 'string' || (exp !== undefined && exp <= now + 60_000)) return a
    const res = await $.http.fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { authorization: `Bearer ${o.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
    })
    if (!res.ok) return a
    const body = JSON.parse(res.text) as Json
    const win = (w: Json | null | undefined, label: string): Win | undefined =>
      num(w?.utilization) === undefined ? undefined : { label, percent: w!.utilization, resetsAt: typeof w!.resets_at === 'string' ? w!.resets_at : undefined }
    const five = win(body.five_hour, '5h'), week = win(body.seven_day, '7d')
    return five || week ? { ...a, at: now, five, week } : a
  } catch {
    return a
  }
}

/** The other accounts' readings, from their files (and live where possible); empty when there is none. */
async function readAccounts($: EngineInterface, now: number): Promise<Account[]> {
  const dir = await accountsDir($)
  const me = await ownAccount($)
  if (!dir) return []
  let entries: { name: string; kind: string }[]
  try {
    entries = await $.fs.list(dir)
  } catch {
    return []
  }
  const out: Account[] = []
  for (const e of entries) {
    if (e.kind === 'dir' || !e.name.endsWith('.json')) continue
    const key = e.name.slice(0, -5)
    if (key === me?.key) continue
    try {
      const j = JSON.parse(String(await $.fs.read(`${dir}/${e.name}`))) as Json
      if (j.version !== 1) continue
      const win = (w: Json | null | undefined, label: string): Win | undefined =>
        num(w?.percent) === undefined ? undefined : { label, percent: w!.percent, resetsAt: typeof w!.resets_at === 'string' ? w!.resets_at : undefined }
      const at = Date.parse(j.at)
      const a: Account = {
        key,
        label: typeof j.label === 'string' && j.label.trim() ? j.label.trim().slice(0, CONFIG.accounts.labelMax) : key,
        plan: typeof j.plan === 'string' ? j.plan : undefined,
        at: Number.isNaN(at) ? 0 : at,
        five: win(j.five_hour, '5h'), week: win(j.seven_day, '7d'),
      }
      out.push(await liveAccount($, a, typeof j.config_dir === 'string' ? j.config_dir : undefined, now))
    } catch {
      continue // a half-written or foreign file: not an account
    }
  }
  return out.sort((x, y) => x.label.localeCompare(y.label))
}

/** Re-reads the other accounts' files into the state (cheap: local files); a no-op while outside budgets are off. */
async function refreshAccounts($: EngineInterface): Promise<void> {
  try {
    if (!(await read($, quotas)).on) return
    const accounts = await readAccounts($, await $.clock.now())
    await update($, quotas, q => (JSON.stringify(q.accounts) === JSON.stringify(accounts) ? q : { ...q, accounts }))
  } catch (err) {
    miss('accounts', `threw: ${String(err).slice(0, 100)}`)
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
      codex: await readCodex($, now).catch(caught('codex')),
      agy: await readAgy($, now).catch(caught('agy')),
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
    if (savedLayout === 'auto' || savedLayout === 'one' || savedLayout === 'rows') await update($, layout, () => savedLayout)
    if (savedLayout === 'two') await update($, layout, () => 'rows')
    const savedQuotas = await $.store.get('quotasOn')
    if (typeof savedQuotas === 'boolean') await update($, quotas, q => ({ ...q, on: savedQuotas }))
    const savedLive = await $.store.get('accountsLive')
    if (typeof savedLive === 'boolean') liveOn = savedLive

    await $.command.register({
      name: 'status-line',
      description: 'Session status line: toggle, on | off, layout auto | one | rows, quotas on | off, account-label <name>, live on | off, or debug',
    })
    await Promise.all([refreshModel($), refreshUsage($), loadCompactions($)])
    void refreshQuotas($) // network and CLI calls: never hold up the session
    void refreshAccounts($)
    // Once a minute: advance the countdowns and catch model switches made
    // outside a turn. Cheap: one state write, one model read.
    $.clock.every(60_000, () => {
      void update($, tick, n => n + 1)
      void refreshModel($)
      void refreshQuotas($)
      void refreshAccounts($)
    })
    return next(e)
  })

  on('command.run', { command: 'status-line' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const named = /^account-label(?:\s+([\s\S]*))?$/i.exec(e.args.trim())
    if (named) {
      const acc = await ownAccount($)
      if (!acc) return { text: 'Cannot tell which Claude account this is (no HOME or CLAUDE_CONFIG_DIR).' }
      const asked = (named[1] ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
      if (!asked) {
        return { text: `This account (key ${acc.key}) shows as "${acc.label}" in other accounts' status lines. Change it with /status-line account-label <name>; "account-label reset" restores the default.` }
      }
      const labels = { ...(((await $.store.get('accountLabels')) ?? {}) as Record<string, string>) }
      if (asked.toLowerCase() === 'reset') delete labels[acc.key]
      else labels[acc.key] = asked.slice(0, CONFIG.accounts.labelMax)
      await $.store.set('accountLabels', labels)
      acc.label = labels[acc.key] ?? defaultLabel(acc.key, acc.dir)
      await writeOwnReading($, (await read($, usage)).limits ?? [], true)
      return { text: `This account (key ${acc.key}) is now labelled "${acc.label}".` }
    }
    if (arg === 'live on' || arg === 'live off') {
      liveOn = arg === 'live on'
      await $.store.set('accountsLive', liveOn)
      return { text: liveOn ? 'Other accounts: live read on (only when their saved reading is old and their login token is unexpired; tokens are never refreshed).' : 'Other accounts: live read off (saved readings only).' }
    }
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
          `. Account ${own ? `${own.key} "${own.label}"` : 'unknown'}, others: ${q.accounts.map(a => `${a.label} ${a.key} ${JSON.stringify({ ...a, label: undefined, key: undefined })}`).join('; ') || 'none'}` +
          (Object.keys(misses).length ? `. Last misses: ${Object.entries(misses).map(([k, v]) => `${k} ${v}`).join('; ')}` : ''),
      }
    }
    if (arg === 'quotas on' || arg === 'quotas off' || arg === 'quotas') {
      const isOn = arg !== 'quotas off'
      await update($, quotas, q => ({ ...q, on: isOn }))
      await $.store.set('quotasOn', isOn)
      if (isOn) {
        await refreshQuotas($, true)
        await refreshAccounts($)
      }
      const n = (await read($, quotas)).items.length
      const why = Object.entries(misses).map(([k, v]) => `${k}: ${v}`).join('; ')
      return {
        text: isOn
          ? `Outside budgets on (${n} found: Kiro, Copilot, Codex, Antigravity, Claude extra usage where logged in)${why ? `. Not read: ${why}` : ''}.`
          : 'Outside budgets off.',
      }
    }
    if (arg === 'auto' || arg === 'one' || arg === 'rows' || arg === 'two') {
      const mode: Layout = arg === 'two' ? 'rows' : arg
      await update($, layout, () => mode)
      await update($, enabled, () => true)
      await $.store.set('layout', mode)
      await $.store.set('enabled', true)
      return { text: `Session status line layout: ${mode}.` }
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
    if (e.rateLimits.length) await writeOwnReading($, e.rateLimits)
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
