// One section per workspace, each with a room that holds all its agents. The workspace(s) named in `splitSpaces` (UCTalent)
// are a building: a HALL where every agent that is not coding waits, and below it one floor per repo used today, in the
// order they were first used. An agent that starts coding walks the real way down (along its floor, down every staircase)
// to its repo's floor, and back up when it stops. Floors used today stay until the day ends.

import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, panes, spaces, terminals, theme, run, exec, hc, window } from "herdr";
import { worker, W, H, WALLS, bulk } from "./sprites.js";
import { decor } from "./decor.js";
import { DEFAULTS, load, ensureFile, path, matchFloor, screenFloor, isReview, looks } from "./config.js";

const FLOOR_H = 76, LABEL_W = 40, SLOT = 36, WAIT_MS = 60 * 1000;
// The building: panels FLOOR_H high with a SLAB between them. A wooden ladder at the right end of every floor (its middle
// LADDER_IN from the room's right edge) goes up through a hole in the floor above.
const SLAB = 6, LADDER_IN = 22, LADDER_W = 20, RUNG = 9;
// The hall is taller, with LANES rows of standing places one behind the other (LANE_DY apart), so it holds a crowd.
const HALL_H = 124, LANES = 3, LANE_DY = 18;
// Walking speed in px/s on a floor and on the ladder.
const WALK_V = 70, CLIMB_V = 40, LEAD_MS = 160;
const COLOR = { blocked: "#E5484D", done: "#46A758", working: "#F2A33A", idle: "#6B7280" };
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const WORDS = { blocked: "needs you", working: "working", done: "done", idle: "idle" };
const POSE_LABEL = { working: "working", review: "reviewing", blocked: "needs you", waiting: "still waiting for you", done: "done", idle: "idle", empty: "out of tokens", walk: "walking" };
const SPEED = { off: 0, slow: 1.6, normal: 1, fast: 0.6 };

// The session an agent works for: its terminal title without the status glyph, cut short.
const session = (a) => {
  const t = String(a.title ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim() || a.tab_name || "";
  return t.length > 32 ? `${t.slice(0, 31)}…` : t;
};
// "2M", "889.5k", "76.2M" from the footer of an agent's screen -> a number.
const parseTok = (t) => {
  const n = /^([\d.]+)([kMB]?)$/.exec(t ?? "");
  return n ? Number(n[1]) * ({ k: 1e3, M: 1e6, B: 1e9 }[n[2]] ?? 1) : null;
};
const fmtTok = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
// The footer shows "cost  tokens ..." over its values; take the word under "tokens" of the lowest such block.
const footerTokens = (screen) => {
  const L = String(screen).split("\n");
  for (let i = L.length - 2; i >= 0; i--) {
    const c = L[i].indexOf("tokens");
    if (c < 0 || !/\bcost\b/.test(L[i])) continue;
    return parseTok(L[i + 1].slice(c).trim().split(/\s+/)[0]);
  }
  return undefined; // no footer on screen
};
const since = (ms) => {
  const m = Math.floor(ms / 60000);
  return m < 1 ? "<1m" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
};
const r = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
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
    cx.timer.every(10000, reload);
    cx.timer.every(15000, (cx) => cx.notify()); // ages "needs you" into "still waiting"
    // In a split workspace, an agent whose folder names no floor (started above the repos) is placed by its screen.
    this.screen = new Map(); // address -> { id, at }
    this.stat = new Map(); // address -> ms since the epoch when its status last changed (from hc get)
    this.turns = new Map(); // address -> turns so far (from hc get)
    this.tokAt = new Map(); // address -> when its footer was last read
    this.tokens = new Map(); // address -> tokens used in its session (footer of its screen): the size of the worker
    const scan = (cx) => cx.spawn(async (cx) => {
      const where = new Map(panes().map((p) => [p.pane, p]));
      const split = new Set(spaces().filter((s) => isSplit(this.cfg, s.name)).map((s) => s.id));
      let changed = false;
      for (const a of agents()) {
        const got = await hc(["get", a.address, "--json"]).catch(() => null);
        try {
          const j = JSON.parse(got?.stdout ?? "{}");
          const ms = j.status_ms;
          if (ms && ms !== this.stat.get(a.address)) { this.stat.set(a.address, ms); changed = true; }
          if (Number.isFinite(j.turn) && j.turn !== this.turns.get(a.address)) { this.turns.set(a.address, j.turn); changed = true; }
        } catch { /* no timestamp: the mod's own clock is used */ }
        // The session's tokens, from the footer at the bottom of its screen; /clear makes the footer start over.
        // Only for agents that show it, at most every 20 s each (one process per read).
        const key = a.program?.key ?? a.app;
        if (String(key).includes("claude") && Date.now() - (this.tokAt.get(a.address) ?? 0) > 20000) {
          this.tokAt.set(a.address, Date.now());
          const tail = await hc(["read", a.address, "--lines", "12"]).catch(() => null);
          const tk = tail?.code === 0 ? footerTokens(tail.stdout) : undefined;
          if (tk !== undefined && tk !== this.tokens.get(a.address)) { this.tokens.set(a.address, tk); changed = true; }
        }
        // Only agents that are coding need a floor; a read counts once it is newer than the moment they started.
        if (!split.has(a.space) || a.status !== "working" || matchFloor(this.cfg, where.get(a.pane)?.cwd)) continue;
        const prev = this.screen.get(a.address);
        if (prev && prev.at >= (this.stat.get(a.address) ?? 0) && Date.now() - prev.at < 10000) continue;
        const out = await hc(["read", a.address, "--lines", String(this.cfg.screenLines)]).catch(() => null);
        const id = (out?.code === 0 ? screenFloor(this.cfg, out.stdout)?.id : null) ?? prev?.id ?? null; // no hit: stay where it was
        changed = true;
        this.screen.set(a.address, { id, at: Date.now() });
      }
      if (changed) cx.notify();
    });
    scan(cx);
    cx.timer.every(8000, scan);
    this.zone = new Map(); // address -> { id, from, at }: where an agent is (hall or a floor id) and where it came from
    this.walks = new Map(); // address -> { from: {x, y}, t0, pts, durs }: an agent on its way to its zone
    this.pos = new Map(); // address -> {x, y}: where an agent stood when last drawn, in building coordinates
    this.walking = false;
    // Floors used today, in the order of first use; kept in the mod's own storage so a reload keeps them.
    this.today = { day: "", order: [] };
    try { this.today = JSON.parse(localStorage.getItem("uc-floors") ?? "") ?? this.today; } catch { /* first run */ }
    cx.timer.every(LEAD_MS, (cx) => { if (this.walking) cx.notify(); }); // moves walkers on to their next stretch
  }

  pose(a, info, now) {
    const { cfg } = this;
    if (info.pct != null && info.pct >= cfg.tokensOutAt && a.status !== "working") return "empty";
    if (a.status === "blocked") return now - info.at > WAIT_MS ? "waiting" : "blocked";
    if (a.status === "working" && isReview(cfg, info.cwd, a.title)) return "review";
    return a.status;
  }

  // wander: { dx, dy, p } strolls back and forth (and a little in depth) around the spot instead of standing.
  figure(c, x, f, m, y = FLOOR_H - 8 - H + 2, wander = null) {
    const { a, info } = c;
    const pose = wander ? "walk" : c.pose;
    const sp = looks(this.cfg, a.program?.key ?? a.app);
    const own = sp.images?.[pose] ?? sp.image;
    const k = bulk(info.tok);
    let body = own ? image(own).w(W * k).h(H * k) : worker(sp, pose, f.tool, f.paint, m, hash(a.address), k);
    if (wander && m.k) body = div().absolute().left(0).top(0).w(W * k).h(H * k).loop("left", { from: -wander.dx, to: wander.dx, period: wander.p * m.k })
      .child(div().absolute().left(0).top(0).w(W * k).h(H * k).loop("top", { from: -wander.dy, to: wander.dy, period: wander.p * 0.7 * m.k }).child(body));
    // Fat or thin, the feet stay where they were.
    return div().id(`w-${a.address}`).absolute().left(x - (W * k - W) / 2).top(y - (H * k - H)).w(W * k).h(H * k).cursor_pointer()
      .tooltip(`${session(a)}\n${a.program?.name || "agent"} · ${POSE_LABEL[pose]} · ${since(Date.now() - info.at)} · ${fmtTok(info.tok)} tokens`)
      .on_click(() => run("pane.focus", { pane: a.pane })).child(body);
  }

  // A painter at work recolours the wall panel behind it: two rollers of its own colours sweep across the room and fade.
  paintWall(f, crew, w, h, m) {
    if (f.tool !== "roller" || !m.k) return [];
    return crew.filter((c) => c.pose === "working" || c.pose === "review").flatMap((c) => {
      const v = hash(c.a.address), x = (v % 5) * 6;
      return [0, 1].map((i) => {
        const col = WALLS[(v + i) % WALLS.length];
        return div().absolute().left(x).top(0).w(w - x).h(h).overflow_hidden()
          .child(div().absolute().left(0).top(0).w(w - x).h(h).bg(`${col}${i ? "33" : "44"}`)
            .loop("opacity", { from: 0.1, to: 1, period: (i ? 9000 : 6000) * m.k }));
      });
    });
  }

  // A room: wall, floor line, props, then the workers (the last slot becomes "+N" when they don't all fit).
  room(f, crew, cap, m) {
    const shown = crew.length > cap ? crew.slice(0, Math.max(1, cap - 1)) : crew;
    const more = crew.length - shown.length;
    const solid = f.background && String(f.background).startsWith("#");
    const room = div().relative().flex_1().min_w(0).h(FLOOR_H).overflow_hidden().rounded(8).border_1().border_color(`${String(f.paint ?? "#9AA0B5").slice(0, 7)}44`).bg(solid ? f.background : f.wall)
      .when(Boolean(f.background) && !solid, (el) => el.child(image(f.background).absolute().left(0).top(0).w_full().h_full()))
      .children(this.paintWall(f, crew, 400, FLOOR_H - 8, m))
      .children(decor(f, m))
      .child(div().absolute().left(0).top(FLOOR_H - 8).w_full().h(8).bg(f.floor));
    shown.forEach((c, i) => room.child(this.figure(c, 10 + i * SLOT, f, m)));
    if (more > 0) room.child(div().absolute().right(6).top(8).px(5).rounded(8).bg("#00000066").text_size(10).text_color("#fff").child(`+${more}`));
    return room;
  }

  // Every agent of a floor or workspace, from every tab, grouped by worktree (stable order while states change). More than
  // fit in a row wrap onto more rooms below; no agents gives one empty room.
  rooms(f, crew, cap, m) {
    const sorted = [...crew].sort((x, y) => String(x.info.cwd).localeCompare(String(y.info.cwd)) || x.a.seq - y.a.seq);
    const col = v_flex().flex_1().min_w(0).gap(3);
    const row = (list) => col.child(h_flex().h(FLOOR_H).flex_none().child(this.room(f, list, cap, m)));
    if (!sorted.length) row([]);
    for (let i = 0; i < sorted.length; i += cap) row(sorted.slice(i, i + cap));
    return col;
  }

  // Where an agent stands: in the hall until it first codes, then on the floor of the repo it coded in last, done or not.
  // Coding puts it on the floor of its folder, else of what its screen names; when neither names a repo it stays put.
  zoneOf(c, rec) {
    const { a, info } = c;
    if (a.status !== "working") return rec?.id ?? "hall";
    const f = matchFloor(this.cfg, info.cwd);
    if (f) return f.id;
    const e = this.screen.get(a.address);
    if (e?.id && e.at >= info.at) return e.id;
    return rec?.id ?? "hall";
  }

  // ---- The UCTalent building ----
  // Rows: 0 is the hall, then today's floors. Coordinates are relative to the building's top-left corner.
  building(crew, t, m, now) {
    const { cfg } = this;
    const RW = Math.max(150, this.width - 12 - LABEL_W - 4), X0 = LABEL_W + 4;
    const rowH = (k) => (k === 0 ? HALL_H : FLOOR_H);
    const top = (k) => (k === 0 ? 0 : HALL_H + SLAB + (k - 1) * (FLOOR_H + SLAB));
    const standY = (k) => top(k) + rowH(k) - 8 - H + 2; // the front line of a row, where the ladder is
    const ladderX = X0 + RW - LADDER_IN - W / 2; // a worker on the ladder, centred on it

    const day = new Date().toLocaleDateString("sv");
    if (this.today?.day !== day || !Array.isArray(this.today?.order)) this.today = { day, order: [], zones: {} };
    this.today.zones ??= {};
    // YARD is the catch-all of folder matching and is never reached by it; an agent whose repo can't be told stays put.
    const valid = new Set(cfg.floors.filter((f) => !f.match?.includes("*")).map((f) => f.id));
    let save = false;

    // Where everyone belongs now; a change of zone starts a walk from wherever the agent is at this moment.
    const zoneById = new Map();
    for (const c of crew) {
      const addr = c.a.address;
      // After a reload, an agent goes back to the floor it was on today, without walking there.
      if (!this.zone.has(addr) && this.today.zones[addr]) this.zone.set(addr, { id: this.today.zones[addr] });
      const rec = this.zone.get(addr);
      let id = this.zoneOf(c, rec);
      if (id !== "hall" && !valid.has(id)) id = "hall";
      if (id !== "hall" && !this.today.order.includes(id)) { this.today.order.push(id); save = true; }
      if (rec && rec.id !== id) this.walks.set(addr, { from: this.at(addr, now, standY), t0: now });
      this.zone.set(addr, { id });
      if (this.today.zones[addr] !== id) { this.today.zones[addr] = id; save = true; }
      zoneById.set(addr, id);
    }
    if (save) try { localStorage.setItem("uc-floors", JSON.stringify(this.today)); } catch { /* kept for this run only */ }
    const rows = [{ id: "hall", ...cfg.hall }, ...this.today.order.filter((id) => valid.has(id)).map((id) => cfg.floors.find((f) => f.id === id))];
    const rowOf = new Map(rows.map((f, k) => [f.id, k]));

    // Slots: everyone of a row in one line, closer together when crowded, clear of the stairs.
    const target = new Map(); // address -> {x, y}
    const members = rows.map((f, k) => {
      const list = crew.filter((c) => zoneById.get(c.a.address) === f.id)
        .sort((x, y) => String(x.info.cwd).localeCompare(String(y.info.cwd)) || x.a.seq - y.a.seq);
      const usable = RW - 10 - LADDER_IN - LADDER_W;
      if (k === 0) { // the hall: front lane first, then the ones behind, each lane shifted a little so nobody hides
        const per = Math.ceil(list.length / LANES) || 1;
        const gap = per > 1 ? Math.min(SLOT + 8, Math.max(8, (usable - W - 16) / (per - 1))) : 0;
        list.forEach((c, i) => {
          const lane = i % LANES, col = Math.floor(i / LANES);
          target.set(c.a.address, { x: X0 + 10 + lane * 8 + col * gap, y: standY(0) - lane * LANE_DY, lane });
        });
        return list;
      }
      const gap = list.length > 1 ? Math.min(SLOT, Math.max(8, (usable - W) / (list.length - 1))) : 0;
      list.forEach((c, i) => target.set(c.a.address, { x: X0 + 10 + i * gap, y: standY(k) }));
      return list;
    });

    // Plan each new walk once: along its row to the stairs, every staircase between, then to its slot.
    const walkers = [];
    for (const [addr, w] of this.walks) {
      const end = target.get(addr);
      if (!end) { this.walks.delete(addr); continue; } // the agent closed
      if (!w.pts) {
        const feet = w.from.y + H - 2;
        let r0 = 0;
        while (r0 < rows.length - 1 && feet > top(r0) + rowH(r0) + SLAB / 2) r0++;
        const r1 = rowOf.get(zoneById.get(addr)) ?? 0;
        const pts = [w.from];
        // Along its row to the ladder (coming forward from the back of the hall), straight down or up it, then to its slot.
        if (r1 !== r0) pts.push({ x: ladderX - 4, y: standY(r0) }, { x: ladderX, y: standY(r0) }, { x: ladderX, y: standY(r1) });
        w.pts = pts;
      }
      const pts = [...w.pts, end]; // the last stretch follows the slot if the row shifts meanwhile
      const durs = pts.slice(1).map((p, i) => {
        const q = pts[i], d = Math.hypot(p.x - q.x, p.y - q.y);
        return (1000 * d) / (p.x === q.x && p.y !== q.y ? CLIMB_V : WALK_V);
      });
      const e = now - w.t0 - LEAD_MS;
      const total = durs.reduce((s, d) => s + d, 0);
      if (e >= total) { this.walks.delete(addr); continue; }
      let k = 0, acc = 0;
      while (e >= 0 && k < durs.length - 1 && e >= acc + durs[k]) acc += durs[k++];
      const c = crew.find((x) => x.a.address === addr);
      const down = (rowOf.get(zoneById.get(addr)) ?? 0) > 0;
      const next = e < 0 ? pts[0] : pts[k + 1], from = e < 0 ? pts[0] : pts[k];
      walkers.push({ c, f: rows[rowOf.get(zoneById.get(addr)) ?? 0], down, climb: e >= 0 && next.y !== from.y && next.x === from.x, to: next, ms: e < 0 ? 0 : Math.max(60, acc + durs[k] - e), e, pts, durs });
      w.state = { pts, durs };
    }
    this.walking = walkers.length > 0;

    const bld = v_flex().relative().flex_none();
    rows.forEach((f, k) => {
      if (k > 0) bld.child(h_flex().h(SLAB).flex_none().gap(4).child(div().w(LABEL_W).flex_none())
        .child(div().relative().w(RW).h(SLAB).bg("#0B0D14").children(this.ladder(RW - LADDER_IN, -2, SLAB + 4))));
      const list = members[k];
      const top1 = list.reduce((s, c) => (RANK[c.a.status] > RANK[s] ? c.a.status : s), "idle");
      const paint = String(f.paint ?? "#9AA0B5").slice(0, 7);
      const hh = rowH(k);
      const label = v_flex().w(LABEL_W).h(hh).flex_none().gap(3).pl(2).justify_center()
        .child(div().text_size(11).font_semibold().text_color(paint).child(String(f.name).toUpperCase()))
        .child(h_flex().id(`fc-${f.id}`).gap(4).items_center().tooltip(`${list.filter((c) => c.a.status === "working").length} coding · ${list.length} here`)
          .child(div().size(6).rounded_full().bg(list.length ? COLOR[top1] : t.dim))
          .child(div().text_size(10).text_color(t.dim).child(String(list.length))));
      const solid = f.background && String(f.background).startsWith("#");
      const room = div().relative().w(RW).h(hh).overflow_hidden().rounded(6).border_1().border_color(`${paint}66`).bg(solid ? f.background : f.wall)
        .when(Boolean(f.background) && !solid, (el) => el.child(image(f.background).absolute().left(0).top(0).w_full().h_full()))
        .when(k === 0, (el) => el.child(r(0, hh - 8 - (LANES - 1) * LANE_DY - 6, RW, (LANES - 1) * LANE_DY + 6, `${String(f.floor).slice(0, 7)}88`)) // the hall's floor, seen in depth
          .child(r(0, hh - 8 - (LANES - 1) * LANE_DY - 6, RW, 1, `${paint}44`)))
        .children(this.paintWall(f, list, RW - 2, hh - 8, m))
        .child(div().absolute().left(0).top(hh - FLOOR_H - (k === 0 ? (LANES - 1) * LANE_DY : 0)).w(RW - LADDER_IN - LADDER_W).h(FLOOR_H).children(decor(f, m)))
        .child(r(0, hh - 8, RW, 8, f.floor)).child(r(0, hh - 8, RW, 1, `${paint}88`));
      if (k === 0) room.child(image("mods/uc-brand/logo.png").absolute().left(RW / 2 - 22).top(8).size(44).rounded_full().opacity(0.9)); // one logo on the wall
      if (k < rows.length - 1) room.child(r(RW - LADDER_IN - LADDER_W / 2 - 3, hh - 8, LADDER_W + 6, 8, "#0B0D14")); // the hole down
      if (k > 0) room.children(this.ladder(RW - LADDER_IN, 0, hh - 8)); // up to the hole above
      if (k < rows.length - 1) room.children(this.ladder(RW - LADDER_IN, hh - 26, 26)); // its top, sticking out of the hole
      // Back lanes first so the ones in front are drawn over them. In the hall, idle agents stroll around their spot.
      for (const c of [...list].sort((x, y) => (target.get(y.a.address).lane ?? 0) - (target.get(x.a.address).lane ?? 0))) {
        if (this.walks.has(c.a.address)) continue; // on its way here: the walker draws it
        const p = target.get(c.a.address), hv = hash(c.a.address);
        this.pos.set(c.a.address, p);
        const stroll = !m.lite && k === 0 && c.a.status === "idle" && hv % 3 !== 0;
        const room_x = Math.min(p.x - X0 - 4, RW - LADDER_IN - LADDER_W - W - (p.x - X0));
        const wander = stroll ? { dx: Math.max(4, Math.min(14 + (hv % 20), room_x)), dy: p.lane ? 4 : 0, p: 7000 + (hv % 6000) } : null;
        room.child(this.figure(c, p.x - X0, f, m, p.y - top(k), wander)
          .transition("left", { duration: 500, easing: "ease-in-out" }).transition("top", { duration: 500, easing: "ease-in-out" }));
      }
      bld.child(h_flex().h(hh).flex_none().gap(4).child(label).child(room));
    });
    for (const w of walkers) {
      const sp = looks(cfg, w.c.a.program?.key ?? w.c.a.app);
      const own = sp.images?.walk ?? sp.image;
      const k = bulk(w.c.info.tok);
      const body = own ? image(own).w(W * k).h(H * k) : worker(sp, w.climb ? "climb" : "walk", w.down ? w.f.tool : null, w.f.paint, m, hash(w.c.a.address), k);
      const tr = { duration: w.ms, easing: "linear" };
      bld.child(div().id(`walk-${w.c.a.address}`).absolute().left(w.to.x - (W * k - W) / 2).top(w.to.y - (H * k - H)).w(W * k).h(H * k).cursor_pointer()
        .transition("left", tr).transition("top", tr)
        .tooltip(`${session(w.c.a)}\n${w.c.a.program?.name || "agent"} · ${w.down ? `going to ${w.f.name}` : "going up to the hall"}`)
        .on_click(() => run("pane.focus", { pane: w.c.a.pane })).child(body));
    }
    return bld;
  }

  // A wooden ladder centred on x, from y down h px: two rails and a rung every RUNG px, outlined dark like pixel art.
  ladder(x, y, h) {
    const l = x - LADDER_W / 2, out = [r(l, y, 4, h, "#111111"), r(l + LADDER_W - 4, y, 4, h, "#111111"),
      r(l + 1, y, 2, h, "#B07D4B"), r(l + LADDER_W - 3, y, 2, h, "#B07D4B")];
    for (let ry = y + 4; ry < y + h - 1; ry += RUNG) out.push(r(l + 3, ry, LADDER_W - 6, 3, "#111111"), r(l + 3, ry + 1, LADDER_W - 6, 1, "#B07D4B"), r(l + 3, ry + 1, 2, 1, "#7A5634"));
    return out;
  }

  // Where an agent is right now: along its walk, else where it was last drawn, else the hall.
  at(addr, now, standY) {
    const w = this.walks.get(addr);
    if (w?.state) {
      const { pts, durs } = w.state;
      let e = now - w.t0 - LEAD_MS;
      if (e <= 0) return pts[0];
      for (let i = 0; i < durs.length; i++) {
        if (e < durs[i]) { const f = e / durs[i]; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f }; }
        e -= durs[i];
      }
      return pts[pts.length - 1];
    }
    return this.pos.get(addr) ?? { x: LABEL_W + 14, y: standY(0) };
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
      .child(order.length ? h_flex().flex_none().gap(4).children(order.map((k) => div().px(6).py(1).rounded(8).bg(`${COLOR[k]}26`)
        .text_size(10).text_color(COLOR[k]).child(`${counts[k]} ${WORDS[k]}`))) : div().text_size(10).text_color(t.dim).child("empty"));
  }

  render() {
    const t = theme();
    const { cfg } = this;
    const m = { k: SPEED[cfg.motion] ?? 1, lite: agents().length > 5 };
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
      const info = { at: this.stat.get(a.address) ?? rec.at, cwd: p?.cwd, pct: ctx.get(a.address) ?? null, turn: this.turns.get(a.address) ?? 0, tok: this.tokens.get(a.address) ?? (this.turns.get(a.address) ?? 0) * 4e4 };
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
      const cap = Math.max(1, Math.floor((this.width - 24) / SLOT));
      if (isSplit(cfg, s.name)) {
        section.child(this.building(crew, t, m, now));
      } else section.child(this.rooms({ id: s.id, name: s.name, ...room }, crew, cap, m));
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
