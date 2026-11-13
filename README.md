# UCTalent workspace

A Herdr layout: the UCTalent logo and name on top, and under it a building where every coding agent is a pixel construction worker on the floor of the repo it works in.

![UCTalent workspace](preview.png)

## Workspaces and floors

The sidebar has one section per Herdr workspace, and every workspace always has a panel under its header. Tabs are not listed.

- **Every workspace** is one decorated room holding all its agents, from every tab, working or not (idle ones doze). More than fit in a row wrap onto more rooms below.
- **UCTalent** (workspace names containing `uctalent`, `splitSpaces`) is a building. The **HALL** on top holds the agents that have not coded yet (a new tab, a fresh session), from every tab. It is taller than a floor, with three rows of standing places one behind the other, so it holds a crowd; most idle agents in it stroll back and forth around their spot, the rest do their idle routine. Below it, one floor per repo used today: **FAST** (FastAPI), **FE**, **ATS**, **BE**. An agent stays on the floor where it last coded, done or idle, until it codes in another repo; after a reload it is put back there. When its repo can't be told (no folder or screen word names one) it stays where it is, so YARD, the catch-all of folder matching, is never drawn. A floor appears the first time an agent codes in that repo today, added below the floors already there, and stays until the day ends (kept in the mod's own storage, so a reload keeps it). Floors are joined by wooden ladders at their right end. An agent that starts coding walks along its floor to the ladder, climbs down through every floor in between, and walks to its place. It never jumps: moving from BE to ATS it walks there too. One agent is on one floor, the repo it is working in now.
- **Every other workspace** is one decorated room holding all its agents, working or not. More than fit in a row wrap onto more rooms below.

An agent's floor comes from its terminal's folder name (`match` patterns in `uc-workspace.json`). Agents started above the repos, e.g. in a parent folder that holds every repo, are placed by their screen instead: every few seconds, while they code, the mod reads the bottom of of their terminal with `hc read` and takes the floor named lowest in the last `screenLines` (40) lines: a `screen` word, or any folder-like word with a hyphen (`be-uc2402`, `ats-uc2919-qc/src`) that the floor's `match` patterns claim, so a new worktree needs no setup, so an old conversation higher up the screen doesn't count. If nothing matches the agent stays where it was, or goes to the Yard. Nothing is stored or sent anywhere. Click a workspace name to switch to it.

## Workers

Each agent has its own outfit: hat, shirt, stripes, trousers and a chest mark, and its shirt color glows under its feet. Claude: orange with a cream spark. Codex: indigo with a black helmet and visor. OpenCode: slate with an orange scarf. Antigravity/Gemini: blue with a yellow helmet and a rainbow belt. Cursor: black and white. Copilot: purple. Any other agent gets a full outfit of its own from its name.

| Agent state | What the worker does |
|---|---|
| working | depends on the floor, and sweats: **BE** hammers bricks onto a wall, sparks and dust; **FE** rolls paint up the wall in a colour of its own; **FAST** types at a holo screen of a neural net, bits scrolling; **ATS** stamps sheets coming out of a printer; **YARD** hauls a crate |
| working in a `*review*` / `*qc*` folder, or title says "review" | white helmet, clipboard and magnifier, head sweeps left and right |
| walking / on the ladder | walks with arms and legs swinging (carrying its tool on the way down); on the ladder, seen from behind, hand over hand |
| needs you | raises an arm and waves, red `!` blinks |
| needs you for over a minute | both arms up, red `!!` blinks faster |
| done | one of two: jumps with sparkles, or cheers under falling confetti |
| idle | one of four, fixed per agent: naps with a steaming coffee (`zzz`), reads the paper, scrolls the phone, stretches and yawns |
| out of tokens | slumps next to an empty bucket, hourglass (see below) |

Click a worker to focus its terminal. Hover for the agent, its state and how long it has been in it. No repo, branch or ticket names are shown anywhere in the building. The beacon on the roof turns red when anyone needs you.

"Out of tokens" is a guess from context use: it needs a terminal label `claude.context` (set by a Claude status line script) at or above `tokensOutAt` (95) while the agent is not working. Agents that don't report it never show this pose.

## Install

```sh
git clone https://github.com/trongkhoidev/uc-workspace
cp uc-workspace/layouts/uc-workspace.json ~/.config/herdr-app/layouts/
cp -R uc-workspace/mods/uc-brand uc-workspace/mods/uc-site ~/.config/herdr-app/mods/
herdr-app do layout.switch --name uc-workspace
```

`ctrl-shift-l` switches back to your previous layout.

## Customize

Click **customize** on the roof. It creates `~/.config/herdr-app/uc-workspace.json` with the defaults and opens it; edits apply within a few seconds.

- `motion`: `off`, `slow`, `normal`, `fast`
- `screenLines`: how much of the bottom of a coding agent's screen is read to find its repo
- `hall`: the look of the hall (`name`, `wall`, `floor`, `decor`, `props`, `sky`, `paint`)
- `splitSpaces[]`: workspace names (substring, any case) that are split into floors
- `spaces{}`: per workspace name, override its room: `roof`, `wall`, `floor`, `decor`, `props`, `tool`; `rooms[]` holds the default looks, picked by a hash of the name
- `floors[]`: `name`, `match` (folder-name patterns with `*`), `screen` (words that, seen on an agent's screen, put it on this floor), `tool`, `decor` (the floor's furniture: `bricks`, `paint`, `furniture`, `circuit`, `crates`, `none`), `props` (any of `window`, `lamp`, `plant`, `poster`, `clock`, `shelf`, `rug`, `bunting`), `sky` (window color), `wall`, `floor`, `paint` colors, and `background` (a color, or an image path relative to `~/.config/herdr-app`)
- `agents{}`: `shirt`, `hat`, `scarf`, `rainbow`, `visor`, or your own pictures: `image` for every state, `images: { working, idle, ... }` per state (GIF and animated WebP play by themselves)
- `review[]`: folder patterns that count as review
- `tokensOutAt`: context percent for the out-of-tokens pose

The first floor whose `match` fits the innermost folder name wins; the floor with `"*"` catches the rest. Floors you list in your own order are shown in that order.
