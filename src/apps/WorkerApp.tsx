import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Capacitor } from '@capacitor/core'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { JobCallScreen } from '../components/JobCallScreen'
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

// ── FCM setup — only runs on real Android device ────────────────────────────
async function initFCM(workerId: string) {
  if (!Capacitor.isNativePlatform()) return

  try {
    const { receive } = await FirebaseMessaging.requestPermissions()
    if (receive !== 'granted') return

    const { token } = await FirebaseMessaging.getToken()
    if (token) {
      await supabase.from('workers').update({ fcm_token: token }).eq('id', workerId)
    }

    // Keep token fresh if Firebase rotates it
    await FirebaseMessaging.addListener('tokenReceived', async ({ token: newToken }) => {
      await supabase.from('workers').update({ fcm_token: newToken }).eq('id', workerId)
    })
  } catch (err) {
    console.error('FCM init failed:', err)
  }
}

// ── Notification tap handler — navigates to the right screen ───────────────
function useNotificationNavigation() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    // Opened from a notification tap (app was closed or backgrounded)
    FirebaseMessaging.addListener('notificationActionPerformed', (action) => {
      const data = action.notification.data as Record<string, string> | undefined
      if (!data) return
      if (data.screen === 'job' && data.orderId) navigate(`/worker/job/${data.orderId}`)
      else if (data.screen === 'earnings')        navigate('/worker/earnings')
      else if (data.screen === 'progress')        navigate('/worker/progress')
      else                                        navigate('/worker')
    })

    return () => { FirebaseMessaging.removeAllListeners() }
  }, [])
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
    // Touch last_active_at so the 4-hour timeout resets on app open
    supabase.from('workers')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', session.id)
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
          <div className="app-shell">
            <WorkerRoutes />
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
