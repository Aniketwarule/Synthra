import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Code2, Zap, Key, BookOpen, Globe, BarChart3, Database, ArrowRight } from 'lucide-react'

export default function ApiMarketplace() {
  const [catalog, setCatalog] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
    fetch(`${backendUrl}/api/marketplace/catalog`)
      .then(res => res.json())
      .then(data => {
        setCatalog(data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to fetch API catalog:", err)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-0)] text-[var(--ink-0)] pb-24">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-[var(--nav-border)] bg-[var(--bg-1)] backdrop-blur-md pt-24 pb-16 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-full pointer-events-none opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--orb-3)] rounded-full blur-[100px]"></div>
          <div className="absolute top-20 right-1/4 w-96 h-96 bg-[var(--orb-2)] rounded-full blur-[100px]"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[var(--accent)] text-sm font-semibold mb-6 shadow-[0_0_15px_var(--accent-bg)]">
            <Code2 size={14} /> Live Beta
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-[var(--ink-0)] mb-6 tracking-tight">
            API <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-mid)]">Marketplace</span>
          </h1>
          <p className="text-xl text-[var(--ink-2)] max-w-2xl mx-auto leading-relaxed">
            Discover, purchase, and consume powerful AI APIs using prepaid USDC x402 credentials. 
            Zero friction. Zero api keys to manage.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-16">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h2 className="text-3xl font-bold text-[var(--ink-0)] flex items-center gap-3">
            <Database size={28} className="text-[var(--accent)]" /> Available APIs
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link to="/api-dashboard" className="flex items-center gap-2 bg-[var(--bg-1)] hover:bg-[var(--bg-2)] border border-[var(--card-border)] text-[var(--ink-1)] font-medium py-2 px-5 rounded-xl transition-all shadow-sm">
              <BarChart3 size={18} /> View Dashboard
            </Link>
            <Link to="/deploy-api" className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white font-medium py-2 px-5 rounded-xl transition-all shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)]">
              <Code2 size={18} /> Deploy API Endpoint
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--ink-3)] animate-pulse">
            <Globe size={48} className="text-[var(--ink-2)] mb-4" />
            <p className="text-lg">Loading catalog from backend...</p>
          </div>
        ) : catalog.length === 0 ? (
          <div className="text-center py-24 bg-[var(--bg-1)] rounded-3xl border border-[var(--card-border)] backdrop-blur-md">
            <Globe size={64} className="mx-auto text-[var(--ink-3)] mb-6" />
            <h3 className="text-2xl font-bold text-[var(--ink-0)] mb-3">No APIs Published Yet</h3>
            <p className="text-[var(--ink-2)] max-w-md mx-auto text-lg leading-relaxed">
              Be the first to publish an API using the <code>synthra-x402</code> SDK! Your API will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {catalog.map((api, idx) => (
              <div key={idx} className="group relative bg-[var(--bg-1)] backdrop-blur-sm border border-[var(--card-border)] hover:border-[var(--accent)] rounded-2xl p-6 transition-all duration-300 hover:shadow-[var(--card-shadow-hover)] flex flex-col h-full">
                <div className="flex justify-between items-start mb-4 gap-4">
                  <h3 className="font-bold text-xl text-[var(--ink-0)] truncate">{api.description || "Unnamed API"}</h3>
                  <span className="bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-border)] text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-inner">
                    ${api.price?.amount || "0"} {api.price?.currency || "USDC"}
                  </span>
                </div>
                <p className="text-sm font-mono text-[var(--ink-2)] mb-6 line-clamp-2 bg-[var(--bg-2)] p-2 rounded-lg border border-[var(--card-border)]">
                  {api.resourceUrl}
                </p>
                <div className="flex flex-wrap gap-2 mb-8 flex-1 content-start">
                  {api.tags?.map((tag: string) => (
                    <span key={tag} className="text-xs bg-[var(--bg-2)] text-[var(--ink-1)] border border-[var(--card-border)] px-2.5 py-1 rounded-lg font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
                <Link to="/docs" className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-lg" onClick={() => alert("Purchasing prepaid tokens is handled automatically by synthra-x402 when you make a request. Check the docs for integration!")}>
                  <Zap size={18} /> Get Integration SDK
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="mt-24">
          <h2 className="text-3xl font-bold text-[var(--ink-0)] mb-8 border-b border-[var(--card-border)] pb-4">Developer Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/docs" className="group bg-[var(--bg-1)] border border-[var(--card-border)] hover:border-[var(--accent)] rounded-2xl p-6 flex items-center justify-between transition-all">
              <div className="flex items-center gap-5">
                <div className="bg-[var(--accent-bg)] p-4 rounded-full group-hover:bg-[var(--accent-soft)] group-hover:text-white transition-colors">
                  <BookOpen size={24} className="text-[var(--accent)] group-hover:text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-[var(--ink-0)] mb-1">Read the Docs</h4>
                  <p className="text-[var(--ink-2)] text-sm">SDK installation guide and API reference for developers</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-[var(--ink-3)] group-hover:text-[var(--accent)] transition-colors" />
            </Link>
            
            <Link to="/api/keys" className="group bg-[var(--bg-1)] border border-[var(--card-border)] hover:border-[var(--accent)] rounded-2xl p-6 flex items-center justify-between transition-all">
              <div className="flex items-center gap-5">
                <div className="bg-[var(--accent-bg)] p-4 rounded-full group-hover:bg-[var(--accent-soft)] group-hover:text-white transition-colors">
                  <Key size={24} className="text-[var(--accent)] group-hover:text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-[var(--ink-0)] mb-1">Generate API Keys</h4>
                  <p className="text-[var(--ink-2)] text-sm">Get API credentials for Synthra Base Models</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-[var(--ink-3)] group-hover:text-[var(--accent)] transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
