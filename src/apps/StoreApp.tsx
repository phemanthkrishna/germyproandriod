import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { StoreAuthProvider } from '../context/StoreAuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { useStoreAuth } from '../context/StoreAuthContext'

// Pages
import StoreLanding from '../pages/store/Landing'
import StoreLogin from '../pages/store/Login'
import StoreDashboard from '../pages/store/Dashboard'
import StoreOrderDetail from '../pages/store/OrderDetail'
import StoreEarnings from '../pages/store/Earnings'
import StoreProfile from '../pages/store/Profile'

function RequireStore({ children }: { children: JSX.Element }) {
  const { store, loading } = useStoreAuth()
  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!store) return <Navigate to="/store/login" replace />
  return children
}

function StoreRoutes() {
  return (
    <Routes>
      <Route path="/" element={<StoreLanding />} />
      <Route path="/store/login" element={<StoreLogin />} />
      <Route path="/store" element={<RequireStore><StoreDashboard /></RequireStore>} />
      <Route path="/store/order/:id" element={<RequireStore><StoreOrderDetail /></RequireStore>} />
      <Route path="/store/earnings" element={<RequireStore><StoreEarnings /></RequireStore>} />
      <Route path="/store/profile" element={<RequireStore><StoreProfile /></RequireStore>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function StoreApp() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <StoreAuthProvider>
          <div className="app-shell">
            <StoreRoutes />
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
        </StoreAuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
