// The workers. Every one is the same pixel body (30x42 px, drawn from rectangles) in the agent's
// own colors; the pose decides arms, tool, props and which native .loop() runs.
// Herdr draws no timers for this: each loop runs on the GPU and stops when the row is off screen.

import { div } from "gpui-kit";

const SKIN = "#F2C9A0", DARK = "#2A1F2D", PANTS = "#3A3F58", BOOT = "#22232D", VEST = "#F2C94C";
export const W = 30, H = 42;

// Everything is drawn at scale K (set per worker): fat agents burn many tokens, thin ones few.
let K = 1;
const r = (x, y, w, h, c) => div().absolute().left(x * K).top(y * K).w(w * K).h(h * K).bg(c);
export const WALLS = ["#C084FC", "#F472B6", "#60A5FA", "#34D399"];
// Size from tokens used in the session: 0 is skinny, 10k a bit more, ~50M the fattest (log scale).
export const bulk = (tokens) => (tokens > 1e4 ? Math.min(1.35, 0.76 + (0.59 * Math.log10(tokens / 1e4)) / 3.7) : 0.72 + (tokens / 1e4) * 0.04);
// A native ping-pong loop; m.k scales every period (0 = motion off).
const lp = (m, el, prop, from, to, period, easing) => {
  const z = prop === "opacity" ? 1 : K;
  // Lite mode (a crowded building): decorative blinking (opacity loops) is left out; moves and alerts stay.
  if (m.lite && prop === "opacity" && !m.keep) return el;
  return m.k ? el.loop(prop, { from: from * z, to: to * z, period: Math.max(100, period * m.k), ...(easing ? { easing } : {}) }) : el;
};

const arm = (m, sp, x, y, { kids = [], up = false, anim = null, prop = "top" } = {}) => {
  let a = div().absolute().left(x * K).top(y * K).w(4 * K).h(14 * K);
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
  laptop: () => [],
  stamp: () => [r(1, -7, 2, 5, "#8B5A2B"), r(-1, -9, 6, 3, "#6B4226"), r(-2, -2, 8, 3, "#E5484D")],
};

// What each floor's work leaves around the worker, drawn behind it: BE builds a brick wall, FE paints the wall in a
// colour of its own, FAST works a holo screen of a neural net, ATS prints sheets and stamps them.
function scene(m, tool, paint, v) {
  const out = [];
  if (tool === "hammer") {
    for (const [x, y] of [[30, 34], [41, 34], [35, 29], [46, 29]]) out.push(r(x, y, 10, 4, "#B5533C"), r(x, y, 10, 1, "#D9694F"));
    out.push(lp(m, r(30, 24, 10, 4, "#D9694F"), "opacity", 0, 1, 1680)); // the brick going on
    out.push(lp(m, r(31, 38, 3, 2, "#C9B8A6"), "top", 38, 33, 840), lp(m, r(38, 38, 2, 2, "#C9B8A6"), "opacity", 0, 0.8, 840)); // dust
  }
  if (tool === "roller") {
    const c = WALLS[v % WALLS.length];
    out.push(r(28, 2, 14, 36, `${c}33`), lp(m, r(28, 2, 7, 6, c), "height", 4, 36, 2400), lp(m, r(35, 2, 7, 6, c), "height", 2, 26, 3100));
    out.push(r(31, 38, 12, 3, "#9CA3AF"), r(32, 38, 10, 1, c)); // the tray
  }
  if (tool === "laptop") {
    const screen = div().absolute().left(23 * K).top(4 * K).w(22 * K).h(17 * K).rounded(2).bg("#06202A").border_1().border_color("#22D3EE")
      .child(div().absolute().left(2 * K).top(1 * K).text_size(6 * K).text_color("#67E8F9").frames(["01 1", "10 0", "11 0", "0 11"], 260 * (m.k || 1)).child("01 1"));
    for (const [x, y, p] of [[3, 10, 500], [9, 7, 700], [9, 12, 600], [15, 9, 800]]) screen.child(lp(m, r(x, y, 2, 2, "#A5F3FC"), "opacity", 0.2, 1, p));
    screen.child(r(5, 11, 4, 1, "#22D3EE66")).child(r(11, 10, 4, 1, "#22D3EE66"));
    out.push(r(21, 20, 26, 2, "#22D3EE44"), screen, lp(m, div().absolute().left(40 * K).top(-6 * K).text_size(9 * K).text_color("#67E8F9").child("✦"), "opacity", 0.1, 1, 900));
  }
  if (tool === "stamp") {
    out.push(r(28, 26, 18, 12, "#9CA3AF"), r(28, 26, 18, 2, "#D1D5DB"), r(31, 30, 12, 1, "#111827"), lp(m, r(42, 33, 2, 2, "#46A758"), "opacity", 0.2, 1, 500));
    const sheet = div().absolute().left(31 * K).top(26 * K).w(12 * K).h(14 * K).bg("#F8F5EC")
      .child(r(2, 2, 8, 1, "#6B7280")).child(r(2, 4, 6, 1, "#9CA3AF")).child(r(2, 6, 7, 1, "#9CA3AF")).child(lp(m, r(5, 9, 5, 4, "#E5484D"), "opacity", 0, 0.9, 1400));
    out.push(lp(m, sheet, "top", 26, 12, 2800, "linear"));
  }
  return out;
}

const shade = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const d = (v) => Math.max(0, v - 38).toString(16).padStart(2, "0");
  return `#${d(n >> 16)}${d((n >> 8) & 255)}${d(n & 255)}`;
};

const bubble = (m, text, bg, left, period) =>
  lp({ ...m, keep: true }, div().absolute().left(left * K).top(-14 * K).px(4).rounded(3).bg(bg).text_color("#fff").text_size(10).font_semibold().child(text), "opacity", 0.25, 1, period);

// sp: {shirt, hat, accent?, pants?, mark?, visor?, scarf?, rainbow?}
// pose: working | review | blocked | waiting | done | idle | empty | walk | climb     v: a number per agent that picks its variant
//   idle: 0 naps with coffee, 1 reads the paper, 2 scrolls the phone, 3 stretches and yawns
//   done: 0 jumps with sparkles, 1 cheers under confetti
export function worker(sp, pose, tool, paint, m, v = 0, k = 1) {
  K = k;
  const idle = pose === "idle" ? v % 6 : -1;
  const done = pose === "done" ? v % 3 : -1;
  const closed = idle === 0 || idle === 3 || pose === "empty";
  const hat = pose === "review" ? "#F4F4F5" : sp.hat;
  const accent = sp.accent ?? VEST, pants = sp.pants ?? PANTS;

  let head = div().absolute().left(0).top((pose === "empty" ? 3 : 0) * K).w(W * K).h(18 * K)
    .child(r(6, 0, 18, 6, hat)).child(r(4, 5, 22, 2, shade(hat))).child(r(13, 1, 4, 2, accent)).child(r(7, 7, 16, 9, SKIN));
  if (pose === "climb") head = head.child(r(7, 7, 16, 9, "#4A3426")); // the back of the head
  else if (closed) head = head.child(r(10, 12, 3, 1, DARK)).child(r(17, 12, 3, 1, DARK));
  else if (sp.visor) head = head.child(r(8, 9, 14, 5, "#1B2140")).child(r(10, 11, 10, 1, "#DDE4FF"));
  else head = head.child(r(10, idle === 1 || idle === 2 ? 11 : 10, 3, 3, DARK)).child(r(17, idle === 1 || idle === 2 ? 11 : 10, 3, 3, DARK));
  if (idle === 4) head = head.child(r(5, 3, 20, 2, "#111827")).child(r(4, 5, 3, 9, "#111827")).child(r(23, 5, 3, 9, "#111827")).child(r(4, 8, 3, 3, "#E5484D")).child(r(23, 8, 3, 3, "#E5484D")); // headphones
  if (idle === 3) head = head.child(lp(m, r(13, 13, 4, 3, DARK), "opacity", 0, 1, 1600)); // yawn
  if (pose === "review") head = lp(m, head, "left", -2, 2, 1400);
  if (idle === 2) head = head.top(1 * K); // looking down at the phone

  // Legs move on their own so the walk reads as steps.
  const leg = (x, from, to) => {
    const el = div().absolute().left(x * K).top(28 * K).w(8 * K).h(14 * K).child(r(1, 0, 6, 10, pants)).child(r(0, 10, 8, 4, BOOT));
    if (pose === "climb") return lp(m, el, "top", from - 1, to + 1, 520);
    return pose === "walk" ? lp(m, el, "top", from, to, 380) : el;
  };
  let body = div().absolute().left(0).top(0).w(W * K).h(H * K)
    .child(leg(7, 28, 25)).child(leg(15, 25, 28))
    .child(r(6, 16, 18, 12, sp.shirt)).child(r(8, 16, 3, 12, accent)).child(r(19, 16, 3, 12, accent));
  if (sp.mark === "spark") body = body.child(r(14, 18, 2, 7, accent)).child(r(11, 21, 8, 2, accent)).child(r(12, 19, 2, 2, accent)).child(r(16, 23, 2, 2, accent));
  if (sp.mark === "dot") body = body.child(r(13, 19, 4, 4, accent));
  if (sp.mark === "bars") body = body.child(r(12, 19, 6, 1, accent)).child(r(12, 22, 6, 1, accent)).child(r(12, 25, 6, 1, accent));
  if (sp.scarf) body = body.child(r(6, 15, 18, 3, sp.scarf)).child(r(19, 17, 3, 5, sp.scarf));
  if (sp.rainbow) body = body.child(r(6, 25, 6, 2, "#E5484D")).child(r(12, 25, 6, 2, "#F2C94C")).child(r(18, 25, 6, 2, "#3186FF"));
  body = body.child(head);

  const kit = tool ? (TOOLS[tool] ?? TOOLS.hammer)(m, sp, paint) : [];
  const mug = [r(-1, -3, 6, 6, "#F4E9DC"), r(5, -2, 2, 3, "#F4E9DC"), r(0, -2, 4, 1, "#6B4226")];
  let L, R, front = null;
  switch (pose) {
    case "working":
      if (tool === "laptop") { L = arm(m, sp, 1, 15, { anim: [15, 17, 180] }); R = arm(m, sp, 25, 14, { anim: [16, 14, 220] }); }
      else if (tool === "stamp") { L = arm(m, sp, 1, 16); R = arm(m, sp, 25, 8, { kids: kit, anim: [8, 15, 700] }); }
      else { L = arm(m, sp, 1, 16); R = arm(m, sp, 25, 14, { kids: kit, anim: [14, 19, 420] }); }
      break;
    case "climb":
      L = arm(m, sp, 3, 2, { up: true, anim: [0, 5, 520] }); R = arm(m, sp, 23, 5, { up: true, anim: [5, 0, 520] }); break;
    case "walk":
      L = arm(m, sp, 1, 16, { anim: [15, 18, 380] }); R = arm(m, sp, 25, 18, { kids: kit, anim: [18, 15, 380] }); break;
    case "review":
      L = arm(m, sp, 1, 12, { kids: [r(-3, -9, 8, 8, "#9CA3AF"), r(-2, -8, 6, 6, "#BAE6FD"), r(3, -1, 2, 5, "#9CA3AF")] });
      R = arm(m, sp, 25, 17, { kids: [r(-7, -1, 10, 12, "#E8E1CF"), r(-5, 2, 6, 1, "#9CA3AF"), r(-5, 5, 6, 1, "#9CA3AF"), r(-5, 8, 4, 1, "#9CA3AF")] }); break;
    case "blocked":
      L = arm(m, sp, 1, 16); R = arm(m, sp, 25, 4, { up: true, anim: [24, 27, 450], prop: "left" }); break;
    case "waiting":
      L = arm(m, sp, 1, 4, { up: true, anim: [0, -3, 260], prop: "left" }); R = arm(m, sp, 25, 4, { up: true, anim: [24, 27, 260], prop: "left" }); break;
    case "done":
      if (done === 2) { // holds a gold cup over its head
        L = arm(m, sp, 3, 4, { up: true }); R = arm(m, sp, 23, 4, { up: true });
        front = div().absolute().left(0).top(0).w(W * K).h(H * K).child(r(7, -12, 16, 7, "#F2C94C")).child(r(9, -12, 12, 2, "#FDE68A")).child(r(13, -5, 4, 5, "#D4A017")).child(r(9, 0, 12, 2, "#D4A017")).child(r(4, -11, 3, 4, "#F2C94C")).child(r(23, -11, 3, 4, "#F2C94C"));
      } else if (done === 1) { L = arm(m, sp, 1, 4, { up: true, anim: [2, 6, 300] }); R = arm(m, sp, 25, 4, { up: true, anim: [6, 2, 300] }); }
      else { L = arm(m, sp, 1, 4, { up: true }); R = arm(m, sp, 25, 4, { up: true }); }
      break;
    case "idle":
      if (idle === 1) { // the paper, held in front with both hands; a page turns now and then
        L = arm(m, sp, 1, 15); R = arm(m, sp, 25, 15);
        front = div().absolute().left(2 * K).top(15 * K).w(26 * K).h(15 * K)
          .child(r(0, 0, 26, 15, "#E8E1CF")).child(r(13, 0, 1, 15, "#B8B0A0")).child(r(2, 2, 9, 2, DARK)).child(r(2, 6, 9, 1, "#8A8478"))
          .child(r(2, 9, 7, 1, "#8A8478")).child(r(15, 2, 9, 4, paint ?? "#9AA0B5")).child(r(15, 8, 9, 1, "#8A8478")).child(r(15, 11, 6, 1, "#8A8478"))
          .child(lp(m, r(14, 0, 12, 15, "#F4EFE3"), "opacity", 0, 0.9, 2600));
      } else if (idle === 2) { // the phone, up near the face, its screen flickering
        L = arm(m, sp, 1, 16);
        R = arm(m, sp, 21, 9, { up: true, kids: [r(-3, -6, 6, 9, "#111827"), lp(m, r(-2, -5, 4, 6, "#7DD3FC"), "opacity", 0.5, 1, 900)] });
      } else if (idle === 4) { // listening to music, swaying
        L = arm(m, sp, 1, 16); R = arm(m, sp, 25, 16);
      } else if (idle === 5) { // juggling three balls
        L = arm(m, sp, 3, 8, { up: true, anim: [8, 10, 500] }); R = arm(m, sp, 23, 8, { up: true, anim: [10, 8, 500] });
        front = div().absolute().left(0).top(0).w(W * K).h(H * K)
          .child(lp(m, r(5, -4, 5, 5, "#E5484D"), "top", -6, 8, 700, "ease-in-out")).child(lp(m, r(13, -8, 5, 5, "#F2C94C"), "top", -10, 6, 900, "ease-in-out")).child(lp(m, r(21, -4, 5, 5, "#3186FF"), "top", -6, 8, 800, "ease-in-out"));
      } else if (idle === 3) { // stretching, arms slowly up and down
        L = arm(m, sp, 1, 4, { up: true, anim: [6, 1, 1600] }); R = arm(m, sp, 25, 4, { up: true, anim: [6, 1, 1600] });
      } else { L = arm(m, sp, 1, 16); R = arm(m, sp, 25, 17, { kids: mug }); }
      break;
    default: // empty: out of tokens, slumped
      L = arm(m, sp, 1, 20); R = arm(m, sp, 25, 20);
  }
  body = body.child(L).child(R);
  if (front) body = body.child(front);
  if (pose === "working" || pose === "walk") body = lp(m, body, "top", 0, 1.5, pose === "walk" ? 380 : 420);
  if (pose === "waiting") body = lp(m, body, "top", 0, -2, 260);
  if (pose === "done") body = lp(m, body, "top", 0, done === 1 ? -3 : done === 2 ? -4 : -8, done === 1 ? 300 : done === 2 ? 420 : 560, "ease-out");
  if (idle === 3) body = lp(m, body, "top", 0, -1, 1600);
  if (idle === 4) body = lp(m, body, "left", -1.5, 1.5, 650);
  if (pose === "empty") body = body.top(5 * K);

  // The agent's own color glows under its feet, so it can be told apart at a glance.
  let slot = div().relative().w(W * K).h(H * K).children(pose === "working" ? scene(m, tool, paint, v) : []).child(r(0, 39, 30, 4, `${String(sp.shirt).slice(0, 7)}66`)).child(r(3, 40, 24, 2, `${String(sp.shirt).slice(0, 7)}AA`)).child(body);
  if (pose === "working") {
    slot = slot.child(lp(m, r(3, 5, 2, 3, "#7DD3FC"), "opacity", 0, 0.9, 1800)); // sweat
    if (tool === "hammer" || tool === "driver" || tool === "solder") // sparks where the tool lands, in time with the swing
      slot = slot.child(lp(m, r(31, 8, 2, 2, "#FFD27A"), "opacity", 0, 1, 420)).child(lp(m, r(33, 5, 1, 1, "#FFFFFF"), "opacity", 0, 1, 420));
    if (tool === "roller") slot = slot.child(lp(m, r(30, 4, 2, 3, WALLS[v % WALLS.length]), "top", 4, 14, 840));
    // now and then a thought: an idea, a gear, a thumbs up
    const t = ["💡", "⚙️", "👍", "🔥"][v % 4];
    slot = slot.child(lp(m, div().absolute().left(-4 * K).top(-14 * K).text_size(10).child(t), "opacity", 0, 1, 3200 + (v % 5) * 600));
  }
  if (pose === "blocked") slot = slot.child(bubble(m, "!", "#E5484D", 10, 500));
  if (pose === "waiting") slot = slot.child(bubble(m, "!!", "#E5484D", 7, 260));
  if (done === 0) {
    const star = (x, y, c, p) => lp(m, div().absolute().left(x * K).top(y * K).text_size(10).text_color(c).child("✦"), "opacity", 0.1, 1, p);
    slot = slot.child(star(-6, 2, "#F2C94C", 500)).child(star(26, -2, "#FFFFFF", 700)).child(star(24, 16, "#F2C94C", 900));
  }
  if (done === 1) {
    const bit = (x, c, p) => lp(m, r(x, -10, 2, 3, c), "top", -12, 30, p);
    slot = slot.child(bit(-2, "#E5484D", 1300)).child(bit(7, "#F2C94C", 1700)).child(bit(15, "#46A758", 1100)).child(bit(23, "#3186FF", 1500)).child(bit(30, "#8B5CF6", 1900));
  }
  if (idle === 0) {
    slot = slot.child(div().absolute().left(20 * K).top(-12 * K).text_size(10).text_color("#9AA0B5").frames(["z", "zz", "zzz"], 700 * (m.k || 1)).child("z"));
    slot = slot.child(lp(m, r(29, 4, 1, 3, "#FFFFFF88"), "top", 8, 0, 1400)).child(lp(m, r(31, 6, 1, 3, "#FFFFFF66"), "top", 10, 2, 1700)); // steam
  }
  if (idle === 2) slot = slot.child(div().absolute().left(-4 * K).top(-10 * K).px(2).rounded(3).bg("#FFFFFF22").text_size(8).text_color("#E5E7EB").frames(["·", "··", "···"], 500 * (m.k || 1)).child("·"));
  if (idle === 4) slot = slot.child(lp(m, div().absolute().left(24 * K).top(-6 * K).text_size(11).text_color("#7DD3FC").child("♪"), "top", -2, -14, 1300)).child(lp(m, div().absolute().left(-4 * K).top(-2 * K).text_size(9).text_color("#F472B6").child("♫"), "top", 0, -12, 1700));
  if (idle === 3) slot = slot.child(div().absolute().left(22 * K).top(-10 * K).text_size(9).text_color("#9AA0B5").child("~"));
  if (pose === "empty") {
    slot = slot.child(div().absolute().left(8 * K).top(-14 * K).text_size(11).frames(["⏳", "⌛"], 900 * (m.k || 1)).child("⏳"));
    slot = slot.child(r(-9, 34, 8, 8, "#6B7280")).child(r(-9, 34, 8, 2, "#374151"));
  }
  return slot;
}
