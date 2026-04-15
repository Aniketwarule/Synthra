import { useEffect, useRef } from 'react'
import { MessageSquare, Sparkles, Trash2 } from 'lucide-react'
import TerminalLine from './TerminalLine'
import type { TerminalLogEntry, L402Step } from '../../types/l402'

interface TerminalWindowProps {
  logs: TerminalLogEntry[]
  currentStep: L402Step
  onClear: () => void
}

export default function TerminalWindow({ logs, currentStep, onClear }: TerminalWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isProcessing = currentStep !== 'idle' && currentStep !== 'complete' && currentStep !== 'error'
  const chatLogs = logs.filter((entry) => entry.status === 'INPUT' || entry.status === 'STREAM' || entry.status === 'FAIL')
  const hiddenTechnicalCount = Math.max(0, logs.length - chatLogs.length)

  const stepLabel = (() => {
    if (currentStep === 'idle') return 'Ready'
    if (currentStep === 'complete') return 'Complete'
    if (currentStep === 'error') return 'Needs Attention'
    if (currentStep === 'payment_required') return 'Payment Required'
    if (currentStep === 'requesting') return 'Sending Prompt'
    if (currentStep === 'broadcasting') return 'Confirming Payment'
    if (currentStep === 'verifying') return 'Verifying Proof'
    if (currentStep === 'streaming') return 'Generating Response'
    if (currentStep === 'signing') return 'Starting Session'
    return String(currentStep).replace('_', ' ')
  })()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatLogs])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/25">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl border border-terminal-green/25 bg-terminal-green/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-terminal-green" />
          </div>
          <div className="min-w-0">
            <p className="font-sans text-sm text-white truncate">Conversation</p>
            <p className="text-[11px] text-gray-400 font-mono uppercase tracking-wide">
              {stepLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hiddenTechnicalCount > 0 && (
            <span className="hidden md:inline text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              {hiddenTechnicalCount} technical updates hidden
            </span>
          )}
          {logs.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono text-gray-300 hover:text-white border border-white/10 hover:border-red-500/40 hover:bg-red-500/10 transition-all uppercase tracking-wider"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-transparent to-black/10">
        {chatLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center select-none">
            <div className="w-14 h-14 rounded-2xl border border-terminal-green/25 bg-terminal-green/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-terminal-green" />
            </div>
            <p className="text-white font-sans text-base mb-1.5">Start your first prompt</p>
            <p className="text-gray-400 text-sm max-w-md">
              Pick a model, type your question, and get a response here. Payment and verification happen in the background.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {chatLogs.map((entry) => (
              <TerminalLine key={entry.id} entry={entry} />
            ))}

            {isProcessing && (
              <div className="flex justify-start py-1.5">
                <div className="rounded-2xl px-3.5 py-2.5 border border-white/10 bg-white/5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
                  <span className="text-xs font-mono text-gray-300">Working...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-black/20 text-[10px] font-mono text-gray-500">
        <span>{chatLogs.length} message{chatLogs.length !== 1 ? 's' : ''}</span>
        <span className="uppercase tracking-wider text-terminal-green/80">
          {stepLabel}
        </span>
      </div>
    </div>
  )
}
