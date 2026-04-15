import { useState, useCallback, type FormEvent } from 'react'
import {
  Zap,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Lock,
  Cpu,
  Shield,
  Terminal,
  ArrowLeft,
  RefreshCcw,
} from 'lucide-react'
import { usePeraWallet } from '../hooks/usePeraWallet'
import { ellipseAddress } from '../utils/ellipseAddress'
import ApiService from '../utils/apiservice'
import WalletConnectOptions from '../components/WalletConnectOptions'

interface AgentFormState {
  name: string
  description: string
  hostingType: 'internal' | 'external'
  baseModel: string
  systemPrompt: string
  endpointUrl: string
  priceAlgo: number
  APIkey: string
}

interface DeployLog {
  id: string
  message: string
  status: 'PENDING' | 'OK' | 'FAIL' | 'INFO'
}

type DeployPhase = 'idle' | 'deploying' | 'success' | 'error'

const BASE_MODEL_OPTIONS = [
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
] as const

const INITIAL_FORM: AgentFormState = {
  name: '',
  description: '',
  hostingType: 'internal',
  baseModel: '',
  systemPrompt: '',
  endpointUrl: '',
  priceAlgo: 0.1,
  APIkey: '',
}

function StatusBadge({ status }: { status: DeployLog['status'] }) {
  const cls =
    status === 'OK' ? 'pub-badge-ok' :
    status === 'PENDING' ? 'pub-badge-pending' :
    status === 'FAIL' ? 'pub-badge-fail' : 'pub-badge-info'
  return <span className={`pub-badge ${cls}`}>[{status}]</span>
}

export default function Publish() {
  const { address, isConnected } = usePeraWallet()
  const [form, setForm] = useState<AgentFormState>(INITIAL_FORM)
  const [phase, setPhase] = useState<DeployPhase>('idle')
  const [logs, setLogs] = useState<DeployLog[]>([])

  const updateField = useCallback(
    <K extends keyof AgentFormState>(key: K, value: AgentFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const pushLog = useCallback((message: string, status: DeployLog['status']) => {
    const entry: DeployLog = { id: `dl-${Date.now()}-${Math.random()}`, message, status }
    setLogs((prev) => [...prev, entry])
    return entry.id
  }, [])

  const patchLog = useCallback((id: string, updates: Partial<DeployLog>) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)))
  }, [])

  const handleDeploy = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!address || !form.name) return
      if (form.hostingType === 'internal' && (!form.baseModel || !form.systemPrompt)) return
      if (form.hostingType === 'external' && !form.endpointUrl) return

      setPhase('deploying')
      setLogs([])

      const payload = { ...form, creatorWallet: address }

      const v = pushLog('Validating agent configuration...', 'PENDING')
      await sleep(400)
      patchLog(v, { status: 'OK', message: 'Configuration valid' })
      const reg = pushLog('POST /api/agents/create — pushing to registry...', 'PENDING')

      try {
        await ApiService.publishAgent(payload)
        patchLog(reg, { status: 'OK', message: 'Agent saved successfully' })
        pushLog(`Agent "${form.name}" is now live!`, 'INFO')
        setPhase('success')
      } catch (err: any) {
        patchLog(reg, { status: 'FAIL', message: `Deployment failed: ${err.message}` })
        setPhase('error')
      }
    },
    [address, form, pushLog, patchLog],
  )

  const isFormValid =
    form.name.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.priceAlgo > 0 &&
    (form.hostingType === 'internal'
      ? form.baseModel.length > 0 && form.systemPrompt.trim().length > 0
      : form.endpointUrl.trim().length > 0)

  return (
    <div className="pub-page">
      {!isConnected ? (
        /* ─── Not Connected ─── */
        <div className="pub-gate">
          <div className="pub-gate-card">
            <div className="pub-gate-icon"><AlertTriangle size={28} /></div>
            <h2>Wallet Required</h2>
            <p>Choose a wallet provider to publish an AI agent. Your wallet address serves as your creator identity.</p>
            <WalletConnectOptions
              className="wallet-options-row wallet-options-row-centered"
              buttonClassName="pub-gate-btn"
              showUnavailableHint
            />
          </div>
        </div>
      ) : phase === 'deploying' || phase === 'success' || phase === 'error' ? (
        /* ─── Deploy Output ─── */
        <div className="pub-deploy">
          <div className="pub-deploy-terminal">
            <div className="pub-deploy-bar">
              <div className="pub-deploy-dots"><i /><i /><i /></div>
              <span>~/synthra/deploy</span>
            </div>
            <div className="pub-deploy-body">
              {logs.map((log) => (
                <div key={log.id} className="pub-deploy-line">
                  <span className="pub-deploy-prefix">&gt;</span>
                  <span className={log.status === 'FAIL' ? 'pub-deploy-fail' : ''}>{log.message}</span>
                  <StatusBadge status={log.status} />
                </div>
              ))}
              {phase === 'deploying' && (
                <div className="pub-deploy-line">
                  <span className="pub-deploy-prefix">&gt;</span>
                  <span className="pub-deploy-cursor" />
                </div>
              )}
            </div>
          </div>

          <div className="pub-deploy-actions">
            {phase === 'success' && (
              <>
                <CheckCircle2 size={20} className="pub-success-icon" />
                <button onClick={() => { setPhase('idle'); setLogs([]); setForm(INITIAL_FORM) }} className="pub-action-btn primary">
                  <Rocket size={15} /> Deploy Another
                </button>
              </>
            )}
            {phase === 'error' && (
              <button onClick={() => { setPhase('idle'); setLogs([]) }} className="pub-action-btn">
                <RefreshCcw size={15} /> Retry
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ─── Publishing Form ─── */
        <form onSubmit={handleDeploy} className="pub-form">
          <div className="pub-form-header">
            <Rocket size={22} />
            <div>
              <h1>Publish Your AI Agent</h1>
              <p>Register a custom AI agent to the Creator Marketplace</p>
            </div>
          </div>

          {/* Name */}
          <div className="pub-field">
            <label>
              <span>Agent Name</span>
              <span className="pub-field-count">{form.name.length}/30</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value.slice(0, 30))}
              placeholder="e.g. Smart Contract Auditor"
            />
          </div>

          {/* Description */}
          <div className="pub-field">
            <label>
              <span>Description</span>
              <span className="pub-field-count">{form.description.length}/100</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value.slice(0, 100))}
              placeholder="Short description of what your agent does"
            />
          </div>

          {/* Hosting Type */}
          <div className="pub-field">
            <label><span>Hosting Architecture</span></label>
            <div className="pub-toggle-group">
              <button
                type="button"
                onClick={() => updateField('hostingType', 'internal')}
                className={`pub-toggle ${form.hostingType === 'internal' ? 'active' : ''}`}
              >
                Hosted by Synthra
              </button>
              <button
                type="button"
                onClick={() => updateField('hostingType', 'external')}
                className={`pub-toggle ${form.hostingType === 'external' ? 'active external' : ''}`}
              >
                Externally Hosted
              </button>
            </div>
          </div>

          {form.hostingType === 'internal' ? (
            <>
              {/* Base Model */}
              <div className="pub-field">
                <label><span>Base Model Engine</span></label>
                <div className="pub-select-wrap">
                  <select
                    value={form.baseModel}
                    onChange={(e) => updateField('baseModel', e.target.value)}
                  >
                    <option value="" disabled>Select engine...</option>
                    {BASE_MODEL_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pub-select-icon" />
                </div>
              </div>

              {/* API Key */}
              <div className="pub-field">
                <label><span>Your API Key</span></label>
                <input
                  type="text"
                  value={form.APIkey}
                  onChange={(e) => updateField('APIkey', e.target.value)}
                  placeholder="Enter your model provider API key"
                />
              </div>

              {/* System Prompt */}
              <div className="pub-field">
                <label><span>System Prompt</span></label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => updateField('systemPrompt', e.target.value)}
                  placeholder="You are an expert smart contract auditor. Analyze the following code..."
                  rows={5}
                />
                <div className="pub-field-hint">
                  <Lock size={12} />
                  <span>Your system prompt is encrypted and never exposed to clients.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="pub-field">
              <label><span>Endpoint URL</span></label>
              <input
                type="url"
                value={form.endpointUrl}
                onChange={(e) => updateField('endpointUrl', e.target.value)}
                placeholder="https://api.yourdomain.com/v1/run"
              />
              <div className="pub-field-hint">
                <Shield size={12} />
                <span>Synthra acts as an L402 payment proxy to this URL.</span>
              </div>
            </div>
          )}

          {/* Price */}
          <div className="pub-field">
            <label><span>Price per Request (ALGO)</span></label>
            <div className="pub-price-row">
              <input
                type="number"
                value={form.priceAlgo}
                onChange={(e) => updateField('priceAlgo', Math.max(0, parseFloat(e.target.value) || 0))}
                step={0.1}
                min={0.01}
                className="pub-price-input"
              />
              <span className="pub-price-label">
                Users pay <strong>{form.priceAlgo}</strong> ALGO per prompt
              </span>
            </div>
          </div>

          {/* Creator identity */}
          <div className="pub-identity">
            <Cpu size={14} />
            <span>Creator Identity:</span>
            <span className="pub-identity-addr">{ellipseAddress(address, 8)}</span>
            <span className="pub-identity-note">Payments route to this address</span>
          </div>

          {/* Submit */}
          <button type="submit" disabled={!isFormValid} className="pub-submit">
            <Rocket size={16} /> Deploy Agent
          </button>

          {/* Preview */}
          {isFormValid && (
            <div className="pub-preview">
              <p className="pub-preview-title">Deploy Preview</p>
              <p>&gt; name: <strong>{form.name}</strong></p>
              {form.hostingType === 'internal' ? (
                <p>&gt; engine: <strong>{BASE_MODEL_OPTIONS.find((m) => m.id === form.baseModel)?.name}</strong></p>
              ) : (
                <p>&gt; endpoint: <strong>{form.endpointUrl}</strong></p>
              )}
              <p>&gt; price: <strong className="pub-preview-price">{form.priceAlgo} ALGO</strong></p>
              <p>&gt; creator: <strong className="pub-preview-price">{ellipseAddress(address, 6)}</strong></p>
            </div>
          )}
        </form>
      )}
    </div>
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
