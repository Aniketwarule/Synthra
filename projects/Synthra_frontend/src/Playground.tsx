import { useState } from 'react'
import Header from './components/playground/Header'
import ModelSelector from './components/playground/ModelSelector'
import TerminalWindow from './components/playground/TerminalWindow'
import PromptInput from './components/playground/PromptInput'
import { usePeraWallet } from './hooks/usePeraWallet'
import { useDualL402 } from './hooks/useDualL402'
import type { AIModel } from './types/models'

export default function Playground() {
  const { isConnected } = usePeraWallet()
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null)
  const { state, logs, executePrompt, clearLogs } = useDualL402(selectedModel)

  return (
    <div className="min-h-screen bg-app-shell text-white overflow-hidden">
      <div className="scan-line-overlay" />

      <div className="h-screen max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col gap-3">
        <Header />

        <div className="flex-1 min-h-0 rounded-2xl border border-white/10 bg-black/35 backdrop-blur-sm overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.45)] flex flex-col">
          <ModelSelector selected={selectedModel} onSelect={setSelectedModel} />

          <TerminalWindow
            logs={logs}
            currentStep={state.currentStep}
            onClear={clearLogs}
          />

          <PromptInput
            onSubmit={executePrompt}
            isProcessing={state.isProcessing}
            isWalletConnected={isConnected}
            selectedModel={selectedModel}
          />
        </div>
      </div>
    </div>
  )
}
