import { useState, useEffect, useCallback, useRef } from 'react'
import { useJsApiLoader, GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api'
import { ref, onValue } from 'firebase/database'
import { database } from '../lib/firebase'
import { useTheme } from '../context/ThemeContext'
import { Clock, MapPin } from 'lucide-react'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

const darkStyles = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#2b2b2b' }] },
]

// Home marker: dark circle + white house (Lucide Home path, 24x24 centered in 44x44)
const HOME_ICON = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'><circle cx='22' cy='22' r='22' fill='%231e293b'/><g transform='translate(10,10)' stroke='white' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><path d='M9 22V12h6v10'/></g></svg>`

// Worker marker: orange circle + white wrench (Lucide Wrench 24x24 centered in 48x48)
const SCOOTER_ICON = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'><circle cx='24' cy='24' r='24' fill='%23f97316'/><g transform='translate(12,12)' stroke='white' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'/></g></svg>`

interface Props {
  workerId: string
  workerName: string
  customerLat?: number | null
  customerLng?: number | null
}

interface WorkerPos { lat: number; lng: number }

export function LiveTrackingMap({ workerId, workerName, customerLat, customerLng }: Props) {
  const { theme } = useTheme()

  // All hooks must be called before any early return
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: MAPS_KEY || 'x',
  })

  const [workerPos, setWorkerPos] = useState<WorkerPos | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [eta, setEta] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<google.maps.Map | null>(null)
  const lastDirKey = useRef('')

  const initialCenter = useRef<WorkerPos>(
    customerLat && customerLng
      ? { lat: customerLat, lng: customerLng }
      : { lat: 12.9716, lng: 77.5946 }
  )

  // Subscribe to worker live location
  useEffect(() => {
    try {
      const locRef = ref(database, `worker_locations/${workerId}`)
      const unsub = onValue(locRef, snapshot => {
        const data = snapshot.val()
        if (data?.lat && data?.lng) setWorkerPos({ lat: data.lat, lng: data.lng })
      }, error => {
        console.error('Firebase location read failed:', error.message)
      })
      return () => unsub()
    } catch (err) {
      console.error('Firebase RTDB init failed:', err)
    }
  }, [workerId])

  // Request driving directions whenever worker moves ~100 m or customer changes
  useEffect(() => {
    if (!mapReady || !workerPos || !customerLat || !customerLng || !window.google) return

    const key = `${workerPos.lat.toFixed(3)},${workerPos.lng.toFixed(3)},${customerLat},${customerLng}`
    if (key === lastDirKey.current) return
    lastDirKey.current = key

    const svc = new window.google.maps.DirectionsService()
    svc.route(
      {
        origin: workerPos,
        destination: { lat: customerLat, lng: customerLng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          setDirections(result)
          const dur = result.routes[0]?.legs[0]?.duration?.text
          setEta(dur ?? null)
          const bounds = result.routes[0]?.bounds
          if (bounds && mapRef.current) {
            mapRef.current.fitBounds(bounds, 48)
          }
        }
      }
    )
  }, [workerPos, customerLat, customerLng, mapReady])

  // Fit bounds using raw positions when directions aren't available yet
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google || directions) return
    if (workerPos && customerLat && customerLng) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(workerPos)
      bounds.extend({ lat: customerLat, lng: customerLng })
      mapRef.current.fitBounds(bounds, 60)
    } else if (workerPos) {
      mapRef.current.panTo(workerPos)
    } else if (customerLat && customerLng) {
      mapRef.current.panTo({ lat: customerLat, lng: customerLng })
    }
  }, [workerPos, customerLat, customerLng, mapReady, directions])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    setMapReady(true)
  }, [])

  // Fallback if Maps API key is missing or failed to load
  if (!MAPS_KEY || loadError) {
    return (
      <div>
        <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mb-2">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
            <Clock size={15} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-xs">Estimated arrival</p>
            {workerPos ? (
              <p className="text-slate-300 font-semibold text-sm">Pro is on the way</p>
            ) : (
              <p className="text-slate-500 text-sm animate-pulse">Waiting for partner…</p>
            )}
          </div>
          {workerPos && (
            <div className="flex items-center gap-1 bg-green-500/15 border border-green-500/30 rounded-lg px-2.5 py-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs font-semibold">Live</span>
            </div>
          )}
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center" style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="text-slate-500 text-sm">Map loading failed — your Pro is still being tracked</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ETA banner */}
      <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mb-2">
        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
          <Clock size={15} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-xs">Estimated arrival</p>
          {eta ? (
            <p className="text-slate-50 font-black text-lg leading-tight">{eta}</p>
          ) : workerPos ? (
            <p className="text-slate-300 font-semibold text-sm">Calculating route…</p>
          ) : (
            <p className="text-slate-500 text-sm animate-pulse">Waiting for partner…</p>
          )}
        </div>
        {eta && (
          <div className="flex items-center gap-1 bg-green-500/15 border border-green-500/30 rounded-lg px-2.5 py-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-semibold">Live</span>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-slate-700" style={{ height: 240 }}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '264px' }}
            center={initialCenter.current}
            zoom={15}
            onLoad={onMapLoad}
            options={{ disableDefaultUI: true, styles: theme === 'dark' ? darkStyles : [] }}
          >
            {/* Blue driving route */}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: '#2563eb',
                    strokeWeight: 5,
                    strokeOpacity: 0.9,
                  },
                }}
              />
            )}

            {/* Customer — home icon */}
            {customerLat && customerLng && (
              <Marker
                position={{ lat: customerLat, lng: customerLng }}
                icon={{
                  url: HOME_ICON,
                  scaledSize: new window.google.maps.Size(44, 44),
                  anchor: new window.google.maps.Point(22, 22),
                }}
              />
            )}

            {/* Worker — scooter icon */}
            {workerPos && (
              <Marker
                position={workerPos}
                icon={{
                  url: SCOOTER_ICON,
                  scaledSize: new window.google.maps.Size(48, 48),
                  anchor: new window.google.maps.Point(24, 24),
                }}
              />
            )}
          </GoogleMap>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', color: 'var(--muted)', fontSize: 13 }}>
            Loading map…
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: '#1e293b' }} />
          <span className="text-slate-500 text-xs">Your location</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
          <span className="text-slate-500 text-xs">{workerName || 'Partner'}</span>
        </div>
        {!workerPos && (
          <span className="text-slate-600 text-xs ml-auto animate-pulse flex items-center gap-1">
            <MapPin size={10} /> Locating partner…
          </span>
        )}
      </div>
    </div>
  )
}
