import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, ModelUsage, Register } from 'claude-code'

import type { HistoryEntry, Settings, Step, Tier, Usage } from '../types'
import {
  EMPTY_USAGE,
  PANE,
  PLAN_TOOL,
  SKILL_TAG,
  STATUS_GLYPH,
  STEP_TAG,
  addUsage,
  costOf,
  fmtTok,
  fmtUsd,
  isSetupHeavy,
  isTier,
  modelHint,
  modelOf,
  newStep,
  nextRung,
  planText,
  rungLabel,
  rungStats,
  runsOn,
  suggestions,
} from './logic'
import type { Suggestion } from './logic'
import { DEFAULT_SETTINGS, EFFORTS, MODELS, SCOPE_NOTE, TIER_ORDER, TIER_USE } from './tiers'

// --- State: the session's (atoms) and what is remembered across sessions ($.store) --

const steps = atom({ plugin: 'model-router', key: 'steps' } as const, [])
const main = atom({ plugin: 'model-router', key: 'main' } as const, { usage: EMPTY_USAGE, cost: 0 })
const planStatus = atom({ plugin: 'model-router', key: 'planStatus' } as const, 'none')
const autoApprove = atom({ plugin: 'model-router', key: 'autoApprove' } as const, false)
const alwaysPlan = atom({ plugin: 'model-router', key: 'alwaysPlan' } as const, false)
const settings = atom({ plugin: 'model-router', key: 'settings' } as const, DEFAULT_SETTINGS)
const history = atom({ plugin: 'model-router', key: 'history' } as const, [])
const seenSkills = atom({ plugin: 'model-router', key: 'seenSkills' } as const, [])
const showSettings = atom({ plugin: 'model-router', key: 'showSettings' } as const, false)
const notes = atom({ plugin: 'model-router', key: 'notes' } as const, [])
const policySent = atom({ plugin: 'model-router', key: 'policy' } as const, {})
const delivery = atom({ plugin: 'model-router', key: 'delivery' } as const, { inChat: false, planDue: false })

const STORE = { auto: 'autoApprove', always: 'alwaysPlan', settings: 'settings', history: 'history' }
const HISTORY_CAP = 500

async function loadRemembered($: EngineInterface) {
  const stored = (await $.store.get(STORE.settings)) as Partial<Settings> | undefined
  await update($, settings, () => ({
    tiers: { ...DEFAULT_SETTINGS.tiers, ...(stored?.tiers ?? {}) },
    skills: { ...(stored?.skills ?? {}) },
    openPane: stored?.openPane ?? DEFAULT_SETTINGS.openPane,
  }))
  await update($, autoApprove, () => false)
  if ((await $.store.get(STORE.auto)) === true) await update($, autoApprove, () => true)
  await update($, alwaysPlan, () => false)
  if ((await $.store.get(STORE.always)) === true) await update($, alwaysPlan, () => true)
  const past = (await $.store.get(STORE.history)) as HistoryEntry[] | undefined
  await update($, history, () => (Array.isArray(past) ? past : []))
}

async function setAuto($: EngineInterface, on: boolean) {
  await update($, autoApprove, () => on)
  await $.store.set(STORE.auto, on)
}

async function setAlways($: EngineInterface, on: boolean) {
  await update($, alwaysPlan, () => on)
  await $.store.set(STORE.always, on)
}

async function editSettings($: EngineInterface, fn: (s: Settings) => Settings) {
  await update($, settings, fn)
  await $.store.set(STORE.settings, await read($, settings))
}

async function editHistory($: EngineInterface, fn: (h: HistoryEntry[]) => HistoryEntry[]) {
  await update($, history, h => fn(h).slice(-HISTORY_CAP))
  await $.store.set(STORE.history, await read($, history))
}

// --- Actions ------------------------------------------------------------------

async function summary($: EngineInterface) {
  const list = await read($, steps)
  const set = await read($, settings)
  const sent = await read($, policySent)
  const always = await read($, alwaysPlan)

  // No plan: say the router is on and whether the active model has its rules.
  if (list.length === 0) {
    const rules = sent.model ? `rules sent to ${sent.model}` : 'rules go out with your next message'
    return `⇄ Router on · ${rules}${always ? ' · always plan' : ''} · /router for the pane`
  }

  const status = await read($, planStatus)
  const done = list.filter(s => s.status === 'done').length
  const running = list.find(s => s.status === 'running')
  const cost = list.reduce((n, s) => n + s.cost, 0)
  const saved = list.reduce((n, s) => n + Math.max(0, s.mainCost - s.cost), 0)
  const dots = list.map(s => STATUS_GLYPH[s.status]).join('')
  const head = status === 'pending' ? 'plan awaiting approval' : `${done}/${list.length} done`
  const now = running ? ` · ${running.id} on ${rungLabel(runsOn(running, set))}` : ''
  const money = cost > 0 ? ` · agents ≈${fmtUsd(cost)}${saved > 0 ? `, saved ≈${fmtUsd(saved)}` : ''}` : ''

  return `⇄ Router ${dots} ${head}${now}${money} · /router`
}

async function refreshStatus($: EngineInterface) {
  $.ui.status(await summary($))
}

async function editStep($: EngineInterface, id: string, fn: (s: Step) => Step) {
  await update($, steps, list => list.map(s => (s.id === id ? fn(s) : s)))
  await refreshStatus($)
}

async function clearPlan($: EngineInterface) {
  await update($, steps, () => [])
  await update($, planStatus, () => 'none')
  await refreshStatus($)
}

/** Moves a finished step one rung up the ladder and asks the main agent to redo it. */
async function rerun($: EngineInterface, id: string) {
  const set = await read($, settings)
  const step = (await read($, steps)).find(s => s.id === id)
  const up = step && nextRung(runsOn(step, set))
  if (!step || !up) return
  if (step.historyKey) {
    await editHistory($, h => h.map(x => (x.key === step.historyKey ? { ...x, rerun: true } : x)))
  }
  await editStep($, id, s => ({ ...s, model: up.model, effort: up.effort, status: 'planned', reruns: s.reruns + 1 }))
  await $.prompt.submit({
    text: `[model-router] Please rerun step [${id}] "${step.title}": its result was not good enough, so it moves up to ${rungLabel(up)}. Delegate it again with the same brief, its description starting "[${id}]".`,
  })
}

async function applySuggestion($: EngineInterface, s: Suggestion) {
  await editSettings($, set => ({ ...set, tiers: { ...set.tiers, [s.tier]: { ...set.tiers[s.tier], ...s.to } } }))
}

// --- Policy -------------------------------------------------------------------

const policy = (set: Settings) => {
  const tiers = TIER_ORDER.map(t => `- ${t} (${rungLabel(set.tiers[t])}): ${TIER_USE[t]}`).join('\n')
  const skills = Object.entries(set.skills)
  const skillRule = skills.length
    ? `\n6. These skills run in a subagent on a tier: ${skills.map(([n, t]) => `${n} (${t})`).join(', ')}. To use one, delegate with the Agent tool, its description starting "[${SKILL_TAG}<name>]", and a brief that tells the subagent to invoke that skill with everything it needs from this conversation.`
    : ''

  return `# Model routing (model-router mod)

The user installed this mod so that each step of a task runs on the cheapest model tier that does it well, and authorizes delegating steps to subagents for this purpose.

1. When a request has several distinct steps (more than a handful of tool calls in all), first call ${PLAN_TOOL} with the steps. Tag each with a tier and with where it runs. Skip this for single-step or conversational requests. The call waits for the user to approve the plan (unless they turned on auto-approve) and returns the approved plan, which the user may have edited: follow what it returns. If it returns a revision request, revise and call it again.
2. Tiers:
${tiers}
3. where = "here" for steps that need this conversation's accumulated context or back-and-forth with the user, and for small steps (under ~5 tool calls: a subagent costs ~15-40k tokens just to start). where = "agent" for self-contained steps, above all ones that read a lot.
4. Delegate an "agent" step with the Agent tool, its description starting with "[<step id>]". Do not set model or effort: the router sets them from the plan. Never use subagent_type "fork" for a routed step, since a fork ignores the model. Write a self-contained brief: goal, files, what to return. Light-tier briefs ask for a findings list, not fixes; spot-check surprising findings. If a light result is weak, say so: the user can rerun the step one rung higher from the pane.
5. Mark "here" steps done through ${PLAN_TOOL} (done: [ids]) as you finish them.${skillRule}`
}

const REMINDER = `Model router: "Always plan" is on. Before any tool call for this message, call ${PLAN_TOOL} with the steps (one step is fine), unless the current approved plan already covers it. Answer without a plan only if no tools are needed.`

const usageOf = (u: ModelUsage): Usage => ({
  input: u.input_tokens,
  cacheWrite: u.cache_creation_input_tokens ?? 0,
  cacheRead: u.cache_read_input_tokens ?? 0,
  output: u.output_tokens,
})

type PlanInput = {
  steps?: { id: string; title: string; tier: Tier; where?: 'agent' | 'here' }[]
  done?: string[]
}

const APPROVE = 'Approve'
const APPROVE_AUTO = 'Approve, auto from now'
const REVISE = 'Revise'


// --- The pane -----------------------------------------------------------------

const TIER_COLOR: Record<Tier, string> = { light: 'success', standard: 'suggestion', deep: 'claude' }
const STATUS_COLOR: Record<Step['status'], string> = { planned: 'inactive', running: 'warning', done: 'success' }

type Option = { value: string; label: string }

const cycle = (values: readonly string[], one: string) => values[(values.indexOf(one) + 1) % values.length]!

type RenderArgs = Parameters<Hook<'ui.render'>>

export async function renderPane($: RenderArgs[0], e: RenderArgs[1]) {
  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
  const hasFields = e.surface !== 'mobile'
  const Select = hasFields && 'Select' in ui ? ui.Select : undefined
  const Input = hasFields && 'Input' in ui ? ui.Input : undefined

  const list = await read($, steps)
  const set = await read($, settings)
  const m = await read($, main)
  const status = await read($, planStatus)
  const auto = await read($, autoApprove)
  const always = await read($, alwaysPlan)
  const past = await read($, history)
  const seen = await read($, seenSkills)
  const isSettingsOpen = await read($, showSettings)

  const done = list.filter(s => s.status === 'done').length
  const agentCost = list.reduce((n, s) => n + s.cost, 0)
  const saved = list.reduce((n, s) => n + Math.max(0, s.mainCost - s.cost), 0)
  const hint = modelHint(list, m.model)
  const advice = suggestions(past, set)

  // A picker where the surface has one, else a button that cycles.
  const pick = (key: string, value: string, options: readonly Option[], onPick: (v: string) => void) =>
    Select ? (
      <Select key={key} value={value} options={options} onSelect={v => onPick(v)} />
    ) : (
      <Button key={key} onPress={() => onPick(cycle(options.map(o => o.value), value))}>
        {options.find(o => o.value === value)?.label ?? value}
      </Button>
    )

  const toggle = (key: string, label: string, isOn: boolean, onPress: () => void) => (
    <Button key={key} variant={isOn ? 'primary' : 'secondary'} onPress={onPress}>
      {`${label} ${isOn ? 'on' : 'off'}`}
    </Button>
  )

  const section = (title: string, aside?: string) => (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop="xs">
      <Text weight="semibold">{title}</Text>
      {aside ? <Text dimColor size="footnote">{aside}</Text> : null}
    </Box>
  )

  const stat = (label: string, value: string, color?: string) => (
    <Box flexDirection="column" flexGrow={1}>
      <Text dimColor size="caption">{label}</Text>
      <Text weight="semibold" tabular color={color}>{value}</Text>
    </Box>
  )

  const card = (s: Step) => {
    const now = runsOn(s, set)
    const up = s.where === 'agent' && s.status === 'done' ? nextRung(now) : undefined
    const tierSet = set.tiers[s.tier]
    const tokens = s.usage.input + s.usage.cacheWrite + s.usage.output
    return (
      <Box
        key={`card:${s.id}`}
        flexDirection="column"
        rowGap="xs"
        borderStyle="round"
        borderColor={s.status === 'running' ? 'warning' : 'subtle'}
        paddingX="sm"
        paddingY="xs"
      >
        <Box flexDirection="row" columnGap="sm" alignItems="center">
          <Text color={STATUS_COLOR[s.status]}>{STATUS_GLYPH[s.status]}</Text>
          <Text color={TIER_COLOR[s.tier]} mono size="footnote">{s.id}</Text>
          <Text weight="medium" wrap="wrap" dimColor={s.status === 'done'}>{s.title}</Text>
        </Box>
        <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center">
          {pick(`tier:${s.id}`, s.tier, TIER_ORDER.map(t => ({ value: t, label: t })), v =>
            void editStep($, s.id, x => ({ ...x, tier: v as Tier })),
          )}
          {pick(`where:${s.id}`, s.where, [{ value: 'agent', label: 'subagent' }, { value: 'here', label: 'here' }], v =>
            void editStep($, s.id, x => ({ ...x, where: v as Step['where'] })),
          )}
          {s.where === 'agent' &&
            pick(
              `model:${s.id}`,
              s.model ?? 'tier',
              [{ value: 'tier', label: `${tierSet.model} (tier)` }, ...MODELS.map(x => ({ value: x, label: x }))],
              v => void editStep($, s.id, x => ({ ...x, model: v === 'tier' ? undefined : (v as Step['model']) })),
            )}
          {s.where === 'agent' &&
            pick(
              `effort:${s.id}`,
              s.effort ?? 'tier',
              [{ value: 'tier', label: `${tierSet.effort} (tier)` }, ...EFFORTS.map(x => ({ value: x, label: x }))],
              v => void editStep($, s.id, x => ({ ...x, effort: v === 'tier' ? undefined : (v as Step['effort']) })),
            )}
        </Box>
        {s.cost > 0 && (
          <Text dimColor size="footnote" tabular>
            ≈{fmtUsd(s.cost)} · {fmtTok(tokens)} tok + {fmtTok(s.usage.cacheRead)} cached
            {s.mainCost > s.cost ? ` · saved ≈${fmtUsd(s.mainCost - s.cost)}` : ''}
            {s.reruns > 0 ? ` · rerun ${s.reruns}×` : ''}
          </Text>
        )}
        {s.setupHeavy && (
          <Text color="warning" size="footnote">Mostly start-up cost: a step this small is cheaper done here.</Text>
        )}
        {up && (
          <Box flexDirection="row">
            <Button key={`rerun:${s.id}`} plain onPress={() => void rerun($, s.id)}>
              {`↑ Rerun on ${rungLabel(up)}`}
            </Button>
          </Box>
        )}
      </Box>
    )
  }

  const stats = rungStats(past)
  const mapped = Object.entries(set.skills)
  const unmapped = seen.filter(n => !(n in set.skills))

  return (
    <Box flexDirection="column" rowGap="md" padding="sm">
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Box flexDirection="column">
          <Text size="heading" weight="semibold">Model router</Text>
          <Text dimColor size="footnote">
            {list.length === 0 ? 'No plan yet' : `${done} of ${list.length} steps done`}
            {status === 'pending' ? ' · awaiting your approval' : ''}
          </Text>
        </Box>
        <Button key="settings" plain onPress={() => void update($, showSettings, v => !v)}>
          {isSettingsOpen ? 'Settings ▾' : 'Settings ▸'}
        </Button>
      </Box>

      <Box flexDirection="row" columnGap="md" borderStyle="round" borderColor="subtle" paddingX="sm" paddingY="xs">
        {stat(`This chat${m.model ? ` · ${m.model}` : ''}`, `≈${fmtUsd(m.cost)}`)}
        {stat('Subagents', `≈${fmtUsd(agentCost)}`)}
        {stat('Saved', saved > 0 ? `≈${fmtUsd(saved)}` : '—', saved > 0 ? 'success' : undefined)}
      </Box>

      {status === 'pending' && (
        <Box borderStyle="round" borderColor="warning" paddingX="sm" paddingY="xs">
          <Text color="warning" size="footnote">Adjust the steps below, then answer the question in the chat.</Text>
        </Box>
      )}
      {hint && (
        <Box borderStyle="round" borderColor="suggestion" paddingX="sm" paddingY="xs">
          <Text color="suggestion" size="footnote">{hint}</Text>
        </Box>
      )}

      {section('Plan', list.length > 0 ? `${list.length} steps` : undefined)}
      {list.length === 0 && (
        <Text dimColor size="footnote">The main agent posts a plan here for multi-step tasks. Turn on Always plan in Settings to plan every message.</Text>
      )}
      {list.map(card)}
      {list.length > 0 && (
        <Box flexDirection="row">
          <Button key="clear" plain dimColor onPress={() => void clearPlan($)}>Clear plan</Button>
        </Box>
      )}

      {(stats.length > 0 || advice.length > 0) && section('What the history says', `${past.length} runs`)}
      {advice.map(a => (
        <Box key={`advice:${a.tier}`} flexDirection="column" rowGap="xs" borderStyle="round" borderColor={a.isRaise ? 'warning' : 'success'} paddingX="sm" paddingY="xs">
          <Text size="footnote">
            {a.why}: {a.isRaise ? 'raise' : 'try lowering'} the {a.tier} tier to {rungLabel(a.to)}.
          </Text>
          <Box flexDirection="row">
            <Button key={`apply:${a.tier}`} variant="primary" onPress={() => void applySuggestion($, a)}>
              {`Use ${rungLabel(a.to)}`}
            </Button>
          </Box>
        </Box>
      ))}
      {stats.map(r => (
        <Box key={`rung:${r.label}`} flexDirection="row" justifyContent="space-between">
          <Text mono size="footnote">{r.label}</Text>
          <Text dimColor size="footnote" tabular>
            {r.n} runs · {r.reruns} reruns · ≈{fmtUsd(r.avgCost)} each{r.setupHeavy ? ` · ${r.setupHeavy} start-up heavy` : ''}
          </Text>
        </Box>
      ))}

      {isSettingsOpen && section('Settings')}
      {isSettingsOpen && (
        <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs">
          {toggle('always', 'Always plan', always, () => void setAlways($, !always))}
          {toggle('auto', 'Auto-approve', auto, () => void setAuto($, !auto))}
          {toggle('open-pane', 'Open pane on start', set.openPane, () => void editSettings($, s => ({ ...s, openPane: !s.openPane })))}
        </Box>
      )}
      {isSettingsOpen &&
        TIER_ORDER.map(t => {
          const ts = set.tiers[t]
          const edit = (patch: Partial<typeof ts>) =>
            void editSettings($, s => ({ ...s, tiers: { ...s.tiers, [t]: { ...s.tiers[t], ...patch } } }))
          return (
            <Box key={`tierset:${t}`} flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs" alignItems="center">
              <Box width={9}>
                <Text color={TIER_COLOR[t]} weight="medium">{t}</Text>
              </Box>
              {pick(`set-model:${t}`, ts.model, MODELS.map(x => ({ value: x, label: x })), v => edit({ model: v as typeof ts.model }))}
              {pick(`set-effort:${t}`, ts.effort, EFFORTS.map(x => ({ value: x, label: x })), v => edit({ effort: v as typeof ts.effort }))}
              {toggle(`set-scope:${t}`, 'Scope note', ts.scopeNote, () => edit({ scopeNote: !ts.scopeNote }))}
            </Box>
          )
        })}
      {isSettingsOpen && (
        <Text dimColor size="footnote">
          Scope note: adds one line to that tier's subagent briefs asking it to stay on the task and not start sessions or load extra tools.
        </Text>
      )}

      {isSettingsOpen && section('Skills', 'run in a subagent on a tier')}
      {isSettingsOpen &&
        [...mapped.map(([n]) => n), ...unmapped].map(name => (
          <Box key={`skill:${name}`} flexDirection="row" justifyContent="space-between" alignItems="center">
            <Text mono size="footnote" wrap="truncate">{name}</Text>
            {pick(
              `skill-tier:${name}`,
              set.skills[name] ?? 'off',
              [{ value: 'off', label: 'in main chat' }, ...TIER_ORDER.map(t => ({ value: t, label: t }))],
              v =>
                void editSettings($, s => {
                  const skills = { ...s.skills }
                  if (isTier(v)) skills[name] = v
                  else delete skills[name]
                  return { ...s, skills }
                }),
            )}
          </Box>
        ))}
      {isSettingsOpen && Input && (
        <Input
          key="add-skill"
          placeholder="Add a skill by name, e.g. scientific-figures"
          submitLabel="Add"
          onSubmit={v => {
            const name = v.trim()
            if (name) void editSettings($, s => ({ ...s, skills: { ...s.skills, [name]: s.skills[name] ?? 'standard' } }))
          }}
        />
      )}
      {isSettingsOpen && (
        <Box flexDirection="row" columnGap="xs">
          <Button key="reset-tiers" plain dimColor onPress={() => void editSettings($, s => ({ ...s, tiers: DEFAULT_SETTINGS.tiers }))}>
            Reset tiers
          </Button>
          <Button key="clear-history" plain dimColor onPress={() => void editHistory($, () => [])}>
            Clear history
          </Button>
        </Box>
      )}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadRemembered($)
    await $.command.register({ name: 'router', description: 'Show the model-router pane' })
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
    if ((await read($, settings)).openPane) void $.ui.open({ id: PANE, title: 'Model router' })

    return next(e)
  })

  on('command.run', { command: 'router' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Model router' })

    return { text: 'Model router pane opened.' }
  })

  on('tool.call', { tool: PLAN_TOOL }, async ($, e) => {
    const input = e as unknown as PlanInput
    const set = await read($, settings)
    const withNotes = async (text: string) => {
      const pending = await read($, notes)
      await update($, notes, () => [])
      return { result: pending.length ? `${text}\n\nRouter notes:\n${pending.map(n => `- ${n}`).join('\n')}` : text }
    }

    if (input.done) {
      await update($, steps, list => list.map(s => (input.done!.includes(s.id) ? { ...s, status: 'done' } : s)))
    }
    await refreshStatus($)
    if (!input.steps) return withNotes(planText(await read($, steps), set))

    const old = await read($, steps)
    await update($, steps, () =>
      input.steps!.map(s => {
        const was = old.find(o => o.id === s.id)
        return was ? { ...was, title: s.title, tier: s.tier, where: s.where ?? 'agent' } : newStep(s.id, s.title, s.tier, s.where ?? 'agent')
      }),
    )
    void $.ui.open({ id: PANE, title: 'Model router' })

    if (await read($, autoApprove)) {
      await update($, planStatus, () => 'approved')
      await refreshStatus($)
      return withNotes(`Plan auto-approved:\n${planText(await read($, steps), set)}`)
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
      await refreshStatus($)
      return { result: 'The user dismissed the plan. Ask them how to proceed before delegating anything.' }
    }

    if (answer === APPROVE || answer === APPROVE_AUTO) {
      if (answer === APPROVE_AUTO) await setAuto($, true)
      await update($, planStatus, () => 'approved')
      await refreshStatus($)
      const now = await read($, settings)
      return withNotes(
        `Plan approved by the user (follow these tiers; they may differ from what you proposed):\n${planText(await read($, steps), now)}`,
      )
    }
    await update($, planStatus, () => 'none')
    await refreshStatus($)
    const note = answer === REVISE ? 'They gave no details: ask what to change.' : `Their note: ${answer}`

    return { result: `The user asked to revise the plan. ${note} Then call ${PLAN_TOOL} again.` }
  }).catch(() => ({ deny: 'model-router: the plan tool failed; continue without routing.' }))

  // Skills mapped to a tier run in a subagent; the main chat is told how.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const name = e.skill
    await update($, seenSkills, list => (list.includes(name) ? list : [...list, name].slice(-50)))
    const tier = (await read($, settings)).skills[name]
    if (!tier || (e as { agentId?: string }).agentId) return next(e)

    return {
      deny: `model-router: the user runs the skill "${name}" on the ${tier} tier. Delegate it with the Agent tool, description "[${SKILL_TAG}${name}] <a few words>", and a brief that tells the subagent to invoke the Skill tool with skill "${name}"${e.args ? ` and args ${JSON.stringify(e.args)}` : ''}, plus everything it needs from this conversation.`,
    }
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const tag = STEP_TAG.exec(e.description)?.[1]
    if (!tag || e.subagent_type === 'fork') return next(e)
    const set = await read($, settings)

    if (tag.startsWith(SKILL_TAG)) {
      const tier = set.skills[tag.slice(SKILL_TAG.length)]
      if (!tier) return next(e)
      const exists = (await read($, steps)).some(s => s.id === tag)
      if (!exists) {
        await update($, steps, list => [...list, newStep(tag, `Skill ${tag.slice(SKILL_TAG.length)}`, tier, 'agent')])
      }
    }
    const step = (await read($, steps)).find(s => s.id === tag)
    if (!step) return next(e)

    const { model, effort } = runsOn(step, set)
    const prompt = set.tiers[step.tier].scopeNote ? `${e.prompt}\n\n${SCOPE_NOTE}` : e.prompt
    await editStep($, step.id, s => ({ ...s, status: 'running' }))
    const ran = await next({ ...e, model, effort, prompt })
    const resolved = ran.deny === undefined ? (ran.result as { resolvedModel?: string } | undefined)?.resolvedModel : undefined
    if (resolved) await editStep($, step.id, s => ({ ...s, resolvedModel: resolved }))

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (!e.usage) return ran
    const used = usageOf(e.usage)
    const model = modelOf(e.usage.model)

    if (!e.agentId) {
      await update($, main, m => ({ usage: addUsage(m.usage, used), cost: m.cost + costOf(used, model), model: model ?? m.model }))
      await refreshStatus($)
      return ran
    }

    const agent = (await $.agent.list()).find(a => a.id === e.agentId)
    const id = agent && STEP_TAG.exec(agent.description)?.[1]
    const step = id ? (await read($, steps)).find(s => s.id === id) : undefined
    if (!step) return ran

    const set = await read($, settings)
    const ranOn = { model: model ?? runsOn(step, set).model, effort: runsOn(step, set).effort }
    const mainModel = (await read($, main)).model ?? 'opus'
    const usage = addUsage(step.usage, used)
    const heavy = isSetupHeavy(usage)
    const at = new Date().toISOString()
    const key = `${at}:${step.id}`
    const cost = step.cost + costOf(used, ranOn.model)

    await editStep($, step.id, s => ({
      ...s,
      status: 'done',
      usage,
      cost,
      mainCost: s.mainCost + costOf(used, mainModel),
      resolvedModel: s.resolvedModel ?? e.usage!.model,
      setupHeavy: heavy,
      historyKey: key,
    }))
    await editHistory($, h => [...h, { key, tier: step.tier, ...ranOn, cost, setupHeavy: heavy, rerun: false, at }])
    if (heavy) {
      await update($, notes, n => [
        ...n,
        `Step ${step.id} was mostly subagent start-up cost (${usage.input + usage.cacheWrite + usage.cacheRead} tokens read, ${usage.output} written): steps this small are cheaper done here.`,
      ])
    }

    return ran
  })

  // Typed prompts carry the Always-plan reminder and any pending router notes, unseen by the person.
  // Typed prompts carry, unseen by the person: the rules when the system prompt
  // cannot hold them (the desktop app's sessions) and none are in the chat yet,
  // the plan again after a summarization, the Always-plan reminder, router notes.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    const extra: string[] = []
    const how = await read($, delivery)
    if (how.via !== 'system' && !how.inChat) {
      extra.push(policy(await read($, settings)))
      await update($, delivery, d => ({ ...d, inChat: true }))
    }
    const list = await read($, steps)
    if (how.planDue && list.length > 0) {
      const set = await read($, settings)
      extra.push(
        `Model router: the conversation was summarized. The current plan (${await read($, planStatus)}), from the router's own record:\n${planText(list, set)}`,
      )
    }
    if (how.planDue) await update($, delivery, d => ({ ...d, planDue: false }))
    if (await read($, alwaysPlan)) extra.push(REMINDER)
    const pending = await read($, notes)
    if (pending.length) {
      extra.push(`Model router notes:\n${pending.map(n => `- ${n}`).join('\n')}`)
      await update($, notes, () => [])
    }
    if (extra.length === 0) return next(e)

    return next({ ...e, context: [...(e.context ?? []), ...extra] })
  })

  // A summarization of the main chat drops the rules and the plan from the
  // history: the next typed message brings them back.
  on('session.compact', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId || 'skip' in done) return done
    await update($, delivery, d => ({ ...d, inChat: false, planDue: true }))
    await refreshStatus($)

    return done
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (!e.tools.includes(PLAN_TOOL) || !e.tools.includes('Agent')) return composed
    // Under the SDK's preset (the desktop app) session sections ride the chat's first
    // message, which an open chat sent long ago: the rules go with a typed message instead.
    const isSystem = !e.traits.includes('sdk-preset')
    await update($, delivery, d => ({ ...d, via: isSystem ? 'system' : 'message' }))
    const hasRules = isSystem || (await read($, delivery)).inChat
    const model = hasRules ? modelOf(e.model) : undefined
    if ((await read($, policySent)).model !== model) {
      await update($, policySent, () => ({ model, sentAt: new Date().toISOString() }))
      await refreshStatus($)
    }
    if (!isSystem) return composed

    // Only the settings shape this text, so it stays stable and the prompt cache holds.
    return {
      sections: [...composed.sections, { id: 'model-router:policy', text: policy(await read($, settings)), scope: 'session' as const }],
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, renderPane)
}
