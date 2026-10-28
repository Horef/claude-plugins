import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, ModelUsage, Register } from 'claude-code'

import type { CostView, HistoryEntry, Lifetime, Settings, Step, Tier, Totals, Usage } from '../types'
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
  VERSION,
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
const EMPTY_TOTALS: Totals = { mainCost: 0, agentCost: 0, mainEquivalent: 0, steps: 0 }
const newLifetime = (): Lifetime => ({ ...EMPTY_TOTALS, since: new Date().toISOString(), plans: 0, byTier: { light: 0, standard: 0, deep: 0 } })
const chatTotals = atom({ plugin: 'model-router', key: 'chatTotals' } as const, EMPTY_TOTALS)
const planBase = atom({ plugin: 'model-router', key: 'planBase' } as const, { mainCost: 0 })
const costView = atom({ plugin: 'model-router', key: 'costView' } as const, 'plan')
const lifetime = atom({ plugin: 'model-router', key: 'lifetime' } as const, newLifetime())

const STORE = { auto: 'autoApprove', always: 'alwaysPlan', settings: 'settings', history: 'history', lifetime: 'lifetime' }
const HISTORY_CAP = 500

// What the router saw in this load, for the plan tool's status check.
const diag = { turns: 0, appends: 0, composes: 0, lastError: '' }

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
  const life = (await $.store.get(STORE.lifetime)) as Lifetime | undefined
  await update($, lifetime, () => (life?.since ? { ...newLifetime(), ...life } : newLifetime()))
}

async function editLifetime($: EngineInterface, fn: (l: Lifetime) => Lifetime) {
  await update($, lifetime, fn)
  await $.store.set(STORE.lifetime, await read($, lifetime))
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
  const money = cost > 0 ? ` · plan agents ≈${fmtUsd(cost)}${saved > 0 ? `, saved ≈${fmtUsd(saved)}` : ''}` : ''

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
  status?: boolean
  steps?: { id: string; title: string; tier: Tier; where?: 'agent' | 'here' }[]
  done?: string[]
}

// Run = go with the plan as it stands in the pane (tier, where, model, thinking edits
// included). Change = the steps themselves need work (add, drop, split, reword).
const APPROVE = 'Run it'
const APPROVE_AUTO = 'Run it, and auto-approve future plans'
const REVISE = 'Change the steps'


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
  const view = await read($, costView)
  const chat = await read($, chatTotals)
  const base = await read($, planBase)
  const life = await read($, lifetime)
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

  // A settings row: what the switch does on the left, On/Off on the right.
  const switchRow = (key: string, label: string, help: string, isOn: boolean, onPress: () => void) => (
    <Box key={`row:${key}`} flexDirection="row" justifyContent="space-between" alignItems="center" columnGap="sm">
      <Box flexDirection="column" flexShrink={1}>
        <Text weight="medium">{label}</Text>
        <Text dimColor size="footnote" wrap="wrap">{help}</Text>
      </Box>
      <Button key={key} variant={isOn ? 'primary' : 'secondary'} onPress={onPress}>
        {isOn ? 'On' : 'Off'}
      </Button>
    </Box>
  )

  const group = (title: string, help?: string) => (
    <Box flexDirection="column" marginTop="xs">
      <Text size="footnote" weight="semibold" color="subtle">{title.toUpperCase()}</Text>
      {help ? <Text dimColor size="footnote" wrap="wrap">{help}</Text> : null}
    </Box>
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

  const savedOf = (t: Totals) => Math.max(0, t.mainEquivalent - t.agentCost)
  const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')
  const since = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  const VIEWS: { value: CostView; label: string }[] = [
    { value: 'plan', label: 'This plan' },
    { value: 'chat', label: 'This chat' },
    { value: 'all', label: 'All time' },
  ]

  // The money at the top: one span at a time, picked with a small segmented switch.
  const costCard = () => {
    const planMain = Math.max(0, m.cost - base.mainCost)
    const chatSaved = savedOf(chat)
    const lifeSaved = savedOf(life)
    const body =
      view === 'plan' ? (
        <Box flexDirection="row" columnGap="md">
          {stat(`Main chat${m.model ? ` · ${m.model}` : ''}`, `≈${fmtUsd(planMain)}`)}
          {stat('Subagents', `≈${fmtUsd(agentCost)}`)}
          {stat('Saved', saved > 0 ? `≈${fmtUsd(saved)}` : '—', saved > 0 ? 'success' : undefined)}
        </Box>
      ) : view === 'chat' ? (
        <Box flexDirection="row" columnGap="md">
          {stat(`Main chat${m.model ? ` · ${m.model}` : ''}`, `≈${fmtUsd(m.cost)}`)}
          {stat('Subagents', `≈${fmtUsd(chat.agentCost)}`)}
          {stat('Saved', chatSaved > 0 ? `≈${fmtUsd(chatSaved)}` : '—', chatSaved > 0 ? 'success' : undefined)}
        </Box>
      ) : (
        <Box flexDirection="row" columnGap="md">
          {stat('Saved', lifeSaved > 0 ? `≈${fmtUsd(lifeSaved)}` : '—', lifeSaved > 0 ? 'success' : undefined)}
          {stat('Subagents cost', `≈${fmtUsd(life.agentCost)}`)}
          {stat('On main model', `≈${fmtUsd(life.mainEquivalent)}`)}
        </Box>
      )
    const foot =
      view === 'plan'
        ? `Since this plan was posted${base.at ? ` (${new Date(base.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })})` : ''}. A new plan starts a new count.`
        : view === 'chat'
          ? `Since this chat was opened or its plugins reloaded: ${chat.steps} delegated steps. Earlier turns are not counted.`
          : `Since ${since(life.since)}: ${life.steps} delegated steps in ${life.plans} plans (light ${life.byTier.light} · standard ${life.byTier.standard} · deep ${life.byTier.deep}). Delegating cut their cost by ${pct(lifeSaved, life.mainEquivalent)}; main chats cost ≈${fmtUsd(life.mainCost)}.`
    return (
      <Box flexDirection="column" rowGap="xs" borderStyle="round" borderColor="subtle" paddingX="sm" paddingY="xs">
        <Box flexDirection="row" columnGap="xs">
          {VIEWS.map(v => (
            <Button key={`cost-view:${v.value}`} plain={v.value !== view ? true : undefined} variant={v.value === view ? 'primary' : undefined} onPress={() => void update($, costView, () => v.value)}>
              {v.label}
            </Button>
          ))}
        </Box>
        {body}
        <Text dimColor size="caption" wrap="wrap">{foot}</Text>
      </Box>
    )
  }

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
          {pick(`where:${s.id}`, s.where, [{ value: 'agent', label: 'subagent' }, { value: 'here', label: 'here' }], v =>
            void editStep($, s.id, x => ({ ...x, where: v as Step['where'] })),
          )}
          {pick(`tier:${s.id}`, s.tier, TIER_ORDER.map(t => ({ value: t, label: t })), v =>
            void editStep($, s.id, x => ({ ...x, tier: v as Tier })),
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
        {s.where === 'here' && (
          <Text dimColor size="footnote">
            {`Done in this chat, on ${m.model ?? "this chat's model"}. The tier only picks a model if you send the step to a subagent.`}
          </Text>
        )}
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

      {isSettingsOpen && (
        <Box key="settings-panel" flexDirection="column" rowGap="sm" borderStyle="round" borderColor="subtle" paddingX="md" paddingY="sm">
          <Text size="heading" weight="semibold">Settings</Text>

          {group('Behaviour')}
          {switchRow('always', 'Always plan', 'Plan before any message that needs tools, not only multi-step ones.', always, () => void setAlways($, !always))}
          {switchRow('auto', 'Auto-approve', 'Run new plans without asking first.', auto, () => void setAuto($, !auto))}
          {switchRow('open-pane', 'Open pane on start', 'Open this pane in every new chat.', set.openPane, () =>
            void editSettings($, s => ({ ...s, openPane: !s.openPane })),
          )}

          {group('Tiers', 'Model and thinking level for steps sent to a subagent. "Here" steps always use this chat\'s model.')}
          {TIER_ORDER.map(t => {
            const ts = set.tiers[t]
            const edit = (patch: Partial<typeof ts>) =>
              void editSettings($, s => ({ ...s, tiers: { ...s.tiers, [t]: { ...s.tiers[t], ...patch } } }))
            return (
              <Box key={`tierset:${t}`} flexDirection="column" rowGap="xs" borderStyle="round" borderColor={TIER_COLOR[t]} paddingX="sm" paddingY="xs">
                <Box flexDirection="row" justifyContent="space-between" alignItems="center">
                  <Text color={TIER_COLOR[t]} weight="semibold">{t}</Text>
                  <Button key={`set-scope:${t}`} plain dimColor={!ts.scopeNote} onPress={() => edit({ scopeNote: !ts.scopeNote })}>
                    {ts.scopeNote ? '✓ Scope note' : 'Scope note off'}
                  </Button>
                </Box>
                <Text dimColor size="footnote" wrap="wrap">{TIER_USE[t]}</Text>
                <Box flexDirection="row" flexWrap="wrap" columnGap="xs" rowGap="xs">
                  {pick(`set-model:${t}`, ts.model, MODELS.map(x => ({ value: x, label: x })), v => edit({ model: v as typeof ts.model }))}
                  {pick(`set-effort:${t}`, ts.effort, EFFORTS.map(x => ({ value: x, label: `${x} thinking` })), v => edit({ effort: v as typeof ts.effort }))}
                </Box>
              </Box>
            )
          })}
          <Text dimColor size="footnote" wrap="wrap">
            Scope note: one line added to that tier's briefs, asking the subagent to stay on its task and not start sessions or load extra tools.
          </Text>

          {group('Skills', 'Skills listed here run in a subagent on the tier you pick.')}
          {mapped.length + unmapped.length === 0 && (
            <Text dimColor size="footnote" wrap="wrap">None yet. Skills you use in a chat appear here, or add one by name.</Text>
          )}
          {[...mapped.map(([n]) => n), ...unmapped].map(name => (
            <Box key={`skill:${name}`} flexDirection="row" justifyContent="space-between" alignItems="center" columnGap="sm">
              <Text mono size="footnote" wrap="truncate">{name}</Text>
              {pick(
                `skill-tier:${name}`,
                set.skills[name] ?? 'off',
                [{ value: 'off', label: 'in this chat' }, ...TIER_ORDER.map(t => ({ value: t, label: t }))],
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
          {Input && (
            <Input
              key="add-skill"
              placeholder="Skill name, e.g. scientific-figures"
              submitLabel="Add"
              onSubmit={v => {
                const name = v.trim()
                if (name) void editSettings($, s => ({ ...s, skills: { ...s.skills, [name]: s.skills[name] ?? 'standard' } }))
              }}
            />
          )}

          <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop="xs">
            <Box flexDirection="row" columnGap="xs">
              <Button key="reset-tiers" plain dimColor onPress={() => void editSettings($, s => ({ ...s, tiers: DEFAULT_SETTINGS.tiers }))}>
                Reset tiers
              </Button>
              <Button key="clear-history" plain dimColor onPress={() => void editHistory($, () => [])}>
                Clear history
              </Button>
              <Button key="reset-stats" plain dimColor onPress={() => void editLifetime($, () => newLifetime())}>
                Reset statistics
              </Button>
            </Box>
            <Button key="settings-done" variant="primary" onPress={() => void update($, showSettings, () => false)}>
              Done
            </Button>
          </Box>
        </Box>
      )}

      {costCard()}

      {status === 'pending' && (
        <Box borderStyle="round" borderColor="warning" paddingX="sm" paddingY="xs">
          <Text color="warning" size="footnote">
            Change tiers, models or where steps run below, then pick "Run it" in the chat. To add, drop or reword steps, pick "Change the steps".
          </Text>
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
          status: { type: 'boolean', description: 'Report what the router sees (version, rule delivery, counters) instead of the plan' },
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

    if (input.status) {
      const report = {
        version: VERSION,
        delivery: await read($, delivery),
        rulesSentTo: (await read($, policySent)).model ?? null,
        alwaysPlan: await read($, alwaysPlan),
        autoApprove: await read($, autoApprove),
        steps: (await read($, steps)).length,
        ...diag,
      }
      return { result: `model-router status: ${JSON.stringify(report)}` }
    }
    if (input.done) {
      await update($, steps, list => list.map(s => (input.done!.includes(s.id) ? { ...s, status: 'done' } : s)))
    }
    await refreshStatus($)
    if (!input.steps) return withNotes(planText(await read($, steps), set))

    const old = await read($, steps)
    // A plan that shares no step with the last one starts its own cost count.
    const isNewPlan = !old.some(o => input.steps!.some(s => s.id === o.id))
    if (isNewPlan) {
      const mainCost = (await read($, main)).cost
      await update($, planBase, () => ({ mainCost, at: new Date().toISOString() }))
    }
    await update($, steps, () =>
      input.steps!.map(s => {
        const was = old.find(o => o.id === s.id)
        return was ? { ...was, title: s.title, tier: s.tier, where: s.where ?? 'agent' } : newStep(s.id, s.title, s.tier, s.where ?? 'agent')
      }),
    )
    void $.ui.open({ id: PANE, title: 'Model router' })

    if (await read($, autoApprove)) {
      if (isNewPlan) await editLifetime($, l => ({ ...l, plans: l.plans + 1 }))
      await update($, planStatus, () => 'approved')
      await refreshStatus($)
      return withNotes(`Plan auto-approved:\n${planText(await read($, steps), set)}`)
    }

    await update($, planStatus, () => 'pending')
    await refreshStatus($)
    let answer: string
    try {
      answer = await $.ui.ask(
        'Run this plan? Edits you make in the Model router pane (tier, where, model, thinking) are kept either way. To add, drop, split or reword steps, pick "Change the steps", or type what to change under Other.',
        {
          header: 'Plan',
          options: [APPROVE, APPROVE_AUTO, REVISE],
        },
      )
    } catch {
      await update($, planStatus, () => 'none')
      await refreshStatus($)
      return { result: 'The user dismissed the plan. Ask them how to proceed before delegating anything.' }
    }

    if (answer === APPROVE || answer === APPROVE_AUTO) {
      if (answer === APPROVE_AUTO) await setAuto($, true)
      if (isNewPlan) await editLifetime($, l => ({ ...l, plans: l.plans + 1 }))
      await update($, planStatus, () => 'approved')
      await refreshStatus($)
      const now = await read($, settings)
      return withNotes(
        `Plan approved by the user (follow these tiers; they may differ from what you proposed):\n${planText(await read($, steps), now)}`,
      )
    }
    await update($, planStatus, () => 'none')
    await refreshStatus($)
    const note = answer === REVISE ? 'They gave no details yet: ask them what to change before anything else.' : `What they want changed: ${answer}`
    const kept = planText(await read($, steps), await read($, settings))

    return {
      result: `The user wants the steps changed before anything runs. ${note}\nTheir pane edits so far are in this version; keep a step's id when you keep the step, so its edits carry over:\n${kept}\nThen call ${PLAN_TOOL} again with the revised steps.`,
    }
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
      const cost = costOf(used, model)
      await update($, main, m => ({ usage: addUsage(m.usage, used), cost: m.cost + cost, model: model ?? m.model }))
      await editLifetime($, l => ({ ...l, mainCost: l.mainCost + cost }))
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
    const turnCost = costOf(used, ranOn.model)
    const turnEquivalent = costOf(used, mainModel)
    const cost = step.cost + turnCost
    const isFirstFinish = step.status !== 'done'
    const add = (t: Totals): Totals => ({
      ...t,
      agentCost: t.agentCost + turnCost,
      mainEquivalent: t.mainEquivalent + turnEquivalent,
      steps: t.steps + (isFirstFinish ? 1 : 0),
    })
    await update($, chatTotals, add)
    await editLifetime($, l => ({
      ...add(l),
      since: l.since,
      plans: l.plans,
      byTier: isFirstFinish ? { ...l.byTier, [step.tier]: l.byTier[step.tier] + 1 } : l.byTier,
    }))

    await editStep($, step.id, s => ({
      ...s,
      status: 'done',
      usage,
      cost,
      mainCost: s.mainCost + turnEquivalent,
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
  // Each main-loop turn starts with a hidden note the model reads (a meta row in the
  // conversation): the rules when none are in the chat (the system prompt cannot be
  // relied on: the desktop app supplies its own), the plan again after a summarization,
  // the Always-plan reminder and router notes. Written straight into the chat, it
  // does not depend on how the prompt arrived.
  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)
    diag.turns += 1
    const extra: string[] = []
    const how = await read($, delivery)
    if (!how.inChat) extra.push(policy(await read($, settings)))
    const list = await read($, steps)
    if (how.planDue && list.length > 0) {
      extra.push(
        `Model router: the conversation was summarized. The current plan (${await read($, planStatus)}), from the router's own record:\n${planText(list, await read($, settings))}`,
      )
    }
    if (await read($, alwaysPlan)) extra.push(REMINDER)
    const pending = await read($, notes)
    if (pending.length) extra.push(`Model router notes:\n${pending.map(n => `- ${n}`).join('\n')}`)

    if (extra.length > 0) {
      try {
        await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: extra.join('\n\n') }] } })
        diag.appends += 1
        await update($, delivery, d => ({ ...d, inChat: true, planDue: false }))
        await update($, notes, () => [])
      } catch (err) {
        diag.lastError = `append: ${String(err).slice(0, 200)}`
      }
    }

    return next(e)
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
    diag.composes += 1
    // Under the SDK's preset (the desktop app) session sections ride the chat's first
    // message, which an open chat sent long ago: the rules go with a typed message instead.
    const isSystem = !e.traits.includes('sdk-preset')
    await update($, delivery, d => ({ ...d, via: isSystem ? 'system' : 'message' }))
    // A host with its own system prompt drops added sections without a trace, so only
    // rules written into the chat count as delivered.
    const hasRules = (await read($, delivery)).inChat
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
