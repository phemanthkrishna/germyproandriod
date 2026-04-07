import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SERVICES } from '../../constants'
import { useActiveServices } from '../../hooks/useActiveServices'
import { BottomNav } from '../../components/BottomNav'
import { StatusBadge } from '../../components/StatusBadge'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useOrders } from '../../hooks/useOrders'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { Home, List, User, LogOut } from 'lucide-react'

const NAV = [
  { to: '/customer', icon: Home, label: 'Home' },
  { to: '/customer/orders', icon: List, label: 'Orders' },
  { to: '/customer/profile', icon: User, label: 'Profile' },
]

const BANNERS = [
  {
    emoji: '🏠',
    title: 'Trusted Pros at your doorstep',
    desc: 'Background-verified professionals for every home service',
    from: '#f97316', to: '#ea580c',
  },
  {
    emoji: '⚡',
    title: 'Same-day service available',
    desc: 'Book now and get a Pro at your door within hours',
    from: '#8b5cf6', to: '#7c3aed',
  },
  {
    emoji: '✅',
    title: 'Verified & rated professionals',
    desc: 'Every Pro is Aadhaar-verified and customer-rated',
    from: '#10b981', to: '#059669',
  },
  {
    emoji: '💰',
    title: 'Transparent pricing only',
    desc: 'See the full quote before any work begins — no surprises',
    from: '#3b82f6', to: '#2563eb',
  },
]

interface ReadyAlert { service: string; emoji: string }

export default function CustomerHome() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const { orders } = useOrders({ customer_id: session?.id || '' })
  const { activeServices } = useActiveServices()
  const active = orders.filter(o => !['completed', 'cancelled'].includes(o.status))
  const [readyAlerts, setReadyAlerts] = useState<ReadyAlert[]>([])
  const [bannerIndex, setBannerIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setBannerIndex(i => (i + 1) % BANNERS.length), 3500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!session?.id) return
    checkAlerts()

    // Re-check whenever any worker's online status changes
    const channel = supabase
      .channel('home-partner-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workers' }, () => checkAlerts())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session?.id])

  async function checkAlerts() {
    if (!session?.id) return
    const { data: alerts } = await supabase
      .from('service_alerts')
      .select('service')
      .eq('customer_id', session.id)
    if (!alerts?.length) { setReadyAlerts([]); return }

    const { data: onlineWorkers } = await supabase
      .from('workers')
      .select('service, service_categories')
      .eq('verified', true)
      .eq('is_active', true)
      .eq('is_online', true)

    const ready = alerts
      .filter(alert =>
        (onlineWorkers || []).some(w =>
          w.service === alert.service ||
          (Array.isArray(w.service_categories) && w.service_categories.includes(alert.service))
        )
      )
      .map(alert => ({
        service: alert.service,
        emoji: SERVICES.find(s => s.name === alert.service)?.emoji || '🔧',
      }))
    setReadyAlerts(ready)
  }

  async function dismissAlert(service: string) {
    if (!session?.id) return
    await supabase.from('service_alerts').delete()
      .eq('customer_id', session.id)
      .eq('service', service)
    setReadyAlerts(prev => prev.filter(a => a.service !== service))
  }

  return (
    <div className="page-content px-5 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-slate-500 text-sm">Hello, {session?.name?.split(' ')[0]}</p>
          <h1 className="text-2xl font-black font-heading text-slate-50 mt-0.5">What do you need?</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={signOut} className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Partner availability notifications */}
      {readyAlerts.length > 0 && (
        <div className="mb-5">
          {readyAlerts.map(alert => (
            <div
              key={alert.service}
              className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-2 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0">{alert.emoji}</span>
                <div className="min-w-0">
                  <p className="text-green-400 font-bold text-sm leading-tight">
                    {alert.service} partners are online!
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">Ready to accept your booking now</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    dismissAlert(alert.service)
                    navigate(`/customer/book?service=${encodeURIComponent(alert.service)}`)
                  }}
                  className="text-xs bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg whitespace-nowrap"
                >
                  Book now
                </button>
                <button
                  onClick={() => dismissAlert(alert.service)}
                  className="text-slate-500 text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active orders banner */}
      {active.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active</p>
          <div className="flex flex-col gap-2">
            {active.map(o => (
              <button
                key={o.id}
                onClick={() => navigate(`/customer/orders/${o.id}`)}
                className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-left btn-press w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl shrink-0">{o.service_emoji}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-50 text-sm truncate">{o.service}</p>
                    <p className="text-slate-500 text-xs">{formatDate(o.created_at)}</p>
                  </div>
                </div>
                <StatusBadge status={o.status} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Animated Banner */}
      <div className="mb-5 relative overflow-hidden rounded-2xl" style={{ minHeight: 96 }}>
        {BANNERS.map((b, i) => (
          <div
            key={i}
            className="absolute inset-0 flex items-center gap-4 px-5 py-4"
            style={{
              background: `linear-gradient(135deg, ${b.from}, ${b.to})`,
              opacity: i === bannerIndex ? 1 : 0,
              transform: i === bannerIndex ? 'translateX(0)' : 'translateX(32px)',
              transition: 'opacity 600ms ease, transform 600ms ease',
              pointerEvents: i === bannerIndex ? 'auto' : 'none',
            }}
          >
            <span className="text-4xl shrink-0" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}>
              {b.emoji}
            </span>
            <div>
              <p className="font-black text-white text-base leading-tight">{b.title}</p>
              <p className="text-white/75 text-xs mt-0.5 leading-snug">{b.desc}</p>
            </div>
          </div>
        ))}
        {/* Dot indicators */}
        <div className="absolute bottom-2 right-3 flex gap-1.5">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => setBannerIndex(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === bannerIndex ? 16 : 6,
                height: 6,
                background: i === bannerIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Services */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Services</p>
      <div className="grid grid-cols-3 gap-3">
        {SERVICES.map(s => activeServices.has(s.name) ? (
          <button
            key={s.id}
            onClick={() => navigate(`/customer/book?service=${encodeURIComponent(s.name)}`)}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-800 border border-slate-700 py-4 px-2 btn-press transition-colors hover:border-orange-500/50 hover:bg-slate-700"
          >
            <span className="text-3xl">{s.emoji}</span>
            <p className="font-semibold text-slate-50 text-xs text-center leading-tight">{s.name}</p>
            <p className="text-slate-500 text-xs text-center leading-tight">{s.desc}</p>
          </button>
        ) : (
          <div
            key={s.id}
            className="relative flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-800/50 border border-slate-700/50 py-4 px-2 opacity-50 cursor-not-allowed"
          >
            <span className="text-3xl grayscale">{s.emoji}</span>
            <p className="font-semibold text-slate-400 text-xs text-center leading-tight">{s.name}</p>
            <span className="text-[9px] font-bold bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          </div>
        ))}
      </div>

      <BottomNav items={NAV} />
    </div>
  )
}
