import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { Plus, ToggleLeft, ToggleRight, X } from 'lucide-react'

interface PromoCode {
  id: string
  code: string
  discount_type: 'fixed' | 'percent'
  discount_value: number
  max_uses: number | null
  used_count: number
  valid_from: string
  valid_until: string | null
  is_active: boolean
  description: string | null
  created_at: string
}

const EMPTY_FORM = {
  code: '',
  discount_type: 'fixed' as 'fixed' | 'percent',
  discount_value: '',
  max_uses: '',
  valid_until: '',
  description: '',
}

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function AdminPromos() {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Failed to load promos')
    setPromos((data as PromoCode[]) || [])
    setLoading(false)
  }

  async function handleCreate() {
    const code = form.code.trim().toUpperCase()
    if (!code) return toast.error('Enter a code')
    const value = parseFloat(form.discount_value)
    if (isNaN(value) || value <= 0) return toast.error('Enter a valid discount value')
    if (form.discount_type === 'percent' && value > 100) return toast.error('Percent discount cannot exceed 100')

    setSaving(true)
    const { error } = await supabase.from('promo_codes').insert({
      code,
      discount_type: form.discount_type,
      discount_value: value,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_until: form.valid_until || null,
      description: form.description.trim() || null,
    })
    if (error) {
      toast.error(error.code === '23505' ? 'Code already exists' : 'Failed to create promo')
    } else {
      toast.success(`Promo ${code} created ✓`)
      setForm(EMPTY_FORM)
      setShowForm(false)
      load()
    }
    setSaving(false)
  }

  async function toggleActive(p: PromoCode) {
    setToggling(p.id)
    const { error } = await supabase
      .from('promo_codes')
      .update({ is_active: !p.is_active })
      .eq('id', p.id)
    if (error) {
      toast.error('Failed to update')
    } else {
      setPromos(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
    }
    setToggling(null)
  }

  const activeCount = promos.filter(p => p.is_active).length

  function discountLabel(p: PromoCode) {
    return p.discount_type === 'fixed'
      ? `${formatCurrency(p.discount_value)} off`
      : `${p.discount_value}% off`
  }

  function usageLabel(p: PromoCode) {
    if (!p.max_uses) return `${p.used_count} uses`
    return `${p.used_count} / ${p.max_uses} uses`
  }

  function isExpired(p: PromoCode) {
    return p.valid_until ? new Date(p.valid_until) < new Date() : false
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black font-heading text-slate-50">Promo Codes</h1>
          <p className="text-slate-400 text-sm mt-0.5">{activeCount} active · {promos.length} total</p>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM, code: genCode() }); setShowForm(true) }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors"
        >
          <Plus size={16} />
          New
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-[var(--surface)] border border-blue-500/40 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-50 font-bold text-sm">New Promo Code</p>
            <button onClick={() => setShowForm(false)}>
              <X size={18} className="text-slate-400" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Code */}
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Code</label>
              <div className="flex gap-2">
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                  placeholder="e.g. FIRST50"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 placeholder-slate-500 outline-none focus:border-blue-500 font-mono tracking-widest uppercase text-sm"
                />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, code: genCode() }))}
                  className="bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-xl"
                >
                  Random
                </button>
              </div>
            </div>

            {/* Discount type + value */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-slate-400 text-xs font-medium block mb-1">Type</label>
                <select
                  value={form.discount_type}
                  onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'fixed' | 'percent' }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 outline-none focus:border-blue-500 text-sm"
                >
                  <option value="fixed">Fixed (₹)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-slate-400 text-xs font-medium block mb-1">
                  {form.discount_type === 'fixed' ? 'Amount (₹)' : 'Percent (%)'}
                </label>
                <input
                  type="number"
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                  placeholder={form.discount_type === 'fixed' ? '50' : '10'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 placeholder-slate-500 outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Max uses + expiry */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-slate-400 text-xs font-medium block mb-1">Max uses (blank = unlimited)</label>
                <input
                  type="number"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  placeholder="Unlimited"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 placeholder-slate-500 outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-slate-400 text-xs font-medium block mb-1">Expires on</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1">Description (internal note)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. First-time customer offer"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 placeholder-slate-500 outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Creating…' : 'Create Promo Code'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-16">Loading...</p>
      ) : promos.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-16">No promo codes yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {promos.map(p => {
            const expired = isExpired(p)
            const exhausted = p.max_uses != null && p.used_count >= p.max_uses
            const statusColor = !p.is_active || expired || exhausted
              ? 'border-[var(--border)]'
              : 'border-green-500/30 bg-green-500/5'
            return (
              <div key={p.id} className={`bg-[var(--surface)] border rounded-2xl p-4 ${statusColor}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-50 font-black font-mono tracking-widest text-base">{p.code}</span>
                      <span className="bg-orange-500/20 text-orange-400 text-xs font-bold px-2 py-0.5 rounded-full">
                        {discountLabel(p)}
                      </span>
                      {expired && (
                        <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">Expired</span>
                      )}
                      {exhausted && (
                        <span className="bg-slate-700 text-slate-400 text-xs font-bold px-2 py-0.5 rounded-full">Exhausted</span>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-slate-500 text-xs mt-1">{p.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-slate-400 text-xs">{usageLabel(p)}</span>
                      {p.valid_until && (
                        <span className="text-slate-400 text-xs">
                          Expires {new Date(p.valid_until).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(p)}
                    disabled={toggling === p.id}
                    className="disabled:opacity-40 shrink-0"
                  >
                    {p.is_active
                      ? <ToggleRight size={28} className="text-green-400" />
                      : <ToggleLeft size={28} className="text-slate-500" />
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
