import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { JobCallScreen } from '../components/JobCallScreen'

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

function RequireWorker({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!session || session.role !== 'worker') return <Navigate to="/worker/login" replace />
  return children
}

function WorkerRoutes() {
  const { session } = useAuth()
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
