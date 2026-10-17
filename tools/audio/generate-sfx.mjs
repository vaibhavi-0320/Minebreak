#!/usr/bin/env node
/**
 * Generates Embervale SFX via ElevenLabs sound-generation API.
 * Requires ELEVENLABS_API_KEY in the environment.
 * Failed sounds fall back to a synthesized placeholder WAV.
 *
 * Usage:
 *   source ~/.zshrc && node tools/audio/generate-sfx.mjs
 *   node tools/audio/generate-sfx.mjs --only sword-swing
 *   node tools/audio/generate-sfx.mjs --stub-all
 */
import { mkdir, writeFile } from 'node:fs/promises'

const OUT_DIR = new URL('../../public/audio/', import.meta.url).pathname
const API = 'https://api.elevenlabs.io/v1/sound-generation'

/** name → { prompt, seconds, loop } — min duration_seconds is 0.5 */
const SOUNDS = {
  'ui-select': {
    prompt:
      'Soft warm wooden tap click for a cozy fantasy game menu, very short, clean, no reverb',
    seconds: 0.5,
  },
  footstep: {
    prompt:
      'Soft single footstep on grass and dirt, cozy fantasy game, short and subtle, no music',
    seconds: 0.5,
  },
  'sword-swing': {
    prompt:
      'Two-handed greatsword whoosh swing through air, fantasy game melee attack, short punchy whoosh, no metal clang',
    seconds: 0.7,
  },
  'sword-hit': {
    prompt:
      'Solid sword impact hit on soft creature, satisfying fantasy game hit, short thwack with light sparkle, no gore',
    seconds: 0.6,
  },
  dash: {
    prompt:
      'Quick airy dash whoosh with soft ember sparkle, cozy fantasy game dodge, short',
    seconds: 0.6,
  },
  'player-hurt': {
    prompt:
      'Soft muted player hurt thud with gentle low tone, cozy fantasy game damage feedback, short, not scary',
    seconds: 0.6,
  },
  'mob-death': {
    prompt:
      'Soft magical poof dissolve of a small creature, cozy fantasy game enemy defeat, short sparkle',
    seconds: 0.8,
  },
  'boss-roar': {
    prompt:
      'Deep distant creature growl roar, fantasy boss intro, short and dramatic but not too loud, no music',
    seconds: 1.4,
  },
  'level-up': {
    prompt:
      'Bright cheerful chime flourish with warm sparkles, cozy fantasy game level up reward, short',
    seconds: 1.2,
  },
  'wave-start': {
    prompt:
      'Soft horn-like wooden chime announcing a new wave, cozy fantasy game, short rising tone',
    seconds: 1.0,
  },
  heal: {
    prompt:
      'Gentle warm healing shimmer sparkle, cozy fantasy game heal, soft and pleasant, short',
    seconds: 0.8,
  },
  victory: {
    prompt:
      'Triumphant cozy fantasy jingle with warm bells and soft marimba, celebratory short victory fanfare',
    seconds: 2.8,
  },
  defeat: {
    prompt:
      'Soft low melancholy chime, gentle game over for a cozy fantasy game, short, not harsh',
    seconds: 1.6,
  },
  'ambient-grove': {
    prompt:
      'Peaceful forest meadow ambience, soft wind through leaves, distant birds, gentle nature, seamless loop, no music, no voices',
    seconds: 10,
    loop: true,
  },
}

const onlyIdx = process.argv.indexOf('--only')
const only = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null
const stubAll = process.argv.includes('--stub-all')
const apiKey = process.env.ELEVENLABS_API_KEY

function stubWav(name, seconds) {
  const rate = 22050
  const length = Math.min(Math.floor(rate * Math.max(seconds, 0.3)), rate * 10)
  const data = new Int16Array(length)
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  const freq = 180 + (hash % 420)
  const isLoop = seconds >= 8
  for (let i = 0; i < length; i++) {
    const t = i / rate
    const envelope = isLoop
      ? 0.35 + 0.15 * Math.sin(t * 0.7)
      : Math.exp(-t * (seconds > 2 ? 1.2 : 5))
    const noise = (Math.random() * 2 - 1) * (isLoop ? 0.15 : 0.05)
    data[i] = Math.round((Math.sin(2 * Math.PI * freq * t) * 0.7 + noise) * envelope * 5000)
  }
  const buffer = Buffer.alloc(44 + data.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + data.length * 2, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(data.length * 2, 40)
  Buffer.from(data.buffer).copy(buffer, 44)
  return buffer
}

await mkdir(OUT_DIR, { recursive: true })
const report = { generated: [], stubbed: [] }

for (const [name, spec] of Object.entries(SOUNDS)) {
  if (only && name !== only) continue
  let done = false
  if (apiKey && !stubAll) {
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: spec.prompt,
            duration_seconds: Math.max(0.5, spec.seconds),
            prompt_influence: 0.35,
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`)
        const audio = Buffer.from(await res.arrayBuffer())
        await writeFile(`${OUT_DIR}${name}.mp3`, audio)
        console.log(`generated ${name}.mp3 (${(audio.length / 1024).toFixed(0)} KB)`)
        report.generated.push(name)
        done = true
        // gentle rate limit for free tier
        await new Promise((r) => setTimeout(r, 900))
      } catch (error) {
        console.error(`  attempt ${attempt + 1} failed for ${name}: ${error.message}`)
        await new Promise((r) => setTimeout(r, 1800))
      }
    }
  }
  if (!done) {
    await writeFile(`${OUT_DIR}${name}.wav`, stubWav(name, spec.seconds))
    console.log(`stubbed ${name}.wav (placeholder)`)
    report.stubbed.push(name)
  }
}

await writeFile(
  `${OUT_DIR}manifest.json`,
  JSON.stringify(
    Object.fromEntries(
      Object.entries(SOUNDS).map(([name, spec]) => [
        name,
        {
          file: `${name}.${report.stubbed.includes(name) ? 'wav' : 'mp3'}`,
          loop: Boolean(spec.loop),
        },
      ]),
    ),
    null,
    2,
  ),
)

console.log(`\ndone: ${report.generated.length} generated, ${report.stubbed.length} stubbed`)
