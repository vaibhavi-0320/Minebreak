# Checklist — Gameplay smoke

Run against `npm run dev` (http://localhost:2035) or prod after deploy.

## Boot

- [ ] Canvas clears to sky/moss; no infinite loading
- [ ] Title: **Embervale** + controls + **Enter the Grove**
- [ ] Title attribution links to https://carlomigueldy.dev
- [ ] First click unlocks audio (no console spam)

## Locomotion

- [ ] WASD moves relative to camera
- [ ] Mouse aims character
- [ ] Shift dash with brief invuln + SFX
- [ ] Player **cannot** walk through trees / cottage / pond

## Combat

- [ ] Click / Space swings sword (whoosh SFX)
- [ ] Hits apply damage once per swing; hit SFX + spark VFX
- [ ] Combo chain on repeated clicks mid-window
- [ ] Player hurt: vignette + SFX + invuln blink (not stun-lock forever)

## Mobs

- [ ] Spawn with soft pop VFX
- [ ] Chase player; **route around** solid props (no infinite pin on trunk)
- [ ] Melee windup then single strike
- [ ] Imp / boss projectiles damage once on contact
- [ ] Nameplates show above living enemies

## Session / UI

- [ ] Wave + kills strip updates
- [ ] Level-up is **corner** chip (not center modal)
- [ ] Wave clear rest + optional Next wave
- [ ] Boss frame appears on Grove Tyrant
- [ ] In-HUD credit to carlomigueldy.dev remains

## End states

- [ ] Death overlay → Rise again / title
- [ ] Victory (wave 15 boss) → Play again / title
- [ ] Restarts reset HP/wave cleanly

## Console

- [ ] No red errors during a short fight
- [ ] No flood of React state update warnings
