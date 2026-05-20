import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Code2, ArrowLeft, Terminal, Zap, CheckCircle2 } from 'lucide-react'
import { usePeraWallet } from '../hooks/usePeraWallet'

export default function DeployApi() {
  const { address: accountAddress } = usePeraWallet()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_url: '',
    price_usdc: '0.10',
    tags: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [successData, setSuccessData] = useState<any>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountAddress) {
      setError("Please connect your wallet first to deploy an endpoint.")
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:8080/api/marketplace/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_wallet: accountAddress,
          name: formData.name,
          description: formData.description,
          target_url: formData.target_url,
          price_usdc: parseFloat(formData.price_usdc),
          tags: formData.tags.split(',').map(t => t.trim()).filter(t => t)
        })
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = await response.json()
      setSuccessData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to deploy endpoint')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  return (
    <div className="cs-page bg-[var(--bg-0)] text-[var(--ink-0)] min-h-screen">
      <div className="w-full max-w-3xl mx-auto mt-8">
        <Link to="/api" className="inline-flex items-center gap-2 text-[var(--ink-2)] hover:text-[var(--ink-0)] mb-6 transition-colors font-medium">
          <ArrowLeft size={16} /> Back to Marketplace
        </Link>
        
        <h1 className="text-3xl font-bold text-[var(--ink-0)] mb-2">
          Deploy API Endpoint
        </h1>
        <p className="text-[var(--ink-2)] mb-8">
          Register your API to the Synthra Marketplace and start earning USDC.
        </p>

        {successData ? (
          <div className="bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-2xl p-8 shadow-sm">
            <div className="flex items-center gap-3 text-[var(--accent)] mb-4">
              <CheckCircle2 size={32} />
              <h2 className="text-2xl font-bold">API Deployed Successfully!</h2>
            </div>
            <p className="text-[var(--ink-0)] mb-6">
              Your API is now registered in the marketplace. To enforce the paywall, wrap your Express/Hono backend with the Synthra SDK using the snippet below:
            </p>
            
            <div className="bg-[var(--terminal-bg)] rounded-xl p-4 relative overflow-hidden mb-6 border border-[var(--card-border)]">
              <div className="flex items-center gap-2 text-[var(--terminal-text)] text-xs mb-3 font-mono border-b border-[var(--terminal-dim)] pb-2 opacity-80">
                <Terminal size={14} /> server.ts
              </div>
              <pre className="text-[var(--terminal-text)] text-sm font-mono overflow-x-auto whitespace-pre-wrap">
{`import express from 'express';
import { synthraApiAuth } from '@synthra/api-sdk/server';

const app = express();

// Protect your endpoint using the Synthra SDK
app.get('${new URL(successData.target_url).pathname || '/api/data'}', 
  synthraApiAuth({ 
    priceUsdc: ${successData.price_usdc},
    network: 'testnet', // Switch to 'mainnet' for production
    discovery: {
      description: "${successData.name}"
    }
  }),
  (req, res) => {
    // Your actual API logic goes here!
    res.json({ message: "Hello from paid API!" });
  }
);

app.listen(3000);`}
              </pre>
            </div>
            
            <div className="flex gap-4">
              <Link to="/api" className="bg-[var(--accent)] hover:bg-[var(--accent-soft)] text-white font-medium py-2 px-6 rounded-xl transition-colors">
                View in Marketplace
              </Link>
              <button 
                onClick={() => setSuccessData(null)}
                className="bg-transparent border border-[var(--accent-border)] text-[var(--accent)] hover:bg-[var(--accent-bg)] font-medium py-2 px-6 rounded-xl transition-colors"
              >
                Deploy Another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[var(--bg-1)] border border-[var(--card-border)] rounded-2xl p-8 shadow-[var(--card-shadow)]">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[var(--ink-0)] mb-2">API Name</label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Real-time Weather Data"
                  className="w-full bg-[var(--bg-2)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--ink-0)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--ink-3)] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink-0)] mb-2">Target URL (The endpoint to protect)</label>
                <input 
                  type="url" 
                  name="target_url"
                  value={formData.target_url}
                  onChange={handleChange}
                  required
                  placeholder="https://your-server.com/api/weather"
                  className="w-full bg-[var(--bg-2)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--ink-0)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--ink-3)] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-0)] mb-2">Price per Request (USDC)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ink-3)] font-medium">$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      name="price_usdc"
                      value={formData.price_usdc}
                      onChange={handleChange}
                      required
                      className="w-full bg-[var(--bg-2)] border border-[var(--card-border)] rounded-xl pl-8 pr-4 py-3 text-[var(--ink-0)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--ink-3)] transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--ink-0)] mb-2">Tags (Comma separated)</label>
                  <input 
                    type="text" 
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="weather, data, ai"
                    className="w-full bg-[var(--bg-2)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--ink-0)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--ink-3)] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--ink-0)] mb-2">Description</label>
                <textarea 
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={4}
                  placeholder="Describe what your API does and what data it returns..."
                  className="w-full bg-[var(--bg-2)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-[var(--ink-0)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--ink-3)] resize-none transition-colors"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="mt-8 w-full flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)]"
            >
              {loading ? (
                <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <><Code2 size={18} /> Deploy to Marketplace</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
