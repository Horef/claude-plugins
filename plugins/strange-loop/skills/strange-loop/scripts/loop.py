#!/usr/bin/env python3
"""strange-loop: observations, reflection queue and integrity checks for skills that improve themselves (stdlib only).

The protocol is plain Markdown (see the strange-loop SKILL.md); this script only makes it cheap and checkable.
A "unit" is a skill folder or a plugin root that holds a LEARNINGS.md; its version lives in the nearest
.claude-plugin/plugin.json above it, its history in CHANGELOG.md beside LEARNINGS.md.

  python loop.py where                       which genome (source checkout) this resolves to, and why
  python loop.py note UNIT KIND "TEXT" [--where SECTION] [--harness H] [--context C] [--same O3]
                                             record an observation; a near-duplicate of an open one bumps its ×count
  python loop.py status [UNIT]               open observations per unit, which are ripe, budget use
  python loop.py digest                      at most a few lines for a session-start hook; silent when nothing is ripe
  python loop.py check [--base REF]          CI gate: manifests, versions, changelogs, learnings format, budgets;
                                             with --base, a plugin changed since REF must have bumped its version
                                             (LEARNINGS.md, CHANGELOG.md and evals/ changes are exempt)
  python loop.py eval UNIT                   run UNIT's evals/run.py (if present) and list its cases
  python loop.py bump UNIT patch|minor|major "SUMMARY" [--obs O3,O4]
                                             bump the version, prepend a CHANGELOG entry, resolve the observations
                                             (`--obs last` = the newest open one)
  python loop.py absorb                      move inbox lines into the genome's LEARNINGS files
  python loop.py pack UNIT [--out DIR]       zip a skill folder for upload (claude.ai), as dist/<unit>-<version>.zip
  python loop.py link TARGET [--only A,B]    symlink the genome's skill folders into a harness's skills folder

Genome resolution, first hit wins: --genome PATH, $STRANGE_LOOP_GENOME, the path in ~/.config/strange-loop/genome,
the nearest folder above the current directory (then above this script) with .claude-plugin/marketplace.json.
Installed plugin copies under ~/.claude/plugins are never treated as the genome (updates overwrite them).
With no genome, `note` writes to ~/.config/strange-loop/inbox.md and `absorb` moves the lines later.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import re
import subprocess
import sys
from pathlib import Path

KINDS = ("failure", "friction", "misled", "missing", "workaround", "win", "wish")
RIPE_KINDS = {"failure", "misled"}       # one is enough to deserve a reflection
RIPE_COUNT = 2                           # or any observation seen this many times
RIPE_OPEN = 5                            # or this many open observations in one unit
STALE_DAYS = 180                         # an open observation older than this is confirmed or rejected
SKILL_MAX_LINES = 500                    # Agent Skills guidance: keep SKILL.md under ~500 lines
DESCRIPTION_MAX = 1024                   # Agent Skills spec limit for the description field
NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
OBS = re.compile(r"^- (O\d+) (\d{4}-\d{2}-\d{2}) \[([a-z]+)\] (.+?)(?: ×(\d+))?(?: → (.+?))?\s*$")
CHANGE_HEAD = re.compile(r"^## (\d+\.\d+\.\d+)\b")
CONFIG = Path(os.environ.get("STRANGE_LOOP_CONFIG", Path.home() / ".config" / "strange-loop"))
INBOX = CONFIG / "inbox.md"
TODAY = _dt.date.today().isoformat()

LEARNINGS_TEMPLATE = """# Learnings: {name}

Observations from use, written by the agents that used this {what}; the strange-loop skill turns them into changes.
One line each: `- O<n> <date> [<kind>] <section>: <what happened, what would have helped> (<harness>, <context>)`.
Kinds: failure, friction, misled, missing, workaround, win, wish. ` ×N` = seen N times; ` → <version>` = resolved there.

## Open

## Resolved
"""


# ---------------------------------------------------------------- locating things
def _is_installed_copy(p: Path) -> bool:
    try:
        p.resolve().relative_to((Path.home() / ".claude" / "plugins").resolve())
        return True
    except ValueError:
        return False


def _marketplace_root(start: Path) -> Path | None:
    for d in [start, *start.parents]:
        if (d / ".claude-plugin" / "marketplace.json").is_file() and not _is_installed_copy(d):
            return d
    return None


def find_genome(explicit: str | None = None) -> tuple[Path | None, str]:
    if explicit:
        return Path(explicit).expanduser(), "--genome"
    env = os.environ.get("STRANGE_LOOP_GENOME")
    if env:
        return Path(env).expanduser(), "$STRANGE_LOOP_GENOME"
    cfg = CONFIG / "genome"
    if cfg.is_file() and cfg.read_text(encoding="utf-8").strip():
        return Path(cfg.read_text(encoding="utf-8").strip()).expanduser(), str(cfg)
    for start, why in ((Path.cwd(), "current directory"), (Path(__file__).resolve().parent, "this script's location")):
        root = _marketplace_root(start)
        if root:
            return root, f"marketplace above the {why}"
    return None, "not found"


def plugin_dirs(genome: Path) -> list[Path]:
    base = genome / "plugins"
    return sorted(p for p in base.iterdir() if (p / ".claude-plugin" / "plugin.json").is_file()) if base.is_dir() else []


def units(genome: Path) -> dict[str, Path]:
    """Unit name -> folder holding its LEARNINGS.md (skill folders first, then plugin roots)."""
    out: dict[str, Path] = {}
    for plug in plugin_dirs(genome):
        for skill in sorted((plug / "skills").glob("*/SKILL.md")):
            out.setdefault(skill.parent.name, skill.parent)
        if (plug / "LEARNINGS.md").is_file() or not (plug / "skills").is_dir():
            out.setdefault(plug.name, plug)
    return out


def plugin_of(unit_dir: Path) -> Path | None:
    for d in [unit_dir, *unit_dir.parents]:
        if (d / ".claude-plugin" / "plugin.json").is_file():
            return d
    return None


def read_json(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(p: Path, data: dict) -> None:
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def frontmatter(p: Path) -> dict[str, str]:
    text = p.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    fm = {}
    for line in text[3:end].splitlines():
        m = re.match(r"^([A-Za-z_-]+):\s*(.*)$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return fm


# ---------------------------------------------------------------- LEARNINGS.md
class Learnings:
    def __init__(self, path: Path, name: str):
        self.path, self.name = path, name
        if not path.exists():
            what = "skill" if (path.parent / "SKILL.md").exists() else "plugin"
            path.write_text(LEARNINGS_TEMPLATE.format(name=name, what=what), encoding="utf-8")
        self.lines = path.read_text(encoding="utf-8").splitlines()

    def section(self, title: str) -> tuple[int, int]:
        """(index of the heading, index after the section's last line)."""
        start = next((i for i, l in enumerate(self.lines) if l.strip().lower() == f"## {title}"), None)
        if start is None:
            self.lines += ["", f"## {title}"]
            start = len(self.lines) - 1
        end = next((i for i in range(start + 1, len(self.lines)) if self.lines[i].startswith("## ")), len(self.lines))
        return start, end

    def entries(self, title: str) -> list[tuple[int, re.Match]]:
        s, e = self.section(title)
        return [(i, m) for i in range(s + 1, e) if (m := OBS.match(self.lines[i]))]

    def bad_lines(self) -> list[str]:
        bad = []
        for title in ("open", "resolved"):
            s, e = self.section(title)
            bad += [l for l in self.lines[s + 1:e] if l.startswith("- ") and not OBS.match(l)]
        return bad

    def next_id(self) -> str:
        ids = [int(m.group(1)[1:]) for t in ("open", "resolved") for _, m in self.entries(t)]
        return f"O{max(ids, default=0) + 1}"

    def add(self, kind: str, text: str, same: str | None = None) -> tuple[str, int]:
        """Append an observation, or bump the count of `same` / a near-duplicate open one. Returns (id, count)."""
        for i, m in self.entries("open"):
            if m.group(1) == same or (same is None and m.group(3) == kind and similar(m.group(4), text)):
                n = int(m.group(5) or 1) + 1
                self.lines[i] = f"- {m.group(1)} {m.group(2)} [{m.group(3)}] {m.group(4)} ×{n}"
                self.save()
                return m.group(1), n
        oid = self.next_id()
        _, e = self.section("open")
        while e > 0 and not self.lines[e - 1].strip():
            e -= 1
        self.lines.insert(e, f"- {oid} {TODAY} [{kind}] {text}")
        self.save()
        return oid, 1

    def resolve(self, ids: list[str], version: str) -> list[str]:
        moved = []
        for i, m in sorted(self.entries("open"), reverse=True):
            if m.group(1) in ids:
                moved.append(self.lines.pop(i).split(" → ")[0] + f" → {version}")
        _, e = self.section("resolved")
        s, _ = self.section("resolved")
        insert_at = s + 1
        while insert_at < len(self.lines) and not self.lines[insert_at].strip():
            insert_at += 1
        for line in reversed(moved):
            self.lines.insert(insert_at, line)
        self.save()
        return [l.split()[1] for l in moved]

    def save(self) -> None:
        self.path.write_text("\n".join(self.lines).rstrip() + "\n", encoding="utf-8")


def words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", s.lower()) if len(w) > 3}


def similar(a: str, b: str, threshold: float = 0.6) -> bool:
    wa, wb = words(re.sub(r"\(.*?\)\s*$", "", a)), words(b)
    return bool(wa and wb) and len(wa & wb) / len(wa | wb) >= threshold


def is_ripe(m: re.Match) -> bool:
    return m.group(3) in RIPE_KINDS or int(m.group(5) or 1) >= RIPE_COUNT


# ---------------------------------------------------------------- commands
def need_genome(args) -> Path:
    g, why = find_genome(args.genome)
    if not g or not g.is_dir():
        sys.exit(f"strange-loop: no genome found ({why}); set $STRANGE_LOOP_GENOME or write its path to {CONFIG / 'genome'}")
    return g


def need_unit(genome: Path, name: str) -> Path:
    us = units(genome)
    if name not in us:
        sys.exit(f"strange-loop: unknown unit {name!r}; known: {', '.join(us) or 'none'}")
    return us[name]


def cmd_where(args):
    g, why = find_genome(args.genome)
    print(f"genome: {g} ({why})" if g else f"genome: none ({why}); notes go to {INBOX}")
    if g and g.is_dir():
        for name, d in units(g).items():
            print(f"  {name}: {d.relative_to(g)}")


def cmd_note(args):
    if args.kind not in KINDS:
        sys.exit(f"strange-loop: kind must be one of {', '.join(KINDS)}")
    text = " ".join(args.text.split())
    if args.where:
        text = f"{args.where}: {text}"
    ctx = ", ".join(x for x in (args.harness, args.context) if x)
    if ctx:
        text += f" ({ctx})"
    g, _ = find_genome(args.genome)
    if g and g.is_dir() and args.unit in units(g):
        d = units(g)[args.unit]
        oid, n = Learnings(d / "LEARNINGS.md", args.unit).add(args.kind, text, args.same)
        print(f"{args.unit} {oid}" + (f" seen again (×{n})" if n > 1 else " recorded") + f" in {d / 'LEARNINGS.md'}")
        return
    INBOX.parent.mkdir(parents=True, exist_ok=True)
    with INBOX.open("a", encoding="utf-8") as f:
        f.write(f"- [{args.unit}] {TODAY} [{args.kind}] {text}\n")
    print(f"{args.unit}: no writable source found; queued in {INBOX} (run `loop.py absorb` where the genome is)")


def unit_report(genome: Path, name: str, d: Path) -> tuple[list[re.Match], list[re.Match], list[str]]:
    lp = d / "LEARNINGS.md"
    opened = [m for _, m in Learnings(lp, name).entries("open")] if lp.exists() else []
    ripe = [m for m in opened if is_ripe(m)]
    notes = []
    skill = d / "SKILL.md"
    if skill.exists():
        n = len(skill.read_text(encoding="utf-8").splitlines())
        notes.append(f"SKILL.md {n}/{SKILL_MAX_LINES} lines")
    return opened, ripe, notes


def cmd_status(args):
    g = need_genome(args)
    for name, d in units(g).items():
        if args.unit and name != args.unit:
            continue
        opened, ripe, notes = unit_report(g, name, d)
        flag = "RIPE" if ripe or len(opened) >= RIPE_OPEN else "ok"
        print(f"{name} [{flag}]: {len(opened)} open, {len(ripe)} ripe; " + "; ".join(notes))
        for m in opened if args.unit else ripe:
            print(f"   {m.group(1)} [{m.group(3)}]{' ×' + m.group(5) if m.group(5) else ''} {m.group(4)[:110]}")
    if INBOX.exists() and INBOX.read_text(encoding="utf-8").strip():
        print(f"inbox: {len(INBOX.read_text(encoding='utf-8').splitlines())} line(s) in {INBOX}; run `absorb`")


def cmd_digest(args):
    try:
        g, _ = find_genome(args.genome)
        out = []
        if g and g.is_dir():
            for name, d in units(g).items():
                opened, ripe, _ = unit_report(g, name, d)
                if ripe or len(opened) >= RIPE_OPEN:
                    top = max(opened, key=lambda m: (m.group(3) in RIPE_KINDS, int(m.group(5) or 1)))
                    out.append(f"{name}: {len(opened)} open ({len(ripe)} ripe), e.g. {top.group(1)} {top.group(4)[:80]}")
        inbox = INBOX.read_text(encoding="utf-8").splitlines() if INBOX.exists() else []
        if inbox:
            out.append(f"{len(inbox)} observation(s) waiting in {INBOX}")
        if out:
            print("strange-loop: skills with lessons waiting for a reflection pass (the strange-loop skill, when the user "
                  "has time; do not interrupt the current task for it):")
            for line in out[:4]:
                print(f"- {line}")
    except Exception:  # a hook must never break a session
        pass


def changelog_versions(p: Path) -> list[str]:
    return [m.group(1) for l in p.read_text(encoding="utf-8").splitlines() if (m := CHANGE_HEAD.match(l))] if p.exists() else []


def is_bookkeeping(path: str) -> bool:
    """Files that record or test a unit without changing what its users get: no version bump needed."""
    return Path(path).name in ("LEARNINGS.md", "CHANGELOG.md") or "/evals/" in f"/{path}"


def git(genome: Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(genome), *a], capture_output=True, text=True).stdout


def cmd_check(args):
    g = need_genome(args)
    errors, warnings = [], []
    mk = g / ".claude-plugin" / "marketplace.json"
    listed = {}
    try:
        for p in read_json(mk).get("plugins", []):
            listed[p.get("name")] = p
            src = (g / p.get("source", "")).resolve()
            if not (src / ".claude-plugin" / "plugin.json").is_file():
                errors.append(f"marketplace: {p.get('name')}: source {p.get('source')} has no .claude-plugin/plugin.json")
    except (OSError, ValueError) as e:
        errors.append(f"marketplace.json: {e}")
    for plug in plugin_dirs(g):
        rel = plug.relative_to(g)
        try:
            meta = read_json(plug / ".claude-plugin" / "plugin.json")
        except ValueError as e:
            errors.append(f"{rel}/plugin.json: {e}")
            continue
        if meta.get("name") != plug.name:
            errors.append(f"{rel}: plugin.json name {meta.get('name')!r} differs from its folder")
        if not SEMVER.match(str(meta.get("version", ""))):
            errors.append(f"{rel}: plugin.json needs a version X.Y.Z")
        if not meta.get("description"):
            errors.append(f"{rel}: plugin.json has no description")
        if plug.name not in listed:
            errors.append(f"{rel}: not listed in .claude-plugin/marketplace.json")
        if args.base and SEMVER.match(str(meta.get("version", ""))):
            changed = [f for f in git(g, "diff", "--name-only", f"{args.base}...HEAD", "--", str(rel)).split()
                       if not is_bookkeeping(f)]
            old = git(g, "show", f"{args.base}:{rel}/.claude-plugin/plugin.json")
            old_v = json.loads(old).get("version") if old.strip() else None
            if changed and old_v == meta["version"]:
                errors.append(f"{rel}: changed since {args.base} ({len(changed)} file(s)) but still version {old_v}; "
                              "run `loop.py bump` (LEARNINGS, CHANGELOG and evals alone need no bump)")
    for name, d in units(g).items():
        rel = d.relative_to(g)
        skill = d / "SKILL.md"
        if skill.exists():
            fm = frontmatter(skill)
            if fm.get("name") != d.name:
                errors.append(f"{rel}/SKILL.md: frontmatter name {fm.get('name')!r} must equal the folder name")
            if not NAME_RE.match(fm.get("name", "")) or len(fm.get("name", "")) > 64:
                errors.append(f"{rel}/SKILL.md: name must be lowercase words joined by hyphens, at most 64 characters")
            desc = fm.get("description", "")
            if not desc or len(desc) > DESCRIPTION_MAX:
                errors.append(f"{rel}/SKILL.md: description must be 1-{DESCRIPTION_MAX} characters (has {len(desc)})")
            n = len(skill.read_text(encoding="utf-8").splitlines())
            if n > SKILL_MAX_LINES:
                warnings.append(f"{rel}/SKILL.md: {n} lines (> {SKILL_MAX_LINES}); move detail into referenced files")
            if "## Learning loop" not in skill.read_text(encoding="utf-8"):
                warnings.append(f"{rel}/SKILL.md: no '## Learning loop' section, so users of the skill won't record lessons")
        lp, cp = d / "LEARNINGS.md", d / "CHANGELOG.md"
        if not lp.exists():
            errors.append(f"{rel}: no LEARNINGS.md (create it with `loop.py note` or the template in the skill)")
        else:
            L = Learnings(lp, name)
            errors += [f"{rel}/LEARNINGS.md: malformed observation: {b[:90]}" for b in L.bad_lines()]
            ids = [m.group(1) for t in ("open", "resolved") for _, m in L.entries(t)]
            dup = {i for i in ids if ids.count(i) > 1}
            if dup:
                errors.append(f"{rel}/LEARNINGS.md: duplicate ids {', '.join(sorted(dup))}")
            vers = set(changelog_versions(cp))
            for _, m in L.entries("resolved"):
                if not m.group(6):
                    errors.append(f"{rel}/LEARNINGS.md: resolved {m.group(1)} has no '→ <version>'")
                elif SEMVER.match(m.group(6)):
                    if m.group(6) not in vers:
                        errors.append(f"{rel}/LEARNINGS.md: {m.group(1)} resolved in {m.group(6)}, which CHANGELOG.md lacks")
                elif not re.match(r"^(rejected|moved): \S", m.group(6)):
                    errors.append(f"{rel}/LEARNINGS.md: {m.group(1)} must end '→ <version>', '→ rejected: <reason>' "
                                  "or '→ moved: <where>'")
            opened = L.entries("open")
            stale = [m.group(1) for _, m in opened if (_dt.date.today() - _dt.date.fromisoformat(m.group(2))).days > STALE_DAYS]
            if stale:
                warnings.append(f"{rel}: open observations older than {STALE_DAYS} days ({', '.join(stale)}): confirm or reject them")
            if len(opened) > 3 * RIPE_OPEN:
                warnings.append(f"{rel}: {len(opened)} open observations; a reflection pass is overdue")
        plug = plugin_of(d)
        if not cp.exists():
            errors.append(f"{rel}: no CHANGELOG.md")
        elif plug:
            v = read_json(plug / ".claude-plugin" / "plugin.json").get("version")
            top = (changelog_versions(cp) or [None])[0]
            if top != v:
                errors.append(f"{rel}/CHANGELOG.md: newest entry {top} but plugin.json says {v}")
    for e in errors:
        print(f"error: {e}")
    for w in warnings:
        print(f"warning: {w}")
    print(f"strange-loop check: {len(errors)} error(s), {len(warnings)} warning(s)")
    sys.exit(1 if errors else 0)


def cmd_eval(args):
    g = need_genome(args)
    d = need_unit(g, args.unit)
    ev = d / "evals"
    cases = ev / "cases.md"
    if cases.exists():
        heads = [l[3:].strip() for l in cases.read_text(encoding="utf-8").splitlines() if l.startswith("## ")]
        print(f"{args.unit}: {len(heads)} judged case(s) in {cases.relative_to(g)}:")
        for h in heads:
            print(f"   {h}")
    runner = ev / "run.py"
    if runner.exists():
        print(f"running {runner.relative_to(g)}")
        sys.exit(subprocess.run([sys.executable, str(runner)], cwd=str(d)).returncode)
    if not cases.exists():
        sys.exit(f"{args.unit}: no evals/ yet; write at least one case before changing the skill's behaviour")


def bump_version(v: str, part: str) -> str:
    a, b, c = (int(x) for x in SEMVER.match(v).groups())
    return {"major": f"{a + 1}.0.0", "minor": f"{a}.{b + 1}.0", "patch": f"{a}.{b}.{c + 1}"}[part]


def cmd_bump(args):
    g = need_genome(args)
    d = need_unit(g, args.unit)
    plug = plugin_of(d)
    pj = plug / ".claude-plugin" / "plugin.json"
    meta = read_json(pj)
    new = bump_version(meta.get("version", "0.0.0"), args.part)
    meta["version"] = new
    write_json(pj, meta)
    ids = [i.strip() for i in (args.obs or "").split(",") if i.strip()]
    if "last" in ids:
        opened = [m.group(1) for _, m in Learnings(d / "LEARNINGS.md", args.unit).entries("open")]
        if not opened:
            sys.exit(f"strange-loop: {args.unit} has no open observation for --obs last")
        last = max(opened, key=lambda i: int(i[1:]))
        ids = [last if i == "last" else i for i in ids]
    cp = d / "CHANGELOG.md"
    old = cp.read_text(encoding="utf-8") if cp.exists() else f"# Changelog: {args.unit}\n\nNewest first. Each entry cites the observations (O-ids in LEARNINGS.md) or evals that justified it.\n"
    head, sep, rest = old.partition("\n## ")
    entry = f"## {new} ({TODAY})\n- {args.summary}" + (f" ({', '.join(ids)})" if ids else "") + "\n"
    cp.write_text(head.rstrip() + "\n\n" + entry + (("\n## " + rest) if sep else ""), encoding="utf-8")
    moved = Learnings(d / "LEARNINGS.md", args.unit).resolve(ids, new) if ids else []
    print(f"{plug.name} {new}; CHANGELOG updated" + (f"; resolved {', '.join(moved)}" if moved else ""))
    missing = set(ids) - set(moved)
    if missing:
        print(f"warning: not open in LEARNINGS.md: {', '.join(sorted(missing))}")


def cmd_pack(args):
    """Zip a skill folder for harnesses that take uploads (claude.ai): <unit>/SKILL.md at the top of the archive."""
    import zipfile
    g = need_genome(args)
    d = need_unit(g, args.unit)
    if not (d / "SKILL.md").exists():
        sys.exit(f"strange-loop: {args.unit} is not a skill (no SKILL.md); mods install as plugins")
    version = read_json(plugin_of(d) / ".claude-plugin" / "plugin.json").get("version", "0.0.0")
    out = Path(args.out or g / "dist").expanduser()
    out.mkdir(parents=True, exist_ok=True)
    target = out / f"{args.unit}-{version}.zip"
    skip = {"__pycache__", ".DS_Store"}
    n = 0
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(d.rglob("*")):
            if f.is_file() and not skip & set(f.relative_to(d).parts) and f.suffix != ".pyc":
                z.write(f, Path(args.unit) / f.relative_to(d))
                n += 1
    print(f"{target} ({n} files, {target.stat().st_size / 1e6:.1f} MB)")


def cmd_link(args):
    """Symlink every skill folder of the genome into TARGET (a harness's skills folder), so it reads the genome live."""
    g = need_genome(args)
    target = Path(args.target).expanduser()
    target.mkdir(parents=True, exist_ok=True)
    for name, d in units(g).items():
        if not (d / "SKILL.md").exists() or (args.only and name not in args.only.split(",")):
            continue
        link = target / name
        if link.is_symlink():
            if link.resolve() == d.resolve():
                print(f"ok      {link}")
                continue
            link.unlink()
        elif link.exists():
            print(f"skipped {link}: a real folder is there (an old copy?); move it away and run again")
            continue
        link.symlink_to(d.resolve(), target_is_directory=True)
        print(f"linked  {link} -> {d}")


def cmd_absorb(args):
    g = need_genome(args)
    if not INBOX.exists():
        print("inbox empty")
        return
    keep, done = [], 0
    us = units(g)
    for line in INBOX.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^- \[([^\]]+)\] (\d{4}-\d{2}-\d{2}) \[([a-z]+)\] (.+)$", line)
        if m and m.group(1) in us:
            Learnings(us[m.group(1)] / "LEARNINGS.md", m.group(1)).add(m.group(3), f"{m.group(4)} (noted {m.group(2)})")
            done += 1
        elif line.strip():
            keep.append(line)
    INBOX.write_text("\n".join(keep) + ("\n" if keep else ""), encoding="utf-8")
    print(f"absorbed {done} observation(s); {len(keep)} left (unknown unit or malformed)")


def main(argv: list[str]) -> None:
    import argparse
    ap = argparse.ArgumentParser(prog="loop.py", description=__doc__.split("\n")[0])
    ap.add_argument("--genome")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("where")
    p = sub.add_parser("note")
    p.add_argument("unit"); p.add_argument("kind"); p.add_argument("text")
    p.add_argument("--where"); p.add_argument("--harness"); p.add_argument("--context"); p.add_argument("--same")
    p = sub.add_parser("status"); p.add_argument("unit", nargs="?")
    sub.add_parser("digest")
    p = sub.add_parser("check"); p.add_argument("--base")
    p = sub.add_parser("eval"); p.add_argument("unit")
    p = sub.add_parser("bump"); p.add_argument("unit"); p.add_argument("part", choices=["patch", "minor", "major"])
    p.add_argument("summary"); p.add_argument("--obs")
    sub.add_parser("absorb")
    p = sub.add_parser("pack"); p.add_argument("unit"); p.add_argument("--out")
    p = sub.add_parser("link"); p.add_argument("target"); p.add_argument("--only")
    args = ap.parse_args(argv)
    {"where": cmd_where, "note": cmd_note, "status": cmd_status, "digest": cmd_digest, "check": cmd_check,
     "eval": cmd_eval, "bump": cmd_bump, "absorb": cmd_absorb, "pack": cmd_pack, "link": cmd_link}[args.cmd](args)


if __name__ == "__main__":
    main(sys.argv[1:])
