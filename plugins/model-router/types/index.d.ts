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
}

export type Settings = {
  tiers: Record<Tier, TierSetting>
  /** Skills that run in a subagent on a tier instead of in the main chat. */
  skills: Record<string, Tier>
  /** Open the router pane when a chat starts. */
  openPane: boolean
  helpers: HelperSettings
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
}

/** Money counted over some span: the main chat, the subagents, and what the
 *  subagents' tokens would have cost on the main chat's model. */
export type Totals = { mainCost: number; agentCost: number; mainEquivalent: number; steps: number }

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
    }
  }
}
