import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from './ThemeToggle'
import { ADMIN_NAV } from '../lib/adminNav'
import { LogOut } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/admin':            'Orders',
  '/admin/workers':    'Workers',
  '/admin/payments':   'Payments',
  '/admin/materials':  'Materials',
  '/admin/stores':     'Stores',
  '/admin/cities':     'Cities',
  '/admin/services':   'Services',
  '/admin/analytics':  'Analytics',
  '/admin/promos':     'Promo Codes',
  '/admin/campaigns':  'Campaigns',
}

export default function AdminLayout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function handleSignOut() {
    signOut()
    navigate('/admin/login')
  }

  // Match order detail routes like /admin/orders/:id
  const isOrderDetail = /^\/admin\/orders\//.test(pathname)
  const pageTitle = isOrderDetail ? 'Order Detail' : (PAGE_TITLES[pathname] ?? 'Admin')

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 flex flex-col bg-[var(--surface)] border-r border-[var(--border)] h-full overflow-y-auto">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm shrink-0 select-none">
              🔧
            </div>
            <div>
              <p className="text-slate-50 font-black text-sm leading-none">GetMyPro</p>
              <p className="text-slate-500 text-xs mt-0.5">Admin Console</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
          {ADMIN_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-blue-400' : 'text-slate-500'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="px-3 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-black shrink-0">
              {(session?.name || 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-300 text-xs font-semibold truncate">{session?.name || 'Admin'}</p>
              <p className="text-slate-600 text-[10px]">Administrator</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 px-6 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
          <h2 className="text-slate-50 font-black font-heading text-lg">{pageTitle}</h2>
          <ThemeToggle />
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
