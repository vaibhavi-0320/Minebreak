# Design — Embervale

Visual and feel contract. Agents changing UI, VFX, or combat juice must respect this.

## Fantasy

Warm meadow at golden hour. You are the **Hearthkeeper** protecting a shrine grove
from restless spirits. Cozy, not grimdark — soft death (“Fallen Softly”), friendly
UI panels, ember and moss palette.

## Palette

Source of truth:

- 3D: `src/game/constants.ts` → `COLORS`
- UI: `src/styles/index.css` → CSS variables (`--moss`, `--ember`, `--gold`, …)

Do not invent one-off hexes for core surfaces without updating those tokens.

### Mood

| Token | Role |
|-------|------|
| Moss / leaf | Ground, foliage, calm UI |
| Ember / gold | Player accent, attacks, rewards |
| Parchment cream | Panels |
| Boss purple-rose | Grove Tyrant only |

## 3D look

- Voxel / chunky forms; **flat shading**
- Grass: nearest filtering, no blurry mips
- Soft fog + warm sun (`Lighting.tsx`)
- Shadows on; avoid over-bloom
- Nameplates: Pixelify Sans (`/fonts/PixelifySans.ttf`)

## Camera

Angled top-down (not pure isometric, not third-person follow cam).

- Height / distance / FOV: `CAMERA` in constants
- Smooth lerp to player + look-ahead
- Movement is **camera-relative**

## HUD

Inspired by classic MMO unit frames, voxel-panel chrome:

- Player frame: portrait, name, level badge, HP + XP bars
- Target / boss frame opposite
- Session strip: wave + kills (top center, not inside player frame)
- Level-up: **corner chip**, short life
- Wave / boss banners: edge notify, not full-screen mid-fight
- Controls hint: bottom, low contrast
- Credit: discreet attribution on title and overlays

### Panel primitive

`.voxel-panel` — hard borders, pixel shadows, corner studs. Prefer reusing over
new card systems.

## Combat feel

- Combos: openers vary; chain clicks during window; finisher pops more VFX/SFX
- Dash: short, invuln, dust trail, whoosh SFX
- Hit: spark VFX + `sword-hit` SFX once per contact batch
- Hurt: red vignette, floating number, invuln blink, `player-hurt` SFX
- Death / victory: center card + dedicated sting; restart buttons play `ui-select`

## Audio mix

| Bus | Relative level (defaults) |
|-----|---------------------------|
| Master | ~0.85 |
| SFX | ~0.9 |
| Ambient grove | ~0.35 loop |

Footsteps throttled; never spam. Unlock only after first pointer/key.

## Copy voice

Short, warm, slightly playful:

- “Enter the Grove”
- “Breathing room…”
- “The Grove Tyrant awakens!”
- Avoid grim or edgy slogans

## Don’ts

- No glassmorphism / neon cyber HUD
- No center modal on level-up or wave clear
- No pure black void backgrounds for the world (use moss-deep radial)
- No wall-of-hashtags or spammy social meta in the game UI
- No removing author attribution
