import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
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

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!session || session.role !== 'admin') return <Navigate to="/admin/login" replace />
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
        <Route index element={<AdminDashboard />} />
        <Route path="orders/:orderId" element={<AdminOrderDetail />} />
        <Route path="workers" element={<AdminWorkers />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="materials" element={<AdminMaterials />} />
        <Route path="stores" element={<AdminStores />} />
        <Route path="cities" element={<AdminCities />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="promos" element={<AdminPromos />} />
        <Route path="campaigns" element={<AdminCampaigns />} />
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
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
