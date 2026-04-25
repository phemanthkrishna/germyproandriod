import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { Plus, Pencil, ToggleLeft, ToggleRight, X, Check, GripVertical, Tag } from 'lucide-react'
import { AC_ADVANCE, AC_PLATFORM_FEE, AC_BOOKING_BASE, TRANSACTION_FEE_RATE } from '../../constants'
import type { AcServicePackage } from '../../types'

interface EditForm {
  name: string
  description: string
  price: string
  sort_order: string
  discount_pct: string
  discount_start: string
  discount_end: string
}

const EMPTY_FORM: EditForm = {
  name: '', description: '', price: '', sort_order: '0',
  discount_pct: '0', discount_start: '', discount_end: '',
}

// Returns the effective (discounted) package price given current time
function effectivePrice(pkg: AcServicePackage): number {
  if (!pkg.discount_pct || pkg.discount_pct <= 0) return pkg.price
  const now = new Date()
  if (pkg.discount_start && new Date(pkg.discount_start) > now) return pkg.price
  if (pkg.discount_end   && new Date(pkg.discount_end)   < now) return pkg.price
  return Math.round(pkg.price * (1 - pkg.discount_pct / 100))
}

// Booking charge = ₹25 platform + ₹100 advance + 2.5% processing (on the ₹125 base)
const bookingCharge = Math.round(AC_BOOKING_BASE * (1 + TRANSACTION_FEE_RATE) * 100) / 100

function paymentPreview(price: number, discountPct: number) {
  const discounted = discountPct > 0 ? Math.round(price * (1 - discountPct / 100)) : price
  const remaining = Math.max(0, discounted - AC_ADVANCE)
  return { discounted, remaining }
}

export default function AdminAcPackages() {
  const [packages, setPackages] = useState<AcServicePackage[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)

  useEffect(() => { fetchPackages() }, [])

  async function fetchPackages() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ac_service_packages')
      .select('*')
      .order('sort_order')
      .order('created_at')
    if (error) toast.error('Failed to load packages')
    setPackages((data as AcServicePackage[]) || [])
    setLoading(false)
  }

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(pkg: AcServicePackage) {
    setEditId(pkg.id)
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      price: String(pkg.price),
      sort_order: String(pkg.sort_order),
      discount_pct: String(pkg.discount_pct ?? 0),
      discount_start: pkg.discount_start ? pkg.discount_start.slice(0, 16) : '',
      discount_end:   pkg.discount_end   ? pkg.discount_end.slice(0, 16)   : '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  async function saveForm() {
    const name = form.name.trim()
    const price = Number(form.price)
    const discountPct = Number(form.discount_pct) || 0
    if (!name) return toast.error('Package name is required')
    if (!form.price || isNaN(price) || price <= 0) return toast.error('Enter a valid price')
    if (discountPct < 0 || discountPct > 100) return toast.error('Discount must be 0–100%')
    if (form.discount_start && form.discount_end && new Date(form.discount_start) >= new Date(form.discount_end)) {
      return toast.error('Discount end date must be after start date')
    }

    setSaving('form')
    const payload = {
      name,
      description: form.description.trim() || null,
      price,
      sort_order: Number(form.sort_order) || 0,
      discount_pct: discountPct,
      discount_start: form.discount_start ? new Date(form.discount_start).toISOString() : null,
      discount_end:   form.discount_end   ? new Date(form.discount_end).toISOString()   : null,
    }

    if (editId) {
      const { error } = await supabase.from('ac_service_packages').update(payload).eq('id', editId)
      if (error) { toast.error('Failed to update package'); setSaving(null); return }
      toast.success('Package updated ✓')
    } else {
      const { error } = await supabase.from('ac_service_packages').insert({ ...payload, is_active: true })
      if (error) { toast.error('Failed to add package'); setSaving(null); return }
      toast.success('Package added ✓')
    }

    setSaving(null)
    closeForm()
    fetchPackages()
  }

  async function toggleActive(pkg: AcServicePackage) {
    setSaving(pkg.id)
    const { error } = await supabase
      .from('ac_service_packages')
      .update({ is_active: !pkg.is_active })
      .eq('id', pkg.id)
    if (error) {
      toast.error('Failed to update')
    } else {
      toast.success(`${pkg.name} ${!pkg.is_active ? 'activated' : 'deactivated'}`)
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, is_active: !p.is_active } : p))
    }
    setSaving(null)
  }

  async function deletePackage(pkg: AcServicePackage) {
    if (!confirm(`Delete "${pkg.name}"? This cannot be undone.`)) return
    setSaving(pkg.id)
    const { error } = await supabase.from('ac_service_packages').delete().eq('id', pkg.id)
    if (error) {
      toast.error('Failed to delete')
    } else {
      toast.success('Package deleted')
      setPackages(prev => prev.filter(p => p.id !== pkg.id))
    }
    setSaving(null)
  }

  const activeCount = packages.filter(p => p.is_active).length

  // Live preview for the form
  const formPrice = Number(form.price)
  const formDiscountPct = Number(form.discount_pct) || 0
  const showPreview = formPrice > 0 && !isNaN(formPrice)
  const { discounted: previewDiscounted, remaining: previewRemaining } = showPreview
    ? paymentPreview(formPrice, formDiscountPct)
    : { discounted: 0, remaining: 0 }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black font-heading text-slate-50">AC Service Packages</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {activeCount} active · {packages.length} total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus size={16} />
          Add Package
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-slate-50">{editId ? 'Edit Package' : 'New Package'}</p>
            <button onClick={closeForm} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Name */}
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">Package Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. AC General Service"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-50 text-sm outline-none focus:border-orange-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-slate-400 text-xs font-medium mb-1">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description shown to customer"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-50 text-sm outline-none focus:border-orange-500"
              />
            </div>

            {/* Price + Sort */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1">Price (₹) *</label>
                <input
                  type="number" min="1"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="e.g. 699"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-50 text-sm outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1">Sort Order</label>
                <input
                  type="number" min="0"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-50 text-sm outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Discount section */}
            <div className="border border-slate-700 rounded-xl p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-0.5">
                <Tag size={14} className="text-green-400" />
                <p className="text-slate-300 text-xs font-bold">Automatic Discount (optional)</p>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-medium mb-1">Discount %</label>
                <input
                  type="number" min="0" max="100"
                  value={form.discount_pct}
                  onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-50 text-sm outline-none focus:border-green-500"
                />
                <p className="text-slate-600 text-xs mt-0.5">0 = no discount. Leave dates empty to always apply.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1">Discount Starts</label>
                  <input
                    type="datetime-local"
                    value={form.discount_start}
                    onChange={e => setForm(f => ({ ...f, discount_start: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 text-xs outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1">Discount Ends</label>
                  <input
                    type="datetime-local"
                    value={form.discount_end}
                    onChange={e => setForm(f => ({ ...f, discount_end: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-50 text-xs outline-none focus:border-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Live payment preview */}
            {showPreview && (
              <div className="bg-slate-900 rounded-xl p-3 text-xs flex flex-col gap-1.5">
                <p className="text-slate-400 font-bold mb-0.5">Payment preview</p>
                <div className="flex justify-between text-slate-500">
                  <span>Platform fee</span><span>₹{AC_PLATFORM_FEE}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Advance</span><span>₹{AC_ADVANCE}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Processing fee (2.5%)</span>
                  <span>₹{Math.round(AC_BOOKING_BASE * TRANSACTION_FEE_RATE * 100) / 100}</span>
                </div>
                <div className="flex justify-between text-slate-200 font-semibold border-t border-slate-700 pt-1.5 mt-0.5">
                  <span>Customer pays at booking</span>
                  <span>{formatCurrency(bookingCharge)}</span>
                </div>
                {formDiscountPct > 0 && (
                  <div className="flex justify-between text-green-400 font-semibold">
                    <span>Package price after {formDiscountPct}% discount</span>
                    <span>{formatCurrency(previewDiscounted)}</span>
                  </div>
                )}
                <div className="flex justify-between text-orange-400 font-semibold">
                  <span>Remaining after service</span>
                  <span>{formatCurrency(previewRemaining)}</span>
                </div>
              </div>
            )}

            <button
              onClick={saveForm}
              disabled={saving === 'form'}
              className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              <Check size={16} />
              {saving === 'form' ? 'Saving…' : editId ? 'Save Changes' : 'Add Package'}
            </button>
          </div>
        </div>
      )}

      {/* Package list */}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-8 animate-pulse">Loading…</p>
      ) : packages.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">No packages yet. Add your first one above.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {packages.map(pkg => {
            const effPrice = effectivePrice(pkg)
            const remaining = Math.max(0, effPrice - AC_ADVANCE)
            const hasDiscount = pkg.discount_pct > 0
            const now = new Date()
            const discountActive = hasDiscount &&
              (!pkg.discount_start || new Date(pkg.discount_start) <= now) &&
              (!pkg.discount_end   || new Date(pkg.discount_end)   >= now)

            return (
              <div
                key={pkg.id}
                className={`bg-[var(--surface)] border rounded-2xl p-4 transition-colors ${
                  pkg.is_active ? 'border-green-500/30' : 'border-[var(--border)] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <GripVertical size={16} className="text-slate-600 mt-1 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-slate-50 font-bold text-sm">{pkg.name}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pkg.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                      }`}>
                        {pkg.is_active ? 'Active' : 'Hidden'}
                      </span>
                      {discountActive && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                          {pkg.discount_pct}% OFF
                        </span>
                      )}
                      {hasDiscount && !discountActive && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                          {pkg.discount_pct}% OFF (scheduled)
                        </span>
                      )}
                    </div>
                    {pkg.description && (
                      <p className="text-slate-500 text-xs mt-0.5 leading-snug">{pkg.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {discountActive ? (
                        <>
                          <p className="text-slate-500 text-xs line-through">{formatCurrency(pkg.price)}</p>
                          <p className="text-green-400 font-black text-base">{formatCurrency(effPrice)}</p>
                        </>
                      ) : (
                        <p className="text-orange-400 font-black text-base">{formatCurrency(pkg.price)}</p>
                      )}
                      <span className="text-slate-600 text-xs">|</span>
                      <p className="text-slate-500 text-xs">
                        {formatCurrency(bookingCharge)} now + {formatCurrency(remaining)} after
                      </p>
                    </div>
                    {hasDiscount && (
                      <p className="text-slate-600 text-xs mt-1">
                        Discount period:{' '}
                        {pkg.discount_start ? new Date(pkg.discount_start).toLocaleString() : 'now'}
                        {' → '}
                        {pkg.discount_end ? new Date(pkg.discount_end).toLocaleString() : 'no end'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(pkg)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => toggleActive(pkg)}
                      disabled={saving === pkg.id}
                      className="disabled:opacity-40 transition-colors"
                    >
                      {pkg.is_active
                        ? <ToggleRight size={26} className="text-green-400" />
                        : <ToggleLeft size={26} className="text-slate-500" />
                      }
                    </button>
                    <button
                      onClick={() => deletePackage(pkg)}
                      disabled={saving === pkg.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-blue-400 text-xs font-bold mb-1">How AC Service packages work</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          Customer pays <strong className="text-slate-300">{formatCurrency(bookingCharge)}</strong> at booking
          (₹{AC_PLATFORM_FEE} platform fee + ₹{AC_ADVANCE} advance + 2.5% processing).
          After the worker completes the service, the customer pays the remaining balance
          (package price − ₹{AC_ADVANCE} advance). Discounts apply to the final package price only.
        </p>
      </div>
    </div>
  )
}
