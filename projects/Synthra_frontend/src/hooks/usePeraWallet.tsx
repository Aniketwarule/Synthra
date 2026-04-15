import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import algosdk from 'algosdk'
import {
  WalletProvider,
  WalletManager,
  WalletId,
  type SignDataResponse,
  type SignMetadata,
  useWallet,
  type WalletKey,
  type SupportedWallet,
} from '@txnlab/use-wallet-react'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

export interface WalletOption {
  id: string
  walletKey: string
  name: string
  isConnected: boolean
  isActive: boolean
}

interface PeraWalletState {
  address: string | null
  balance: number
  balanceMicroAlgos: number
  isConnected: boolean
  isConnecting: boolean
  activeWalletId: string | null
  canSignData: boolean
  canUsePrivateKey: boolean
  connect: (walletKey?: string) => Promise<void>
  disconnect: () => void
  walletOptions: WalletOption[]
  activeWalletName: string | null
  signTransactions: <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[],
  ) => Promise<(Uint8Array | null)[]>
  signData: (data: string, metadata: SignMetadata) => Promise<SignDataResponse>
  withPrivateKey: <T>(callback: (secretKey: Uint8Array) => Promise<T>) => Promise<T>
  /** Get a configured Algodv2 client */
  getAlgodClient: () => algosdk.Algodv2
  /** Refresh balance from chain */
  refreshBalance: () => Promise<void>
}

// ─────────────────────────────────────────────────────
// Wallet manager setup
// ─────────────────────────────────────────────────────

function createWalletManager(): WalletManager {
  const cfg = getAlgodConfigFromViteEnvironment()
  const networkId = (import.meta.env.VITE_ALGOD_NETWORK || 'localnet').toLowerCase()

  const wallets: SupportedWallet[] = [
    WalletId.PERA,
    WalletId.DEFLY,
  ]

  return new WalletManager({
    defaultNetwork: networkId,
    wallets,
    options: {
      // Avoid stale persisted network IDs (e.g. localnet) from previous runs.
      resetNetwork: true,
    },
    networks: {
      [networkId]: {
        algod: {
          token: cfg.token as string,
          baseServer: cfg.server,
          port: cfg.port,
        },
      },
    },
  })
}

// ─────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────

const PeraCtx = createContext<PeraWalletState | null>(null)

// ─────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────

function PeraWalletStateProvider({ children }: { children: ReactNode }) {
  const { wallets, activeWallet, activeAddress, signTransactions, signData, withPrivateKey } = useWallet()
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [balanceMicroAlgos, setBalanceMicroAlgos] = useState(0)
  const [isConnecting, setIsConnecting] = useState(false)

  const getAlgodClient = useCallback(() => {
    const cfg = getAlgodConfigFromViteEnvironment()
    return new algosdk.Algodv2(cfg.token as string, cfg.server, cfg.port)
  }, [])

  const fetchBalance = useCallback(
    async (addr: string) => {
      try {
        const client = getAlgodClient()
        const info = await client.accountInformation(addr).do()
        const micro = Number(info.amount ?? info['amount'] ?? 0)
        setBalanceMicroAlgos(micro)
        setBalance(micro / 1_000_000)
      } catch (err) {
        console.warn('[WalletConnect] Balance fetch failed:', err)
      }
    },
    [getAlgodClient],
  )

  const walletOptions = useMemo<WalletOption[]>(
    () =>
      wallets.map((wallet) => ({
        id: wallet.id,
        walletKey: String(wallet.walletKey),
        name: wallet.metadata.name,
        isConnected: wallet.isConnected,
        isActive: wallet.isActive,
      })),
    [wallets],
  )

  const refreshBalance = useCallback(async () => {
    if (address) await fetchBalance(address)
  }, [address, fetchBalance])

  const handleDisconnect = useCallback(() => {
    setAddress(null)
    setBalance(0)
    setBalanceMicroAlgos(0)
  }, [])

  useEffect(() => {
    if (activeAddress) {
      setAddress(activeAddress)
      fetchBalance(activeAddress)
      return
    }
    handleDisconnect()
  }, [activeAddress, fetchBalance, handleDisconnect])

  const connect = useCallback(async (walletKey?: string) => {
    setIsConnecting(true)
    try {
      const target = walletKey
        ? wallets.find(
            (wallet) =>
              String(wallet.walletKey) === walletKey || wallet.id === walletKey,
          )
        : activeWallet || wallets[0]

      if (!target) {
        throw new Error('No wallet providers are available')
      }

      const accounts = await target.connect()

      if (!target.isActive) {
        target.setActive()
      }

      const selectedAddress = accounts[0]?.address || target.activeAccount?.address
      if (selectedAddress) {
        target.setActiveAccount(selectedAddress)
        setAddress(selectedAddress)
        fetchBalance(selectedAddress)
      }
    } catch (err) {
      if ((err as Error)?.message?.includes('cancelled')) {
        console.log('[WalletConnect] User cancelled connection')
      } else {
        console.error('[WalletConnect] Connection failed:', err)
      }
    } finally {
      setIsConnecting(false)
    }
  }, [activeWallet, fetchBalance, wallets])

  const disconnect = useCallback(() => {
    const disconnectAll = async () => {
      const connectedWallets = wallets.filter((wallet) => wallet.isConnected)
      if (connectedWallets.length === 0) {
        handleDisconnect()
        return
      }

      await Promise.allSettled(connectedWallets.map((wallet) => wallet.disconnect()))
      handleDisconnect()
    }

    void disconnectAll()
  }, [handleDisconnect, wallets])

  return (
    <PeraCtx.Provider
      value={{
        address,
        balance,
        balanceMicroAlgos,
        isConnected: !!address,
        isConnecting,
        activeWalletId: activeWallet?.id || null,
        canSignData: activeWallet?.canSignData ?? false,
        canUsePrivateKey: activeWallet?.canUsePrivateKey ?? false,
        connect,
        disconnect,
        walletOptions,
        activeWalletName: activeWallet?.metadata.name || null,
        signTransactions,
        signData,
        withPrivateKey,
        getAlgodClient,
        refreshBalance,
      }}
    >
      {children}
    </PeraCtx.Provider>
  )
}

export function PeraWalletProvider({ children }: { children: ReactNode }) {
  const manager = useMemo(() => createWalletManager(), [])

  return (
    <WalletProvider manager={manager}>
      <PeraWalletStateProvider>{children}</PeraWalletStateProvider>
    </WalletProvider>
  )
}

// ─────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────

export function usePeraWallet(): PeraWalletState {
  const ctx = useContext(PeraCtx)
  if (!ctx) {
    throw new Error('usePeraWallet must be used within <PeraWalletProvider>')
  }
  return ctx
}
