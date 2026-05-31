/**
 * Sui dAppKit singleton — SLUSH + all Wallet Standard wallets
 * Module-level singleton: safe because storage.ts falls back to
 * in-memory when localStorage is unavailable (SSR).
 */
import { createDAppKit } from '@mysten/dapp-kit-core'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'

type Network = 'mainnet' | 'testnet'

const NETWORKS: Network[] = ['mainnet', 'testnet']

function buildDAppKit() {
  return createDAppKit({
    networks:       NETWORKS,
    defaultNetwork: 'testnet',
    createClient:   (network: Network) => new SuiClient({ url: getFullnodeUrl(network) }),
    // SLUSH wallet is Sui's official wallet — this enables the web version
    slushWalletConfig: { appName: '流金理財' },
    autoConnect: true,
  })
}

export type DAppKitInstance = ReturnType<typeof buildDAppKit>

// Lazy singleton — only created on client
let _kit: DAppKitInstance | null = null

export function getDAppKit(): DAppKitInstance | null {
  if (typeof window === 'undefined') return null
  if (!_kit) _kit = buildDAppKit()
  return _kit
}
