import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { PeraWalletProvider } from './hooks/usePeraWallet'
import Home from './Home'
import AppLayout from './components/AppLayout'
import Hub from './pages/Hub'
import Marketplace from './pages/Marketplace'
import MarketplaceChat from './pages/MarketplaceChat'
import Publish from './pages/Publish'
import ApiMarketplace from './pages/ApiMarketplace'
import ApiDashboard from './pages/ApiDashboard'
import DeployApi from './pages/DeployApi'
import ApiKey from './pages/ApiKey'
import Docs from './pages/Docs'

export default function App() {
  return (
    <BrowserRouter>
      <SnackbarProvider maxSnack={3}>
        <PeraWalletProvider>
          <Routes>
            {/* Landing page — standalone layout */}
            <Route path="/" element={<Home />} />

            {/* App pages — shared sidebar layout */}
            <Route element={<AppLayout />}>
              <Route path="/hub" element={<Hub />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/marketplace/:agentId/chat" element={<MarketplaceChat />} />
              <Route path="/publish" element={<Publish />} />
              <Route path="/api" element={<ApiMarketplace />} />
              <Route path="/api-dashboard" element={<ApiDashboard />} />
              <Route path="/deploy-api" element={<DeployApi />} />
              <Route path="/api/keys" element={<ApiKey />} />
              <Route path="/docs" element={<Docs />} />
            </Route>

            {/* Redirects from old routes */}
            <Route path="/playground" element={<Navigate to="/hub" replace />} />
            <Route path="/api-key" element={<Navigate to="/api/keys" replace />} />
          </Routes>
        </PeraWalletProvider>
      </SnackbarProvider>
    </BrowserRouter>
  )
}