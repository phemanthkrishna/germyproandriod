import { useNavigate } from 'react-router-dom'
import { useStoreAuth } from '../../context/StoreAuthContext'
import { useEffect } from 'react'
import { Package, BarChart2, Handshake, ChevronRight } from 'lucide-react'

const FEATURES = [
  { icon: Package,   label: 'Supply materials',   desc: 'Provide materials for jobs in your area' },
  { icon: BarChart2, label: 'Track earnings',      desc: 'Real-time commission tracking and reports' },
  { icon: Handshake, label: 'Grow your business',  desc: 'Partner with a growing network of pros' },
]

export default function StoreLanding() {
  const { store } = useStoreAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (store) navigate('/store', { replace: true })
  }, [store])

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg)] overflow-y-auto">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center pt-14 pb-10 px-6 overflow-hidden">
        {/* glow blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#1D6FD9]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#E85520]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 mb-6">
          <img
            src="/logo.png"
            alt="GetMyPro"
            className="w-28 h-28 object-contain drop-shadow-2xl"
            onError={e => { e.currentTarget.src = '/logo.svg' }}
          />
        </div>

        <div className="relative z-10 text-center">
          <p className="text-[#1D6FD9] text-xs font-bold uppercase tracking-widest mb-2">Store Partners</p>
          <h1 className="text-5xl font-black font-heading leading-none tracking-tight mb-2">
            <span className="gradient-text">GetMyPro</span>
          </h1>
          <p className="text-[var(--muted)] text-base font-medium max-w-xs mx-auto leading-snug">
            Supply materials to local pros.<br />Earn commissions on every job.
          </p>
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────── */}
      <div className="px-6 flex flex-col gap-3 mb-8">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1D6FD9]/15 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-[#1D6FD9]" />
            </div>
            <div>
              <p className="font-bold text-sm text-[var(--text)]">{label}</p>
              <p className="text-xs text-[var(--muted)]">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <div className="px-6 pb-10 mt-auto flex flex-col gap-3">
        <button
          onClick={() => navigate('/store/login')}
          className="w-full gradient-brand text-white font-bold text-lg rounded-2xl py-4 px-5 flex items-center justify-between btn-press shadow-lg"
        >
          <span>Login to Dashboard</span>
          <ChevronRight size={22} />
        </button>
        <p className="text-center text-xs text-[var(--muted)]">
          Your Store ID was provided by GetMyPro
        </p>
      </div>

    </div>
  )
}
