// One section per workspace. The workspace(s) named in `splitSpaces` (UCTalent) are split into floors by repo and
// show only the floors that have an agent; every other workspace is a single room. A worker exists only for a live agent.

import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, panes, spaces, terminals, theme, run, exec, hc, window } from "herdr";
import { worker, W, H } from "./sprites.js";
import { decor } from "./decor.js";
import { DEFAULTS, load, ensureFile, path, matchFloor, fallbackFloor, screenFloor, isReview, looks } from "./config.js";

const FLOOR_H = 76, LABEL_W = 58, SLOT = 36, WAIT_MS = 60 * 1000;
const COLOR = { blocked: "#E5484D", done: "#46A758", working: "#F2A33A", idle: "#6B7280" };
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const WORDS = { blocked: "needs you", working: "working", done: "done", idle: "idle" };
const POSE_LABEL = { working: "working", review: "reviewing", blocked: "needs you", waiting: "still waiting for you", done: "done", idle: "idle", empty: "out of tokens" };
const SPEED = { off: 0, slow: 1.6, normal: 1, fast: 0.6 };

const since = (ms) => {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "<1m" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
};
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const isSplit = (cfg, name) => cfg.splitSpaces.some((w) => String(name).toLowerCase().includes(String(w).toLowerCase()));

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
    // In a split workspace, an agent whose folder names no floor (started above the repos) is placed by its screen.
    this.screen = new Map(); // address -> { id, at }
    this.stat = new Map(); // address -> ms since the epoch when its status last changed (from hc get)
    const scan = (cx) => cx.spawn(async (cx) => {
      const where = new Map(panes().map((p) => [p.pane, p]));
      const split = new Set(spaces().filter((s) => isSplit(this.cfg, s.name)).map((s) => s.id));
      let changed = false;
      for (const a of agents()) {
        const got = await hc(["get", a.address, "--json"]).catch(() => null);
        try {
          const ms = JSON.parse(got?.stdout ?? "{}").status_ms;
          if (ms && ms !== this.stat.get(a.address)) { this.stat.set(a.address, ms); changed = true; }
        } catch { /* no timestamp: the mod's own clock is used */ }
        // Idle agents are not on a floor, so there is nothing to place.
        if (!split.has(a.space) || a.status === "idle" || matchFloor(this.cfg, where.get(a.pane)?.cwd)) continue;
        const prev = this.screen.get(a.address);
        if (prev && Date.now() - prev.at < (a.status === "working" ? 10000 : 30000)) continue;
        const out = await hc(["read", a.address, "--lines", String(this.cfg.screenLines)]).catch(() => null);
        const id = (out?.code === 0 ? screenFloor(this.cfg, out.stdout)?.id : null) ?? prev?.id ?? null; // no hit: stay where it was
        if (id !== prev?.id) changed = true;
        this.screen.set(a.address, { id, at: Date.now() });
      }
      if (changed) cx.notify();
    });
    scan(cx);
    cx.timer.every(8000, scan);
  }

  pose(a, info, now) {
    const { cfg } = this;
    if (info.pct != null && info.pct >= cfg.tokensOutAt && a.status !== "working") return "empty";
    if (a.status === "blocked") return now - info.at > WAIT_MS ? "waiting" : "blocked";
    if (a.status === "working" && isReview(cfg, info.cwd, a.title)) return "review";
    return a.status;
  }

  figure(c, x, f, m) {
    const { a, info, pose } = c;
    const sp = looks(this.cfg, a.program?.key ?? a.app);
    const own = sp.images?.[pose] ?? sp.image;
    const body = own ? image(own).w(W).h(H) : worker(sp, pose, f.tool, f.paint, m);
    return div().id(`w-${a.address}`).absolute().left(x).top(FLOOR_H - 8 - H + 2).w(W).h(H).cursor_pointer()
      .tooltip(`${a.program?.name || "agent"} · ${POSE_LABEL[pose]} · ${since(Date.now() - info.at)}`)
      .on_click(() => run("pane.focus", { pane: a.pane })).child(body);
  }

  // A room: wall, floor line, props, then the workers (the last slot becomes "+N" when they don't all fit).
  room(f, crew, cap, m) {
    const shown = crew.length > cap ? crew.slice(0, Math.max(1, cap - 1)) : crew;
    const more = crew.length - shown.length;
    const solid = f.background && String(f.background).startsWith("#");
    const room = div().relative().flex_1().min_w(0).h(FLOOR_H).overflow_hidden().rounded(6).bg(solid ? f.background : f.wall)
      .when(Boolean(f.background) && !solid, (el) => el.child(image(f.background).absolute().left(0).top(0).w_full().h_full()))
      .children(decor(f, m))
      .child(div().absolute().left(0).top(FLOOR_H - 8).w_full().h(8).bg(f.floor));
    shown.forEach((c, i) => room.child(this.figure(c, 10 + i * SLOT, f, m)));
    if (more > 0) room.child(div().absolute().right(6).top(8).px(5).rounded(8).bg("#00000066").text_size(10).text_color("#fff").child(`+${more}`));
    return room;
  }

  floorRow(f, crew, t, m) {
    const top = crew.reduce((s, c) => (RANK[c.a.status] > RANK[s] ? c.a.status : s), "idle");
    return h_flex().h(FLOOR_H).flex_none().gap(4).items_center()
      .child(v_flex().w(LABEL_W).flex_none().gap(2).pl(4)
        .child(div().text_size(11).font_semibold().text_color(t.foreground).truncate().child(f.name))
        .child(h_flex().gap(4).items_center().child(div().size(6).rounded_full().bg(COLOR[top]))
          .child(div().text_size(10).text_color(t.dim).child(`${crew.length} at work`))))
      .child(this.room(f, crew, Math.max(1, Math.floor((this.width - LABEL_W - 36) / SLOT)), m));
  }

  header(s, roof, crew, t) {
    const counts = {};
    for (const c of crew) counts[c.a.status] = (counts[c.a.status] ?? 0) + 1;
    const order = ["blocked", "working", "done", "idle"].filter((k) => counts[k]);
    return h_flex().id(`site-${s.id}`).h(28).flex_none().px(6).gap(7).items_center().rounded(6).cursor_pointer()
      .when(s.active, (el) => el.bg(t.selected)).when(!s.active, (el) => el.hover((x) => x.bg(t.hover)))
      .on_click(() => run("space.select", { id: s.id }))
      .child(div().w(3).h(16).rounded(2).flex_none().bg(roof))
      .child(div().text_size(12.5).font_semibold().text_color(t.foreground).truncate().child(s.name))
      .child(div().flex_1())
      .child(div().flex_none().text_size(10).text_color(order.length && order[0] !== "idle" ? COLOR[order[0]] : t.dim)
        .child(order.length ? order.map((k) => `${counts[k]} ${WORDS[k]}`).join(" · ") : "empty"));
  }

  render() {
    const t = theme();
    const { cfg } = this;
    const m = { k: SPEED[cfg.motion] ?? 1 };
    const now = Date.now();
    const where = new Map(panes().map((p) => [p.pane, p]));
    const ctx = new Map(terminals().flatMap((k) => {
      const v = Number.parseInt(k.labels?.["claude.context"], 10);
      return Number.isFinite(v) ? [[k.address, v]] : [];
    }));

    // Every live agent, with how long it has been in its state, its pose and (in split workspaces) its floor.
    const bySpace = new Map();
    for (const a of agents()) {
      const p = where.get(a.pane);
      const prev = this.seen.get(a.address);
      const rec = prev?.status === a.status ? prev : { status: a.status, at: now };
      this.seen.set(a.address, rec);
      const info = { at: this.stat.get(a.address) ?? rec.at, cwd: p?.cwd, pct: ctx.get(a.address) ?? null };
      const list = bySpace.get(a.space) ?? [];
      list.push({ a, info, pose: this.pose(a, info, now) });
      bySpace.set(a.space, list);
    }

    const sections = [];
    let alarm = false;
    for (const s of spaces()) {
      const crew = (bySpace.get(s.id) ?? []).sort((x, y) => RANK[y.a.status] - RANK[x.a.status] || y.a.seq - x.a.seq);
      alarm ||= crew.some((c) => c.a.status === "blocked");
      const own = cfg.spaces[s.name] ?? {};
      const room = { ...cfg.rooms[hash(s.name) % cfg.rooms.length], ...own };
      const section = v_flex().gap(3).flex_none().child(this.header(s, room.roof, crew, t));
      if (isSplit(cfg, s.name)) {
        const byFloor = new Map(cfg.floors.map((f) => [f.id, []]));
        const limit = cfg.activeMinutes * 60000;
        for (const c of crew) {
          // Off the floors: idle agents, and finished or waiting ones that have been quiet for a while.
          if (c.a.status !== "working" && (c.a.status === "idle" || now - c.info.at > limit)) continue;
          const f = matchFloor(cfg, c.info.cwd) ?? cfg.floors.find((x) => x.id === this.screen.get(c.a.address)?.id) ?? fallbackFloor(cfg);
          byFloor.get(f.id).push(c);
        }
        for (const f of cfg.floors) if (byFloor.get(f.id).length) section.child(this.floorRow(f, byFloor.get(f.id), t, m));
      } else if (crew.length) {
        section.child(h_flex().h(FLOOR_H).flex_none().px(0)
          .child(this.room({ id: s.id, name: s.name, ...room }, crew, Math.max(1, Math.floor((this.width - 24) / SLOT)), m)));
      }
      sections.push(section);
    }

    let beacon = div().size(8).rounded_full().bg(alarm ? COLOR.blocked : "#46A758");
    if (alarm && m.k) beacon = beacon.loop("opacity", { from: 0.2, to: 1, period: 600 * m.k });
    const roof = h_flex().h(22).flex_none().px(6).items_center().justify_between()
      .child(h_flex().gap(6).items_center().child(beacon)
        .child(div().text_size(10).text_color(this.error ? COLOR.blocked : t.dim).child(this.error ? "uc-workspace.json is invalid" : alarm ? "someone needs you" : "all quiet")))
      .child(div().id("uc-config").px(5).rounded(4).text_size(10).text_color(t.dim).cursor_pointer().tooltip(`Customize: ${path()}`)
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click(async () => { await ensureFile(); (window()?.platform === "macos" ? exec("open", ["-t", path()]) : exec("xdg-open", [path()])).catch(() => {}); }).child("customize"));
    const add = h_flex().id("uc-new-site").h(28).flex_none().px(6).gap(7).items_center().rounded(6).text_size(12).text_color(t.dim).cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => run("space.new"))
      .child(svg("mods/uc-site/plus.svg").size(12)).child("New workspace");

    return v_flex().id("uc-site").size_full().bg(t.chrome).px(6).pb(6).gap(8).overflow_y_scrollbar()
      .on_size_change((sz, cx) => { if (Math.abs(sz.width - this.width) > 2) { this.width = sz.width; cx.notify(); } })
      .child(roof).children(sections).child(add);
  }
}
