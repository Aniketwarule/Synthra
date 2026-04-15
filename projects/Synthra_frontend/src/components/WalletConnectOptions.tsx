import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Wallet } from 'lucide-react'
import { usePeraWallet } from '../hooks/usePeraWallet'

interface WalletConnectOptionsProps {
  className?: string
  buttonClassName?: string
  showUnavailableHint?: boolean
}

export default function WalletConnectOptions({
  className,
  buttonClassName,
  showUnavailableHint = false,
}: WalletConnectOptionsProps) {
  const { walletOptions, connect, isConnecting } = usePeraWallet()
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const visibleWallets = useMemo(() => {
    const allowed = new Set(['pera', 'defly'])
    const preferredOrder = ['pera', 'defly']

    const filtered = walletOptions.filter((wallet) => allowed.has(wallet.id))
    return filtered.sort(
      (a, b) => preferredOrder.indexOf(a.id) - preferredOrder.indexOf(b.id),
    )
  }, [walletOptions])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  if (visibleWallets.length === 0) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={isConnecting}
          className={buttonClassName}
        >
          {isConnecting ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />}
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={`${className || ''} wallet-connect-wrap`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isConnecting}
        className={buttonClassName}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isConnecting ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />}
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        <ChevronDown size={15} className={`wallet-caret ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && !isConnecting && (
        <div className="wallet-options-menu" role="menu" aria-label="Wallet options">
          {visibleWallets.map((wallet) => (
            <button
              key={wallet.walletKey}
              type="button"
              onClick={() => {
                setIsOpen(false)
                void connect(wallet.walletKey)
              }}
              className="wallet-option-btn"
              role="menuitem"
              title={`Connect with ${wallet.name}`}
            >
              {wallet.name}
            </button>
          ))}
        </div>
      )}

      {showUnavailableHint && (
        <p className="wallet-options-hint">
          Choose Pera or Defly.
        </p>
      )}
    </div>
  )
}
