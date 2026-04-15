import { useState, useEffect, useRef, useCallback } from 'react'
import { Cpu, Zap, ArrowUp, Loader2, Sparkles, User, Bot, RefreshCcw, Lock } from 'lucide-react'
import { usePeraWallet } from '../hooks/usePeraWallet'
import { useDualL402 } from '../hooks/useDualL402'
import { BASE_MODELS } from '../types/models'
import type { AIModel } from '../types/models'
import WalletConnectOptions from '../components/WalletConnectOptions'

export default function Hub() {
  const { isConnected } = usePeraWallet()
  const [selectedModel, setSelectedModel] = useState<AIModel>(BASE_MODELS[0])
  const { state, logs, executePrompt, clearLogs } = useDualL402(selectedModel)
  const [prompt, setPrompt] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const chatLogs = logs.filter(
    (e) => e.status === 'INPUT' || e.status === 'STREAM' || e.status === 'FAIL',
  )

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatLogs])

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = prompt.trim()
      if (!trimmed || state.isProcessing) return
      executePrompt(trimmed)
      setPrompt('')
      if (inputRef.current) {
        inputRef.current.style.height = '44px'
      }
    },
    [prompt, state.isProcessing, executePrompt],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  // Lock model switching once chat has started
  const isModelLocked = chatLogs.length > 0

  const canSubmit = prompt.trim().length > 0 && !state.isProcessing && isConnected && !!selectedModel

  return (
    <div className="hub-page">
      {/* Model selector strip */}
      <div className="hub-model-strip">
        <div className="hub-model-strip-label">
          <Cpu size={15} />
          <span>Base Models</span>
          {isModelLocked && (
            <span className="hub-lock-badge">
              <Lock size={11} /> Locked
            </span>
          )}
        </div>
        <div className="hub-model-cards">
          {BASE_MODELS.map((m) => {
            const isSelected = selectedModel?.id === m.id
            const isDisabled = isModelLocked && !isSelected
            return (
              <button
                key={m.id}
                onClick={() => !isDisabled && setSelectedModel(m)}
                disabled={isDisabled}
                className={`hub-model-card ${isSelected ? 'active' : ''} ${isDisabled ? 'locked' : ''}`}
              >
                <span className="hub-model-name">{m.name}</span>
                <span className="hub-model-price">
                  {isDisabled ? <Lock size={10} /> : null}
                  {m.cost} ALGO/req
                </span>
              </button>
            )
          })}
        </div>
        {chatLogs.length > 0 && (
          <button className="hub-clear-btn" onClick={clearLogs} title="Clear chat">
            <RefreshCcw size={14} /> New Chat
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="hub-chat-area" ref={scrollRef}>
        {chatLogs.length === 0 ? (
          <div className="hub-empty">
            <div className="hub-empty-icon">
              <Sparkles size={32} />
            </div>
            <h2>Welcome to Synthra Hub</h2>
            <p>
              Chat with {selectedModel?.name || 'a base model'}. Each request settles on Algorand
              via L402 payment protocol.
            </p>
            {!isConnected && (
              <WalletConnectOptions
                className="wallet-options-row wallet-options-row-centered"
                buttonClassName="hub-connect-btn"
              />
            )}
            <div className="hub-suggestions">
              <button onClick={() => setPrompt('Explain how Algorand consensus works')}>
                Explain how Algorand consensus works
              </button>
              <button onClick={() => setPrompt('Write a smart contract for a simple auction')}>
                Write a smart contract for a simple auction
              </button>
              <button onClick={() => setPrompt('What is L402 payment protocol?')}>
                What is L402 payment protocol?
              </button>
            </div>
          </div>
        ) : (
          <div className="hub-messages">
            {chatLogs.map((entry) => (
              <div
                key={entry.id}
                className={`hub-msg ${entry.status === 'INPUT' ? 'user' : entry.status === 'FAIL' ? 'error' : 'ai'}`}
              >
                <div className="hub-msg-avatar">
                  {entry.status === 'INPUT' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className="hub-msg-bubble">
                  <p className="hub-msg-sender">
                    {entry.status === 'INPUT' ? 'You' : selectedModel?.name || 'AI'}
                  </p>
                  <div className="hub-msg-text">{entry.message}</div>
                </div>
              </div>
            ))}
            {state.isProcessing && (
              <div className="hub-msg ai">
                <div className="hub-msg-avatar"><Bot size={16} /></div>
                <div className="hub-msg-bubble">
                  <div className="hub-typing">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="hub-input-bar">
        {selectedModel && isConnected && (
          <div className="hub-input-meta">
            <Zap size={13} />
            <span>{selectedModel.name}</span>
            <span className="hub-input-cost">{selectedModel.cost} ALGO/req</span>
          </div>
        )}
        <form className="hub-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !isConnected
                ? 'Connect wallet to start chatting...'
                : `Ask ${selectedModel?.name || 'AI'} anything...`
            }
            disabled={!isConnected || state.isProcessing}
            rows={1}
            className="hub-textarea"
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = '44px'
              el.style.height = Math.min(el.scrollHeight, 140) + 'px'
            }}
          />
          <button type="submit" disabled={!canSubmit} className="hub-send-btn">
            {state.isProcessing ? <Loader2 size={18} className="spin" /> : <ArrowUp size={18} />}
          </button>
        </form>
        <div className="hub-input-hint">
          <span>Enter to send</span>
          <span>Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  )
}
