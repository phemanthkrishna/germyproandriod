import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCity } from '../context/CityContext'
import { usePendingCounts } from '../hooks/usePendingCounts'
import { ThemeToggle } from './ThemeToggle'
import { ADMIN_NAV, NAV_ROLE_ACCESS } from '../lib/adminNav'
import { ROLE_LABELS, ROLE_COLORS } from '../lib/adminRoles'
import { LogOut, MapPin } from 'lucide-react'
import type { AdminRole } from '../types'

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
  '/admin/accounts':   'Admin Accounts',
}

const NAV_SECTIONS = [
  { key: 'ops',     label: 'Operations' },
  { key: 'finance', label: 'Finance'    },
  { key: 'admin',   label: 'Admin'      },
]

function getBadge(to: string, counts: ReturnType<typeof usePendingCounts>): number {
  if (to === '/admin')          return counts.ordersNeedWorker + counts.labourApprovals
  if (to === '/admin/workers')  return counts.workersPendingVerify
  if (to === '/admin/payments') return counts.pendingPayouts
  return 0
}

export default function AdminLayout() {
  const { session, signOut } = useAuth()
  const { cities, selectedCity, setSelectedCity } = useCity()
  const counts = usePendingCounts()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const adminRole: AdminRole = (session?.adminRole ?? 'admin') as AdminRole
  const allowedPaths = NAV_ROLE_ACCESS[adminRole] ?? []

  function handleSignOut() {
    signOut()
    navigate('/admin/login')
  }

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

        {/* Nav links grouped by section */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_SECTIONS.map(sec => {
            const items = ADMIN_NAV.filter(n => n.section === sec.key && allowedPaths.includes(n.to))
            if (items.length === 0) return null
            return (
              <div key={sec.key} className="mb-2">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-3 py-1.5">{sec.label}</p>
                {items.map(({ to, icon: Icon, label }) => {
                  const badge = getBadge(to, counts)
                  return (
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
                          <span className="flex-1">{label}</span>
                          {badge > 0 && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white min-w-[18px] text-center leading-none">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* User + role + sign out */}
        <div className="px-3 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-black shrink-0">
              {(session?.name || 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-300 text-xs font-semibold truncate">{session?.name || 'Admin'}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border inline-block mt-0.5 ${ROLE_COLORS[adminRole]}`}>
                {ROLE_LABELS[adminRole]}
              </span>
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
        <header className="h-14 px-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] shrink-0 gap-3">
          <h2 className="text-slate-50 font-black font-heading text-lg shrink-0">{pageTitle}</h2>
          <div className="flex items-center gap-2 ml-auto">
            {cities.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5">
                <MapPin size={13} className={selectedCity ? 'text-blue-400' : 'text-slate-500'} />
                <select
                  value={selectedCity ?? ''}
                  onChange={e => setSelectedCity(e.target.value || null)}
                  className="bg-transparent text-xs font-semibold text-slate-300 outline-none cursor-pointer pr-1"
                >
                  <option value="">All Cities</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.city_name}>{c.city_name}</option>
                  ))}
                </select>
              </div>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
