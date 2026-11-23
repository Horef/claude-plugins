// session-status-line: one compact row above the prompt showing activity,
// model + effort, context fill, rate limits (with reset and pace), cost,
// last turn time and a few cheap extras; outside budgets (Kiro, Copilot, Codex,
// Antigravity, Claude extra usage) read every few minutes where their logins exist,
// and the 5h / 7d limits of other Claude accounts on this machine (each account's
// sessions write their own readings to ${XDG_CONFIG_HOME:-~/.config}/claude-accounts/<key>.json).
// Rows: groups (Claude's own state; helper budgets; the session), each wrapping onto as many rows as it needs.
// Commands: `/status-line` toggles; `on|off`; `auto|one|rows` picks the layout;
// `help` is a one-minute tour; `update` checks for a newer release now (a quiet check also runs daily, after
// session.start) and puts an update request in the prompt box; `update-check on|off` controls the daily check
// (also off with CLAUDE_PLUGINS_NO_UPDATE_CHECK=1 and for checkouts). `quotas on|off` reads the outside budgets or not; `account-label <name>` names this
// account in the other accounts' status lines; `live on|off` lets it read other accounts' limits
// straight from the service; `warm [on|off|now|for <span>|until HH:MM|every <span>]` keeps the
// prompt cache warm while the chat waits (a side request, never added to the transcript); `debug` reports the
// version, measured width and the last quota readings. Env fallbacks: NO_COLOR=1
// drops colors, SESSION_STATUS_ASCII=1 swaps emoji/box glyphs for plain ASCII.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { CHECK_TIMEOUT_MS, UPDATING_URL, afterCheck, changelogUrl, dueForCheck, guideUrl, isDevInstall, isNewer, manifestUrl, shouldAnnounce, updateRequest, versionOfManifest } from './update'
import type { UpdateState } from './update'
import type { Account, Layout, Limit, Prefs, Quota, Quotas, Stats, Usage, Warm, Win } from '../types'

const MOD = 'session-status-line'

// ─── Tweak me ────────────────────────────────────────────────────────────
const CONFIG = {
  // Fill boundaries in percent (context window and rate limits): below `warn` is healthy.
  thresholds: { warn: 50, high: 75, crit: 90 },
  // Mid-tone hex colors chosen to keep at least 3:1 contrast on white,
  // off-white and dark backgrounds alike (plain ANSI yellow/cyan wash out on
  // light themes). Darker shades favour light themes, lighter ones dark.
  // 4.5:1 cannot hold on both off-white and dark (the best possible is about 3.8:1).
  colors: {
    ok: '#15803d', // green
    warn: '#a16207', // dark gold
    high: '#ea580c', // orange
    crit: '#dc2626', // red
    model: '#0891b2', // teal
    switched: '#c026d3', // magenta
  },
  icons: {
    working: '⏳', idle: '✅',
    switched: '⇄', effort: '·',
    barFull: '▰', barEmpty: '▱',
    reset: '⟳', pace: '⚠', turn: '⏱', files: '✎', compact: '🗜', warm: '🔥', info: 'ⓘ', sep: '  ┃  ',
  },
  // Used when SESSION_STATUS_ASCII is set (terminals without emoji fonts).
  asciiIcons: {
    working: '*', idle: '-',
    switched: '<>', effort: '/',
    barFull: '#', barEmpty: '.',
    reset: 'reset ', pace: '! ', turn: 'turn ', files: 'files ', compact: 'compacted ', warm: 'warm', info: '(i)', sep: ' || ',
  },
  // Proportional fonts (the desktop app) draw ▰▱ at uneven sizes; these stay even.
  desktopBar: { barFull: '●', barEmpty: '○' },
  barWidth: 6,
  // Default layout; `/status-line auto|one|rows` changes it and is remembered.
  layout: 'auto' as Layout,
  // Groups, each starting its own rows when the line does not fit (or `rows` is chosen) and
  // wrapping onto as many rows as it needs. A segment id not listed here is a helper budget,
  // so a new provider or account needs no change. `label` is shown at the left of the group's
  // first row (none for Claude's own row, which is the first).
  groups: [
    { name: 'claude', label: '', ids: ['head', 'ctx', 'ctxTokens', 'hint', 'limit5h', 'reset5h', 'pace5h', 'limit7d', 'reset7d', 'pace7d',
      'limitOther', 'resetOther', 'paceOther', 'extra'] },
    { name: 'helpers', label: 'helpers', ids: [] as string[] },
    { name: 'session', label: 'session', ids: ['cost', 'lastTurn', 'files', 'compactions', 'session', 'warm', 'warmOff'] },
  ],
  // Dim separator between two budgets inside a group; between groups on one line: the `sep` icon.
  gap: ' │ ',
  // Helper names are padded to the longest one (at most this many cells) so wrapped rows line up.
  nameMax: 10,
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
  // Segments dropped first when a line does not fit, or the rows exceed the band's height, in
  // order; an id several segments share (`acct`) drops one of them, the last, at a time.
  // Activity, model and the context bar are never dropped. A reset or pace
  // tag is listed before its limit, since it is glued to it.
  // Cache warmer: the cache lifetime assumed until a main-loop request reports one (1 h on a subscription),
  // the wait after the last main-loop request or warm (the minute tick may add up to a minute; a failed
  // warm is retried after `retryMs`, kept under the tick so the next tick takes it, while the cache
  // lives), how long the 🔥 button and `/status-line warm` run with no `for` / `until`, the shortest
  // `every`, and the rows the options row takes. A 5-minute cache is not warmed: a warm every 3 minutes
  // costs more within the hour than re-reading the chat once.
  warm: {
    panelRows: 3, // the options row's button rows; its status adds as many lines as it wraps to
    ttlMs: 60 * 60_000, everyMs: 50 * 60_000, retryMs: 45_000, defaultForMs: 12 * 3_600_000, minEveryMs: 2 * 60_000,
    // Earlier defaults of `everyMs` (0.9.0: 55 min): a chat whose wait is one of them was on the default.
    oldEveryMs: [55 * 60_000, 50 * 60_000],
    // Claude Code compacts an idle chat shortly before it expects the cache to lapse, timing from the last
    // turn: it cannot see a warm. While the warmer keeps the cache, such a compaction is declined, but only
    // after this much quiet and below this context fill, so a compaction a full context needs still runs.
    idleMs: 5 * 60_000, keepBelowPercent: 80,
    // Once the warmer stops (off, its end time, an error), the compaction it declined is owed: the mod runs
    // it itself this long before the cache lapses, as Claude Code would have, unless a message comes first.
    compactLeadMs: 5 * 60_000,
    // The mod's own idle compaction (the "Idle compaction" option, off by default): it takes the place of Claude
    // Code's, whose `idleCompaction` setting the person turns off because on a Team or Enterprise account the
    // built-in sec-default plugin sends every `session.compact` past the mods, so a decline never runs. Like
    // Claude Code's, it compacts a quiet chat of at least this many tokens before its 1 h cache lapses.
    idleMinTokens: 200_000,
    // A context that falls to this share of what it was, from at least `dropFromTokens`, was compacted (or
    // rewound): how a compaction is noticed where the session.compact hook never hears it.
    dropShare: 0.6, dropFromTokens: 20_000, dropQuietMs: 2 * 60_000,
    // A warm or the owed compaction that has not come back by then counts as failed (a dropped connection
    // can leave a request hanging). A failed warm or compaction is retried while the cache lives, never
    // after; a compaction that timed out is not (it may still finish).
    forkTimeoutMs: 2 * 60_000, compactTimeoutMs: 10 * 60_000,
    prompt: 'Automated cache keep-alive from the session-status-line mod, not a message from the person. ' +
      'You have no tools here and nothing to do: reply with the single word ok, straight away, without thinking it over.',
  },
  dropOrder: [
    'session', 'files', 'lastTurn', 'resetacct', 'resetcodex', 'resetargon', 'resetcopilot', 'resetkiro', 'cost', 'compactions', 'ctxTokens',
    'warmOff', 'acct', 'codex', 'agy', 'argon', 'copilot', 'kiro', 'reset7d', 'pace7d', 'limit7d', 'resetOther', 'paceOther', 'limitOther',
    'reset5h', 'hint', 'pace5h', 'extra', 'warm', 'limit5h',
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
const WARM_OFF: Warm = { on: false, everyMs: CONFIG.warm.everyMs, everySet: false, until: null, lastReqAt: null, lastWarmAt: null, retryAt: null, count: 0 }
const warm = atom({ plugin: 'session-status-line', key: 'warm' } as const, WARM_OFF)
const PREFS_OFF: Prefs = { everyChat: false, idleCompact: false }
const prefs = atom({ plugin: 'session-status-line', key: 'prefs' } as const, PREFS_OFF)

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
type Piece = { text: string; color?: string; dim?: boolean; bold?: boolean; press?: 'warm' | 'warmInfo' } // press: drawn as a plain Button
type Segment = { id: string; pieces: Piece[]; glue?: boolean } // glue: no separator before it

/** Money as "$2.37", "$59", or "12.40 EUR". */
const fmtMoney = (n: number, currency = 'USD') => {
  const v = n < 100 ? n.toFixed(2).replace(/\.00$/, '') : String(Math.round(n))
  return currency === 'USD' ? `$${v}` : `${v} ${currency}`
}

/** An old reading keeps its colour (dimming would wash out a warning) and gets a dim `~` before it instead. */
const stale = (old: boolean): Piece[] => (old ? [{ text: '~', dim: true }] : [])

/** ` 5h 21%`: a window's label and share used, colored by fill. */
const winPieces = (label: string, v: number | undefined, old: boolean): Piece[] => {
  if (v === undefined) return []
  const lv = level(v)
  return [{ text: ` ${label} `, dim: true }, ...stale(old), { text: `${Math.round(v)}%`, color: lv === 'ok' ? undefined : CONFIG.colors[lv], bold: lv === 'crit' }]
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
          ...stale(old),
          {
            text: fmtMoney(item.spent, item.currency) + (item.cap ? `/${fmtMoney(item.cap, item.currency)}` : ''),
            color: lv === 'ok' ? undefined : CONFIG.colors[lv],
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
          ...stale(old),
          { text: `${Math.round(argon.week)}%`, color: lv === 'ok' ? undefined : CONFIG.colors[lv], bold: lv === 'crit' },
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
      ...stale(old),
      { text: `${Math.round(item.percent)}%`, color: lv === 'ok' ? undefined : CONFIG.colors[lv], bold: lv === 'crit' },
    ]
    if (item.spent) pieces.push({ text: ` +${fmtMoney(item.spent, item.currency)}`, color: CONFIG.colors.crit, bold: true })
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

const buildSegments = (s: Stats, u: Usage, q: Quotas, isWorking: boolean, now: number, ic: Icons, w: Warm = WARM_OFF): Segment[] => {
  const out: Segment[] = []

  // Activity + model + effort (always shown).
  const isSwitched = s.switchedAtTurn !== null && s.turns - s.switchedAtTurn < CONFIG.switchHighlightTurns
  const model = shortModel(s.model) ?? shortModel(s.apiModel) ?? s.model?.slice(0, 18) ?? null
  const head: Piece[] = [{ text: isWorking ? ic.working : ic.idle }]
  if (model) {
    head.push({
      text: ` ${isSwitched ? `${ic.switched} ` : ''}${model}`,
      color: isSwitched ? CONFIG.colors.switched : CONFIG.colors.model,
      bold: isSwitched,
    })
  }
  if (s.effort !== null) {
    const tag = typeof s.effort === 'number' ? fmt(s.effort) : CONFIG.effortLabels[s.effort] ?? s.effort
    head.push({ text: ` ${ic.effort}${tag}`, dim: true })
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
        { text: 'ctx ', dim: true },
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
    out.push({ id: 'cost', pieces: [{ text: `$${u.costUsd < 10 ? u.costUsd.toFixed(2) : u.costUsd.toFixed(1)}`, dim: true }] })
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
      dim: s.compactions < CONFIG.compactWarnAt,
      color: s.compactions >= CONFIG.compactWarnAt ? CONFIG.colors.high : undefined,
    }],
  })

  // Session: turns, age.
  const session: string[] = []
  if (s.turns > 0) session.push(`${s.turns} turn${s.turns === 1 ? '' : 's'}`)
  if (u.startedAt !== undefined && now > u.startedAt) session.push(fmtSpan(Math.floor((now - u.startedAt) / 60_000) * 60_000))
  if (session.length > 0) out.push({ id: 'session', pieces: [{ text: session.join(' · '), dim: true }] })

  // Cache and warmer: the time the cache has left, the 🔥 toggle (lit, with the warms sent, when on) and ⓘ for
  // the options row. Orange when the warmer is on but the cache has lapsed or the last warm failed or found it gone.
  {
    const ends = cacheEnds(w)
    const lapsed = ends !== null && now >= ends
    // Badges about the last warm only until a real request renews the cache after it.
    const fresh = !!w.last && w.last.at >= (w.lastReqAt ?? 0)
    const cold = w.on && fresh && !w.last?.reason && w.last!.read < w.last!.wrote
    const failed = w.on && fresh && !!w.last?.reason && (w.retryAt ?? 0) > 0
    const alarm = w.on && (lapsed || cold || failed)
    const pieces: Piece[] = []
    if (ends !== null) {
      pieces.push({
        text: `cache ${lapsed ? 'lapsed' : fmtSpan(ends - now)}${cold ? ' cold' : failed ? ' !' : ''} `,
        dim: !alarm, color: alarm ? CONFIG.colors.high : undefined,
      })
    }
    pieces.push(w.on
      ? { text: `${ic.warm}${w.count}`, color: CONFIG.colors.model, press: 'warm' }
      : { text: ic.warm, dim: true, press: 'warm' })
    pieces.push({ text: ' ' }, { text: ic.info, dim: !w.open, color: w.open ? CONFIG.colors.model : undefined, press: 'warmInfo' })
    out.push({ id: w.on ? 'warm' : 'warmOff', pieces })
  }

  return out
}

// ─── Layout ───────────────────────────────────────────────────────────────
// A unit is a segment with the glued segments after it (a budget and its reset): it never splits.
type Unit = { group: string; segs: Segment[] }
type Line = Piece[]

/** The in-group separator, in ASCII when icons are (SESSION_STATUS_ASCII). */
const gapText = () => (icons === CONFIG.asciiIcons ? ' | ' : CONFIG.gap)

const groupOf = (id: string) => CONFIG.groups.find(g => g.ids.includes(id))?.name ?? 'helpers'
const piecesWidth = (ps: Piece[]) => ps.reduce((w, p) => w + cells(p.text), 0)
const unitPieces = (u: Unit) => u.segs.flatMap(s => s.pieces)

const toUnits = (segs: Segment[]): Unit[] => {
  const out: Unit[] = []
  for (const seg of segs) {
    const last = out[out.length - 1]
    if (seg.glue && last) last.segs.push(seg)
    else out.push({ group: groupOf(seg.id), segs: [seg] })
  }
  return out
}

/** Without the last segment of this id (and, if it heads a unit, the segments glued to it). */
const dropOne = (segs: Segment[], id: string): Segment[] => {
  const at = segs.map(s => s.id).lastIndexOf(id)
  if (at < 0) return segs
  let end = at + 1
  if (!segs[at].glue) while (end < segs.length && segs[end].glue) end++
  return [...segs.slice(0, at), ...segs.slice(end)]
}

/** Everything on one line: budgets apart by `gap`, groups apart by the `sep` icon. */
const oneLine = (segs: Segment[]): Line => {
  const line: Line = []
  let prev: string | undefined
  for (const u of toUnits(segs)) {
    if (prev !== undefined) line.push(u.group === prev ? { text: gapText(), dim: true } : { text: icons.sep, dim: true })
    line.push(...unitPieces(u))
    prev = u.group
  }
  return line
}

/** Drops segments in CONFIG.dropOrder until `ok` holds (or nothing more can go). */
const dropUntil = (segs: Segment[], ok: (s: Segment[]) => boolean): Segment[] => {
  let kept = segs
  for (const id of CONFIG.dropOrder) {
    while (!ok(kept)) {
      const next = dropOne(kept, id)
      if (next === kept) break
      kept = next
    }
    if (ok(kept)) break
  }
  return kept
}

/** A helper unit with its name padded to `nameW` cells, so the figures after it line up. */
const padName = (u: Unit, nameW: number): Piece[] => {
  const ps = unitPieces(u)
  const name = ps[0]?.text.trimEnd() ?? ''
  const pad = nameW - cells(name)
  if (pad <= 0) return ps
  return [{ ...ps[0], text: ps[0].text.replace(name, name + ' '.repeat(pad)) }, ...ps.slice(1)]
}

/**
 * The grouped rows: each group starts a row with its label and wraps onto as many rows as it needs.
 * On the terminal (a monospaced grid) helper budgets sit in equal columns, so wrapped rows line up.
 */
const groupRows = (segs: Segment[], columns: number, grid: boolean): Line[] => {
  const units = toUnits(segs)
  const used = CONFIG.groups.filter(g => units.some(u => u.group === g.name))
  const labelW = Math.max(0, ...used.filter(g => g.label).map(g => cells(g.label) + 2))
  const lines: Line[] = []
  for (const g of used) {
    const mine = units.filter(u => u.group === g.name)
    const indent = g.label ? labelW : 0
    const avail = Math.max(10, columns - indent)
    let cellsOf = mine.map(unitPieces)
    let colW = 0
    if (grid && g.name === 'helpers') {
      const nameW = Math.min(CONFIG.nameMax, Math.max(...mine.map(u => cells(unitPieces(u)[0]?.text.trimEnd() ?? ''))))
      cellsOf = mine.map(u => padName(u, nameW))
      colW = Math.max(...cellsOf.map(piecesWidth))
      if (colW > avail) colW = 0
    }
    let row: Line = []
    let w = 0
    const flush = () => {
      const lead = indent ? [{ text: (lines.length === firstOf ? g.label : '').padEnd(indent), dim: true }] : []
      lines.push([...lead, ...row])
      row = []
      w = 0
    }
    const firstOf = lines.length
    for (const c of cellsOf) {
      const cw = colW || piecesWidth(c)
      const gap = cells(gapText())
      if (row.length && w + gap + cw > avail) flush()
      if (row.length) {
        row.push({ text: gapText(), dim: true })
        w += gap
      }
      const padTo = colW - piecesWidth(c)
      row.push(...c, ...(colW && padTo > 0 ? [{ text: ' '.repeat(padTo) }] : []))
      w += cw
    }
    if (row.length) flush()
  }
  // Trailing padding is invisible and would only make lines look wider than they are.
  return lines.map(l => {
    const last = l[l.length - 1]
    return last && !last.text.trim() && l.length > 1 ? l.slice(0, -1) : l
  })
}

/** One line when it all fits (or is forced, or the band has one row), else the grouped rows within the band's height. */
const toLines = (segs: Segment[], columns: number, mode: Layout, maxRows: number, grid: boolean): Line[] => {
  const one = (x: Segment[]) => piecesWidth(oneLine(x)) <= columns
  if (maxRows < 2 || mode === 'one' || (mode === 'auto' && one(segs))) return [oneLine(dropUntil(segs, one))]
  const fits = (x: Segment[]) => {
    const rows = groupRows(x, columns, grid)
    return rows.length <= maxRows && rows.every(r => piecesWidth(r) <= columns)
  }
  return groupRows(dropUntil(segs, fits), columns, grid).slice(0, maxRows)
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

/** Programs a CLI may call to open a login page in the browser (macOS, Linux desktops, WSL). */
const BROWSER_OPENERS = ['open', 'xdg-open', 'x-www-browser', 'www-browser', 'sensible-browser', 'gio', 'wslview']

/**
 * The argv prefix that runs `cmd` with no browser opener on its PATH, or null when `cmd` is not installed.
 * When agy cannot refresh its login (offline, DNS down, login expired), `agy -p` starts a browser login with
 * `open`, even without a terminal: every poll of every session opened a Safari window (issue #89, 2026-11-16:
 * 87 of 168 reads in one morning). Without an opener the read just fails and the next poll tries again; a
 * working login reads as before. `cmd` is found on this process's PATH, then in `extra` (the installer's
 * spot, for a GUI launch whose PATH lacks it), and run by its full path with the same PATH minus every
 * folder that holds an opener (on macOS that is /usr/bin, whose tools agy calls by full path).
 */
async function noBrowserRun($: EngineInterface, cmd: string, extra: string[]): Promise<string[] | null> {
  const dirs = [...((await $.env.get('PATH')) ?? '').split(':'), ...extra].filter(d => d.startsWith('/'))
  const has = (p: string) => $.fs.exists(p).catch(() => false)
  let exe: string | null = null
  for (const d of dirs) if (await has(`${d}/${cmd}`)) { exe = `${d}/${cmd}`; break }
  if (!exe) return null
  const keep: string[] = []
  for (const d of [...new Set(dirs)]) {
    const opener = await Promise.all(BROWSER_OPENERS.map(o => has(`${d}/${o}`)))
    if (!opener.some(Boolean)) keep.push(d)
  }
  return ['/usr/bin/env', `PATH=${keep.join(':')}`, exe]
}

/**
 * Antigravity: each model group's 5h and weekly remaining share, from `agy -p /usage`
 * (a local command that answers without a model turn; measured 2026-11-09).
 */
async function readAgy($: EngineInterface, now: number): Promise<Quota | null> {
  const home = await $.env.get('HOME')
  const run = await noBrowserRun($, 'agy', home ? [`${home}/.local/bin`] : [])
  if (!run) return miss('agy', 'agy not installed')
  const r = await $.process.run([...run, '-p', '/usage', '--output-format', 'json'], { timeoutMs: 60_000 }).catch(() => null)
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

// ─── Cache warmer ────────────────────────────────────────────────────────
// While on, a side request over the main conversation (`$.model.fork`: the main thread's last request
// with one message after it, answered and dropped, never added to the transcript) reads the prompt
// cache `everyMs` after the last main-loop request or warm, which renews the cache's lifetime. A chat
// that waits hours for background work then resumes from the cache instead of paying for the whole
// conversation again. The fork names no effort, so it rides the main thread's cache on every model.

const ttlOf = (w: Warm) => w.ttlMs ?? CONFIG.warm.ttlMs

/** The wait before a warm: the person's own choice, or else the current default (which a new version may change). */
const everyOf = (w: Warm) => (w.everySet ? w.everyMs : CONFIG.warm.everyMs)

/**
 * State from before 0.10.2 has no `everySet`: a wait equal to an old default was the default (and now follows
 * the current one); any other was chosen and stays.
 */
export const migrateWarm = (w: Warm): Warm => {
  if (w.everySet !== undefined) return w
  const chosen = !CONFIG.warm.oldEveryMs.includes(w.everyMs) && w.everyMs !== CONFIG.warm.everyMs
  return { ...w, everySet: chosen, everyMs: chosen ? w.everyMs : CONFIG.warm.everyMs }
}

/** When the cache was last renewed: the later of the last main-loop request and the last warm; 0 when unknown. */
const renewedAt = (w: Warm) => Math.max(w.lastReqAt ?? 0, w.lastWarmAt ?? 0)

/** When the cache lapses (its lifetime from the last renewal), or null when nothing is known to be cached. */
const cacheEnds = (w: Warm): number | null => {
  const base = renewedAt(w)
  return base ? base + ttlOf(w) : null
}

/** A 5-minute cache is not worth warming (see CONFIG.warm). */
const shortCache = (w: Warm) => ttlOf(w) < CONFIG.warm.minEveryMs * 3

/** When the next warm is due, or null when there is nothing to warm (no request yet, the cache lapsed, or it is a 5-minute one). */
const warmDue = (w: Warm, now: number): number | null => {
  const ends = cacheEnds(w)
  if (ends === null || now >= ends || shortCache(w)) return null
  return Math.max(renewedAt(w) + Math.min(everyOf(w), ttlOf(w) - CONFIG.warm.minEveryMs), w.retryAt ?? 0)
}

/** An "Every chat" warmer has rested: 12 h (defaultForMs) since the chat's last message. */
const autoRested = (w: Warm, now: number) =>
  !!w.auto && w.lastReqAt !== null && now - w.lastReqAt >= CONFIG.warm.defaultForMs

/** The warmer keeps the cache now: on, before its end time, and (switched on for every chat) not rested. */
const keeps = (w: Warm, now: number) => w.on && (w.until === null || now < w.until) && !autoRested(w, now)

// Module-local, so a reload starts them over (harmless: a reload drops any fork in flight with its module):
// one warm at a time; main-loop requests in flight (no warm then: the request renews the cache itself);
// and an epoch that /clear, /resume, a compaction and a model switch move on, so a warm that was in
// flight across one of them does not write its result over the new chat's.
let warming = false
let inFlight = 0
let epoch = 0

/** Forget what is cached (a new chat, a compaction, another model): the warmer waits for the next request. */
const forgetCache = ($: EngineInterface, extra: Partial<Warm> = {}) => {
  epoch++
  return update($, warm, w => ({ ...w, lastReqAt: null, lastWarmAt: null, retryAt: null, last: undefined, owesCompact: false, ...extra }))
}

/** API errors worth retrying: overload, server trouble, rate limits, a dropped connection. */
const transient = (r: { status: number | null; error: string }) =>
  r.status === null || ['overloaded', 'server_error', 'rate_limit', 'unknown'].includes(r.error)

/**
 * Warm now if due; stop once `until` has passed. Called from the minute tick. `once` (from `warm now`)
 * warms whatever the switch, the end time or the timing say, without switching the warmer on.
 * A lapsed cache is not warmed on schedule (that would pay a full cache write); the next real request
 * starts the countdown again. A scheduled warm that finds the cache gone switches the warmer off.
 */
const maybeWarm = async ($: EngineInterface, once = false): Promise<string> => {
  if (warming) return 'A warm is already running.'
  warming = true
  try {
    const w = await read($, warm)
    const now = await $.clock.now()
    if (!once) {
      if (!w.on) return 'Warmer off.'
      if (w.until !== null && now >= w.until) {
        const after = await update($, warm, cur => ({ ...cur, on: false, stoppedAt: now }))
        void $.ui.toast(`Cache warmer stopped: its end time passed (${w.count} warm${w.count === 1 ? '' : 's'} sent).${debtNote(after, now)}`)
        return 'Warmer off: its end time passed.'
      }
      // Warms kept failing (no connection, the service down) until the cache lapsed: stop, owe nothing.
      const ends = cacheEnds(w)
      if (w.retryAt !== null && ends !== null && now >= ends) {
        await update($, warm, cur => ({ ...cur, on: false, retryAt: null, owesCompact: false, stoppedAt: now }))
        void $.ui.toast(`Cache warmer stopped: no warm got through before the cache lapsed (${w.last?.reason ?? 'no answer'}). Nothing will be compacted; your next message reads the chat afresh.`)
        return 'Warmer off: the cache lapsed while warms failed.'
      }
      if (autoRested(w, now)) return 'Not due: 12 hours since the last message.'
      const due = warmDue(w, now)
      if (due === null || now < due || inFlight > 0) return 'Not due.'
    }
    const myEpoch = epoch
    const sentAt = now // a cache lifetime counts from the request's start
    let r: Awaited<ReturnType<EngineInterface['model']['fork']>>
    try {
      // A fork that hangs (a dropped connection) must not hold the warmer: past the time limit it counts as
      // a failed warm with no response, retried while the cache lives; a late answer is ignored.
      const limit = $.clock.sleep(CONFIG.warm.forkTimeoutMs).then(() => 'timeout' as const)
      const raced = await Promise.race([$.model.fork({ prompt: CONFIG.warm.prompt }), limit])
      if (raced === 'timeout') throw new Error('timeout')
      r = raced
    } catch (err) {
      r = { isAnswered: false, reason: 'api-error', status: null, error: 'unknown', usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } as any
      void err
    }
    if (epoch !== myEpoch) return 'The chat changed while the warm ran; its result was dropped.'
    const at = await $.clock.now()
    const used = 'usage' in r && r.usage ? r.usage : null
    // Any request that read the cache renewed it, answered in words or not (an empty reply, an abort).
    if (used && (r.isAnswered || used.cache_read_input_tokens > 0)) {
      const last = { at: sentAt, read: used.cache_read_input_tokens, wrote: used.cache_creation_input_tokens, out: used.output_tokens }
      const gone = last.read < last.wrote
      await update($, warm, cur => ({
        ...cur, lastWarmAt: sentAt, retryAt: null, count: cur.count + 1, last,
        on: gone && !once ? false : cur.on, owesCompact: gone ? false : cur.owesCompact,
        stoppedAt: gone && !once ? at : cur.stoppedAt,
      }))
      if (gone && !once) {
        void $.ui.toast('Cache warmer stopped: the warm found the cache already gone (paid a full write). It renews at your next message.')
      }
      return `Warmed: the cache served ${fmt(last.read)} tokens${last.wrote ? `, ${fmt(last.wrote)} written afresh` : ''}, ${fmt(last.out)} out.`
    }
    if (!r.isAnswered && r.reason === 'nothing-to-fork') {
      await update($, warm, cur => ({ ...cur, retryAt: null, last: { at, read: 0, wrote: 0, reason: 'nothing to warm yet' } }))
      return 'Not warmed: nothing to warm yet (no request since the chat started).'
    }
    const reason = !r.isAnswered && r.reason === 'api-error' ? `api-error ${r.status ?? 'no response'} ${r.error}` : r.isAnswered ? 'no usage reported' : r.reason
    const retry = !r.isAnswered && r.reason === 'api-error' ? transient(r) : !r.isAnswered && r.reason !== 'aborted' ? false : true
    await update($, warm, cur => ({
      ...cur, retryAt: retry ? at + CONFIG.warm.retryMs : null, on: retry || once ? cur.on : false,
      owesCompact: retry || once ? cur.owesCompact : false, // a warmer stopped by an error compacts nothing
      stoppedAt: retry || once ? cur.stoppedAt : at,
      last: { at, read: 0, wrote: 0, reason },
    }))
    if (!retry && !once) void $.ui.toast(`Cache warmer stopped: ${reason}.`)
    return `Not warmed: ${reason}${retry ? '; trying again shortly' : ''}.`
  } finally {
    warming = false
  }
}

/**
 * Whether an `auto` compaction now is Claude Code's idle one, made needless by the warmer: the warmer is on
 * and keeps a live cache, no main-loop request is in flight or recent, and the context is far from full.
 */
const keepingCache = async ($: EngineInterface): Promise<boolean> => {
  const w = await read($, warm)
  const now = await $.clock.now()
  if (!keeps(w, now) || warmDue(w, now) === null || inFlight > 0) return false
  if (now - (w.lastReqAt ?? 0) < CONFIG.warm.idleMs) return false
  return ((await read($, usage)).percent ?? 0) < CONFIG.warm.keepBelowPercent
}

/** A compaction replaced the main conversation: count it; the cache is forgotten until the next request. */
let lastCountAt = 0 // when a compaction was last counted, so the context's drop after it is not counted again
let measureCalmUntil = 0 // a new or resumed chat's first readings: a smaller context there is no compaction
let lastTokens: number | null = null // the main context's size at the last reading, for noticing a compaction

const countCompaction = async ($: EngineInterface) => {
  lastCountAt = await $.clock.now()
  const s = await update($, stats, cur => ({ ...cur, compactions: cur.compactions + 1 }))
  await saveCompactions($, s.compactions)
  await forgetCache($) // the summary is cached by the next request, not before
  await refreshUsage($)
}

/**
 * When the mod runs the idle compaction it declined: once the warmer has stopped, `compactLeadMs` before the
 * cache lapses; null when nothing is owed, the warmer still keeps the cache, or the cache is already gone.
 */
const compactDue = (w: Warm, now: number): number | null => {
  if (!w.owesCompact || keeps(w, now)) return null
  const ends = cacheEnds(w)
  return ends === null || now >= ends ? null : ends - CONFIG.warm.compactLeadMs
}

let compacting = false
let ownCompactSeen = false // the mod's own compaction reached its session.compact hook (and was counted there)

/** From the minute tick: run the owed idle compaction when it is due and no request is running. */
let compactNotBefore = 0 // after a failed attempt: the next try, a retry pause later
let compactFailedAt = 0 // the last failed attempt, so only the first failure of a debt is announced

const maybeCompact = async ($: EngineInterface): Promise<void> => {
  if (compacting || inFlight > 0) return
  const w = await read($, warm)
  const now = await $.clock.now()
  const ends = cacheEnds(w)
  const keeping = keeps(w, now)
  // Owed, but the cache has lapsed (every attempt failed, or the computer slept through the window):
  // a compaction now would pay for a fresh read of the whole chat, so it is dropped.
  if (w.owesCompact && !keeping && ends !== null && now >= ends) {
    await update($, warm, cur => ({ ...cur, owesCompact: false }))
    void $.ui.toast('Idle compaction skipped: the cache lapsed before it could run. Your next message reads the chat afresh.')
    return
  }
  const due = compactDue(w, now)
  if (due === null || now < Math.max(due, compactNotBefore)) return
  compacting = true
  ownCompactSeen = false
  try {
    const limit = $.clock.sleep(CONFIG.warm.compactTimeoutMs).then(() => 'timeout' as const)
    const r = await Promise.race([$.session.compact({}), limit]) // trigger `plugin`
    await update($, warm, cur => ({ ...cur, owesCompact: false }))
    if (r === 'timeout') {
      void $.ui.toast('Idle compaction gave no answer in 10 minutes; not tried again.')
      return
    }
    // Counted by the session.compact hook when it hears the mod's own call; otherwise here.
    if (!ownCompactSeen && !('skip' in r && r.skip)) await countCompaction($)
  } catch (err) {
    // No connection, the service down, a turn starting: try again in a moment while the cache lives.
    const at = await $.clock.now()
    if (compactFailedAt < renewedAt(w)) {
      void $.ui.toast(`Idle compaction failed (${String((err as Error)?.message ?? err).slice(0, 80)}); trying again while the cache lasts.`)
    }
    compactFailedAt = at
    compactNotBefore = at + CONFIG.warm.retryMs
  } finally {
    compacting = false
  }
}

/** After the warmer stops: when the owed compaction runs and how to keep the chat as it is. */
const debtNote = (w: Warm, now: number): string => {
  const due = compactDue(w, now)
  return due === null ? '' : ` The chat compacts at ${fmtClock(Math.max(due, now))} unless you write first; "Skip compaction" in ⓘ (or /status-line warm skip-compact) keeps it as it is.`
}

// ─── Options for every chat: "Every chat" warmer, the mod's idle compaction ──
// Kept in the store, so every chat reads them; each chat reads them again each minute, so a change made
// in one reaches the others within a minute.

let idleMinTokens: number = CONFIG.warm.idleMinTokens // CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS, as Claude Code reads it

/** Read the options and Claude Code's own idle compaction setting; switch this chat's warmer to match. */
const loadPrefs = async ($: EngineInterface) => {
  const [everyChat, idleCompact] = await Promise.all([$.store.get('warmEveryChat'), $.store.get('idleCompact')])
  const cc = await $.settings.read({ key: 'idleCompaction' }).catch(() => undefined)
  await update($, prefs, p => {
    const next: Prefs = { everyChat: everyChat === true, idleCompact: idleCompact === true, ccIdle: cc !== false }
    return p.everyChat === next.everyChat && p.idleCompact === next.idleCompact && p.ccIdle === next.ccIdle ? p : next
  })
  await applyAuto($)
}

/**
 * "Every chat": switch on a chat's warmer unless the person switched it off here, or it stopped itself
 * (an error, a lapse) and no message came since; with the option off, switch off what it switched on.
 */
const applyAuto = async ($: EngineInterface) => {
  const p = await read($, prefs)
  await update($, warm, w => {
    if (p.everyChat && !w.on && !w.optedOut && (w.stoppedAt == null || (w.lastReqAt ?? 0) > w.stoppedAt)) {
      return { ...w, on: true, auto: true, until: null, retryAt: null, count: 0, stoppedAt: null }
    }
    if (!p.everyChat && w.on && w.auto) return { ...w, on: false, auto: false }
    return w
  })
}

/** Whether the mod's own idle compaction applies to this chat now: the option on and the context large enough. */
const idleOwed = async ($: EngineInterface) =>
  (await read($, prefs)).idleCompact && ((await read($, usage)).tokens ?? 0) >= idleMinTokens

/**
 * Notice a compaction from the context's size, for where the session.compact hook never hears one (sec-default
 * sends the event past every mod): a context that falls to 60% or less of what it was. A rewind looks the same.
 */
const noticeDrop = async ($: EngineInterface, tokens: number | undefined, agentless: boolean) => {
  if (!agentless || tokens === undefined) return
  const before = lastTokens
  lastTokens = tokens
  const now = await $.clock.now()
  if (before === null || before < CONFIG.warm.dropFromTokens || tokens > before * CONFIG.warm.dropShare) return
  if (now < measureCalmUntil || now - lastCountAt < CONFIG.warm.dropQuietMs || compacting) return
  await countCompaction($)
}

/** The options' words for status: what "Every chat" and "Idle compaction" do now, and Claude Code's own. */
const prefsNote = (p: Prefs): string =>
  (p.everyChat ? ' Every chat: the warmer switches on in each chat (until 12h after its last message).' : '') +
  (p.idleCompact
    ? ` Idle compaction on: a quiet chat of ${fmt(idleMinTokens)} tokens or more compacts 5 minutes before its cache lapses, unless the warmer keeps it.`
    : ' Idle compaction off: the mod never compacts a quiet chat.') +
  (p.ccIdle !== false
    ? ' Claude Code\'s own idle compaction is on ("idleCompaction" in settings.json); on a Team or Enterprise account no mod can decline it, so it compacts a quiet chat about 54 minutes after the last message whatever the warmer does. Set "idleCompaction": false to leave it to these options.'
    : '')

/** "50m", "8h", "1.5h", "90" (minutes unless `unit` says hours) → ms; null when unreadable. */
const parseSpan = (text: string, unit: 'm' | 'h'): number | null => {
  const hm = /^(\d+)\s*h\s*(\d+)\s*m$/i.exec(text.trim()) // "1h30m", as fmtSpan prints it
  if (hm) return Number(hm[1]) * 3_600_000 + Number(hm[2]) * 60_000
  const m = /^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?)?$/i.exec(text.trim())
  if (!m) return null
  const n = Number(m[1])
  const hours = m[2] ? /^h/i.test(m[2]) : unit === 'h'
  return Math.round(n * (hours ? 3_600_000 : 60_000))
}

/** "07:30" or "7" → the next time the clock shows it (local time), in epoch ms; null when unreadable. */
const parseClock = (text: string, now: number): number | null => {
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(text.trim())
  if (!m || Number(m[1]) > 23 || Number(m[2] ?? 0) > 59) return null
  const d = new Date(now)
  d.setHours(Number(m[1]), Number(m[2] ?? 0), 0, 0)
  if (d.getTime() <= now) d.setDate(d.getDate() + 1)
  return d.getTime()
}

const fmtClock = (t: number) => {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const lifeOf = (w: Warm) => {
  const ttl = ttlOf(w)
  return `${ttl % 3_600_000 === 0 ? `${ttl / 3_600_000}h` : fmtSpan(ttl)} cache${w.ttlMs === undefined ? ' (assumed)' : ''}`
}

/** The cache alone: "Cache: 42m left (1h cache, from the last request at 21:10)." or why there is none. */
const cacheStatus = (w: Warm, now: number): string => {
  const ends = cacheEnds(w)
  if (ends === null) return 'Cache: nothing known cached (no request seen since the chat started, a /clear, a compaction or a model switch).'
  const from = w.lastWarmAt !== null && w.lastWarmAt >= (w.lastReqAt ?? 0) ? 'warm' : 'request'
  const life = `${lifeOf(w)}, from the last ${from} at ${fmtClock(renewedAt(w))}`
  return now < ends ? `Cache: ${fmtSpan(ends - now)} left (${life}).` : `Cache: lapsed ${fmtSpan(now - ends)} ago (${life}); the next message re-reads the whole chat.`
}

const lastOf = (w: Warm, now: number) =>
  !w.last ? '' : ` Last warm ${fmtSpan(now - w.last.at)} ago: ${w.last.reason ?? `cache served ${fmt(w.last.read)} tokens${w.last.wrote ? `, wrote ${fmt(w.last.wrote)}` : ''}${w.last.out !== undefined ? `, ${fmt(w.last.out)} out` : ''}`}.`

const nextOf = (w: Warm, now: number): string => {
  const due = warmDue(w, now)
  if (due !== null) return due <= now ? 'now' : `in ${fmtSpan(due - now)}`
  if (shortCache(w)) return 'none: a 5-minute cache costs more to keep warm than to re-read'
  return cacheEnds(w) === null ? 'after the next message' : 'after the next message (the cache has lapsed)'
}

/** The idle compactions declined in the latest quiet stretch, and the one owed. */
const compactOf = (w: Warm, now: number): string => {
  const n = w.declines?.length ?? 0
  const declined = n ? ` Idle compaction declined ${n}× (${w.declines!.map(fmtClock).join(', ')}).` : ''
  const due = compactDue(w, now)
  return declined + (due === null ? '' : ` The chat compacts at ${fmtClock(Math.max(due, now))} unless a message comes first.`)
}

const warmStatus = (w: Warm, now: number, p?: Prefs): string => {
  const opts = p ? prefsNote(p) : ''
  if (!w.on) return `${cacheStatus(w, now)} Warmer off.${lastOf(w, now)}${compactOf(w, now)}${opts}`
  const end = w.auto
    ? autoRested(w, now) ? 'for every chat, resting (12h since the last message)' : 'for every chat, until 12h after the last message'
    : w.until === null ? 'until switched off' : `until ${fmtClock(w.until)} (${fmtSpan(Math.max(0, w.until - now))} from now)`
  return `${cacheStatus(w, now)} Warmer on ${end}, ${fmtSpan(everyOf(w))}${w.everySet ? '' : ' (default)'} after each request or warm; next warm ${nextOf(w, now)}; ${w.count} sent.${lastOf(w, now)}${compactOf(w, now)}${opts}`
}

/**
 * Lay the parts out on as many lines as `width` cells need, breaking only between parts (a part wider
 * than the line gets a line of its own and the Text wraps it).
 */
const wrapStatus = (parts: string[], width: number): string[] => {
  const lines: string[] = []
  for (const p of parts) {
    const last = lines[lines.length - 1]
    if (last !== undefined && cells(`${last} · ${p}`) <= width) lines[lines.length - 1] = `${last} · ${p}`
    else lines.push(p)
  }
  return lines
}

/** The options row's status: the cache and the warmer's state, wrapped to the band's width. */
const panelStatus = (w: Warm, now: number, width = Infinity): string[] => {
  const ends = cacheEnds(w)
  const cache = ends === null ? 'Nothing known cached' : now < ends ? `Cache ${fmtSpan(ends - now)} left of ${lifeOf(w)}` : `${lifeOf(w)} lapsed`
  const due = compactDue(w, now)
  const compacts = due === null ? [] : [`compacts at ${fmtClock(Math.max(due, now))}`]
  if (!w.on) return wrapStatus([cache, 'warmer off', ...compacts], width)
  const end = w.auto ? (autoRested(w, now) ? 'resting, 12h since the last message' : 'for every chat') : w.until === null ? 'until switched off' : `until ${fmtClock(w.until)}`
  const parts = [cache, `warmer on ${end}`, `next warm ${nextOf(w, now)}`]
  if (w.last) parts.push(w.last.reason ? `last: ${w.last.reason}` : `${w.count} sent, last served ${fmt(w.last.read)}`)
  return wrapStatus(parts, width)
}

const WARM_HELP = '/status-line warm [on | off | now | forever | for 8h | until 07:30 | every 50m | every default | every-chat on|off | idle-compact on|off | skip-compact | status]'

/** `/status-line warm ...`: switch on or off, set the end or the interval, warm once now, or report. */
const warmCommand = async ($: EngineInterface, args: string): Promise<string> => {
  const now = await $.clock.now()
  const cur = await read($, warm)
  const [verb = '', ...rest] = args.trim().split(/\s+/)
  const value = rest.join(' ')
  // Switching on never invents a request time: with none seen, the warmer waits for the next message.
  // The person's own choice replaces what "Every chat" set; switching off keeps "Every chat" out of this chat.
  const on = (until: number | null) =>
    update($, warm, w => ({ ...w, on: true, until, retryAt: null, count: w.on ? w.count : 0, auto: false, optedOut: false }))
  const off = async () =>
    `Warmer off. ${cacheStatus(cur, now)}${debtNote(await update($, warm, w => ({ ...w, on: false, auto: false, optedOut: true })), now)}`
  const onOff = /^(on|off)$/i.exec(value)?.[1]?.toLowerCase()
  switch (verb.toLowerCase()) {
    case '':
      if (cur.on) return off()
      await on(now + CONFIG.warm.defaultForMs)
      break
    case 'on':
      await on(now + CONFIG.warm.defaultForMs)
      break
    case 'off':
      return off()
    case 'every-chat': {
      if (!onOff) return 'Usage: /status-line warm every-chat on | off.'
      await $.store.set('warmEveryChat', onOff === 'on')
      // Asked for here, so it holds here too, whatever this chat's own switch said before.
      if (onOff === 'on') await update($, warm, w => (w.on ? w : { ...w, optedOut: false, stoppedAt: null }))
      await loadPrefs($)
      return onOff === 'on'
        ? `Every chat: on. Each chat's warmer switches on by itself and warms until 12h after its last message; switching it off in a chat keeps it off there. ${warmStatus(await read($, warm), now)}`
        : 'Every chat: off. Warmers it switched on are off; ones you switched on yourself stay as they are.'
    }
    case 'idle-compact': {
      if (!onOff) return 'Usage: /status-line warm idle-compact on | off.'
      await $.store.set('idleCompact', onOff === 'on')
      await loadPrefs($)
      // This quiet stretch follows the new choice at once: owed if the chat is large enough and still cached.
      const owe = onOff === 'on' && cacheEnds(cur) !== null && now < cacheEnds(cur)! && (await idleOwed($))
      await update($, warm, w => ({ ...w, owesCompact: owe || (onOff === 'on' && !!w.owesCompact) }))
      return `${prefsNote(await read($, prefs)).trim()}${debtNote(await read($, warm), now)}`
    }
    case 'skip-compact':
      if (!cur.owesCompact) return 'No compaction is waiting.'
      await update($, warm, w => ({ ...w, owesCompact: false }))
      return 'The idle compaction is skipped: the chat stays as it is (its cache lapses unless you write or the warmer warms).'
    case 'forever':
      await on(null)
      break
    case 'for': {
      const span = parseSpan(value, 'h')
      if (!span) return 'Usage: /status-line warm for <span>, e.g. "for 8h", "for 90m" or "for 1h30m".'
      await on(now + span)
      break
    }
    case 'until': {
      const t = parseClock(value, now)
      if (t === null) return 'Usage: /status-line warm until HH:MM (local time; the next time the clock shows it).'
      await on(t)
      break
    }
    case 'every': {
      if (/^default$/i.test(value)) {
        await update($, warm, w => ({ ...w, everyMs: CONFIG.warm.everyMs, everySet: false }))
        break
      }
      const span = parseSpan(value, 'm')
      const max = ttlOf(cur) - CONFIG.warm.minEveryMs
      if (!span || span < CONFIG.warm.minEveryMs || span > max) {
        return `Usage: /status-line warm every <minutes>, from ${CONFIG.warm.minEveryMs / 60_000} to ${max / 60_000} with a ${lifeOf(cur)} (default ${CONFIG.warm.everyMs / 60_000}).`
      }
      // The default's own value is no choice: it follows the default if a later version changes it.
      await update($, warm, w => ({ ...w, everyMs: span, everySet: span !== CONFIG.warm.everyMs }))
      break
    }
    case 'now': {
      // One warm, whatever the switch says; it does not switch the warmer on.
      const said = await maybeWarm($, true)
      return `${said} ${warmStatus(await read($, warm), await $.clock.now())}`
    }
    case 'status':
      return warmStatus(await read($, warm), now, await read($, prefs))
    case 'help':
      return `Cache warmer: ${WARM_HELP}. The 🔥 button switches it on for ${fmtSpan(CONFIG.warm.defaultForMs)} or off; ⓘ opens its options. every-chat: each chat's warmer switches on by itself (until 12h after its last message). idle-compact (off by default): the mod compacts a quiet chat of ${fmt(idleMinTokens)} tokens or more 5 minutes before its cache lapses, in place of Claude Code's idle compaction.`
    default:
      return `Usage: ${WARM_HELP}.`
  }
  return warmStatus(await read($, warm), now)
}

// ─── Help, welcome and update check ──────────────────────────────────────
const HELP = [
  'Status line: one line above the prompt with model, context fill, 5h and weekly limits, cost and more.',
  '  /status-line                    switch it on or off (also: on | off)',
  '  /status-line auto | one | rows  layout: one line, or two when narrow (auto)',
  '  /status-line quotas on | off    also show Kiro, Copilot, Codex and your other Claude accounts',
  '  /status-line warm               keep the prompt cache warm while the chat waits (warm help: options)',
  '  /status-line update             check for a newer version and update it from here',
  '  /status-line update-check off   stop the quiet daily check for updates (on: resume)',
  `Guide: ${guideUrl(MOD)}`,
].join('\n')

/** A checkout or --plugin-dir (never checks, never offers an update); CLAUDE_PLUGINS_UPDATE_CHECK_FORCE=1 lets the tests act as a cache install. */
const devInstall = async ($: EngineInterface): Promise<boolean> =>
  isDevInstall($.plugin.root) && (await $.env.get('CLAUDE_PLUGINS_UPDATE_CHECK_FORCE')) !== '1'

/** The installed version, read from this plugin's own plugin.json (undefined when it cannot be read). */
const installedVersion = async ($: EngineInterface): Promise<string | undefined> => {
  try {
    const v = (JSON.parse(String(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`))) as { version?: unknown }).version
    return typeof v === 'string' ? v : undefined
  } catch {
    return undefined
  }
}

const loadUpdate = async ($: EngineInterface): Promise<UpdateState> => {
  const s = await $.store.get('update')
  return s && typeof s === 'object' ? (s as UpdateState) : {}
}

/** Off by `/status-line update-check off` or the environment (strict organizations). */
const updateCheckOff = async ($: EngineInterface): Promise<boolean> =>
  (await $.store.get('updateCheck')) === false || (await $.env.get('CLAUDE_PLUGINS_NO_UPDATE_CHECK')) === '1'

/** The version in the published manifest; undefined on any failure or after 5 s (never throws). */
const fetchLatest = async ($: EngineInterface): Promise<string | undefined> => {
  try {
    const res = await Promise.race([$.http.fetch(manifestUrl(MOD)), $.clock.sleep(CHECK_TIMEOUT_MS).then(() => undefined)])
    return res && res.ok ? versionOfManifest(res.text) : undefined
  } catch {
    return undefined
  }
}

type Checked = { installed?: string; state: UpdateState; ran: boolean; dev: boolean }
/**
 * Asks GitHub for the latest version and stores the answer (per Claude account). Unless `force`, only when the
 * check is on, due and this is a cache install. The stamp is written before the request (as a failure), so chats
 * starting together make one request, and stays that way when the request fails: that is the back-off.
 */
const runCheck = async ($: EngineInterface, force: boolean): Promise<Checked> => {
  const installed = await installedVersion($)
  const state = await loadUpdate($)
  if (await devInstall($)) return { installed, state, ran: false, dev: true }
  if (!force && (!installed || (await updateCheckOff($)) || !dueForCheck(await $.clock.now(), state))) return { installed, state, ran: false, dev: false }
  await $.store.set('update', afterCheck(state, await $.clock.now(), undefined))
  const latest = await fetchLatest($)
  const next = afterCheck(await loadUpdate($), await $.clock.now(), latest) // others' changes since (a dismissal) are kept
  await $.store.set('update', next)
  return { installed, state: next, ran: true, dev: false }
}

/** After session.start, never awaited: a quiet check, and one toast per new version. */
const backgroundCheck = async ($: EngineInterface) => {
  const { installed, state, ran } = await runCheck($, false)
  if (!ran || !installed || !shouldAnnounce(state, installed)) return
  await $.store.set('update', { ...(await loadUpdate($)), toasted: state.latest })
  void $.ui.toast(`${MOD} ${state.latest} is available: /status-line update`, { timeoutMs: 10_000 })
}

const updateCommand = async ($: EngineInterface, sub: string): Promise<string> => {
  if (sub !== '' && sub !== 'dismiss') return 'Usage: /status-line update (check now, and fill the prompt with an update request) or /status-line update dismiss (stop announcing the latest version).'
  if (await devInstall($)) return `${MOD} runs from a folder here (a checkout or --plugin-dir), not from the plugin cache, so it does not update itself: update the folder with git. How updating works: ${UPDATING_URL}`
  if (sub === 'dismiss') {
    const state = await loadUpdate($)
    const installed = await installedVersion($)
    if (!state.latest || !isNewer(state.latest, installed)) return 'No newer version is known, so there is nothing to dismiss.'
    await $.store.set('update', { ...state, dismissed: state.latest })
    return `Dismissed ${state.latest}: it is not announced again; a later version is. /status-line update still offers it.`
  }
  const { installed, state } = await runCheck($, true)
  const have = installed ?? 'unknown'
  if (state.lastOk === false) return `${MOD} ${have} is installed. Could not read the latest version from GitHub (offline, or blocked here); try again later. How updating works: ${UPDATING_URL}`
  if (!isNewer(state.latest, installed)) return `${MOD} ${have} is installed; the latest is ${state.latest}: up to date.`
  const request = updateRequest(MOD)
  const filled = await $.prompt.fill({ text: request, mode: 'replace' }).catch(() => undefined)
  return [
    `${MOD} ${have} is installed; the latest is ${state.latest}.`,
    filled?.isFilled ? 'The update request is in your prompt box: press Enter and Claude does the rest.' : `Send this to Claude to update: ${request}`,
    `What's new: ${changelogUrl(MOD)}`,
    `How updating works: ${UPDATING_URL}`,
  ].join('\n')
}

const updateCheckCommand = async ($: EngineInterface, sub: string): Promise<string> => {
  if (sub === 'on' || sub === 'off') {
    await $.store.set('updateCheck', sub === 'on')
    return sub === 'on' ? 'Daily update check on.' : 'Daily update check off. /status-line update still checks when you ask.'
  }
  const env = (await $.env.get('CLAUDE_PLUGINS_NO_UPDATE_CHECK')) === '1'
  const on = (await $.store.get('updateCheck')) !== false
  return `Daily update check: ${on && !env ? 'on' : 'off'}${env ? ' (CLAUDE_PLUGINS_NO_UPDATE_CHECK=1)' : ''}${(await devInstall($)) ? '; not used for a checkout or --plugin-dir' : ''}. Change it with /status-line update-check on | off.`
}

// ─── Hooks ───────────────────────────────────────────────────────────────
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // A store with nothing in it: this mod has never run here (an upgrading user's store is not empty).
    const fresh = await $.store.keys().then(k => k.length === 0, () => false)
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
      description: 'Session status line: help, toggle, on | off, layout auto | one | rows, quotas on | off, account-label <name>, live on | off, warm [on | off | now | for 8h | until 07:30 | every 50m], update [dismiss], update-check on | off, or debug',
    })
    // A chat keeps its warmer state across a reload: one on an earlier version's default wait follows the
    // current default from now on (a warm already overdue by it goes at the next tick); a chosen wait stays.
    await update($, warm, migrateWarm)
    const minTokens = Number(await $.env.get('CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS'))
    idleMinTokens = Number.isFinite(minTokens) && minTokens > 0 ? Math.max(100_000, minTokens) : CONFIG.warm.idleMinTokens
    measureCalmUntil = (await $.clock.now()) + CONFIG.warm.dropQuietMs
    lastTokens = null
    await Promise.all([refreshModel($), refreshUsage($), loadCompactions($)])
    await loadPrefs($).catch(() => {})
    void refreshQuotas($) // network and CLI calls: never hold up the session
    void refreshAccounts($)
    if (fresh) {
      await $.store.set('welcomed', true)
      void $.ui.toast('Status line on. /status-line help for a 1-minute tour.', { timeoutMs: 8000 })
    }
    void backgroundCheck($).catch(() => {}) // quiet: a failed check shows nothing
    // Once a minute: advance the countdowns and catch model switches made
    // outside a turn. Cheap: one state write, one model read.
    $.clock.every(60_000, () => {
      void update($, tick, n => n + 1)
      void refreshModel($)
      void refreshQuotas($)
      void refreshAccounts($)
      // The options first (another chat may have changed them), then a warm or compaction they allow.
      void loadPrefs($).catch(() => {}).then(() => Promise.all([maybeWarm($).catch(() => {}), maybeCompact($).catch(() => {})]))
    })
    return next(e)
  })

  on('command.run', { command: 'status-line' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'help') return { text: `${HELP}\nVersion ${(await installedVersion($)) ?? 'unknown'}.` }
    if (arg === 'update' || arg.startsWith('update ')) return { text: await updateCommand($, arg.slice(6).trim()) }
    if (arg === 'update-check' || arg.startsWith('update-check ')) return { text: await updateCheckCommand($, arg.slice(12).trim()) }
    if (arg === 'warm' || arg.startsWith('warm ')) return { text: await warmCommand($, e.args.trim().slice(4)) }
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
      const VERSION = (await installedVersion($)) ?? 'unknown'
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
          (Object.keys(misses).length ? `. Last misses: ${Object.entries(misses).map(([k, v]) => `${k} ${v}`).join('; ')}` : '') +
          ` ${warmStatus(await read($, warm), await $.clock.now())}`,
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
    if (e.agentId) return yield* next(e)
    // A main-loop request that reached the cache renews it from its start; its cache write says for how
    // long (1 h or 5 min). A request with no response renews nothing. No warm runs while one is in flight.
    const sentAt = await $.clock.now()
    const myEpoch = epoch
    inFlight++
    try {
      const res = yield* next(e)
      const u = res.usage
      if (u && epoch === myEpoch && (u.cache_read_input_tokens > 0 || u.cache_creation_input_tokens > 0)) {
        const ttlMs = (u.ephemeral_1h_input_tokens ?? 0) > 0 ? 3_600_000 : (u.ephemeral_5m_input_tokens ?? 0) > 0 ? 300_000 : undefined
        // A message starts a new quiet stretch: the mod's own idle compaction is owed in it when that option is
        // on and the chat is large enough; one Claude Code tried before is not (it times from this request too).
        const owe = await idleOwed($)
        await update($, warm, w => ({ ...w, lastReqAt: Math.max(sentAt, w.lastReqAt ?? 0), retryAt: null, owesCompact: owe, ttlMs: ttlMs ?? w.ttlMs }))
        await applyAuto($) // "Every chat" resumes a warmer that stopped itself
      }
      return res
    } finally {
      inFlight = Math.max(0, inFlight - 1)
    }
  })

  // A resumed chat: its cache may still live, counted from its last response; a model switch forfeits it.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'resume' || e.source === 'fork') {
      const now = await $.clock.now()
      measureCalmUntil = now + CONFIG.warm.dropQuietMs // another chat's size is no compaction
      lastTokens = null
      const ago = e.seconds_since_last_response
      await forgetCache($, ago !== undefined && !e.prompt_cache_likely_expired ? { lastReqAt: now - ago * 1000 } : {})
    }
    return next(e)
  })
  on('classic.PostModelSwitch', async ($, e, next) => {
    if (e.from_model !== e.to_model) await forgetCache($, { ttlMs: e.cache_ttl === '5m' ? 300_000 : 3_600_000 })
    return next(e)
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
    if (compacting && e.trigger === 'plugin') ownCompactSeen = true
    if (!e.agentId && e.trigger === 'auto' && (await keepingCache($))) {
      // Kept per quiet stretch, so `warm status` shows whether Claude Code tries again; the compaction is
      // owed and runs once the warmer stops (maybeCompact).
      const at = await $.clock.now()
      await update($, warm, w => ({
        ...w, owesCompact: true, declines: [...(w.declines ?? []).filter(t => t >= (w.lastReqAt ?? 0)), at].slice(-10),
      }))
      return { skip: 'the status-line cache warmer is keeping the cache warm (/status-line warm off allows it)' }
    }
    const result = await next(e)
    if (!e.agentId && e.trigger !== 'precompute' && !('skip' in result && result.skip)) {
      await countCompaction($)
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
    await noticeDrop($, e.context.tokens, true)
    return next(e)
  })

  // /clear starts a fresh conversation in the same process: reset totals.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear' || e.reason === 'resume') {
      await update($, stats, s => ({ ...EMPTY, model: s.model, apiModel: s.apiModel, effort: s.effort }))
      // The warmer belongs to the chat: the next one starts with it off and nothing known cached.
      epoch++
      await update($, warm, w => ({ ...WARM_OFF, ttlMs: w.ttlMs, open: w.open }))
      measureCalmUntil = (await $.clock.now()) + CONFIG.warm.dropQuietMs // a fresh chat is no compaction
      lastTokens = null
      await refreshUsage($)
      await applyAuto($) // "Every chat" holds for the new chat too
    }
    const result = await next(e)
    if (e.reason === 'resume') await loadCompactions($) // the resumed chat's own count
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, enabled))) return next(e)

    const [s, u, mode, q, w, p] = await Promise.all([read($, stats), read($, usage), read($, layout), read($, quotas), read($, warm), read($, prefs)])
    await read($, tick) // subscribe so the countdowns redraw each minute
    const now = await $.clock.now()
    const ic = e.surface !== 'terminal' && icons === CONFIG.icons ? { ...icons, ...CONFIG.desktopBar } : icons
    // The warmer's options row takes its rows first while it is open; the status rows get the rest.
    const statusLines = w.open ? panelStatus(w, now, Math.max(10, e.props.bodyColumns - 1)) : []
    const panelRows = w.open ? CONFIG.warm.panelRows + statusLines.length : 0
    const lines = toLines(buildSegments(s, u, q, e.props.isWorking, now, ic, w), Math.max(10, e.props.bodyColumns - 1), mode, Math.max(1, e.props.maxRows - panelRows), e.surface === 'terminal')
    lastDraw = { surface: e.surface, bodyColumns: e.props.bodyColumns, maxRows: e.props.maxRows, widths: lines.map(piecesWidth) }
    if (lines.length === 0) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const toggleWarm = async () => {
      const said = await warmCommand($, '')
      void $.ui.toast(said)
    }
    const toggleInfo = () => update($, warm, cur => ({ ...cur, open: !cur.open }))
    const pressOf = (press: Piece['press']) => (press === 'warm' ? toggleWarm : toggleInfo)
    // A choice in the options row: bold in the accent colour when it is the current one, dim otherwise.
    const choice = (key: string, label: string, args: string, isOn = false) => (
      <Button key={key} plain onPress={() => warmCommand($, args)}>
        <Text bold={isOn} dimColor={!isOn} color={isOn && !noColor ? CONFIG.colors.model : undefined}>{label}</Text>
      </Button>
    )
    const label = (key: string, text: string) => <Text key={key} dimColor>{text}</Text>
    const ttl = ttlOf(w)
    const panel = !w.open ? null : (
      <Box key="warm-panel" flexDirection="column">
        {statusLines.map((line, i) => <Text key={`warm-status-${i}`} wrap="wrap" dimColor>{line}</Text>)}
        <Box key="warm-row1" flexDirection="row" flexWrap="wrap" columnGap={1}>
          {label('w-l1', 'Warmer')}
          {choice('w-on', 'On', 'on', w.on)}
          {choice('w-off', 'Off', 'off', !w.on)}
          {label('w-l2', ' For')}
          {choice('w-2h', '2h', 'for 2h')}
          {choice('w-4h', '4h', 'for 4h')}
          {choice('w-8h', '8h', 'for 8h')}
          {choice('w-12h', '12h', 'for 12h')}
          {choice('w-inf', '∞', 'forever', w.on && w.until === null)}
          <Button key="w-until" plain onPress={() => $.prompt.fill({ text: '/status-line warm until ' })}><Text dimColor>until…</Text></Button>
          {label('w-l3', ' ')}
          {choice('w-now', 'Warm now', 'now')}
        </Box>
        <Box key="warm-row2" flexDirection="row" flexWrap="wrap" columnGap={1}>
          {label('w-l4', 'Every')}
          {[30, 40, 50].filter(m => m * 60_000 <= ttl - CONFIG.warm.minEveryMs)
            .map(m => choice(`w-e${m}`, `${m}m`, `every ${m}m`, everyOf(w) === m * 60_000))}
          {compactDue(w, now) !== null && (
            <Button key="w-skipc" plain onPress={() => warmCommand($, 'skip-compact')}><Text dimColor> Skip compaction</Text></Button>
          )}
          {label('w-l6', ' more: /status-line warm help')}
          <Button key="w-close" plain role="dismiss" onPress={toggleInfo}><Text dimColor>×</Text></Button>
        </Box>
        <Box key="warm-row3" flexDirection="row" flexWrap="wrap" columnGap={1}>
          {label('w-l7', 'Every chat')}
          {choice('w-auto-off', 'Off', 'every-chat off', !p.everyChat)}
          {choice('w-auto-on', 'On', 'every-chat on', p.everyChat)}
          {label('w-l8', ' Idle compaction')}
          {choice('w-idle-off', 'Off', 'idle-compact off', !p.idleCompact)}
          {choice('w-idle-on', 'On', 'idle-compact on', p.idleCompact)}
          {/* Claude Code's own idle compaction overrides both where no mod can decline it (warm status says more). */}
          {p.ccIdle !== false && label('w-l9', " · Claude Code's own is on: /status-line warm status")}
        </Box>
      </Box>
    )
    return (
      <Box flexDirection="column">
        {lines.map((line, l) => (
          <Box key={`l${l}`} flexDirection="row">
            {line.map((p, i) => {
              const text = (
                <Text key={`p${l}-${i}`} wrap="truncate" color={noColor ? undefined : p.color} dimColor={p.dim} bold={p.bold}>
                  {p.text}
                </Text>
              )
              return p.press
                ? <Button key={p.press} plain onPress={pressOf(p.press)}>{text}</Button>
                : text
            })}
          </Box>
        ))}
        {panel}
      </Box>
    )
  })
}
