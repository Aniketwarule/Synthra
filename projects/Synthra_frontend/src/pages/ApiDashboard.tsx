import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, ArrowLeft, BarChart3, Database, DollarSign, Users, Zap } from "lucide-react"
import { usePeraWallet } from '../hooks/usePeraWallet'

interface MetricsData {
  totalRequests: number
  revenueUsdc: number
  activeConsumers: number
  avgLatency: number
  topEndpoints: { name: string; reqs: number; rev: number }[]
}

export default function ApiDashboard() {
  const { address } = usePeraWallet()
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!address) {
      setLoading(false)
      return
    }

    fetch(`http://localhost:8080/api/marketplace/metrics/${address}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load metrics')
        return res.json()
      })
      .then(data => {
        setMetrics(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [address])

  if (!address) {
    return (
      <div className="cs-page bg-[var(--bg-0)] text-[var(--ink-0)] min-h-screen">
        <div className="w-full max-w-6xl mx-auto mt-8 text-center py-20">
          <Users size={48} className="mx-auto text-[var(--ink-3)] mb-4" />
          <h2 className="text-2xl font-bold text-[var(--ink-0)] mb-2">Connect Your Wallet</h2>
          <p className="text-[var(--ink-2)]">Please connect your Algorand wallet to view your API dashboard.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="cs-page bg-[var(--bg-0)] text-[var(--ink-0)] min-h-screen">
        <div className="w-full max-w-6xl mx-auto mt-8 text-center py-20 text-[var(--ink-2)]">Loading dashboard...</div>
      </div>
    )
  }

  const data = metrics || { totalRequests: 0, revenueUsdc: 0, activeConsumers: 0, avgLatency: 0, topEndpoints: [] }

  return (
    <div className="cs-page bg-[var(--bg-0)] text-[var(--ink-0)] min-h-screen">
      <div className="w-full max-w-6xl mx-auto mt-8">
        <Link to="/api" className="inline-flex items-center gap-2 text-[var(--ink-2)] hover:text-[var(--ink-0)] mb-6 transition-colors font-medium">
          <ArrowLeft size={16} /> Back to Marketplace
        </Link>

        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink-0)] mb-2">
              API Dashboard
            </h1>
            <p className="text-[var(--ink-2)]">
              Track usage, revenue, and latency metrics for your deployed endpoints.
            </p>
          </div>
          <Link to="/deploy-api" className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white font-medium py-2 px-4 rounded-xl transition-colors shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)]">
            <Database size={16} /> Deploy New Endpoint
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
                <Activity size={24} />
              </div>
              {data.totalRequests > 0 && (
                <span className="flex items-center text-emerald-500 text-sm font-semibold">
                  Live <ArrowUpRight size={14} />
                </span>
              )}
            </div>
            <h3 className="text-[var(--ink-2)] text-sm font-medium mb-1">Total Requests</h3>
            <p className="text-3xl font-bold text-[var(--ink-0)]">{data.totalRequests.toLocaleString()}</p>
          </div>

          <div className="bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
                <DollarSign size={24} />
              </div>
            </div>
            <h3 className="text-[var(--ink-2)] text-sm font-medium mb-1">Revenue Earned</h3>
            <p className="text-3xl font-bold text-[var(--ink-0)]">${data.revenueUsdc.toFixed(2)} <span className="text-sm font-normal text-[var(--ink-3)]">USDC</span></p>
          </div>

          <div className="bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl border border-purple-500/20">
                <Users size={24} />
              </div>
            </div>
            <h3 className="text-[var(--ink-2)] text-sm font-medium mb-1">Active Consumers</h3>
            <p className="text-3xl font-bold text-[var(--ink-0)]">{data.activeConsumers.toLocaleString()}</p>
          </div>

          <div className="bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl border border-orange-500/20">
                <Zap size={24} />
              </div>
            </div>
            <h3 className="text-[var(--ink-2)] text-sm font-medium mb-1">Avg Latency</h3>
            <p className="text-3xl font-bold text-[var(--ink-0)]">{data.avgLatency}<span className="text-lg font-normal text-[var(--ink-3)] ml-1">ms</span></p>
          </div>
        </div>

        {/* Top Endpoints */}
        <div className="bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] transition-shadow">
          <h3 className="font-bold text-lg text-[var(--ink-0)] mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-[var(--accent)]" /> Your Endpoints
          </h3>

          {data.topEndpoints.length === 0 ? (
            <div className="text-center py-12">
              <Database size={40} className="mx-auto text-[var(--ink-3)] mb-3" />
              <p className="text-[var(--ink-2)]">No endpoints deployed yet.</p>
              <Link to="/deploy-api" className="inline-flex items-center gap-2 mt-4 text-[var(--accent)] hover:text-[var(--accent-soft)] font-medium">
                Deploy your first API <ArrowUpRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.topEndpoints.map((ep, i) => (
                <div key={i} className="flex justify-between items-center p-4 hover:bg-[var(--bg-2)] rounded-xl transition-colors border border-transparent hover:border-[var(--card-border)]">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono text-[var(--ink-3)] w-6">{i + 1}.</span>
                    <div>
                      <p className="font-semibold text-[var(--ink-0)]">{ep.name}</p>
                      <p className="text-xs text-[var(--ink-2)]">{ep.reqs.toLocaleString()} requests</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-500">${ep.rev.toFixed(2)}</p>
                    <p className="text-xs text-[var(--ink-3)]">USDC</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
