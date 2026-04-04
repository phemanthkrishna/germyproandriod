import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { CustomerAlertNotifier } from '../components/CustomerAlertNotifier'

// Pages
import CustomerLanding from '../pages/customer/Landing'
import CustomerLogin from '../pages/customer/Login'
import CustomerHome from '../pages/customer/Home'
import Book from '../pages/customer/Book'
import CustomerOrders from '../pages/customer/Orders'
import CustomerOrderDetail from '../pages/customer/OrderDetail'
import CustomerProfile from '../pages/customer/Profile'

function RequireCustomer({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!session || session.role !== 'customer') return <Navigate to="/customer/login" replace />
  return children
}

function CustomerRoutes() {
  const { session } = useAuth()
  return (
    <>
      {session?.role === 'customer' && (
        <CustomerAlertNotifier customerId={session.id} />
      )}
      <Routes>
        <Route path="/" element={<CustomerLanding />} />
        <Route path="/customer/login" element={<CustomerLogin />} />
        <Route path="/customer" element={<RequireCustomer><CustomerHome /></RequireCustomer>} />
        <Route path="/customer/book" element={<RequireCustomer><Book /></RequireCustomer>} />
        <Route path="/customer/orders" element={<RequireCustomer><CustomerOrders /></RequireCustomer>} />
        <Route path="/customer/orders/:orderId" element={<RequireCustomer><CustomerOrderDetail /></RequireCustomer>} />
        <Route path="/customer/profile" element={<RequireCustomer><CustomerProfile /></RequireCustomer>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function CustomerApp() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="app-shell">
            <CustomerRoutes />
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
