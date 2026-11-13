// What each floor looks like behind the workers: a handful of rectangles, one loop at most.
import { div } from "gpui-kit";

const r = (x, y, w, h, c) => div().absolute().left(x).top(y).w(w).h(h).bg(c);
const R = (right, y, w, h, c) => div().absolute().right(right).top(y).w(w).h(h).bg(c);
const lp = (m, el, prop, from, to, period) => (m.k ? el.loop(prop, { from, to, period: period * m.k }) : el);

export function decor(kind, f, m) {
  switch (kind) {
    case "bricks": {
      const out = [];
      for (let y = 8; y < 52; y += 10) out.push(r(0, y, 400, 1, "#00000040"));
      out.push(R(6, 40, 14, 6, "#B5533C"), R(10, 34, 14, 6, "#C8553D"), R(4, 46, 16, 6, "#A84832"));
      return out;
    }
    case "paint":
      return [r(0, 0, 90, 52, "#8B5CF633"), r(90, 0, 3, 52, "#8B5CF666"), R(8, 40, 10, 12, "#E5E7EB"), R(8, 40, 10, 3, f.paint)];
    case "furniture":
      return [R(8, 38, 34, 14, "#7A3F34"), R(8, 32, 34, 6, "#8E4A3D"), R(52, 14, 10, 2, "#00000040"), lp(m, R(54, 20, 8, 8, "#F2A33A"), "opacity", 0.35, 0.9, 1600), R(57, 28, 2, 24, "#6B4A3A")];
    case "circuit":
      return [R(6, 6, 30, 34, "#0B1424"), lp(m, R(10, 10, 4, 4, "#37C5D6"), "opacity", 0.2, 1, 700), lp(m, R(18, 14, 4, 4, "#8FCB4F"), "opacity", 0.2, 1, 1100), R(10, 22, 22, 2, "#37C5D655"), R(10, 28, 14, 2, "#37C5D655"), R(48, 14, 14, 18, "#37C5D622")];
    case "crates":
      return [R(6, 38, 16, 14, "#8B6B45"), R(24, 42, 14, 10, "#9B7A52"), R(12, 24, 16, 14, "#A58559")];
    default:
      return [];
  }
}
