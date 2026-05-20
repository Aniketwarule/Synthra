import { useState } from 'react';
import { BookOpen, Terminal, Key, Code2, Zap, Shield, Copy, Check, ChevronRight, Globe, Code } from 'lucide-react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

interface DocSection {
  id: string;
  label: string;
  icon: typeof BookOpen;
}

const SECTIONS: DocSection[] = [
  { id: 'quickstart', label: 'Quick Start', icon: Zap },
  { id: 'installation', label: 'SDK Installation', icon: Terminal },
  { id: 'authentication', label: 'Authentication', icon: Shield },
  { id: 'marketplace', label: 'API Marketplace', icon: Globe },
  { id: 'api-reference', label: 'REST API', icon: Code2 },
  { id: 'api-keys', label: 'API Keys', icon: Key },
];

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="relative group rounded-xl overflow-hidden my-6 border border-[var(--terminal-bg)] bg-[var(--terminal-bg)] shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--terminal-surface)] border-b border-[var(--terminal-dim)] text-xs text-[var(--terminal-text)] font-mono">
        <span className="flex items-center gap-2"><Code size={14} className="text-[var(--terminal-blue)]" /> {lang}</span>
        <button 
          onClick={copy} 
          className="flex items-center gap-1.5 hover:text-white transition-colors p-1 rounded-md hover:bg-[var(--terminal-dim)]"
        >
          {copied ? <Check size={14} className="text-[var(--terminal-green)]" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-sm font-mono text-[var(--terminal-text)] leading-relaxed bg-[var(--terminal-bg)]">
        <pre><code>{code}</code></pre>
      </div>
    </div>
  );
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState('quickstart');

  return (
    <div className="min-h-screen bg-[var(--bg-0)] text-[var(--ink-0)] flex">
      {/* Sidebar Navigation */}
      <aside className="w-72 fixed h-[calc(100vh-6rem)] overflow-y-auto border-r border-[var(--nav-border)] bg-[var(--bg-1)] py-8 px-6 hidden md:block">
        <div className="flex items-center gap-3 text-lg font-bold text-[var(--ink-0)] mb-8 px-2">
          <BookOpen size={20} className="text-[var(--accent)]" /> 
          Documentation
        </div>
        <nav className="space-y-1">
          {SECTIONS.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-medium shadow-inner border border-[var(--accent-border)]' 
                    : 'text-[var(--ink-2)] hover:text-[var(--ink-0)] hover:bg-[var(--bg-2)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <s.icon size={18} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'} />
                  <span>{s.label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="text-[var(--accent)]" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-72 max-w-4xl mx-auto px-6 md:px-12 py-8 pb-24">
        
        {activeSection === 'quickstart' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold text-[var(--ink-0)] mb-4 tracking-tight">Quick Start</h1>
            <p className="text-lg text-[var(--ink-2)] mb-10 leading-relaxed">
              Get up and running with Synthra in under 5 minutes. Use our API SDK to seamlessly consume premium AI and Marketplace APIs with autonomous Algorand payments.
            </p>

            <div className="space-y-12">
              <div className="relative pl-8 border-l-2 border-[var(--nav-border)]">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-0)]"></div>
                <h2 className="text-2xl font-bold text-[var(--ink-0)] mb-3">1. Connect Your Wallet</h2>
                <p className="text-[var(--ink-2)] leading-relaxed">
                  Navigate to the <span className="text-[var(--accent)] bg-[var(--accent-bg)] px-2 py-0.5 rounded border border-[var(--accent-border)]">/api/keys</span> dashboard and connect your Pera or Defly Wallet. Your wallet address is your native identity on the platform.
                </p>
              </div>

              <div className="relative pl-8 border-l-2 border-[var(--nav-border)]">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-0)]"></div>
                <h2 className="text-2xl font-bold text-[var(--ink-0)] mb-3">2. Install the SDK</h2>
                <CodeBlock lang="bash" code="npm install synthra-x402 algosdk" />
              </div>

              <div className="relative pl-8 border-l-2 border-transparent">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-0)]"></div>
                <h2 className="text-2xl font-bold text-[var(--ink-0)] mb-3">3. Make a Request</h2>
                <CodeBlock
                  lang="typescript"
                  code={`import { createSynthraClient } from 'synthra-x402/client';

const client = createSynthraClient({
  network: 'testnet',
  payTo: 'ENDPOINT_CREATOR_WALLET',
  priceUsdc: 0.10,
  signer: myWalletSigner // Use @txnlab/use-wallet for browsers
});

const response = await client.fetch('https://api.synthra.io/premium');
console.log(await response.json());`}
                />
              </div>
            </div>

            <div className="mt-12 bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 flex items-start gap-4 shadow-sm">
              <div className="bg-[var(--accent-bg)] p-3 rounded-full mt-1 border border-[var(--accent-border)]">
                <Zap size={20} className="text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="text-[var(--ink-0)] font-bold text-lg mb-1">Pay-per-use L402 Billing</h3>
                <p className="text-[var(--ink-2)] leading-relaxed">
                  The SDK automatically handles purchasing a "Macaroon" token via your wallet on the first request. Subsequent requests automatically decrement your token balance off-chain with zero latency.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'marketplace' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold text-[var(--ink-0)] mb-4 tracking-tight">API Marketplace</h1>
            <p className="text-lg text-[var(--ink-2)] mb-10 leading-relaxed">
              Synthra's API Marketplace allows human developers and autonomous AI agents to consume premium APIs using prepaid USDC tokens via the x402 protocol.
            </p>

            <h2 className="text-2xl font-bold text-[var(--ink-0)] mt-12 mb-4 border-b border-[var(--nav-border)] pb-2">For Human Developers (Browser)</h2>
            <p className="text-[var(--ink-2)] mb-6">If you are building a web UI, the SDK integrates seamlessly with your wallet provider to prompt the user for payment approval.</p>
            <CodeBlock
              lang="typescript"
              code={`import { createSynthraClient } from 'synthra-x402/client'
import { useWallet } from '@txnlab/use-wallet'

const { activeAccount, signTransactions } = useWallet();

const client = createSynthraClient({
  network: 'testnet',
  payTo: 'MARKETPLACE_ENDPOINT_WALLET',
  priceUsdc: 0.50,
  signer: {
    address: activeAccount.address,
    signTransactions: async (txns, idx) => signTransactions(txns, idx)
  }
})

// The SDK handles the 402 payment flow automatically!
const response = await client.fetch('https://oracle.synthra.io/prices')
const data = await response.json()`}
            />

            <h2 className="text-2xl font-bold text-[var(--ink-0)] mt-12 mb-4 border-b border-[var(--nav-border)] pb-2">For Autonomous Agents (Node.js)</h2>
            <p className="text-[var(--ink-2)] mb-6">
              AI Agents can consume APIs entirely autonomously without human intervention by signing the USDC payment with their own private key.
            </p>
            <CodeBlock
              lang="typescript"
              code={`import { createSynthraClient } from 'synthra-x402/client'
import algosdk from 'algosdk'

const secretKey = Buffer.from(process.env.AGENT_PRIVATE_KEY, "base64");
const address = algosdk.encodeAddress(secretKey.slice(32));

const agentClient = createSynthraClient({
  network: 'testnet',
  payTo: 'MARKETPLACE_ENDPOINT_WALLET',
  priceUsdc: 0.50,
  signer: {
    address,
    signTransactions: async (txns, idx) => {
      // Agent autonomously signs the payment!
      return txns.map((t) => algosdk.signTransaction(algosdk.decodeUnsignedTransaction(t), secretKey).blob);
    }
  }
})

const response = await agentClient.fetch('https://oracle.synthra.io/prices')`}
            />

            <div className="mt-12 bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 flex items-start gap-4">
              <Globe size={24} className="text-[var(--gradient-mid)] shrink-0 mt-1" />
              <div>
                <h3 className="text-[var(--ink-0)] font-bold text-lg mb-1">Publishing your own API</h3>
                <p className="text-[var(--ink-2)] leading-relaxed mb-4">
                  You can easily protect and monetize your own Express.js endpoints using our Server SDK.
                </p>
                <CodeBlock lang="typescript" code={`import { synthraApiAuth } from 'synthra-x402/server';
import express from 'express';

const app = express();
app.use('/api/premium', synthraApiAuth({
  network: 'testnet',
  priceUsdc: 0.25,
  payTo: 'YOUR_WALLET_ADDRESS'
}));`} />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'installation' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold text-[var(--ink-0)] mb-4 tracking-tight">SDK Installation</h1>
            <p className="text-lg text-[var(--ink-2)] mb-10 leading-relaxed">
              The official <code className="bg-[var(--bg-2)] px-1.5 py-0.5 rounded text-[var(--ink-1)]">synthra-x402</code> SDK is available on npm. It works in both Browser and Node.js environments.
            </p>
            <CodeBlock lang="bash" code="npm install synthra-x402" />
            <h2 className="text-2xl font-bold text-[var(--ink-0)] mt-12 mb-4 border-b border-[var(--nav-border)] pb-2">Requirements</h2>
            <ul className="list-disc pl-6 text-[var(--ink-2)] space-y-2">
              <li>Node.js 18 or higher (if running on server)</li>
              <li>An Algorand wallet provider (if running in browser)</li>
              <li>The <code className="bg-[var(--bg-2)] px-1.5 py-0.5 rounded text-[var(--ink-1)]">algosdk</code> package for transaction signing</li>
            </ul>
          </div>
        )}

        {activeSection === 'authentication' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold text-[var(--ink-0)] mb-4 tracking-tight">Authentication (x402)</h1>
            <p className="text-lg text-[var(--ink-2)] mb-10 leading-relaxed">
              Synthra does not use traditional API keys for marketplace endpoints. Instead, it uses the <strong>x402-avm</strong> protocol, which is an Algorand-native implementation of L402.
            </p>
            <div className="bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-6 mb-8">
              <h3 className="text-[var(--ink-0)] font-bold text-lg mb-2">How it Works</h3>
              <ol className="list-decimal pl-5 text-[var(--ink-2)] space-y-3">
                <li>Your client makes a request to a protected endpoint.</li>
                <li>The server intercepts it and returns a <code className="bg-[var(--bg-2)] px-1.5 py-0.5 rounded text-[var(--ink-1)]">402 Payment Required</code> status along with an invoice and an incomplete Macaroon.</li>
                <li>The SDK automatically prompts your wallet (or uses your agent's private key) to sign a USDC payment transaction on Algorand.</li>
                <li>The transaction is broadcasted to the network.</li>
                <li>The server verifies the payment, completes the Macaroon, and fulfills the original request.</li>
              </ol>
            </div>
            <p className="text-[var(--ink-2)]">
              The beauty of this is that the <code className="bg-[var(--bg-2)] px-1.5 py-0.5 rounded text-[var(--ink-1)]">synthra-x402/client</code> SDK handles this entire negotiation under the hood. You simply call <code className="bg-[var(--bg-2)] px-1.5 py-0.5 rounded text-[var(--ink-1)]">client.fetch()</code> and wait for your data!
            </p>
          </div>
        )}

        {activeSection === 'api-keys' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold text-[var(--ink-0)] mb-4 tracking-tight">Base Model API Keys</h1>
            <p className="text-lg text-[var(--ink-2)] mb-10 leading-relaxed">
              While marketplace endpoints use x402 Macaroons, our core Base Models (e.g., Llama 3, GPT-4 proxies) use traditional API Keys that are tied to your wallet address.
            </p>
            <div className="bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-2xl p-6 mb-8 shadow-sm">
              <h3 className="text-[var(--ink-0)] font-bold text-lg mb-2">Generating Keys</h3>
              <p className="text-[var(--ink-2)]">
                You can generate API keys by navigating to the <strong>API Keys</strong> tab in the navigation bar. You must sign a message with your wallet to authenticate.
              </p>
            </div>
            <h2 className="text-2xl font-bold text-[var(--ink-0)] mt-12 mb-4 border-b border-[var(--nav-border)] pb-2">Usage</h2>
            <CodeBlock lang="bash" code={`curl -X POST https://api.synthra.io/v1/chat/completions \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`} />
          </div>
        )}

        {activeSection === 'api-reference' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold text-[var(--ink-0)] mb-4 tracking-tight">REST API Reference</h1>
            <p className="text-lg text-[var(--ink-2)] mb-10 leading-relaxed">
              The API Marketplace backend is fully accessible via REST for clients who prefer not to use the SDK.
            </p>
            <h3 className="text-xl font-bold text-[var(--ink-0)] mb-3">GET /api/marketplace/catalog</h3>
            <p className="text-[var(--ink-2)] mb-6">Returns a list of all active marketplace endpoints.</p>
            <CodeBlock lang="json" code={`[
  {
    "id": "uuid",
    "name": "DeFi Oracle",
    "target_url": "https://oracle.synthra.io/prices",
    "price_usdc": 0.05
  }
]`} />
          </div>
        )}

      </main>
    </div>
  );
}
