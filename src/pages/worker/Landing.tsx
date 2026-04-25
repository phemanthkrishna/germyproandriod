import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { IndianRupee, Clock, TrendingUp, ChevronRight, Eye } from 'lucide-react'
import { LegalLinks } from '../../components/LegalLinks'

const FEATURES = [
  { icon: IndianRupee, label: 'Earn more',          desc: 'Get paid directly for every job you complete' },
  { icon: Clock,       label: 'Flexible hours',     desc: 'Work when you want, take jobs that suit you' },
  { icon: TrendingUp,  label: 'Grow your career',   desc: 'Earn badges, build reputation, unlock bonuses' },
]

export default function WorkerLanding() {
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session?.role === 'worker') navigate('/worker', { replace: true })
  }, [session])

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--bg)] overflow-y-auto">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center pt-14 pb-10 px-6 overflow-hidden">
        {/* glow blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#E85520]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#1D6FD9]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 mb-6">
          <img
            src="/logoworker.png"
            alt="GetMyPro"
            className="w-28 h-28 object-contain drop-shadow-2xl"
            onError={e => { e.currentTarget.src = '/logoworker.png' }}
          />
        </div>

        <div className="relative z-10 text-center">
          <p className="text-[#E85520] text-xs font-bold uppercase tracking-widest mb-2">For Professionals</p>
          <h1 className="text-5xl font-black font-heading leading-none tracking-tight mb-2">
            <span className="gradient-text">GetMyPro</span>
          </h1>
          <p className="text-[var(--muted)] text-base font-medium max-w-xs mx-auto leading-snug">
            Find jobs near you.<br />Get paid. Grow your skills.
          </p>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 flex gap-6 mt-7">
          {[['500+', 'Active Pros'], ['4.8★', 'Avg Rating'], ['Daily', 'Payouts']].map(([val, lbl]) => (
            <div key={lbl} className="text-center">
              <p className="text-lg font-black text-[var(--text)]">{val}</p>
              <p className="text-[10px] text-[var(--muted)] font-medium">{lbl}</p>
            </div>
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
            <div className="w-10 h-10 rounded-xl bg-[#E85520]/15 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-[#E85520]" />
            </div>
            <div>
              <p className="font-bold text-sm text-[var(--text)]">{label}</p>
              <p className="text-xs text-[var(--muted)]">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── CTAs ─────────────────────────────────────────────── */}
      <div className="px-6 pb-10 mt-auto flex flex-col gap-3">
        <button
          onClick={() => navigate('/worker/register')}
          className="w-full gradient-brand text-white font-bold text-lg rounded-2xl py-4 px-5 flex items-center justify-between btn-press shadow-lg"
        >
          <span>Join as a Pro</span>
          <ChevronRight size={22} />
        </button>
        <button
          onClick={() => navigate('/worker/login')}
          className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-bold text-base rounded-2xl py-3.5 px-5 btn-press"
        >
          Already registered? Login
        </button>
        <button
          onClick={() => navigate('/worker/login?demo=1')}
          className="w-full flex items-center justify-center gap-2 text-[var(--muted)] text-sm py-2 btn-press"
        >
          <Eye size={15} />
          Browse as Demo Worker
        </button>

        <LegalLinks />
      </div>

    </div>
  )
}
