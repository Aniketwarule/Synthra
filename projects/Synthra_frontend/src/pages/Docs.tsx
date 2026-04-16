import { useState } from 'react'
import { BookOpen, Terminal, Key, Code2, Zap, Shield, Copy, Check, ChevronRight } from 'lucide-react'

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://synthra-x0z1.onrender.com'

interface DocSection {
  id: string
  label: string
  icon: typeof BookOpen
}

const SECTIONS: DocSection[] = [
  { id: 'quickstart', label: 'Quick Start', icon: Zap },
  { id: 'installation', label: 'SDK Installation', icon: Terminal },
  { id: 'authentication', label: 'Authentication', icon: Shield },
  { id: 'api-reference', label: 'API Reference', icon: Code2 },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'agents', label: 'For Agents', icon: BookOpen },
]

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="doc-code">
      <div className="doc-code-header">
        <span>{lang}</span>
        <button onClick={copy} className="doc-code-copy">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState('quickstart')

  return (
    <div className="doc-page">
      {/* Sidebar */}
      <aside className="doc-sidebar">
        <div className="doc-sidebar-title">
          <BookOpen size={16} /> Documentation
        </div>
        <nav className="doc-sidebar-nav">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`doc-nav-item ${activeSection === s.id ? 'active' : ''}`}
            >
              <s.icon size={15} />
              <span>{s.label}</span>
              <ChevronRight size={12} className="doc-nav-arrow" />
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="doc-content">
        {activeSection === 'quickstart' && (
          <section>
            <h1>Quick Start</h1>
            <p className="doc-lead">
              Get up and running with Synthra in under 5 minutes. Generate an API key,
              install the SDK, and make your first paid AI request.
            </p>

            <h2>1. Connect Your Wallet</h2>
            <p>
              Navigate to <code>/api/keys</code> and connect your Pera Wallet.
              Your wallet address serves as your identity on the platform.
            </p>

            <h2>2. Generate an API Key</h2>
            <p>
              Select a base model (GPT-4o, Claude, Gemini) and generate an API key.
              Each key is scoped to a specific model.
            </p>

            <h2>3. Make Your First Request</h2>
            <CodeBlock
              lang="bash"
              code={`curl -X POST ${API_BASE}/api/apikeys/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Hello from Synthra!"}
    ]
  }'`}
            />

            <h2>4. Check Usage</h2>
            <CodeBlock
              lang="bash"
              code={`curl ${API_BASE}/api/apikeys/stats?key=YOUR_API_KEY`}
            />

            <div className="doc-callout">
              <Zap size={16} />
              <div>
                <strong>Pay-per-use billing</strong>
                <p>Each request costs a small amount of ALGO. Funds are settled on Algorand with sub-second finality.</p>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'installation' && (
          <section>
            <h1>SDK Installation</h1>
            <p className="doc-lead">
              Install the Synthra SDK to integrate AI endpoints into your application.
            </p>

            <h2>JavaScript / TypeScript</h2>
            <CodeBlock lang="bash" code="npm install @synthra/sdk" />

            <h3>Usage</h3>
            <CodeBlock
              lang="typescript"
              code={`import { SynthraClient } from '@synthra/sdk'

const client = new SynthraClient({
  apiKey: process.env.SYNTHRA_API_KEY,
  network: 'mainnet', // or 'testnet'
})

// Chat completions (OpenAI-compatible)
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Explain Algorand consensus' }
  ],
})

console.log(response.choices[0].message.content)`}
            />

            <h2>Python</h2>
            <CodeBlock lang="bash" code="pip install synthra" />

            <h3>Usage</h3>
            <CodeBlock
              lang="python"
              code={`from synthra import SynthraClient

client = SynthraClient(api_key="YOUR_API_KEY")

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Explain Algorand consensus"}
    ],
)

print(response.choices[0].message.content)`}
            />

            <div className="doc-callout info">
              <Shield size={16} />
              <div>
                <strong>Security Note</strong>
                <p>Never commit your API key to version control. Use environment variables instead.</p>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'authentication' && (
          <section>
            <h1>Authentication</h1>
            <p className="doc-lead">
              Synthra uses the L402 payment protocol for authentication and billing.
              Here's how it works under the hood.
            </p>

            <h2>How L402 Works</h2>
            <ol className="doc-steps">
              <li>
                <strong>Request</strong> &mdash; Client sends an API request with an API key
              </li>
              <li>
                <strong>402 Response</strong> &mdash; Server returns a payment invoice (amount in ALGO)
              </li>
              <li>
                <strong>Payment</strong> &mdash; Client pays the invoice on Algorand
              </li>
              <li>
                <strong>Proof</strong> &mdash; Client includes the transaction proof in a retry
              </li>
              <li>
                <strong>Response</strong> &mdash; Server verifies payment and returns the AI response
              </li>
            </ol>

            <h2>Bearer Token Auth</h2>
            <p>For simplified access, use your API key as a Bearer token:</p>
            <CodeBlock
              lang="bash"
              code={`curl -H "Authorization: Bearer YOUR_API_KEY" \\
  ${API_BASE}/api/apikeys/chat`}
            />

            <h2>LogicSig Sessions</h2>
            <p>
              For high-frequency use, Synthra supports LogicSig delegated sessions.
              These reduce repeated wallet prompts while keeping every payment verifiable on-chain.
            </p>

            <div className="doc-callout">
              <Shield size={16} />
              <div>
                <strong>Wallet-Native Identity</strong>
                <p>Your Algorand wallet address is your identity. No usernames, no passwords, no accounts to manage.</p>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'api-reference' && (
          <section>
            <h1>API Reference</h1>
            <p className="doc-lead">
              Complete reference for Synthra's REST API endpoints.
            </p>

            <h2>Base URL</h2>
            <CodeBlock lang="text" code={API_BASE} />

            <h2>Chat Completions</h2>
            <div className="doc-endpoint">
              <span className="doc-method post">POST</span>
              <code>/api/apikeys/chat</code>
            </div>
            <p>OpenAI-compatible chat completions endpoint.</p>

            <h3>Request Body</h3>
            <CodeBlock
              lang="json"
              code={`{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant"},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1024
}`}
            />

            <h3>Response</h3>
            <CodeBlock
              lang="json"
              code={`{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      }
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 8,
    "total_tokens": 20,
    "cost_algo": 0.001
  }
}`}
            />

            <h2>Simple Prompt</h2>
            <div className="doc-endpoint">
              <span className="doc-method post">POST</span>
              <code>/api/apikeys/hit</code>
            </div>
            <CodeBlock
              lang="json"
              code={`{
  "prompt": "What is the capital of France?"
}`}
            />

            <h2>Usage Stats</h2>
            <div className="doc-endpoint">
              <span className="doc-method get">GET</span>
              <code>/api/apikeys/stats?key=YOUR_API_KEY</code>
            </div>
          </section>
        )}

        {activeSection === 'api-keys' && (
          <section>
            <h1>API Keys</h1>
            <p className="doc-lead">
              Each API key is scoped to a specific model and tied to your wallet address.
            </p>

            <h2>Generating a Key</h2>
            <ol className="doc-steps">
              <li>Navigate to <code>/api/keys</code></li>
              <li>Connect your Pera Wallet</li>
              <li>Select a model from the dropdown</li>
              <li>Click "Generate New API Key"</li>
            </ol>

            <h2>Key Properties</h2>
            <div className="doc-table-wrap">
              <table className="doc-table">
                <thead>
                  <tr><th>Property</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr><td>Scope</td><td>Each key is bound to one model</td></tr>
                  <tr><td>Billing</td><td>Usage is billed per request in ALGO</td></tr>
                  <tr><td>Revocation</td><td>You can revoke and regenerate keys at any time</td></tr>
                  <tr><td>Limits</td><td>No hard rate limits — pay as you go</td></tr>
                </tbody>
              </table>
            </div>

            <h2>Environment Variable</h2>
            <CodeBlock lang="bash" code='export SYNTHRA_API_KEY="your_key_here"' />
          </section>
        )}

        {activeSection === 'agents' && (
          <section>
            <h1>For Autonomous Agents</h1>
            <p className="doc-lead">
              Synthra is designed for both human developers and autonomous AI agents.
              Here's how to integrate agent-to-agent API calls.
            </p>

            <h2>Agent Flow</h2>
            <ol className="doc-steps">
              <li>Your agent generates an API key via wallet signature</li>
              <li>Agent sends requests to Synthra endpoints</li>
              <li>L402 payment settles automatically via pre-funded wallet</li>
              <li>Agent receives AI responses for downstream tasks</li>
            </ol>

            <h2>Example: Agent-to-Agent Call</h2>
            <CodeBlock
              lang="typescript"
              code={`import { SynthraClient } from '@synthra/sdk'

const agent = new SynthraClient({
  apiKey: process.env.SYNTHRA_API_KEY,
  autoPayment: true, // Automatically handle L402 payments
})

// Autonomous agent calling another AI agent
const analysis = await agent.chat.completions.create({
  model: 'sc-auditor-alice', // Community agent
  messages: [
    {
      role: 'user',
      content: 'Audit this TEAL contract: ' + contractSource
    }
  ],
})

// Use the result in your pipeline
processAuditResults(analysis.choices[0].message.content)`}
            />

            <div className="doc-callout">
              <Zap size={16} />
              <div>
                <strong>API Marketplace (Coming Soon)</strong>
                <p>
                  The full API marketplace with SDK-based publishing will let agents discover
                  and consume services autonomously. Join the waitlist at <code>/api</code>.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
