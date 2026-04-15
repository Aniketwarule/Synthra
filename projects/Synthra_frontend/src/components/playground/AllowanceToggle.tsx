import { useState, useCallback } from 'react'
import { Shield, ShieldCheck } from 'lucide-react'
import type { AllowanceState } from '../../types/l402'

export default function AllowanceToggle() {
  const [allowance, setAllowance] = useState<AllowanceState>({
    enabled: false,
    remainingMicroAlgos: 10_000_000, // 10 ALGO
    totalMicroAlgos: 10_000_000,
    logicSigAddress: null,
  })

  const handleToggle = useCallback(async () => {
    if (allowance.enabled) {
      // Disable auto-pay
      setAllowance((prev) => ({
        ...prev,
        enabled: false,
        logicSigAddress: null,
      }))
      return
    }

    // ─── Placeholder: LogicSig signing would go here ───
    // In production, this would:
    // 1. Compile TEAL LogicSig contract with parameters (max 10 ALGO, sender, receiver)
    // 2. Sign the LogicSig with the user's wallet
    // 3. Store the delegated LogicSig for automatic future transactions
    // 4. Set the escrow address

    // TODO: Implement TEAL LogicSig contract compilation and signing
    // const logicSig = await compileAndSignLogicSig({
    //   maxAmount: 10_000_000, // 10 ALGO in microAlgos
    //   senderAddress: activeAddress,
    //   receiverAddress: creatorAddress, // set per-creator or wildcard
    //   expirationRound: currentRound + 100_000,
    // })

    setAllowance((prev) => ({
      ...prev,
      enabled: true,
      remainingMicroAlgos: 10_000_000,
      logicSigAddress: null, // Would be set after LogicSig compilation
    }))

    console.log('[Ignition] Auto-pay enabled — LogicSig placeholder. TEAL contract not yet implemented.')
  }, [allowance.enabled])

  const remainingAlgos = (allowance.remainingMicroAlgos / 1_000_000).toFixed(2)
  const percentage = (allowance.remainingMicroAlgos / allowance.totalMicroAlgos) * 100

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-terminal-surface/20">
      <div className="flex items-center gap-3">
        {/* Toggle */}
        <button
          onClick={handleToggle}
          className={`toggle-brutal ${allowance.enabled ? 'active' : ''}`}
          aria-label="Toggle auto-pay"
        >
          <div className="toggle-knob" />
        </button>

        {/* Label */}
        <div className="flex items-center gap-1.5">
          {allowance.enabled ? (
            <ShieldCheck className="w-3.5 h-3.5 text-terminal-green" />
          ) : (
            <Shield className="w-3.5 h-3.5 text-terminal-dim" />
          )}
          <span className={`text-xs font-mono ${allowance.enabled ? 'text-terminal-green' : 'text-terminal-dim'}`}>
            Auto-Pay
          </span>
        </div>
      </div>

      {/* Allowance indicator */}
      {allowance.enabled && (
        <div className="flex items-center gap-3">
          {/* Mini progress bar */}
          <div className="w-16 h-1 bg-terminal-border overflow-hidden">
            <div
              className="h-full bg-terminal-green transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-terminal-green/70 tracking-wider">
            [{remainingAlgos} ALGO]
          </span>
        </div>
      )}
    </div>
  )
}
