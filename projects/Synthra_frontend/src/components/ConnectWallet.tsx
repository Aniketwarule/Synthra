import { useWallet, Wallet, WalletId } from '@txnlab/use-wallet-react'
import { X, Wallet as WalletIcon, LogOut } from 'lucide-react'
import Account from './Account'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { wallets, activeAddress } = useWallet()

  const isKmd = (wallet: Wallet) => wallet.id === WalletId.KMD

  if (!openModal) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <div className="w-full max-w-md mx-4 border border-terminal-border bg-terminal-bg animate-fade-in">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <WalletIcon className="w-4 h-4 text-terminal-green" />
            <h3 className="font-mono text-sm text-terminal-text uppercase tracking-wider">
              {activeAddress ? 'Wallet Connected' : 'Select Provider'}
            </h3>
          </div>
          <button
            onClick={closeModal}
            className="p-1 text-terminal-dim hover:text-terminal-red transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="p-5 space-y-3">
          {activeAddress && (
            <>
              <Account />
              <div className="border-t border-terminal-border my-3" />
            </>
          )}

          {!activeAddress &&
            wallets?.map((wallet) => (
              <button
                key={`provider-${wallet.id}`}
                data-test-id={`${wallet.id}-connect`}
                className="w-full flex items-center gap-3 px-4 py-3 border border-terminal-border hover:border-terminal-green/50 hover:bg-terminal-green/5 transition-all duration-150 group"
                onClick={() => wallet.connect()}
              >
                {!isKmd(wallet) && (
                  <img
                    alt={`wallet_icon_${wallet.id}`}
                    src={wallet.metadata.icon}
                    className="w-6 h-6 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                )}
                <span className="font-mono text-sm text-terminal-muted group-hover:text-terminal-green transition-colors uppercase tracking-wider">
                  {isKmd(wallet) ? 'LocalNet Wallet' : wallet.metadata.name}
                </span>
              </button>
            ))}
        </div>

        {/* ─── Footer ─── */}
        {activeAddress && (
          <div className="px-5 pb-4">
            <button
              data-test-id="logout"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-terminal-red/30 text-terminal-red/70 hover:text-terminal-red hover:border-terminal-red/60 hover:bg-terminal-red/5 transition-all duration-150 font-mono text-xs uppercase tracking-wider"
              onClick={async () => {
                if (wallets) {
                  const activeWallet = wallets.find((w) => w.isActive)
                  if (activeWallet) {
                    await activeWallet.disconnect()
                  } else {
                    localStorage.removeItem('@txnlab/use-wallet:v3')
                    window.location.reload()
                  }
                }
                closeModal()
              }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectWallet
