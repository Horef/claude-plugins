// session-status-line: one compact row above the prompt showing activity,
// model + effort, context fill, rate limits (with reset and pace), cost,
// last turn time and a few cheap extras.
// Commands: `/status-line` toggles; `on|off`; `auto|one|two` picks the layout;
// `debug` reports the version and measured width. Env fallbacks: NO_COLOR=1
// drops colors, SESSION_STATUS_ASCII=1 swaps emoji/box glyphs for plain ASCII.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Layout, Limit, Stats, Usage } from '../types'

const VERSION = '0.3.0' // keep in step with plugin.json; `/status-line debug` reports it

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
  // Segments dropped first when a line does not fit, in order.
  // Activity, model and the context bar are never dropped. A reset or pace
  // tag must be listed before its limit, since it is glued to it.
  dropOrder: [
    'session', 'files', 'lastTurn', 'cost', 'compactions', 'ctxTokens',
    'reset7d', 'pace7d', 'limit7d', 'resetOther', 'paceOther', 'limitOther',
    'reset5h', 'hint', 'pace5h', 'limit5h',
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

// Read once per load in session.start.
let noColor = false
// What the last draw measured, for `/status-line debug` (module-local, display only).
let lastDraw: { surface: string; bodyColumns: number; maxRows: number; widths: number[] } | null = null
type Icons = Record<keyof typeof CONFIG.icons, string>
let icons: Icons = CONFIG.icons

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

const buildSegments = (s: Stats, u: Usage, isWorking: boolean, now: number, ic: Icons): Segment[] => {
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

// ─── Hooks ───────────────────────────────────────────────────────────────
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    noColor = (await $.env.get('NO_COLOR')) !== undefined
    icons = (await $.env.get('SESSION_STATUS_ASCII')) ? CONFIG.asciiIcons : CONFIG.icons
    const saved = await $.store.get('enabled')
    if (typeof saved === 'boolean') await update($, enabled, () => saved)
    const savedLayout = await $.store.get('layout')
    if (savedLayout === 'auto' || savedLayout === 'one' || savedLayout === 'two') await update($, layout, () => savedLayout)

    await $.command.register({
      name: 'status-line',
      description: 'Session status line: toggle, on | off, layout auto | one | two, or debug',
    })
    await Promise.all([refreshModel($), refreshUsage($), loadCompactions($)])
    // Once a minute: advance the countdowns and catch model switches made
    // outside a turn. Cheap: one state write, one model read.
    $.clock.every(60_000, () => {
      void update($, tick, n => n + 1)
      void refreshModel($)
    })
    return next(e)
  })

  on('command.run', { command: 'status-line' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'debug') {
      const d = lastDraw
      return {
        text: d
          ? `session-status-line ${VERSION}: surface ${d.surface}, band ${d.bodyColumns} columns × ${d.maxRows} rows, ` +
            `layout ${await read($, layout)}, ${d.widths.length} line(s) of ${d.widths.join(' + ')} columns`
          : `session-status-line ${VERSION}: not drawn yet`,
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

    const [s, u, mode] = await Promise.all([read($, stats), read($, usage), read($, layout)])
    await read($, tick) // subscribe so the countdowns redraw each minute
    const now = await $.clock.now()
    const ic = e.surface !== 'terminal' && icons === CONFIG.icons ? { ...icons, ...CONFIG.desktopBar } : icons
    const lines = toLines(buildSegments(s, u, e.props.isWorking, now, ic), Math.max(10, e.props.bodyColumns - 1), mode, e.props.maxRows)
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
