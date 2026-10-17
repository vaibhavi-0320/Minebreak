import { ethers } from 'ethers'
import { NETWORKS } from './networks'

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export interface WalletState {
  address: string | null
  chainId: number | null
  balance: string | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

export class WalletManager {
  private provider: ethers.BrowserProvider | null = null
  private signer: ethers.Signer | null = null

  hasInjected(): boolean {
    return typeof window !== 'undefined' && Boolean(window.ethereum)
  }

  getBrowserProvider(): ethers.BrowserProvider | null {
    if (!this.hasInjected()) return null
    if (!this.provider && window.ethereum) {
      this.provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
    }
    return this.provider
  }

  async getSigner(): Promise<ethers.Signer | null> {
    const prov = this.getBrowserProvider()
    if (!prov) return null
    try {
      this.signer = await prov.getSigner()
      return this.signer
    } catch {
      return null
    }
  }

  async connect(): Promise<{ address: string; chainId: number; balance: string }> {
    if (!this.hasInjected() || !window.ethereum) {
      throw new Error('No Web3 wallet detected. Please install MetaMask or another EVM wallet.')
    }

    const accounts = (await window.ethereum.request({
      method: 'eth_requestAccounts',
    })) as string[]

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts selected in wallet.')
    }

    const address = ethers.getAddress(accounts[0])
    const prov = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider)
    this.provider = prov
    this.signer = await prov.getSigner()

    const net = await prov.getNetwork()
    const chainId = Number(net.chainId)

    const rawBal = await prov.getBalance(address)
    const balance = ethers.formatEther(rawBal)

    return { address, chainId, balance }
  }

  async switchNetwork(targetChainId: number): Promise<void> {
    if (!window.ethereum) throw new Error('Wallet not available')
    const config = NETWORKS[targetChainId]
    if (!config) throw new Error(`Unsupported network chain ID: ${targetChainId}`)

    const hexChainId = config.chainIdHex

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      })
    } catch (err: unknown) {
      const error = err as { code?: number; message?: string }
      // 4902 indicates chain has not been added to MetaMask
      if (error.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: hexChainId,
              chainName: config.name,
              rpcUrls: [config.rpcUrl],
              nativeCurrency: {
                name: config.currencyName,
                symbol: config.currencySymbol,
                decimals: 18,
              },
              blockExplorerUrls: config.blockExplorerUrl ? [config.blockExplorerUrl] : undefined,
            },
          ],
        })
      } else {
        throw err
      }
    }
  }

  async refreshBalance(address: string): Promise<string> {
    const prov = this.getBrowserProvider()
    if (!prov) return '0.0'
    const bal = await prov.getBalance(address)
    return ethers.formatEther(bal)
  }
}

export const walletManager = new WalletManager()
