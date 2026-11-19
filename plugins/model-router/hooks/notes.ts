// Model notes: what the router knows of each model (a shipped seed, the file model-notes.json over it), and how a note is found and checked.
import type { ModelNote, ModelTag } from '../types'

export const TAGS: readonly ModelTag[] = ['code', 'review', 'research', 'judgment', 'long-context', 'fast', 'cheap', 'careful', 'second-opinion', 'agentic']

const SEED_DAY = '2026-11-19'

const seed = (n: Omit<ModelNote, 'checked' | 'by' | 'sources'> & { sources?: ModelNote['sources'] }): ModelNote => ({ sources: [], ...n, checked: SEED_DAY, by: 'seed' })

/** The notes the router ships with (dated 2026-11-19); a note in model-notes.json for the same id wins. */
export const SEED_NOTES: readonly ModelNote[] = [
  seed({
    id: 'gemini-4-neon',
    name: 'Gemini 4 Neon',
    providers: ['agy', 'copilot'],
    released: '2026-11-18',
    summary: "Google's mid-top Gemini 4 model; about level with Claude Opus 5.5 on Artificial Analysis's index (61 vs 59 at xhigh, vendor-reported)",
    strengths: ['reasoning and science benchmarks', 'agentic work', 'speed for its tier', '1M context (Antigravity may cap at 512K)'],
    weaknesses: ['hallucinates more than Argon or Hydrogen (13.9% at high)', 'knowledge cutoff March 2026', 'Opus ahead on Terminal-Bench 4.1 and FrontierCode'],
    tags: ['judgment', 'agentic', 'research', 'long-context', 'second-opinion'],
    fits: [
      { tier: 'deep', effort: 'high', why: "Opus-class judgment off Claude's quota" },
      { tier: 'second', effort: 'high', why: 'a second opinion from another family' },
      { tier: 'standard', effort: 'medium', why: 'about half the cost of high' },
    ],
    sources: [
      { title: 'Gemini API changelog', url: 'https://ai.google.dev/gemini-api/docs/changelog', date: '2026-11-18' },
      { title: 'Antigravity changelog', url: 'https://antigravity.google/docs/changelog/', date: '2026-11-18' },
      { title: 'Gemini 4 Neon announcement (9to5Google)', url: 'https://9to5google.com/2026/11/18/gemini-4-neon-announcement/', date: '2026-11-18' },
    ],
  }),
  seed({
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    providers: ['agy', 'copilot'],
    released: '2026-10-13',
    summary: 'Long-running Gemini 4 model with the lowest hallucination rate in the family; not deprecated (no shutdown date)',
    strengths: ['careful answers (4.3% hallucination at high)'],
    weaknesses: ['slower and pricier per task than Neon (index 50 vs 60 at high)'],
    tags: ['careful', 'review', 'second-opinion'],
    fits: [{ tier: 'second', effort: 'high', why: 'careful second opinion' }],
    sources: [{ title: 'Gemini API deprecations', url: 'https://ai.google.dev/gemini-api/docs/deprecations' }],
  }),
  seed({
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    providers: ['agy'],
    released: '2026-11-12',
    summary: 'Fast everyday Gemini 4 model; the owner rates high about Sonnet 5.5 high',
    strengths: [],
    weaknesses: [],
    tags: ['fast', 'cheap', 'code', 'second-opinion'],
    fits: [{ tier: 'standard', effort: 'high', why: 'about Sonnet 5.5 high, by the owner\'s rating' }],
  }),
  seed({
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    providers: ['agy'],
    summary: 'Small fast Gemini model',
    strengths: [],
    weaknesses: [],
    tags: ['fast', 'cheap'],
    fits: [{ tier: 'light', effort: 'high', why: 'mechanical work' }],
  }),
  seed({
    id: 'claude-haiku-5-5',
    name: 'Claude Haiku 5.5',
    providers: ['claude', 'kiro', 'copilot'],
    summary: 'Fast, cheap Claude model for mechanical work with a clear rule',
    strengths: ['speed', 'price'],
    weaknesses: ['open judgment'],
    tags: ['fast', 'cheap'],
    fits: [{ tier: 'light', effort: 'low', why: 'finding, listing, extracting, scanning' }],
  }),
  seed({
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    providers: ['claude', 'kiro', 'copilot', 'agy'],
    summary: 'Code to a spec, summaries and research at a middle price',
    strengths: ['following detailed instructions', 'code'],
    weaknesses: ['open-ended judgment'],
    tags: ['code', 'research'],
    fits: [{ tier: 'standard', effort: 'medium', why: 'writing code to a spec, summaries, web research' }],
  }),
  seed({
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    providers: ['claude', 'kiro', 'copilot', 'agy'],
    summary: 'Open judgment: research and design decisions, debugging unclear failures, reviewing reasoning',
    strengths: ['judgment', 'hard debugging'],
    weaknesses: ['price'],
    tags: ['judgment', 'review', 'code', 'agentic'],
    fits: [{ tier: 'deep', effort: 'high', why: 'open judgment' }],
  }),
  seed({
    id: 'claude-fable-5-2',
    name: 'Claude Fable 5.2',
    providers: ['claude'],
    summary: 'The strongest Claude model, and the priciest',
    strengths: ['the hardest problems'],
    weaknesses: ['price'],
    tags: ['judgment', 'careful', 'agentic'],
    fits: [{ tier: 'deep', effort: 'xhigh', why: 'the hardest judgment' }],
  }),
]

/** Aliases the router uses for the Claude models, to the id their notes are kept under. */
export const ALIASES: Record<string, string> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
  fable: 'claude-fable-5-2',
}

/** An id as compared: lowercase, dots and dashes the same (Kiro's `claude-sonnet-5.5` is Antigravity's `claude-sonnet-5-5`). */
export const normId = (id: string) => id.trim().toLowerCase().replace(/\./g, '-')

/** The seed as a map, then the file's notes over it (the file wins for the same id). */
export const mergeNotes = (file: Record<string, ModelNote> | undefined): Record<string, ModelNote> => ({
  ...Object.fromEntries(SEED_NOTES.map(n => [n.id, n])),
  ...(file ?? {}),
})

/** The note for an id the CLI or a chat names: exact id, else an alias, else the normalised form. */
export const findNote = (notes: Record<string, ModelNote>, id: string): ModelNote | undefined => {
  if (Object.hasOwn(notes, id)) return notes[id]
  const lower = id.trim().toLowerCase()
  const aliased = Object.hasOwn(ALIASES, lower) ? ALIASES[lower] : undefined
  if (aliased && Object.hasOwn(notes, aliased)) return notes[aliased]
  const want = normId(aliased ?? id)

  return Object.values(notes).find(n => normId(n.id) === want)
}

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const strings = (v: unknown, max = 12, len = 300) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(x => x.trim().slice(0, len)).slice(0, max) : [])

/** A note as the main agent sends it (no `by`, no `checked`): the note, or why it is not taken; `dropped` lists what was left out of a note that was taken. */
export const checkNote = (raw: unknown, today: string): { note?: ModelNote; error?: string; dropped: string[] } => {
  const dropped: string[] = []
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const id = typeof r.id === 'string' ? r.id.trim().toLowerCase() : ''
  if (!/^[a-z0-9][a-z0-9._-]{0,80}$/.test(id)) return { error: `note id ${JSON.stringify(r.id)} is not a model id (lowercase letters, digits, . _ -)`, dropped }
  const summary = typeof r.summary === 'string' ? r.summary.trim().replace(/\s+/g, ' ').slice(0, 300) : ''
  if (!summary) return { error: `note ${id}: summary (one line) is missing`, dropped }
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 80) : id
  const tags: ModelTag[] = []
  for (const t of strings(r.tags, 30, 40)) {
    if (TAGS.includes(t as ModelTag)) {
      if (!tags.includes(t as ModelTag)) tags.push(t as ModelTag)
    } else dropped.push(`tag "${t}" on ${id}`)
  }
  const fits = (Array.isArray(r.fits) ? r.fits : []).flatMap(f => {
    const x = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>
    if (typeof x.tier !== 'string' || !x.tier.trim() || typeof x.why !== 'string') {
      dropped.push(`a fit on ${id} (needs tier and why)`)

      return []
    }

    return [{ tier: x.tier.trim().slice(0, 30), ...(typeof x.effort === 'string' && x.effort ? { effort: x.effort.slice(0, 20) } : {}), why: x.why.trim().slice(0, 200) }]
  })
  const sources = (Array.isArray(r.sources) ? r.sources : []).flatMap(s => {
    const x = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>
    if (typeof x.url !== 'string' || !/^https?:\/\//i.test(x.url)) {
      dropped.push(`a source on ${id} (needs an http(s) url)`)

      return []
    }

    return [{ title: typeof x.title === 'string' && x.title.trim() ? x.title.trim().slice(0, 120) : x.url, url: x.url.trim().slice(0, 300), ...(isDay(x.date) ? { date: x.date } : {}) }]
  })
  if (r.released !== undefined && !isDay(r.released)) dropped.push(`released "${String(r.released)}" on ${id} (needs YYYY-MM-DD)`)

  return {
    dropped,
    note: {
      id,
      name,
      providers: strings(r.providers, 12, 40),
      ...(isDay(r.released) ? { released: r.released } : {}),
      summary,
      strengths: strings(r.strengths),
      weaknesses: strings(r.weaknesses),
      tags,
      fits,
      sources,
      checked: today,
      by: 'agent',
    },
  }
}

/** The notes file's text as a map of notes, tolerating a damaged file (what is not a note is left out). */
export const parseNotesFile = (text: string | undefined): Record<string, ModelNote> => {
  try {
    const models = (JSON.parse(text ?? '') as { models?: Record<string, unknown> } | null)?.models
    if (!models || typeof models !== 'object') return {}
    const out: Record<string, ModelNote> = {}
    for (const [key, v] of Object.entries(models)) {
      const x = v as Partial<ModelNote> | null
      if (!x || typeof x !== 'object' || typeof x.summary !== 'string') continue
      out[key] = {
        id: typeof x.id === 'string' ? x.id : key,
        name: typeof x.name === 'string' ? x.name : key,
        providers: strings(x.providers),
        ...(isDay(x.released) ? { released: x.released } : {}),
        summary: x.summary,
        strengths: strings(x.strengths),
        weaknesses: strings(x.weaknesses),
        tags: strings(x.tags).filter((t): t is ModelTag => TAGS.includes(t as ModelTag)),
        fits: Array.isArray(x.fits) ? x.fits.filter(f => f && typeof f.tier === 'string' && typeof f.why === 'string') : [],
        sources: Array.isArray(x.sources) ? x.sources.filter(s => s && typeof s.url === 'string') : [],
        checked: isDay(x.checked) ? x.checked : SEED_DAY,
        by: x.by === 'agent' || x.by === 'person' ? x.by : 'person',
      }
    }

    return out
  } catch {
    return {}
  }
}
