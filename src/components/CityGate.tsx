import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MapPin, Loader2, RefreshCw } from 'lucide-react'

type GateState = 'checking' | 'available' | 'unavailable' | 'denied' | 'error'

const CITY_KEY      = 'gmp_detected_city'
const CITY_TIME_KEY = 'gmp_city_cache_time'
const CITY_TTL_MS   = 24 * 60 * 60 * 1000 // 24 hours

async function getCityFromCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'GetMyPro/1.0' } }
    )
    const data = await res.json()
    const a = data.address ?? {}
    // Nominatim uses different keys depending on settlement size
    return a.city || a.town || a.village || a.county || null
  } catch {
    return null
  }
}

const RADIUS_KM = 10

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface CityRecord { city_name: string; lat: number | null; lng: number | null }

// Returns the matching city name if serviceable (by name or within 10km radius), else null
async function findServiceableCity(
  detectedName: string,
  userLat: number,
  userLng: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from('service_cities')
    .select('city_name, lat, lng')
    .eq('is_active', true)
  // Fail open on DB error
  if (error) return detectedName

  const cities: CityRecord[] = data || []

  // 1. Exact name match
  const byName = cities.find(c => c.city_name.toLowerCase() === detectedName.toLowerCase())
  if (byName) return byName.city_name

  // 2. Within 10km of any active city center
  const nearby = cities.find(c =>
    c.lat != null && c.lng != null &&
    distanceKm(userLat, userLng, c.lat, c.lng) <= RADIUS_KM
  )
  if (nearby) return nearby.city_name

  return null
}

async function getActiveCities(): Promise<string[]> {
  const { data, error } = await supabase
    .from('service_cities')
    .select('city_name')
    .eq('is_active', true)
    .order('city_name')
  if (error) return []
  return (data || []).map(c => c.city_name)
}

export function CityGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [state, setState] = useState<GateState>('checking')
  const [detectedCity, setDetectedCity] = useState<string>('')
  const [activeCities, setActiveCities] = useState<string[]>([])

  // Allow Play Store reviewers to bypass geo-lock
  const [demoMode, setDemoMode] = useState(() => localStorage.getItem('gmp_demo_mode') === '1')

  function enableDemoMode() {
    localStorage.setItem('gmp_demo_mode', '1')
    localStorage.setItem(CITY_KEY, 'Demo')
    setDemoMode(true)
  }

  useEffect(() => {
    if (demoMode) return

    // If we have a recent city cache, let the user straight through and
    // re-verify in the background.  This prevents Android's location-permission
    // auto-revoke (12+ inactivity policy) from blocking a returning user.
    const cachedCity = localStorage.getItem(CITY_KEY)
    const cachedAt   = parseInt(localStorage.getItem(CITY_TIME_KEY) || '0', 10)
    if (cachedCity && Date.now() - cachedAt < CITY_TTL_MS) {
      setState('available')
      // Background re-check: silently update the cache timestamp on success,
      // or clear it if the city was deactivated (user will be gated next open).
      checkInBackground(cachedCity)
      return
    }

    check()
  }, [])

  /** Silent background verification — never changes visible state. */
  async function checkInBackground(cachedCity: string) {
    try {
      const { data } = await supabase
        .from('service_cities')
        .select('city_name')
        .eq('city_name', cachedCity)
        .eq('is_active', true)
        .maybeSingle()
      if (data) {
        // City still active — refresh the cache timestamp
        localStorage.setItem(CITY_TIME_KEY, String(Date.now()))
      } else {
        // City deactivated — clear cache so next open triggers full check
        localStorage.removeItem(CITY_KEY)
        localStorage.removeItem(CITY_TIME_KEY)
      }
    } catch {
      // Network error — keep existing cache, try again next open
    }
  }

  function check() {
    setState('checking')
    setDetectedCity('')

    if (!navigator.geolocation) {
      setState('error')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const city = await getCityFromCoords(latitude, longitude)
        // Use raw GPS coords even if reverse-geocode fails, for radius check
        const displayCity = city || 'your area'
        setDetectedCity(displayCity)

        const [matchedCity, cities] = await Promise.all([
          findServiceableCity(displayCity, latitude, longitude),
          getActiveCities(),
        ])
        setActiveCities(cities)
        if (matchedCity) {
          // Use the matched city name (not the village name) for order stamping
          localStorage.setItem(CITY_KEY, matchedCity)
          localStorage.setItem(CITY_TIME_KEY, String(Date.now()))
          setState('available')
        } else {
          // Not serviceable — clear any stale cache
          localStorage.removeItem(CITY_KEY)
          localStorage.removeItem(CITY_TIME_KEY)
          setState('unavailable')
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState('denied')
        else setState('error')
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }

  // Demo mode: skip geo-gate entirely (for Play Store review)
  if (demoMode) return <>{children}</>

  if (state === 'checking') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--bg)] gap-4 px-8">
        <img
          src="/logo.png"
          alt="GetMyPro"
          className="w-20 h-20 object-contain mb-2"
          onError={e => { e.currentTarget.src = '/logo.svg' }}
        />
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <p className="text-slate-400 text-sm text-center">Checking service availability in your area...</p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--bg)] px-8 text-center gap-5">
        <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center">
          <MapPin size={36} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-50 mb-2">Location Access Needed</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Getmypro needs your location to check if we service your area.
            Please enable location access in your phone settings and try again.
          </p>
        </div>
        <button
          onClick={check}
          className="flex items-center gap-2 gradient-brand text-white font-bold px-6 py-3 rounded-2xl"
        >
          <RefreshCw size={16} /> Try Again
        </button>
        <p className="text-slate-600 text-xs">
          Settings → Apps → GetMyPro → Permissions → Location → Allow
        </p>
        <button onClick={enableDemoMode} className="text-slate-500 text-xs underline mt-4">
          Browse in demo mode
        </button>
      </div>
    )
  }

  if (state === 'unavailable') {
    return (
      <div className="min-h-dvh flex flex-col bg-[var(--bg)] px-6 py-12 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/logo.png"
            alt="GetMyPro"
            className="w-24 h-24 object-contain mb-4"
            onError={e => { e.currentTarget.src = '/logo.svg' }}
          />
          <h1 className="text-4xl font-black font-heading gradient-text leading-none mb-1">GetMyPro</h1>
          <p className="text-slate-400 text-sm">Trusted home services, on demand</p>
        </div>

        {/* Coming soon card */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 mb-4 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-slate-50 font-black text-xl mb-2">
            Coming Soon to {detectedCity}!
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            We're not in <span className="text-white font-semibold">{detectedCity}</span> just yet,
            but we're expanding fast across Andhra Pradesh.
            We'll notify you as soon as we launch in your city!
          </p>
        </div>

        {/* Active cities */}
        {activeCities.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-4">
            <p className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-3">
              Currently available in
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCities.map(city => (
                <span
                  key={city}
                  className="text-sm bg-blue-500/20 text-blue-300 font-semibold px-3 py-1.5 rounded-full"
                >
                  📍 {city}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-center">
          <p className="text-slate-400 text-sm mb-3">Want us in your city sooner?</p>
          <a href="mailto:getmypro.care@gmail.com" className="block text-blue-400 text-sm font-semibold mb-2">
            getmypro.care@gmail.com
          </a>
          <a href="tel:+918985614758" className="block text-green-400 text-sm font-semibold">
            +91 89856 14758
          </a>
        </div>

        {/* Legal links */}
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {[
            { label: 'Privacy Policy', path: '/legal/privacy-policy' },
            { label: 'Terms & Conditions', path: '/legal/terms' },
            { label: 'Refund Policy', path: '/legal/refund-policy' },
            { label: 'About Us', path: '/legal/about' },
          ].map(l => (
            <button
              key={l.path}
              onClick={() => navigate(l.path)}
              className="text-slate-500 text-xs underline underline-offset-2"
            >
              {l.label}
            </button>
          ))}
        </div>

        <button
          onClick={check}
          className="mt-4 text-slate-500 text-xs text-center flex items-center justify-center gap-1"
        >
          <RefreshCw size={12} /> Refresh location
        </button>
        <button onClick={enableDemoMode} className="text-slate-500 text-xs underline mt-2">
          Browse in demo mode
        </button>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--bg)] px-8 text-center gap-5">
        <div className="text-5xl">⚠️</div>
        <div>
          <h1 className="text-xl font-black text-slate-50 mb-2">Could Not Detect Location</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Please check your internet connection and make sure location is enabled, then try again.
          </p>
        </div>
        <button
          onClick={check}
          className="flex items-center gap-2 gradient-brand text-white font-bold px-6 py-3 rounded-2xl"
        >
          <RefreshCw size={16} /> Retry
        </button>
        <button onClick={enableDemoMode} className="text-slate-500 text-xs underline mt-4">
          Browse in demo mode
        </button>
      </div>
    )
  }

  // state === 'available'
  return <>{children}</>
}
