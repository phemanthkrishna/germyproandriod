import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Capacitor } from '@capacitor/core'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { JobCallScreen } from '../components/JobCallScreen'
import { WorkerCityGate } from '../components/WorkerCityGate'
import { supabase } from '../lib/supabase'

// Pages
import WorkerLanding from '../pages/worker/Landing'
import WorkerLogin from '../pages/worker/Login'
import WorkerRegister from '../pages/worker/Register'
import WorkerJobs from '../pages/worker/Jobs'
import WorkerEarnings from '../pages/worker/Earnings'
import WorkerProfile from '../pages/worker/Profile'
import WorkerHistory from '../pages/worker/WorkHistory'
import WorkerProgress from '../pages/worker/Progress'
import JobDetail from '../pages/worker/JobDetail'
import LegalPage from '../pages/legal/LegalPage'

// ── FCM setup — only runs on real Android device ────────────────────────────
let fcmInitialized = false

async function initFCM(workerId: string) {
  if (!Capacitor.isNativePlatform()) return

  try {
    let perm = await FirebaseMessaging.checkPermissions()
    if (perm.receive !== 'granted') {
      // Request permission — shows native Android 13+ dialog if needed
      const result = await FirebaseMessaging.requestPermissions()
      if (result.receive !== 'granted') {
        console.warn('Notification permission denied — skipping token fetch')
        return
      }
    }

    const { token } = await FirebaseMessaging.getToken()
    if (token) {
      await supabase.from('workers').update({ fcm_token: token }).eq('id', workerId)
    }

    // Only add listeners once — they persist for the app lifetime
    if (!fcmInitialized) {
      fcmInitialized = true

      FirebaseMessaging.addListener('tokenReceived', async ({ token: newToken }) => {
        await supabase.from('workers').update({ fcm_token: newToken }).eq('id', workerId)
      })

      FirebaseMessaging.addListener('notificationReceived', () => {
        // foreground notification — Capacitor shows it automatically
      })
    }
  } catch (err) {
    console.error('FCM init failed:', err)
  }
}

// ── Notification tap handler — navigates to the right screen ───────────────
function useNotificationNavigation() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    // Case 1: Regular FCM notification tapped (app was backgrounded)
    FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
      const data = action.notification?.data as Record<string, string> | undefined
      if (!data) return
      routeNotification(data, navigate)
    })

    // Case 2: Custom full-screen notification tapped (built by JobNotificationService)
    // MainActivity reads the Intent extras and fires this DOM event once the WebView is ready.
    const handleNativeTap = (e: Event) => {
      const data = (e as CustomEvent).detail as Record<string, string>
      if (data) routeNotification(data, navigate)
    }
    window.addEventListener('nativeNotificationTap', handleNativeTap)

    return () => {
      window.removeEventListener('nativeNotificationTap', handleNativeTap)
    }
  }, [])
}

function routeNotification(data: Record<string, string>, navigate: (path: string, opts?: any) => void) {
  if (data.screen === 'job' && data.orderId) navigate(`/worker/job/${data.orderId}`, { replace: true })
  else if (data.screen === 'earnings')        navigate('/worker/earnings', { replace: true })
  else if (data.screen === 'progress')        navigate('/worker/progress', { replace: true })
  else                                        navigate('/worker', { replace: true })
}

function RequireWorker({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!session || session.role !== 'worker') return <Navigate to="/worker/login" replace />
  return children
}

function WorkerRoutes() {
  const { session } = useAuth()
  useNotificationNavigation()

  // Init FCM + update last_active_at whenever a logged-in worker loads the app
  useEffect(() => {
    if (!session?.id) return
    initFCM(session.id)
    supabase.from('workers')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', session.id)
  }, [session?.id])

  // Re-init FCM if the user just granted notification permission
  // (fired by MainActivity after onRequestPermissionsResult, or after returning from settings)
  useEffect(() => {
    if (!session?.id) return
    const onGranted = () => initFCM(session.id)
    // Only re-init when app comes to foreground, not when it goes to background
    const onVisibilityChange = () => { if (!document.hidden) initFCM(session.id) }
    window.addEventListener('notificationPermissionGranted', onGranted)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('notificationPermissionGranted', onGranted)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [session?.id])

  return (
    <>
      {session?.role === 'worker' && (
        <JobCallScreen
          workerId={session.id}
          workerName={session.name}
          workerPhone={session.phone}
        />
      )}
      <Routes>
        <Route path="/" element={<WorkerLanding />} />
        <Route path="/worker/login" element={<WorkerLogin />} />
        <Route path="/worker/register" element={<WorkerRegister />} />
        <Route path="/worker" element={<RequireWorker><WorkerJobs /></RequireWorker>} />
        <Route path="/worker/earnings" element={<RequireWorker><WorkerEarnings /></RequireWorker>} />
        <Route path="/worker/progress" element={<RequireWorker><WorkerProgress /></RequireWorker>} />
        <Route path="/worker/history" element={<RequireWorker><WorkerHistory /></RequireWorker>} />
        <Route path="/worker/profile" element={<RequireWorker><WorkerProfile /></RequireWorker>} />
        <Route path="/worker/job/:orderId" element={<RequireWorker><JobDetail /></RequireWorker>} />
        <Route path="/legal/:page" element={<LegalPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function WorkerApp() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <WorkerCityGate>
            <div className="app-shell">
              <WorkerRoutes />
            </div>
          </WorkerCityGate>
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
