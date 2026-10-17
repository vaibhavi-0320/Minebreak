/**
 * WebAudio manager for Embervale.
 * Loads ElevenLabs-generated SFX from /audio/manifest.json.
 * Unlocks on first user gesture (browser autoplay policy).
 */

export type SfxName =
  | 'ui-select'
  | 'footstep'
  | 'sword-swing'
  | 'sword-hit'
  | 'dash'
  | 'player-hurt'
  | 'mob-death'
  | 'boss-roar'
  | 'level-up'
  | 'wave-start'
  | 'heal'
  | 'victory'
  | 'defeat'
  | 'ambient-grove'

interface SoundDef {
  file: string
  loop: boolean
}

class AudioManager {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private ambientBus: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private manifest: Record<string, SoundDef> | null = null
  private ambientSource: AudioBufferSourceNode | null = null
  private ambientName: string | null = null
  private loading = new Set<string>()
  private unlocked = false
  private footstepCooldown = 0

  masterVolume = 0.85
  sfxVolume = 0.9
  ambientVolume = 0.35
  muted = false

  unlock() {
    if (this.unlocked && this.context) {
      void this.context.resume()
      return
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    this.context = new Ctor()
    this.master = this.context.createGain()
    this.master.connect(this.context.destination)
    this.sfxBus = this.context.createGain()
    this.sfxBus.connect(this.master)
    this.ambientBus = this.context.createGain()
    this.ambientBus.connect(this.master)
    this.applyVolumes()
    this.unlocked = true
    void this.loadManifest().then(() => {
      // Warm common one-shots
      for (const name of ['ui-select', 'sword-swing', 'sword-hit', 'dash', 'player-hurt'] as SfxName[]) {
        void this.buffer(name)
      }
    })
  }

  private applyVolumes() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.masterVolume
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume
    if (this.ambientBus) this.ambientBus.gain.value = this.ambientVolume
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.applyVolumes()
  }

  private async loadManifest() {
    try {
      const res = await fetch('/audio/manifest.json')
      this.manifest = (await res.json()) as Record<string, SoundDef>
    } catch {
      this.manifest = null
    }
  }

  private async buffer(name: string): Promise<AudioBuffer | null> {
    if (!this.context) return null
    const cached = this.buffers.get(name)
    if (cached) return cached
    if (this.loading.has(name)) return null
    const def = this.manifest?.[name]
    if (!def) return null
    this.loading.add(name)
    try {
      const res = await fetch(`/audio/${def.file}`)
      if (!res.ok) return null
      const decoded = await this.context.decodeAudioData(await res.arrayBuffer())
      this.buffers.set(name, decoded)
      return decoded
    } catch {
      return null
    } finally {
      this.loading.delete(name)
    }
  }

  /** Fire-and-forget one-shot. */
  play(name: SfxName | string, { volume = 1, rate = 1 }: { volume?: number; rate?: number } = {}) {
    if (!this.context || !this.sfxBus || this.muted) return
    void this.buffer(name).then((buf) => {
      if (!buf || !this.context || !this.sfxBus) return
      const source = this.context.createBufferSource()
      source.buffer = buf
      source.playbackRate.value = rate
      const gain = this.context.createGain()
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(this.sfxBus)
      source.start()
    })
  }

  /** Throttled footstep while moving. Call every frame with dt + speed. */
  tickFootstep(dt: number, speed: number) {
    this.footstepCooldown = Math.max(0, this.footstepCooldown - dt)
    if (speed < 2.5 || this.footstepCooldown > 0) return
    this.footstepCooldown = speed > 10 ? 0.18 : 0.32
    const rate = 0.9 + Math.random() * 0.25
    this.play('footstep', { volume: 0.35, rate })
  }

  ambient(name: SfxName | string | null) {
    if (this.ambientName === name) return
    this.ambientName = name

    if (this.ambientSource && this.context && this.ambientBus) {
      const old = this.ambientSource
      const fade = this.context.createGain()
      try {
        old.disconnect()
        old.connect(fade)
        fade.connect(this.ambientBus)
        fade.gain.setValueAtTime(1, this.context.currentTime)
        fade.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.7)
        window.setTimeout(() => {
          try {
            old.stop()
          } catch {
            /* already stopped */
          }
        }, 800)
      } catch {
        try {
          old.stop()
        } catch {
          /* ignore */
        }
      }
      this.ambientSource = null
    }

    if (!name) return
    void this.buffer(name).then((buf) => {
      if (!buf || !this.context || !this.ambientBus || this.ambientName !== name) return
      const source = this.context.createBufferSource()
      source.buffer = buf
      source.loop = true
      source.connect(this.ambientBus)
      source.start()
      this.ambientSource = source
    })
  }
}

export const audio = new AudioManager()

/** Wire unlock + ambient on first interaction; call once from App/HUD. */
export function installAudioUnlock() {
  const kick = () => {
    audio.unlock()
    audio.ambient('ambient-grove')
  }
  const once = () => {
    kick()
    window.removeEventListener('pointerdown', once)
    window.removeEventListener('keydown', once)
  }
  window.addEventListener('pointerdown', once, { passive: true })
  window.addEventListener('keydown', once)
}
