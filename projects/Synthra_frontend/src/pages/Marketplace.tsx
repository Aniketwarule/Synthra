import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Store, Zap, User, MessageSquare, Rocket, Filter, Star, Bot } from 'lucide-react'
import { COMMUNITY_AGENTS } from '../types/models'
import type { AIModel } from '../types/models'
import ApiService from '../utils/apiservice'

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

export default function Marketplace() {
  const [agents, setAgents] = useState<AIModel[]>(COMMUNITY_AGENTS)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const data = await ApiService.getAgents()
        const list = Array.isArray(data) ? data : data?.agents || []
        const normalized = list
          .map((entry: any) => normalizeAgentToModel(entry))
          .filter((entry: AIModel) => entry.id.length > 0)

        if (normalized.length > 0) {
          setAgents(normalized)
          return
        }

        setAgents(COMMUNITY_AGENTS)
      } catch {
        // Fallback to static list
      } finally {
        setLoading(false)
      }
    }
    fetchAgents()
  }, [])

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-[var(--bg-0)] text-[var(--ink-0)] pb-24">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-[var(--nav-border)] bg-[var(--bg-1)] backdrop-blur-md pt-24 pb-16 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full pointer-events-none opacity-30">
           <div className="absolute top-0 right-1/4 w-96 h-96 bg-[var(--orb-2)] rounded-full blur-[100px]"></div>
           <div className="absolute top-20 left-1/4 w-96 h-96 bg-[var(--orb-3)] rounded-full blur-[100px]"></div>
        </div>

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[var(--accent)] text-sm font-semibold mb-6 shadow-[0_0_15px_var(--accent-bg)]">
              <Store size={14} /> AI Agent Marketplace
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--ink-0)] mb-6 tracking-tight">
              Discover Community <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-mid)]">AI Agents</span>
            </h1>
            <p className="text-lg text-[var(--ink-2)] max-w-xl leading-relaxed">
              Browse, chat with, and pay-per-use AI agents published by creators worldwide.
              Each agent is seamlessly monetized using USDC L402 payments on Algorand.
            </p>
          </div>

          <div className="w-full md:w-auto flex flex-col items-center md:items-end gap-4 shrink-0">
            <div className="relative w-full md:w-80">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents..."
                className="w-full bg-[var(--bg-2)] border border-[var(--card-border)] rounded-xl py-3 pl-11 pr-4 text-[var(--ink-0)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--ink-3)] shadow-inner"
              />
            </div>
            <Link to="/publish" className="w-full md:w-80 flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white font-medium py-3 px-6 rounded-xl transition-all shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)]">
              <Rocket size={18} /> Publish Your Agent
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-12">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex gap-2 bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--card-border)]">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-2)] text-[var(--ink-0)] text-sm font-medium shadow-sm border border-[var(--nav-border)]">
              <Filter size={14} /> All Agents
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[var(--ink-2)] hover:text-[var(--ink-0)] hover:bg-[var(--bg-2)] text-sm font-medium transition-colors">
              <Star size={14} /> Popular
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[var(--ink-2)] hover:text-[var(--ink-0)] hover:bg-[var(--bg-2)] text-sm font-medium transition-colors">
              <Zap size={14} /> Cheapest
            </button>
          </div>
          <span className="text-[var(--ink-3)] text-sm font-medium bg-[var(--bg-1)] px-4 py-2 rounded-full border border-[var(--card-border)]">
            {filtered.length} agent{filtered.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Agent grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--ink-3)] animate-pulse">
            <Bot size={48} className="text-[var(--ink-2)] mb-4" />
            <p className="text-lg">Loading community agents...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-[var(--bg-1)] rounded-3xl border border-[var(--card-border)] backdrop-blur-md">
            <Store size={64} className="mx-auto text-[var(--ink-3)] mb-6" />
            <h3 className="text-2xl font-bold text-[var(--ink-0)] mb-3">No agents found</h3>
            <p className="text-[var(--ink-2)] max-w-md mx-auto text-lg leading-relaxed mb-6">
              Try a different search or be the first to publish an agent to the marketplace.
            </p>
            <Link to="/publish" className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white font-medium py-2 px-6 rounded-xl transition-all shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)]">
              Publish an Agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((agent) => (
              <Link
                key={agent.id}
                to={`/marketplace/${agent.id}/chat`}
                className="group relative bg-[var(--bg-1)] backdrop-blur-sm border border-[var(--card-border)] hover:border-[var(--accent)] rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--card-shadow-hover)] flex flex-col h-full"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-[var(--accent-bg)] text-[var(--accent)] p-3 rounded-xl border border-[var(--accent-border)] group-hover:scale-110 transition-transform">
                    <MessageSquare size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xl text-[var(--ink-0)] truncate mb-1">{agent.name}</h3>
                    {agent.creator ? (
                      <span className="flex items-center gap-1.5 text-xs text-[var(--ink-2)] truncate">
                        <User size={12} className="text-[var(--ink-3)]" /> {agent.creator.substring(0, 16)}...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
                        <User size={12} /> Unknown Creator
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-[var(--ink-2)] mb-6 line-clamp-3 leading-relaxed flex-1">
                  {agent.description}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-[var(--card-border)] mt-auto">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink-1)] bg-[var(--bg-2)] px-3 py-1.5 rounded-lg border border-[var(--nav-border)]">
                    <Zap size={14} className="text-[var(--accent)]" /> {agent.cost} USDC/req
                  </span>
                  <span className="text-sm font-semibold text-[var(--accent)] flex items-center gap-1 group-hover:text-[var(--accent-soft)] transition-colors">
                    Chat <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
