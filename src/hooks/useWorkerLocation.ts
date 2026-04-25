import { useEffect, useRef } from 'react'
import { ref, set, remove } from 'firebase/database'
import { database } from '../lib/firebase'

export function useWorkerLocation(workerId: string, isActive: boolean) {
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isActive || !workerId || !navigator.geolocation) return

    const locRef = ref(database, `worker_locations/${workerId}`)

    function pushPosition(pos: GeolocationPosition) {
      set(locRef, {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        ts: Date.now(),
      })
    }

    function handleError(err: GeolocationPositionError) {
      console.error('Worker GPS error:', err.code, err.message)
    }

    const geoOpts: PositionOptions = { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }

    // Explicitly request permission first — required on Android WebView
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pushPosition(pos)

        // Start continuous watch
        watchIdRef.current = navigator.geolocation.watchPosition(
          pushPosition,
          handleError,
          geoOpts
        )

        // Fallback interval: Android WebView may pause watchPosition in background.
        // Poll every 10s to ensure location keeps flowing.
        intervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(pushPosition, handleError, geoOpts)
        }, 10_000)
      },
      (err) => {
        console.error('Worker GPS permission error:', err.code, err.message)
        // Even if high-accuracy fails, try polling with lower accuracy
        intervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            pushPosition,
            handleError,
            { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 }
          )
        }, 10_000)
      },
      geoOpts
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      remove(locRef)
    }
  }, [workerId, isActive])
}
