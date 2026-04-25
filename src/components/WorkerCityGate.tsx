import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MapPin, Loader2, RefreshCw } from 'lucide-react'

type GateState = 'checking' | 'available' | 'unavailable' | 'denied' | 'error'

async function getCityFromCoords(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'GetMyPro/1.0' } }
    )
    const data = await res.json()
    const a = data.address ?? {}
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

async function findServiceableCity(
  detectedName: string,
  userLat: number,
  userLng: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from('service_cities')
    .select('city_name, lat, lng')
    .eq('is_active', true)
  if (error) return detectedName // fail open on DB error

  const cities: CityRecord[] = data || []

  const byName = cities.find(c => c.city_name.toLowerCase() === detectedName.toLowerCase())
  if (byName) return byName.city_name

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

const CACHE_KEY_CITY  = 'gmp_detected_city'
const CACHE_KEY_TIME  = 'gmp_city_checked_at'
const CACHE_TTL_MS    = 24 * 60 * 60 * 1000   // 24 hours

function getCachedCity(): string | null {
  const city      = localStorage.getItem(CACHE_KEY_CITY)
  const checkedAt = localStorage.getItem(CACHE_KEY_TIME)
  if (!city || !checkedAt) return null
  if (Date.now() - Number(checkedAt) > CACHE_TTL_MS) return null
  return city
}

function setCityCache(city: string) {
  localStorage.setItem(CACHE_KEY_CITY, city)
  localStorage.setItem(CACHE_KEY_TIME, String(Date.now()))
}

export function WorkerCityGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  // Allow Play Store reviewers to bypass geo-lock
  const [demoMode, setDemoMode] = useState(
    () => localStorage.getItem('gmp_worker_demo') === '1'
  )

  // Start as 'available' immediately if we have a fresh cached city
  const [state, setState] = useState<GateState>(() => {
    if (localStorage.getItem('gmp_worker_demo') === '1') return 'available'
    return getCachedCity() ? 'available' : 'checking'
  })
  const [detectedCity, setDetectedCity] = useState<string>('')
  const [activeCities, setActiveCities] = useState<string[]>([])

  function enableDemoMode() {
    localStorage.setItem('gmp_worker_demo', '1')
    setCityCache('Demo')
    setDemoMode(true)
  }

  useEffect(() => {
    if (demoMode) return
    // If cache is valid, skip the geo-check entirely — no delay for the worker
    if (getCachedCity()) return
    check()
  }, [])

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
        const displayCity = city || 'your area'
        setDetectedCity(displayCity)

        const [matchedCity, cities] = await Promise.all([
          findServiceableCity(displayCity, latitude, longitude),
          getActiveCities(),
        ])
        setActiveCities(cities)
        if (matchedCity) {
          setCityCache(matchedCity)
          setState('available')
        } else {
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
          src="/logoworker.png"
          alt="GetMyPro Partner"
          className="w-20 h-20 object-contain mb-2"
          onError={e => { if (!e.currentTarget.dataset.errored) { e.currentTarget.dataset.errored = '1'; e.currentTarget.style.display = 'none' } }}
        />
        <Loader2 className="animate-spin text-[#F47820]" size={32} />
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
            GetMyPro Partner needs your location to check if we operate in your area.
            Please enable location access in your phone settings and try again.
          </p>
        </div>
        <button
          onClick={check}
          className="flex items-center gap-2 bg-[#F47820] text-white font-bold px-6 py-3 rounded-2xl"
        >
          <RefreshCw size={16} /> Try Again
        </button>
        <p className="text-slate-600 text-xs">
          Settings → Apps → GetMyPro Partner → Permissions → Location → Allow
        </p>
        <button
          onClick={enableDemoMode}
          className="text-slate-500 text-xs underline mt-4"
        >
          Browse as Demo Worker
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
            src="/logoworker.png"
            alt="GetMyPro Partner"
            className="w-24 h-24 object-contain mb-4"
            onError={e => { if (!e.currentTarget.dataset.errored) { e.currentTarget.dataset.errored = '1'; e.currentTarget.style.display = 'none' } }}
          />
          <h1 className="text-4xl font-black font-heading text-[#F47820] leading-none mb-1">GetMyPro</h1>
          <p className="text-slate-400 text-sm">Partner App — Earn with your skills</p>
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
            Register your interest and we'll notify you when we launch!
          </p>
        </div>

        {/* Active cities */}
        {activeCities.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mb-4">
            <p className="text-orange-400 text-xs font-bold uppercase tracking-wide mb-3">
              Currently active in
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCities.map(city => (
                <span
                  key={city}
                  className="text-sm bg-orange-500/20 text-orange-300 font-semibold px-3 py-1.5 rounded-full"
                >
                  📍 {city}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-center">
          <p className="text-slate-400 text-sm mb-3">Want to work with us?</p>
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
        <button
          onClick={enableDemoMode}
          className="text-slate-500 text-xs underline mt-2 text-center"
        >
          Browse as Demo Worker
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
          className="flex items-center gap-2 bg-[#F47820] text-white font-bold px-6 py-3 rounded-2xl"
        >
          <RefreshCw size={16} /> Retry
        </button>
        <button
          onClick={enableDemoMode}
          className="text-slate-500 text-xs underline mt-4"
        >
          Browse as Demo Worker
        </button>
      </div>
    )
  }

  // state === 'available'
  return <>{children}</>
}
