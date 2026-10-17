# Workflow — SFX (ElevenLabs)

## When

Adding or regenerating sounds for combat, UI, ambience.

## Rules

- **Offline only** — `tools/audio/generate-sfx.mjs`
- Key: `ELEVENLABS_API_KEY` in environment (e.g. `~/.zshrc`) — never commit
- Min `duration_seconds` ≈ **0.5**
- Client loads files from `/audio/` via `src/audio/audio.ts`

## Add a sound

1. Append to `SOUNDS` in `tools/audio/generate-sfx.mjs`  
   `{ prompt, seconds, loop? }`
2. Generate:

   ```bash
   source ~/.zshrc   # if key lives there
   npm run sfx:generate
   # or one clip:
   node tools/audio/generate-sfx.mjs --only my-sound
   ```

3. Extend `SfxName` in `src/audio/audio.ts` if using the union
4. Call `audio.play('my-sound')` / `audio.ambient(...)` at the event
5. Commit `public/audio/my-sound.mp3` + updated `manifest.json`

## Fallback

Script stubs WAV if API fails — game still boots. Prefer real MP3s before ship.

## Mixing

Keep ambience quiet; one-shots short; throttle footsteps (`tickFootstep`).
