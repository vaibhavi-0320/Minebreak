# CLAUDE.md / AGENTS.md — Embervale

The **single canonical instruction file** for every agent and contributor in this
repo. `CLAUDE.md` and `AGENTS.md` are the **same file** (one symlinks the other)
so every runtime reads identical rules — they can never drift.

Read this before coding. Companion docs — open as needed, do not duplicate:

| Doc | Purpose |
|-----|---------|
| `CONTRIBUTING.md` | Setup, commands, quality gates |
| `docs/ARCHITECTURE.md` | Layers, data flow, hot paths |
| `docs/DESIGN.md` | Aesthetic, HUD, combat feel |
| `docs/MEMORY.md` | Durable cross-session learnings |
| `.agents/workflows/*` | Feature / ship / assets / SFX playbooks |
| `.agents/checklists/*` | PR + gameplay smoke lists |
| `README.md` | Product overview for humans |

## Scope

These instructions apply to the entire repository. Subdirectories may add
narrower context; they never override hard rules below.

---

## What this is

**Embervale** — cozy angled top-down voxel PvE browser game.

- Player: **Hearthkeeper** with two-handed sword combos
- Waves of spirits → boss every 5 waves (**Grove Tyrant**) → win at wave 15
- Stack: React 19 · Vite 8 · R3F · Rapier · Zustand · Web Audio · Blender bpy
- Live: https://embervale-amber.vercel.app
- Author: [Vaibhavi](https://github.com/vaibhavi-0320/Minebreak)

Dev server is always **port 2035** (`npm run dev`).

---

## Hard rules (non-negotiable)

1. **No AI/LLM attribution — anywhere.** Never attribute code, docs, commits,
   trailers, co-authors, issues, or PRs to an AI tool. No `Co-authored-by` AI
   trailers. Use the configured human git identity / authenticated `gh` account.
   If none is configured, **stop and surface to the owner**.

2. **Conventional Commits — always.** Commit messages and PR titles use:
   `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `build`,
   `revert` (optional scope, e.g. `feat(combat): chain window tweak`).

3. **Runtime vs store split.**
   - `src/game/runtime.ts` — high-frequency mutable bags (mob positions,
     projectiles, VFX, player pos/facing). Updated every frame **without** React.
   - `src/game/store.ts` (Zustand) — UI-visible phase, HP bars, wave, toasts,
     level-up chips. Patch only when the player would notice.
   - **Never** call `setMobs` / full store writes every frame. Sync store on
     spawn, death, boss HP UI, wave transitions.

4. **Kinematic player + soft collision.** Player is Rapier
   `kinematicPosition`. World blocking uses software resolution in
   `src/game/collision.ts` (+ fixed prop colliders). Do not switch the player
   to dynamic without a full physics redesign.

5. **Mob chase is steered.** Mobs path with `src/game/navigation.ts`
   (`steerMob`) — they re-route around props. Do not revert to
   pure “walk straight at player + resolve” (that pins them on trees).

6. **Once-per-swing damage.** Player and mob melee use a `hitDealt` (or
   equivalent) flag per attack animation. Never multi-tick contact damage
   without intentional design + invuln.

7. **No mid-fight center modals.** Level-up, wave clear, and banners stay at
   edges/corners. Only death and victory may use full center overlays.

8. **Camera-relative movement.** WASD is relative to camera forward/right on
   XZ, not world axes. Keep that contract.

9. **Cozy voxel palette.** Scene colors come from `src/game/constants.ts`
   (`COLORS`) and CSS tokens in `src/styles/index.css`. Flat shading on
   voxel meshes. Nearest-filter grass. No washed PBR defaults.

10. **Audio unlock on gesture.** Never autoplay SFX before user interaction.
    Use `src/audio/audio.ts` (`audio.unlock()`, `audio.play()`, `audio.ambient()`).
    New sounds: generate offline via `npm run sfx:generate` into `public/audio/`
    — **no** runtime ElevenLabs API calls from the client.

11. **Attribution stays.** Retain open source licenses and credit (Built on Embervale).

12. **Secrets stay out of git.** `ELEVENLABS_API_KEY` and other keys live in
    shell env / gitignored `.env.local`. Never commit keys or paste them into
    source.

13. **Quality gate before “done”.** `npm run typecheck` must pass. Prefer
    `npm run build` for ship/PR. Fix errors; do not leave broken types.

14. **Minimal diffs.** Change only what the task needs. No drive-by refactors,
    no new deps without a clear need, no unsolicited markdown unless asked
    (except updating this harness / MEMORY when you learn something durable).

---

## Where code lives

```
src/
  animation/     combat attacks, poses, locomotion drivers
  audio/         WebAudio manager (loads public/audio)
  components/    R3F scene: Player, Mobs, Terrain, VFX, Camera, Lighting
  game/          store, runtime, constants, types, collision, navigation
  meshes/        voxel props, rigged player/mobs
  ui/            DOM HUD (unit frames, title, overlays)
  styles/        voxel / MMO HUD design system
tools/
  audio/         ElevenLabs SFX generation script
  blender/       bpy procedural GLB generators
public/
  audio/         committed SFX + manifest.json
  assets/models/ Blender GLBs
  fonts/         Pixelify Sans (3D nameplates)
docs/            architecture, design, memory
.agents/         workflows + checklists for agents
```

**Import alias:** `@/` → `src/` (Vite). Prefer relative imports within a folder
when short; `@/` is fine for deeper reaches.

---

## Hot paths (read before editing)

| Concern | Primary files |
|---------|----------------|
| Player move / combat | `components/Player.tsx`, `animation/combatAttacks.ts` |
| Mob AI / attacks | `components/Mobs.tsx`, `game/navigation.ts` |
| Collision solids | `game/collision.ts`, `meshes/props.ts` layout |
| Waves / XP / death | `game/store.ts` |
| Per-frame bags | `game/runtime.ts` |
| HUD / title | `ui/HUD.tsx`, `styles/index.css` |
| SFX | `audio/audio.ts`, `public/audio/manifest.json` |
| Camera | `components/CameraRig.tsx`, `constants.CAMERA` |
| SEO | `index.html`, `public/robots.txt`, `sitemap.xml`, `og.png` |

---

## Agent workflow (default)

1. **Orient** — read this file + relevant section of `docs/ARCHITECTURE.md`.
2. **Plan** — for multi-file or ambiguous work, state approach briefly before coding.
3. **Implement** — follow hard rules; keep store patches rare; reuse collision/nav/audio APIs.
4. **Verify** — `npm run typecheck` (and `build` if shipping). Manual smoke:
   title → enter grove → move/attack/dash → hit a tree (player blocks) → mob
   routes around props → no center modal on level-up.
5. **Record** — if you learned a durable constraint, append one bullet to
   `docs/MEMORY.md` (dated).
6. **Ship** — see `.agents/workflows/ship.md` (Vercel prod already linked).

### Delegation

- Explore / search: prefer a fast explore agent for “where is X?”
- Multi-step independent tasks: parallel subagents OK; they inherit this file.
- Do **not** spawn nested fleets for tiny one-file fixes.

---

## Commands (cheat sheet)

```bash
npm install
npm run dev          # http://localhost:2035
npm run typecheck
npm run lint
npm run build
npm run preview
npm run assets:generate   # needs Blender on PATH
npm run sfx:generate      # needs ELEVENLABS_API_KEY
```

---

## Product invariants (game feel)

- Short satisfying runs; combos feel weighty; dash has i-frames.
- Nameplates + MMO unit frames; Pixelify Sans for 3D text.
- Hurt: vignette + SFX + invuln blink — not endless stun.
- Mobs: soft separation from each other and the player; steered chase.
- Props: trees/rocks/cottage/shrine/lanterns/fences/mushrooms/pond/hedges solid;
  flowers non-solid.

---

## Nested context

If a subdirectory gains its own `AGENTS.md`, it **adds** local detail only.
Root hard rules always win on conflict.

---

## Ownership

Product owner / author: **Vaibhavi** — https://github.com/vaibhavi-0320/Minebreak
