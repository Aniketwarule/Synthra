import { useState, useCallback, useEffect } from 'react'
import { Key, Copy, Check, RefreshCw, Shield, AlertCircle, ChevronDown, Zap, Loader2, Terminal } from 'lucide-react'
import { usePeraWallet } from '../hooks/usePeraWallet'
import { ellipseAddress } from '../utils/ellipseAddress'
import { BASE_MODELS } from '../types/models'
import WalletConnectOptions from '../components/WalletConnectOptions'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080'

const getModelIdCandidates = (modelId: string): string[] => {
  if (modelId === 'gemini-2.0-flash') {
    return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-pro-latest']
  }

  return [modelId]
}

export default function ApiKey() {
  const { address, isConnected } = usePeraWallet()
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string>(BASE_MODELS[0].id)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hits, setHits] = useState<number>(0)
  const [accruedAlgo, setAccruedAlgo] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) return
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/apikeys/stats?key=${encodeURIComponent(apiKey)}`)
        if (res.ok) {
          const data = await res.json()
          setHits(data.hits)
          setAccruedAlgo(data.accruedAlgo || 0)
        }
      } catch { /* silent */ }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [apiKey])

  const generateKey = useCallback(async () => {
    if (!address || !selectedModelId) return
    setIsGenerating(true)
    setError(null)
    try {
      const modelCandidates = getModelIdCandidates(selectedModelId)
      let data: any = null
      let lastError = 'Failed to generate API key'

      for (const modelIdCandidate of modelCandidates) {
        const res = await fetch(`${API_BASE}/api/apikeys/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: address, modelId: modelIdCandidate }),
        })

        if (res.ok) {
          data = await res.json()
          break
        }

        try {
          const errData = await res.json()
          lastError = errData.error || lastError
          const isUnsupportedModel =
            typeof errData.error === 'string' &&
            errData.error.includes('is not supported for API key generation')

          if (!isUnsupportedModel) {
            throw new Error(lastError)
          }
        } catch {
          lastError = `HTTP ${res.status}: ${res.statusText || 'Request failed'}`
        }
      }

      if (!data) {
        throw new Error(lastError)
      }

      setApiKey(data.apiKey)
      setHits(data.hits)
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend')
    } finally {
      setIsGenerating(false)
    }
  }, [address, selectedModelId])

  const copyToClipboard = useCallback(() => {
    if (!apiKey) return
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [apiKey])

  const selectedModel = BASE_MODELS.find((m) => m.id === selectedModelId)

  return (
    <div className="ak-page">
      {!isConnected ? (
        /* ─── Auth gate ─── */
        <div className="pub-gate">
          <div className="pub-gate-card">
            <div className="pub-gate-icon"><Shield size={28} /></div>
            <h2>Authentication Required</h2>
            <p>Connect your wallet to generate API credentials. Your wallet address serves as your developer identity.</p>
            <WalletConnectOptions
              className="wallet-options-row wallet-options-row-centered"
              buttonClassName="pub-gate-btn"
              showUnavailableHint
            />
          </div>
        </div>
      ) : (
        <div className="ak-content">
          {/* Header */}
          <div className="ak-header">
            <Key size={22} />
            <div>
              <h1>Developer API Keys</h1>
              <p>Generate API credentials to integrate Synthra AI models into your applications.</p>
            </div>
          </div>

          {/* Security notice */}
          <div className="ak-notice">
            <AlertCircle size={16} />
            <div>
              <strong>Security Notice</strong>
              <p>Your API key is a sensitive credential. Never share it or commit it to version control.</p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="ak-error">
              <AlertCircle size={16} />
              <div>
                <strong>Connection Error</strong>
                <p>{error}</p>
                <p className="ak-error-hint">Make sure the backend is running on {API_BASE}</p>
              </div>
            </div>
          )}

          {/* Model selector */}
          <div className="ak-field">
            <label>Select Model Scope</label>
            <div className="pub-select-wrap">
              <select
                value={selectedModelId}
                onChange={(e) => {
                  setSelectedModelId(e.target.value)
                  setApiKey(null)
                  setHits(0)
                  setError(null)
                }}
              >
                {BASE_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} — {model.cost} ALGO/req
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pub-select-icon" />
            </div>
            <p className="ak-field-hint">The generated key is constrained to the selected model only.</p>
          </div>

          {/* Key display */}
          <div className="ak-key-section">
            <div className="ak-key-header">
              <h3>
                Your API Key
                {apiKey && selectedModel && (
                  <span className="ak-key-scope">{selectedModel.name}</span>
                )}
              </h3>
              {apiKey && (
                <button
                  onClick={() => { setApiKey(null); setHits(0); generateKey() }}
                  className="ak-revoke"
                >
                  <RefreshCw size={13} className={isGenerating ? 'spin' : ''} /> Revoke & Regenerate
                </button>
              )}
            </div>

            {!apiKey ? (
              <div className="ak-generate-area">
                <button onClick={generateKey} disabled={isGenerating} className="ak-generate-btn">
                  <div className="ak-generate-icon">
                    {isGenerating ? <RefreshCw size={28} className="spin" /> : <Key size={28} />}
                  </div>
                  <div>
                    <p className="ak-generate-title">
                      {isGenerating ? 'Generating...' : 'Generate New API Key'}
                    </p>
                    <p className="ak-generate-sub">Requires no transaction fee</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="ak-key-display">
                <div className="ak-key-terminal-bar">
                  <div className="pub-deploy-dots"><i /><i /><i /></div>
                  <Terminal size={12} />
                  <span>credentials.env</span>
                </div>
                <div className="ak-key-value">
                  <code>SYNTHRA_API_KEY={apiKey}</code>
                  <button onClick={copyToClipboard} className={`ak-copy-btn ${copied ? 'copied' : ''}`}>
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Usage stats */}
          {apiKey && (
            <div className="ak-stats">
              <h3>Usage Monitor</h3>
              <div className="ak-stats-grid">
                <div className="ak-stat">
                  <p className="ak-stat-value">{hits}</p>
                  <p className="ak-stat-label">Total Hits</p>
                </div>
                <div className="ak-stat">
                  <p className="ak-stat-value accent">{accruedAlgo.toFixed(6)}</p>
                  <p className="ak-stat-label">ALGO Accrued</p>
                </div>
                <div className="ak-stat">
                  <p className="ak-stat-value purple">{selectedModel?.tokenPrice || 0}</p>
                  <p className="ak-stat-label">ALGO / 1K Tokens</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Start */}
          <div className="ak-quickstart">
            <h3>Quick Start</h3>
            <div className="ak-code-block">
              <div className="ak-code-comment"># OpenAI-compatible chat completions</div>
              <pre>{`curl -X POST ${API_BASE}/api/apikeys/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ]
  }'`}</pre>
            </div>
            <div className="ak-code-block">
              <div className="ak-code-comment"># Check your usage stats</div>
              <pre>{`curl ${API_BASE}/api/apikeys/stats?key=YOUR_API_KEY`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
