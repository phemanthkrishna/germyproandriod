import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  type ConfirmationResult,
} from 'firebase/auth'
import { auth } from './firebase'

export type { ConfirmationResult, RecaptchaVerifier }

// Stores verification state on native platform between sendOtp and verifyOtp calls
let nativeVerificationId: string | null = null
let nativePhone: string | null = null

/** Returns true when running inside a Capacitor native app (Android/iOS) */
function isNativePlatform(): boolean {
  return !!(window as any)?.Capacitor?.isNativePlatform?.()
}

export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
  // Native Android/iOS uses the Firebase SDK directly — no reCAPTCHA needed
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
  if (isNativePlatform()) {
    const plugin = getPlugin()
    nativeVerificationId = await new Promise<string>((resolve, reject) => {
      // Register listeners and kick off the OTP request simultaneously
      plugin.addListener('phoneCodeSent', (e: any) => resolve(e.verificationId))
      plugin.addListener('phoneVerificationFailed', (e: any) =>
        reject(new Error(e.message || 'Phone verification failed'))
      )
      plugin.signInWithPhoneNumber({ phoneNumber: `+91${phone}` }).catch(reject)
    })
    nativePhone = phone
    return null
  }
  return signInWithPhoneNumber(auth, `+91${phone}`, verifier!)
}

export async function verifyOtp(
  confirmationResult: ConfirmationResult | null,
  otp: string
): Promise<void> {
  if (isNativePlatform()) {
    if (!nativeVerificationId) throw new Error('No verification session. Please request OTP again.')
    const plugin = getPlugin()
    // Call signInWithPhoneNumber again with verificationId + code to confirm
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
