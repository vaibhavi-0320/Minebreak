/**
 * Network configurations for MINEBREAK duel mode.
 * Ethereum Sepolia (11155111) and Hardhat Local (31337).
 */

export interface NetworkConfig {
  chainId: number
  chainIdHex: string
  name: string
  rpcUrl: string
  currencySymbol: string
  currencyName: string
  blockExplorerUrl: string | null
  isTestnet: boolean
}

export const NETWORKS: Record<number, NetworkConfig> = {
  31337: {
    chainId: 31337,
    chainIdHex: '0x7A69',
    name: 'Hardhat Local',
    rpcUrl: 'http://127.0.0.1:8545',
    currencySymbol: 'ETH',
    currencyName: 'Ether',
    blockExplorerUrl: null,
    isTestnet: true,
  },
  11155111: {
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    name: 'Ethereum Sepolia',
    rpcUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SEPOLIA_RPC_URL) || 'https://ethereum-sepolia-rpc.publicnode.com',
    currencySymbol: 'ETH',
    currencyName: 'Sepolia Ether',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
    isTestnet: true,
  },
}

export const SUPPORTED_CHAIN_IDS = Object.keys(NETWORKS).map(Number)

/** Stake tiers in ETH: Free, 0.0005 ETH, 0.001 ETH */
export const STAKE_OPTIONS = [0, 0.0005, 0.001]

/**
 * Default chain: use VITE_DEFAULT_CHAIN_ID env override,
 * otherwise Sepolia in production, local in dev.
 */
export function getDefaultChainId(): number {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const env = import.meta.env.VITE_DEFAULT_CHAIN_ID
    if (env) return Number(env)
    return import.meta.env.PROD ? 11155111 : 31337
  }
  return 31337
}

export function getNetwork(chainId: number): NetworkConfig | undefined {
  return NETWORKS[chainId]
}

export function isSupportedChain(chainId: number): boolean {
  return Boolean(NETWORKS[chainId])
}

export function txUrl(chainId: number, hash: string): string | null {
  const net = NETWORKS[chainId]
  if (!net?.blockExplorerUrl) return null
  return `${net.blockExplorerUrl}/tx/${hash}`
}

export function addressUrl(chainId: number, addr: string): string | null {
  const net = NETWORKS[chainId]
  if (!net?.blockExplorerUrl) return null
  return `${net.blockExplorerUrl}/address/${addr}`
}
