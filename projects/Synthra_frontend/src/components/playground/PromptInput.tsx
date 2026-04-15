import { useState, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, Loader2, Zap } from 'lucide-react'
import type { AIModel } from '../../types/models'

interface PromptInputProps {
  onSubmit: (prompt: string) => void
  isProcessing: boolean
  isWalletConnected: boolean
  selectedModel: AIModel | null
}

export default function PromptInput({ onSubmit, isProcessing, isWalletConnected, selectedModel }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()
      const trimmed = prompt.trim()
      if (!trimmed || isProcessing) return
      onSubmit(trimmed)
      setPrompt('')
    },
    [prompt, isProcessing, onSubmit],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const canSubmit = prompt.trim().length > 0 && !isProcessing && isWalletConnected && !!selectedModel

  const placeholder = !isWalletConnected
    ? 'Connect a wallet to begin...'
    : !selectedModel
      ? 'Select a model to continue...'
      : isProcessing
        ? 'Generating response...'
        : `Ask ${selectedModel.name} anything...`

  return (
    <div className="flex-shrink-0 border-t border-white/10 bg-black/20 backdrop-blur-sm">
      {selectedModel && isWalletConnected && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-black/20">
          <Zap className="w-3.5 h-3.5 text-terminal-green" />
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
            {selectedModel.destinationType === 'treasury' ? 'PREMIUM' : 'CREATOR'}
          </span>
          <span className="text-[11px] font-sans text-white/90">
            {selectedModel.name}
          </span>
          <span className="text-[11px] font-mono text-terminal-green font-bold ml-auto">
            {selectedModel.cost} ALGO/req
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-3 px-4 py-3">
        <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] focus-within:border-terminal-green/45 focus-within:bg-white/[0.05] transition-all">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={!isWalletConnected || isProcessing || !selectedModel}
            rows={1}
            className="w-full bg-transparent text-white font-sans text-sm resize-none outline-none placeholder:text-gray-500 disabled:opacity-40 disabled:cursor-not-allowed leading-relaxed px-3.5 py-2.5"
            style={{ minHeight: '44px', maxHeight: '148px' }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = '44px'
              el.style.height = Math.min(el.scrollHeight, 148) + 'px'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border border-terminal-green/35 text-terminal-green hover:bg-terminal-green/15 hover:border-terminal-green disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all duration-150"
        >
          {isProcessing ? (
            <Loader2 className="w-4.5 h-4.5 animate-spin" />
          ) : (
            <ArrowUp className="w-4.5 h-4.5" />
          )}
        </button>
      </form>

      <div className="flex items-center justify-between px-4 pb-3">
        <span className="text-[10px] font-sans text-gray-500">
          Press Enter to send
        </span>
        <span className="text-[9px] font-mono text-gray-500/50 tracking-wider uppercase">
          Shift+Enter for newline
        </span>
      </div>
    </div>
  )
}
