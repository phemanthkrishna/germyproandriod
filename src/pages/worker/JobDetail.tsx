import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useOrder } from '../../hooks/useOrders'
import { useAuth } from '../../context/AuthContext'
import { useWorkerLocation } from '../../hooks/useWorkerLocation'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { OtpInput } from '../../components/OtpInput'
import { StatusBadge } from '../../components/StatusBadge'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../lib/utils'
import { haversineDistance } from '../../lib/utils'
import { ArrowLeft, Upload, Plus, X, Navigation, Phone, Camera } from 'lucide-react'
import { PACKAGE_SERVICES, AC_ADVANCE } from '../../constants'

const PROXIMITY_KM = 0.2 // 200 meters
import type { QuoteMaterial } from '../../types'

const UNITS = ['nos', 'm', 'kg', 'L', 'box', 'pkt']

export default function JobDetail() {
  const { orderId } = useParams<{ orderId: string }>()
  const { order, loading, refetch } = useOrder(orderId!)
  const { session } = useAuth()
  const navigate = useNavigate()

  const [hasActiveJob, setHasActiveJob] = useState(false)

  useEffect(() => {
    if (!session?.id) return
    supabase
      .from('orders')
      .select('id')
      .eq('worker_id', session.id)
      .not('status', 'in', '("completed","cancelled")')
      .then(({ data }) => setHasActiveJob((data?.length ?? 0) > 0))
  }, [session?.id])

  // Broadcast live GPS while en route AND while on the job
  const isTracking = order?.worker_id === session?.id &&
    ['booked', 'worker_visiting', 'inspecting', 'quote_sent', 'in_progress', 'material_collected', 'done_uploaded'].includes(order?.status ?? '')
  useWorkerLocation(session?.id ?? '', isTracking)

  // OTP rate-limiting state (5 attempts → 60s lockout per OTP type)
  const [arrivalAttempts, setArrivalAttempts] = useState(0)
  const [arrivalLockedUntil, setArrivalLockedUntil] = useState<number | null>(null)
  const [compAttempts, setCompAttempts] = useState(0)
  const [compLockedUntil, setCompLockedUntil] = useState<number | null>(null)
  const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const compTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-clear lockout after 60s so the button re-enables
  useEffect(() => {
    if (!arrivalLockedUntil) return
    const ms = arrivalLockedUntil - Date.now()
    if (ms <= 0) { setArrivalLockedUntil(null); return }
    arrivalTimerRef.current = setTimeout(() => setArrivalLockedUntil(null), ms)
    return () => { if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current) }
  }, [arrivalLockedUntil])

  useEffect(() => {
    if (!compLockedUntil) return
    const ms = compLockedUntil - Date.now()
    if (ms <= 0) { setCompLockedUntil(null); return }
    compTimerRef.current = setTimeout(() => setCompLockedUntil(null), ms)
    return () => { if (compTimerRef.current) clearTimeout(compTimerRef.current) }
  }, [compLockedUntil])

  const [arrivalOtp, setArrivalOtp] = useState('')
  const [compOtp, setCompOtp] = useState('')
  const [labour, setLabour] = useState('')
  const [needsMaterials, setNeedsMaterials] = useState(false)
  const [materials, setMaterials] = useState<QuoteMaterial[]>([{ name: '', qty: 1, unit: 'nos' }])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [matListPhotoUrl, setMatListPhotoUrl] = useState('')
  const [matListPhotoPreview, setMatListPhotoPreview] = useState('')
  const [matListUploading, setMatListUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const matListCameraRef = useRef<HTMLInputElement>(null)
  const matListGalleryRef = useRef<HTMLInputElement>(null)

  // Check if worker is near the customer's location (within 200m)
  async function checkProximity(): Promise<boolean> {
    if (!order?.customer_lat || !order?.customer_lng) return true // no customer coords, skip check
    return new Promise((resolve) => {
      if (!navigator.geolocation) { toast.error('Location not available on this device'); resolve(false); return }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, order!.customer_lat!, order!.customer_lng!)
          if (dist > PROXIMITY_KM) {
            toast.error(`You must be within 200m of the job site. You're ${dist < 1 ? Math.round(dist * 1000) + 'm' : dist.toFixed(1) + 'km'} away.`)
            resolve(false)
          } else {
            resolve(true)
          }
        },
        (err) => { console.error('GPS error:', err); toast.error('Could not get your location — enable GPS and try again'); resolve(false) },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!order) return <div className="p-6 text-slate-400">Job not found</div>

  const isMyJob = order.worker_id === session?.id
  const canAccept = order.status === 'booked' && !order.worker_id

  // Decline preferred job — releases it to general pool
  async function declinePreferredJob() {
    setSaving(true)
    await supabase.from('orders').update({ preferred_worker_id: null }).eq('id', order!.id)
    setSaving(false)
    toast.success('Declined — job is now open to all workers')
    navigate('/worker')
  }

  // Step 1: Accept job
  async function acceptJob() {
    if (!session) return
    if (hasActiveJob) {
      toast.error('Complete your current job before accepting a new one')
      return
    }
    setSaving(true)
    // Touch last_active_at so the 2-hour inactivity timer resets
    await supabase.from('workers')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', session.id)

    const { error } = await supabase.from('orders').update({
      worker_id: session.id,
      worker_name: session.name,
      worker_phone: session.phone,
      status: 'booked',
    }).eq('id', order!.id).is('worker_id', null) // only if still unassigned
    if (error) {
      toast.error('Could not accept job — it may have already been taken')
    } else {
      toast.success('Job accepted! Head to the customer 🚗')
      refetch()
    }
    setSaving(false)
  }

  // Enter arrival OTP to confirm arrived
  async function confirmArrival() {
    if (arrivalLockedUntil && Date.now() < arrivalLockedUntil) {
      const secs = Math.ceil((arrivalLockedUntil - Date.now()) / 1000)
      toast.error(`Too many wrong attempts. Try again in ${secs}s`)
      return
    }
    const nearSite = await checkProximity()
    if (!nearSite) return
    if (arrivalOtp !== order!.arrival_otp) {
      const next = arrivalAttempts + 1
      setArrivalAttempts(next)
      if (next >= 5) { setArrivalLockedUntil(Date.now() + 60_000); setArrivalAttempts(0) }
      toast.error('Wrong OTP — ask customer to check their app')
      return
    }
    setArrivalAttempts(0)
    setSaving(true)
    const { error } = await supabase.from('orders').update({ status: 'inspecting' }).eq('id', order!.id)
    if (error) toast.error('Failed to confirm arrival, please try again')
    else { toast.success('Arrived! Start your inspection 🔍'); refetch() }
    setSaving(false)
  }

  // Start inspection
  async function startInspection() {
    setSaving(true)
    const { error } = await supabase.from('orders').update({ status: 'inspecting' }).eq('id', order!.id)
    if (error) { console.error('Start inspection failed:', error); toast.error(error.message) }
    else { toast.success('Inspection started'); refetch() }
    setSaving(false)
  }

  // Step 2: Send quote (from inspecting status)
  async function sendQuote() {
    if (!labour || isNaN(Number(labour))) return toast.error('Enter labour charges')
    const labourAmt = Number(labour)
    if (labourAmt < 50) return toast.error('Labour charge must be at least ₹50')
    setSaving(true)
    const validMats = needsMaterials
      ? materials.filter(m => m.name.trim() && Number(m.qty) > 0 && m.unit)
      : []
    if (needsMaterials && materials.some(m => m.name.trim() && Number(m.qty) <= 0)) {
      toast.error('All material quantities must be greater than 0')
      setSaving(false)
      return
    }

    // > ₹1,000 requires admin approval before quote is sent
    if (labourAmt > 1_000) {
      const { error } = await supabase.from('orders').update({
        labour_approval_pending: true,
        labour_pending_amount: labourAmt,
        quote_materials: validMats.length > 0 ? validMats : [],
        ...(matListPhotoUrl ? { mat_list_photo_url: matListPhotoUrl } : {}),
      }).eq('id', order!.id)
      if (error) toast.error(error.message)
      else { toast.success('Amount sent for admin approval ⏳'); refetch() }
      setSaving(false)
      return
    }

    const update: Record<string, any> = {
      quote_labour: labourAmt,
      quote_materials: validMats,
      status: 'quote_sent',
      ...(matListPhotoUrl ? { mat_list_photo_url: matListPhotoUrl } : {}),
    }
    // No materials — set cost to 0 so quote goes straight to customer
    if (!needsMaterials) {
      update.mat_cost_admin = 0
      update.total_quote = labourAmt
    }
    const { error } = await supabase.from('orders').update(update).eq('id', order!.id)
    if (error) { toast.error(error.message); setSaving(false); return }

    // Auto-assign active store when materials are needed
    if (needsMaterials && validMats.length > 0) {
      const { data: storeData, error: storeErr } = await supabase
        .from('stores')
        .select('id, name, contact')
        .neq('is_active', false)   // matches TRUE and NULL (safe if column missing)
        .limit(1)
        .maybeSingle()
      if (storeErr) {
        toast.error('Could not find a store — admin will assign manually')
      } else if (storeData) {
        const arr = new Uint32Array(1)
        crypto.getRandomValues(arr)
        const otp = String(100000 + (arr[0] % 900000))
        const { error: assignErr } = await supabase.from('orders').update({
          mat_store_id: storeData.id,
          mat_store_name: storeData.name,
          mat_store_contact: storeData.contact,
          mat_collection_otp: otp,
        }).eq('id', order!.id)
        if (assignErr) toast.error('Store assignment failed: ' + assignErr.message)
        else toast.success('Quote sent — store notified! 📋')
      } else {
        toast.success('Quote sent — no store found, admin will assign 📋')
      }
    } else {
      toast.success(needsMaterials ? 'Quote sent to admin! 📋' : 'Quote sent to customer! 📋')
    }
    refetch()
    setSaving(false)
  }

  function addMaterial() {
    setMaterials(m => [...m, { name: '', qty: 1, unit: 'nos' }])
  }
  function removeMaterial(i: number) {
    setMaterials(m => m.filter((_, idx) => idx !== i))
  }
  function updateMaterial(i: number, field: keyof QuoteMaterial, val: string | number) {
    setMaterials(m => m.map((mat, idx) => idx === i ? { ...mat, [field]: val } : mat))
  }

  // Upload materials list photo (photo of handwritten list)
  async function uploadMatListPhoto(file: File) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP or HEIC images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      return
    }
    setMatListUploading(true)
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const path = `mat-list/${order!.id}.${ext}`
    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed, please try again'); setMatListUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
    setMatListPhotoUrl(publicUrl)
    setMatListPhotoPreview(URL.createObjectURL(file))
    toast.success('List photo uploaded ✓')
    setMatListUploading(false)
  }

  // Upload photo
  async function uploadPhoto(file: File) {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP or HEIC images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      return
    }
    setSaving(true)
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const path = `jobs/${order!.id}.${ext}`
    const { error } = await supabase.storage.from('uploads').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed, please try again'); setSaving(false); return }
    const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(path)
    const { error: updateError } = await supabase.from('orders').update({ job_photo_url: publicUrl }).eq('id', order!.id)
    if (updateError) { console.error('Photo URL save failed:', updateError); toast.error(updateError.message); setSaving(false); return }
    toast.success('Photo uploaded ✓')
    refetch()
    setSaving(false)
  }

  // Mark done + verify comp OTP
  async function markDone() {
    if (!order!.job_photo_url && !photoFile) return toast.error('Upload a completion photo first')
    setSaving(true)
    const { error } = await supabase.from('orders').update({ status: 'done_uploaded' }).eq('id', order!.id)
    if (error) { console.error('Mark done failed:', error); toast.error(error.message) }
    else { toast.success('Done! Ask customer for their OTP'); refetch() }
    setSaving(false)
  }

  async function verifyCompOtp() {
    if (compLockedUntil && Date.now() < compLockedUntil) {
      const secs = Math.ceil((compLockedUntil - Date.now()) / 1000)
      toast.error(`Too many wrong attempts. Try again in ${secs}s`)
      return
    }
    // For AC Service, ensure customer has paid the remaining balance first
    if (PACKAGE_SERVICES.includes(order!.service) && !order!.ac_remaining_paid) {
      toast.error('Waiting for customer to pay the remaining balance')
      return
    }
    const nearSite = await checkProximity()
    if (!nearSite) return
    if (compOtp !== order!.comp_otp) {
      const next = compAttempts + 1
      setCompAttempts(next)
      if (next >= 5) { setCompLockedUntil(Date.now() + 60_000); setCompAttempts(0) }
      toast.error('Wrong OTP — ask customer to check their app')
      return
    }
    setCompAttempts(0)
    setSaving(true)
    const { error } = await supabase.from('orders').update({ status: 'completed' }).eq('id', order!.id)
    if (error) toast.error('Failed to complete job, please try again')
    else { toast.success('Job complete! Payment will be credited ✓'); navigate('/worker') }
    setSaving(false)
  }

  return (
    <div className="page-content px-5 py-6">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/worker')} className="text-slate-400"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="font-black font-heading text-slate-50 text-xl">{order.service}</h1>
          <p className="text-slate-500 text-xs">{order.id}</p>
        </div>
        <div className="ml-auto"><StatusBadge status={order.status} /></div>
      </div>

      {/* Job details */}
      <Card className="mb-4">
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Address" value={order.address} />
          <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-slate-500 shrink-0">Customer</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-50 font-semibold truncate">{order.customer_name}</span>
              <a
                href={`tel:${order.customer_phone}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-xl shrink-0"
              >
                <Phone size={13} /> Call
              </a>
            </div>
          </div>
          {order.problem_description && <Row label="Problem" value={order.problem_description} />}
          <Row label="Date" value={formatDate(order.created_at)} />
        </div>
        {isMyJob && (
          <a
            href={
              order.customer_lat && order.customer_lng
                ? `https://www.google.com/maps/dir/?api=1&destination=${order.customer_lat},${order.customer_lng}`
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-2.5 text-sm transition-colors"
          >
            <Navigation size={15} />
            Navigate to Customer
          </a>
        )}
      </Card>

      {/* Step 1: Accept */}
      {canAccept && hasActiveJob && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4 text-orange-400 text-sm">
          🔒 You're currently on a job — complete it before accepting new requests
        </div>
      )}
      {canAccept && !hasActiveJob && (
        <>
          {order.preferred_worker_id === session?.id && (
            <div className="bg-orange-500/10 border border-orange-500/40 rounded-xl p-3 mb-3 flex items-center gap-2">
              <span className="text-xl shrink-0">🎯</span>
              <p className="text-orange-400 text-sm font-semibold">A customer specifically requested you for this job!</p>
            </div>
          )}
          <div className="flex gap-3 mb-4">
            <Button variant="primary" className="flex-1" loading={saving} onClick={acceptJob}>
              Accept Job ✓
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={saving}
              onClick={order.preferred_worker_id === session?.id ? declinePreferredJob : () => navigate('/worker')}
            >
              Decline
            </Button>
          </div>
        </>
      )}

      {/* After accepting but before status=worker_visiting: enter arrival OTP */}
      {isMyJob && order.status === 'booked' && order.worker_id && (
        <Card className="mb-4">
          <p className="font-bold text-slate-50 mb-2">Enter Arrival OTP</p>
          <p className="text-slate-400 text-sm mb-4">Ask the customer for their arrival code</p>
          <OtpInput value={arrivalOtp} onChange={setArrivalOtp} length={4} />
          <Button size="lg" variant="accent" loading={saving} onClick={confirmArrival} className="mt-4">
            Confirm Arrival ✓
          </Button>
        </Card>
      )}

      {/* inspecting: awaiting admin approval for high labour amount */}
      {isMyJob && order.status === 'inspecting' && order.labour_approval_pending && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/10">
          <p className="text-amber-400 font-bold mb-1">⏳ Awaiting Admin Approval</p>
          <p className="text-slate-400 text-sm">Your labour charge of {formatCurrency(order.labour_pending_amount || 0)} exceeds ₹1,000 and requires admin approval. You'll be notified once approved.</p>

        </Card>
      )}

      {/* AC Service: package info banner for worker */}
      {isMyJob && PACKAGE_SERVICES.includes(order.service) && order.ac_package_name && (
        <Card className="mb-4 border-blue-500/20 bg-blue-500/5">
          <p className="font-bold text-slate-50 mb-2">❄️ Fixed-Price Package</p>
          <div className="flex items-center justify-between">
            <p className="text-slate-200 text-sm font-semibold">{order.ac_package_name}</p>
            <p className="text-orange-400 font-black text-lg">{formatCurrency(order.ac_package_price || 0)}</p>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            No quote needed — perform the service, then mark complete. Customer pays remaining after you upload the completion photo.
          </p>
        </Card>
      )}

      {/* inspecting: show quote form — skip for package services */}
      {isMyJob && order.status === 'inspecting' && !order.labour_approval_pending && PACKAGE_SERVICES.includes(order.service) && (
        <Card className="mb-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-blue-400 text-sm">
            ✅ This is a fixed-price package. Perform the service and proceed to upload a completion photo.
          </div>
          <Button
            size="lg"
            variant="accent"
            loading={saving}
            className="mt-3"
            onClick={async () => {
              setSaving(true)
              const { error } = await supabase.from('orders').update({
                status: 'in_progress',
                quote_labour: 0,
                mat_cost_admin: 0,
                total_quote: order.ac_package_price || 0,
                final_paid: true, // booking fee already covers; remaining collected separately
              }).eq('id', order!.id)
              if (error) toast.error(error.message)
              else { toast.success('Started! Proceed with the service.'); refetch() }
              setSaving(false)
            }}
          >
            Start Service →
          </Button>
        </Card>
      )}

      {/* inspecting: show quote form — normal (non-package) services */}
      {isMyJob && order.status === 'inspecting' && !order.labour_approval_pending && !PACKAGE_SERVICES.includes(order.service) && (
        <Card className="mb-4">
          <p className="font-bold text-slate-50 mb-1">Send Quote</p>
          <div className="flex flex-col gap-4">
            <Input
              label="Labour Charges (₹)"
              type="number"
              placeholder="e.g. 500"
              value={labour}
              onChange={e => setLabour(e.target.value)}
            />
            {labour && !isNaN(Number(labour)) && Number(labour) > 0 && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">Your estimated earnings</p>
                <p className="text-green-400 font-black text-xl">{formatCurrency(Number(labour) + 100)}</p>
                <p className="text-slate-500 text-xs mt-0.5">₹{labour} labour + ₹100 visiting charge</p>
              </div>
            )}
            {/* Materials toggle */}
            <div className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-3">
              <div>
                <p className="text-slate-50 text-sm font-semibold">Materials needed?</p>
                <p className="text-slate-500 text-xs">{needsMaterials ? 'Store partner will price materials' : 'Quote goes directly to customer'}</p>
              </div>
              <button
                type="button"
                onClick={() => setNeedsMaterials(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${needsMaterials ? 'bg-orange-500' : 'bg-slate-600'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${needsMaterials ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>
            <div className={needsMaterials ? '' : 'hidden'}>
              <p className="text-sm text-slate-400 mb-2 font-medium">Materials list</p>

              {/* Photo of handwritten list option */}
              <div className="mb-3 bg-slate-900 border border-slate-700 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-2">📷 Take a photo of your written list instead of typing</p>
                {matListPhotoPreview ? (
                  <div className="relative">
                    <img src={matListPhotoPreview} alt="Materials list" className="w-full rounded-xl object-cover max-h-48" />
                    <button
                      type="button"
                      onClick={() => { setMatListPhotoPreview(''); setMatListPhotoUrl('') }}
                      className="absolute top-2 right-2 bg-red-500/80 text-white rounded-full p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => matListCameraRef.current?.click()}
                      disabled={matListUploading}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-800 border border-slate-600 rounded-xl py-2.5 text-slate-300 text-sm font-medium disabled:opacity-50"
                    >
                      <Camera size={16} className="text-orange-400" />
                      {matListUploading ? 'Uploading…' : 'Camera'}
                    </button>
                    <button
                      type="button"
                      onClick={() => matListGalleryRef.current?.click()}
                      disabled={matListUploading}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-800 border border-slate-600 rounded-xl py-2.5 text-slate-300 text-sm font-medium disabled:opacity-50"
                    >
                      <Upload size={16} className="text-blue-400" />
                      Gallery
                    </button>
                  </div>
                )}
                {/* Hidden inputs for mat list photo */}
                <input ref={matListCameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadMatListPhoto(f) }} />
                <input ref={matListGalleryRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadMatListPhoto(f) }} />
                {!matListPhotoPreview && (
                  <p className="text-slate-500 text-xs text-center mt-2">— or type the list below —</p>
                )}
              </div>

              {materials.map((m, i) => (
                <div key={i} className="flex gap-2 mb-2 items-center overflow-hidden">
                  <input
                    placeholder="Item name"
                    value={m.name}
                    onChange={e => updateMaterial(i, 'name', e.target.value)}
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-50 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    min="1"
                    value={m.qty}
                    onChange={e => updateMaterial(i, 'qty', Number(e.target.value))}
                    className="w-14 shrink-0 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-slate-50 text-sm outline-none focus:border-blue-500 text-center"
                  />
                  <select
                    value={m.unit}
                    onChange={e => updateMaterial(i, 'unit', e.target.value)}
                    className="w-[72px] shrink-0 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-slate-50 text-sm outline-none"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {i > 0 && (
                    <button onClick={() => removeMaterial(i)} className="shrink-0 text-red-400 p-1">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addMaterial} className="text-blue-400 text-sm flex items-center gap-1 mt-1">
                <Plus size={14} /> Add Material
              </button>
            </div>
            <Button size="lg" variant="accent" loading={saving} onClick={sendQuote}>
              {needsMaterials ? 'Send Quote →' : 'Send Quote to Customer →'}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Waiting for payment */}
      {isMyJob && order.status === 'quote_sent' && (
        <Card className="mb-4">
          <p className="font-bold text-slate-50 mb-3">Your Quote</p>
          <div className="flex flex-col gap-2 text-sm">
            <Row label="Labour" value={formatCurrency(order.quote_labour || 0)} />
            {(Array.isArray(order.quote_materials) ? order.quote_materials as QuoteMaterial[] : []).map((m, i) => (
              <Row key={i} label={m.name} value={`${m.qty} ${m.unit}`} />
            ))}
          </div>
          {order.mat_cost_admin == null ? (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-400 text-sm">
              Store partner is pricing materials — quote will be sent to customer shortly.
            </div>
          ) : (
            <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-blue-400 text-sm">
              Material cost confirmed: {formatCurrency(order.mat_cost_admin)}.
              Waiting for customer to pay.
            </div>
          )}
        </Card>
      )}

      {/* Material collection */}
      {isMyJob && order.status === 'in_progress' && Array.isArray(order.quote_materials) && order.quote_materials.length > 0 && !order.mat_collected && (
        <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
          {!order.mat_store_id ? (
            <p className="text-amber-400 text-sm">⏳ Admin is assigning a store for material collection. Check back shortly.</p>
          ) : (
            <>
              <p className="font-bold text-slate-50 mb-3">🏪 Collect Materials First</p>
              <div className="flex flex-col gap-1 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Store</span>
                  <span className="text-slate-50 font-semibold">{order.mat_store_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Contact</span>
                  <a
                    href={`tel:${order.mat_store_contact}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-xl"
                  >
                    <Phone size={13} /> {order.mat_store_contact}
                  </a>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-2">Show this OTP to the store — they'll verify it:</p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                <p className="text-amber-400 text-xs font-semibold mb-1">Your Collection OTP</p>
                <p className="text-white font-black text-4xl tracking-[0.3em] font-mono">{order.mat_collection_otp}</p>
              </div>
              <p className="text-slate-500 text-xs text-center mt-3">Waiting for store to confirm collection…</p>
            </>
          )}
        </Card>
      )}

      {/* Step 4: Upload completion photo — show when in_progress (no/collected materials) or material_collected */}
      {isMyJob && (order.status === 'material_collected' || (
        order.status === 'in_progress' &&
        !(Array.isArray(order.quote_materials) && order.quote_materials.length > 0 && !order.mat_collected)
      )) && (
        <Card className="mb-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 text-green-400 text-sm">
            Payment received! Start work now.
          </div>
          <p className="font-bold text-slate-50 mb-3">Upload Completion Photo</p>

          {/* Photo preview */}
          {(photoPreview || order.job_photo_url) && (
            <img
              src={photoPreview || order.job_photo_url}
              alt="Completion"
              className="rounded-xl w-full object-cover mb-4"
            />
          )}

          {/* Camera + Gallery buttons */}
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-2 border-2 border-dashed border-slate-600 rounded-xl p-4 hover:border-orange-500 transition-colors"
            >
              <Camera className="text-orange-400" size={28} />
              <span className="text-slate-300 text-sm font-medium">Take Photo</span>
            </button>
            <label className="flex-1 flex flex-col items-center gap-2 border-2 border-dashed border-slate-600 rounded-xl p-4 hover:border-orange-500 transition-colors cursor-pointer">
              <Upload className="text-blue-400" size={28} />
              <span className="text-slate-300 text-sm font-medium">Gallery</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); uploadPhoto(f) }
                }}
              />
            </label>
          </div>

          {/* Hidden camera input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); uploadPhoto(f) }
            }}
          />

          <Button size="lg" variant="primary" loading={saving} onClick={markDone} className="mt-4">
            Mark Work Complete & Get OTP ✓
          </Button>
        </Card>
      )}

      {/* Step 5: Verify completion OTP */}
      {isMyJob && order.status === 'done_uploaded' && (
        <Card className="mb-4">
          {order.job_photo_url && (
            <img src={order.job_photo_url} alt="Completion" className="rounded-xl w-full object-cover mb-4" />
          )}
          {/* AC Service: waiting for remaining payment */}
          {PACKAGE_SERVICES.includes(order.service) && !order.ac_remaining_paid ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
              <p className="text-amber-400 font-bold text-sm mb-1">⏳ Waiting for customer payment</p>
              <p className="text-slate-400 text-xs">
                Customer needs to pay{' '}
                <strong className="text-slate-200">{formatCurrency(Math.max(0, (order.ac_package_price || 0) - AC_ADVANCE))}</strong>{' '}
                remaining balance before you can complete the job.
              </p>
            </div>
          ) : (
            <>
              <p className="font-bold text-slate-50 mb-2">Enter Completion OTP</p>
              <p className="text-slate-400 text-sm mb-4">Ask customer for their completion code</p>
              <OtpInput value={compOtp} onChange={setCompOtp} length={4} />
              <Button size="lg" variant="primary" loading={saving} onClick={verifyCompOtp} className="mt-4">
                Verify OTP & Complete Job ✓
              </Button>
            </>
          )}
        </Card>
      )}

      {order.status === 'completed' && (
        <Card className="border-green-500/30 bg-green-500/10 mb-4">
          <p className="text-green-400 font-bold">🎉 Job Completed</p>
          <div className="mt-2">
            {PACKAGE_SERVICES.includes(order.service) ? (
              <>
                <p className="text-slate-300 text-sm font-semibold">
                  Package: {order.ac_package_name}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">Payment will be credited to your account</p>
              </>
            ) : (
              <>
                <p className="text-slate-300 text-sm font-semibold">
                  Total Earned: {formatCurrency((order.quote_labour || 0) + 100)}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">+₹100 booking bonus included</p>
              </>
            )}
          </div>
        </Card>
      )}

      {order.status === 'cancelled' && (order.worker_cancellation_pay ?? 0) > 0 && (
        <Card className="border-green-500/30 bg-green-500/10 mb-4">
          <p className="text-green-400 font-bold">Cancellation Payout</p>
          <p className="text-slate-300 text-sm mt-1">
            ₹{order.worker_cancellation_pay} will be credited to your account
          </p>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 text-right">{value}</span>
    </div>
  )
}
