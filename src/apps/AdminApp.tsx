import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

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
      <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
      <Route path="/admin/orders/:orderId" element={<RequireAdmin><AdminOrderDetail /></RequireAdmin>} />
      <Route path="/admin/workers" element={<RequireAdmin><AdminWorkers /></RequireAdmin>} />
      <Route path="/admin/payments" element={<RequireAdmin><AdminPayments /></RequireAdmin>} />
      <Route path="/admin/materials" element={<RequireAdmin><AdminMaterials /></RequireAdmin>} />
      <Route path="/admin/stores" element={<RequireAdmin><AdminStores /></RequireAdmin>} />
      <Route path="/admin/cities" element={<RequireAdmin><AdminCities /></RequireAdmin>} />
      <Route path="/admin/services" element={<RequireAdmin><AdminServices /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

export default function AdminApp() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="app-shell">
            <AdminRoutes />
          </div>
          <Toaster
            position="top-center"
            offset={{ top: 'max(16px, env(safe-area-inset-top, 16px))' } as any}
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
