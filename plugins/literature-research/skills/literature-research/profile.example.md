# literature-research profile (copy to ~/.config/literature-research/profile.md and edit)
Read by the literature-research skill at setup. Each line overrides a default.

## Sources
- Default sources: PubMed, Semantic Scholar, arXiv, OpenAlex, the web; DEVONthink when reachable.
- Where my papers live: <DEVONthink database names | a folder>
- Paywalled papers: <DEVONthink, then list them in to_fetch.md for me | abstracts only>
- Where I save papers I fetch for you: <a DEVONthink group (link) | a folder>
- API keys (environment variables or the macOS Keychain, never in files): NCBI_API_KEY, S2_API_KEY (both optional; S2_API_KEY is also read from the Keychain item of that name: `security add-generic-password -a "$USER" -s S2_API_KEY -w`)

## Output
- Folder: docs/literature/<topic>/ in the project; papers to the project's references/papers/; a pointer in the project's paper notes.

## Models per step
- Frame and synthesise: deep. Search, screen, extract: standard (helpers when usage is tight). Verify: light/standard, another model family.
