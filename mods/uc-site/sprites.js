// The workers. Every one is the same pixel body (30x42 px, drawn from rectangles) in the agent's
// own colors; the pose decides arms, tool, props and which native .loop() runs.
// Herdr draws no timers for this: each loop runs on the GPU and stops when the row is off screen.

import { div } from "gpui-kit";

const SKIN = "#F2C9A0", DARK = "#2A1F2D", PANTS = "#3A3F58", BOOT = "#22232D", VEST = "#F2C94C";
export const W = 30, H = 42;

const r = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
// A native ping-pong loop; m.k scales every period (0 = motion off).
const lp = (m, el, prop, from, to, period, easing) =>
  m.k ? el.loop(prop, { from, to, period: Math.max(100, period * m.k), ...(easing ? { easing } : {}) }) : el;

const arm = (m, sp, x, y, { kids = [], up = false, anim = null, prop = "top" } = {}) => {
  let a = div().absolute().left(x).top(y).w(4).h(14);
  a = up ? a.child(r(0, 3, 4, 11, sp.shirt)).child(r(0, 0, 4, 3, SKIN)) : a.child(r(0, 0, 4, 11, sp.shirt)).child(r(0, 10, 4, 3, SKIN));
  for (const k of kids) a = a.child(k);
  return anim ? lp(m, a, prop, anim[0], anim[1], anim[2]) : a;
};

// Tools sit above the hand so the arm swing reads as a swing.
const TOOLS = {
  hammer: (m) => [r(1, -8, 2, 12, "#8B5A2B"), r(-2, -10, 8, 4, "#9AA0B5")],
  roller: (m, sp, paint) => [r(1, -6, 2, 10, "#9CA3AF"), r(-3, -11, 10, 5, paint)],
  driver: (m) => [r(1, -8, 2, 9, "#C7CAD4"), r(0, 0, 4, 5, "#E5484D")],
  solder: (m) => [r(1, -8, 2, 10, "#BDBDBD"), lp(m, r(0, -11, 4, 3, "#FFB020"), "opacity", 0.3, 1, 300)],
  box: () => [r(-5, -4, 13, 9, "#B9854F"), r(0, -4, 2, 9, "#E7D3A6")],
};

const shade = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const d = (v) => Math.max(0, v - 38).toString(16).padStart(2, "0");
  return `#${d(n >> 16)}${d((n >> 8) & 255)}${d(n & 255)}`;
};

const bubble = (m, text, bg, left, period) =>
  lp(m, div().absolute().left(left).top(-14).px(4).rounded(3).bg(bg).text_color("#fff").text_size(10).font_semibold().child(text), "opacity", 0.25, 1, period);

// sp: {shirt, hat, accent?, visor?, scarf?, rainbow?}   pose: working | review | blocked | waiting | done | idle | empty
export function worker(sp, pose, tool, paint, m) {
  const closed = pose === "idle" || pose === "empty";
  const hat = pose === "review" ? "#F4F4F5" : sp.hat;

  let head = div().absolute().left(0).top(pose === "empty" ? 3 : 0).w(W).h(18)
    .child(r(6, 0, 18, 6, hat)).child(r(4, 5, 22, 2, shade(hat))).child(r(7, 7, 16, 9, SKIN));
  if (closed) head = head.child(r(10, 12, 3, 1, DARK)).child(r(17, 12, 3, 1, DARK));
  else if (sp.visor) head = head.child(r(8, 9, 14, 5, "#1B2140")).child(r(10, 11, 10, 1, "#DDE4FF"));
  else head = head.child(r(10, 10, 3, 3, DARK)).child(r(17, 10, 3, 3, DARK));
  if (pose === "review") head = lp(m, head, "left", -2, 2, 1400);

  let body = div().absolute().left(0).top(0).w(W).h(H).child(r(6, 16, 18, 12, sp.shirt))
    .child(r(8, 16, 3, 12, VEST)).child(r(19, 16, 3, 12, VEST))
    .child(r(8, 28, 6, 10, PANTS)).child(r(16, 28, 6, 10, PANTS)).child(r(7, 38, 8, 4, BOOT)).child(r(15, 38, 8, 4, BOOT));
  if (sp.scarf) body = body.child(r(6, 15, 18, 3, sp.scarf));
  if (sp.rainbow) body = body.child(r(6, 25, 6, 2, "#E5484D")).child(r(12, 25, 6, 2, "#F2C94C")).child(r(18, 25, 6, 2, "#3186FF"));
  body = body.child(head);

  const kit = (TOOLS[tool] ?? TOOLS.hammer)(m, sp, paint);
  let L, R;
  switch (pose) {
    case "working":
      L = arm(m, sp, 1, 16); R = arm(m, sp, 25, 14, { kids: kit, anim: [14, 19, 420] }); break;
    case "review":
      L = arm(m, sp, 1, 12, { kids: [r(-3, -9, 8, 8, "#9CA3AF"), r(-2, -8, 6, 6, "#BAE6FD"), r(3, -1, 2, 5, "#9CA3AF")] });
      R = arm(m, sp, 25, 17, { kids: [r(-7, -1, 10, 12, "#E8E1CF"), r(-5, 2, 6, 1, "#9CA3AF"), r(-5, 5, 6, 1, "#9CA3AF"), r(-5, 8, 4, 1, "#9CA3AF")] }); break;
    case "blocked":
      L = arm(m, sp, 1, 16); R = arm(m, sp, 25, 4, { up: true, anim: [24, 27, 450], prop: "left" }); break;
    case "waiting":
      L = arm(m, sp, 1, 4, { up: true, anim: [0, -3, 260], prop: "left" }); R = arm(m, sp, 25, 4, { up: true, anim: [24, 27, 260], prop: "left" }); break;
    case "done":
      L = arm(m, sp, 1, 4, { up: true }); R = arm(m, sp, 25, 4, { up: true }); break;
    case "idle":
      L = arm(m, sp, 1, 16); R = arm(m, sp, 25, 17, { kids: [r(-1, -3, 6, 6, "#F4E9DC"), r(5, -2, 2, 3, "#F4E9DC")] }); break;
    default: // empty: out of tokens, slumped
      L = arm(m, sp, 1, 20); R = arm(m, sp, 25, 20);
  }
  body = body.child(L).child(R);
  if (pose === "working") body = lp(m, body, "top", 0, 1.5, 420);
  if (pose === "waiting") body = lp(m, body, "top", 0, -2, 260);
  if (pose === "done") body = lp(m, body, "top", 0, -8, 560, "ease-out");
  if (pose === "empty") body = body.top(5);

  let slot = div().relative().w(W).h(H).child(r(2, 40, 26, 3, "#00000055")).child(body);
  if (pose === "blocked") slot = slot.child(bubble(m, "!", "#E5484D", 10, 500));
  if (pose === "waiting") slot = slot.child(bubble(m, "!!", "#E5484D", 7, 260));
  if (pose === "done") {
    const star = (x, y, c, p) => lp(m, div().absolute().left(x).top(y).text_size(10).text_color(c).child("✦"), "opacity", 0.1, 1, p);
    slot = slot.child(star(-6, 2, "#F2C94C", 500)).child(star(26, -2, "#FFFFFF", 700)).child(star(24, 16, "#F2C94C", 900));
  }
  if (pose === "idle") {
    slot = slot.child(div().absolute().left(20).top(-12).text_size(10).text_color("#9AA0B5").frames(["z", "zz", "zzz"], 700 * (m.k || 1)).child("z"));
    slot = slot.child(lp(m, div().absolute().left(31).top(6).text_size(9).text_color("#FFFFFF").child("~"), "opacity", 0.1, 0.8, 1200));
  }
  if (pose === "empty") {
    slot = slot.child(div().absolute().left(8).top(-14).text_size(11).frames(["⏳", "⌛"], 900 * (m.k || 1)).child("⏳"));
    slot = slot.child(r(-9, 34, 8, 8, "#6B7280")).child(r(-9, 34, 8, 2, "#374151"));
  }
  return slot;
}
