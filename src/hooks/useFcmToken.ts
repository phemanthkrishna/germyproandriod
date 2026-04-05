import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Requests notification permission and saves the FCM token to the database.
 * For workers: saves to `workers.fcm_token`
 * For customers: saves to `profiles.fcm_token`
 */
export function useFcmToken(userId: string | undefined, role: 'worker' | 'customer' | 'admin' | undefined) {
  useEffect(() => {
    if (!userId || !role || role === 'admin') return

    const plugin = (window as any).Capacitor?.Plugins?.FirebaseMessaging
    if (!plugin) return  // not on native

    async function registerToken() {
      try {
        // Request permission
        const { receive } = await plugin.requestPermissions()
        if (receive !== 'granted') return

        // Get token
        const { token } = await plugin.getToken()
        if (!token) return

        // Save to appropriate table
        const table = role === 'worker' ? 'workers' : 'profiles'
        await supabase.from(table).update({ fcm_token: token }).eq('id', userId)

        // Listen for token refresh
        plugin.addListener('tokenReceived', async (event: { token: string }) => {
          await supabase.from(table).update({ fcm_token: event.token }).eq('id', userId)
        })
      } catch (err) {
        console.error('FCM token registration failed:', err)
      }
    }

    registerToken()
  }, [userId, role])
}
