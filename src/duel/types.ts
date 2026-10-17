export const Move = {
  NONE: 0,
  ATTACK: 1,
  SHIELD: 2,
  SCAN: 3,
} as const

export type Move = (typeof Move)[keyof typeof Move]

export const Phase = {
  WAITING: 0,
  COMMIT: 1,
  REVEAL: 2,
  FINISHED: 3,
} as const

export type Phase = (typeof Phase)[keyof typeof Phase]

export const MOVE_NAMES: Record<Move, string> = {
  [Move.NONE]: 'None',
  [Move.ATTACK]: 'ATTACK',
  [Move.SHIELD]: 'SHIELD',
  [Move.SCAN]: 'SCAN',
}

export const MOVE_DESCRIPTIONS: Record<Move, string> = {
  [Move.NONE]: 'No move selected',
  [Move.ATTACK]: 'Breaches Scan (Beats Scan)',
  [Move.SHIELD]: 'Absorbs Attack (Beats Attack)',
  [Move.SCAN]: 'Bypasses Shield (Beats Shield)',
}

export interface GameView {
  gameId: bigint
  infiltrator: string
  defender: string
  infiltratorScore: number
  defenderScore: number
  round: bigint
  phase: Phase
  winner: string
  deadline: bigint
  stake: bigint
}

export interface RoundStateView {
  infiltratorCommitted: boolean
  defenderCommitted: boolean
  infiltratorRevealed: boolean
  defenderRevealed: boolean
  lastInfiltratorMove: Move
  lastDefenderMove: Move
  lastResult: number // 0 none, 1 infiltrator won, 2 defender won, 3 draw
}

export interface StoredSalt {
  gameId: string
  round: string
  player: string
  move: number
  salt: string
  commitment: string
}
