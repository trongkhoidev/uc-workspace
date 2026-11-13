// What each floor looks like behind the workers. `decor` is the floor's own furniture (bottom right),
// `props` is a list of wall and floor pieces placed along the room from the right.
// Every piece is a few rectangles; the ones that glow or blink use one native loop.
import { div } from "gpui-kit";

export const G = 68; // y of the floor line
const r = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
const R = (x, y, w, h, c) => div().absolute().right(x).top(y).w(w).h(h).bg(c);
const lp = (m, el, prop, from, to, period) => (m.k && !(m.lite && prop === "opacity") ? el.loop(prop, { from, to, period: period * m.k }) : el);
const FLAGS = ["#E5484D", "#F2C94C", "#46A758", "#3186FF"];

export const PROPS = {
  window: (m, f, x) => [R(x, 8, 28, 24, "#0B1424"), R(x + 2, 10, 24, 20, f.sky ?? "#1B2A4A"), R(x + 4, 12, 5, 5, "#F4E9B0"),
    lp(m, R(x + 14, 14, 2, 2, "#FFFFFF"), "opacity", 0.2, 1, 1300), lp(m, R(x + 20, 22, 2, 2, "#FFFFFF"), "opacity", 0.1, 1, 1900),
    R(x + 13, 10, 2, 20, "#0B1424"), R(x + 2, 19, 24, 2, "#0B1424")],
  lamp: (m, f, x) => [R(x + 12, 0, 2, 6, "#555555"), R(x + 7, 6, 12, 3, "#F2C94C"), lp(m, R(x + 2, 9, 22, 14, "#FFD27A2A"), "opacity", 0.4, 1, 2400)],
  plant: (m, f, x) => [R(x + 5, G - 24, 3, 14, "#2F7D3A"), R(x + 1, G - 20, 4, 10, "#46A758"), R(x + 8, G - 22, 4, 12, "#3C9A4B"), R(x, G - 10, 13, 10, "#B5533C"), R(x, G - 10, 13, 2, "#8E3F2C")],
  poster: (m, f, x) => [R(x, 8, 22, 28, "#E8E1CF"), R(x + 2, 10, 18, 4, f.paint), R(x + 2, 16, 12, 2, "#6B7280"), R(x + 2, 20, 16, 2, "#6B7280"), R(x + 2, 25, 10, 8, f.paint + "88")],
  clock: (m, f, x) => [R(x + 4, 8, 16, 16, "#E8E1CF"), R(x + 11, 10, 2, 7, "#2A1F2D"), R(x + 11, 15, 6, 2, "#2A1F2D")],
  shelf: (m, f, x) => [R(x, 30, 30, 3, "#8B6B45"), R(x + 3, 21, 6, 9, "#E5484D"), R(x + 11, 24, 6, 6, "#46A758"), R(x + 19, 19, 7, 11, "#3186FF")],
  rug: (m, f, x) => [R(x, G, 44, 4, f.paint + "AA"), R(x + 4, G + 1, 36, 1, "#FFFFFF44")],
  bunting: (m) => Array.from({ length: 30 }, (_, i) => r(i * 14, 0, 8, 6, FLAGS[i % 4])),
};
const SLOTS = [50, 86, 122, 158];

const FURNITURE = {
  bricks: (m) => [...Array.from({ length: 6 }, (_, i) => r(0, 8 + i * 10, 600, 1, "#00000040")), R(40, G - 6, 14, 6, "#B5533C"), R(8, G - 6, 16, 6, "#A84832"), R(12, G - 12, 14, 6, "#C8553D"), r(2, 2, 3, G - 2, "#6B728080")],
  paint: (m, f) => [r(0, 0, 90, G, "#8B5CF622"), r(90, 0, 3, G, "#8B5CF655"), R(8, G - 12, 10, 12, "#E5E7EB"), R(8, G - 12, 10, 3, f.paint), R(22, G - 8, 8, 8, "#E5E7EB"), R(22, G - 8, 8, 2, "#46A758")],
  furniture: (m) => [R(8, G - 14, 34, 14, "#7A3F34"), R(8, G - 20, 34, 6, "#8E4A3D"), R(6, G - 18, 4, 18, "#6B3329"), R(40, G - 18, 4, 18, "#6B3329")],
  circuit: (m) => [R(6, G - 42, 26, 42, "#0B1424"), lp(m, R(10, G - 38, 4, 4, "#37C5D6"), "opacity", 0.2, 1, 700), lp(m, R(18, G - 38, 4, 4, "#8FCB4F"), "opacity", 0.2, 1, 1100),
    R(10, G - 30, 18, 2, "#37C5D655"), lp(m, R(10, G - 22, 4, 4, "#F2A33A"), "opacity", 0.2, 1, 900), R(10, G - 14, 18, 2, "#37C5D655")],
  crates: () => [R(6, G - 14, 16, 14, "#8B6B45"), R(24, G - 10, 14, 10, "#9B7A52"), R(12, G - 28, 16, 14, "#A58559")],
};

export function decor(f, m) {
  const out = [];
  let slot = 0;
  for (const name of f.props ?? []) {
    if (name === "bunting") { out.push(...PROPS.bunting(m, f)); continue; }
    if (PROPS[name] && slot < SLOTS.length) out.push(...PROPS[name](m, f, SLOTS[slot++]));
  }
  out.push(...(FURNITURE[f.decor]?.(m, f) ?? []));
  return out;
}
