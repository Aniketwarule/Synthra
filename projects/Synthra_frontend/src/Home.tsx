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
  Terminal as TerminalIcon,
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
  CheckCircle2,
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
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, cls: visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8' }
}

/* ─── typewriter hook ─── */
function useTypewriter(lines: string[], speed = 35) {
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
      const t = setTimeout(() => { setLineIdx((l) => l + 1); setCharIdx(0) }, 400)
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
    icon: TerminalIcon,
    title: 'Instant API Publishing',
    body: 'Register your model endpoint, set per-request pricing, and go live in under 60 seconds — no backend required.',
    span: 'md:col-span-2'
  },
  {
    icon: Lock,
    title: 'L402 Payment Gating',
    body: 'Every request passes through an HTTP-native L402 paywall. No subscriptions, no API key abuse — just pay-per-use.',
    span: 'md:col-span-1'
  },
  {
    icon: Zap,
    title: 'Sub-Second Settlement',
    body: 'Payments settle on Algorand with deterministic finality. Creators see funds in real-time, not end-of-month.',
    span: 'md:col-span-1'
  },
  {
    icon: Shield,
    title: 'LogicSig Sessions',
    body: 'Delegated LogicSig sessions eliminate repeated wallet prompts while keeping every transaction verifiable on-chain.',
    span: 'md:col-span-2'
  },
]

const workflow = [
  {
    step: '01',
    title: 'Publish your endpoint',
    body: 'Register pricing, metadata, and your payout wallet from the dashboard.',
    icon: Code2,
  },
  {
    step: '02',
    title: 'Users pay per request',
    body: 'Synthra enforces L402 payment checks before forwarding any traffic.',
    icon: Layers,
  },
  {
    step: '03',
    title: 'Instant streaming & payout',
    body: 'Users receive model output and you receive payment — simultaneously.',
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

  const r1 = useReveal()
  const r2 = useReveal()
  const r3 = useReveal()
  const r4 = useReveal()
  const r5 = useReveal()
  const r6 = useReveal()

  const { displayed, done, reset } = useTypewriter(terminalLines, 30)

  return (
    <div className="min-h-screen bg-[var(--bg-0)] text-[var(--ink-0)] font-sans overflow-x-hidden selection:bg-[var(--accent)] selection:text-white pb-24">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full opacity-30 mix-blend-screen">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[var(--orb-1)] rounded-full blur-[120px]"></div>
          <div className="absolute top-40 -right-40 w-[600px] h-[600px] bg-[var(--orb-2)] rounded-full blur-[120px]"></div>
        </div>
      </div>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4">
        <div className="w-full max-w-6xl bg-[var(--bg-1)]/80 backdrop-blur-xl border border-[var(--nav-border)] rounded-full px-6 py-3 flex items-center justify-between shadow-lg shadow-[var(--bg-0)]/50">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex gap-1 items-end h-5">
              <div className="w-1.5 h-3 bg-[var(--gradient-start)] rounded-full"></div>
              <div className="w-1.5 h-5 bg-[var(--gradient-mid)] rounded-full"></div>
              <div className="w-1.5 h-4 bg-[var(--gradient-end)] rounded-full"></div>
            </div>
            <span className="font-bold text-xl tracking-tight text-[var(--ink-0)]">Synthra</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--ink-2)]">
            <Link to="/hub" className="hover:text-[var(--ink-0)] transition-colors">Hub</Link>
            <Link to="/marketplace" className="hover:text-[var(--ink-0)] transition-colors">Marketplace</Link>
            <Link to="/api" className="hover:text-[var(--ink-0)] transition-colors">API</Link>
            <Link to="/docs" className="hover:text-[var(--ink-0)] transition-colors">Docs</Link>
          </nav>

          <div className="flex items-center gap-4">
            <button
              className="p-2 rounded-full text-[var(--ink-3)] hover:text-[var(--ink-0)] hover:bg-[var(--bg-2)] transition-colors"
              onClick={() => setTheme((p) => (p === 'light' ? 'dark' : 'light'))}
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {isConnected && address ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium px-4 py-1.5 bg-[var(--accent-bg)] text-[var(--accent)] rounded-full border border-[var(--accent-border)] hidden sm:block">
                  {ellipseAddress(address, 4)}
                </span>
                <button onClick={disconnect} className="text-sm font-medium text-[var(--ink-2)] hover:text-red-500 transition-colors">
                  Disconnect
                </button>
              </div>
            ) : (
              <WalletConnectOptions
                className="flex"
                buttonClassName="flex items-center gap-2 bg-[var(--ink-0)] hover:bg-[var(--ink-1)] text-[var(--bg-0)] px-5 py-2 rounded-full text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                compact
              />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 pt-40 px-4">
        {/* HERO */}
        <section className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-bg)] border border-[var(--accent-border)] text-[var(--accent)] text-sm font-semibold mb-8 animate-fade-in slide-up">
            <Shield size={14} /> Frictionless Sessions via LogicSig
          </div>
          
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-8 leading-[1.1] animate-fade-in slide-up animation-delay-100 text-[var(--ink-0)]">
            Turn every AI call <br className="hidden md:block" />
            into <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--gradient-start)] via-[var(--gradient-mid)] to-[var(--gradient-end)]">revenue</span>
          </h1>

          <p className="text-xl md:text-2xl text-[var(--ink-2)] max-w-3xl mx-auto leading-relaxed mb-12 animate-fade-in slide-up animation-delay-200">
            Publish paid AI endpoints, enforce L402 payment gating, and settle usage on Algorand — with wallet-native identity and sub-second finality.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in slide-up animation-delay-300">
            <Link to="/hub" className="w-full sm:w-auto px-8 py-4 bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-1">
              Try the Hub <ArrowRight size={20} />
            </Link>
            <Link to="/docs" className="w-full sm:w-auto px-8 py-4 bg-[var(--bg-1)] hover:bg-[var(--bg-2)] text-[var(--ink-0)] border border-[var(--card-border)] rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all hover:-translate-y-1">
              <Code2 size={20} /> Developer Docs
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mt-12 text-sm font-medium text-[var(--ink-3)] animate-fade-in slide-up animation-delay-400">
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--accent)]" /> No-code to API-first</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--accent)]" /> Transparent pricing</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[var(--accent)]" /> Wallet-secured payouts</span>
          </div>
        </section>

        {/* TERMINAL SHOWCASE */}
        <section className="max-w-4xl mx-auto mt-24">
          <div className="bg-[#0c0e1a] rounded-2xl overflow-hidden shadow-2xl border border-[var(--nav-border)]">
            <div className="bg-[#141828] px-4 py-3 flex items-center justify-between border-b border-[#2a2e4a]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-[#8892b0] text-xs font-mono font-medium">synthra — live demo</span>
              <div className="w-12 flex justify-end">
                {done && (
                  <button onClick={reset} className="text-[#8892b0] hover:text-white transition-colors" title="Replay">
                    <RefreshCcw size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto">
              {displayed.map((line, i) => {
                let colorClass = 'text-[#c8d0e8]'
                if (line.startsWith('$')) colorClass = 'text-[#6b89ff] font-semibold'
                else if (line.startsWith('✓')) colorClass = 'text-[#00ffa3]'
                else if (line.startsWith('→')) colorClass = 'text-[#ffd93d]'

                return (
                  <div key={i} className={`whitespace-pre ${colorClass}`}>
                    {line}
                    {i === displayed.length - 1 && !done && (
                      <span className="inline-block w-2 h-4 bg-[#6b89ff] ml-1 align-middle animate-pulse"></span>
                    )}
                  </div>
                )
              })}
              {displayed.length === 0 && (
                <div className="text-[#c8d0e8]">
                  <span className="inline-block w-2 h-4 bg-[#6b89ff] align-middle animate-pulse"></span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* METRICS */}
        <section ref={r1.ref} className={`max-w-6xl mx-auto mt-32 transition-all duration-700 ${r1.cls}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 text-center hover:-translate-y-1 transition-transform">
                <div className="mx-auto w-12 h-12 bg-[var(--accent-bg)] rounded-xl flex items-center justify-center text-[var(--accent)] mb-4">
                  <m.icon size={24} />
                </div>
                <h3 className="text-3xl font-extrabold text-[var(--ink-0)] mb-1">{m.value}</h3>
                <p className="text-[var(--ink-2)] font-medium">{m.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TRUST */}
        <section ref={r2.ref} className={`max-w-5xl mx-auto mt-32 text-center transition-all duration-700 delay-100 ${r2.cls}`}>
          <p className="text-sm font-bold tracking-widest uppercase text-[var(--ink-3)] mb-8">Trusted by ecosystem leaders</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
            {trustBadges.map((b) => (
              <span key={b} className="text-xl font-bold text-[var(--ink-1)]">{b}</span>
            ))}
          </div>
        </section>

        {/* BENTO FEATURES */}
        <section ref={r3.ref} id="features" className={`max-w-6xl mx-auto mt-32 transition-all duration-700 ${r3.cls}`}>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[var(--ink-0)] mb-6">Everything you need to monetize AI</h2>
            <p className="text-xl text-[var(--ink-2)] max-w-2xl mx-auto">
              From publishing endpoints to collecting payments — Synthra handles the infrastructure so you can focus on your models.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className={`bg-[var(--bg-1)] border border-[var(--card-border)] rounded-3xl p-8 hover:border-[var(--accent-border)] hover:bg-[var(--bg-2)] transition-colors ${f.span}`}>
                <div className="bg-[var(--bg-0)] border border-[var(--card-border)] w-14 h-14 rounded-2xl flex items-center justify-center text-[var(--accent)] mb-6 shadow-sm">
                  <f.icon size={28} />
                </div>
                <h3 className="text-2xl font-bold text-[var(--ink-0)] mb-3">{f.title}</h3>
                <p className="text-lg text-[var(--ink-2)] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* WORKFLOW */}
        <section ref={r4.ref} id="how-it-works" className={`max-w-6xl mx-auto mt-32 bg-[var(--bg-1)] border border-[var(--card-border)] rounded-[3rem] p-12 md:p-20 transition-all duration-700 ${r4.cls}`}>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[var(--ink-0)] mb-6">Three steps to revenue</h2>
            <p className="text-xl text-[var(--ink-2)] max-w-2xl mx-auto">
              Publish, gate, and collect — the entire lifecycle is automated and seamless.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-[var(--accent-border)] via-[var(--accent)] to-[var(--accent-border)] opacity-30"></div>
            {workflow.map((w, idx) => (
              <div key={idx} className="relative z-10 text-center flex flex-col items-center group">
                <div className="w-24 h-24 bg-[var(--bg-0)] border-2 border-[var(--nav-border)] rounded-full flex items-center justify-center text-[var(--accent)] mb-6 shadow-xl group-hover:scale-110 group-hover:border-[var(--accent)] transition-all duration-300">
                  <w.icon size={36} />
                </div>
                <div className="text-sm font-black text-[var(--accent)] mb-2 tracking-widest">STEP {w.step}</div>
                <h3 className="text-2xl font-bold text-[var(--ink-0)] mb-3">{w.title}</h3>
                <p className="text-lg text-[var(--ink-2)]">{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section ref={r6.ref} className={`max-w-5xl mx-auto mt-32 mb-20 transition-all duration-700 ${r6.cls}`}>
          <div className="bg-gradient-to-br from-[var(--bg-1)] to-[var(--accent-bg)] border border-[var(--accent-border)] rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--gradient-end)] opacity-10 blur-[100px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--gradient-start)] opacity-10 blur-[100px] rounded-full pointer-events-none"></div>
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-extrabold text-[var(--ink-0)] mb-8 tracking-tight">Ready to monetize <br/> your AI models?</h2>
              <p className="text-xl text-[var(--ink-1)] max-w-2xl mx-auto mb-12">
                Use the Hub to test base models, browse the marketplace, or publish your own agent and start collecting per-request revenue today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/hub" className="w-full sm:w-auto px-8 py-4 bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl hover:-translate-y-1">
                  Open Hub <ArrowRight size={20} />
                </Link>
                <Link to="/publish" className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-[var(--ink-0)] border border-[var(--card-border)] rounded-2xl font-bold text-lg flex items-center justify-center transition-all hover:-translate-y-1">
                  Publish Agent
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[var(--nav-border)] bg-[var(--bg-1)] pt-20 pb-10 mt-20 relative z-10">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <div className="flex gap-1 items-end h-5">
                <div className="w-1.5 h-3 bg-[var(--gradient-start)] rounded-full"></div>
                <div className="w-1.5 h-5 bg-[var(--gradient-mid)] rounded-full"></div>
                <div className="w-1.5 h-4 bg-[var(--gradient-end)] rounded-full"></div>
              </div>
              <span className="font-bold text-2xl tracking-tight text-[var(--ink-0)]">Synthra</span>
            </Link>
            <p className="text-[var(--ink-2)] leading-relaxed">
              Pay-per-use AI infrastructure on Algorand. Turn your models into unstoppable revenue streams.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-[var(--ink-0)] mb-6 tracking-wide">Product</h4>
            <div className="flex flex-col gap-4 text-[var(--ink-2)] font-medium">
              <Link to="/hub" className="hover:text-[var(--accent)] transition-colors w-fit">Hub</Link>
              <Link to="/marketplace" className="hover:text-[var(--accent)] transition-colors w-fit">Marketplace</Link>
              <Link to="/publish" className="hover:text-[var(--accent)] transition-colors w-fit">Publish Agent</Link>
              <Link to="/api/keys" className="hover:text-[var(--accent)] transition-colors w-fit">API Keys</Link>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-[var(--ink-0)] mb-6 tracking-wide">Resources</h4>
            <div className="flex flex-col gap-4 text-[var(--ink-2)] font-medium">
              <Link to="/docs" className="hover:text-[var(--accent)] transition-colors w-fit">Developer Docs</Link>
              <Link to="/api" className="hover:text-[var(--accent)] transition-colors w-fit">API Marketplace</Link>
              <a href="#features" className="hover:text-[var(--accent)] transition-colors w-fit">Features</a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-[var(--ink-0)] mb-6 tracking-wide">Community</h4>
            <div className="flex flex-col gap-4 text-[var(--ink-2)] font-medium">
              <a href="#" className="flex items-center gap-2 hover:text-[var(--accent)] transition-colors w-fit"><GitFork size={18} /> GitHub</a>
              <a href="#" className="flex items-center gap-2 hover:text-[var(--accent)] transition-colors w-fit"><MessageCircle size={18} /> Twitter</a>
              <a href="#" className="flex items-center gap-2 hover:text-[var(--accent)] transition-colors w-fit"><ExternalLink size={18} /> Algorand</a>
            </div>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto px-6 border-t border-[var(--nav-border)] pt-8 text-center text-[var(--ink-3)] text-sm font-medium">
          © {new Date().getFullYear()} Synthra. Built on Algorand.
        </div>
      </footer>
    </div>
  )
}
