# Memory — Embervale

Durable cross-session notes. **Append** dated bullets when you learn something
non-obvious. Do not rewrite history; strike-through obsolete lines if needed.

Agents: read the latest entries before combat, collision, audio, or deploy work.

---

## 2026-07-09

- **Kinematic player ignores Rapier response.** Soft collision in
  `game/collision.ts` is required for prop blocking; fixed colliders alone are
  not enough for the player capsule.
- **Straight-line mob chase + resolve = stuck on trees.** Use `steerMob` in
  `game/navigation.ts` (heading search + tangent waypoints + stuck flip).
- **Never `setMobs` every frame.** Caused thrash / washed scene earlier; sync
  store on spawn/death/UI-relevant boss HP only. Live positions stay on
  `runtime.mobs`.
- **Invuln must merge sources.** `Math.max(store.player.invuln, runtime.playerInvuln)`
  — do not overwrite store i-frames with zero each tick.
- **Once-per-attack `hitDealt`** for player swings and mob melee; multi-tick
  contact melted the player (beetle −14 spam).
- **Mid-fight center modals banned.** Level-up / wave banners → edge/corner only.
- **WASD is camera-relative** (`getCameraRelativeMove` in `Player.tsx`).
- **Grass mipmaps off + nearest filter** — linear mips washed the voxel look.
- **ElevenLabs sound-generation min duration ≈ 0.5s.** Script:
  `tools/audio/generate-sfx.mjs`; key via `ELEVENLABS_API_KEY` (not in repo).
- **No ElevenLabs MCP** in the default tool set — use REST script offline.
- **SFX never from client API.** Commit MP3s under `public/audio/`.
- **Vercel project** `embervale` → prod alias `https://embervale-amber.vercel.app`.
- **Attribution** title, HUD, overlays, README, SEO JSON-LD → MINEBREAK / Built on Embervale.
- **Dev port 2035** `strictPort: true` — do not silently pick another port.

## Template for new entries

```md
## YYYY-MM-DD

- Short fact agents would otherwise re-discover the hard way.
```
