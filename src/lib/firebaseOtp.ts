import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth'
import { auth } from './firebase'

export type { ConfirmationResult, RecaptchaVerifier }

// ── Play Store review test credentials ──────────────────────────────────────
export const TEST_PHONE = '0000000000'
export const TEST_OTP   = '123456'

// Stores verification state on native platform between sendOtp and verifyOtp calls
let nativeVerificationId: string | null = null
let nativePhone: string | null = null

/** Returns true when running inside a Capacitor native app (Android/iOS) */
function isNativePlatform(): boolean {
  return !!(window as any)?.Capacitor?.isNativePlatform?.()
}

export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
  if (isNativePlatform()) return null
  const el = document.getElementById(containerId)
  if (!el) throw new Error(`reCAPTCHA container #${containerId} not found`)
  return new RecaptchaVerifier(el, { size: 'invisible' }, auth)
}

/** Translate Firebase error codes into plain English for the user. */
export function firebaseAuthMessage(err: unknown): string {
  const code = (err as any)?.code ?? ''
  console.error('[FirebaseAuth] code:', code, '| message:', (err as any)?.message)
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Invalid phone number. Enter a valid 10-digit number.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.'
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded. Try again later.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/invalid-verification-code':
    case 'auth/invalid-credential':
      return 'Incorrect OTP. Please check and try again.'
    case 'auth/code-expired':
      return 'OTP has expired. Please request a new one.'
    case 'auth/missing-verification-code':
      return 'Please enter the 6-digit OTP.'
    case 'auth/invalid-app-credential':
    case 'auth/captcha-check-failed':
      return 'Verification failed. Please try again.'
    case 'auth/unauthorized-domain':
      return 'App domain not authorized. Contact support.'
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.'
    default:
      return (err as any)?.message || 'Authentication failed. Please try again.'
  }
}

function getPlugin() {
  const plugin = (window as any).Capacitor?.Plugins?.FirebaseAuthentication
  if (!plugin) throw new Error('FirebaseAuthentication plugin not available')
  return plugin
}

export async function sendOtp(
  phone: string,
  verifier: RecaptchaVerifier | null
): Promise<ConfirmationResult | null> {
  if (phone === TEST_PHONE) return null

  if (isNativePlatform()) {
    const plugin = getPlugin()
    nativeVerificationId = await new Promise<string>((resolve, reject) => {
      let codeSentHandle: any
      let failedHandle: any
      const cleanup = () => {
        try { codeSentHandle?.remove() } catch {}
        try { failedHandle?.remove() } catch {}
      }

      // addListener may return a handle directly OR a Promise<handle> depending
      // on the plugin version — handle both cases safely
      const assignHandle = (result: any, setter: (h: any) => void) => {
        if (result && typeof result.then === 'function') {
          result.then((h: any) => setter(h))
        } else {
          setter(result)
        }
      }

      assignHandle(
        plugin.addListener('phoneCodeSent', (e: any) => {
          cleanup()
          resolve(e.verificationId)
        }),
        (h) => { codeSentHandle = h }
      )

      assignHandle(
        plugin.addListener('phoneVerificationFailed', (e: any) => {
          cleanup()
          reject(new Error(e.message || 'Phone verification failed'))
        }),
        (h) => { failedHandle = h }
      )

      plugin.signInWithPhoneNumber({ phoneNumber: `+91${phone}` }).catch((err: any) => {
        cleanup()
        reject(err)
      })
    })
    nativePhone = phone
    return null
  }
  return signInWithPhoneNumber(auth, `+91${phone}`, verifier!)
}

export async function verifyOtp(
  confirmationResult: ConfirmationResult | null,
  otp: string,
  phone?: string
): Promise<void> {
  if (phone === TEST_PHONE) {
    if (otp !== TEST_OTP) throw { code: 'auth/invalid-verification-code' }
    return
  }

  if (isNativePlatform()) {
    if (!nativeVerificationId) throw new Error('No verification session. Please request OTP again.')
    const plugin = getPlugin()
    await plugin.signInWithPhoneNumber({
      phoneNumber: `+91${nativePhone}`,
      verificationId: nativeVerificationId,
      verificationCode: otp,
    })
    nativeVerificationId = null
    nativePhone = null
    return
  }
  await confirmationResult!.confirm(otp)
}
