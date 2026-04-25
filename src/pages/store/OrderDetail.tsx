import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useStoreAuth } from '../../context/StoreAuthContext'
import type { StoreOrder, QuoteMaterial } from '../../types'
import { ArrowLeft, Phone, CheckCircle } from 'lucide-react'

export default function StoreOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { store } = useStoreAuth()
  const [order, setOrder] = useState<StoreOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [prices, setPrices] = useState<Record<number, string>>({})
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpShake, setOtpShake] = useState(false)
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    fetchOrder()
    const channel = supabase
      .channel('store-order-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        payload => setOrder(payload.new as StoreOrder))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function fetchOrder() {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id!).maybeSingle()
    if (error || !data) { toast.error('Order not found'); navigate('/store'); return }
    setOrder(data as StoreOrder)
    setLoading(false)
  }

  useEffect(() => {
    if (!success) return
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); navigate('/store'); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [success, navigate])

  const allPricesFilled = order?.quote_materials?.every((_, i) => prices[i] && Number(prices[i]) > 0) ?? false
  const materialTotal = order?.quote_materials?.reduce((sum, _, i) => sum + (Number(prices[i]) || 0), 0) ?? 0
  const commission = store ? materialTotal * (store.commission_pct / 100) : 0
  const storeEarns = materialTotal - commission

  async function sendPrices() {
    if (!order || !store || !allPricesFilled) return
    const confirmed = window.confirm(
      `Send ₹${materialTotal.toFixed(2)} quote to customer?\nYou will receive ₹${storeEarns.toFixed(2)} when worker collects.`
    )
    if (!confirmed) return
    setSaving(true)
    const updatedMaterials: QuoteMaterial[] = order.quote_materials.map((m, i) => ({ ...m, price: Number(prices[i]) }))
    const { error } = await supabase.from('orders').update({
      quote_materials: updatedMaterials,
      mat_cost_store: materialTotal,
      mat_cost_admin: materialTotal,
      store_earnings: storeEarns,
      total_quote: (order.quote_labour || 0) + materialTotal,
    }).eq('id', order.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Price sent to customer!')
    navigate('/store')
    setSaving(false)
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return
    const next = [...otpDigits]
    next[index] = value
    setOtpDigits(next)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus()
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) { setOtpDigits(text.split('')); otpRefs.current[5]?.focus() }
  }

  async function confirmCollection() {
    if (!order) return
    const entered = otpDigits.join('')
    if (entered !== order.mat_collection_otp) {
      setOtpShake(true)
      toast.error('Wrong OTP — ask worker to check their GetMyPro app')
      setTimeout(() => { setOtpShake(false); setOtpDigits(['', '', '', '', '', '']); otpRefs.current[0]?.focus() }, 500)
      return
    }
    setSaving(true)
    const { error } = await supabase.from('orders').update({ mat_collected: true, status: 'material_collected' }).eq('id', order.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    setSuccess(true)
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!order) return null

  if (success) return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center bg-slate-950">
      <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
        <CheckCircle size={48} className="text-green-400" />
      </div>
      <h2 className="text-3xl font-black font-heading text-green-400 mb-2">Material Given!</h2>
      <p className="text-slate-400 mb-4">Order #{order.id.slice(-6).toUpperCase()} Complete</p>
      {order.store_earnings != null && (
        <p className="text-green-400 font-bold text-lg mb-6">₹{order.store_earnings.toFixed(2)} will be settled to your account</p>
      )}
      <p className="text-slate-500 text-sm">Returning home in {countdown}...</p>
    </div>
  )

  const isQuoteSent = order.status === 'quote_sent'
  const isInProgress = order.status === 'in_progress'
  const isCollected = order.mat_collected || order.status === 'material_collected'

  return (
    <div className="min-h-dvh bg-slate-950 pb-8">
      <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate('/store')} className="text-slate-400 p-1"><ArrowLeft size={20} /></button>
        <div>
          <p className="font-bold text-slate-50 text-sm">Order Details</p>
          <p className="text-slate-500 text-xs">#{order.id.slice(-8).toUpperCase()}</p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="bg-blue-600 rounded-2xl p-4 mb-4 text-white">
          <p className="font-black text-lg">{order.service_emoji} {order.service}</p>
          <p className="text-blue-100 text-sm mt-1">{order.address}</p>
          {order.worker_name && (
            <div className="flex items-center justify-between mt-2 gap-2">
              <p className="text-blue-100 text-sm font-semibold truncate min-w-0">{order.worker_name}</p>
              <a
                href={`tel:${order.worker_phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 border border-white/30 text-white text-xs font-bold rounded-xl"
              >
                <Phone size={13} /> Call Worker
              </a>
            </div>
          )}
        </div>

        {isQuoteSent && (
          <>
            <p className="text-orange-400 text-lg font-bold mb-4 text-center">Enter your price for each item below</p>

            {/* Show worker's handwritten list photo if uploaded */}
            {order.mat_list_photo_url && (
              <div className="mb-4 bg-slate-900 border border-slate-700 rounded-2xl p-3">
                <p className="text-slate-400 text-xs font-semibold mb-2">📋 Worker's written list</p>
                <img
                  src={order.mat_list_photo_url}
                  alt="Materials list"
                  className="w-full rounded-xl object-contain max-h-64"
                />
              </div>
            )}

            {order.quote_materials?.map((mat, i) => (
              <div key={i} className="bg-slate-900 border border-slate-700 rounded-2xl p-4 mb-3">
                <p className="font-bold text-slate-50">{mat.name}</p>
                <p className="text-slate-500 text-sm mb-3">Qty: {mat.qty} {mat.unit}</p>
                <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2">
                  <span className="text-slate-400 font-bold text-xl">₹</span>
                  <input
                    type="tel"
                    value={prices[i] || ''}
                    onChange={e => setPrices(p => ({ ...p, [i]: e.target.value.replace(/\D/g, '') }))}
                    placeholder="0"
                    className="flex-1 bg-transparent text-2xl font-bold text-slate-50 outline-none"
                  />
                </div>
              </div>
            ))}

            {materialTotal > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4">
                <div className="flex justify-between text-sm text-slate-400 mb-1">
                  <span>Material total</span><span>₹{materialTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-400 mb-2">
                  <span>GetMyPro ({store?.commission_pct}%)</span><span>-₹{commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-700 pt-2">
                  <span className="font-bold text-slate-50">YOU RECEIVE</span>
                  <span className="text-green-400 font-black text-xl">₹{storeEarns.toFixed(2)} ✓</span>
                </div>
              </div>
            )}

            <button
              onClick={sendPrices}
              disabled={!allPricesFilled || saving}
              className="w-full gradient-brand text-white font-bold text-base py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Sending...' : 'Send Price to Customer'}
            </button>
          </>
        )}

        {isInProgress && (
          <>
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 text-center">
              <p className="text-4xl mb-2">✅</p>
              <p className="text-green-400 font-black text-xl">PAYMENT DONE!</p>
              <p className="text-green-300 font-semibold">Pack these items now</p>
            </div>

            {order.quote_materials?.map((mat, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-2 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-slate-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-slate-50 font-semibold text-sm truncate">{mat.name}</p>
                  <p className="text-slate-500 text-xs">{mat.qty} {mat.unit}{mat.price != null ? ` · ₹${mat.price}` : ''}</p>
                </div>
              </div>
            ))}

            {order.store_earnings != null && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 text-center">
                <p className="text-slate-400 text-sm">You will receive</p>
                <p className="text-green-400 font-black text-3xl">₹{order.store_earnings.toFixed(2)}</p>
                <p className="text-slate-500 text-xs mt-1">when worker collects</p>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-slate-50 font-bold text-lg mb-1 text-center">Worker Verification OTP</p>
              <p className="text-slate-500 text-sm text-center mb-5">Worker will show you their OTP — enter it here to confirm collection</p>
              <div className={`flex gap-2 justify-center mb-5 ${otpShake ? 'shake' : ''}`} onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    type="tel"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="otp-digit"
                  />
                ))}
              </div>
              <button
                onClick={confirmCollection}
                disabled={otpDigits.some(d => !d) || saving}
                className="w-full bg-green-500 text-white font-bold py-3.5 rounded-xl disabled:opacity-40"
              >
                {saving ? 'Confirming...' : 'Confirm Collection'}
              </button>
            </div>
          </>
        )}

        {isCollected && (
          <div className="text-center py-8">
            <CheckCircle size={56} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-black font-heading text-green-400 mb-2">Collection Confirmed!</h2>
            <p className="text-slate-400 mb-4">Materials have been given to the worker.</p>
            {order.store_earnings != null && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
                <p className="text-slate-400 text-sm">Your earnings</p>
                <p className="text-green-400 font-black text-2xl">₹{order.store_earnings.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}

        {!isQuoteSent && !isInProgress && !isCollected && (
          <div className="text-center py-8">
            <p className="text-slate-400 font-semibold capitalize">{order.status.replace(/_/g, ' ')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
