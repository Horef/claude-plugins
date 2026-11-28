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
 *  part redone, or a substantive error found; overkill: plainly mechanical work that ran above the light tier;
 *  cut-short: stopped by something outside the model (lost connection, quota, a crash, the person): says nothing about the model. */
export type Verdict = 'ok' | 'weak' | 'overkill' | 'cut-short'

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
  /** How helpers run: 'auto' through Herdr inside a Herdr terminal, else directly; 'herdr' only through Herdr; 'direct' always directly (helpers.py run). */
  run: 'auto' | 'herdr' | 'direct'
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
      /** It has a headless command and its CLI is installed: `helpers.py run` can start it without Herdr (herdr-delegate 0.15+; absent means no). */
      direct?: boolean
    }
  >
  custom?: { provider: string; model: string; effort: string }[]
  /** Defaults per provider kind (herdr-delegate's helpers.default.json: `claude` holds another Claude account's tiers). */
  kind_defaults?: Record<string, { tiers?: Record<string, HelperTierConfig> }>
}

/** helpers.py's cache of the models each CLI offers (~/.config/herdr-delegate/models.json). */
export type ModelsCache = Record<string, { date?: string; checked?: string; models?: string[]; error?: string; credits?: Record<string, number> }>

/** What the router has read of helpers.py: where it is, its config, the shipped defaults, the model cache, and the last check's warnings. */
export type HelperState = {
  /** 'unknown': not looked for yet; 'missing': no helpers.py found; 'nohc': Herdr's hc is not on PATH; 'error': it ran and failed; 'ready'. */
  status: 'unknown' | 'ready' | 'missing' | 'nohc' | 'error'
  script?: string
  config?: HelperConfig
  defaults?: HelperConfig
  models?: ModelsCache
  /** The lines `helpers.py models` printed about models no longer offered and newer ones. */
  warnings: string[]
  /** What went wrong, in a line, for the pane. */
  message?: string
  /** The grid row (`<provider>:<tier>`) whose change failed: the message is shown under it too. */
  messageAt?: string
  busy?: boolean
  /** The marketplace this plugin came from, for the install line shown when helpers.py or hc is missing. */
  marketplace?: string
  /** Herdr's hc can start; this chat runs in a Herdr terminal ($HC_TERMINAL_ID set). Absent: not checked yet. */
  hc?: boolean
  terminal?: boolean
  /** `helpers.py models --json` as last read (cached at the start, or from a check); absent with an older helpers.py. */
  report?: ModelsReport
}

/** What `helpers.py models --json` prints (herdr-delegate 0.15+): per provider the cache's dates, and what changed. */
export type ModelsReport = {
  providers: Record<string, { date?: string | null; checked?: string | null; count?: number; error?: string }>
  not_offered: { template: string; model: string }[]
  newer: { template: string; model: string; candidates: string[] }[]
  /** First seen in the last 14 days. */
  new: { provider: string; model: string; first_seen: string }[]
  /** No longer offered, in the last 14 days. */
  gone: { provider: string; model: string; since: string }[]
}

/** The tags a model note may carry. */
export type ModelTag = 'code' | 'review' | 'research' | 'judgment' | 'long-context' | 'fast' | 'cheap' | 'careful' | 'second-opinion' | 'agentic'

/** What the router knows of one model: shipped (seed), written by the main agent, or by the person. */
export type ModelNote = {
  id: string
  name: string
  providers: string[]
  released?: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  tags: ModelTag[]
  /** Which tier and level the model fits, and why. */
  fits: { tier: string; effort?: string; why: string }[]
  sources: { title: string; url: string; date?: string }[]
  checked: string
  by: 'seed' | 'agent' | 'person'
}

/** A change the router proposes for a tier; applied only by a click. */
export type Proposal = {
  /** `provider|tier|model|effort` */
  key: string
  /** A helper provider, or `claude` for the subagent tiers. */
  provider: string
  tier: string
  model: string
  effort: string
  why: string
  source?: string
  at: string
}

/** Remembered across chats (store key `modelNews`). */
export type ModelNews = {
  /** `<provider>:<model>` -> the day it was first seen. */
  seen: Record<string, string>
  /** `<provider>:<model>` the main agent was already asked about (a gone model: `gone:<provider>:<model>`). */
  asked: string[]
  proposals: Proposal[]
  /** Proposal keys the person dismissed. */
  dismissed: string[]
  /** Model suggestions for a kind ("Try ...") the person dismissed: `kind|provider|model|effort`. */
  dismissedTries: string[]
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
  /** Steps open with their details in new chats (Expand all / Collapse all remembers it). Replaces 0.25's `compact`, inverted. */
  expandAll: boolean
  /** The Settings groups that are open (their ids), remembered. */
  openGroups: string[]
  helpers: HelperSettings
  /** Opt-in experiment: run a started here step at its tier's effort, lower or higher than the chat's own. */
  hereEffort: HereEffortSettings
  /** Per kind of work, the rung its steps run on instead of their tier's (set by applying the history's advice). */
  kinds: Record<string, Rung>
  /** Per kind of work, the strengths (model tags) it wants, over the defaults in tiers.ts (KIND_TAGS); an empty list says none. */
  kindTags: Record<string, ModelTag[]>
  /** Auto mode: a subagent step whose kind has enough history runs at the cheapest rung that did it well. */
  autoRoute: boolean
  /** Auto mode picks a rung only with at least this many runs on it, and at least `autoOkPercent` of them ok. */
  autoMinRuns: number
  autoOkPercent: number
  /** Auto mode tries the rung below a learned one now and then (one run in EXPLORE.every + 1), so a cheaper rung can earn its place. */
  autoExplore: boolean
  /** Models known beyond the defaults: seen in usage or added by name. */
  models: Model[]
  /** Prices set in Settings, over the defaults; a model with none has no price. */
  prices: Record<string, Price>
  /** Write the diagnostics log (~/.config/model-router/log/YYYY-MM-DD.jsonl). */
  log: boolean
  /** Write the state file the Herdr view reads (~/.config/model-router/state/<chat>.json), when ~/.config/herdr-app exists. */
  herdrView: boolean
  /** Look for a newer release once a day (a quiet request for the published plugin.json), and say so in the pane. */
  updateCheck: boolean
  /** Global default for cluster job health checks (O13); off when command is empty. */
  jobCheck?: JobCheckConfig
  /** Per-project overrides for cluster job health checks, keyed by projectKey (O13). */
  jobCheckByProject?: Record<string, Partial<JobCheckConfig>>
}

export type JobCheckConfig = {
  /** Shell command template with {ids} placeholder (comma-separated), e.g. `squeue -h -j {ids} -o '%i %T %M %R'`. Empty = off. */
  command: string
  /** Periodic check interval in seconds (0 = on-demand only). */
  intervalSec: number
  /** Subprocess timeout in ms (default 15000). */
  timeoutMs: number
}

export type JobStatus = {
  id: string
  state: string
  badge: string
  elapsed?: string
  reason?: string
  bad?: boolean
}

export type JobHealthState = {
  checkedAt?: string
  stale?: boolean
  error?: string
  jobs: Record<string, JobStatus>
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
  /** Auto mode's exploration put this step on the rung below its learned one (0.29.4): the step's model and effort hold it. */
  explored?: Rung
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
  /** The verdict before the pane marked the run cut short, put back when that is undone (null: there was none). */
  verdictBefore?: Verdict | null
  /** A helper step that ran as a subagent instead, and why (the lead's reason, or "no reason given"). */
  fallback?: string
  /** The lead has been asked for this step's missing verdict. */
  asked?: boolean
  /** Output tokens of the step's earlier runs, so a run's own output can be told apart. */
  priorOutput?: number
  /** Some of the step's tokens ran on a model with no price: its cost is incomplete and it is left out of savings. */
  unpriced?: boolean
  /** Step or group ids this step waits on before starting (O13). */
  dependsOn?: string[]
  /** Human approval gate: true or a short prompt; step cannot be delegated/started until gateApproved is true (O13). */
  gate?: boolean | string
  gateApproved?: boolean
  /** Artifact links attached to this step: branch, worktree, helper terminal, cluster jobs, report path, RESULTS/D/PR refs (O13). */
  links?: StepLinks
}

/** Artifact links attached to a plan step (O13). */
export type StepLinks = {
  branch?: string
  worktree?: string
  helper?: string
  jobs?: string[]
  report?: string
  refs?: string[]
}

/** A named plan persisted per project under ~/.config/model-router/plans/<projectKey>/<name>.json (O13). */
export type PersistedPlan = {
  version: 1
  name: string
  project: string
  status: 'open' | 'closed'
  createdAt: string
  updatedAt: string
  revision: number
  planStatus: PlanStatus
  steps: Step[]
}

/** Summary of a persisted plan for the pane switcher and list action (O13). */
export type PlanSummary = {
  name: string
  status: 'open' | 'closed'
  done: number
  total: number
  updatedAt: string
}

/** Pane edits to a step of a running plan, held back until sent: only the fields changed. model/effort null = the tier's own. */
export type StepDraft = { where?: Where; tier?: Tier; model?: Model | null; effort?: Effort | null }

/** A plan step as the plan tool takes it: a step with optional parts, recursively. */
export type PlanNode = { id: string; title: string; tier: Tier; where?: Where; count?: number; kind?: string; dependsOn?: string[]; gate?: boolean | string; links?: StepLinks; parts?: PlanNode[] }

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
export type Totals = {
  mainCost: number
  agentCost: number
  mainEquivalent: number
  steps: number
  helper: HelperTotals
  unpriced?: boolean
  /** Helper steps that ran as subagents instead, and the latest reason. */
  fallbacks?: number
  lastFallback?: string
}

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
       * rulesRow is the id of the row that carried them: once the chat no longer holds
       * it (compacted, cleared, rewound), they go out again.
       */
      /** This chat's subagent totals; the main chat's own cost is in `main`. */
      chatTotals: Totals
      /** The main chat's cost when the current plan was posted. */
      planBase: { mainCost: number; at?: string }
      costView: CostView
      lifetime: Lifetime
      delivery: { via?: 'system' | 'message'; inChat: boolean; planDue: boolean; rulesRow?: string }
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
      /** The box to set helpers.py's path by hand is open (Settings → Helpers). */
      showHelperPath: boolean
      /** Settings → Other subscriptions lists every helper check, not only the failing ones and a count of the rest. */
      showChecks: boolean
      /** Why the last value typed into a Settings input was not taken, by the input's key ('' when none). */
      inputNote: { key: string; text: string }
      /** The health check list is open under the health line. */
      showHealth: boolean
      /** Where the last report was written (shown beside its button), or why it failed. */
      reportNote: string
      /** What the router knows of new and gone models and its proposals (the store's `modelNews`, as this chat last read it). */
      modelNews: ModelNews
      /** The model notes: the shipped seed with `model-notes.json` over it. */
      modelNotes: Record<string, ModelNote>
      /** The card's last Apply per proposal key: shown in place of the proposal (applied, or why not). */
      modelFeedback: Record<string, { line: string; text: string; ok: boolean }>
      /** The notes under the New models card are open; the list of notes in Settings is open. */
      showCardNotes: boolean
      showAllNotes: boolean
      /** Settings → Learning: the kinds' strengths and the model map are open; the kind whose tags are being edited ('' for none). */
      showModelMap: boolean
      editKindTags: string
      /** This chat's plan view: all steps open or closed (absent: the stored default), and steps opened or closed one by one. */
      paneView: { all?: boolean; toggled: Record<string, boolean> }
      /** The `?` glossary under the plan header is open. */
      showGlossary: boolean
      /** On a short terminal, the inline pane is drawn whole although unfocused (its Show all button). */
      glanceOpen: boolean
      /** The block the paged pane starts at after Show all on a short terminal (0: the top). */
      glancePage: number
      /** The cost section's Details (stat tiles, footnote, history tables) are open. */
      showCostDetails: boolean
      /** The tier whose helper order is being edited in Settings ('' for none). */
      editOrder: string
      /** The terminal picker whose options are listed under it (its key; '' for none). */
      picking: string
      /** Settings → Other subscriptions → Helper models: the full picker grid is open. */
      showHelperGrid: boolean
      /** A reset waiting for its second click: 'history', 'stats' or 'tiers' ('' for none); and what the last one did. */
      confirmReset: string
      resetNote: string
      /** This chat's key for the Herdr view's state file (<config>/model-router/state/<chatKey>.json). */
      chatKey: string
      /** The update check (hooks/update.ts): the installed version (from plugin.json), whether this load is a checkout (never checked), whether CLAUDE_PLUGINS_NO_UPDATE_CHECK is set, and what was last found. */
      updates: { installed?: string; dev: boolean; envOff?: boolean; state: { lastCheck?: string; lastOk?: boolean; latest?: string; dismissed?: string; toasted?: string } }
      /** What the pane's Update button did (the request when the prompt box would not take it). */
      updateNote: string
      /** The first-use welcome was dismissed or a plan was posted (true until the remembered state is loaded, so it never flashes for an existing user). */
      welcomeSeen: boolean
      /** Active named persistent plan in this session ('' for an ephemeral plan) and its last-known revision (O13). */
      planName: string
      planRevision: number
      /** Persisted plans known for this project, for the Plans ▾ switcher (O13). */
      openPlans: PlanSummary[]
      /** The Plans ▾ drawer under the plan header is open (O13). */
      showPlans: boolean
      /** Last cluster job health check result (O13). */
      jobHealth: JobHealthState
    }
  }
}
