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

/** `auto`: one line when everything fits, else two; `one` / `two` force it. */
export type Layout = 'auto' | 'one' | 'two'

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

declare module 'claude-code' {
  interface PluginState {
    'session-status-line': { enabled: boolean; layout: Layout; stats: Stats; usage: Usage; tick: number }
  }
}
