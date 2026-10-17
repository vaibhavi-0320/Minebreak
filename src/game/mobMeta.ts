import type { MobKind } from './types'

export const MOB_NAMES: Record<MobKind, string> = {
  slime: 'Moss Slime',
  mushroom: 'Capling',
  imp: 'Cave Imp',
  beetle: 'Mine Beetle',
  boss: 'Vault Tyrant',
}

export const MOB_LABEL_HEIGHT: Record<MobKind, number> = {
  slime: 1.35,
  mushroom: 1.55,
  imp: 1.65,
  beetle: 1.2,
  boss: 3.15,
}

export const MOB_BAR_WIDTH: Record<MobKind, number> = {
  slime: 0.9,
  mushroom: 0.95,
  imp: 0.85,
  beetle: 1.0,
  boss: 2.2,
}
