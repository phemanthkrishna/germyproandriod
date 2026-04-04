import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { SERVICES } from '../../constants'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { OtpInput } from '../../components/OtpInput'
import { useAuth } from '../../context/AuthContext'
import { createRecaptchaVerifier, sendOtp, verifyOtp, firebaseAuthMessage, type ConfirmationResult, type RecaptchaVerifier } from '../../lib/firebaseOtp'
import { supabase } from '../../lib/supabase'
import { generateWorkerCode } from '../../lib/utils'
import { Camera, IdCard, CheckCircle2 } from 'lucide-react'

const STEPS = ['info', 'otp', 'aadhaar', 'docs', 'photo'] as const
type Step = typeof STEPS[number]

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export default function WorkerRegister() {
  const [step, setStep] = useState<Step>('info')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [serviceCategories, setServiceCategories] = useState<string[]>([])
  const [otp, setOtp] = useState('')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const verifierRef = useRef<RecaptchaVerifier | null>(null)

  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [upiId, setUpiId] = useState('')
  const [workerAddress, setWorkerAddress] = useState('')
  const [experienceYears, setExperienceYears] = useState('')

  // Aadhaar document images
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState<File | null>(null)
  const [aadhaarFrontPreview, setAadhaarFrontPreview] = useState('')
  const [aadhaarBackFile, setAadhaarBackFile] = useState<File | null>(null)
  const [aadhaarBackPreview, setAadhaarBackPreview] = useState('')
  const aadhaarFrontUrlRef = useRef('')
  const aadhaarBackUrlRef = useRef('')

  // Profile photo
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const photoUrlRef = useRef('')

  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    try {
      verifierRef.current = createRecaptchaVerifier('recaptcha-container')
    } catch {
      console.error('reCAPTCHA failed to initialize')
    }
    return () => {
      verifierRef.current?.clear()
      verifierRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
      if (aadhaarFrontUrlRef.current) URL.revokeObjectURL(aadhaarFrontUrlRef.current)
      if (aadhaarBackUrlRef.current) URL.revokeObjectURL(aadhaarBackUrlRef.current)
    }
  }, [])

  async function handleSendOtp() {
    if (!name.trim()) return toast.error('Enter your name')
    if (serviceCategories.length === 0) return toast.error('Select at least one service')
    if (phone.length !== 10 || !/^[6-9]/.test(phone)) return toast.error('Enter a valid 10-digit Indian mobile number')
    if (!verifierRef.current && !(window as any)?.Capacitor?.isNativePlatform?.()) return toast.error('reCAPTCHA not ready, refresh the page')
    setLoading(true)
    try {
      const result = await sendOtp(phone, verifierRef.current)
      setConfirmationResult(result)
      setStep('otp')
      toast.success('OTP sent!')
    } catch (e: unknown) {
      toast.error(firebaseAuthMessage(e))
    }
    setLoading(false)
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) return toast.error('Enter 6-digit OTP')
    const isNative = !!(window as any)?.Capacitor?.isNativePlatform?.()
    if (!confirmationResult && !isNative) return toast.error('Please request OTP first')
    setLoading(true)
    try {
      await verifyOtp(confirmationResult, otp)
      setStep('aadhaar')
    } catch (e: unknown) {
      toast.error(firebaseAuthMessage(e))
    }
    setLoading(false)
  }

  function pickImageFile(
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File) => void,
    setPreview: (url: string) => void,
    urlRef: React.MutableRefObject<string>,
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP or HEIC images are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      return
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(file)
    urlRef.current = url
    setFile(file)
    setPreview(url)
  }

  function clearAadhaarFront() {
    if (aadhaarFrontUrlRef.current) { URL.revokeObjectURL(aadhaarFrontUrlRef.current); aadhaarFrontUrlRef.current = '' }
    setAadhaarFrontFile(null); setAadhaarFrontPreview('')
  }

  function clearAadhaarBack() {
    if (aadhaarBackUrlRef.current) { URL.revokeObjectURL(aadhaarBackUrlRef.current); aadhaarBackUrlRef.current = '' }
    setAadhaarBackFile(null); setAadhaarBackPreview('')
  }

  async function handleComplete() {
    if (!photoFile) return toast.error('Upload your photo to continue')
    setLoading(true)
    try {
      // Check if a verified worker already exists with this phone number
      const { data: existingWorker } = await supabase
        .from('workers')
        .select('id, verified, is_active')
        .eq('phone', phone)
        .maybeSingle()

      if (existingWorker && existingWorker.verified && existingWorker.is_active !== false) {
        toast.error('A verified worker account already exists for this number. Please login instead.')
        setLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .upsert({ phone, name, role: 'worker' }, { onConflict: 'phone' })
        .select('id')
        .single()
      if (profileError) throw profileError

      // Upload profile photo
      const photoExt = (photoFile.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      const photoPath = `photos/${profile.id}.${photoExt}`
      const { error: photoUploadErr } = await supabase.storage.from('uploads').upload(photoPath, photoFile, { upsert: true })
      if (photoUploadErr) throw photoUploadErr
      const { data: { publicUrl: photoUrl } } = supabase.storage.from('uploads').getPublicUrl(photoPath)

      // Upload Aadhaar front
      const frontExt = (aadhaarFrontFile!.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      const frontPath = `aadhaar/${profile.id}_front.${frontExt}`
      const { error: frontErr } = await supabase.storage.from('uploads').upload(frontPath, aadhaarFrontFile!, { upsert: true })
      if (frontErr) throw frontErr
      const { data: { publicUrl: aadhaarFrontUrl } } = supabase.storage.from('uploads').getPublicUrl(frontPath)

      // Upload Aadhaar back
      const backExt = (aadhaarBackFile!.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      const backPath = `aadhaar/${profile.id}_back.${backExt}`
      const { error: backErr } = await supabase.storage.from('uploads').upload(backPath, aadhaarBackFile!, { upsert: true })
      if (backErr) throw backErr
      const { data: { publicUrl: aadhaarBackUrl } } = supabase.storage.from('uploads').getPublicUrl(backPath)

      const { error: workerError } = await supabase.from('workers').upsert({
        id: profile.id,
        name,
        phone,
        service: serviceCategories[0],
        service_categories: serviceCategories,
        aadhaar_url: aadhaarNumber.replace(/\s/g, ''),
        aadhaar_front_url: aadhaarFrontUrl,
        aadhaar_back_url: aadhaarBackUrl,
        photo_url: photoUrl,
        upi_id: upiId.trim() || null,
        address: workerAddress.trim(),
        experience_years: experienceYears,
        verified: false,
        is_active: true,
        is_online: false,
        worker_code: generateWorkerCode(),
      }, { onConflict: 'id' })
      if (workerError) throw workerError

      signIn({ id: profile.id, name, phone, role: 'worker' })
      toast.success('Registration submitted! Admin will verify you shortly.')
      navigate('/worker')
    } catch (err: any) {
      console.error('Worker registration failed:', err)
      toast.error(err?.message || 'Registration failed, please try again')
    }
    setLoading(false)
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="min-h-dvh flex flex-col px-5 py-8">
      {/* invisible reCAPTCHA container — must stay in DOM */}
      <div id="recaptcha-container" />

      <button onClick={() => navigate('/')} className="text-slate-400 mb-6">← Back</button>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full ${stepIndex >= i ? 'bg-orange-500' : 'bg-slate-700'}`}
          />
        ))}
      </div>

      {step === 'info' && (
        <>
          <h1 className="text-2xl font-black font-heading text-slate-50 mb-6">Join as a Pro 🔧</h1>
          <div className="flex flex-col gap-4">
            <Input label="Full Name" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
            <div>
              <label className="block text-sm text-slate-400 mb-1 font-medium">
                Your Services <span className="text-slate-600">(select up to 2)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SERVICES.map(s => {
                  const selected = serviceCategories.includes(s.name)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setServiceCategories(prev => prev.filter(c => c !== s.name))
                        } else if (serviceCategories.length < 2) {
                          setServiceCategories(prev => [...prev, s.name])
                        } else {
                          toast.error('You can select up to 2 services')
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors text-left ${
                        selected
                          ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}
                    >
                      <span>{s.emoji}</span>
                      <span>{s.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <Input
              label="Phone Number"
              placeholder="10-digit mobile number"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
            />
            <Button size="lg" variant="accent" loading={loading} onClick={handleSendOtp}>
              Send OTP →
            </Button>
          </div>
        </>
      )}

      {step === 'otp' && (
        <>
          <h1 className="text-2xl font-black font-heading text-slate-50 mb-2">Verify Phone</h1>
          <p className="text-slate-400 mb-8">Sent to +91 {phone}</p>
          <div className="flex flex-col gap-6">
            <OtpInput value={otp} onChange={setOtp} />
            <Button size="lg" variant="accent" loading={loading} onClick={handleVerifyOtp}>
              Verify OTP →
            </Button>
          </div>
        </>
      )}

      {step === 'aadhaar' && (
        <>
          <h1 className="text-2xl font-black font-heading text-slate-50 mb-2">Aadhaar Verification</h1>
          <p className="text-slate-400 mb-6">Enter your 12-digit Aadhaar number</p>
          <Input
            label="Aadhaar Number"
            placeholder="XXXX XXXX XXXX"
            type="tel"
            inputMode="numeric"
            maxLength={14}
            value={aadhaarNumber}
            onChange={e => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
              setAadhaarNumber(digits.replace(/(\d{4})(?=\d)/g, '$1 '))
            }}
          />
          <p className="text-slate-600 text-xs mt-2 mb-4">Stored securely for admin verification only.</p>
          <Input
            label="UPI ID (for receiving payments)"
            placeholder="yourname@upi or phone@bank"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
          />
          <p className="text-slate-600 text-xs mt-2 mb-4">You can update this later in your profile.</p>
          <Input
            label="Your Address"
            placeholder="House no., Street, Area, City"
            value={workerAddress}
            onChange={e => setWorkerAddress(e.target.value)}
          />
          <div className="mt-4">
            <label className="block text-sm text-slate-400 mb-1 font-medium">Years of Experience</label>
            <div className="grid grid-cols-4 gap-2">
              {['0–1', '1–3', '3–5', '5–10', '10–15', '15–20', '20+'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setExperienceYears(opt)}
                  className={`py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    experienceYears === opt
                      ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-6" />
          <Button
            size="lg"
            variant="accent"
            onClick={() => {
              if (aadhaarNumber.replace(/\s/g, '').length !== 12) return toast.error('Enter valid 12-digit Aadhaar number')
              if (!workerAddress.trim()) return toast.error('Enter your address')
              if (!experienceYears) return toast.error('Select your years of experience')
              setStep('docs')
            }}
          >
            Continue →
          </Button>
        </>
      )}

      {step === 'docs' && (
        <>
          <h1 className="text-2xl font-black font-heading text-slate-50 mb-2">Aadhaar Card Photos</h1>
          <p className="text-slate-400 mb-6">Upload clear photos of both sides of your Aadhaar card</p>

          {/* Front side */}
          <div className="mb-5">
            <p className="text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2">
              <IdCard size={16} className="text-orange-400" /> Front Side
            </p>
            {aadhaarFrontPreview ? (
              <div className="relative">
                <img src={aadhaarFrontPreview} alt="Aadhaar front" className="w-full rounded-2xl object-cover border border-slate-700" style={{ maxHeight: 180 }} />
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-600/90 text-white text-xs font-bold px-2 py-1 rounded-lg">
                  <CheckCircle2 size={12} /> Uploaded
                </div>
                <button onClick={clearAadhaarFront} className="text-slate-500 text-xs text-center w-full mt-2">
                  Retake
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-slate-600 rounded-2xl p-6 text-center hover:border-orange-500 transition-colors">
                  <IdCard className="mx-auto text-slate-500 mb-2" size={32} />
                  <p className="text-slate-400 font-semibold text-sm">Tap to upload front</p>
                  <p className="text-slate-600 text-xs mt-1">Name &amp; photo side · JPG or PNG</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => pickImageFile(e, setAadhaarFrontFile, setAadhaarFrontPreview, aadhaarFrontUrlRef)}
                />
              </label>
            )}
          </div>

          {/* Back side */}
          <div className="mb-6">
            <p className="text-slate-300 text-sm font-semibold mb-2 flex items-center gap-2">
              <IdCard size={16} className="text-orange-400" /> Back Side
            </p>
            {aadhaarBackPreview ? (
              <div className="relative">
                <img src={aadhaarBackPreview} alt="Aadhaar back" className="w-full rounded-2xl object-cover border border-slate-700" style={{ maxHeight: 180 }} />
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-600/90 text-white text-xs font-bold px-2 py-1 rounded-lg">
                  <CheckCircle2 size={12} /> Uploaded
                </div>
                <button onClick={clearAadhaarBack} className="text-slate-500 text-xs text-center w-full mt-2">
                  Retake
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-slate-600 rounded-2xl p-6 text-center hover:border-orange-500 transition-colors">
                  <IdCard className="mx-auto text-slate-500 mb-2" size={32} />
                  <p className="text-slate-400 font-semibold text-sm">Tap to upload back</p>
                  <p className="text-slate-600 text-xs mt-1">Address &amp; barcode side · JPG or PNG</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => pickImageFile(e, setAadhaarBackFile, setAadhaarBackPreview, aadhaarBackUrlRef)}
                />
              </label>
            )}
          </div>

          <Button
            size="lg"
            variant="accent"
            onClick={() => {
              if (!aadhaarFrontFile) return toast.error('Upload the front side of your Aadhaar card')
              if (!aadhaarBackFile) return toast.error('Upload the back side of your Aadhaar card')
              setStep('photo')
            }}
          >
            Continue →
          </Button>
        </>
      )}

      {step === 'photo' && (
        <>
          <h1 className="text-2xl font-black font-heading text-slate-50 mb-2">Profile Photo</h1>
          <p className="text-slate-400 mb-6">Upload a clear photo of yourself</p>

          <label className="block cursor-pointer mb-4">
            <div className="border-2 border-dashed border-slate-600 rounded-2xl p-6 text-center hover:border-orange-500 transition-colors">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-32 h-32 rounded-full object-cover mx-auto" />
              ) : (
                <>
                  <Camera className="mx-auto text-slate-500 mb-2" size={36} />
                  <p className="text-slate-400 font-semibold text-sm">Tap to take or upload photo</p>
                  <p className="text-slate-600 text-xs mt-1">JPG or PNG · Face clearly visible</p>
                </>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={e => pickImageFile(e, setPhotoFile, setPhotoPreview, photoUrlRef)}
            />
          </label>

          {photoPreview && (
            <button
              onClick={() => {
                if (photoUrlRef.current) { URL.revokeObjectURL(photoUrlRef.current); photoUrlRef.current = '' }
                setPhotoFile(null); setPhotoPreview('')
              }}
              className="text-slate-500 text-xs text-center w-full mb-4"
            >
              Retake photo
            </button>
          )}

          <Button size="lg" variant="accent" loading={loading} onClick={handleComplete}>
            Complete Registration ✓
          </Button>
        </>
      )}
    </div>
  )
}
