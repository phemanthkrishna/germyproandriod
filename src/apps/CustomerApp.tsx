import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { Capacitor } from '@capacitor/core'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { CustomerAlertNotifier } from '../components/CustomerAlertNotifier'
import { CityGate } from '../components/CityGate'
import { supabase } from '../lib/supabase'
import CustomerLanding from '../pages/customer/Landing'
import CustomerLogin from '../pages/customer/Login'
import CustomerHome from '../pages/customer/Home'
import Book from '../pages/customer/Book'
import CustomerOrders from '../pages/customer/Orders'
import CustomerOrderDetail from '../pages/customer/OrderDetail'
import CustomerProfile from '../pages/customer/Profile'
import LegalPage from '../pages/legal/LegalPage'

// ── Notification tap handler — navigates to the right screen ───────────────
function useNotificationNavigation() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
      const data = action.notification.data as Record<string, string> | undefined
      if (!data) return
      if (data.screen === 'order' && data.orderId) navigate(`/customer/orders/${data.orderId}`)
      else if (data.screen === 'home')               navigate('/customer')
      else                                           navigate('/customer')
    })

    return () => { FirebaseMessaging.removeAllListeners() }
  }, [])
}

// ── FCM setup — only runs on real Android device ────────────────────────────
async function initCustomerFCM(customerId: string) {
  if (!Capacitor.isNativePlatform()) return

  try {
    // Check current permission status first
    const perm = await FirebaseMessaging.checkPermissions()
    if (perm.receive !== 'granted') {
      // Request permission — shows native Android 13+ dialog
      const result = await FirebaseMessaging.requestPermissions()
      if (result.receive !== 'granted') {
        console.warn('Notification permission denied')
        return
      }
    }

    const { token } = await FirebaseMessaging.getToken()
    if (token) {
      await supabase.from('profiles').update({ fcm_token: token }).eq('id', customerId)
    }

    // Keep token fresh if Firebase rotates it
    await FirebaseMessaging.addListener('tokenReceived', async ({ token: newToken }) => {
      await supabase.from('profiles').update({ fcm_token: newToken }).eq('id', customerId)
    })

    // Handle foreground notifications (show them as local notifications)
    await FirebaseMessaging.addListener('notificationReceived', (notification) => {
      console.log('Foreground notification:', notification)
    })
  } catch (err) {
    console.error('Customer FCM init failed:', err)
  }
}

function RequireCustomer({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!session || session.role !== 'customer') return <Navigate to="/customer/login" replace />
  return children
}

function CustomerRoutes() {
  const { session } = useAuth()
  useNotificationNavigation()

  useEffect(() => {
    if (!session?.id) return
    initCustomerFCM(session.id)
  }, [session?.id])

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
        <Route path="/legal/:page" element={<LegalPage />} />
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
            <CityGate>
              <CustomerRoutes />
            </CityGate>
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
