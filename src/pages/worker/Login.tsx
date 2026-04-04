import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { OtpInput } from '../../components/OtpInput'
import { useAuth } from '../../context/AuthContext'
import {
  createRecaptchaVerifier,
  sendOtp,
  verifyOtp,
  firebaseAuthMessage,
  type ConfirmationResult,
  type RecaptchaVerifier,
} from '../../lib/firebaseOtp'
import { supabase } from '../../lib/supabase'

export default function WorkerLogin() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const verifierRef = useRef<RecaptchaVerifier | null>(null)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  function initVerifier() {
    try {
      verifierRef.current = createRecaptchaVerifier('recaptcha-container')
    } catch {
      console.error('reCAPTCHA failed to initialize')
    }
  }

  useEffect(() => {
    initVerifier()
    return () => {
      verifierRef.current?.clear()
      verifierRef.current = null
    }
  }, [])

  function resetVerifier() {
    try { verifierRef.current?.clear() } catch {}
    verifierRef.current = null
    initVerifier()
  }

  async function handleSendOtp() {
    if (phone.length !== 10 || !/^[6-9]/.test(phone)) return toast.error('Enter a valid 10-digit Indian mobile number')
    if (!verifierRef.current && !(window as any)?.Capacitor?.isNativePlatform?.()) return toast.error('reCAPTCHA not ready, refresh the page')
    setLoading(true)
    try {
      const { data: worker, error: workerLookupError } = await supabase
        .from('workers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (workerLookupError) throw workerLookupError
      if (!worker) {
        toast.error('No worker account found. Redirecting to registration...')
        setTimeout(() => navigate('/worker/register'), 1500)
        setLoading(false)
        return
      }

      const result = await sendOtp(phone, verifierRef.current)
      setConfirmationResult(result)
      setStep('otp')
      toast.success('OTP sent!')
    } catch (e: unknown) {
      toast.error(firebaseAuthMessage(e))
      resetVerifier()
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

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('phone', phone)
        .maybeSingle()

      if (profileError) throw profileError
      if (!profile || profile.role !== 'worker') {
        toast.error('No worker account found. Please register first.')
        navigate('/worker/register')
        setLoading(false)
        return
      }

      signIn({ id: profile.id, name: profile.name, phone, role: 'worker' })
      navigate('/worker')
    } catch (e: unknown) {
      toast.error(firebaseAuthMessage(e))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex flex-col px-5 py-8 bg-[var(--bg)]">
      <button onClick={() => navigate('/')} className="text-[var(--muted)] mb-6 text-sm flex items-center gap-1 w-fit">
        ← Back
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <img
          src="/logo.png"
          alt="GetMyPro"
          className="w-12 h-12 object-contain"
          onError={e => { e.currentTarget.src = '/logo.svg' }}
        />
        <div>
          <h1 className="text-2xl font-black font-heading gradient-text leading-none">
            {step === 'phone' ? 'Pro Login' : 'Verify OTP'}
          </h1>
          <p className="text-[var(--muted)] text-sm mt-0.5">
            {step === 'phone' ? 'Welcome back, Pro!' : `Code sent to +91 ${phone}`}
          </p>
        </div>
      </div>

      {step === 'phone' ? (
        <div className="flex flex-col gap-4">
          <Input
            label="Registered Phone Number"
            placeholder="10-digit mobile number"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
          />
          <div className="flex justify-center my-1">
            <div id="recaptcha-container" />
          </div>
          <Button size="lg" variant="accent" loading={loading} onClick={handleSendOtp}>
            Send OTP →
          </Button>
          <button
            onClick={() => navigate('/worker/register')}
            className="text-blue-400 text-sm text-center"
          >
            New here? Register as a Pro
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <OtpInput value={otp} onChange={setOtp} />
          <Button size="lg" variant="accent" loading={loading} onClick={handleVerifyOtp}>
            Verify & Enter →
          </Button>
          <button onClick={() => setStep('phone')} className="text-slate-400 text-sm text-center">
            Change number
          </button>
        </div>
      )}
    </div>
  )
}
