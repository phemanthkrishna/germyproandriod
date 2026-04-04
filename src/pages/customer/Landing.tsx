import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Zap, ShieldCheck, Star, ChevronRight } from 'lucide-react'
import { LegalLinks } from '../../components/LegalLinks'

const FEATURES = [
  { icon: Zap,         label: 'Instant booking',      desc: 'Get a pro at your door in hours' },
  { icon: ShieldCheck, label: 'Verified professionals', desc: 'Background-checked, skilled workers' },
  { icon: Star,        label: 'Rated & reviewed',      desc: 'Only top-rated pros in your area' },
]

export default function CustomerLanding() {
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session?.role === 'customer') navigate('/customer', { replace: true })
  }, [session])

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg)] overflow-y-auto">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center pt-14 pb-10 px-6 overflow-hidden">
        {/* glow blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#1D6FD9]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#E85520]/15 rounded-full blur-3xl pointer-events-none" />

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
          <h1 className="text-5xl font-black font-heading leading-none tracking-tight mb-2">
            <span className="gradient-text">GetMyPro</span>
          </h1>
          <p className="text-[var(--muted)] text-base font-medium max-w-xs mx-auto leading-snug">
            Trusted home services,<br />on demand.
          </p>
        </div>

        {/* Service tags */}
        <div className="relative z-10 flex flex-wrap justify-center gap-2 mt-5">
          {['Plumbing', 'Electrical', 'Carpentry', 'Cleaning', 'Painting'].map(s => (
            <span
              key={s}
              className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── Features ─────────────────────────────────────────── */}
      <div className="px-6 flex flex-col gap-3 mb-8">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3.5"
          >
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shrink-0">
              <Icon size={18} className="text-white" />
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
          onClick={() => navigate('/customer/login')}
          className="w-full gradient-brand text-white font-bold text-lg rounded-2xl py-4 px-5 flex items-center justify-between btn-press shadow-lg"
        >
          <span>Book a Service</span>
          <ChevronRight size={22} />
        </button>

        <p className="text-center text-xs text-[var(--muted)] pb-2">
          Are you a professional?{' '}
          <button
            onClick={() => navigate('/worker/login')}
            className="text-[#E85520] font-semibold"
          >
            Join as a Pro
          </button>
        </p>

        <LegalLinks />
      </div>

    </div>
  )
}
