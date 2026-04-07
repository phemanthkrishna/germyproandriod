import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { BottomNav } from '../../components/BottomNav'
import { ClipboardList, Users, DollarSign, Package, Store, MapPin, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'

const NAV = [
  { to: '/admin',           icon: ClipboardList, label: 'Orders'   },
  { to: '/admin/workers',   icon: Users,         label: 'Workers'  },
  { to: '/admin/payments',  icon: DollarSign,    label: 'Payments' },
  { to: '/admin/materials', icon: Package,       label: 'Materials'},
  { to: '/admin/stores',    icon: Store,         label: 'Stores'   },
  { to: '/admin/cities',    icon: MapPin,        label: 'Cities'   },
]

interface CityRow {
  id: string
  city_name: string
  state: string
  is_active: boolean
  created_at: string
}

export default function AdminCities() {
  const [cities, setCities] = useState<CityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [cityName, setCityName] = useState('')
  const [stateName, setStateName] = useState('Andhra Pradesh')
  const [cityLat, setCityLat] = useState('')
  const [cityLng, setCityLng] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { fetchCities() }, [])

  async function fetchCities() {
    setLoading(true)
    const { data, error } = await supabase
      .from('service_cities')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) toast.error('Failed to load cities')
    setCities(data || [])
    setLoading(false)
  }

  async function toggleCity(city: CityRow) {
    setSaving(city.id)
    const { error } = await supabase
      .from('service_cities')
      .update({ is_active: !city.is_active })
      .eq('id', city.id)
    if (error) {
      toast.error('Failed to update city')
    } else {
      toast.success(`${city.city_name} ${!city.is_active ? 'activated ✓' : 'deactivated'}`)
      setCities(prev => prev.map(c => c.id === city.id ? { ...c, is_active: !c.is_active } : c))
    }
    setSaving(null)
  }

  async function addCity() {
    if (!cityName.trim()) return toast.error('Enter a city name')
    if (!stateName.trim()) return toast.error('Enter a state name')
    setAdding(true)
    const { error } = await supabase
      .from('service_cities')
      .insert({
        city_name: cityName.trim(),
        state: stateName.trim(),
        is_active: false,
        lat: cityLat ? parseFloat(cityLat) : null,
        lng: cityLng ? parseFloat(cityLng) : null,
      })
    if (error) {
      toast.error(error.message.includes('unique') ? 'City already exists' : 'Failed to add city')
    } else {
      toast.success(`${cityName} added (inactive — toggle to activate)`)
      setCityName('')
      setCityLat('')
      setCityLng('')
      setShowForm(false)
      fetchCities()
    }
    setAdding(false)
  }

  async function deleteCity(city: CityRow) {
    if (!confirm(`Remove ${city.city_name}? This cannot be undone.`)) return
    setSaving(city.id)
    const { error } = await supabase.from('service_cities').delete().eq('id', city.id)
    if (error) {
      toast.error('Failed to delete city')
    } else {
      toast.success(`${city.city_name} removed`)
      setCities(prev => prev.filter(c => c.id !== city.id))
    }
    setSaving(null)
  }

  const activeCount = cities.filter(c => c.is_active).length

  return (
    <div className="page-content px-5 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black font-heading text-slate-50">Service Cities</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {activeCount} active · {cities.length} total
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl"
        >
          <Plus size={15} /> Add City
        </button>
      </div>

      {/* Add city form */}
      {showForm && (
        <Card className="mb-5 border-blue-500/30">
          <p className="text-slate-50 font-bold mb-3">Add New City</p>
          <div className="flex flex-col gap-3">
            <Input
              label="City Name"
              placeholder="e.g. Vizianagaram"
              value={cityName}
              onChange={e => setCityName(e.target.value)}
            />
            <Input
              label="State"
              placeholder="e.g. Andhra Pradesh"
              value={stateName}
              onChange={e => setStateName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                label="Latitude"
                placeholder="e.g. 18.5730"
                value={cityLat}
                onChange={e => setCityLat(e.target.value)}
              />
              <Input
                label="Longitude"
                placeholder="e.g. 83.3599"
                value={cityLng}
                onChange={e => setCityLng(e.target.value)}
              />
            </div>
            <p className="text-slate-500 text-xs">
              Lat/lng enables 10km radius coverage for villages near the city.
              Find coordinates on Google Maps.
            </p>
            <p className="text-slate-500 text-xs">
              New cities are added as <span className="text-amber-400 font-semibold">inactive</span> — toggle them on when you're ready to launch.
            </p>
            <div className="flex gap-2">
              <Button size="sm" loading={adding} onClick={addCity}>Add City</Button>
              <button
                onClick={() => { setShowForm(false); setCityName('') }}
                className="px-4 py-2 bg-slate-700 text-slate-300 text-sm font-bold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Cities list */}
      {loading ? (
        <p className="text-slate-400 text-sm text-center py-8">Loading...</p>
      ) : cities.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-8">No cities yet</p>
      ) : (
        <div className="flex flex-col gap-3">
          {cities.map(city => (
            <div
              key={city.id}
              className={`bg-[var(--surface)] border rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors ${
                city.is_active
                  ? 'border-green-500/30 bg-green-500/5'
                  : 'border-[var(--border)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  city.is_active ? 'bg-green-500/20' : 'bg-slate-700'
                }`}>
                  <MapPin size={18} className={city.is_active ? 'text-green-400' : 'text-slate-500'} />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-50 font-bold text-sm">{city.city_name}</p>
                  <p className="text-slate-400 text-xs">{city.state}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  city.is_active
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {city.is_active ? 'Active' : 'Inactive'}
                </span>

                <button
                  onClick={() => toggleCity(city)}
                  disabled={saving === city.id}
                  className="text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
                >
                  {city.is_active
                    ? <ToggleRight size={28} className="text-green-400" />
                    : <ToggleLeft size={28} className="text-slate-500" />
                  }
                </button>

                <button
                  onClick={() => deleteCity(city)}
                  disabled={saving === city.id}
                  className="text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-5 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-blue-400 text-xs font-bold mb-1">How it works</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          When a customer opens the app, we detect their GPS location and check if their city is active.
          If not, they see a "Coming Soon" screen and cannot access the app.
          Toggle a city ON to launch in that area instantly.
        </p>
      </div>

      <BottomNav items={NAV} />
    </div>
  )
}
