// A read-only, scrollable view of the model-router's plan, read from its state files
// (<config>/model-router/state/<chat>.json). Approving a plan still happens in Claude Code.
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, spaces, panes, focused, theme, checking } from "herdr";

const GLYPH = { planned: "○", running: "◐", done: "●" };
const MAX_AGE_MS = 2 * 86400000;

// Where the focused terminal is: its folder, and the machine (null: this computer) a remote space runs on.
function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder || null, on };
}

// The chat whose folder is the terminal's (or contains it), else the newest.
function pick(states, cwd) {
  const here = cwd ? states.find((s) => s.cwd && (cwd === s.cwd || cwd.startsWith(s.cwd + "/"))) : null;
  return here ?? states[0] ?? null;
}

// The newest state files on a machine, in one command (the files are one line each).
const LIST = 'cd "${XDG_CONFIG_HOME:-$HOME/.config}/model-router/state" 2>/dev/null && for f in $(ls -t | head -n 8); do cat "$f"; echo; done; true';

async function load(on) {
  const r = await exec("sh", ["-c", LIST], { on });
  const states = [];
  for (const line of r.stdout.split("\n")) {
    try {
      const s = JSON.parse(line);
      if (s && s.version === 1 && Date.now() - Date.parse(s.at) < MAX_AGE_MS) states.push(s);
    } catch {}
  }
  return states.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export default class ModelRouter extends View {
  init(_props, cx) {
    this.source = null; // { states, on }
    this.stamp = "";
    this.loaded = false;
    this.refresh(cx);
    // A tick every 2 s; a remote machine is asked only every fifth tick (an exec over ssh is heavy).
    this.tick = 0;
    if (!checking()) cx.timer.every(2000, (cx) => { if (!location().on || ++this.tick % 5 === 0) this.refresh(cx); });
  }

  refresh(cx) {
    if (this.busy) return;
    this.busy = true;
    const { on } = location();
    cx.spawn(async (cx) => {
      try {
        // The machine of the focused space first; this computer when that has no state (or cannot be reached).
        let states = [], from = on;
        try { states = await load(on); } catch {}
        if (states.length === 0 && on) { from = null; states = await load(null); }
        const stamp = `${from}|${states.map((s) => `${s.chat}:${s.at}`).join("|")}`;
        if (stamp !== this.stamp || !this.loaded) {
          this.source = { states, on: from };
          this.stamp = stamp;
          this.loaded = true;
          cx.notify();
        }
      } catch {
        // Try again at the next tick.
      } finally {
        this.busy = false;
      }
    });
  }

  render(cx) {
    const t = theme();
    const tier = { light: t.ansi2, standard: t.ansi4, deep: t.ansi3 };
    const state = pick(this.source?.states ?? [], location().cwd);
    const where = this.source?.on ?? "this computer";
    const root = v_flex().id("mr-root").size_full().bg(t.surface).text_size(12);
    if (!this.loaded) return root.p(10).child(div().text_color(t.dim).child("Loading…"));
    if (!state) {
      return root.p(10).child(div().text_color(t.muted).child("No router state yet. Start a Claude Code chat with model-router 0.25 or later."));
    }

    // The same order and words as the pane in Claude Code: health line, plan header, rows of two lines, then cost.
    const leaves = state.steps.filter((s) => !s.group);
    const done = leaves.filter((s) => s.status === "done").length;
    const planLabel = state.planName ? `Plan: ${state.planName}` : "Plan";
    const planHead = state.steps.length === 0 ? "" :
      `${planLabel} · ${done} of ${leaves.length} done${state.status === "pending" ? " · awaiting your approval" : ""}`;

    const head = v_flex().gap(2).p(10).border_b(1).border_color(t.border)
      .child(div().text_color(state.health.ok ? t.foreground : t.blocked).child(state.health.text))
      .child(div().text_color(t.dim).truncate().child(`${where}${state.cwd ? ` · ${state.cwd}` : ""}`))
      .when(planHead !== "", (el) => el.child(div().pt(4).font_semibold().text_color(t.foreground).child(planHead)));

    // Line 1: status, id, the title (wrapping). Line 2, quiet: level, where it runs, cost, verdict, kind.
    const stepRow = (s) => {
      const color = s.status === "done" ? t.muted : t.foreground;
      const facts = [s.where, s.on, s.cost, s.verdict, ...s.notes].filter(Boolean).join(" · ");
      return v_flex().id(`mr-step-${s.id}`).gap(1).pl(Math.min(s.depth, 3) * 12).py(4)
        .child(h_flex().gap(6).items_start()
          .child(div().flex_none().text_color(s.status === "running" ? t.working : color).child(GLYPH[s.status] ?? "○"))
          .child(div().flex_none().text_color(tier[s.tier] ?? t.muted).child(s.id))
          .child(div().flex_1().min_w_0().text_color(color).font_semibold().child(s.title)))
        .child(h_flex().gap(6).pl(16).items_start()
          .child(div().flex_none().text_color(tier[s.tier] ?? t.muted).child(s.group ? "" : s.tier))
          .child(div().flex_1().min_w_0().text_color(t.muted).child(facts)))
        .when(s.fallback !== "", (el) => el.child(div().pl(16).text_color(t.blocked).child(s.fallback)));
    };

    // Cost: one line a scope, as the pane's cost line.
    // Cost: the money on one line a scope, as the pane's cost line; the Off-Claude line under it.
    const costLine = (title, lines, key) => {
      const money = lines.filter((l) => !/^Off Claude/.test(l)), off = lines.filter((l) => /^Off Claude/.test(l));
      return v_flex().id(key).pt(8)
        .child(div().text_color(t.dim).child(title))
        .child(div().text_color(t.muted).child(money.join(" · ")))
        .children(off.map((l) => div().text_color(t.muted).child(l)));
    };

    const body = v_flex().id("mr-body").flex_1().min_h(0).overflow_y_scrollbar().px(10).pb(10)
      .when(state.news.length > 0, (el) => el.child(v_flex().id("mr-news").pt(8)
        .child(div().text_color(t.foreground).child(state.news[0]))
        .children(state.news.slice(1).map((l) => div().text_color(t.muted).child(l)))))
      .when(state.steps.length === 0, (el) => el.child(div().pt(8).text_color(t.muted).child("No plan yet. Multi-step tasks show their steps here.")))
      .children(state.steps.map(stepRow))
      .child(costLine("This plan", state.cost.plan, "mr-cost-plan"))
      .child(costLine("This chat", state.cost.chat, "mr-cost-chat"));

    return root.child(head).child(body);
  }
}
