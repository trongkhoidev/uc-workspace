// Defaults, and the person's overrides from ~/.config/herdr-app/uc-workspace.json.
// Floors are listed top to bottom and tried in that order; the last one catches everything else.

import { appHome, readTextFile, writeTextFile } from "herdr";

export const DEFAULTS = {
  motion: "normal", // off | slow | normal | fast
  // Workspaces (spaces) whose name contains one of these are split into floors by repo; every other workspace is one room.
  splitSpaces: ["uctalent"],
  // In a split workspace every agent not coding waits in the hall; a coding agent walks down to its repo's floor.
  hall: { name: "HALL", decor: "furniture", props: ["plant", "rug"], sky: "#10204A", wall: "#1E2433", floor: "#2E3650", paint: "#9AA0B5", tool: "box" },
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
    { id: "ai", screen: ["uc-backend-fastapi"], name: "FAST", tool: "laptop", decor: "circuit", props: ["window", "clock", "plant"], sky: "#0B2030", wall: "#0E2A33", floor: "#174552", paint: "#22D3EE", match: ["*fastapi*", "ai-*", "*-ai", "*-ai-*", "*llm*"] },
    { id: "fe", screen: ["uc-frontend-nextjs", "frontend-nextjs", "fe-uc"], name: "FE", tool: "roller", decor: "paint", props: ["bunting", "poster", "plant"], wall: "#2B1F44", floor: "#4A3577", paint: "#C084FC", match: ["*frontend*", "*nextjs*", "fe-*", "*-fe", "*-fe-*"] },
    { id: "ats", screen: ["uc-ats-react", "ats-uc", "uc-ats"], name: "ATS", tool: "stamp", decor: "furniture", props: ["window", "shelf", "lamp"], wall: "#33291A", floor: "#5A4528", paint: "#F5B83D", match: ["ats", "ats-*", "*-ats", "*-ats-*"] },
    { id: "be", screen: ["uc-talent-backend", "be-uc", "backend-uc"], name: "BE", tool: "hammer", decor: "bricks", props: ["lamp", "clock", "poster"], wall: "#3B2120", floor: "#5E3430", paint: "#F0614A", match: ["*backend*", "be-*", "*-be", "*-be-*", "*-api", "*-api-*"] },
    { id: "yard", name: "YARD", tool: "box", decor: "crates", props: ["lamp", "plant", "rug"], wall: "#23262F", floor: "#363B49", paint: "#9AA0B5", match: ["*"] },
  ],
  // Per agent (matched by program key): colors, extras, or your own pictures.
  //   { shirt, hat, scarf, rainbow, visor, image: "pictures/x.gif", images: { working: "...", idle: "..." } }
  // Each agent has its own hat, shirt, stripes (accent), trousers and chest mark, and its shirt color glows under its feet.
  agents: {
    claude: { hat: "#F0A27E", shirt: "#D97757", accent: "#FBEBDD", pants: "#6B3A2A", mark: "spark" },
    codex: { hat: "#0F172A", shirt: "#4F5BD5", accent: "#C7D2FE", pants: "#1E2340", visor: true, mark: "dot" },
    opencode: { hat: "#F4F4F5", shirt: "#2F3B4C", accent: "#F2A33A", pants: "#14191F", scarf: "#F2A33A", mark: "bars" },
    antigravity: { hat: "#FBBC04", shirt: "#3186FF", accent: "#FFFFFF", pants: "#1A3A73", rainbow: true },
    gemini: { hat: "#FBBC04", shirt: "#3186FF", accent: "#FFFFFF", pants: "#1A3A73", rainbow: true },
    cursor: { hat: "#F4F4F5", shirt: "#1F1F1F", accent: "#F4F4F5", pants: "#0A0A0A", scarf: "#F4F4F5", mark: "dot" },
    copilot: { hat: "#C8A6FF", shirt: "#8957E5", accent: "#24292F", pants: "#24292F", mark: "bars" },
    amp: { hat: "#FFD1CC", shirt: "#F34E3F", accent: "#FFFFFF", pants: "#5A1A14" },
    kimi: { hat: "#A9CBFF", shirt: "#2D7FF9", accent: "#0B1A33", pants: "#0B1A33", mark: "dot" },
    grok: { hat: "#E5E7EB", shirt: "#3F3F46", accent: "#E5E7EB", pants: "#18181B", mark: "bars" },
  },
  review: ["*review*", "qc", "*-qc", "*-qc-*"], // folders whose agents wear the white helmet and carry the clipboard
  tokensOutAt: 95, // % of context used (Claude's status line label) that sends a worker to sit down
};

export const path = () => `${appHome()}/uc-workspace.json`;

const merge = (a, b) => {
  const out = { ...a, ...b };
  out.agents = { ...a.agents };
  for (const [k, v] of Object.entries(b?.agents ?? {})) out.agents[k] = { ...(a.agents[k] ?? {}), ...v };
  out.spaces = { ...a.spaces, ...(b?.spaces ?? {}) };
  out.hall = { ...a.hall, ...(b?.hall ?? {}) };
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
  const body = JSON.stringify({ motion: DEFAULTS.motion, splitSpaces: DEFAULTS.splitSpaces, hall: DEFAULTS.hall, screenLines: DEFAULTS.screenLines, spaces: DEFAULTS.spaces, floors: DEFAULTS.floors, agents: DEFAULTS.agents, review: DEFAULTS.review, tokensOutAt: DEFAULTS.tokensOutAt }, null, 2);
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

// For agents started above the repos: the floor named lowest on the terminal's screen. A line counts when it has one of the
// floor's `screen` words or a folder-like word ("be-uc2402", "ats-uc2919-qc/src") that the floor's `match` patterns claim,
// so a new worktree is placed without any setup. Plain prose ("the backend") has no hyphen and never counts.
export function screenFloor(cfg, text) {
  const lines = String(text ?? "").split("\n").reverse();
  const rxs = cfg.floors.map((f) => [f, (f.screen ?? []).map((w) => new RegExp(w.replace(/[.+?^${}()|[\]\\]/g, "\\$&"), "i"))]);
  for (const line of lines) {
    for (const [f, list] of rxs) if (list.some((r) => r.test(line))) return f;
    for (const seg of line.split(/[\s/"'`()[\]{}<>,:;=]+/)) {
      if (!seg.includes("-")) continue;
      const f = cfg.floors.find((x) => !x.match?.includes("*") && hit(x.match, seg));
      if (f) return f;
    }
  }
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
  // Unknown agents still get a full outfit of their own from the hash of their name.
  return name ? { hat: "#F2C94C", ...cfg.agents[name] } : { shirt: hsl(h, 0.6, 0.5), hat: hsl(h, 0.7, 0.75), accent: hsl((h + 180) % 360, 0.6, 0.8), pants: hsl(h, 0.35, 0.22) };
}
