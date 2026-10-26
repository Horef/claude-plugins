export type Model = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type Tier = 'light' | 'standard' | 'deep'
export type PlanStatus = 'none' | 'pending' | 'approved'

/** Token counts as the API reports them, summed over a step's turns. */
export type Usage = { input: number; cacheWrite: number; cacheRead: number; output: number }

export type TierSetting = { model: Model; effort: Effort; scopeNote: boolean }

export type Settings = {
  tiers: Record<Tier, TierSetting>
  /** Skills that run in a subagent on a tier instead of in the main chat. */
  skills: Record<string, Tier>
  /** Open the router pane when a chat starts. */
  openPane: boolean
}

export type Step = {
  id: string
  title: string
  tier: Tier
  /** 'agent': delegated to a subagent; 'here': done by the main conversation. */
  where: 'agent' | 'here'
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
      delivery: { via?: 'system' | 'message'; inChat: boolean; planDue: boolean }
    }
  }
}
