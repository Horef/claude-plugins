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
    if (!checking()) cx.timer.every(2000, (cx) => this.refresh(cx));
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

    const head = v_flex().gap(2).p(10).border_b(1).border_color(t.border)
      .child(div().font_semibold().text_color(t.foreground).child(`Model router · ${state.statusText}`))
      .child(div().text_color(t.dim).truncate().child(`${where}${state.cwd ? ` · ${state.cwd}` : ""}`))
      .child(div().text_color(state.health.ok ? t.muted : t.blocked).child(state.health.text));

    const stepRow = (s) => {
      const color = s.status === "done" ? t.muted : t.foreground;
      const line = [s.where, s.on].filter(Boolean).join(" · ");
      const extra = [s.cost, ...s.notes].filter(Boolean).join(" · ");
      return v_flex().id(`mr-step-${s.id}`).gap(1).pl(Math.min(s.depth, 3) * 12).py(4)
        .child(h_flex().gap(6)
          .child(div().text_color(s.status === "running" ? t.working : color).child(GLYPH[s.status] ?? "○"))
          .child(div().text_color(tier[s.tier] ?? t.muted).child(s.id))
          .child(div().flex_1().text_color(color).font_semibold().child(s.title)))
        .child(h_flex().gap(6).pl(16)
          .child(div().text_color(tier[s.tier] ?? t.muted).child(s.group ? "" : s.tier))
          .child(div().flex_1().text_color(t.muted).child(line)))
        .when(extra !== "", (el) => el.child(div().pl(16).text_color(t.dim).child(extra)))
        .when(s.verdict !== "", (el) => el.child(div().pl(16).text_color(/weak/.test(s.verdict) ? t.blocked : t.muted).child(s.verdict)))
        .when(s.fallback !== "", (el) => el.child(div().pl(16).text_color(t.blocked).child(s.fallback)));
    };

    const section = (title, lines, key) => v_flex().id(key).gap(2).pt(8)
      .child(div().text_color(t.dim).child(title))
      .children(lines.map((l) => div().text_color(t.muted).child(l)));

    const body = v_flex().id("mr-body").flex_1().min_h(0).overflow_y_scrollbar().px(10).pb(10)
      .when(state.steps.length === 0, (el) => el.child(div().pt(8).text_color(t.muted).child("No plan in this chat.")))
      .children(state.steps.map(stepRow))
      .child(section("This plan", state.cost.plan, "mr-cost-plan"))
      .child(section("This chat", state.cost.chat, "mr-cost-chat"))
      .when(state.news.length > 0, (el) => el.child(section("New models", state.news, "mr-news")));

    return root.child(head).child(body);
  }
}
