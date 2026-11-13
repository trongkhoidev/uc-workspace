// Spaces as little construction sites: a pixel building per space whose windows light up
// with its agents, the agents as tiny workers underneath, and a one-line status. No branch names.
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, spaces, agents, run, layout } from "herdr";

const ROOFS = ["#8B5CF6", "#F2A33A", "#37C5D6", "#E5484D", "#46A758", "#3186FF"];
const STATUS = { working: "#F2A33A", blocked: "#E5484D", done: "#46A758", idle: "#3B3F55" };
const WORDS = { working: "working", blocked: "needs you", done: "done", idle: "idle" };
const SHIRTS = { claude: "#D97757", codex: "#5B6CF0", opencode: "#2F3B4C", antigravity: "#3186FF", gemini: "#3186FF", cursor: "#3A3A3A", copilot: "#8957E5", amp: "#F34E3F", kimi: "#2D7FF9", grok: "#555555" };
const shirt = (key) => {
  const k = String(key ?? "").toLowerCase();
  const hit = Object.keys(SHIRTS).find((n) => k.includes(n)) ?? (k.includes("agy") ? "antigravity" : null);
  if (hit) return SHIRTS[hit];
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 50%)`;
};
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const r = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// 34x34: roof with an antenna, a body with up to six windows (one per agent), a door.
function building(roof, crew) {
  let b = div().relative().w(34).h(34).flex_none()
    .child(r(2, 30, 30, 4, "#00000055")).child(r(3, 8, 28, 24, "#2A2B3F")).child(r(1, 5, 32, 4, roof)).child(r(16, 0, 2, 5, "#6B7280"));
  const alarm = crew.some((a) => a.status === "blocked");
  b = b.child(alarm ? r(15, 0, 4, 3, "#E5484D").loop("opacity", { from: 0.2, to: 1, period: 600 }) : r(15, 0, 4, 3, "#46A758"));
  for (let i = 0; i < 6; i++) {
    const a = crew[i];
    const win = r(6 + (i % 3) * 8, 12 + Math.floor(i / 3) * 8, 6, 5, a ? STATUS[a.status] : "#1B1C2B");
    b = b.child(a?.status === "blocked" ? win.loop("opacity", { from: 0.3, to: 1, period: 700 }) : win);
  }
  return b.child(r(14, 26, 6, 6, "#14151F"));
}

export default class UcSpaces extends View {
  card(s, t, collapsed) {
    const crew = agents().filter((a) => a.space === s.id);
    const roof = ROOFS[hash(s.name) % ROOFS.length];
    const counts = {};
    for (const a of crew) counts[a.status] = (counts[a.status] ?? 0) + 1;
    const top = ["blocked", "working", "done", "idle"].find((k) => counts[k]);
    const line = crew.length
      ? ["blocked", "working", "done", "idle"].filter((k) => counts[k]).map((k) => `${counts[k]} ${WORDS[k]}`).join(" · ")
      : "no one on site";
    const card = h_flex().id(`uc-space-${s.id}`).relative().gap(10).items_center().rounded(9).cursor_pointer()
      .when(collapsed, (el) => el.w(40).h(42).justify_center())
      .when(!collapsed, (el) => el.h(54).px(8))
      .when(s.active, (el) => el.bg(t.selected).border_1().border_color(roof + "88"))
      .when(!s.active, (el) => el.hover((x) => x.bg(t.hover)))
      .on_click(() => run("space.select", { id: s.id }))
      .child(building(roof, crew));
    if (collapsed) return card.tooltip(`${s.name} · ${line}`);
    const heads = h_flex().gap(3).items_center().h(10);
    crew.slice(0, 8).forEach((a) => heads.child(div().id(`h-${a.address}`).w(7).h(9).flex_none().tooltip(`${a.program?.name ?? "agent"} · ${WORDS[a.status]}`)
      .child(r(0, 0, 7, 3, "#F2C94C")).child(r(0, 3, 7, 6, shirt(a.program?.key ?? a.app))).opacity(a.status === "idle" ? 0.55 : 1)));
    if (crew.length > 8) heads.child(div().text_size(9).text_color(t.dim).child(`+${crew.length - 8}`));
    return card.child(v_flex().flex_1().min_w(0).gap(3)
      .child(div().text_size(13).font_semibold().text_color(t.foreground).truncate().child(s.name))
      .child(crew.length ? heads : div().h(10))
      .child(div().text_size(10).truncate().text_color(top && top !== "idle" ? STATUS[top] : t.dim).child(line)));
  }

  render() {
    const t = theme();
    const collapsed = narrow();
    return v_flex().size_full().min_h(0).bg(t.chrome)
      .child(h_flex().h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .when(collapsed, (el) => el.pl(0).pr(0).justify_center())
        .when(!collapsed, (el) => el.child("Sites"))
        .child(div().id("uc-space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6)
          .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => run("space.new"))
          .child(svg("mods/uc-spaces/plus.svg").size(14))))
      .child(v_flex().flex_1().min_h(0).px(collapsed ? 0 : 8).pb(8).gap(4).when(collapsed, (el) => el.items_center()).overflow_y_scrollbar()
        .children(spaces().map((s) => this.card(s, t, collapsed))));
  }
}
