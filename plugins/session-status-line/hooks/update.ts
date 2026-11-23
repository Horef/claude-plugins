// Update check helpers, shared by the Horef/claude-plugins mods (the same file sits in each mod, since a
// plugin in Claude Code's cache cannot import from outside its folder). Pure: no `$`, no I/O; the mod reads
// plugin.json, fetches the manifest and keeps the state in its own store. Generic over the mod's name.

export const REPO = 'Horef/claude-plugins'
export const MARKETPLACE = 'horef-claude-plugins'
export const GUIDE_HOME = 'https://horef.github.io/claude-plugins/'
export const UPDATING_URL = 'https://horef.github.io/claude-plugins/updating.html'
export const CHECK_TIMEOUT_MS = 5000
export const OK_EVERY_MS = 24 * 3_600_000 // after a successful check
export const FAILED_EVERY_MS = 6 * 3_600_000 // after a failed one (offline, blocked, rate-limited)

/** What a mod keeps (in its store, per Claude account) about the update check. `toasted`: the version last announced. */
export type UpdateState = { lastCheck?: string; lastOk?: boolean; latest?: string; dismissed?: string; toasted?: string }

export const guideUrl = (mod: string) => `${GUIDE_HOME}${mod}.html`
export const manifestUrl = (mod: string) => `https://raw.githubusercontent.com/${REPO}/main/plugins/${mod}/.claude-plugin/plugin.json`
export const changelogUrl = (mod: string) => `https://github.com/${REPO}/blob/main/plugins/${mod}/CHANGELOG.md`
export const installCommand = (mod: string) => `/plugin install ${mod} --marketplace ${REPO}`

/** "1.2.3" → [1, 2, 3]; anything else (pre-releases, a leading "v", junk) → undefined. */
export const parseVersion = (s: unknown): [number, number, number] | undefined => {
  const m = typeof s === 'string' ? /^(\d+)\.(\d+)\.(\d+)$/.exec(s) : null
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined
}

/** True only when both parse and `latest` is above `installed`. */
export const isNewer = (latest: unknown, installed: unknown): boolean => {
  const a = parseVersion(latest)
  const b = parseVersion(installed)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

/** Whether a check is due at `now` (ms): 24 h after a successful one, 6 h after a failed one, at once when there is none. */
export const dueForCheck = (now: number, state: UpdateState | undefined): boolean => {
  const last = state?.lastCheck ? Date.parse(state.lastCheck) : NaN
  if (!Number.isFinite(last)) return true
  const since = now - last
  if (since < 0) return since < -OK_EVERY_MS // written a moment ago by another chat; a stamp from far ahead is distrusted
  return since >= (state?.lastOk === false ? FAILED_EVERY_MS : OK_EVERY_MS)
}

/** True when the plugin is not run from Claude Code's plugin cache (a checkout, --plugin-dir, CLAUDE_CODE_PLUGIN_DIRS). */
export const isDevInstall = (root: string): boolean => !/[\\/]plugins[\\/]cache[\\/]/.test(root)

/** The version in a fetched plugin.json text, or undefined when it is not a plain release. */
export const versionOfManifest = (text: string): string | undefined => {
  try {
    const v = (JSON.parse(text) as { version?: unknown }).version
    return parseVersion(v) ? (v as string) : undefined
  } catch {
    return undefined
  }
}

/** The state after a check at `now` (ms): `latest` is the version found, undefined for a failed check (the old one stays). */
export const afterCheck = (state: UpdateState | undefined, now: number, latest: string | undefined): UpdateState => ({
  ...state,
  lastCheck: new Date(now).toISOString(),
  lastOk: latest !== undefined,
  ...(latest !== undefined ? { latest } : {}),
})

/** Whether to announce `state.latest` now: newer than installed, not dismissed, not announced before. */
export const shouldAnnounce = (state: UpdateState, installed: string): boolean =>
  !!state.latest && isNewer(state.latest, installed) && state.dismissed !== state.latest && state.toasted !== state.latest

/** The request a person sends to Claude to update the mod (Claude runs it with its shell, which also works in the desktop app). */
export const updateRequest = (mod: string): string =>
  `Please update my ${mod} plugin: run \`claude plugin marketplace update ${MARKETPLACE}\` and then ` +
  `\`claude plugin update ${mod}@${MARKETPLACE}\`, tell me what version I have now, and remind me to type /reload-plugins in my open chats.`
