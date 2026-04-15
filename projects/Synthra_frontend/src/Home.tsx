import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Moon,
  Sun,
  Zap,
  Shield,
  Globe,
  Code2,
  Wallet,
  ArrowRight,
  Terminal,
  Layers,
  Lock,
  BarChart3,
  GitFork,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  Cpu,
  Gauge,
  RefreshCcw,
  Play,
} from 'lucide-react'
import { usePeraWallet } from './hooks/usePeraWallet'
import { ellipseAddress } from './utils/ellipseAddress'
import WalletConnectOptions from './components/WalletConnectOptions'

/* ─── scroll-reveal hook ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect() } },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, cls: visible ? 'sr-visible' : 'sr-hidden' }
}

/* ─── typewriter hook ─── */
function useTypewriter(lines: string[], speed = 38) {
  const [displayed, setDisplayed] = useState<string[]>([])
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (lineIdx >= lines.length) { setDone(true); return }
    const line = lines[lineIdx]
    if (charIdx <= line.length) {
      const t = setTimeout(() => {
        const current = line.slice(0, charIdx)
        setDisplayed((prev) => {
          const copy = [...prev]
          copy[lineIdx] = current
          return copy
        })
        setCharIdx((c) => c + 1)
      }, speed)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => { setLineIdx((l) => l + 1); setCharIdx(0) }, 420)
      return () => clearTimeout(t)
    }
  }, [lineIdx, charIdx, lines, speed])

  const reset = useCallback(() => {
    setDisplayed([]); setLineIdx(0); setCharIdx(0); setDone(false)
  }, [])

  return { displayed, done, reset }
}

/* ─── data ─── */
const terminalLines = [
  '$ synthra publish --model gpt4-turbo --price 0.002',
  '✓ Endpoint registered  →  https://api.synthra.io/v1/ep-8f39',
  '✓ L402 paywall active  →  0.002 ALGO / request',
  '$ curl -H "Authorization: L402 ..." https://api.synthra.io/v1/ep-8f39',
  '→ 402 Payment Required  |  invoice: lnbc20u1p...',
  '→ Payment verified  ✓  settling on Algorand...',
  '→ {"status":"finalized","txId":"KXDT7...","latency":"1.4s"}',
  '✓ Response streamed. Creator payout: 0.002 ALGO',
]

const metrics = [
  { value: '75K+', label: 'API calls settled', icon: BarChart3 },
  { value: '92%', label: 'Creator retention', icon: RefreshCcw },
  { value: '<2s', label: 'Payment finality', icon: Gauge },
  { value: '0.001', label: 'ALGO avg. fee', icon: Zap },
]

const features = [
  {
    icon: Terminal,
    title: 'Instant API Publishing',
    body: 'Register your model endpoint, set per-request pricing, and go live in under 60 seconds — no backend required.',
  },
  {
    icon: Lock,
    title: 'L402 Payment Gating',
    body: 'Every request passes through an HTTP-native L402 paywall. No subscriptions, no API key abuse — just pay-per-use.',
  },
  {
    icon: Zap,
    title: 'Sub-Second Settlement',
    body: 'Payments settle on Algorand with deterministic finality. Creators see funds in real-time, not end-of-month.',
  },
  {
    icon: Shield,
    title: 'LogicSig Sessions',
    body: 'Delegated LogicSig sessions eliminate repeated wallet prompts while keeping every transaction verifiable on-chain.',
  },
  {
    icon: Wallet,
    title: 'Wallet-Native Identity',
    body: 'No usernames or passwords. Authenticate with Pera Wallet — your identity and payouts are tied to your keys.',
  },
  {
    icon: Globe,
    title: 'Global Model Marketplace',
    body: 'Discover and consume community-published AI endpoints. Compare pricing, latency, and quality in one place.',
  },
]

const workflow = [
  {
    step: '01',
    title: 'Publish your endpoint',
    body: 'Register pricing, metadata, and your payout wallet from the creator dashboard.',
    icon: Code2,
  },
  {
    step: '02',
    title: 'Users pay per request',
    body: 'Synthra enforces L402 payment checks before forwarding any prompt traffic to your model.',
    icon: Layers,
  },
  {
    step: '03',
    title: 'Instant streaming & payout',
    body: 'After on-chain verification, users receive model output and you receive payment — simultaneously.',
    icon: Zap,
  },
]

const techStack = [
  { name: 'Algorand', desc: 'Settlement layer', icon: Cpu },
  { name: 'L402 / x402', desc: 'Payment protocol', icon: Lock },
  { name: 'LogicSig', desc: 'Session delegation', icon: Shield },
  { name: 'Pera Wallet', desc: 'Wallet identity', icon: Wallet },
]

const trustBadges = ['Pera Wallet', 'AlgoKit', 'Nodely', 'Algorand Foundation']

/* ═══════════════════════════════════════════════════ */
export default function Home() {
  const { address, isConnected, disconnect } = usePeraWallet()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('synthra-theme')
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('synthra-theme', theme)
  }, [theme])

  /* scroll reveals */
  const r1 = useReveal()
  const r2 = useReveal()
  const r3 = useReveal()
  const r4 = useReveal()
  const r5 = useReveal()
  const r6 = useReveal()

  /* terminal typewriter */
  const { displayed, done, reset } = useTypewriter(terminalLines, 28)

  return (
    <div className="synthra-page">
      {/* ambient layer */}
      <div className="synthra-bg-grid" />
      <div className="synthra-orb synthra-orb-1" />
      <div className="synthra-orb synthra-orb-2" />
      <div className="synthra-orb synthra-orb-3" />

      {/* ─── NAV ─── */}
      <header className="s-nav">
        <div className="s-nav-inner">
          <Link to="/" className="s-brand">
            <span className="s-logo-mark" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span className="s-brand-name">Synthra</span>
          </Link>

          <nav className="s-links" aria-label="Primary">
            <Link to="/hub">Hub</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/api">API</Link>
            <Link to="/docs">Docs</Link>
            <Link to="/publish">Publish</Link>
          </nav>

          <div className="s-nav-actions">
            <button
              className="s-theme-toggle"
              onClick={() => setTheme((p) => (p === 'light' ? 'dark' : 'light'))}
              aria-label="Toggle theme"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            {isConnected && address ? (
              <>
                <span className="s-wallet-pill">{ellipseAddress(address, 4)}</span>
                <button className="s-btn-ghost" onClick={disconnect}>Disconnect</button>
              </>
            ) : (
              <WalletConnectOptions
                className="wallet-options-row wallet-options-row-inline"
                buttonClassName="s-btn-accent"
              />
            )}
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="s-hero" id="overview">
        <div className="s-hero-content fade-in-up">

          <h1 className="s-hero-title">
            Turn every AI call
            <br />
            into <span className="s-gradient-text">measurable revenue</span>
          </h1>

          <p className="s-hero-subtitle">
            Synthra lets teams publish paid AI endpoints, enforce L402 payment gating,
            and settle usage on Algorand — with wallet-native identity and sub-second finality.
          </p>

          <div className="s-hero-actions">
            <Link className="s-btn-primary" to="/hub">
              Try the Hub <ArrowRight size={16} />
            </Link>
            <Link className="s-btn-secondary" to="/marketplace">
              <Play size={15} /> Marketplace
            </Link>
            <Link className="s-btn-secondary" to="/docs">
              <Code2 size={15} /> Developer Docs
            </Link>
          </div>

          <div className="s-frictionless-badge">
            <Shield size={16} className="s-frictionless-icon" />
            <div className="s-frictionless-text">
              <strong>Frictionless Sessions via LogicSig</strong>
              <span>Sign once and no need to approve wallet popups again and again.</span>
            </div>
          </div>

          <div className="s-offer-chips">
            <span>No-code to API-first</span>
            <span>Transparent per-request pricing</span>
            <span>Wallet-secured payouts</span>
          </div>
        </div>

        {/* ─── LIVE TERMINAL ─── */}
        <div className="s-terminal-wrap fade-in-up delay-2">
          <div className="s-terminal">
            <div className="s-terminal-bar">
              <div className="s-terminal-dots">
                <i /><i /><i />
              </div>
              <span className="s-terminal-title">synthra — live demo</span>
              {done && (
                <button className="s-terminal-replay" onClick={reset} title="Replay">
                  <RefreshCcw size={13} /> Replay
                </button>
              )}
            </div>
            <div className="s-terminal-body">
              {displayed.map((line, i) => (
                <div
                  key={i}
                  className={`s-terminal-line ${
                    line.startsWith('$') ? 'cmd' :
                    line.startsWith('✓') ? 'ok' :
                    line.startsWith('→') ? 'info' : ''
                  }`}
                >
                  {line}
                  {i === displayed.length - 1 && !done && (
                    <span className="s-cursor" />
                  )}
                </div>
              ))}
              {displayed.length === 0 && (
                <div className="s-terminal-line cmd">
                  <span className="s-cursor" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="s-main">
        {/* ─── METRICS ─── */}
        <section ref={r1.ref} className={`s-metrics ${r1.cls}`}>
          {metrics.map((m) => (
            <article key={m.label} className="s-metric-card">
              <m.icon className="s-metric-icon" size={22} />
              <p className="s-metric-value">{m.value}</p>
              <p className="s-metric-label">{m.label}</p>
            </article>
          ))}
        </section>

        {/* ─── TRUST ─── */}
        <section ref={r2.ref} className={`s-trust ${r2.cls}`}>
          <span className="s-trust-label">Trusted by teams building payment-aware AI tools</span>
          <div className="s-trust-logos">
            {trustBadges.map((b) => (
              <span key={b} className="s-trust-badge">{b}</span>
            ))}
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section ref={r3.ref} className={`s-features ${r3.cls}`} id="features">
          <div className="s-section-header">
            <span className="s-section-kicker">Features</span>
            <h2 className="s-section-title">Everything you need to monetize AI</h2>
            <p className="s-section-desc">
              From publishing endpoints to collecting payments — Synthra handles the infrastructure so you can focus on your models.
            </p>
          </div>
          <div className="s-features-grid">
            {features.map((f) => (
              <article key={f.title} className="s-feature-card">
                <div className="s-feature-icon-wrap">
                  <f.icon size={22} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section ref={r4.ref} className={`s-workflow ${r4.cls}`} id="how-it-works">
          <div className="s-section-header">
            <span className="s-section-kicker">How it works</span>
            <h2 className="s-section-title">Three steps to revenue</h2>
            <p className="s-section-desc">
              Publish, gate, and collect — the entire lifecycle is automated.
            </p>
          </div>
          <div className="s-workflow-grid">
            {workflow.map((w, idx) => (
              <article key={w.step} className="s-workflow-card">
                <div className="s-workflow-step-badge">{w.step}</div>
                <div className="s-workflow-icon-wrap">
                  <w.icon size={26} />
                </div>
                <h3>{w.title}</h3>
                <p>{w.body}</p>
                {idx < workflow.length - 1 && (
                  <ChevronRight className="s-workflow-arrow" size={22} />
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ─── TECHNOLOGY ─── */}
        <section ref={r5.ref} className={`s-tech ${r5.cls}`} id="technology">
          <div className="s-tech-inner">
            <div className="s-tech-text">
              <span className="s-section-kicker">Under the hood</span>
              <h2 className="s-section-title">Built on Algorand's AVM</h2>
              <p className="s-section-desc">
                We combine Algorand's instant-finality consensus, LogicSig delegated sessions,
                and the L402 payment protocol to build a trustless monetization layer for AI.
              </p>
            </div>
            <div className="s-tech-grid">
              {techStack.map((t) => (
                <div key={t.name} className="s-tech-card">
                  <t.icon size={24} className="s-tech-card-icon" />
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section ref={r6.ref} className={`s-cta ${r6.cls}`}>
          <div className="s-cta-inner">
            <h2>Ready to monetize your AI models?</h2>
            <p>
              Use the Hub to test base models, browse the marketplace, or publish your own
              agent and start collecting per-request revenue today.
            </p>
            <div className="s-hero-actions">
              <Link className="s-btn-primary" to="/hub">
                Open Hub <ArrowRight size={16} />
              </Link>
              <Link className="s-btn-secondary" to="/marketplace">
                Browse Marketplace
              </Link>
              <Link className="s-btn-secondary" to="/publish">
                Publish Agent
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ─── */}
      <footer className="s-footer">
        <div className="s-footer-inner">
          <div className="s-footer-brand">
            <span className="s-logo-mark" aria-hidden="true"><i /><i /><i /></span>
            <span className="s-brand-name">Synthra</span>
            <p className="s-footer-tagline">Pay-per-use AI infrastructure on Algorand.</p>
          </div>

          <div className="s-footer-col">
            <h4>Product</h4>
            <Link to="/hub">Hub</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/publish">Publish Agent</Link>
            <Link to="/api/keys">API Keys</Link>
          </div>

          <div className="s-footer-col">
            <h4>Resources</h4>
            <Link to="/docs">Developer Docs</Link>
            <Link to="/api">API Marketplace</Link>
            <a href="#features">Features</a>
          </div>

          <div className="s-footer-col">
            <h4>Community</h4>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <GitFork size={14} /> GitHub
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer">
              <MessageCircle size={14} /> Twitter
            </a>
            <a href="https://algorand.co" target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Algorand
            </a>
          </div>
        </div>

        <div className="s-footer-bottom">
          <span>© {new Date().getFullYear()} Synthra. Built on Algorand.</span>
        </div>
      </footer>
    </div>
  )
}
