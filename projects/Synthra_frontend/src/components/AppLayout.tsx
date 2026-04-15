import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Moon,
  Sun,
  MessageSquare,
  Store,
  Code2,
  BookOpen,
  Key,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { usePeraWallet } from '../hooks/usePeraWallet'
import { ellipseAddress } from '../utils/ellipseAddress'
import WalletConnectOptions from './WalletConnectOptions'

const NAV_ITEMS = [
  { to: '/hub', label: 'Hub', icon: MessageSquare, desc: 'Chat with base models' },
  { to: '/marketplace', label: 'Marketplace', icon: Store, desc: 'Creator AI agents' },
  { to: '/api', label: 'API', icon: Code2, desc: 'API marketplace' },
  { to: '/api/keys', label: 'API Keys', icon: Key, desc: 'Generate credentials' },
  { to: '/docs', label: 'Docs', icon: BookOpen, desc: 'Developer guide' },
]

export default function AppLayout() {
  const { address, isConnected, disconnect } = usePeraWallet()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('synthra-theme')
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('synthra-theme', theme)
  }, [theme])

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Build breadcrumb from path
  const crumbs = location.pathname.split('/').filter(Boolean)

  return (
    <div className="al-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="al-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── SIDEBAR ─── */}
      <aside className={`al-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="al-sidebar-top">
          <Link to="/" className="al-sidebar-brand">
            <span className="s-logo-mark" aria-hidden="true"><i /><i /><i /></span>
            <span className="al-sidebar-brand-name">Synthra</span>
          </Link>
          <button className="al-sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="al-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `al-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={18} className="al-nav-icon" />
              <div className="al-nav-text">
                <span className="al-nav-label">{item.label}</span>
                <span className="al-nav-desc">{item.desc}</span>
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="al-sidebar-bottom">
          {isConnected && address ? (
            <div className="al-wallet-connected">
              <div className="al-wallet-info">
                <span className="al-wallet-dot" />
                <span className="al-wallet-addr">{ellipseAddress(address, 4)}</span>
              </div>
              <button className="al-wallet-disconnect" onClick={disconnect} title="Disconnect">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <WalletConnectOptions
              className="wallet-options-row wallet-options-row-stack"
              buttonClassName="al-wallet-connect"
            />
          )}
        </div>
      </aside>

      {/* ─── MAIN AREA ─── */}
      <div className="al-main">
        {/* Top bar */}
        <header className="al-topbar">
          <div className="al-topbar-left">
            <button className="al-hamburger" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="al-breadcrumb">
              <Link to="/" className="al-crumb-home">Synthra</Link>
              {crumbs.map((c, i) => (
                <span key={i} className="al-crumb-seg">
                  <ChevronRight size={12} />
                  <span>{c.charAt(0).toUpperCase() + c.slice(1)}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="al-topbar-right">
            <button
              className="al-theme-toggle"
              onClick={() => setTheme((p) => (p === 'light' ? 'dark' : 'light'))}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            {isConnected && address && (
              <span className="al-topbar-wallet">{ellipseAddress(address, 4)}</span>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="al-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
