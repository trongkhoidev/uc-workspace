// Defaults, and the person's overrides from ~/.config/herdr-app/uc-workspace.json.
// Floors are listed top to bottom and tried in that order; the last one catches everything else.

import { appHome, readTextFile, writeTextFile } from "herdr";

export const DEFAULTS = {
  motion: "normal", // off | slow | normal | fast
  // Workspaces (spaces) whose name contains one of these are split into floors by repo; every other workspace is one room.
  splitSpaces: ["uctalent"],
  // In a split workspace an agent stands on a floor only while it works, or for this many minutes after it finished or asked for you. Idle agents stay off the floors.
  activeMinutes: 10,
  screenLines: 40, // how much of the bottom of an agent's screen says which repo it is in
  // Rooms of the other workspaces: picked by a hash of the workspace name. Override one by name in `spaces`:
  //   "spaces": { "capstone1": { "roof": "#F2A33A", "wall": "#2D2433", "floor": "#4A3A55", "decor": "crates", "props": ["poster"], "tool": "box" } }
  rooms: [
    { roof: "#46A758", tool: "driver", decor: "furniture", props: ["window", "plant", "lamp"], wall: "#1F2F2A", floor: "#2F4A40", paint: "#46A758" },
    { roof: "#F2A33A", tool: "box", decor: "crates", props: ["bunting", "poster", "clock"], wall: "#2D2433", floor: "#4A3A55", paint: "#F2A33A" },
    { roof: "#37C5D6", tool: "solder", decor: "circuit", props: ["window", "shelf", "rug"], wall: "#1C2B3A", floor: "#2E4A66", paint: "#37C5D6", sky: "#10204A" },
    { roof: "#E5484D", tool: "hammer", decor: "bricks", props: ["lamp", "clock", "plant"], wall: "#33262A", floor: "#553B42", paint: "#E5484D" },
  ],
  spaces: {},
  floors: [
    { id: "ai", screen: ["uc-backend-fastapi"], name: "FastAPI", tool: "solder", decor: "circuit", props: ["window", "clock", "plant"], sky: "#10204A", wall: "#14233A", floor: "#1F3556", paint: "#37C5D6", match: ["*fastapi*", "ai-*", "*-ai", "*-ai-*", "*llm*"] },
    { id: "fe", screen: ["uc-frontend-nextjs", "frontend-nextjs", "fe-uc"], name: "Frontend", tool: "roller", decor: "paint", props: ["bunting", "poster", "plant"], wall: "#2A2147", floor: "#41337A", paint: "#8B5CF6", match: ["*frontend*", "*nextjs*", "fe-*", "*-fe", "*-fe-*"] },
    { id: "ats", screen: ["uc-ats-react", "ats-uc", "uc-ats"], name: "ATS", tool: "driver", decor: "furniture", props: ["window", "shelf", "lamp"], wall: "#3A2A24", floor: "#5A4034", paint: "#F2A33A", match: ["ats", "ats-*", "*-ats", "*-ats-*"] },
    { id: "be", screen: ["uc-talent-backend", "be-uc", "backend-uc"], name: "Backend", tool: "hammer", decor: "bricks", props: ["lamp", "clock", "poster"], wall: "#3B2523", floor: "#5C3A36", paint: "#C8553D", match: ["*backend*", "be-*", "*-be", "*-be-*", "*-api", "*-api-*"] },
    { id: "yard", name: "Yard", tool: "box", decor: "crates", props: ["lamp", "plant", "rug"], wall: "#23262F", floor: "#363B49", paint: "#9AA0B5", match: ["*"] },
  ],
  // Per agent (matched by program key): colors, extras, or your own pictures.
  //   { shirt, hat, scarf, rainbow, visor, image: "pictures/x.gif", images: { working: "...", idle: "..." } }
  agents: {
    claude: { shirt: "#D97757" },
    codex: { shirt: "#5B6CF0", visor: true },
    opencode: { shirt: "#2F3B4C", scarf: "#F2A33A" },
    antigravity: { shirt: "#3186FF", rainbow: true },
    gemini: { shirt: "#3186FF", rainbow: true },
    cursor: { shirt: "#3A3A3A", scarf: "#F4F4F5" },
    copilot: { shirt: "#8957E5" },
    amp: { shirt: "#F34E3F" },
    kimi: { shirt: "#2D7FF9" },
    grok: { shirt: "#555555" },
  },
  review: ["*review*", "qc", "*-qc", "*-qc-*"], // folders whose agents wear the white helmet and carry the clipboard
  tokensOutAt: 95, // % of context used (Claude's status line label) that sends a worker to sit down
};

export const path = () => `${appHome()}/uc-workspace.json`;

const merge = (a, b) => {
  const out = { ...a, ...b };
  out.agents = { ...a.agents, ...(b?.agents ?? {}) };
  out.spaces = { ...a.spaces, ...(b?.spaces ?? {}) };
  if (b?.floors) {
    const byId = new Map(b.floors.map((f) => [f.id, f]));
    const known = a.floors.map((f) => ({ ...f, ...(byId.get(f.id) ?? {}) }));
    out.floors = [...b.floors.filter((f) => !a.floors.some((d) => d.id === f.id)).map((f) => ({ tool: "hammer", decor: "none", wall: "#23262F", floor: "#363B49", paint: "#9AA0B5", match: [], ...f })), ...known];
    // Keep the person's order when they list every floor.
    if (b.floors.every((f) => out.floors.some((o) => o.id === f.id))) out.floors = b.floors.map((f) => out.floors.find((o) => o.id === f.id));
  }
  return out;
};

// Returns [config, error]. A bad file keeps the defaults and says why.
export async function load() {
  const text = await readTextFile(path()).catch(() => null);
  if (!text) return [DEFAULTS, null];
  try { return [merge(DEFAULTS, JSON.parse(text)), null]; } catch (e) { return [DEFAULTS, String(e.message ?? e)]; }
}

// Makes the file (once) with the defaults so there is something to edit.
export async function ensureFile() {
  const body = JSON.stringify({ motion: DEFAULTS.motion, splitSpaces: DEFAULTS.splitSpaces, activeMinutes: DEFAULTS.activeMinutes, screenLines: DEFAULTS.screenLines, spaces: DEFAULTS.spaces, floors: DEFAULTS.floors, agents: DEFAULTS.agents, review: DEFAULTS.review, tokensOutAt: DEFAULTS.tokensOutAt }, null, 2);
  await writeTextFile(path(), body, null).catch(() => {});
}

const rx = (p) => new RegExp(`^${p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "i");
const hit = (patterns, seg) => (patterns ?? []).some((p) => rx(p).test(seg));

// The folder name that decides: the innermost segment any floor claims, "*" aside. Null when none does.
export function matchFloor(cfg, cwd) {
  const segs = String(cwd ?? "").split("/").filter(Boolean).reverse();
  for (const seg of segs) for (const f of cfg.floors) if (!f.match?.includes("*") && hit(f.match, seg)) return f;
  return null;
}
export const fallbackFloor = (cfg) => cfg.floors.find((f) => f.match?.includes("*")) ?? cfg.floors[cfg.floors.length - 1];

// For agents started above the repos: the floor whose `screen` words appear lowest on the terminal's screen.
export function screenFloor(cfg, text) {
  const lines = String(text ?? "").split("\n").reverse();
  const rxs = cfg.floors.map((f) => [f, (f.screen ?? []).map((w) => new RegExp(w.replace(/[.+?^${}()|[\]\\]/g, "\\$&"), "i"))]);
  for (const line of lines) for (const [f, list] of rxs) if (list.some((r) => r.test(line))) return f;
  return null;
}

export const isReview = (cfg, cwd, title) =>
  /review/i.test(title ?? "") || String(cwd ?? "").split("/").filter(Boolean).slice(-2).some((s) => hit(cfg.review, s));

// An agent's look: the configured one, else a stable color from its name.
export function looks(cfg, key) {
  const k = String(key ?? "").toLowerCase();
  const name = Object.keys(cfg.agents).find((n) => k.includes(n)) ?? (k.includes("agy") ? "antigravity" : null);
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 360;
  const hsl = (h, s, l) => {
    const f = (n) => { const a = s * Math.min(l, 1 - l); const q = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(q - 3, 9 - q, 1)))); };
    return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  return { shirt: name ? undefined : hsl(h, 0.55, 0.5), hat: "#F2C94C", ...(name ? cfg.agents[name] : {}) };
}
