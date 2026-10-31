// Default tiers, model prices, the escalation ladder and other constants of model-router.
import type { Effort, Model, Settings, Tier } from '../types'

// Defaults only: the pane's Settings change them, remembered across sessions.
// Aliases track the newest release, so a new model version needs no edit here.
export const DEFAULT_SETTINGS: Settings = {
  tiers: {
    light: { model: 'haiku', effort: 'low', scopeNote: false },
    standard: { model: 'sonnet', effort: 'medium', scopeNote: false },
    deep: { model: 'opus', effort: 'high', scopeNote: false },
  },
  skills: {},
  openPane: false,
}

export const TIER_USE: Record<Tier, string> = {
  light: 'mechanical work with a clear rule: cross-checking documents, finding and listing, extracting values, scanning logs or outputs',
  standard: 'following detailed instructions: writing and editing code to a spec, figures and slides, summarizing papers, web research',
  deep: 'open judgment: research and design decisions, debugging unclear failures, reviewing reasoning',
}

export const TIER_ORDER: Tier[] = ['light', 'standard', 'deep']
export const MODELS: Model[] = ['haiku', 'sonnet', 'opus', 'fable']
export const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// The escalation ladder a rerun climbs: more thinking first, then a bigger model.
export const LADDER: { model: Model; effort: Effort }[] = [
  { model: 'haiku', effort: 'low' },
  { model: 'haiku', effort: 'medium' },
  { model: 'haiku', effort: 'high' },
  { model: 'sonnet', effort: 'medium' },
  { model: 'sonnet', effort: 'high' },
  { model: 'opus', effort: 'high' },
  { model: 'opus', effort: 'xhigh' },
  { model: 'fable', effort: 'high' },
]

// Dollars per million tokens, first-party API list prices as of October 2026.
// Cache writes are the 5-minute rate (1.25x input). Estimates only.
export const PRICES: Record<Model, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  haiku: { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
  sonnet: { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
  opus: { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
  fable: { input: 10, cacheWrite: 12.5, cacheRead: 0.25, output: 50 },
}

// What a delegated brief gets when its tier's scope note is on.
export const SCOPE_NOTE =
  'Scope: do only the task above and return what it asks for. Do not start other sessions, hand the task off, or load tools it does not need.'

// A finished step counts as mostly start-up cost when it wrote little but read a lot.
export const SETUP_HEAVY = { maxOutput: 2000, minRead: 20000 }
