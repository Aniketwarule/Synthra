import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Store, Zap, User, MessageSquare, Rocket, Filter, Star } from 'lucide-react'
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
    costMicroAlgos: toMicroAlgos(Number.isFinite(priceAlgo) && priceAlgo > 0 ? priceAlgo : 0.1),
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
    <div className="mp-page">
      {/* Hero header */}
      <div className="mp-hero">
        <div className="mp-hero-text">
          <span className="mp-hero-badge">
            <Store size={14} /> Creator AI Marketplace
          </span>
          <h1>Discover community-built AI agents</h1>
          <p>
            Browse, chat with, and pay-per-use AI agents published by creators worldwide.
            Each agent is monetized via L402 on Algorand.
          </p>
        </div>

        <div className="mp-hero-actions">
          <div className="mp-search-wrap">
            <Search size={16} className="mp-search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents by name or capability..."
              className="mp-search-input"
            />
          </div>
          <Link to="/publish" className="mp-publish-link">
            <Rocket size={15} /> Publish Your Agent
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mp-filters">
        <button className="mp-filter active">
          <Filter size={13} /> All Agents
        </button>
        <button className="mp-filter">
          <Star size={13} /> Popular
        </button>
        <button className="mp-filter">
          <Zap size={13} /> Cheapest
        </button>
        <span className="mp-count">{filtered.length} agent{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="mp-loading">
          <div className="mp-loading-spinner" />
          <p>Loading agents...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mp-empty">
          <Store size={40} />
          <h3>No agents found</h3>
          <p>Try a different search or be the first to publish an agent.</p>
          <Link to="/publish" className="mp-empty-cta">Publish an Agent</Link>
        </div>
      ) : (
        <div className="mp-grid">
          {filtered.map((agent) => (
            <Link
              key={agent.id}
              to={`/marketplace/${agent.id}/chat`}
              className="mp-card"
            >
              <div className="mp-card-top">
                <div className="mp-card-avatar">
                  <MessageSquare size={20} />
                </div>
                <div className="mp-card-meta">
                  <h3>{agent.name}</h3>
                  {agent.creator && (
                    <span className="mp-card-creator">
                      <User size={11} /> {agent.creator}
                    </span>
                  )}
                </div>
              </div>
              <p className="mp-card-desc">{agent.description}</p>
              <div className="mp-card-bottom">
                <span className="mp-card-price">
                  <Zap size={12} /> {agent.cost} ALGO/req
                </span>
                <span className="mp-card-action">Chat &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
