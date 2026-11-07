// The state contract of model-router: plan steps, settings, history, cost totals and rule delivery.
export type Model = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type Tier = 'light' | 'standard' | 'deep'
export type PlanStatus = 'none' | 'pending' | 'approved'

/** Token counts as the API reports them, summed over a step's turns. */
export type Usage = { input: number; cacheWrite: number; cacheRead: number; output: number }

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
  /** Helper step: when it was started and when it was marked done (ISO). */
  startedAt?: string
  endedAt?: string
  /** Helper step: the usage line the helper's screen showed at the end. Recorded once. */
  helperUsage?: HelperUsage
}

/** A plan step as the plan tool takes it: a step with optional parts, recursively. */
export type PlanNode = { id: string; title: string; tier: Tier; where?: Where; count?: number; parts?: PlanNode[] }

/** What a helper used on its own subscription, in that provider's unit; never converted to money. */
export type HelperUsage = { provider: string; amount: number; unit: string }

/** Steps moved off Claude: how many, how long they ran, and the usage per provider and unit. */
export type HelperTotals = { steps: number; ms: number; usage: HelperUsage[] }

/** What the main agent was last told of a step (the approved plan, or the last note delivered), as values it runs on. */
export type StepKnown = { where: Where; tier: Tier; model: Model; effort: Effort }

/** Money counted over some span: the main chat, the subagents, and what the
 *  subagents' tokens would have cost on the main chat's model. */
export type Totals = { mainCost: number; agentCost: number; mainEquivalent: number; steps: number; helper: HelperTotals }

/** Remembered across chats: a few numbers, never per-run detail. */
export type Lifetime = Totals & { since: string; plans: number; byTier: Record<Tier, number> }

export type CostView = 'plan' | 'chat' | 'all'

export type HistoryEntry = {
  key: string
  tier: Tier
  model: Model
  effort: Effort
  cost: number
  setupHeavy: boolean
  /** The user asked for this run to be redone on a higher rung. */
  rerun: boolean
  at: string
}

declare module 'claude-code' {
  interface PluginState {
    'model-router': {
      steps: Step[]
      main: { usage: Usage; cost: number; model?: Model }
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
    }
  }
}
