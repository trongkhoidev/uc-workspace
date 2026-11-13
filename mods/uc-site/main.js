// The UCTalent building: one floor per area, one worker per agent.
// A worker's floor comes from its terminal's folder; its pose from the agent's status.

import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, panes, terminals, theme, run, exec, window } from "herdr";
import { worker, W, H } from "./sprites.js";
import { decor } from "./decor.js";
import { DEFAULTS, load, ensureFile, path, floorFor, isReview, looks } from "./config.js";

const FLOOR_H = 76, LABEL_W = 58, SLOT = 36, WAIT_MS = 60 * 1000;
const COLOR = { blocked: "#E5484D", done: "#46A758", working: "#F2A33A", idle: "#6B7280" };
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const POSE_LABEL = { working: "working", review: "reviewing", blocked: "needs you", waiting: "still waiting for you", done: "done", idle: "idle", empty: "out of tokens" };
const SPEED = { off: 0, slow: 1.6, normal: 1, fast: 0.6 };

const since = (ms) => {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "<1m" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
};

export default class Site extends View {
  init(_props, cx) {
    this.cfg = DEFAULTS;
    this.error = null;
    this.width = 268;
    this.seen = new Map(); // address -> { status, at }
    const reload = (cx) => cx.spawn(async (cx) => {
      const [cfg, error] = await load();
      if (JSON.stringify(cfg) !== JSON.stringify(this.cfg) || error !== this.error) { this.cfg = cfg; this.error = error; cx.notify(); }
    });
    reload(cx);
    cx.timer.every(4000, reload);
    cx.timer.every(15000, (cx) => cx.notify()); // ages "needs you" into "still waiting"
  }

  pose(a, info, now) {
    const { cfg } = this;
    if (info.pct != null && info.pct >= cfg.tokensOutAt && a.status !== "working") return "empty";
    if (a.status === "blocked") return now - info.at > WAIT_MS ? "waiting" : "blocked";
    if (a.status === "working" && isReview(cfg, info.cwd, a.title)) return "review";
    return a.status;
  }

  figure(a, info, pose, floor, m) {
    const sp = looks(this.cfg, a.program?.key ?? a.app);
    const own = sp.images?.[pose] ?? sp.image;
    const body = own ? image(own).w(W).h(H) : worker(sp, pose, floor.tool, floor.paint, m);
    return div().id(`w-${a.address}`).absolute().left(info.x).top(info.y).w(W).h(H).cursor_pointer()
      .tooltip(`${a.program?.name || "agent"} · ${POSE_LABEL[pose]} · ${since(Date.now() - info.at)}`)
      .on_click(() => run("pane.focus", { pane: a.pane })).child(body);
  }

  floorRow(f, crew, t, m) {
    const cap = Math.max(1, Math.floor((this.width - LABEL_W - 36) / SLOT));
    const shown = crew.length > cap ? crew.slice(0, cap - 1) : crew;
    const more = crew.length - shown.length;
    const top = crew.reduce((s, c) => (RANK[c.a.status] > RANK[s] ? c.a.status : s), "idle");
    const bg = f.background && !String(f.background).startsWith("#") ? image(f.background).absolute().left(0).top(0).w_full().h_full() : null;
    const room = div().relative().flex_1().h_full().overflow_hidden().rounded(6).bg(!f.background || !String(f.background).startsWith("#") ? f.wall : f.background)
      .when(Boolean(bg), (el) => el.child(bg))
      .children(decor(f, m))
      .child(div().absolute().left(0).top(FLOOR_H - 8).w_full().h(8).bg(f.floor));
    shown.forEach((c, i) => {
      c.info.x = 10 + i * SLOT;
      c.info.y = FLOOR_H - 8 - H + 2;
      room.child(this.figure(c.a, c.info, c.pose, f, m));
    });
    if (more > 0) room.child(div().absolute().right(6).top(8).px(5).rounded(8).bg("#00000066").text_size(10).text_color("#fff").child(`+${more}`));
    return h_flex().h(FLOOR_H).flex_none().gap(4).items_center()
      .child(v_flex().w(LABEL_W).flex_none().gap(2).pl(4)
        .child(div().text_size(11).font_semibold().text_color(t.foreground).truncate().child(f.name))
        .child(h_flex().gap(4).items_center()
          .child(div().size(6).rounded_full().bg(crew.length ? COLOR[top] : COLOR.idle))
          .child(div().text_size(10).text_color(t.dim).child(crew.length ? `${crew.length} at work` : "empty"))))
      .child(room);
  }

  render() {
    const t = theme();
    const { cfg } = this;
    const m = { k: SPEED[cfg.motion] ?? 1 };
    const now = Date.now();
    const cwd = new Map(panes().map((p) => [p.pane, p]));
    const ctx = new Map(terminals().flatMap((k) => {
      const v = Number.parseInt(k.labels?.["claude.context"], 10);
      return Number.isFinite(v) ? [[k.address, v]] : [];
    }));

    const byFloor = new Map(cfg.floors.map((f) => [f.id, []]));
    for (const a of agents()) {
      const p = cwd.get(a.pane);
      const prev = this.seen.get(a.address);
      const rec = prev?.status === a.status ? prev : { status: a.status, at: now };
      this.seen.set(a.address, rec);
      const info = { at: rec.at, cwd: p?.cwd, branch: p?.branch, pct: ctx.get(a.address) ?? null, x: 0, y: 0 };
      const f = floorFor(cfg, p?.cwd);
      byFloor.get(f.id).push({ a, info, pose: this.pose(a, info, now) });
    }
    for (const crew of byFloor.values()) crew.sort((x, y) => RANK[y.a.status] - RANK[x.a.status] || y.a.seq - x.a.seq);

    const alarm = [...byFloor.values()].some((c) => c.some((w) => w.a.status === "blocked"));
    let beacon = div().size(8).rounded_full().bg(alarm ? COLOR.blocked : "#46A758");
    if (alarm && m.k) beacon = beacon.loop("opacity", { from: 0.2, to: 1, period: 600 * m.k });

    const roof = h_flex().h(22).flex_none().px(6).items_center().justify_between()
      .child(h_flex().gap(6).items_center().child(beacon)
        .child(div().text_size(10).text_color(this.error ? COLOR.blocked : t.dim).child(this.error ? "uc-workspace.json is invalid" : alarm ? "someone needs you" : "all quiet")))
      .child(div().id("uc-config").px(5).rounded(4).text_size(10).text_color(t.dim).cursor_pointer().tooltip(`Customize: ${path()}`)
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click(async () => { await ensureFile(); (window()?.platform === "macos" ? exec("open", ["-t", path()]) : exec("xdg-open", [path()])).catch(() => {}); }).child("customize"));

    return v_flex().id("uc-site").size_full().bg(t.chrome).px(6).pb(6).gap(4).overflow_y_scrollbar()
      .on_size_change((s, cx) => { if (Math.abs(s.width - this.width) > 2) { this.width = s.width; cx.notify(); } })
      .child(roof)
      .children(cfg.floors.map((f) => this.floorRow(f, byFloor.get(f.id) ?? [], t, m)));
  }
}

