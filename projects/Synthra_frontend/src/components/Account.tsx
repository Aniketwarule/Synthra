import { useWallet } from '@txnlab/use-wallet-react'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { ellipseAddress } from '../utils/ellipseAddress'

export default function Account() {
  const { activeAddress } = useWallet()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (activeAddress) {
      await navigator.clipboard.writeText(activeAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!activeAddress) return null

  return (
    <div className="flex items-center justify-between p-3 border border-terminal-green/15 bg-terminal-green/5">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono text-terminal-dim uppercase tracking-wider">
          Connected Address
        </span>
        <span className="text-sm font-mono text-terminal-green">
          {ellipseAddress(activeAddress, 6)}
        </span>
      </div>
      <button
        onClick={handleCopy}
        className="p-2 text-terminal-dim hover:text-terminal-green transition-colors"
        title="Copy address"
      >
        {copied ? (
          <Check className="w-4 h-4 text-terminal-green" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}
