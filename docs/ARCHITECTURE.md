# Architecture — Embervale

Binding technical map for agents. Prefer editing code in the layer that owns the concern.

## Stack snapshot

| Layer | Choice |
|-------|--------|
| UI shell | React 19 + Vite 8 |
| 3D | three.js via `@react-three/fiber` + `@react-three/drei` |
| Physics | `@react-three/rapier` (ground, walls, fixed prop colliders) |
| Soft collision | `src/game/collision.ts` (player/mobs vs props) |
| Mob pathing | `src/game/navigation.ts` (local steering + detours) |
| Game state | Zustand (`store.ts`) + mutable `runtime.ts` |
| Audio | Web Audio API (`src/audio/audio.ts`) |
| Assets | Procedural voxels + optional Blender GLBs |

## Runtime data flow

```
 input (keyboard/mouse)
        │
        ▼
  Player.tsx ──useFrame──► kinematic RB + combat + soft collision
        │                         │
        │                    runtime.playerPos / facing / invuln
        │                         │
        ▼                         ▼
  Mobs.tsx ──useFrame──► steerMob + AI + projectiles
        │                         │
        │                    runtime.mobs / projectiles / vfx
        │                         │
        ▼                         ▼
  store.ts  ◄── rare patches ──  damage, XP, wave, phase, HP UI
        │
        ▼
  HUD.tsx (React)  +  VFX.tsx (reads runtime.vfx)
```

### Rules of thumb

1. **Frame loop owns motion.** Position integration for player and mobs lives in
   `useFrame` handlers, not in Zustand setters.
2. **Runtime bags** avoid re-renders. `pushVfx`, mob HP during multi-hit, projectile
   lists mutate `runtime` then bump version counters when meshes need rebuild.
3. **Store is the session brain.** Phase machine: `title → playing → waveClear →
   bossIntro → playing → dead | victory`. Wave spawn, XP, heal, toasts live here.
4. **Audio is fire-and-forget.** Call `audio.play(name)` from combat/store/HUD;
   buffers lazy-load from `/audio/manifest.json`.

## Physics & collision

| Actor | Rapier body | Blocking |
|-------|-------------|---------|
| Ground / walls | fixed cuboids | Rapier |
| Props (tree, rock, …) | fixed cylinder/cuboid | Rapier + soft resolve |
| Player | kinematicPosition capsule | Soft resolve + mob separate |
| Mobs | none (visual groups) | Soft resolve + `steerMob` |

`getWorldSolids(seed)` builds circle footprints from `buildHandcraftedLayout`
plus pond + hedges. Keep prop solid radii in `collision.ts` in sync when adding
prop kinds.

**Player** (`Player.tsx`): desired step → resolve solids → separate vs mobs →
clamp arena → `setNextKinematicTranslation`.

**Mobs** (`Mobs.tsx`): if out of melee range → `steerMob(...)` → mob/player
separation → resolve solids → clamp. Melee / boss specials / imp projectiles
unchanged.

## Combat

- Attack defs: `animation/combatAttacks.ts` (duration, hitAt, chain window, arc).
- Player swing: edge-detect attack input → `startAttack` → once at `hitAt`
  run `performMeleeAttack` (arc + range vs `runtime.mobs`).
- Mob melee: windup timer + `hitDealt` in strike window.
- Invuln: max of store `player.invuln` and `runtime.playerInvuln` — never
  clobber store-granted i-frames with zero.

## Animation

Procedural rigs (not skinned clips):

- `meshes/riggedPlayer.tsx` / `riggedMobs.tsx` driven by `AnimDriver`
- Locomotion: `animation/locomotion.ts` + pose tables
- Death squash uses `deathPhase` on the driver while corpse remains briefly

## UI / HUD

- DOM overlay (`ui/HUD.tsx`) sits above the canvas; `pointer-events` only on
  interactive children.
- MMO layout: player frame left · session strip center · target/boss right.
- Title + death + victory include attribution to Built on Embervale (MIT License).

## SEO surface

Static SPA: Vite builds `index.html` with full meta + JSON-LD. `vercel.json`
SPA rewrites `/(.*) → /index.html` and sets security/cache headers. Crawl
assets under `public/` must remain at site root after deploy.

## Extension recipes

### New mob kind

1. Add to `MobKind` in `types.ts`
2. Stats in `store.ts` `MOB_TABLE`
3. Visual + radius in `riggedMobs.tsx` / nameplate meta
4. Optional AI branch in `Mobs.tsx`

### New solid prop

1. Build voxels + layout entry in `meshes/props.tsx`
2. Radius in `collision.ts` `PROP_RADIUS`
3. Rapier collider in `PropCollider`
4. Navigation automatically sees new solids via `getWorldSolids`

### New SFX

1. Add entry to `tools/audio/generate-sfx.mjs` `SOUNDS`
2. `npm run sfx:generate`
3. Call `audio.play('name')` from the event site
4. Extend `SfxName` union in `audio/audio.ts` if typed strictly

### New attack style

1. Define in `combatAttacks.ts`
2. Wire opener/combo tables
3. Ensure pose tables understand `attackId`
4. One hit window only

## Performance notes

- Prefer mutating `runtime.mobs[i].position` over cloning arrays each frame.
- Instanced voxels for props (`InstancedVoxels`).
- Canvas `dpr` capped `[1, 1.5]`; shadows on.
- Avoid per-frame `setState` on large mob lists.
