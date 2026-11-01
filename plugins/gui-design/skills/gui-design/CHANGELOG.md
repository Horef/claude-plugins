# Changelog: gui-design

Newest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.

## 0.2.0 (2026-11-01)
- lint_ui.py checks same-origin and srcdoc iframes (Streamlit components) (O5)
- Frame problems carry the frame (`iframe#N (title or src) > selector`), each frame has its own density line and --max-* limits; cross-origin frames give a `frame-skipped` note. The settle wait (browser.py) also watches same-origin frames. New scripts/lint_frames.js, evals/fixtures/host.html.

## 0.1.0 (2026-11-01)
- First release: layer rule, pattern table, visual-calm and wording rules, surfaces, build-lint-shoot-look loop, rework procedure; references distilled from Refactoring UI, Designing Interfaces, About Face, Few, Strategic Writing for UX, NN/g, Pajamas, Distill, Victor and CLIG; worked case of an overloaded replay viewer; `scripts/shot.py` and `scripts/lint_ui.py` (headless Chrome over the DevTools protocol, stdlib only); `profile.example.md`; evals: `run.py` 34 scripted checks, 6 judged cases plus triggers.
