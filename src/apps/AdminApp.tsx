import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { CityProvider } from '../context/CityContext'
import { canAccess, defaultRoute } from '../lib/adminRoles'
import type { AdminRole } from '../types'
import AdminLayout from '../components/AdminLayout'

// Pages
import AdminLogin from '../pages/admin/Login'
import AdminDashboard from '../pages/admin/Dashboard'
import AdminOrderDetail from '../pages/admin/OrderDetail'
import AdminWorkers from '../pages/admin/Workers'
import AdminPayments from '../pages/admin/Payments'
import AdminMaterials from '../pages/admin/Materials'
import AdminStores from '../pages/admin/Stores'
import AdminCities from '../pages/admin/Cities'
import AdminServices from '../pages/admin/Services'
import AdminAnalytics from '../pages/admin/Analytics'
import AdminPromos from '../pages/admin/Promos'
import AdminCampaigns from '../pages/admin/Campaigns'
import AdminAccounts from '../pages/admin/Accounts'

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!session || session.role !== 'admin') return <Navigate to="/admin/login" replace />
  return children
}

// Guard individual routes by adminRole
function RequireRole({ children, path }: { children: JSX.Element; path: string }) {
  const { session } = useAuth()
  const adminRole = (session?.adminRole ?? 'admin') as AdminRole
  if (!canAccess(adminRole, path)) {
    return <Navigate to={defaultRoute(adminRole)} replace />
  }
  return children
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={<RequireAdmin><AdminLayout /></RequireAdmin>}
      >
        <Route index element={<RequireRole path="/admin"><AdminDashboard /></RequireRole>} />
        <Route path="orders/:orderId" element={<RequireRole path="/admin/orders/:id"><AdminOrderDetail /></RequireRole>} />
        <Route path="workers"   element={<RequireRole path="/admin/workers"><AdminWorkers /></RequireRole>} />
        <Route path="payments"  element={<RequireRole path="/admin/payments"><AdminPayments /></RequireRole>} />
        <Route path="materials" element={<RequireRole path="/admin/materials"><AdminMaterials /></RequireRole>} />
        <Route path="stores"    element={<RequireRole path="/admin/stores"><AdminStores /></RequireRole>} />
        <Route path="cities"    element={<RequireRole path="/admin/cities"><AdminCities /></RequireRole>} />
        <Route path="services"  element={<RequireRole path="/admin/services"><AdminServices /></RequireRole>} />
        <Route path="analytics" element={<RequireRole path="/admin/analytics"><AdminAnalytics /></RequireRole>} />
        <Route path="promos"    element={<RequireRole path="/admin/promos"><AdminPromos /></RequireRole>} />
        <Route path="campaigns" element={<RequireRole path="/admin/campaigns"><AdminCampaigns /></RequireRole>} />
        <Route path="accounts"  element={<RequireRole path="/admin/accounts"><AdminAccounts /></RequireRole>} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

export default function AdminApp() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CityProvider>
            <div className="admin-shell">
              <AdminRoutes />
            </div>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                },
              }}
            />
          </CityProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
