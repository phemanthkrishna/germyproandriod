import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { SERVICES, BOOKING_FEE, VISITING_CHARGE, PLATFORM_FEE, TRANSACTION_FEE_RATE } from '../../constants'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { BottomNav } from '../../components/BottomNav'
import { MapPicker } from '../../components/MapPicker'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useActiveServices } from '../../hooks/useActiveServices'
import { generateOtp, generateOrderId, formatCurrency } from '../../lib/utils'
import { TEST_PHONE } from '../../lib/firebaseOtp'
import { Home, List, User, MapPin, LocateFixed } from 'lucide-react'

const NAV = [
  { to: '/customer', icon: Home, label: 'Home' },
  { to: '/customer/orders', icon: List, label: 'Orders' },
  { to: '/customer/profile', icon: User, label: 'Profile' },
]

interface SavedAddress { label: string; address: string; lat?: number; lng?: number }

export default function Book() {
  const [params] = useSearchParams()
  const [selectedService, setSelectedService] = useState('')
  const [address, setAddress] = useState('')
  const [problem, setProblem] = useState('')
  const [loading, setLoading] = useState(false)
  const [workersAvailable, setWorkersAvailable] = useState<boolean | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [alertSaved, setAlertSaved] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [workerCode, setWorkerCode] = useState('')
  const [preferredWorkerId, setPreferredWorkerId] = useState<string | null>(null)
  const [codeWorkerName, setCodeWorkerName] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [checkingCode, setCheckingCode] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [promoType, setPromoType] = useState<'fixed' | 'percent'>('fixed')
  const [promoId, setPromoId] = useState<string | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [checkingPromo, setCheckingPromo] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const { session } = useAuth()
  const navigate = useNavigate()
  const { activeServices } = useActiveServices()

  useEffect(() => {
    if (!session?.id) return
    supabase.from('profiles').select('saved_addresses').eq('id', session.id).single()
      .then(({ data }) => setSavedAddresses(data?.saved_addresses || []))
  }, [session?.id])

  useEffect(() => {
    const svc = params.get('service')
    if (svc) setSelectedService(svc)
  }, [params])

  useEffect(() => {
    if (!selectedService) { setWorkersAvailable(null); setAlertSaved(false); return }
    checkAvailability(selectedService)

    // Re-check availability in realtime as workers go on/offline
    const channel = supabase
      .channel('book-worker-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workers' }, () => {
        checkAvailability(selectedService)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedService])

  async function checkAvailability(service: string) {
    setCheckingAvailability(true)
    const { data } = await supabase
      .from('workers')
      .select('service, service_categories')
      .eq('verified', true)
      .eq('is_active', true)
      .eq('is_online', true)
    const available = (data || []).some(w =>
      w.service === service ||
      (Array.isArray(w.service_categories) && w.service_categories.includes(service))
    )
    setWorkersAvailable(available)
    setCheckingAvailability(false)
  }

  useEffect(() => {
    const code = workerCode.trim()
    if (code.length < 6) { setPreferredWorkerId(null); setCodeWorkerName(null); setCodeError(null); return }
    setCheckingCode(true)
    supabase.from('workers').select('id, name, verified, is_active')
      .eq('worker_code', code)
      .maybeSingle()
      .then(({ data }) => {
        setCheckingCode(false)
        if (!data) { setCodeError('Code not found'); setPreferredWorkerId(null); setCodeWorkerName(null); return }
        if (!data.verified || !data.is_active) { setCodeError('Worker not available'); setPreferredWorkerId(null); setCodeWorkerName(null); return }
        setCodeError(null)
        setPreferredWorkerId(data.id)
        setCodeWorkerName(data.name)
      })
  }, [workerCode])

  // Promo code validation
  useEffect(() => {
    const code = promoCode.trim().toUpperCase()
    if (!code) { setPromoDiscount(0); setPromoId(null); setPromoError(null); return }
    setCheckingPromo(true)
    supabase.from('promo_codes')
      .select('id, discount_type, discount_value, max_uses, used_count, valid_until, is_active')
      .eq('code', code)
      .maybeSingle()
      .then(({ data }) => {
        setCheckingPromo(false)
        if (!data || !data.is_active) { setPromoError('Invalid or inactive code'); setPromoDiscount(0); setPromoId(null); return }
        if (data.valid_until && new Date(data.valid_until) < new Date()) { setPromoError('Code has expired'); setPromoDiscount(0); setPromoId(null); return }
        if (data.max_uses != null && data.used_count >= data.max_uses) { setPromoError('Code usage limit reached'); setPromoDiscount(0); setPromoId(null); return }
        setPromoError(null)
        setPromoId(data.id)
        setPromoType(data.discount_type)
        setPromoDiscount(data.discount_value)
      })
  }, [promoCode])

  const serviceObj = SERVICES.find(s => s.name === selectedService)

  const isDemoAccount = session?.phone === TEST_PHONE

  const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

  async function autoDetectLocation() {
    if (!navigator.geolocation) { toast.error('Location not supported'); return }
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setLat(latitude)
        setLng(longitude)
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${MAPS_KEY}`
          )
          const data = await res.json()
          if (data.results?.[0]?.formatted_address) {
            setAddress(data.results[0].formatted_address)
          }
        } catch {
          toast.error('Could not fetch address, but location is pinned')
        }
        setDetecting(false)
      },
      () => { toast.error('Enable GPS to auto-detect location'); setDetecting(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function handleBook() {
    if (!selectedService) return toast.error('Select a service')
    if (!address.trim()) return toast.error('Enter your address')
    if (!session) return

    if (isDemoAccount) {
      toast.error('Booking is disabled for the demo account')
      return
    }

    setLoading(true)
    try {
      const orderId = generateOrderId()
      const arrivalOtp = generateOtp()
      const compOtp = generateOtp()

      // If a worker code was used, verify the preferred worker is online & not busy right now
      let resolvedPreferredId = preferredWorkerId
      if (preferredWorkerId) {
        const [onlineRes, busyRes] = await Promise.all([
          supabase.from('workers').select('is_online').eq('id', preferredWorkerId).single(),
          supabase.from('orders').select('id', { count: 'exact', head: true })
            .eq('worker_id', preferredWorkerId)
            .not('status', 'in', '(completed,cancelled)'),
        ])
        const isOnline = onlineRes.data?.is_online ?? false
        const isBusy = (busyRes.count ?? 0) > 0
        if (!isOnline || isBusy) resolvedPreferredId = null
      }

      const detectedCity = localStorage.getItem('gmp_detected_city') || null

      // Apply promo discount to booking fee
      let effectiveBookingAmt = BOOKING_FEE
      if (promoId && promoDiscount > 0) {
        const discount = promoType === 'percent'
          ? Math.round(BOOKING_FEE * promoDiscount / 100)
          : promoDiscount
        effectiveBookingAmt = Math.max(0, BOOKING_FEE - discount)
      }

      const { error } = await supabase.from('orders').insert({
        id: orderId,
        customer_id: session.id,
        customer_name: session.name,
        customer_phone: session.phone,
        service: selectedService,
        service_emoji: serviceObj?.emoji || '🔧',
        address,
        customer_lat: lat ?? null,
        customer_lng: lng ?? null,
        customer_city: detectedCity,
        problem_description: problem || null,
        status: 'booked',
        booking_amt: effectiveBookingAmt,
        booking_paid: false,
        final_paid: false,
        quote_materials: [],
        mat_payment_done: false,
        mat_discount_pct: 0,
        mat_commission: 0,
        arrival_otp: arrivalOtp,
        comp_otp: compOtp,
        preferred_worker_id: resolvedPreferredId,
        preferred_worker_code: preferredWorkerId ? workerCode : null,
      })
      if (error) throw error

      // Increment promo used_count
      if (promoId) {
        await supabase.rpc('increment_promo_used', { promo_id: promoId })
      }

      // Clear any saved alert for this service since they're now booking
      await supabase.from('service_alerts')
        .delete()
        .eq('customer_id', session.id)
        .eq('service', selectedService)

      // TODO: Re-enable Cashfree checkout once Play Store link is whitelisted
      // await openCashfreeCheckout(orderId, 'booking')
      // For now, mark booking as paid and navigate directly
      await supabase.from('orders').update({ booking_paid: true }).eq('id', orderId)
      toast.success('Booking confirmed!')
      navigate(`/customer/orders/${orderId}`)
    } catch (err: any) {
      console.error('Order insert failed:', err)
      toast.error(err?.message || 'Failed to place order, please try again')
    }
    setLoading(false)
  }

  async function handleNotifyMe() {
    if (!address.trim()) return toast.error('Enter your address so we can notify you')
    if (!session) return
    setLoading(true)
    try {
      const { error } = await supabase.from('service_alerts').upsert({
        customer_id: session.id,
        customer_name: session.name,
        customer_phone: session.phone,
        service: selectedService,
        address,
        problem_description: problem || null,
      }, { onConflict: 'customer_id,service' })
      if (error) throw error
      setAlertSaved(true)
      toast.success("You're on the list! We'll notify you when a partner comes online.")
    } catch {
      toast.error('Failed to save, please try again')
    }
    setLoading(false)
  }

  return (
    <div className="page-content px-5 py-6">
      {showMapPicker && (
        <MapPicker
          initialLat={lat ?? undefined}
          initialLng={lng ?? undefined}
          onConfirm={(mlat, mlng, addr) => { setLat(mlat); setLng(mlng); setAddress(addr); setShowMapPicker(false) }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      <h1 className="text-2xl font-black font-heading text-slate-50 mb-5">Book a Service</h1>

      {/* Service selector */}
      {!selectedService ? (
        <>
          <p className="text-slate-400 text-sm mb-3">Select a service</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {SERVICES.map(s => activeServices.has(s.name) ? (
              <button
                key={s.id}
                onClick={() => setSelectedService(s.name)}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left btn-press hover:border-blue-500/50"
              >
                <div className="text-3xl mb-2">{s.emoji}</div>
                <p className="font-bold text-slate-50 text-sm">{s.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{s.desc}</p>
              </button>
            ) : (
              <div
                key={s.id}
                className="relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 text-left opacity-60 cursor-not-allowed"
              >
                <div className="text-3xl mb-2 grayscale">{s.emoji}</div>
                <p className="font-bold text-slate-400 text-sm">{s.name}</p>
                <p className="text-slate-600 text-xs mt-0.5">{s.desc}</p>
                <span className="absolute top-2 right-2 text-[10px] font-bold bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-4 mb-5 flex items-center justify-between">
          <div>
            <p className="text-orange-200 text-xs font-bold">SELECTED SERVICE</p>
            <p className="text-white font-black font-heading text-xl">{selectedService}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{serviceObj?.emoji}</span>
            <button
              onClick={() => { setSelectedService(''); setWorkersAvailable(null); setAlertSaved(false) }}
              className="text-white/70 text-xs border border-white/30 rounded-lg px-2 py-1"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Checking availability */}
      {selectedService && checkingAvailability && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 mb-4 text-slate-400 text-sm text-center animate-pulse">
          Checking partner availability...
        </div>
      )}

      {/* ── No workers available ── */}
      {selectedService && !checkingAvailability && workersAvailable === false && (
        <>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-5">
            <p className="text-amber-400 font-bold text-sm mb-1">No partners available right now</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              All {selectedService} pros are currently offline. Enter your details below and we'll notify you
              the moment a partner comes online.
            </p>
          </div>

          {alertSaved ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center mb-5">
              <p className="text-3xl mb-2">🔔</p>
              <p className="text-green-400 font-bold text-base mb-1">You're on the list!</p>
              <p className="text-slate-400 text-sm">
                We'll notify you on the home screen the moment a {selectedService} partner comes online.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 mb-5">
                <div>
                  {savedAddresses.length > 0 && (
                    <div className="mb-2">
                      <p className="text-slate-400 text-xs font-medium mb-1.5">Saved addresses</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {savedAddresses.map((a, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setAddress(a.address); setLat(a.lat ?? null); setLng(a.lng ?? null) }}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                              address === a.address
                                ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                                : 'border-slate-600 bg-slate-800 text-slate-300'
                            }`}
                          >
                            <MapPin size={10} />
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        label="Your Address"
                        placeholder="House no, street, locality"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={autoDetectLocation}
                      disabled={detecting}
                      className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-orange-500 text-white disabled:opacity-50 mb-[1px]"
                      title="Auto-detect location"
                    >
                      <LocateFixed size={20} className={detecting ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold mt-1.5"
                  >
                    <MapPin size={12} />
                    {lat ? 'Location pinned ✓' : 'Or pick on map'}
                  </button>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1 font-medium">
                    Describe the problem (optional)
                  </label>
                  <textarea
                    placeholder="E.g. pipe is leaking under kitchen sink..."
                    value={problem}
                    onChange={e => setProblem(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-slate-50 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
              </div>
              <Button size="lg" loading={loading} onClick={handleNotifyMe}>
                🔔 Notify me when available
              </Button>
            </>
          )}
        </>
      )}

      {/* ── Workers available — normal booking flow ── */}
      {selectedService && !checkingAvailability && workersAvailable === true && (
        <>
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
            <p className="text-green-400 text-sm font-semibold">Partners available — ready to book</p>
          </div>

          {/* Form */}
          <div className="flex flex-col gap-4 mb-5">
            <div>
              {savedAddresses.length > 0 && (
                <div className="mb-2">
                  <p className="text-slate-400 text-xs font-medium mb-1.5">Saved addresses</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {savedAddresses.map((a, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { setAddress(a.address); setLat(a.lat ?? null); setLng(a.lng ?? null) }}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                          address === a.address
                            ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                            : 'border-slate-600 bg-slate-800 text-slate-300'
                        }`}
                      >
                        <MapPin size={10} />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    label="Full Address"
                    placeholder="House no, street, locality"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={autoDetectLocation}
                  disabled={detecting}
                  className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-orange-500 text-white disabled:opacity-50 mb-[1px]"
                  title="Auto-detect location"
                >
                  <LocateFixed size={20} className={detecting ? 'animate-spin' : ''} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="flex items-center gap-1.5 text-orange-400 text-xs font-semibold mt-1.5"
              >
                <MapPin size={12} />
                {lat ? 'Location pinned ✓' : 'Or pick on map'}
              </button>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1 font-medium">
                Describe the problem (optional)
              </label>
              <textarea
                placeholder="E.g. pipe is leaking under kitchen sink..."
                value={problem}
                onChange={e => setProblem(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-slate-50 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>
            {/* Worker code */}
            <div>
              <label className="block text-sm text-slate-400 mb-1 font-medium">
                Worker Code <span className="text-slate-600 text-xs">(optional — to request a specific pro)</span>
              </label>
              <input
                value={workerCode}
                onChange={e => setWorkerCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="e.g. A3K9XZ"
                maxLength={6}
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-slate-50 placeholder-slate-500 outline-none focus:border-orange-500 transition-colors font-mono tracking-widest text-center text-lg uppercase"
              />
              {checkingCode && <p className="text-slate-500 text-xs mt-1 text-center">Checking code…</p>}
              {codeError && <p className="text-red-400 text-xs mt-1 text-center">{codeError}</p>}
              {codeWorkerName && <p className="text-green-400 text-xs mt-1 text-center font-semibold">✓ {codeWorkerName} will be notified first</p>}
            </div>
          </div>

          {/* Promo code */}
          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-1 font-medium">
              Promo Code <span className="text-slate-600 text-xs">(optional)</span>
            </label>
            <input
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="e.g. FIRST50"
              className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl px-4 py-3 text-slate-50 placeholder-slate-500 outline-none focus:border-green-500 transition-colors font-mono tracking-widest uppercase text-sm"
            />
            {checkingPromo && <p className="text-slate-500 text-xs mt-1">Checking code…</p>}
            {promoError && <p className="text-red-400 text-xs mt-1">{promoError}</p>}
            {promoId && promoDiscount > 0 && (
              <p className="text-green-400 text-xs mt-1 font-semibold">
                ✓ {promoType === 'percent' ? `${promoDiscount}%` : formatCurrency(promoDiscount)} discount applied!
              </p>
            )}
          </div>

          {/* Payment card */}
          {(() => {
            const discountAmt = promoId && promoDiscount > 0
              ? promoType === 'percent'
                ? Math.round(BOOKING_FEE * promoDiscount / 100)
                : promoDiscount
              : 0
            const effectiveFee = Math.max(0, BOOKING_FEE - discountAmt)
            const total = Math.round(effectiveFee * (1 + TRANSACTION_FEE_RATE) * 100) / 100
            return (
              <Card className="mb-5">
                <p className="font-bold text-slate-50 mb-3">Payment Breakdown</p>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Visiting charge</span>
                    <span>{formatCurrency(VISITING_CHARGE)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform fee</span>
                    <span>{formatCurrency(PLATFORM_FEE)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-green-400 font-semibold">
                      <span>Promo discount ({promoCode})</span>
                      <span>−{formatCurrency(discountAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>Transaction fee (2.5%)</span>
                    <span>{formatCurrency(Math.round(effectiveFee * TRANSACTION_FEE_RATE * 100) / 100)}</span>
                  </div>
                </div>
                <div className="border-t border-slate-700 mt-3 pt-3 flex justify-between items-center">
                  <span className="font-bold text-slate-50">Total to pay</span>
                  <span className="bg-orange-500 text-white font-black px-3 py-1 rounded-full text-lg">
                    {formatCurrency(total)}
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-3">
                  Worker visits, checks the job, then sends you a full quote. Payment will be collected via our secure gateway.
                </p>
              </Card>
            )
          })()}

          <Button size="lg" variant="accent" loading={loading} onClick={handleBook}>
            Confirm Booking →
          </Button>
        </>
      )}

      <BottomNav items={NAV} />
    </div>
  )
}
