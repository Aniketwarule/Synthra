import { Link } from 'react-router-dom'
import { Code2, Zap, Key, BookOpen, Cpu, Globe, BarChart3, Lock, ArrowRight } from 'lucide-react'

export default function ApiMarketplace() {
  return (
    <div className="cs-page">
      {/* Coming Soon Hero */}
      <div className="cs-hero">
        <div className="cs-badge">
          <Code2 size={14} /> Coming Soon
        </div>
        <h1 className="cs-title">
          API <span className="s-gradient-text">Marketplace</span>
        </h1>
        <p className="cs-subtitle">
          Market your API endpoints using our SDK, accessible for both humans and autonomous agents.
          Build, publish, and monetize programmatic AI services on Algorand.
        </p>
      </div>

      {/* Feature preview */}
      <div className="cs-features">
        <div className="cs-feature-card">
          <div className="cs-feature-icon"><Cpu size={24} /></div>
          <h3>SDK Integration</h3>
          <p>Publish any REST endpoint using our TypeScript/Python SDK. Automatic L402 paywall and billing.</p>
        </div>
        <div className="cs-feature-card">
          <div className="cs-feature-icon"><Globe size={24} /></div>
          <h3>Agent-to-Agent</h3>
          <p>Enable autonomous agents to discover, pay for, and consume APIs without human intervention.</p>
        </div>
        <div className="cs-feature-card">
          <div className="cs-feature-icon"><BarChart3 size={24} /></div>
          <h3>Usage Analytics</h3>
          <p>Real-time dashboards showing requests, revenue, latency metrics, and consumer insights.</p>
        </div>
        <div className="cs-feature-card">
          <div className="cs-feature-icon"><Lock size={24} /></div>
          <h3>Access Control</h3>
          <p>Fine-grained rate limiting, IP whitelisting, and wallet-based authorization per endpoint.</p>
        </div>
      </div>

      {/* Available now section */}
      <div className="cs-available">
        <h2>Available Now</h2>
        <p>While the full API marketplace is under development, you can already:</p>
        <div className="cs-available-cards">
          <Link to="/api/keys" className="cs-avail-card">
            <Key size={20} />
            <div>
              <h4>Generate API Keys</h4>
              <p>Get API credentials for base models (GPT-4o, Claude, Gemini)</p>
            </div>
            <ArrowRight size={16} />
          </Link>
          <Link to="/docs" className="cs-avail-card">
            <BookOpen size={20} />
            <div>
              <h4>Read the Docs</h4>
              <p>SDK installation guide and API reference for developers</p>
            </div>
            <ArrowRight size={16} />
          </Link>
          <Link to="/hub" className="cs-avail-card">
            <Zap size={20} />
            <div>
              <h4>Try the Hub</h4>
              <p>Chat with base models using L402 payment protocol</p>
            </div>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Waitlist */}
      <div className="cs-waitlist">
        <h3>Get notified when we launch</h3>
        <p>Drop your wallet address to join the early access waitlist.</p>
        <div className="cs-waitlist-form">
          <input type="text" placeholder="Your Algorand wallet address..." className="cs-waitlist-input" />
          <button className="cs-waitlist-btn">
            <Zap size={14} /> Join Waitlist
          </button>
        </div>
      </div>
    </div>
  )
}
