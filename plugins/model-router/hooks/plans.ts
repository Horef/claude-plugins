// Pure logic for O13: step artifact links, dependencies, approval gates, persistence, <hc> capture, and job health.
import type { JobCheckConfig, JobHealthState, JobStatus, PersistedPlan, PlanSummary, Settings, Step, StepLinks } from '../types'

const trimStr = (v: unknown, max = 240): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.trim()

  return t ? t.slice(0, max) : undefined
}

const uniqStr = (raw: unknown, max = 64): string[] | undefined => {
  if (!Array.isArray(raw)) return undefined
  const out: string[] = []
  for (const item of raw) {
    const s = trimStr(item, max)
    if (s && !out.includes(s)) out.push(s)
  }

  return out.length > 0 ? out : undefined
}

/** Normalizes a step's artifact links, dropping empty values; returns undefined when empty. */
export const cleanLinks = (raw: unknown): StepLinks | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const out: StepLinks = {}
  const branch = trimStr(r.branch, 120)
  const worktree = trimStr(r.worktree, 240)
  const helper = trimStr(r.helper, 64)
  const report = trimStr(r.report, 240)
  const jobs = uniqStr(r.jobs, 40)
  const refs = uniqStr(r.refs, 64)
  if (branch) out.branch = branch
  if (worktree) out.worktree = worktree
  if (helper) out.helper = helper
  if (report) out.report = report
  if (jobs) out.jobs = jobs
  if (refs) out.refs = refs

  return Object.keys(out).length > 0 ? out : undefined
}

/** Patches existing links with named fields from `patch`. Empty string or null clears a scalar; [] clears an array. */
export const mergeLinks = (base: StepLinks | undefined, patch: unknown): StepLinks | undefined => {
  if (!patch || typeof patch !== 'object') return base
  const r = patch as Record<string, unknown>
  const next: StepLinks = { ...(base ?? {}) }
  for (const key of ['branch', 'worktree', 'helper', 'report'] as const) {
    if (!(key in r)) continue
    const v = trimStr(r[key], key === 'helper' ? 64 : 240)
    if (v) next[key] = v
    else delete next[key]
  }
  for (const key of ['jobs', 'refs'] as const) {
    if (!(key in r)) continue
    if (Array.isArray(r[key])) {
      const v = uniqStr(r[key], key === 'jobs' ? 40 : 64)
      if (v) next[key] = v
      else delete next[key]
    } else if (r[key] === null) {
      delete next[key]
    }
  }

  return Object.keys(next).length > 0 ? next : undefined
}

export const asDeps = (raw: unknown): string[] | undefined => uniqStr(raw, 64)

export const asGate = (raw: unknown): boolean | string | undefined => {
  if (raw === true) return true
  if (typeof raw === 'string') {
    const t = raw.trim()
    return t ? t.slice(0, 120) : undefined
  }

  return undefined
}

export const gatePrompt = (gate: boolean | string | undefined): string =>
  typeof gate === 'string' && gate.trim() ? gate.trim() : 'approval needed'

/**
 * Validates dependsOn across a plan: removes unknown ids, self-dependencies, and back-edges that form cycles.
 * Returns the cleaned steps and human-readable warnings for router notes.
 */
export const validateDeps = (list: Step[]): { steps: Step[]; warnings: string[] } => {
  const ids = new Set(list.map(s => s.id))
  const warnings: string[] = []
  const cleaned = list.map(s => {
    if (!s.dependsOn?.length) return s
    const bad: string[] = []
    const kept: string[] = []
    for (const d of s.dependsOn) {
      if (d === s.id || !ids.has(d)) bad.push(d)
      else if (!kept.includes(d)) kept.push(d)
    }
    if (bad.length) warnings.push(`Step [${s.id}] ignored unknown/self dependsOn: ${bad.join(', ')}.`)

    return { ...s, dependsOn: kept.length ? kept : undefined }
  })

  // Detect and break cycles via DFS (0 = unvisited, 1 = visiting, 2 = done).
  const byId = new Map(cleaned.map(s => [s.id, s]))
  const color = new Map<string, number>()
  const dropEdge = new Map<string, Set<string>>()
  const cycles: string[] = []

  const dfs = (id: string) => {
    color.set(id, 1)
    const step = byId.get(id)
    for (const dep of step?.dependsOn ?? []) {
      const c = color.get(dep) ?? 0
      if (c === 1) {
        let set = dropEdge.get(id)
        if (!set) {
          set = new Set()
          dropEdge.set(id, set)
        }
        set.add(dep)
        cycles.push(`${id} -> ${dep}`)
      } else if (c === 0) {
        dfs(dep)
      }
    }
    color.set(id, 2)
  }

  for (const s of cleaned) {
    if ((color.get(s.id) ?? 0) === 0) dfs(s.id)
  }
  if (cycles.length) warnings.push(`Ignored dependency cycle (${cycles.join(', ')}).`)

  const final = cleaned.map(s => {
    const drop = dropEdge.get(s.id)
    if (!drop || !s.dependsOn) return s
    const kept = s.dependsOn.filter(d => !drop.has(d))

    return { ...s, dependsOn: kept.length ? kept : undefined }
  })

  return { steps: final, warnings }
}

/** Dependency ids of `s` that are not yet done. */
export const unmetDeps = (list: readonly Step[], s: Step): string[] => {
  if (!s.dependsOn?.length) return []
  const byId = new Map(list.map(x => [x.id, x]))

  return s.dependsOn.filter(id => byId.get(id)?.status !== 'done')
}

export const isBlocked = (list: readonly Step[], s: Step): boolean =>
  s.status === 'planned' && unmetDeps(list, s).length > 0

export const isGated = (s: Step): boolean =>
  s.status === 'planned' && !!s.gate && !s.gateApproved

/** Extra metadata suffix for `planText`: dependencies, gate state, and artifact links. */
export const stepMetaText = (list: readonly Step[], s: Step): string => {
  const parts: string[] = []
  const unmet = s.status === 'done' ? [] : unmetDeps(list, s)
  if (unmet.length) parts.push(`waits on ${unmet.join(', ')}`)
  if (s.gate) parts.push(`gate: ${gatePrompt(s.gate)} (${s.gateApproved ? 'approved' : 'waiting'})`)
  const l = s.links
  if (l?.branch) parts.push(`branch ${l.branch}`)
  if (l?.worktree) parts.push(`worktree ${l.worktree}`)
  if (l?.helper) parts.push(`helper ${l.helper}`)
  if (l?.jobs?.length) parts.push(`jobs ${l.jobs.join(', ')}`)
  if (l?.report) parts.push(`report ${l.report}`)
  if (l?.refs?.length) parts.push(`refs ${l.refs.join(', ')}`)

  return parts.length ? `, ${parts.join(', ')}` : ''
}

// --- Persistent named plans (O13) -------------------------------------------------

/** Normalizes a persistent plan name to a safe lowercase slug, or undefined if invalid. */
export const normPlanName = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)

  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(slug) ? slug : undefined
}

/** Deterministic 8-hex-char FNV-1a hash (no node:crypto dependency). */
const fnv1a = (s: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }

  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Stable per-project folder key from a canonical repo root (or cwd): `<basename>-<8hex>`. */
export const projectKeyOf = (root: string): string => {
  const clean = root.replace(/[\\/]+$/, '') || 'default'
  const base =
    clean
      .split(/[\\/]/)
      .filter(Boolean)
      .at(-1)
      ?.toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'project'

  return `${base}-${fnv1a(clean)}`
}

export const parsePersistedPlan = (raw: string): PersistedPlan | undefined => {
  try {
    const p = JSON.parse(raw) as Partial<PersistedPlan>
    if (!p || typeof p !== 'object' || p.version !== 1 || typeof p.name !== 'string' || !Array.isArray(p.steps)) return undefined
    const status = p.status === 'closed' ? 'closed' : 'open'

    return {
      version: 1,
      name: p.name,
      project: typeof p.project === 'string' ? p.project : '',
      status,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : new Date().toISOString(),
      revision: typeof p.revision === 'number' && Number.isFinite(p.revision) ? p.revision : 1,
      planStatus: p.planStatus === 'pending' || p.planStatus === 'approved' ? p.planStatus : 'approved',
      steps: p.steps,
    }
  } catch {
    return undefined
  }
}

export const planSummaryOf = (p: PersistedPlan): PlanSummary => {
  const leaves = p.steps.filter(s => !s.group)

  return {
    name: p.name,
    status: p.status,
    done: leaves.filter(s => s.status === 'done').length,
    total: leaves.length,
    updatedAt: p.updatedAt,
  }
}

const STATUS_RANK: Record<Step['status'], number> = { planned: 0, running: 1, done: 2 }

const unionArr = (a?: string[], b?: string[]): string[] | undefined => {
  const out = [...(a ?? [])]
  for (const x of b ?? []) if (!out.includes(x)) out.push(x)

  return out.length ? out : undefined
}

const mergeConcurrentLinks = (disk?: StepLinks, local?: StepLinks): StepLinks | undefined => {
  if (!disk && !local) return undefined
  const out: StepLinks = {
    ...(disk?.branch || local?.branch ? { branch: local?.branch ?? disk?.branch } : {}),
    ...(disk?.worktree || local?.worktree ? { worktree: local?.worktree ?? disk?.worktree } : {}),
    ...(disk?.helper || local?.helper ? { helper: local?.helper ?? disk?.helper } : {}),
    ...(disk?.report || local?.report ? { report: local?.report ?? disk?.report } : {}),
  }
  const jobs = unionArr(disk?.jobs, local?.jobs)
  const refs = unionArr(disk?.refs, local?.refs)
  if (jobs) out.jobs = jobs
  if (refs) out.refs = refs

  return Object.keys(out).length ? out : undefined
}

/**
 * Step-level merge when another session bumped `revision` on disk before this session wrote.
 * Keeps higher status progression (planned < running < done), union of links, and any gate approval.
 */
export const mergePersistedSteps = (disk: readonly Step[], local: readonly Step[]): Step[] => {
  const diskById = new Map(disk.map(s => [s.id, s]))
  const localIds = new Set(local.map(s => s.id))
  const merged = local.map(l => {
    const d = diskById.get(l.id)
    if (!d) return l
    const dWins = STATUS_RANK[d.status] > STATUS_RANK[l.status]
    const base = dWins ? d : l
    const other = dWins ? l : d

    return {
      ...base,
      gateApproved: base.gateApproved || other.gateApproved || undefined,
      links: mergeConcurrentLinks(d.links, l.links),
      verdict: base.verdict ?? other.verdict,
      why: base.why ?? other.why,
    }
  })
  // Preserve steps added on disk by another session
  for (const d of disk) {
    if (!localIds.has(d.id)) merged.push(d)
  }

  return merged
}

// --- Passive link capture from Herdr <hc from="tXX"> messages (O13) ---------------

const HC_MSG = /<hc\s+from="([^"]+)">([\s\S]*?)<\/hc>/

/**
 * Best-effort extraction of artifact links from a helper's `<hc from="tXX">` message.
 * Targets a unique step matching `links.helper === from` or an explicit `[stepId]` in the body.
 * Never overwrites scalar links already set by the lead; appends unique jobs and refs.
 */
export const extractHcLinks = (
  text: string,
  list: readonly Step[],
): { stepId: string; from: string; links: StepLinks; changed: boolean } | undefined => {
  const m = HC_MSG.exec(text)
  if (!m || list.length === 0) return undefined
  const from = m[1]!.trim()
  const body = m[2]!
  if (!from) return undefined

  const byHelper = list.filter(s => !s.group && s.links?.helper && (s.links.helper === from || s.links.helper.startsWith(`${from} `)))
  let target: Step | undefined
  if (byHelper.length === 1) {
    target = byHelper[0]
  } else {
    const pool = byHelper.length > 1 ? byHelper : list.filter(s => !s.group)
    const cited = new Set<string>()
    for (const hit of body.matchAll(/\[([a-zA-Z0-9._-]+)\]/g)) cited.add(hit[1]!)
    for (const hit of body.matchAll(/\bstep\s+([a-zA-Z0-9._-]+)\b/gi)) cited.add(hit[1]!)
    const matched = pool.filter(s => cited.has(s.id))
    if (matched.length === 1) target = matched[0]
  }
  if (!target) return undefined

  const jobs: string[] = []
  for (const hit of body.matchAll(/Submitted batch job (\d{5,9})\b/gi)) {
    if (!jobs.includes(hit[1]!)) jobs.push(hit[1]!)
  }
  for (const hit of body.matchAll(/\bjob[:# ]+(\d{5,9})\b/gi)) {
    if (!jobs.includes(hit[1]!)) jobs.push(hit[1]!)
  }
  const refs: string[] = []
  for (const hit of body.matchAll(/\b(R\d+|D\d+|PR#\d+)\b/g)) {
    if (!refs.includes(hit[1]!)) refs.push(hit[1]!)
  }
  const repMatch = /\breport[: ]+([\w./-]+\.md)\b/i.exec(body) ?? /(\.scratch\/REPORT\.md)\b/.exec(body)
  const report = repMatch?.[1]?.replace(/[.,;:]+$/, '')
  const brMatch = /\bbranch[: ]+([a-zA-Z0-9._/-]+)/i.exec(body)
  const branch = brMatch?.[1]?.replace(/[.,;:]+$/, '')

  const prev = target.links ?? {}
  const next: StepLinks = { ...prev }
  if (!next.helper) next.helper = from
  if (!next.branch && branch) next.branch = branch
  if (!next.report && report) next.report = report
  const mergedJobs = unionArr(prev.jobs, jobs)
  if (mergedJobs) next.jobs = mergedJobs
  const mergedRefs = unionArr(prev.refs, refs)
  if (mergedRefs) next.refs = mergedRefs

  const changed = JSON.stringify(prev) !== JSON.stringify(next)

  return { stepId: target.id, from, links: next, changed }
}

// --- Cluster job health checks (O13) ----------------------------------------------

const JOB_ID_RE = /^[A-Za-z0-9._-]{1,32}$/

export const validJobId = (id: string): boolean => JOB_ID_RE.test(id)

/** Effective jobCheck config: per-project override over global default; command '' means off. */
export const effectiveJobCheck = (set: Settings, projectKey: string): JobCheckConfig => {
  const base = set.jobCheck ?? { command: '', intervalSec: 0, timeoutMs: 15_000 }
  const proj = projectKey ? set.jobCheckByProject?.[projectKey] : undefined

  return {
    command: (proj?.command !== undefined ? proj.command : base.command) ?? '',
    intervalSec: proj?.intervalSec ?? base.intervalSec ?? 0,
    timeoutMs: proj?.timeoutMs ?? base.timeoutMs ?? 15_000,
  }
}

/** Unique valid job ids across non-done steps of the plan. */
export const activeJobIds = (list: readonly Step[]): string[] => {
  const out: string[] = []
  for (const s of list) {
    if (s.group || s.status === 'done') continue
    for (const id of s.links?.jobs ?? []) {
      if (validJobId(id) && !out.includes(id)) out.push(id)
    }
  }

  return out
}

const SLURM_BADGE: Record<string, { badge: string; bad?: boolean }> = {
  RUNNING: { badge: 'R' },
  R: { badge: 'R' },
  PENDING: { badge: 'PD' },
  PD: { badge: 'PD' },
  CONFIGURING: { badge: 'CF' },
  CF: { badge: 'CF' },
  COMPLETING: { badge: 'CG' },
  CG: { badge: 'CG' },
  COMPLETED: { badge: 'CD' },
  CD: { badge: 'CD' },
  FAILED: { badge: 'FAIL', bad: true },
  F: { badge: 'FAIL', bad: true },
  OUT_OF_MEMORY: { badge: 'OOM', bad: true },
  OOM: { badge: 'OOM', bad: true },
  TIMEOUT: { badge: 'TO', bad: true },
  TO: { badge: 'TO', bad: true },
  CANCELLED: { badge: 'CA', bad: true },
  CA: { badge: 'CA', bad: true },
  NODE_FAIL: { badge: 'NF', bad: true },
  NF: { badge: 'NF', bad: true },
  PREEMPTED: { badge: 'PR', bad: true },
}

/** Parses `squeue -h -o '%i %T %M %R'` (or `<id> <STATE> [elapsed] [reason...]`) lines. */
export const parseJobOutput = (stdout: string, queried: readonly string[]): Record<string, JobStatus> => {
  const out: Record<string, JobStatus> = {}
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const cols = line.split(/\s+/)
    const id = cols[0]
    const st = cols[1]?.toUpperCase()
    if (!id || !st || !validJobId(id)) continue
    const mapped = SLURM_BADGE[st] ?? { badge: st.slice(0, 6) }
    const elapsed = cols[2]
    const reason = cols.slice(3).join(' ') || undefined
    out[id] = { id, state: st, badge: mapped.badge, ...(elapsed ? { elapsed } : {}), ...(reason ? { reason } : {}), ...(mapped.bad ? { bad: true } : {}) }
  }
  for (const id of queried) {
    if (!out[id]) out[id] = { id, state: 'GONE', badge: 'gone' }
  }

  return out
}

export const formatJobSummary = (health: JobHealthState, ids: readonly string[]): string => {
  const items = ids.map(id => {
    const st = health.jobs[id]
    return st ? `${id} ${st.badge}${st.elapsed ? ` (${st.elapsed})` : ''}` : `${id} ?`
  })
  const head = health.stale ? 'Jobs (stale)' : 'Jobs'
  const err = health.error ? ` · error: ${health.error}` : ''

  return `${head}: ${items.join(', ')}${err}`
}
