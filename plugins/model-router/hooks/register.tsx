import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelUsage, Register } from 'claude-code'

import type { Step, Tier } from '../types'
import { EFFORTS, MODELS, TIERS, TIER_ORDER } from './tiers'

const PANE = 'model-router'
const PLAN_TOOL = 'mcp__model-router__plan'
const STEP_TAG = /^\s*\[([^\]]+)\]/
const AUTO_KEY = 'autoApprove'
const ALWAYS_KEY = 'alwaysPlan'

const steps = atom({ plugin: 'model-router', key: 'steps' } as const, [])
const main = atom({ plugin: 'model-router', key: 'main' } as const, { tokens: 0, cached: 0 })
const planStatus = atom({ plugin: 'model-router', key: 'planStatus' } as const, 'none')
const autoApprove = atom({ plugin: 'model-router', key: 'autoApprove' } as const, false)
const alwaysPlan = atom({ plugin: 'model-router', key: 'alwaysPlan' } as const, false)

const TIER_COLOR: Record<Tier, string> = { light: 'success', standard: 'suggestion', deep: 'claude' }
const STATUS_GLYPH: Record<Step['status'], string> = { planned: '○', running: '◐', done: '●' }
const STATUS_COLOR: Record<Step['status'], string> = { planned: 'inactive', running: 'warning', done: 'success' }

const tierLines = TIER_ORDER.map(
  t => `- ${t} (${TIERS[t].model}, effort ${TIERS[t].effort}): ${TIERS[t].use}`,
).join('\n')

const POLICY = `# Model routing (model-router mod)

The user installed this mod so that each step of a task runs on the cheapest model tier that does it well, and authorizes delegating steps to subagents for this purpose.

1. When a request has several distinct steps (more than a handful of tool calls in all), first call ${PLAN_TOOL} with the steps. Tag each with a tier and with where it runs. Skip this for single-step or conversational requests. The call waits for the user to approve the plan (unless they turned on auto-approve) and returns the approved plan, which the user may have edited: follow what it returns. If it returns a revision request, revise and call it again.
2. Tiers:
${tierLines}
3. where = "here" for steps that need this conversation's accumulated context or back-and-forth with the user, and for small steps (under ~5 tool calls: a subagent costs ~15-40k tokens just to start). where = "agent" for self-contained steps, above all ones that read a lot.
4. Delegate an "agent" step with the Agent tool, its description starting with "[<step id>]". Do not set model or effort: the router sets them from the plan. Never use subagent_type "fork" for a routed step, since a fork ignores the model. Write a self-contained brief: goal, files, what to return. Light-tier briefs ask for a findings list, not fixes; spot-check surprising findings.
5. Mark "here" steps done through ${PLAN_TOOL} (done: [ids]) as you finish them.`

const total = (u: ModelUsage) => ({
  tokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + u.output_tokens,
  cached: u.cache_read_input_tokens ?? 0,
})

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : `${n}`)

const cycle = <T,>(list: readonly T[], one: T | undefined) =>
  list[(list.indexOf(one as T) + 1) % list.length]!

const summary = async ($: EngineInterface) => {
  const list = await read($, steps)
  if (list.length === 0) return undefined
  const status = await read($, planStatus)
  const done = list.filter(s => s.status === 'done').length
  const running = list.find(s => s.status === 'running')
  const tokens = list.reduce((n, s) => n + s.tokens, 0)
  const dots = list.map(s => STATUS_GLYPH[s.status]).join('')
  const head = status === 'pending' ? 'plan awaiting approval' : `${done}/${list.length} done`
  const now = running ? ` · ${running.id} on ${runsOn(running)}` : ''
  return `⇄ Router ${dots} ${head}${now}${tokens > 0 ? ` · agents ${fmt(tokens)} tok` : ''}`
}

const refreshStatus = async ($: EngineInterface) => $.ui.status(await summary($))

const editStep = async ($: EngineInterface, id: string, fn: (s: Step) => Step) => {
  await update($, steps, list => list.map(s => (s.id === id ? fn(s) : s)))
  await refreshStatus($)
}

const runsOn = (s: Step) =>
  s.where === 'here' ? 'here' : `${s.model ?? TIERS[s.tier].model}/${s.effort ?? TIERS[s.tier].effort}`

const planText = (list: readonly Step[]) =>
  list.map(s => `[${s.id}] ${s.title}: ${s.tier}, ${runsOn(s)}, ${s.status}`).join('\n')

const setAuto = async ($: EngineInterface, on: boolean) => {
  await update($, autoApprove, () => on)
  await $.store.set(AUTO_KEY, on)
}

const clearPlan = async ($: EngineInterface) => {
  await update($, steps, () => [])
  await update($, planStatus, () => 'none')
  await refreshStatus($)
}

const setAlways = async ($: EngineInterface, on: boolean) => {
  await update($, alwaysPlan, () => on)
  await $.store.set(ALWAYS_KEY, on)
}

const REMINDER = `Model router: "Always plan" is on. Before any tool call for this message, call ${PLAN_TOOL} with the steps (one step is fine), unless the current approved plan already covers it. Answer without a plan only if no tools are needed.`

type PlanInput = {
  steps?: { id: string; title: string; tier: Tier; where?: 'agent' | 'here' }[]
  done?: string[]
}

const APPROVE = 'Approve'
const APPROVE_AUTO = 'Approve, auto from now'
const REVISE = 'Revise'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, autoApprove, () => false)
    if ((await $.store.get(AUTO_KEY)) === true) await update($, autoApprove, () => true)
    await update($, alwaysPlan, () => false)
    if ((await $.store.get(ALWAYS_KEY)) === true) await update($, alwaysPlan, () => true)
    await $.command.register({
      name: 'router',
      description: 'Show the model-router plan pane',
    })
    await $.tool.register({
      name: 'plan',
      description:
        'Model router: set the plan for the current task (steps replaces the plan and waits for the user to approve it; overrides the user set are kept for step ids that stay) and/or mark steps done.',
      inputSchema: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Short id, e.g. s1' },
                title: { type: 'string', description: 'A few words' },
                tier: { type: 'string', enum: TIER_ORDER },
                where: { type: 'string', enum: ['agent', 'here'] },
              },
              required: ['id', 'title', 'tier', 'where'],
            },
          },
          done: { type: 'array', items: { type: 'string' }, description: 'Step ids now done' },
        },
      },
      isDeferred: false,
    })

    await refreshStatus($)

    return next(e)
  })

  on('command.run', { command: 'router' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Model router' })

    return { text: 'Model router pane opened.' }
  })

  on('tool.call', { tool: PLAN_TOOL }, async ($, e) => {
    const input = e as unknown as PlanInput
    if (input.done) {
      await update($, steps, list =>
        list.map(s => (input.done!.includes(s.id) ? { ...s, status: 'done' } : s)),
      )
    }
    await refreshStatus($)
    if (!input.steps) return { result: planText(await read($, steps)) }

    const old = await read($, steps)
    await update($, steps, () =>
      input.steps!.map(s => {
        const was = old.find(o => o.id === s.id)
        return {
          id: s.id,
          title: s.title,
          tier: s.tier,
          where: s.where ?? 'agent',
          model: was?.model,
          effort: was?.effort,
          status: was?.status ?? 'planned',
          tokens: was?.tokens ?? 0,
          cached: was?.cached ?? 0,
          resolvedModel: was?.resolvedModel,
        }
      }),
    )
    void $.ui.open({ id: PANE, title: 'Model router' })

    if (await read($, autoApprove)) {
      await update($, planStatus, () => 'approved')
      await refreshStatus($)
      return { result: `Plan auto-approved:\n${planText(await read($, steps))}` }
    }

    await update($, planStatus, () => 'pending')
    await refreshStatus($)
    let answer: string
    try {
      answer = await $.ui.ask('Run this plan? You can change tiers and models in the Model router pane first.', {
        header: 'Plan',
        options: [APPROVE, APPROVE_AUTO, REVISE],
      })
    } catch {
      await update($, planStatus, () => 'none')
      return { result: 'The user dismissed the plan. Ask them how to proceed before delegating anything.' }
    }

    if (answer === APPROVE || answer === APPROVE_AUTO) {
      if (answer === APPROVE_AUTO) await setAuto($, true)
      await update($, planStatus, () => 'approved')
      await refreshStatus($)
      return { result: `Plan approved by the user (follow these tiers; they may differ from what you proposed):\n${planText(await read($, steps))}` }
    }
    await update($, planStatus, () => 'none')
    const note = answer === REVISE ? 'They gave no details: ask what to change.' : `Their note: ${answer}`

    return { result: `The user asked to revise the plan. ${note} Then call ${PLAN_TOOL} again.` }
  }).catch(() => ({ deny: 'model-router: the plan tool failed; continue without routing.' }))

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const tag = STEP_TAG.exec(e.description)
    const step = tag && (await read($, steps)).find(s => s.id === tag[1])
    if (!step || e.subagent_type === 'fork') return next(e)

    const model = step.model ?? TIERS[step.tier].model
    const effort = step.effort ?? TIERS[step.tier].effort
    await editStep($, step.id, s => ({ ...s, status: 'running' }))
    const ran = await next({ ...e, model, effort })
    const resolved = ran.deny === undefined ? (ran.result as { resolvedModel?: string } | undefined)?.resolvedModel : undefined
    if (resolved) await editStep($, step.id, s => ({ ...s, resolvedModel: resolved }))

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (!e.usage) return ran
    const used = total(e.usage)
    if (!e.agentId) {
      await update($, main, m => ({ tokens: m.tokens + used.tokens, cached: m.cached + used.cached }))
      return ran
    }
    const agent = (await $.agent.list()).find(a => a.id === e.agentId)
    const tag = agent && STEP_TAG.exec(agent.description)
    if (tag) {
      await editStep($, tag[1]!, s => ({
        ...s,
        status: 'done',
        tokens: s.tokens + used.tokens,
        cached: s.cached + used.cached,
        resolvedModel: s.resolvedModel ?? e.usage!.model,
      }))
    }
    await refreshStatus($)

    return ran
  })

  // With "Always plan" on, every typed prompt carries a reminder the person never sees.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || !(await read($, alwaysPlan))) return next(e)

    return next({ ...e, context: [...(e.context ?? []), REMINDER] })
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!e.tools.includes(PLAN_TOOL) || !e.tools.includes('Agent')) return composed

    return {
      sections: [...composed.sections, { id: 'model-router:policy', text: POLICY, scope: 'session' as const }],
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const Select = e.surface !== 'mobile' && 'Select' in ui ? ui.Select : undefined
    const list = await read($, steps)
    const m = await read($, main)
    const status = await read($, planStatus)
    const auto = await read($, autoApprove)
    const always = await read($, alwaysPlan)
    const agentTokens = list.reduce((n, s) => n + s.tokens, 0)
    const done = list.filter(s => s.status === 'done').length

    // A picker where the surface has one, else a button that cycles.
    const pick = (key: string, value: string, options: readonly { value: string; label: string }[], set: (v: string) => void) =>
      Select ? (
        <Select key={key} value={value} options={options} onSelect={v => set(v)} />
      ) : (
        <Button key={key} onPress={() => set(cycle(options.map(o => o.value), value))}>
          {options.find(o => o.value === value)?.label ?? value}
        </Button>
      )

    return (
      <Box flexDirection="column" rowGap="md" padding="sm">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="column">
            <Text size="heading" weight="semibold">Plan</Text>
            <Text dimColor size="footnote">
              {list.length === 0 ? 'No plan yet' : `${done} of ${list.length} steps done`}
              {status === 'pending' ? ' · awaiting your approval' : ''}
            </Text>
          </Box>
          <Box flexDirection="row" columnGap="xs">
            <Button key="always" variant={always ? 'primary' : 'secondary'} onPress={() => void setAlways($, !always)}>
              {always ? 'Always plan on' : 'Always plan off'}
            </Button>
            <Button key="auto" variant={auto ? 'primary' : 'secondary'} onPress={() => void setAuto($, !auto)}>
              {auto ? 'Auto-approve on' : 'Auto-approve off'}
            </Button>
          </Box>
        </Box>

        {status === 'pending' && (
          <Box borderStyle="round" borderColor="warning" paddingX="sm" paddingY="xs">
            <Text color="warning" size="footnote">
              Adjust the steps below, then answer the question in the chat.
            </Text>
          </Box>
        )}

        {list.length === 0 && (
          <Text dimColor size="footnote">
            The main agent posts a plan here for multi-step tasks. Tiers are set in hooks/tiers.ts.
          </Text>
        )}

        {list.map(s => {
          const t = TIERS[s.tier]
          return (
            <Box key={`card:${s.id}`} flexDirection="column" rowGap="xs" borderStyle="round" borderColor={s.status === 'running' ? 'warning' : 'subtle'} paddingX="sm" paddingY="xs">
              <Box flexDirection="row" columnGap="sm" alignItems="center">
                <Text color={STATUS_COLOR[s.status]}>{STATUS_GLYPH[s.status]}</Text>
                <Text color={TIER_COLOR[s.tier]} mono size="footnote">{s.id}</Text>
                <Text weight="medium" wrap="wrap" dimColor={s.status === 'done'}>{s.title}</Text>
              </Box>
              <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center">
                {pick(`tier:${s.id}`, s.tier, TIER_ORDER.map(x => ({ value: x, label: x })), v =>
                  void editStep($, s.id, x => ({ ...x, tier: v as Tier })),
                )}
                {pick(`where:${s.id}`, s.where, [{ value: 'agent', label: 'subagent' }, { value: 'here', label: 'here' }], v =>
                  void editStep($, s.id, x => ({ ...x, where: v as Step['where'] })),
                )}
                {s.where === 'agent' &&
                  pick(`model:${s.id}`, s.model ?? 'tier', [{ value: 'tier', label: `${t.model} (tier)` }, ...MODELS.map(x => ({ value: x, label: x }))], v =>
                    void editStep($, s.id, x => ({ ...x, model: v === 'tier' ? undefined : (v as Step['model']) })),
                  )}
                {s.where === 'agent' &&
                  pick(`effort:${s.id}`, s.effort ?? 'tier', [{ value: 'tier', label: `${t.effort} (tier)` }, ...EFFORTS.map(x => ({ value: x, label: x }))], v =>
                    void editStep($, s.id, x => ({ ...x, effort: v === 'tier' ? undefined : (v as Step['effort']) })),
                  )}
              </Box>
              {s.tokens > 0 && (
                <Text dimColor size="footnote" tabular>
                  {fmt(s.tokens)} tok · {fmt(s.cached)} cached{s.resolvedModel ? ` · ${s.resolvedModel}` : ''}
                </Text>
              )}
            </Box>
          )
        })}

        <Box flexDirection="column" rowGap="xs">
          <Text dimColor size="footnote" tabular>
            Main conversation {fmt(m.tokens)} tok · {fmt(m.cached)} cached
          </Text>
          <Text dimColor size="footnote" tabular>
            Subagents {fmt(agentTokens)} tok
          </Text>
        </Box>
        {list.length > 0 && (
          <Button key="clear" plain dimColor onPress={() => void clearPlan($)}>
            Clear plan
          </Button>
        )}
      </Box>
    )
  })
}
