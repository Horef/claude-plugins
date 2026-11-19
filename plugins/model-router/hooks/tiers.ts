// Default tiers, model prices, the escalation ladder and other constants of model-router.
import type { Effort, Model, ModelTag, Price, Settings, Tier } from '../types'

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
  expandAll: false,
  openGroups: [],
  // Off by default: without it the rules, the plan tool and the pane are those of 0.9.3.
  helpers: {
    enabled: false,
    skill: 'herdr-delegate',
    use: 'long',
    tiers: {
      light: 'kiro-light,copilot-light,agy-light',
      standard: 'kiro-standard,copilot-standard,agy-standard',
      deep: 'kiro-deep,copilot-deep,agy-deep',
    },
    fusion: 'off',
    script: '',
    kinds: {},
    run: 'auto',
  },
  hereEffort: { enabled: false, maxContext: 40_000 },
  kinds: {},
  kindTags: {},
  autoRoute: false,
  // Auto mode changes routing without asking, so it wants more evidence than the advice does.
  autoMinRuns: 5,
  autoOkPercent: 90,
  models: [],
  prices: {},
  log: true,
  herdrView: true,
}

// Spend presets: the three tiers' model and effort in one choice (Settings → Basics). Balanced is the shipped default;
// tiers that match none show as Custom.
export const PRESETS: { id: string; label: string; tiers: Record<Tier, { model: Model; effort: Effort }> }[] = [
  { id: 'thrifty', label: 'Thrifty', tiers: { light: { model: 'haiku', effort: 'low' }, standard: { model: 'sonnet', effort: 'low' }, deep: { model: 'opus', effort: 'medium' } } },
  { id: 'balanced', label: 'Balanced', tiers: { light: { model: 'haiku', effort: 'low' }, standard: { model: 'sonnet', effort: 'medium' }, deep: { model: 'opus', effort: 'high' } } },
  { id: 'best', label: 'Best quality', tiers: { light: { model: 'haiku', effort: 'high' }, standard: { model: 'sonnet', effort: 'high' }, deep: { model: 'opus', effort: 'high' } } },
]

// Context limits offered for here-step effort, in tokens.
export const EFFORT_LIMITS = [20_000, 40_000, 80_000, 150_000]

// Copilot Fusion templates (herdr-delegate) and the pinned Copilot template each goes before:
// both draw on Copilot's quota, so after it Fusion would never be reached.
export const FUSION: Partial<Record<Tier, { template: string; before: string }>> = {
  standard: { template: 'copilot-fusion-high', before: 'copilot-standard' },
  deep: { template: 'copilot-fusion-max', before: 'copilot-deep' },
}

export const TIER_USE: Record<Tier, string> = {
  light: 'mechanical work with a clear rule: cross-checking documents, finding and listing, extracting values, scanning logs or outputs',
  standard: 'following detailed instructions: writing and editing code to a spec, figures and slides, summarizing papers, web research',
  deep: 'open judgment: research and design decisions, debugging unclear failures, reviewing reasoning',
}

export const TIER_ORDER: Tier[] = ['light', 'standard', 'deep']
// The default models; Settings and usage add more (an open list, see knownModels in logic.ts).
export const MODELS: Model[] = ['haiku', 'sonnet', 'opus', 'fable']
export const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// The escalation ladder a rerun climbs: more thinking first, then a bigger model. With more
// models known, the ladder is built from them by price (ladderOf in logic.ts); with only these, it is this one.
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

// The thinking levels a model the defaults do not know gets on the ladder.
export const NEW_MODEL_RUNGS: Effort[] = ['medium', 'high']

// Dollars per million tokens, first-party API list prices as of October 2026.
// Cache writes are the 5-minute rate (1.25x input). Estimates only. Settings can change them and price new models.
export const PRICES: Record<string, Price> = {
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

// The strengths a kind of work wants, as model tags (notes.ts has the vocabulary): what a model's note must carry to be suggested for it.
// Settings → Learning overrides a kind (Settings.kindTags). A kind not listed matches by its own words (KIND_WORDS).
export const KIND_TAGS: Record<string, ModelTag[]> = {
  'write-code': ['code'],
  'code-review': ['review', 'careful'],
  review: ['review', 'careful'],
  'code-read': ['careful', 'long-context'],
  'cross-check': ['careful', 'long-context'],
  'web-research': ['research'],
  research: ['research'],
  'literature-research': ['research'],
  'design-review': ['judgment'],
  design: ['judgment'],
  'research-assistant': ['judgment'],
  summarize: ['long-context', 'fast'],
  'eval-run': ['agentic'],
  sweep: ['agentic'],
}

// Words in a kind's name that stand for a strength, for a kind KIND_TAGS does not list.
export const KIND_WORDS: [string, ModelTag][] = [
  ['review', 'review'],
  ['research', 'research'],
  ['code', 'code'],
]

// Learned advice: how many runs it needs, and the shares that move a kind or tier a rung.
// (Auto mode has its own thresholds, in Settings: autoMinRuns and autoOkPercent.)
export const LEARN = { minRuns: 3, weakShare: 0.5, overkillShare: 0.5, recent: 3 }
