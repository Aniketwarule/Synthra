import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Zap, ArrowUp, Loader2, User, Bot, Sparkles } from 'lucide-react'
import { usePeraWallet } from '../hooks/usePeraWallet'
import { useDualL402 } from '../hooks/useDualL402'
import { COMMUNITY_AGENTS } from '../types/models'
import type { AIModel } from '../types/models'
import ApiService from '../utils/apiservice'
import WalletConnectOptions from '../components/WalletConnectOptions'

const toMicroAlgos = (algo: number): number => Math.round(algo * 1_000_000)

const normalizeAgentToModel = (agent: any): AIModel => {
  const priceAlgo = Number(agent?.priceAlgo ?? agent?.price_algo ?? agent?.cost ?? 0.1)
  const resolvedId = String(agent?.agentId ?? agent?.agent_id ?? agent?.id ?? '')

  return {
    id: resolvedId,
    name: String(agent?.name ?? 'Community Agent'),
    description: String(agent?.description ?? 'Community AI agent'),
    cost: Number.isFinite(priceAlgo) && priceAlgo > 0 ? priceAlgo : 0.1,
    tokenPrice: Number.isFinite(priceAlgo) && priceAlgo > 0 ? priceAlgo : 0.1,
    costMicroUSDC: toMicroAlgos(Number.isFinite(priceAlgo) && priceAlgo > 0 ? priceAlgo : 0.1),
    destinationType: 'creator',
    destinationAddress: String(agent?.creatorWallet ?? agent?.creator_wallet ?? agent?.destinationAddress ?? ''),
    creator: agent?.creator ? String(agent.creator) : undefined,
    category: 'community',
  }
}

export default function MarketplaceChat() {
  const { agentId } = useParams<{ agentId: string }>()
  const { isConnected } = usePeraWallet()
  const [agent, setAgent] = useState<AIModel | null>(null)
  const [prompt, setPrompt] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Find agent
  useEffect(() => {
    const fetchAgent = async () => {
      // Try static first
      const found = COMMUNITY_AGENTS.find((a) => a.id === agentId)
      if (found) { setAgent(found); return }
      // Try API
      try {
        const data = await ApiService.getAgents()
        const list = Array.isArray(data) ? data : data?.agents || []
        const rawMatch = list.find((entry: any) => {
          const primaryId = String(entry?.agentId ?? entry?.agent_id ?? '')
          const fallbackId = String(entry?.id ?? '')
          return primaryId === agentId || fallbackId === agentId
        })

        if (rawMatch) {
          setAgent(normalizeAgentToModel(rawMatch))
        }
      } catch { /* fallback */ }
    }
    fetchAgent()
  }, [agentId])

  const { state, logs, executePrompt, clearLogs } = useDualL402(agent)

  const chatLogs = logs.filter(
    (e) => e.status === 'INPUT' || e.status === 'STREAM' || e.status === 'FAIL',
  )

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatLogs])

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault()
      const trimmed = prompt.trim()
      if (!trimmed || state.isProcessing) return
      executePrompt(trimmed)
      setPrompt('')
      if (inputRef.current) inputRef.current.style.height = '44px'
    },
    [prompt, state.isProcessing, executePrompt],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    },
    [handleSubmit],
  )

  if (!agent) {
    return (
      <div className="mpc-loading">
        <Loader2 size={24} className="spin" />
        <p>Loading agent...</p>
      </div>
    )
  }

  const canSubmit = prompt.trim().length > 0 && !state.isProcessing && isConnected

  return (
    <div className="hub-page">
      {/* Agent info header */}
      <div className="mpc-header">
        <Link to="/marketplace" className="mpc-back">
          <ArrowLeft size={16} /> Marketplace
        </Link>
        <div className="mpc-agent-info">
          <div className="mpc-agent-avatar"><Bot size={18} /></div>
          <div>
            <h2>{agent.name}</h2>
            <p>{agent.description}</p>
          </div>
        </div>
        <div className="mpc-agent-meta">
          {agent.creator && <span className="mpc-creator">{agent.creator}</span>}
          <span className="mpc-price"><Zap size={12} /> {agent.cost} USDC/req</span>
        </div>
      </div>

      {/* Chat area — reuses hub styles */}
      <div className="hub-chat-area" ref={scrollRef}>
        {chatLogs.length === 0 ? (
          <div className="hub-empty">
            <div className="hub-empty-icon"><Sparkles size={32} /></div>
            <h2>Chat with {agent.name}</h2>
            <p>{agent.description}</p>
            {!isConnected && (
              <WalletConnectOptions
                className="wallet-options-row wallet-options-row-centered"
                buttonClassName="hub-connect-btn"
              />
            )}
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
                    {entry.status === 'INPUT' ? 'You' : agent.name}
                  </p>
                  <div className="hub-msg-text">{entry.message}</div>
                </div>
              </div>
            ))}
            {state.isProcessing && (
              <div className="hub-msg ai">
                <div className="hub-msg-avatar"><Bot size={16} /></div>
                <div className="hub-msg-bubble">
                  <div className="hub-typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input bar — reuses hub styles */}
      <div className="hub-input-bar">
        <form className="hub-input-form" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={!isConnected ? 'Connect wallet to chat...' : `Ask ${agent.name}...`}
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
      </div>
    </div>
  )
}
