# Contributing — Embervale

Agent-facing setup and quality gates. Product overview lives in `README.md`.
Behavioral rules live in `AGENTS.md` / `CLAUDE.md` (same file).

## Prerequisites

- Node.js 20+ (22 recommended)
- npm (lockfile is `package-lock.json`)
- Optional: Blender 4.5.x on `PATH` for asset regen
- Optional: `ELEVENLABS_API_KEY` in the environment for SFX regen

## Setup

```bash
npm install
npm run dev        # http://localhost:2035  (strictPort)
```

Production:

```bash
npm run build
npm run preview    # also port 2035
```

## Quality gate (before commit / PR / “done”)

Run in order:

```bash
npm run typecheck  # required
npm run lint       # required if you touched TS/TSX
npm run build      # required for ship / deploy / PR targeting main
```

Manual smoke (2 minutes):

1. Title screen loads; credits show Built on Embervale (MIT License)
2. Enter grove — audio unlocks after first click
3. WASD is camera-relative; mouse aims; click/space attacks; shift dashes
4. Walking into a tree/rock stops the player
5. Mobs re-route around props (do not pin forever on a trunk)
6. Level-up is a corner chip, not a center modal
7. Death / victory overlays still center and restart cleanly

## Branching

- Default branch: `main`
- Feature branches: `feat/<short-topic>`, `fix/<short-topic>`, `chore/<short-topic>`
- Prefer PR → squash merge for anything non-trivial
- Do not force-push `main`

## Commit messages

Conventional Commits only. Examples:

```
feat(nav): flip detour side when mobs stay stuck
fix(combat): once-per-swing hit on beetle melee
docs(agents): record pond collision padding
chore: regenerate grove ambience sfx
```

No AI co-author trailers.

## Deploy

Project is linked to Vercel (`embervale` → https://embervale-amber.vercel.app).

```bash
npx vercel --prod --yes
```

Confirm with the owner before production deploys if the change is risky
(auth, billing, public messaging). Gameplay/content ship is expected.

## Assets & audio

| Task | Command | Notes |
|------|---------|--------|
| Blender GLBs | `npm run assets:generate` | Writes `public/assets/models/` |
| ElevenLabs SFX | `npm run sfx:generate` | Writes `public/audio/*.mp3` + manifest |

Do not call ElevenLabs from browser code. Commit generated audio when intentional.

## SEO / public HTML

`index.html` and `public/{robots.txt,sitemap.xml,og.png,llms.txt,site.webmanifest}`
are production SEO surface. Keep author attribution and canonical URL in sync
when renaming the deploy host.

## Agent docs

| Path | When to update |
|------|----------------|
| `AGENTS.md` | New hard rule or layer boundary |
| `docs/ARCHITECTURE.md` | Data-flow or hot-path change |
| `docs/DESIGN.md` | Feel / HUD / palette change |
| `docs/MEMORY.md` | Non-obvious bugfix or “gotcha” |
| `.agents/workflows/*` | Repeatable multi-step process change |
