export type Model = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type Tier = 'light' | 'standard' | 'deep'
export type PlanStatus = 'none' | 'pending' | 'approved'

export type Step = {
  id: string
  title: string
  tier: Tier
  /** 'agent': delegated to a subagent; 'here': done by the main conversation. */
  where: 'agent' | 'here'
  /** Overrides set from the pane; absent means the tier's default. */
  model?: Model
  effort?: Effort
  status: 'planned' | 'running' | 'done'
  /** Tokens billed at full rate: input, cache writes and output. */
  tokens: number
  /** Tokens read from the prompt cache (billed at about a tenth). */
  cached: number
  resolvedModel?: string
}

declare module 'claude-code' {
  interface PluginState {
    'model-router': {
      steps: Step[]
      main: { tokens: number; cached: number }
      planStatus: PlanStatus
      autoApprove: boolean
    }
  }
}
