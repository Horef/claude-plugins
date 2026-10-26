import type { Effort, Model, Tier } from '../types'

// The one place that maps tiers to models. Aliases track the newest release,
// so a new model version needs no edit here.
export const TIERS: Record<Tier, { model: Model; effort: Effort; use: string }> = {
  light: {
    model: 'haiku',
    effort: 'low',
    use: 'mechanical work with a clear rule: cross-checking documents, finding and listing, extracting values, scanning logs or outputs',
  },
  standard: {
    model: 'sonnet',
    effort: 'medium',
    use: 'following detailed instructions: writing and editing code to a spec, figures and slides, summarizing papers, web research',
  },
  deep: {
    model: 'opus',
    effort: 'high',
    use: 'open judgment: research and design decisions, debugging unclear failures, reviewing reasoning',
  },
}

export const TIER_ORDER: Tier[] = ['light', 'standard', 'deep']
export const MODELS: Model[] = ['haiku', 'sonnet', 'opus', 'fable']
export const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']
