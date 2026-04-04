import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  type ConfirmationResult,
} from 'firebase/auth'
import { auth } from './firebase'

export type { ConfirmationResult, RecaptchaVerifier }

// Stores verificationId on native platform between sendOtp and verifyOtp calls
let nativeVerificationId: string | null = null

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

export async function sendOtp(
  phone: string,
  verifier: RecaptchaVerifier | null
): Promise<ConfirmationResult | null> {
  if (isNativePlatform()) {
    // Access plugin via Capacitor's plugin registry — avoids ES module import issues
    const FirebaseAuthentication = (window as any).Capacitor?.Plugins?.FirebaseAuthentication
    if (!FirebaseAuthentication) throw new Error('FirebaseAuthentication plugin not available')

    // v6+ API: signInWithPhoneNumber returns void and fires events
    nativeVerificationId = await new Promise<string>((resolve, reject) => {
      Promise.all([
        FirebaseAuthentication.addListener('phoneCodeSent', (event: any) => {
          resolve(event.verificationId)
        }),
        FirebaseAuthentication.addListener('phoneVerificationFailed', (event: any) => {
          reject(new Error(event.message || 'Phone verification failed'))
        }),
      ]).then(() => {
        FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: `+91${phone}` }).catch(reject)
      })
    })

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
    const credential = PhoneAuthProvider.credential(nativeVerificationId, otp)
    await signInWithCredential(auth, credential)
    nativeVerificationId = null
    return
  }
  await confirmationResult!.confirm(otp)
}
