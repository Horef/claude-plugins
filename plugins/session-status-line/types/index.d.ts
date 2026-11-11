// The state contract of session-status-line: layout, running stats and the usage figures mirrored from Claude Code.
/** Running totals this mod accumulates from the session's events. */
export type Stats = {
  /** Completed main-loop turns and compactions. */
  turns: number
  compactions: number
  /** Wall-clock length of the most recent main-loop turn, in ms. */
  lastTurnMs: number | null
  /** Distinct files touched by Edit / Write / NotebookEdit (capped list). */
  files: string[]
  /** The session model as `$.session.model()` reports it, and the one before a switch. */
  model: string | null
  prevModel: string | null
  /** The model id the API last reported answering with (fallback for display). */
  apiModel: string | null
  /** Thinking effort of the last main-loop request (`high`, or a token budget). */
  effort: string | number | null
  /** `turns` at the moment the model switched, or null if it never did. */
  switchedAtTurn: number | null
}

/** `auto`: one line when everything fits, else rows (Claude, helpers, the rest); `one` / `rows` force it. */
export type Layout = 'auto' | 'one' | 'rows'

/** One account rate-limit window (`five_hour`, `seven_day`, ...). */
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

/** The engine's own status-line figures, mirrored from `session.measure`. */
export type Usage = {
  tokens?: number
  window?: number
  percent?: number
  costUsd?: number
  startedAt?: number
  /** Rate-limit windows; empty off a subscription or before the first reading. */
  limits?: Limit[]
}

/** One rate-limit window of an account or of Codex: share used, when it resets, and its label (`5h`, `7d`, `30d`). */
export type Win = { label: string; percent: number; resetsAt?: string }

/**
 * One outside budget read by the mod itself: Kiro credits, Copilot premium
 * credits, Codex windows, Antigravity's 5h and weekly limits, or Claude's extra usage (the paid credits used past the 5h / weekly limits).
 */
export type Quota = {
  id: 'kiro' | 'copilot' | 'codex' | 'agy' | 'extra'
  /** What the segment is called (`Kiro`, `Copilot`, `Codex`). */
  label?: string
  /** Share of the period's allowance used; may pass 100 (overage). */
  percent?: number
  /** When the allowance resets (ISO). */
  resetsAt?: string
  /** Money spent past the allowance (Kiro overage charges, Claude extra usage), in `currency`. */
  spent?: number
  /** Claude extra usage: the monthly cap, in `currency`. */
  cap?: number
  currency?: string
  /** Codex: its rate-limit windows (5h and weekly on paid plans, a monthly one on the free plan). */
  windows?: Win[]
  /** Antigravity: per model group, the share used (percent) of its 5h and weekly limits. */
  groups?: { name: string; five?: number; week?: number; weekResetsAt?: string }[]
  /** The service's login has gone stale: ask the person to log in again. */
  login?: boolean
  /** When this reading was taken (epoch ms). */
  at: number
}

/** Another Claude account on this machine, as its own sessions last reported it (or a live read). */
export type Account = { key: string; label: string; plan?: string; at: number; five?: Win; week?: Win }

/** The last readings, and whether the mod reads them at all (`/status-line quotas on|off`). */
export type Quotas = { on: boolean; at: number; items: Quota[]; accounts: Account[] }

declare module 'claude-code' {
  interface PluginState {
    'session-status-line': { enabled: boolean; layout: Layout; stats: Stats; usage: Usage; tick: number; quotas: Quotas }
  }
}
