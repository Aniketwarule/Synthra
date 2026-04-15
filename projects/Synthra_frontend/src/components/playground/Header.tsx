import { Link } from 'react-router-dom'
import { Zap, LogOut, Rocket, Key } from 'lucide-react'
import { usePeraWallet } from '../../hooks/usePeraWallet'
import { ellipseAddress } from '../../utils/ellipseAddress'
import WalletConnectOptions from '../WalletConnectOptions'

export default function Header() {
  const { address, balance, isConnected, disconnect } = usePeraWallet()

  const network = import.meta.env.VITE_ALGOD_NETWORK || 'localnet'

  return (
    <header className="glass-surface rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 z-50">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-terminal-green/10 border border-terminal-green/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-terminal-green" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-sans font-semibold text-sm sm:text-base tracking-wide text-white truncate">
              Synthra AI Gateway
            </h1>
            <p className="text-[10px] sm:text-[11px] text-gray-400 font-mono uppercase tracking-wider">
              {network}
            </p>
          </div>

          <div className="hidden md:flex items-center gap-1.5 ml-2">
            <Link
              to="/publish"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-terminal-green/40 hover:bg-terminal-green/10 text-[11px] font-mono transition-all"
            >
              <Rocket className="w-3 h-3" />
              Creator
            </Link>
            <Link
              to="/api-key"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-terminal-green/40 hover:bg-terminal-green/10 text-[11px] font-mono transition-all"
            >
              <Key className="w-3 h-3" />
              API Keys
            </Link>
          </div>
        </div>

        {/* Wallet area */}
        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <>
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/20 text-xs font-mono text-gray-300">
                <span className="text-terminal-green font-bold">{balance.toFixed(2)}</span>
                <span className="text-gray-500">ALGO</span>
              </div>

              <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-terminal-green/30 bg-terminal-green/10">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
                <span className="text-[11px] sm:text-xs font-mono text-terminal-green">
                  {ellipseAddress(address, 4)}
                </span>
              </div>

              <button
                onClick={disconnect}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-red-500/20 text-red-400/75 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/10 transition-all duration-150 text-[11px] font-mono uppercase tracking-wider"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </>
          ) : (
            <WalletConnectOptions
              className="wallet-options-row wallet-options-row-inline"
              buttonClassName="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border border-terminal-green/30 text-terminal-green hover:bg-terminal-green/10 hover:border-terminal-green disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 text-[11px] sm:text-xs font-mono uppercase tracking-wider"
            />
          )}
        </div>
      </div>
    </header>
  )
}
