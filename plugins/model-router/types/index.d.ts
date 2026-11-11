// The state contract of model-router: plan steps, settings, history, cost totals and rule delivery.
/** A model family alias (haiku, sonnet, opus, fable, or one seen in usage or added in Settings), or an id kept as it came. */
export type Model = string
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type Tier = 'light' | 'standard' | 'deep'
export type PlanStatus = 'none' | 'pending' | 'approved'

/** Token counts as the API reports them, summed over a step's turns. */
export type Usage = { input: number; cacheWrite: number; cacheRead: number; output: number }

/** Dollars per million tokens. */
export type Price = { input: number; cacheWrite: number; cacheRead: number; output: number }

/** A model and a thinking level: one rung of the ladder. */
export type Rung = { model: Model; effort: Effort }

/** How the lead judged a delegated step's result. ok: used as returned or with small edits; weak: needed a rerun,
 *  part redone, or a substantive error found; overkill: plainly mechanical work that ran above the light tier. */
export type Verdict = 'ok' | 'weak' | 'overkill'

export type TierSetting = { model: Model; effort: Effort; scopeNote: boolean }

/** Where a step runs: 'agent' a Claude subagent, 'here' the main chat, 'helper' an agent on another subscription. */
export type Where = 'agent' | 'here' | 'helper'

/** Optional helpers: agents on other subscriptions, started through a delegation skill. */
export type HelperSettings = {
  enabled: boolean
  /** The delegation skill the main chat loads to start a helper. */
  skill: string
  /** 'long': only long self-contained steps; 'all': every self-contained step. */
  use: 'long' | 'all'
  /** Per tier, the helper templates to try in order, comma-separated. */
  tiers: Record<Tier, string>
  /** Copilot Fusion, opt-in: 'deep' adds Fusion Max to the deep order, 'both' also Fusion High to standard. */
  fusion: 'off' | 'deep' | 'both'
  /** Path to herdr-delegate's helpers.py; empty: the newest installed herdr-delegate skill is used. */
  script: string
  /** Per kind of work, the helper model the router launches (set by applying the history's advice): wins over the tier order. */
  kinds: Record<string, HelperChoice>
}

/** A helper provider (kiro, copilot, agy) with a model and a thinking level, as helpers.py takes them. */
export type HelperChoice = { provider: string; model: string; effort: string }

/** One tier of a provider in helpers.py's config: a model and level, or a fixed command (a router). */
export type HelperTierConfig = { model?: string; effort?: string; command?: string; description?: string }

/** helpers.py's effective config (`helpers.py config --json`), the parts the router reads. */
export type HelperConfig = {
  providers: Record<
    string,
    {
      label?: string
      cli?: string
      efforts?: string[]
      model_id?: string
      models_source?: string
      tiers?: Record<string, HelperTierConfig>
      /** 'claude' for another Claude account's helper. */
      kind?: string
      config_dir?: string
      /** What the provider's usage is counted in ("credits", "AIC", "% of 7d"). */
      unit?: string
      /** Position in the default helper order (lower is tried first). */
      order?: number
      /** Its CLI is installed. */
      cli_found?: boolean
      /** The provider is this session's own account: it cannot be its own helper. */
      self?: boolean
    }
  >
  custom?: { provider: string; model: string; effort: string }[]
}

/** helpers.py's cache of the models each CLI offers (~/.config/herdr-delegate/models.json). */
export type ModelsCache = Record<string, { date?: string; checked?: string; models?: string[]; error?: string; credits?: Record<string, number> }>

/** What the router has read of helpers.py: where it is, its config, the shipped defaults, the model cache, and the last check's warnings. */
export type HelperState = {
  /** 'unknown': not looked for yet; 'missing': no helpers.py found; 'error': it ran and failed; 'ready'. */
  status: 'unknown' | 'ready' | 'missing' | 'error'
  script?: string
  config?: HelperConfig
  defaults?: HelperConfig
  models?: ModelsCache
  /** The lines `helpers.py models` printed about models no longer offered and newer ones. */
  warnings: string[]
  /** What went wrong, in a line, for the pane. */
  message?: string
  busy?: boolean
}

/** The model and level the router chose for a helper step, with the template to launch. */
export type HelperPick = HelperChoice & {
  /** The template the lead launches ("kiro-claude-haiku-5-5-low", or a tier's own); absent when making it failed. */
  template?: string
  source: 'auto' | 'kind'
  /** Runs auto mode learned it from. */
  n?: number
  error?: string
}

export type Settings = {
  tiers: Record<Tier, TierSetting>
  /** Skills that run in a subagent on a tier instead of in the main chat. */
  skills: Record<string, Tier>
  /** Open the router pane when a chat starts. */
  openPane: boolean
  /** Minimal view: the pane draws only steps and their settings, with no explanatory text. */
  compact: boolean
  helpers: HelperSettings
  /** Opt-in experiment: run a started here step at its tier's effort, lower or higher than the chat's own. */
  hereEffort: HereEffortSettings
  /** Per kind of work, the rung its steps run on instead of their tier's (set by applying the history's advice). */
  kinds: Record<string, Rung>
  /** Auto mode: a subagent step whose kind has enough history runs at the cheapest rung that did it well. */
  autoRoute: boolean
  /** Auto mode picks a rung only with at least this many runs on it, and at least `autoOkPercent` of them ok. */
  autoMinRuns: number
  autoOkPercent: number
  /** Models known beyond the defaults: seen in usage or added by name. */
  models: Model[]
  /** Prices set in Settings, over the defaults; a model with none has no price. */
  prices: Record<string, Price>
}

export type HereEffortSettings = {
  enabled: boolean
  /** Context size, in tokens, above which the chat keeps its level: a switch rewrites the cache. */
  maxContext: number
}

/** One change of the main chat's effort level, and what the request after it read and wrote to the cache. */
export type EffortSwitch = {
  at: string
  from: Effort | number
  to: Effort | number
  /** The here step that was running, if any. */
  step?: string
  /** The chat's context, in tokens, before the switch. */
  context: number
  cacheWrite: number
  cacheRead: number
}

export type Step = {
  id: string
  title: string
  tier: Tier
  /** 'agent': delegated to a subagent; 'here': done by the main conversation; 'helper': an agent on another subscription. */
  where: Where
  /** Overrides set from the pane or a rerun; absent means the tier's setting. */
  model?: Model
  effort?: Effort
  status: 'planned' | 'running' | 'done'
  usage: Usage
  /** Estimated dollars at the model the step ran on. */
  cost: number
  /** Estimated dollars had the main chat's model done the same tokens. */
  mainCost: number
  resolvedModel?: string
  /** Most of the step's tokens were the subagent's start-up, not its work. */
  setupHeavy?: boolean
  reruns: number
  /** The history entry of the step's latest finished run. */
  historyKey?: string
  /** Here-step effort: what the router did with this step's effort, for its card. */
  effortNote?: string
  /** The id of the step this is a part of; absent on a top-level step. Ids are hierarchical: s3, s3.a, s3.a.1. */
  parent?: string
  /** The step has parts: a group. Its tier only rates it; its status, cost and usage are those of its parts. */
  group?: boolean
  /** N identical agents with this id run at once (a leaf only). */
  count?: number
  /** Runs of a counted step that have finished; the step is done at `count`. */
  runs?: number
  /** Helper step: the template the main agent launched, and the model the helper reported on screen. */
  helper?: string
  helperModel?: string
  /** The thinking level of the helper, as the lead reported it or the helper's template sets it; absent when neither says. */
  helperEffort?: string
  /** The model and level the router chose for this helper step (auto mode, or its kind's choice), and the template to launch. */
  helperPick?: HelperPick
  /** When the step's current run started (a helper step: at start; a subagent step: its first Agent call) and, for a helper step, when it was marked done (ISO). */
  startedAt?: string
  endedAt?: string
  /** Helper step: the usage line the helper's screen showed at the end. Recorded once. */
  helperUsage?: HelperUsage
  /** A short label for the kind of work (code-review, summarize, ...); a skill-routed step's is the skill's name. */
  kind?: string
  /** The lead's verdict on the latest run of a delegated step, and why. */
  verdict?: Verdict
  why?: string
  /** The lead has been asked for this step's missing verdict. */
  asked?: boolean
  /** Output tokens of the step's earlier runs, so a run's own output can be told apart. */
  priorOutput?: number
  /** Some of the step's tokens ran on a model with no price: its cost is incomplete and it is left out of savings. */
  unpriced?: boolean
}

/** Pane edits to a step of a running plan, held back until sent: only the fields changed. model/effort null = the tier's own. */
export type StepDraft = { where?: Where; tier?: Tier; model?: Model | null; effort?: Effort | null }

/** A plan step as the plan tool takes it: a step with optional parts, recursively. */
export type PlanNode = { id: string; title: string; tier: Tier; where?: Where; count?: number; kind?: string; parts?: PlanNode[] }

/** What a helper used on its own subscription, in that provider's unit; never converted to money. */
export type HelperUsage = { provider: string; amount: number; unit: string }

/** Helper runs of one provider that were counted, and how many of them reported usage. */
export type HelperRuns = { n: number; reported: number }

/**
 * Steps moved off Claude: how many, how long they ran, and the usage per provider and unit.
 * `runs` (per provider) tells which providers' runs reported usage; absent on totals stored before 0.21.0.
 */
export type HelperTotals = { steps: number; ms: number; usage: HelperUsage[]; runs?: Record<string, HelperRuns> }

/** What the main agent was last told of a step (the approved plan, or the last note delivered), as values it runs on. */
export type StepKnown = { where: Where; tier: Tier; model: Model; effort: Effort }

/** Money counted over some span: the main chat, the subagents, and what the
 *  subagents' tokens would have cost on the main chat's model. */
export type Totals = { mainCost: number; agentCost: number; mainEquivalent: number; steps: number; helper: HelperTotals; unpriced?: boolean }

/** Remembered across chats: a few numbers, never per-run detail. */
export type Lifetime = Totals & { since: string; plans: number; byTier: Record<Tier, number> }

export type CostView = 'plan' | 'chat' | 'all'

export type HistoryEntry = {
  key: string
  tier: Tier
  /** Where the run happened; absent on entries from before 0.18.0, which are all subagent runs. */
  where?: Where
  /** The rung a subagent run ran on (absent on a helper run). */
  model?: Model
  effort?: Effort
  /** The helper template a helper run ran on. */
  helper?: string
  /** The provider, model and level a helper run ran on, when the router knew them (older entries: read from the template's tier). */
  hrung?: HelperChoice
  kind?: string
  cost: number
  setupHeavy: boolean
  /** The run was redone (from the pane, or delegated again after it finished). */
  rerun: boolean
  /** Reruns the step had before this run. */
  reruns?: number
  /** Output tokens of this run (subagent runs). */
  output?: number
  /** How long the run took, start to finish. */
  ms?: number
  verdict?: Verdict
  why?: string
  at: string
}

declare module 'claude-code' {
  interface PluginState {
    'model-router': {
      steps: Step[]
      /** The main chat's tokens and cost; unpriced: some of them ran on a model with no price. */
      main: { usage: Usage; cost: number; model?: Model; unpriced?: boolean }
      planStatus: PlanStatus
      autoApprove: boolean
      alwaysPlan: boolean
      settings: Settings
      history: HistoryEntry[]
      seenSkills: string[]
      showSettings: boolean
      notes: string[]
      /** Per step id, what the main agent was last told; a difference to the step now is a change to announce. */
      told: Record<string, StepKnown>
      /** The helper orders the main agent was last told (the rules or a note); absent until the rules are delivered. */
      toldHelpers: string
      /** The model the routing rules were last sent to, in this chat. */
      policy: { model?: Model; sentAt?: string }
      /**
       * Where the rules reach the model. 'system': the system prompt carries them on
       * every request. Otherwise they ride a typed message: inChat says one is in the
       * conversation now; a summarization clears it, and planDue re-attaches the plan.
       */
      /** This chat's subagent totals; the main chat's own cost is in `main`. */
      chatTotals: Totals
      /** The main chat's cost when the current plan was posted. */
      planBase: { mainCost: number; at?: string }
      costView: CostView
      lifetime: Lifetime
      delivery: { via?: 'system' | 'message'; inChat: boolean; planDue: boolean }
      /** Every switch of the main chat's effort seen with here-step effort on; remembered across chats. */
      effortLog: EffortSwitch[]
      /** The main chat's last request: the effort it went out with and its context in tokens. */
      lastMain: { effort?: Effort | number; context: number }
      /** The kinds of work the rules list, taken from the history when the chat starts (so the rules stay stable). */
      ruleKinds: string[]
      /** Advice the lead was already asked to record as a strange-loop observation: "<kind>:up" / "<kind>:down". Remembered. */
      genomeNoted: string[]
      /** Pane edits to a running plan, per step id, not yet sent: the plan and the routing do not see them until Send. */
      draft: Record<string, StepDraft>
      /** What the router has read of helpers.py (this chat only; it is read again at the start and after a change). */
      helperCfg: HelperState
    }
  }
}
